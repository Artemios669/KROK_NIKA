import {NextResponse} from "next/server";
import {getSupabase} from "@/lib/supabase/server";
import {animals as demoAnimals,getAnimalCatalogSource} from "@/lib/demo-data";
import {recommendations} from "@/lib/matching";
import {animalsSchema} from "@/lib/validation/animal";
import {recommendationRequestSchema} from "@/lib/validation/recommendations";

export async function POST(req:Request) {
  let body:unknown;
  try {
    body=await req.json();
  } catch {
    return NextResponse.json({error:"Некорректный JSON запроса."},{status:400});
  }

  const parsed=recommendationRequestSchema.safeParse(body);
  if(!parsed.success) {
    return NextResponse.json({error:"Профиль или реакции на карточки имеют неверный формат."},{status:400});
  }

  const supabase=getSupabase();
  if(!supabase) {
    return NextResponse.json({
      recommendations:recommendations(demoAnimals,parsed.data.profile,parsed.data.swipes),
      source:"demo",
    });
  }

  try {
    const {data,error}=await supabase
      .from("animals")
      .select("*")
      .eq("adoption_available",true)
      .order("last_updated",{ascending:false});

    if(error) {
      console.error("Supabase recommendation query failed:",error.message);
      return NextResponse.json({error:"Не удалось загрузить животных из Supabase."},{status:502});
    }

    const validatedAnimals=animalsSchema.safeParse(data||[]);
    if(!validatedAnimals.success) {
      console.error("Supabase returned invalid animal data:",validatedAnimals.error.issues);
      return NextResponse.json({error:"В базе есть карточки животных с некорректными данными."},{status:500});
    }

    return NextResponse.json({
      recommendations:recommendations(validatedAnimals.data,parsed.data.profile,parsed.data.swipes),
      source:getAnimalCatalogSource(validatedAnimals.data),
    });
  } catch(error) {
    console.error("Supabase recommendation request failed:",error);
    return NextResponse.json({error:"Supabase временно недоступен."},{status:502});
  }
}
