import {z} from "zod";
import {UserProfile} from "@/types/user";

export const chatTopics=[
  "housing",
  "family",
  "routine",
  "animal_type",
  "experience",
  "activity",
  "special_care",
  "financial_readiness",
] as const;

export const chatTopicSchema=z.enum(chatTopics);
export type ChatTopic=z.infer<typeof chatTopicSchema>;

const requiredTopics=["housing","family","routine","animal_type"] as const;
const topicLabels:Record<ChatTopic,string>={
  housing:"условия проживания",
  family:"семья и другие животные",
  routine:"время отсутствия дома",
  experience:"опыт ухода за животными",
  special_care:"готовность к особенностям ухода",
  financial_readiness:"готовность к расходам на содержание",
  activity:"предпочитаемый уровень активности",
  animal_type:"предпочтительный тип питомца",
};
const requiredLabels:Record<(typeof requiredTopics)[number],string>={
  housing:"условия проживания",
  family:"семья и другие животные",
  routine:"время отсутствия дома",
  animal_type:"предпочтительный тип питомца",
};

export function hasExperienceCareDetails(value:string|null) {
  if(!value)return false;
  const text=value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
  if(/не сталкивал|не приходилось|не было (?:серьезных )?(?:болезн|заболев)|(?:болезн|заболев)[^.]{0,24}не было|не знаю|не уверен/.test(text))return true;
  if(/(?:нет|не было)\s+(?:опыта\s+)?(?:леч|обращени|лекарств|таблет|процедур|укол|операц|назначени|реабилитац)/.test(text))return false;
  return /болезн|заболев|ветеринар|леч|лекарств|таблет|процедур|укол|операц|назначен|диагноз|реабилитац/.test(text);
}

export function isChatTopicComplete(profile:UserProfile,topic:ChatTopic) {
  switch(topic) {
    case "housing":
      return profile.housing.type!==null;
    case "family":
      return profile.household.children!==null&&profile.household.other_animals_confirmed===true;
    case "routine":
      return profile.lifestyle.hours_away_daily!==null;
    case "experience":
      return profile.experience.has_pet_experience===false||
        (profile.experience.has_pet_experience===true&&hasExperienceCareDetails(profile.experience.care_experience));
    case "special_care":
      return profile.readiness.special_care!==null;
    case "financial_readiness":
      return profile.readiness.financial_readiness_confirmed!==null;
    case "activity":
      return profile.lifestyle.activity_level!==null||profile.preferences.activity!==null;
    case "animal_type":
      return profile.preferences.animal_type!==null;
  }
}

export function normalizeChatProfile(profile:UserProfile):UserProfile {
  const otherAnimalsConfirmed=profile.household.other_animals_confirmed===true||profile.household.other_animals.length>0;
  const normalized={
    ...profile,
    household:{
      ...profile.household,
      other_animals_confirmed:otherAnimalsConfirmed?true:profile.household.other_animals_confirmed,
    },
  };
  const missingRequired=requiredTopics.filter(topic=>!isChatTopicComplete(normalized,topic));
  return {
    ...normalized,
    missing_fields:missingRequired.map(topic=>requiredLabels[topic]),
    completed:missingRequired.length===0,
  };
}

function hasProfileValue(value:unknown):boolean {
  if(value===null||value===undefined||value==="")return false;
  return !Array.isArray(value)||value.length>0;
}

function sameProfileValue(left:unknown,right:unknown):boolean {
  return JSON.stringify(left)===JSON.stringify(right);
}

function mergeProfileValue<T>(previous:T,extracted:T,generated:T,allowGeneratedCorrections:boolean,previousKnown=hasProfileValue(previous)):T {
  if(!sameProfileValue(previous,extracted))return extracted;
  if(previousKnown) {
    if(!hasProfileValue(generated)||!sameProfileValue(previous,generated)) {
      return allowGeneratedCorrections?generated:previous;
    }
  }
  return generated;
}

