import {NextResponse} from "next/server";
import {z} from "zod";
import {getSupabase} from "@/lib/supabase/server";

const questionSchema=z.object({
  animal_id:z.string().uuid().nullable().optional(),
  source_animal_id:z.string().trim().min(1).max(500).optional(),
  source_animal_name:z.string().trim().min(1).max(200).optional(),
  question:z.string().trim().min(3).max(1000),
}).refine(body=>Boolean(body.animal_id||body.source_animal_id),{
  path:["animal_id"],
  message:"Укажите животное.",
}).refine(body=>!body.source_animal_id||Boolean(body.source_animal_name),{
  path:["source_animal_name"],
  message:"Для импортированного животного нужно передать его имя.",
}).refine(body=>!(body.animal_id&&body.source_animal_id),{
  path:["animal_id"],
  message:"Используйте только один тип идентификатора животного.",
});

export async function GET(req:Request) {
  const params=new URL(req.url).searchParams;
  const animalId=z.string().uuid().safeParse(params.get("animal_id"));
  const sourceAnimalId=z.string().trim().min(1).max(500).safeParse(params.get("source_animal_id"));
  if((!animalId.success||!animalId.data)&&(!sourceAnimalId.success||!sourceAnimalId.data)) {
    return NextResponse.json({error:"Укажите корректный идентификатор животного."},{status:400});
  }

  const supabase=getSupabase();
  if(!supabase) {
    return NextResponse.json({error:"Supabase не настроен."},{status:503});
  }

  try {
    let query=supabase
      .from("animal_questions")
      .select("id,question,answer,answered_at");
    query=animalId.success&&animalId.data
      ?query.eq("animal_id",animalId.data)
      :query.eq("source_animal_id",sourceAnimalId.data);
    const {data,error}=await query.eq("status","answered").order("answered_at",{ascending:false});
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
