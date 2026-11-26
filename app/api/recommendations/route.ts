import {NextResponse} from "next/server";
import {getSupabase} from "@/lib/supabase/server";
import {animals as demoAnimals,getAnimalCatalogSource} from "@/lib/demo-data";
import {recommendations} from "@/lib/matching";
import {recommendationRequestSchema} from "@/lib/validation/recommendations";
import {loadSupabaseAnimalCatalog} from "@/lib/supabase/animal-catalog";

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
      catalogRecords:demoAnimals.length,
      eligibleRecords:demoAnimals.filter(animal=>animal.adoption_available&&animal.type!=="unknown").length,
      unavailableRecords:demoAnimals.filter(animal=>!animal.adoption_available).length,
      unsupportedTypeRecords:demoAnimals.filter(animal=>animal.adoption_available&&animal.type==="unknown").length,
      unconfirmedAvailabilityRecords:0,
    });
  }

  try {
    const catalog=await loadSupabaseAnimalCatalog(supabase);
    const availableAnimals=catalog.animals.filter(animal=>animal.adoption_available);
    const eligibleAnimals=availableAnimals.filter(animal=>animal.type!=="unknown");

    return NextResponse.json({
      recommendations:recommendations(eligibleAnimals,parsed.data.profile,parsed.data.swipes),
      source:catalog.table==="animalsss"?"supabase":getAnimalCatalogSource(eligibleAnimals),
      catalogRecords:catalog.totalRecords,
      eligibleRecords:eligibleAnimals.length,
      unavailableRecords:catalog.unavailableRecords,
      unsupportedTypeRecords:availableAnimals.length-eligibleAnimals.length,
      unconfirmedAvailabilityRecords:catalog.unconfirmedAvailability,
    });
  } catch(error) {
    console.error("Supabase recommendation request failed:",error);
    return NextResponse.json({error:"Не удалось загрузить и проверить каталог Supabase."},{status:502});
  }
}
