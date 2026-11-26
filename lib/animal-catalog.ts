import {Animal} from "@/types/animal";
import {animalSchema} from "@/lib/validation/animal";

type AnimalRecord=Record<string,unknown>;

function isRecord(value:unknown):value is AnimalRecord {
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}

function readText(value:unknown):string|null {
  if(typeof value==="string")return value.trim()||null;
  if(typeof value==="number"&&Number.isFinite(value))return String(value);
  if(typeof value==="boolean")return String(value);
  return null;
}

function readList(value:unknown):string[] {
  if(Array.isArray(value))return value.map(readText).filter((item):item is string=>item!==null);
  const text=readText(value);
  if(!text)return [];
  try {
    const parsed:unknown=JSON.parse(text);
    if(Array.isArray(parsed))return parsed.map(readText).filter((item):item is string=>item!==null);
  } catch {
    // Text columns may contain plain text rather than JSON arrays.
  }
  return text.split(/[,;|\n•]+/).map(item=>item.trim()).filter(Boolean);
}

function readNumber(value:unknown):number|null {
  if(typeof value==="number")return Number.isFinite(value)&&value>=0?value:null;
  const text=readText(value);
  if(!text)return null;
  const match=text.match(/^(\d+(?:[.,]\d+)?)\s*(?:лет|года|год|часа|часов|час)?$/i);
  if(!match)return null;
  const number=Number(match[1].replace(",","."));
  return Number.isFinite(number)&&number>=0?number:null;
}

function readBoolean(value:unknown):boolean|null {
  if(typeof value==="boolean")return value;
  const text=readText(value)?.toLocaleLowerCase("ru").replace(/ё/g,"е");
  if(!text||/^(?:unknown|н\/д|n\/a|—|-)$/i.test(text)||/(?:неизвест|не\s+знаю|не\s+определ|уточн|не проверен|нет данных)/i.test(text))return null;
  if(/^(?:false|0|no|нет|не\s|несовместим|не подходит|не дружит|не требуется|не нужен|пристроен|недоступно|архив)/i.test(text))return false;
  if(/^(?:true|1|yes|да|совместим|подходит|дружит|можно|есть|требуется|нужен|доступно|пристраивается|на пристрой|ищет (?:дом|любящую семью|семью)|в поиске (?:дома|семьи)|в добрые руки|готов к пристрой)/i.test(text))return true;
  return null;
}

function readType(value:unknown):Animal["type"] {
  const text=readText(value)?.toLocaleLowerCase("ru").replace(/ё/g,"е")||"";
  if(/^(?:dog|собак|пес|щен)/i.test(text))return "dog";
  if(/^(?:cat|кошк|кот|котен)/i.test(text))return "cat";
  return "unknown";
}

function readSex(value:unknown):Animal["sex"] {
  const text=readText(value)?.toLocaleLowerCase("ru").replace(/ё/g,"е")||"";
  if(/^(?:male|m|самец|кобел|мальчик|мужской)/i.test(text))return "male";
  if(/^(?:female|f|самка|сука|девочка|женский)/i.test(text))return "female";
  return "unknown";
}

function readSize(value:unknown):Animal["size"] {
  const text=readText(value)?.toLocaleLowerCase("ru").replace(/ё/g,"е")||"";
  if(/^(?:small|s$|маленьк|малый|небольш|мелк|миниатюр)/i.test(text))return "small";
  if(/^(?:medium|m$|средн)/i.test(text))return "medium";
  if(/^(?:large|l$|крупн|больш)/i.test(text))return "large";
  return "unknown";
}

function readActivity(value:unknown):Animal["activity_level"] {
  const text=readText(value)?.toLocaleLowerCase("ru").replace(/ё/g,"е")||"";
  if(/^(?:low|низк|спокой|неактив)/i.test(text))return "low";
  if(/^(?:moderate|medium|умерен|средн)/i.test(text))return "moderate";
  if(/^(?:high|высок|актив|энергич|подвиж)/i.test(text))return "high";
  return "unknown";
}

