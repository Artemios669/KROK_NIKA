import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {createClient} from "@supabase/supabase-js";

const table=process.env.SUPABASE_ANIMALS_TABLE?.trim()||"animals";
if(table!=="animalsss") {
  throw new Error("Set SUPABASE_ANIMALS_TABLE=animalsss before exporting the parser review set.");
}

const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!key)throw new Error("Supabase URL and anon key are required; values are not printed.");

const fields=[
  "type","age_years","age_text","sex","size","color","character","activity_level",
  "housing_requirements","good_with_children","good_with_cats","good_with_dogs",
  "good_with_other_animals","can_stay_alone_hours","special_care","coat_details",
  "ear_shape","shelter_story","health_notes","care_notes","interesting_facts",
];
const columns=["id","description",...fields].join(",");
const outputDirectory=path.resolve("eval-results");
const outputPath=path.join(outputDirectory,"animal-parser-review.jsonl");
const client=createClient(url,key,{auth:{persistSession:false}});
const records=[];
let expectedCount=null;

for(let offset=0;;offset+=500) {
  const {data,error,count}=await client.from(table)
    .select(columns,{count:offset===0?"exact":undefined})
    .order("id",{ascending:true})
    .range(offset,offset+499);
  if(error)throw new Error(`Catalog read failed at offset ${offset}: ${error.message}`);
  if(offset===0)expectedCount=count;
  records.push(...(data||[]));
  if(!data||data.length<500)break;
}

if(records.length===0)throw new Error("No records were returned from animalsss.");
if(expectedCount!==null&&expectedCount!==records.length) {
  throw new Error(`Catalog count changed during export: expected ${expectedCount}, read ${records.length}.`);
}
const lines=records.map(record=>JSON.stringify({
  record_id:String(record.id),
  source_description:typeof record.description==="string"?record.description:"",
  predicted:Object.fromEntries(fields.map(field=>[field,record[field]??null])),
  expected:{},
  reviewed_fields:[],
  reviewer_notes:"",
}));
await mkdir(outputDirectory,{recursive:true});
await writeFile(outputPath,`${lines.join("\n")}\n`,"utf8");

console.log(JSON.stringify({
  table,
  recordCount:records.length,
  descriptionsPresent:records.filter(record=>typeof record.description==="string"&&record.description.trim()).length,
  fieldsPerRecord:fields.length,
  outputPath,
  llmCalls:0,
  descriptionsSentToLlm:false,
},null,2));
