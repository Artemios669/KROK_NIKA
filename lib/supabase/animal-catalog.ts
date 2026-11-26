import "server-only";
import {animalsSchema} from "@/lib/validation/animal";
import {normalizeImportedAnimals} from "@/lib/animal-catalog";
import {getAnimalsTableName,getSupabase} from "@/lib/supabase/server";

type SupabaseClient=NonNullable<ReturnType<typeof getSupabase>>;

const importedColumns=[
  "id","name","type","age_years","age_text","sex","size","color","character",
  "activity_level","housing_requirements","good_with_children","good_with_cats",
  "good_with_dogs","good_with_other_animals","can_stay_alone_hours","special_care",
  "description","image_url","image_gallery","adoption_available","guardianship_available",
  "shelter","coat_details","ear_shape","shelter_story","health_notes","interesting_facts",
  "care_notes","intro_source_text",
].join(",");

const pageSize=500;

export async function loadSupabaseAnimalCatalog(client:SupabaseClient) {
  const table=getAnimalsTableName();
  const rows:unknown[]=[];

  for(let offset=0;;offset+=pageSize) {
    const result=table==="animalsss"
      ? await client.from("animalsss").select(importedColumns).order("id",{ascending:true}).range(offset,offset+pageSize-1)
      : await client.from("animals").select("*").order("id",{ascending:true}).range(offset,offset+pageSize-1);

    if(result.error)throw new Error(result.error.message);
    const page=result.data||[];
    rows.push(...page);
    if(page.length<pageSize)break;
  }

  if(table==="animalsss") {
    const normalized=normalizeImportedAnimals(rows,{assumeAvailableWhenUnknown:true});
    if(normalized.skipped>0) {
      throw new Error(`${normalized.skipped} rows in ${table} have no valid id or contain invalid data.`);
    }
    return {
      animals:normalized.animals,
      table,
      totalRecords:rows.length,
      unconfirmedAvailability:normalized.unconfirmedAvailability,
      unavailableRecords:normalized.unavailableRecords,
    };
  }

  const parsed=animalsSchema.safeParse(rows);
  if(!parsed.success) {
    throw new Error(`Rows in ${table} do not match the application animal schema: ${parsed.error.issues.length} validation issues.`);
  }
  return {
    animals:parsed.data,
    table,
    totalRecords:rows.length,
    unconfirmedAvailability:0,
    unavailableRecords:parsed.data.filter(animal=>!animal.adoption_available).length,
  };
}
