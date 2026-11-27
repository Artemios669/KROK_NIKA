import {NextResponse} from "next/server";
import {getSupabase} from "@/lib/supabase/server";
import {animals as demoAnimals,getAnimalCatalogSource} from "@/lib/demo-data";
import {loadSupabaseAnimalCatalog} from "@/lib/supabase/animal-catalog";

export async function GET(){
  const supabase=getSupabase();
  if(!supabase)return NextResponse.json({
    animals:demoAnimals,
    source:"demo",
    idKind:"demo",
    totalRecords:demoAnimals.length,
    eligibleRecords:demoAnimals.filter(animal=>animal.adoption_available&&animal.type!=="unknown").length,
    unavailableRecords:demoAnimals.filter(animal=>!animal.adoption_available).length,
    unsupportedTypeRecords:demoAnimals.filter(animal=>animal.adoption_available&&animal.type==="unknown").length,
    unconfirmedAvailabilityRecords:0,
  });

  try {
    const catalog=await loadSupabaseAnimalCatalog(supabase);
    const availableAnimals=catalog.animals.filter(animal=>animal.adoption_available);
    const animals=availableAnimals.filter(animal=>animal.type!=="unknown");
    const source=catalog.table==="animalsss"?"supabase":getAnimalCatalogSource(animals);
    return NextResponse.json({
      animals,
      source,
      idKind:catalog.table==="animalsss"?"text":"uuid",
      totalRecords:catalog.totalRecords,
      eligibleRecords:animals.length,
      unavailableRecords:catalog.unavailableRecords,
      unsupportedTypeRecords:availableAnimals.length-animals.length,
      unconfirmedAvailabilityRecords:catalog.unconfirmedAvailability,
    });
  } catch(error) {
    console.error("Supabase animal catalog query failed:",error);
    return NextResponse.json(
      {error:"Не удалось загрузить каталог из Supabase. Проверьте таблицу и её поля."},
      {status:502},
    );
  }
}
