import {NextResponse} from "next/server";
import {z} from "zod";
import {askGemini} from "@/lib/ai/gemini";
import {createDemoChatReply,extractProfileFacts} from "@/lib/chat/demo";
import {
  ChatTopic,
  chatTopicSchema,
  findChatProfileConflicts,
  getChatProgress,
  hasExperienceCareDetails,
  isChatTopicComplete,
  mergeChatProfile,
  normalizeChatProfile,
  preserveSkippedTopic,
} from "@/lib/chat/progress";
import {getChatScenario} from "@/lib/chat/scenarios";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile} from "@/types/user";

const requestSchema=z.object({
  message:z.string().trim().min(1).max(800),
  profile:userProfileSchema.optional(),
  history:z.array(z.object({
    role:z.enum(["assistant","user"]),
    text:z.string().max(1200),
  })).max(12).optional(),
  currentTopic:chatTopicSchema.optional(),
  skippedTopics:z.array(chatTopicSchema).max(8).optional(),
  skipCurrentQuestion:z.boolean().optional(),
});

const requests=new Map<string,{count:number;until:number}>();
function allowed(key:string) {
  const now=Date.now();
  const item=requests.get(key);
  if(!item||item.until<now) {
    requests.set(key,{count:1,until:now+60_000});
    return true;
  }
  if(item.count>=10)return false;
  item.count++;
  return true;
}

function isSkipMessage(message:string) {
  return /^(?:пропустить(?:\s+(?:этот\s+)?вопрос)?|пропуск|не хочу отвечать|не знаю|затрудняюсь ответить)[.! ]*$/i.test(message.trim());
}

const profileConflictPromptPrefix="В профиле обнаружились противоречивые сведения:";

function getApiStatus(error:unknown) {
  if(typeof error==="object"&&error!==null&&"status" in error&&typeof error.status==="number")return error.status;
  return undefined;
}

function getGeminiErrorMessage(status:number|undefined) {
  if(status===400||status===401)return "Ключ Gemini недействителен. Создайте новый ключ в Google AI Studio и замените GEMINI_API_KEY в настройках.";
  if(status===403)return "Google запретил запрос (HTTP 403). Проверьте ограничения ключа и доступ к Gemini API в Google AI Studio.";
  if(status===404)return "Модель Gemini не найдена (HTTP 404). Проверьте значение GEMINI_MODEL в настройках.";
  if(status===429)return "Достигнут лимит запросов Gemini. Подождите восстановления бесплатной квоты и попробуйте снова.";
  if(status!==undefined)return `Gemini API вернул ошибку HTTP ${status}. Проверьте журнал сервера.`;
  return "Не удалось связаться с Gemini API. Проверьте интернет-подключение, настройки ключа и журнал сервера.";
}

export async function POST(request:Request) {
  let rawBody:unknown;
  try {
    rawBody=await request.json();
  } catch {
    return NextResponse.json({error:"Некорректный формат запроса."},{status:400});
  }

  const parsed=requestSchema.safeParse(rawBody);
  if(!parsed.success)return NextResponse.json({error:"Проверьте текст сообщения и данные профиля."},{status:400});

  const body=parsed.data;
  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"local";
  if(!allowed(ip))return NextResponse.json({error:"Слишком много сообщений. Подождите минуту и повторите попытку."},{status:429});

  const skippedTopics=body.skippedTopics||[];
  const history=body.history||[];
  const storedProfile=normalizeChatProfile(body.profile||emptyProfile);
  const historicalProfile=history.reduce((collected,item)=>{
    if(item.role!=="user"||isSkipMessage(item.text))return collected;
    const topic=getChatProgress(collected,skippedTopics).nextTopic||body.currentTopic||"housing";
    return extractProfileFacts(item.text,collected,topic);
  },emptyProfile);
  const profile=mergeChatProfile(storedProfile,storedProfile,normalizeChatProfile(historicalProfile));
  const progress=getChatProgress(profile,skippedTopics);
  const submittedTopic:ChatTopic=body.currentTopic||progress.nextTopic||"housing";
  const skipCurrentQuestion=body.skipCurrentQuestion===true||isSkipMessage(body.message);
  const resolvingProfileConflict=history.at(-1)?.role==="assistant"&&
    history.at(-1)?.text.startsWith(profileConflictPromptPrefix)===true;
  const nextSkippedTopics=new Set(skippedTopics);

  if(skipCurrentQuestion&&!isChatTopicComplete(profile,submittedTopic))nextSkippedTopics.add(submittedTopic);
  const extractedProfile=skipCurrentQuestion
    ?profile
    :normalizeChatProfile(extractProfileFacts(body.message,profile,submittedTopic));
  const nextUnresolvedTopic=getChatProgress(extractedProfile,[...nextSkippedTopics]).nextTopic;
  const topicForGemini=skipCurrentQuestion?submittedTopic:nextUnresolvedTopic||submittedTopic;

  try {
    const ai=await askGemini(
      body.message,
      extractedProfile,
      history,
      topicForGemini,
      [...nextSkippedTopics],
      skipCurrentQuestion,
    );
    if(ai) {
      const profileConflicts=skipCurrentQuestion||resolvingProfileConflict
        ?[]
        :findChatProfileConflicts(profile,extractedProfile,ai.profile);
      const mergedProfile=mergeChatProfile(profile,extractedProfile,ai.profile,resolvingProfileConflict);
      const updatedProfile=skipCurrentQuestion
        ? preserveSkippedTopic(mergedProfile,profile,submittedTopic)
        : mergedProfile;
      const responseProgress=getChatProgress(updatedProfile,[...nextSkippedTopics]);
      const needsExperienceFollowUp=!skipCurrentQuestion&&
        responseProgress.nextTopic==="experience"&&
        updatedProfile.experience.has_pet_experience===true&&
        !hasExperienceCareDetails(updatedProfile.experience.care_experience);
      const nextQuestion=responseProgress.nextTopic
        ?getChatScenario(updatedProfile,responseProgress.nextTopic).question
        :null;
      const acknowledgement=/[?？]/.test(ai.message)?"":ai.message.trim();
      const conflictMessage=profileConflicts.length
        ?`${profileConflictPromptPrefix} ${profileConflicts.join(", ")}. Уточните, пожалуйста, какие значения актуальны.`
        :null;
      const message=conflictMessage
        ?conflictMessage
        :needsExperienceFollowUp
        ?getChatScenario(updatedProfile,"experience").question
        :nextQuestion
          ?[acknowledgement,nextQuestion].filter(Boolean).join(" ")
          :/[?？]/.test(ai.message)
            ?"Спасибо, основные темы разобраны. Если захотите, можно перейти к характеристикам животных."
            :ai.message;
      return NextResponse.json({
        message,
        profile:updatedProfile,
        mode:"gemini",
        progress:responseProgress,
      });
    }
  } catch(error) {
    console.error("Gemini chat error",error);
    const status=getApiStatus(error);
    return NextResponse.json(
      {error:getGeminiErrorMessage(status)},
      {status:status===429?429:status!==undefined&&status<500?502:503},
    );
  }

  const result=createDemoChatReply({
    message:body.message,
    profile,
    currentTopic:submittedTopic,
    skippedTopics:[...nextSkippedTopics],
    skipCurrentQuestion,
  });
  return NextResponse.json(result);
}
