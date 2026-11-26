import {NextResponse} from "next/server";
import {z} from "zod";
import {getSupabase} from "@/lib/supabase/server";
import {userProfileSchema} from "@/lib/validation/profile";

const requestSchema=z.object({
  animal_id:z.string().uuid().nullable().optional(),
  source_animal_id:z.string().trim().min(1).max(500).optional(),
  source_animal_name:z.string().trim().min(1).max(200).optional(),
  contact_name:z.string().trim().min(2).max(80),
  contact_email:z.string().trim().email().max(120),
  message:z.string().trim().max(1000).optional(),
  request_type:z.enum(["adoption","guardianship"]),
  user_profile:userProfileSchema.nullable().optional(),
}).refine(body=>!body.source_animal_id||Boolean(body.source_animal_name),{
  path:["source_animal_name"],
  message:"Для импортированного животного нужно передать его имя.",
}).refine(body=>!(body.animal_id&&body.source_animal_id),{
  path:["animal_id"],
  message:"Используйте только один тип идентификатора животного.",
});

export async function POST(req:Request) {
  let body:unknown;
  try {
    body=await req.json();
  } catch {
    return NextResponse.json({error:"Некорректный JSON запроса."},{status:400});
  }

  const parsed=requestSchema.safeParse(body);
  if(!parsed.success) {
    return NextResponse.json({error:"Проверьте имя, email и данные заявки."},{status:400});
  }

  const supabase=getSupabase();
  if(!supabase) {
    return NextResponse.json({error:"Supabase не настроен: заявка не сохранена."},{status:503});
  }

  try {
    const {error}=await supabase.from("adoption_requests").insert(parsed.data);
    if(error) {
      console.error("Supabase adoption request insert failed:",error.message);
      return NextResponse.json({error:"Не удалось сохранить заявку в Supabase."},{status:500});
    }
  } catch(error) {
    console.error("Supabase adoption request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен. Заявка не сохранена."},{status:502});
  }

  return NextResponse.json({saved:true,mode:"supabase"},{status:201});
}
