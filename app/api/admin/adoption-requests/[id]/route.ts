import {NextResponse} from "next/server";
import {z} from "zod";
import {isAdmin} from "@/lib/admin-auth";
import {getSupabaseAdmin} from "@/lib/supabase/server";

const statusSchema=z.object({
  status:z.enum(["pending","in_progress","approved","rejected"]),
});

export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}) {
  if(!await isAdmin()) {
    return NextResponse.json({error:"Требуется вход администратора."},{status:401});
  }

  const {id}=await params;
  if(!z.string().uuid().safeParse(id).success) {
    return NextResponse.json({error:"Некорректный идентификатор заявки."},{status:400});
  }

  let body:unknown;
  try {
    body=await req.json();
  } catch {
    return NextResponse.json({error:"Некорректный JSON запроса."},{status:400});
  }

  const parsed=statusSchema.safeParse(body);
  if(!parsed.success) {
    return NextResponse.json({error:"Выберите допустимый статус заявки."},{status:400});
  }

  const supabase=getSupabaseAdmin();
  if(!supabase) {
    return NextResponse.json({error:"Админ-доступ к Supabase не настроен."},{status:503});
  }

  try {
    const {data,error}=await supabase
      .from("adoption_requests")
      .update({status:parsed.data.status})
      .eq("id",id)
      .select("id,status")
      .maybeSingle();

    if(error) {
      console.error("Supabase adoption request status update failed:",error.message);
      return NextResponse.json({error:"Не удалось изменить статус заявки."},{status:500});
    }
    if(!data) {
      return NextResponse.json({error:"Заявка не найдена."},{status:404});
    }

    return NextResponse.json({saved:true,status:data.status});
  } catch(error) {
    console.error("Supabase adoption request update failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен."},{status:502});
  }
}
