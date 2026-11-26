import {NextResponse} from "next/server";
import {z} from "zod";
import {isAdmin} from "@/lib/admin-auth";
import {getSupabaseAdmin} from "@/lib/supabase/server";

const answerSchema=z.object({
  answer:z.string().trim().min(3).max(2000),
});

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}) {
  if(!await isAdmin()) {
    return NextResponse.json({error:"Требуется вход администратора."},{status:401});
  }

  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({error:"Некорректный идентификатор вопроса."},{status:400});
  }

  let body:unknown;
  try {
    body=await req.json();
  } catch {
    return NextResponse.json({error:"Некорректный JSON запроса."},{status:400});
  }

  const parsed=answerSchema.safeParse(body);
  if(!parsed.success) {
    return NextResponse.json({error:"Ответ должен содержать от 3 до 2000 символов."},{status:400});
  }

  const supabase=getSupabaseAdmin();
  if(!supabase) {
    return NextResponse.json({error:"Админ-доступ к Supabase не настроен."},{status:503});
  }

  try {
    const {data,error}=await supabase
      .from("animal_questions")
      .update({
        answer:parsed.data.answer,
        status:"answered",
        answered_at:new Date().toISOString(),
      })
      .eq("id",id)
      .eq("status","pending")
      .select("id")
      .maybeSingle();

    if(error) {
      console.error("Supabase question answer update failed:",error.message);
      return NextResponse.json({error:"Не удалось сохранить ответ."},{status:500});
    }
    if(!data) {
      return NextResponse.json({error:"Вопрос не найден или на него уже ответили."},{status:409});
    }

    return NextResponse.json({saved:true,status:"answered"});
  } catch(error) {
    console.error("Supabase question answer request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен."},{status:502});
  }
}
