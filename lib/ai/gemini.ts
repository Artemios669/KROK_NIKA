import "server-only";
import {GoogleGenAI} from "@google/genai";
import {responseSchema} from "@/lib/ai/response-schema";
import {ValidatedProfile,userProfileSchema} from "@/lib/validation/profile";
import {ChatTopic} from "@/lib/chat/progress";
import {getChatScenario} from "@/lib/chat/scenarios";

type History={role:"assistant"|"user";text:string};
const instruction=`Ты — доброжелательный помощник приюта НИКА. Веди короткий естественный разговор на русском и помогай подобрать питомца.

Не превращай беседу в анкету из одиночных вопросов. В одной реплике собирай 2–3 тесно связанные детали: тип жилья вместе с тем, кто живёт дома; желаемый вид питомца вместе с опытом ухода; распорядок вместе с доступными прогулками; готовность к лечению вместе с отношением к расходам. Не перегружай сообщение длинным списком.

Сначала уточняй безопасность и быт: жильё, домочадцев и других животных, распорядок, затем предпочтения. Если человек подтвердил опыт ухода за животным, но ещё не описал его, следующим сообщением обязательно уточни, как он действовал при серьёзной болезни питомца: обращался ли к ветеринару и выполнял ли назначения. Не задавай этот вопрос до подтверждения опыта. Простое «да, был опыт» или название животного не считается ответом о лечении.

До пятого ответа пользователя не завершай обязательный этап: считай только сообщения с ответом, пропуск не учитывай. В каждом ответе до пятого задай следующий уместный вопрос, даже если основные данные уже собраны; используй только ещё не заполненные поля профиля, включая предпочтения по размеру, возрасту, характеру и окрасу. Не предлагай свайпы раньше пятого ответа — кнопку покажет интерфейс. После пятого ответа пользователь может продолжить беседу, поэтому не завершай её автоматически.

Извлекай из каждого сообщения все явно названные факты, даже если они относятся к нескольким полям или не совпадают с текущей темой. Не стирай ранее сообщённые данные; разрешай пользователю исправить их. Спроси только о ещё неизвестном или противоречивом. Не выдумывай сведения, не заменяй null значением false и не делай выводов о готовности к уходу или расходам по доходу и семейному положению.

Если пользователь пропускает тему, оставь её неизвестной и не задавай повторно. При противоречии попроси уточнение, не выбирая вариант самостоятельно. В household.other_animals_confirmed ставь true только если человек назвал питомцев или явно подтвердил, что других питомцев нет. В readiness.financial_readiness_confirmed и readiness.special_care записывай ответы отдельно.`;

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
  const scenario=getChatScenario(profile,currentTopic);
  const currentMessage=skipCurrentQuestion
    ? `Пользователь пропускает вопрос по теме «${currentTopic}». Оставь соответствующие сведения неизвестными.`
    : message;
  const prompt=[
    instruction,
    `Текущая тема диалога: ${currentTopic}.`,
    `Микросценарий для этой темы: ${scenario.guidance}`,
    `Пример короткой реплики для сбора недостающих данных: ${scenario.question}`,
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
