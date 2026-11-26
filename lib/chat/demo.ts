import {UserProfile} from "@/types/user";
import {ChatTopic,getChatProgress,hasExperienceCareDetails,isChatTopicComplete,normalizeChatProfile} from "@/lib/chat/progress";
import {getChatScenario} from "@/lib/chat/scenarios";

export type DemoChatReply={
  message:string;
  profile:UserProfile;
  mode:"demo";
  progress:ReturnType<typeof getChatProgress>;
};

const relatedTopics:Record<ChatTopic,ChatTopic[]> = {
  housing:["housing","family"],
  family:["housing","family"],
  routine:["routine","activity"],
  activity:["routine","activity"],
  animal_type:["animal_type","experience"],
  experience:["animal_type","experience"],
  special_care:["special_care","financial_readiness"],
  financial_readiness:["special_care","financial_readiness"],
};

function extractProfile(message:string,profile:UserProfile,topic:ChatTopic):UserProfile {
  const next=structuredClone(profile);
  const text=message.trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
  const includes=(related:ChatTopic)=>relatedTopics[topic].includes(related);

  if(includes("housing")) {
    if(/квартир/.test(text))next.housing.type="квартира";
    if(/дом|коттедж/.test(text))next.housing.type="дом";
    if(/не\s+(?:в\s+)?квартир.*(?:дом|коттедж)/.test(text))next.housing.type="дом";
    if(/двор\s+(?:есть|имеется)|есть\s+(?:свой\s+)?двор/.test(text))next.housing.yard_available=true;
    if(/нет\s+(?:своего\s+)?двора|двора\s+нет/.test(text))next.housing.yard_available=false;
  }

  if(includes("family")) {
    const mentionsChildren=/дет|ребен|сын|доч/.test(text);
    const saysNoChildren=/нет\s+(?:детей|ребен|ребят)|(?:детей|ребен|дет)\s+нет|без\s+детей/.test(text);
    if(saysNoChildren)next.household.children=0;
    else if(mentionsChildren) {
      const count=text.match(/(\d+)\s*(?:ребен|дет)/);
      if(count)next.household.children=Number(count[1]);
      else if(/(?:двое|двумя|двух)\s+(?:дет|ребен)|две\s+доч/.test(text))next.household.children=2;
      else if(/(?:трое|тремя|трех|три)\s+(?:дет|ребен)/.test(text))next.household.children=3;
      else next.household.children=1;

      const childrenPhrase=text.match(/(?:дет|ребен|сын|доч)[^.;]{0,80}/)?.[0]||"";
      const pairedAges=childrenPhrase.match(/(\d{1,2})\s+и\s+(\d{1,2})\s+лет/);
      const ages=pairedAges
        ?[Number(pairedAges[1]),Number(pairedAges[2])]
        :[...childrenPhrase.matchAll(/(\d{1,2})\s*(?:лет|года|год)/g)].map(match=>Number(match[1]));
      if(ages.length)next.household.children_ages=ages.filter(age=>age<=18);
    }

    const adultCount=text.match(/(\d+)\s*взросл/);
    if(adultCount)next.household.adults=Number(adultCount[1]);
    else if(/живу\s+(?:один|одна|сам|сама)(?:[,. ]|$)/.test(text))next.household.adults=1;

    const saysNoOtherAnimals=/(?:нет\s+(?:(?:других|домашних)\s+)?(?:животн|питомц)|(?:других\s+)?(?:животн|питомц)[^.]{0,35}нет|без\s+(?:домашних\s+)?(?:животн|питомц))/.test(text);
    const mentionedCat=/кошк|кот(?:а|у|ом|е|ы|ов|ам|ами|ах|енок|енка|енку|енком|ята|ят|$|[\s,.!?])/.test(text);
    const mentionedDog=/собак|пес|песел|щен/.test(text);
    const mentionsPastAnimals=/раньше|в детстве|когда-то|в прошлом/.test(text);
    const mentionsCurrentAnimals=/сейчас|у меня есть|у нас есть|дома есть|жив[её]т со мной|с нами жив[её]т/.test(text);
    const wantsCat=/(?:хочу|хотел(?:а)? бы|планирую|рассматриваю|предпочитаю|собираюсь)[^.;]{0,30}(?:кошк|кот)/.test(text);
    const wantsDog=/(?:хочу|хотел(?:а)? бы|планирую|рассматриваю|предпочитаю|собираюсь)[^.;]{0,30}(?:собак|пес|щен)/.test(text);
    const hasCurrentCat=mentionedCat&&!wantsCat&&(!mentionsPastAnimals||mentionsCurrentAnimals);
    const hasCurrentDog=mentionedDog&&!wantsDog&&(!mentionsPastAnimals||mentionsCurrentAnimals);
    if(saysNoOtherAnimals) {
      next.household.other_animals=[];
      next.household.other_animals_confirmed=true;
    } else if(hasCurrentCat||hasCurrentDog) {
      const animals=new Set(next.household.other_animals);
      if(hasCurrentCat)animals.add("кошка");
      if(hasCurrentDog)animals.add("собака");
      next.household.other_animals=[...animals];
      next.household.other_animals_confirmed=true;
    }
  }

  if(includes("routine")) {
    const hours=text.match(/(\d+(?:[.,]\d+)?)\s*(?:час(?:а|ов)?|ч\b)/);
    if(hours)next.lifestyle.hours_away_daily=Number(hours[1].replace(",","."));
    else if(/весь день|целый день|полный день/.test(text)&&/работ|отсутств|не дома/.test(text))next.lifestyle.hours_away_daily=8;
    else if(/полдня/.test(text))next.lifestyle.hours_away_daily=4;
    else if(/дома весь день|почти всегда дома|не отсутствую/.test(text))next.lifestyle.hours_away_daily=0;
    if(/полный день|полную ставку|полная занятость/.test(text))next.lifestyle.works_full_time=true;
    else if(/не работаю|неполный рабочий день|частичная занятость/.test(text))next.lifestyle.works_full_time=false;

    const walks=text.match(/(\d+)\s*(?:раз(?:а)?|прогулк)/);
    if(walks&&!/в\s+недел|в\s+месяц/.test(text))next.lifestyle.walks_per_day=Math.min(Number(walks[1]),10);
    else if(/утром\s+и\s+вечером/.test(text))next.lifestyle.walks_per_day=2;
  }

  if(includes("activity")) {
    if(/спокой|тих|неспеш|домашний отдых/.test(text)) {
      next.lifestyle.activity_level="low";
      next.preferences.activity="low";
    } else if(/актив|долг.*прогул|много гуля|длинн.*прогул/.test(text)) {
      next.lifestyle.activity_level="high";
      next.preferences.activity="high";
    } else if(/умерен/.test(text)) {
      next.lifestyle.activity_level="moderate";
      next.preferences.activity="moderate";
    }
  }

  if(includes("animal_type")) {
    const preferredType=text.match(/(?:хочу|хотел(?:а)?\s+бы|предпочитаю|рассматриваю|выбираю|скорее)\s+(?:взять\s+)?(кошк|кот|собак|пес)/)?.[1];
    if(/^(?:кошк|кот)$/.test(preferredType||""))next.preferences.animal_type="cat";
    else if(/^(?:собак|пес)$/.test(preferredType||""))next.preferences.animal_type="dog";
    else if(!preferredType) {
      const mentionsCat=/кошк|кот(?:а|у|ом|е|ы|ов|ам|ами|ах|енок|енка|енку|енком|ята|ят|$|[\s,.!?])/.test(text);
      const mentionsDog=/собак|пес|песел|щен/.test(text);
      if(mentionsCat&&!mentionsDog)next.preferences.animal_type="cat";
      else if(mentionsDog&&!mentionsCat)next.preferences.animal_type="dog";
    }
  }

  if(includes("experience")) {
    const animalObject="(?:животными|животных|питомцами|питомцев|кошкой|кошками|котом|котами|собакой|собаками|псом|псами)";
    const saysNoExperience=new RegExp(`(?:^|[\\s,.!?])(?:нет(?:[, ]+у меня)? опыта(?: ухода(?: за ${animalObject})?| (?:с|за) ${animalObject})?|без опыта(?: ухода)?|не было опыта(?: ухода)?|опыта(?: ухода)? (?:не было|нет)|никогда не было (?:домашних )?(?:животных|питомцев)|никогда не держал[аи]? животных)(?=$|[,.!?])`).test(text);
    const saysExperience=/опыт|были.*(?:животн|питомц)|раньше.*(?:кот|собак|пес)|ухаживал|ухаживала|^(?:да|был|была|были)$/.test(text);
    if(saysNoExperience) {
      next.experience.has_pet_experience=false;
      next.experience.care_experience=null;
    } else if(saysExperience||hasExperienceCareDetails(message)||profile.experience.has_pet_experience===true) {
      next.experience.has_pet_experience=true;
      if(hasExperienceCareDetails(message))next.experience.care_experience=message.trim().slice(0,400);
      else if(profile.experience.has_pet_experience!==true)next.experience.care_experience=null;
    }
  }

  if(includes("special_care")) {
    if(/не\s+готов|не\s+смогу|не\s+могу/.test(text))next.readiness.special_care=false;
    else if(/готов|смогу|могу|да/.test(text))next.readiness.special_care=true;
  }

  if(includes("financial_readiness")) {
    if(/не\s+готов|не\s+смогу|не\s+могу|не\s+потяну/.test(text))next.readiness.financial_readiness_confirmed=false;
    else if(/готов|смогу|могу|да/.test(text))next.readiness.financial_readiness_confirmed=true;
  }

  return next;
}

