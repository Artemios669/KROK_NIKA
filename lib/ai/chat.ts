import {getOpenAI} from "@/lib/ai/client";
import {responseSchema} from "@/lib/ai/response-schema";
import {ValidatedProfile,userProfileSchema} from "@/lib/validation/profile";

type History={role:"assistant"|"user";text:string};

const system=`Ты — интеллектуальный помощник приюта НИКА. Общайся по-русски тепло и естественно. Узнавай сначала условия жизни, семью, распорядок, опыт и готовность к уходу; предпочтения спрашивай ближе к завершению. Задавай только один связный вопрос за раз. Не повторяй известное. Не выдумывай факты, не подменяй неизвестное false и не делай выводов по доходу или семейному положению. Если пользователь пропустил тему, оставь её неизвестной и не возвращайся к ней. Если сведения противоречат друг другу, попроси уточнить.`;

export {responseSchema};

export async function askAssistant(message:string,profile:ValidatedProfile,history:History[]) {
  const client=getOpenAI();
  if(!client)return null;

  const transcript=history.slice(-10).map(item=>`${item.role==="user"?"Пользователь":"Помощник"}: ${item.text}`).join("\n");
  const input=`Текущий профиль JSON:\n${JSON.stringify(profile)}\n\nНедавний диалог:\n${transcript}\n\nНовое сообщение пользователя: ${message}`;
  const response=await client.responses.create({
    model:process.env.OPENAI_MODEL||"gpt-4o-mini",
    input:[{role:"system",content:system},{role:"user",content:input}],
    text:{format:{type:"json_schema",name:"nika_profile_update",strict:true,schema:responseSchema}},
  });
  if(!response.output_text)throw new Error("empty AI response");
  const parsed=JSON.parse(response.output_text);
  return {
    message:String(parsed.message).slice(0,1200),
    profile:userProfileSchema.parse(parsed.profile),
  };
}
