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