export function createDemoChatReply({
  message,
  profile,
  currentTopic,
  skippedTopics,
  skipCurrentQuestion,
}:{
  message:string;
  profile:UserProfile;
  currentTopic:ChatTopic;
  skippedTopics:ChatTopic[];
  skipCurrentQuestion:boolean;
}):DemoChatReply {
  let nextProfile=skipCurrentQuestion?structuredClone(profile):extractProfile(message,profile,currentTopic);
  nextProfile=normalizeChatProfile(nextProfile);

  const nextSkipped=new Set(skippedTopics);
  if(skipCurrentQuestion&&!isChatTopicComplete(nextProfile,currentTopic))nextSkipped.add(currentTopic);
  const progress=getChatProgress(nextProfile,[...nextSkipped]);
  const nextQuestion=progress.nextTopic?getChatScenario(nextProfile,progress.nextTopic).question:null;
  const reply=skipCurrentQuestion
    ? nextQuestion?`Хорошо, оставлю этот пункт неизвестным. ${nextQuestion}`:"Хорошо, не буду делать предположений. Основные темы разобраны."
    : nextQuestion||"Спасибо, основные темы разобраны. Если захотите, можно перейти к характеристикам животных.";

  return {message:reply,profile:nextProfile,mode:"demo",progress};
}
