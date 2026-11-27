import {NextResponse} from "next/server";
import {z} from "zod";
import {askRecommendationAssistant} from "@/lib/ai/gemini";
import {animals as demoAnimals} from "@/lib/demo-data";
import {matchAnimal} from "@/lib/matching";
import {getSupabase} from "@/lib/supabase/server";
import {loadSupabaseAnimalById} from "@/lib/supabase/animal-catalog";
import {swipeReactionSchema} from "@/lib/validation/recommendations";
import {userProfileSchema} from "@/lib/validation/profile";

const requestSchema=z.object({
  message:z.string().trim().min(1).max(800),
  animalId:z.string().min(1).max(1600),
  profile:userProfileSchema,
  swipes:z.array(swipeReactionSchema).max(10).default([]),
  history:z.array(z.object({
    role:z.enum(["assistant","user"]),
    text:z.string().max(1200),
  })).max(10).default([]),
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

function getApiStatus(error:unknown) {
  if(typeof error==="object"&&error!==null&&"status" in error&&typeof error.status==="number")return error.status;
  return undefined;
}

export async function POST(request:Request) {
  let rawBody:unknown;
  try {
    rawBody=await request.json();
  } catch {
    return NextResponse.json({error:"Некорректный формат запроса."},{status:400});
  }

  const parsed=requestSchema.safeParse(rawBody);
  if(!parsed.success)return NextResponse.json({error:"Проверьте сообщение и данные подбора."},{status:400});

  const ip=request.headers.get("x-forwarded-for")?.split(",")[0]||"local";
  if(!allowed(ip))return NextResponse.json({error:"Слишком много сообщений. Подождите минуту и попробуйте снова."},{status:429});

  let animal=demoAnimals.find(item=>item.id===parsed.data.animalId)||null;
  const supabase=getSupabase();
  if(supabase) {
    try {
      animal=await loadSupabaseAnimalById(supabase,parsed.data.animalId);
    } catch(error) {
      console.error("Recommendation assistant could not load the animal catalog:",error);
      return NextResponse.json({error:"Не удалось загрузить актуальные данные питомца."},{status:502});
    }
  }

  const match=animal&&matchAnimal(animal,parsed.data.profile,parsed.data.swipes);
  if(!match)return NextResponse.json({error:"Этот питомец больше не входит в текущий подбор. Обновите результаты."},{status:404});

  try {
    const message=await askRecommendationAssistant(
      parsed.data.message,
      parsed.data.profile,
      parsed.data.history,
      match,
    );
    if(!message) {
      return NextResponse.json({error:"ИИ-ассистент сейчас не настроен. Попробуйте позже."},{status:503});
    }
    return NextResponse.json({message,mode:"gemini"});
  } catch(error) {
    console.error("Recommendation assistant request failed:",error);
    const status=getApiStatus(error);
    const message=status===429
      ?"Достигнут лимит запросов Gemini. Подождите и попробуйте снова."
      :"Ассистент временно недоступен. Попробуйте отправить вопрос ещё раз.";
    return NextResponse.json({error:message},{status:status===429?429:503});
  }
}
