import {NextResponse} from "next/server";
import {isAdmin} from "@/lib/admin-auth";
import {getSupabaseAdmin} from "@/lib/supabase/server";
import {loadSupabaseAnimalCatalog} from "@/lib/supabase/animal-catalog";

export async function GET() {
  if(!await isAdmin()) {
    return NextResponse.json({error:"Требуется вход администратора."},{status:401});
  }

  const db=getSupabaseAdmin();
  if(!db) {
    return NextResponse.json({error:"Для админ-панели настройте SUPABASE_SERVICE_ROLE_KEY."},{status:503});
  }

  try {
    const catalog=await loadSupabaseAnimalCatalog(db);
    const [questions,requests]=await Promise.all([
      db.from("animal_questions").select("id,animal_id,source_animal_id,source_animal_name,question,answer,status,created_at,answered_at,animals(name)").order("created_at",{ascending:false}),
      db.from("adoption_requests").select("id,contact_name,contact_email,message,request_type,status,created_at,source_animal_id,source_animal_name,animals(name)").order("created_at",{ascending:false}),
    ]);

    const error=questions.error||requests.error;
    if(error) {
      console.error("Supabase admin dashboard query failed:",error.message);
      return NextResponse.json({error:"Не удалось загрузить данные Supabase."},{status:500});
    }

    return NextResponse.json({
      animals:catalog.animals.map(({id,name,type,adoption_available,image_url})=>({id,name,type,adoption_available,image_url})),
      questions:questions.data,
      requests:requests.data,
      mode:"supabase",
      totalAnimalRecords:catalog.totalRecords,
    });
  } catch(error) {
    console.error("Supabase admin dashboard request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен."},{status:502});
  }
}
