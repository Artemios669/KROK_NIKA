import "server-only";
import {GoogleGenAI} from "@google/genai";
import {responseSchema} from "@/lib/ai/response-schema";
import {ValidatedProfile,userProfileSchema} from "@/lib/validation/profile";
import {ChatTopic} from "@/lib/chat/progress";

type History={role:"assistant"|"user";text:string};
const instruction=`Ты — доброжелательный помощник приюта НИКА. Веди разговор естественно, на русском, и задавай по одному связному вопросу. Сначала узнай жильё, семью и других питомцев, время отсутствия дома, опыт и готовность к уходу; предпочтения по типу и внешности выясняй ближе к концу. Учитывай уже сказанное и не спрашивай повторно. Не выдумывай сведения и не заменяй null значением false. Не делай выводов о готовности по доходу или семейному положению. Если пользователь пропускает тему, не заполняй её и не задавай повторно. Если ответы противоречат друг другу, попроси уточнение. В household.other_animals_confirmed ставь true только если человек назвал питомцев или явно подтвердил, что других питомцев нет. Сохраняй неизвестные данные как null или пустой массив с other_animals_confirmed:null.`;

export async function askGemini(
  message:string,
  profile:ValidatedProfile,
  history:History[],
  currentTopic:ChatTopic,
  skippedTopics:ChatTopic[],
  skipCurrentQuestion:boolean,
) {
  const key=process.env.GEMINI_API_KEY;
  if(!key)return null;

  const ai=new GoogleGenAI({apiKey:key});
  const transcript=history.slice(-10).map(item=>`${item.role==="user"?"Пользователь":"Помощник"}: ${item.text}`).join("\n");
  const currentMessage=skipCurrentQuestion
    ? `Пользователь пропускает вопрос по теме «${currentTopic}». Оставь соответствующие сведения неизвестными.`
    : message;
  const prompt=[
    instruction,
    `Текущая тема диалога: ${currentTopic}.`,
    `Ранее пропущенные темы: ${skippedTopics.length?skippedTopics.join(", "):"нет"}.`,
    `Текущий профиль JSON: ${JSON.stringify(profile)}`,
    `Недавний диалог:\n${transcript}`,
    `Новое сообщение: ${currentMessage}`,
  ].join("\n\n");
  const response=await ai.models.generateContent({
    model:process.env.GEMINI_MODEL||"gemini-3.5-flash-lite",
    contents:prompt,
    config:{responseMimeType:"application/json",responseJsonSchema:responseSchema},
  });
  if(!response.text)throw new Error("empty Gemini response");
  const result=JSON.parse(response.text);
  return {
    message:String(result.message).slice(0,1200),
    profile:userProfileSchema.parse(result.profile),
  };
}