function isLogoImageUrl(value:string):boolean {
  const path=value.split(/[?#]/,1)[0];
  const fileName=path.split("/").pop()||"";
  return /(?:^|[-_.])logo(?:[-_.]|$)/i.test(fileName);
}

function readGalleryImage(value:unknown):string|null {
  if(Array.isArray(value)) {
    for(const entry of value) {
      if(typeof entry==="string"&&entry.trim()&&!isLogoImageUrl(entry.trim()))return entry.trim();
      if(isRecord(entry)) {
        const url=readText(entry.url)||readText(entry.src);
        if(url&&!isLogoImageUrl(url))return url;
      }
    }
    return null;
  }
  const text=readText(value);
  if(!text)return null;
  try {
    const parsed:unknown=JSON.parse(text);
    return readGalleryImage(parsed);
  } catch {
    return null;
  }
}

export function normalizeImportedAnimal(value:unknown):Animal|null {
  return normalizeImportedAnimalWithOptions(value,{});
}

type ImportedAnimalOptions={assumeAvailableWhenUnknown?:boolean};

function normalizeImportedAnimalWithOptions(value:unknown,options:ImportedAnimalOptions):Animal|null {
  if(!isRecord(value))return null;
  const id=readText(value.id);
  if(!id)return null;

  const ageValue=readText(value.age_years);
  const ageYears=readNumber(value.age_years);
  const adoptionAvailability=readBoolean(value.adoption_available);
  const normalized={
    id,
    name:readText(value.name)||"Без имени",
    type:readType(value.type),
    age_years:ageYears,
    age_text:readText(value.age_text)||(ageYears===null?ageValue:null),
    sex:readSex(value.sex),
    size:readSize(value.size),
    color:readList(value.color),
    character:readList(value.character),
    activity_level:readActivity(value.activity_level),
    housing_requirements:readList(value.housing_requirements),
    good_with_children:readBoolean(value.good_with_children),
    good_with_cats:readBoolean(value.good_with_cats),
    good_with_dogs:readBoolean(value.good_with_dogs),
    good_with_other_animals:readBoolean(value.good_with_other_animals),
    can_stay_alone_hours:readNumber(value.can_stay_alone_hours),
    special_care:readBoolean(value.special_care),
    description:readText(value.description)||readText(value.intro_source_text)||"",
    image_url:readGalleryImage(value.image_gallery)||"",
    adoption_available:adoptionAvailability===true||(options.assumeAvailableWhenUnknown===true&&adoptionAvailability===null),
    guardianship_available:readBoolean(value.guardianship_available)===true,
    coat_details:readText(value.coat_details),
    ear_shape:readText(value.ear_shape),
    shelter_story:readText(value.shelter_story),
    health_notes:readText(value.health_notes),
    care_notes:readText(value.care_notes),
    interesting_facts:readList(value.interesting_facts),
    shelter:readText(value.shelter),
  };
  const parsed=animalSchema.safeParse(normalized);
  return parsed.success?parsed.data:null;
}

export function normalizeImportedAnimals(records:unknown[],options:ImportedAnimalOptions={}) {
  const animals:Animal[]=[];
  let skipped=0;
  let unconfirmedAvailability=0;
  let unavailableRecords=0;
  for(const record of records) {
    if(isRecord(record)) {
      const availability=readBoolean(record.adoption_available);
      if(availability===null)unconfirmedAvailability++;
      else if(!availability)unavailableRecords++;
    }
    const animal=normalizeImportedAnimalWithOptions(record,options);
    if(animal)animals.push(animal);
    else skipped++;
  }
  return {animals,skipped,unconfirmedAvailability,unavailableRecords};
}

export function formatAnimalAge(animal:Pick<Animal,"age_years"|"age_text">):string {
  if(animal.age_text)return animal.age_text;
  return animal.age_years===null?"Возраст не указан":`${animal.age_years} лет`;
}

export function animalTypeLabel(type:Animal["type"]):string {
  if(type==="cat")return "Кошка";
  if(type==="dog")return "Собака";
  return "Вид не указан";
}
