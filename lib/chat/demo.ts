import {UserProfile} from "@/types/user";
import {ChatTopic,getChatProgress,isChatTopicComplete,normalizeChatProfile} from "@/lib/chat/progress";

export type DemoChatReply={
  message:string;
  profile:UserProfile;
  mode:"demo";
  progress:ReturnType<typeof getChatProgress>;
};

const prompts:Record<ChatTopic,string>={
  housing:"Вы живёте в квартире или частном доме?",
  family:"Есть ли в семье дети или другие животные?",
  routine:"Сколько часов в день вы обычно отсутствуете дома?",
  experience:"Был ли у вас раньше опыт ухода за домашними животными?",
  special_care:"Готовы ли вы учитывать возможные особенности здоровья и дополнительный уход?",
  financial_readiness:"Готовы ли вы к регулярным расходам на питание, уход и ветеринарную помощь?",
  activity:"Вы предпочитаете спокойный отдых или активные прогулки?",
  animal_type:"Кого вы рассматриваете — кошку или собаку?",
};

function promptFor(profile:UserProfile,topic:ChatTopic) {
  if(topic==="family") {
    if(profile.household.children===null&&profile.household.other_animals_confirmed!==true) {
      return "Есть ли в семье дети или другие домашние животные?";
    }
    if(profile.household.children===null)return "Есть ли в вашей семье дети?";
    if(profile.household.other_animals_confirmed!==true)return "Есть ли у вас другие домашние животные? Если нет, так и скажите.";
  }
  return prompts[topic];
}

function extractProfile(message:string,profile:UserProfile,topic:ChatTopic):UserProfile {
  const next=structuredClone(profile);
  const text=message.trim().toLocaleLowerCase("ru").replace(/ё/g,"е");

  if(topic==="housing") {
    if(/квартир/.test(text))next.housing.type="квартира";
    if(/дом|коттедж/.test(text))next.housing.type="дом";
    if(/не\s+(?:в\s+)?квартир.*(?:дом|коттедж)/.test(text))next.housing.type="дом";
    if(/двор\s+(?:есть|имеется)|есть\s+(?:свой\s+)?двор/.test(text))next.housing.yard_available=true;
    if(/нет\s+(?:своего\s+)?двора|двора\s+нет/.test(text))next.housing.yard_available=false;
  }

  if(topic==="family") {
    if(/нет\s+(?:детей|ребен|ребят)|(?:детей|ребен|дет)\s+нет/.test(text))next.household.children=0;
    else if(/дет|ребен|ребенок/.test(text)) {
      const count=text.match(/(\d+)\s*(?:ребен|дет)/);
      next.household.children=count?Number(count[1]):1;
    }

    const saysNoOtherAnimals=/нет\s+(?:(?:других|домашних)\s+)?(?:животн|питомц|кош|собак)|(?:других\s+)?животн.*нет|питомц.*нет/.test(text);
    const mentionedCat=/кошк|кот(?:\b|а|у|ом|е|ы|ов|ам|ами|ах)/.test(text);
    const mentionedDog=/собак|пес|щен/.test(text);
    if(saysNoOtherAnimals) {
      next.household.other_animals=[];
      next.household.other_animals_confirmed=true;
    } else if(mentionedCat||mentionedDog) {
      const animals=new Set(next.household.other_animals);
      if(mentionedCat)animals.add("кошка");
      if(mentionedDog)animals.add("собака");
      next.household.other_animals=[...animals];
      next.household.other_animals_confirmed=true;
    }
  }

  if(topic==="routine") {
    const hours=text.match(/(\d+(?:[.,]\d+)?)\s*(?:час(?:а|ов)?|ч\b)/);
    if(hours)next.lifestyle.hours_away_daily=Number(hours[1].replace(",","."));
    else if(/весь день|целый день|полный день/.test(text)&&/работ|отсутств|не дома/.test(text))next.lifestyle.hours_away_daily=8;
    else if(/полдня/.test(text))next.lifestyle.hours_away_daily=4;
    else if(/дома весь день|почти всегда дома|не отсутствую/.test(text))next.lifestyle.hours_away_daily=0;
    if(/полный день|полную ставку|полная занятость/.test(text))next.lifestyle.works_full_time=true;
    else if(/не работаю|неполный рабочий день|частичная занятость/.test(text))next.lifestyle.works_full_time=false;
  }

  if(topic==="experience") {
    if(/нет опыта|без опыта|не было.*(?:животн|питомц)|никогда.*(?:животн|питомц)/.test(text))next.experience.has_pet_experience=false;
    else if(/опыт|были.*(?:животн|питомц)|раньше.*(?:кот|собак|пес)/.test(text)||/^(да|был|была|были)$/.test(text))next.experience.has_pet_experience=true;
    if(next.experience.has_pet_experience!==null)next.experience.care_experience=message.trim();
  }

  if(topic==="special_care") {
    if(/не\s+готов|не\s+смогу|не\s+могу/.test(text))next.readiness.special_care=false;
    else if(/готов|смогу|могу|да/.test(text))next.readiness.special_care=true;
  }

  if(topic==="financial_readiness") {
    if(/не\s+готов|не\s+смогу|не\s+могу|не\s+потяну/.test(text))next.readiness.financial_readiness_confirmed=false;
    else if(/готов|смогу|могу|да/.test(text))next.readiness.financial_readiness_confirmed=true;
  }

  if(topic==="activity") {
    if(/спокой|тих|неспеш/.test(text)) {
      next.lifestyle.activity_level="low";
      next.preferences.activity="low";
    } else if(/актив|долг.*прогул|много гуля/.test(text)) {
      next.lifestyle.activity_level="high";
      next.preferences.activity="high";
    } else if(/умерен/.test(text)) {
      next.lifestyle.activity_level="moderate";
      next.preferences.activity="moderate";
    }
  }

  if(topic==="animal_type") {
    if(/кошк|кот(?:\b|а|у|ом|е|ы|ов|ам|ами|ах)/.test(text))next.preferences.animal_type="cat";
    else if(/собак|пес|щен/.test(text))next.preferences.animal_type="dog";
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
  const nextQuestion=progress.nextTopic?promptFor(nextProfile,progress.nextTopic):null;
  const reply=skipCurrentQuestion
    ? nextQuestion?`Хорошо, оставлю этот пункт неизвестным. ${nextQuestion}`:"Хорошо, не буду делать предположений. Основные темы разобраны."
    : nextQuestion||"Спасибо, основные темы разобраны. Если захотите, можно перейти к характеристикам животных.";

  return {message:reply,profile:nextProfile,mode:"demo",progress};
}