export function mergeChatProfile(previous:UserProfile,extracted:UserProfile,generated:UserProfile,allowGeneratedCorrections=false):UserProfile {
  const merge=<T>(oldValue:T,extractedValue:T,generatedValue:T,oldValueKnown?:boolean)=>mergeProfileValue(
    oldValue,
    extractedValue,
    generatedValue,
    allowGeneratedCorrections,
    oldValueKnown,
  );
  return normalizeChatProfile({
    housing:{
      type:merge(previous.housing.type,extracted.housing.type,generated.housing.type),
      size:merge(previous.housing.size,extracted.housing.size,generated.housing.size),
      living_conditions:merge(previous.housing.living_conditions,extracted.housing.living_conditions,generated.housing.living_conditions),
      yard_available:merge(previous.housing.yard_available,extracted.housing.yard_available,generated.housing.yard_available),
    },
    household:{
      adults:merge(previous.household.adults,extracted.household.adults,generated.household.adults),
      children:merge(previous.household.children,extracted.household.children,generated.household.children),
      children_ages:merge(previous.household.children_ages,extracted.household.children_ages,generated.household.children_ages,previous.household.children===0),
      other_animals:merge(previous.household.other_animals,extracted.household.other_animals,generated.household.other_animals,previous.household.other_animals_confirmed===true),
      other_animals_confirmed:merge(previous.household.other_animals_confirmed,extracted.household.other_animals_confirmed,generated.household.other_animals_confirmed),
    },
    lifestyle:{
      works_full_time:merge(previous.lifestyle.works_full_time,extracted.lifestyle.works_full_time,generated.lifestyle.works_full_time),
      hours_away_daily:merge(previous.lifestyle.hours_away_daily,extracted.lifestyle.hours_away_daily,generated.lifestyle.hours_away_daily),
      activity_level:merge(previous.lifestyle.activity_level,extracted.lifestyle.activity_level,generated.lifestyle.activity_level),
      walks_per_day:merge(previous.lifestyle.walks_per_day,extracted.lifestyle.walks_per_day,generated.lifestyle.walks_per_day),
    },
    experience:{
      has_pet_experience:merge(previous.experience.has_pet_experience,extracted.experience.has_pet_experience,generated.experience.has_pet_experience),
      care_experience:merge(previous.experience.care_experience,extracted.experience.care_experience,generated.experience.care_experience),
    },
    preferences:{
      animal_type:merge(previous.preferences.animal_type,extracted.preferences.animal_type,generated.preferences.animal_type),
      preferred_size:merge(previous.preferences.preferred_size,extracted.preferences.preferred_size,generated.preferences.preferred_size),
      preferred_age:merge(previous.preferences.preferred_age,extracted.preferences.preferred_age,generated.preferences.preferred_age),
      activity:merge(previous.preferences.activity,extracted.preferences.activity,generated.preferences.activity),
      character:merge(previous.preferences.character,extracted.preferences.character,generated.preferences.character),
      colors:merge(previous.preferences.colors,extracted.preferences.colors,generated.preferences.colors),
    },
    readiness:{
      special_care:merge(previous.readiness.special_care,extracted.readiness.special_care,generated.readiness.special_care),
      financial_readiness_confirmed:merge(previous.readiness.financial_readiness_confirmed,extracted.readiness.financial_readiness_confirmed,generated.readiness.financial_readiness_confirmed),
    },
    missing_fields:[],
    completed:false,
  });
}

function chatProfileFields(profile:UserProfile):Record<string,{value:unknown;known:boolean}> {
  return {
    "housing.type":{value:profile.housing.type,known:hasProfileValue(profile.housing.type)},
    "housing.size":{value:profile.housing.size,known:hasProfileValue(profile.housing.size)},
    "housing.living_conditions":{value:profile.housing.living_conditions,known:hasProfileValue(profile.housing.living_conditions)},
    "housing.yard_available":{value:profile.housing.yard_available,known:hasProfileValue(profile.housing.yard_available)},
    "household.adults":{value:profile.household.adults,known:hasProfileValue(profile.household.adults)},
    "household.children":{value:profile.household.children,known:hasProfileValue(profile.household.children)},
    "household.children_ages":{value:profile.household.children_ages,known:hasProfileValue(profile.household.children_ages)||profile.household.children===0},
    "household.other_animals":{value:profile.household.other_animals,known:hasProfileValue(profile.household.other_animals)||profile.household.other_animals_confirmed===true},
    "household.other_animals_confirmed":{value:profile.household.other_animals_confirmed,known:hasProfileValue(profile.household.other_animals_confirmed)},
    "lifestyle.works_full_time":{value:profile.lifestyle.works_full_time,known:hasProfileValue(profile.lifestyle.works_full_time)},
    "lifestyle.hours_away_daily":{value:profile.lifestyle.hours_away_daily,known:hasProfileValue(profile.lifestyle.hours_away_daily)},
    "lifestyle.activity_level":{value:profile.lifestyle.activity_level,known:hasProfileValue(profile.lifestyle.activity_level)},
    "lifestyle.walks_per_day":{value:profile.lifestyle.walks_per_day,known:hasProfileValue(profile.lifestyle.walks_per_day)},
    "experience.has_pet_experience":{value:profile.experience.has_pet_experience,known:hasProfileValue(profile.experience.has_pet_experience)},
    "experience.care_experience":{value:profile.experience.care_experience,known:hasProfileValue(profile.experience.care_experience)},
    "preferences.animal_type":{value:profile.preferences.animal_type,known:hasProfileValue(profile.preferences.animal_type)},
    "preferences.preferred_size":{value:profile.preferences.preferred_size,known:hasProfileValue(profile.preferences.preferred_size)},
    "preferences.preferred_age":{value:profile.preferences.preferred_age,known:hasProfileValue(profile.preferences.preferred_age)},
    "preferences.activity":{value:profile.preferences.activity,known:hasProfileValue(profile.preferences.activity)},
    "preferences.character":{value:profile.preferences.character,known:hasProfileValue(profile.preferences.character)},
    "preferences.colors":{value:profile.preferences.colors,known:hasProfileValue(profile.preferences.colors)},
    "readiness.special_care":{value:profile.readiness.special_care,known:hasProfileValue(profile.readiness.special_care)},
    "readiness.financial_readiness_confirmed":{value:profile.readiness.financial_readiness_confirmed,known:hasProfileValue(profile.readiness.financial_readiness_confirmed)},
  };
}

