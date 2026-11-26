import {NextResponse} from "next/server";
import {z} from "zod";
import {getSupabase} from "@/lib/supabase/server";

const questionSchema=z.object({
  animal_id:z.string().uuid(),
  question:z.string().trim().min(3).max(1000),
});

export async function GET(req:Request) {
  const animalId=z.string().uuid().safeParse(new URL(req.url).searchParams.get("animal_id"));
  if(!animalId.success) {
    return NextResponse.json({error:"Укажите корректный идентификатор животного."},{status:400});
  }

  const supabase=getSupabase();
  if(!supabase) {
    return NextResponse.json({error:"Supabase не настроен."},{status:503});
  }

  try {
    const {data,error}=await supabase
      .from("animal_questions")
      .select("id,question,answer,answered_at")
      .eq("animal_id",animalId.data)
      .eq("status","answered")
      .order("answered_at",{ascending:false});
    if(error) {
      console.error("Supabase answered questions query failed:",error.message);
      return NextResponse.json({error:"Не удалось загрузить ответы приюта."},{status:500});
    }

    return NextResponse.json({questions:data||[]});
  } catch(error) {
    console.error("Supabase answered questions request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен."},{status:502});
  }
}

export async function POST(req:Request) {
  let body:unknown;
  try {
    body=await req.json();
  } catch {
    return NextResponse.json({error:"Некорректный JSON запроса."},{status:400});
  }

  const parsed=questionSchema.safeParse(body);
  if(!parsed.success) {
    return NextResponse.json({error:"Проверьте карточку животного и текст вопроса."},{status:400});
  }

  const supabase=getSupabase();
  if(!supabase) {
    return NextResponse.json({error:"Supabase не настроен: вопрос не сохранён."},{status:503});
  }

  try {
    const {error}=await supabase.from("animal_questions").insert(parsed.data);
    if(error) {
      console.error("Supabase question insert failed:",error.message);
      return NextResponse.json({error:"Не удалось сохранить вопрос в Supabase."},{status:500});
    }
  } catch(error) {
    console.error("Supabase question request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен. Вопрос не сохранён."},{status:502});
  }

  return NextResponse.json({saved:true,mode:"supabase"},{status:201});
}