const profileFieldLabels:Record<string,string>={
  "housing.type":"тип жилья",
  "housing.size":"размер жилья",
  "housing.living_conditions":"условия проживания",
  "housing.yard_available":"наличие двора",
  "household.adults":"число взрослых",
  "household.children":"число детей",
  "household.children_ages":"возраст детей",
  "household.other_animals":"другие животные",
  "household.other_animals_confirmed":"наличие других животных",
  "lifestyle.works_full_time":"рабочий график",
  "lifestyle.hours_away_daily":"время отсутствия дома",
  "lifestyle.activity_level":"уровень активности",
  "lifestyle.walks_per_day":"число прогулок",
  "experience.has_pet_experience":"опыт ухода за животными",
  "experience.care_experience":"уход во время болезни питомца",
  "preferences.animal_type":"предпочтительный вид питомца",
  "preferences.preferred_size":"предпочтительный размер",
  "preferences.preferred_age":"предпочтительный возраст",
  "preferences.activity":"предпочитаемая активность",
  "preferences.character":"предпочтения по характеру",
  "preferences.colors":"предпочтения по окрасу",
  "readiness.special_care":"готовность к особенностям ухода",
  "readiness.financial_readiness_confirmed":"готовность к расходам",
};

export function findChatProfileConflicts(previous:UserProfile,extracted:UserProfile,generated:UserProfile):string[] {
  const previousFields=chatProfileFields(previous);
  const extractedFields=chatProfileFields(extracted);
  const generatedFields=chatProfileFields(generated);
  return Object.keys(previousFields).flatMap(field=>{
    const oldValue=previousFields[field];
    const extractedValue=extractedFields[field];
    const generatedValue=generatedFields[field];
    if(
      oldValue.known&&
      sameProfileValue(oldValue.value,extractedValue.value)&&
      generatedValue.known&&
      !sameProfileValue(oldValue.value,generatedValue.value)
    )return [profileFieldLabels[field]||field];
    return [];
  });
}

export function getChatProgress(profile:UserProfile,skippedTopics:ChatTopic[]=[]) {
  const missingTopics=chatTopics.filter(topic=>!isChatTopicComplete(profile,topic));
  const skipped=new Set(skippedTopics);
  const unresolvedRequired=requiredTopics.filter(topic=>!isChatTopicComplete(profile,topic));
  const resolvedRequiredTopics=requiredTopics.filter(topic=>isChatTopicComplete(profile,topic)||skipped.has(topic));
  const canonicalSkipped=missingTopics.filter(topic=>skipped.has(topic));
  return {
    missingTopics,
    missingLabels:missingTopics.map(topic=>topicLabels[topic]),
    skippedTopics:canonicalSkipped,
    nextTopic:missingTopics.find(topic=>!skipped.has(topic))||null,
    profileComplete:unresolvedRequired.length===0,
    canProceedWithPartialProfile:unresolvedRequired.length===0||unresolvedRequired.every(topic=>skipped.has(topic)),
    resolvedRequiredCount:resolvedRequiredTopics.length,
    requiredTopicCount:requiredTopics.length,
  };
}

export function preserveSkippedTopic(updated:UserProfile,previous:UserProfile,topic:ChatTopic):UserProfile {
  const result=structuredClone(updated);
  switch(topic) {
    case "housing":
      result.housing=structuredClone(previous.housing);
      break;
    case "family":
      result.household=structuredClone(previous.household);
      break;
    case "routine":
      result.lifestyle.works_full_time=previous.lifestyle.works_full_time;
      result.lifestyle.hours_away_daily=previous.lifestyle.hours_away_daily;
      result.lifestyle.walks_per_day=previous.lifestyle.walks_per_day;
      break;
    case "experience":
      result.experience=structuredClone(previous.experience);
      break;
    case "special_care":
      result.readiness.special_care=previous.readiness.special_care;
      break;
    case "financial_readiness":
      result.readiness.financial_readiness_confirmed=previous.readiness.financial_readiness_confirmed;
      break;
    case "activity":
      result.lifestyle.activity_level=previous.lifestyle.activity_level;
      result.preferences.activity=previous.preferences.activity;
      break;
    case "animal_type":
      result.preferences.animal_type=previous.preferences.animal_type;
      break;
  }
  return normalizeChatProfile(result);
}
