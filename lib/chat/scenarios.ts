import {ChatTopic,hasExperienceCareDetails} from "@/lib/chat/progress";
import {UserProfile} from "@/types/user";

export type ChatScenario={question:string;guidance:string};

function experienceQuestion(profile:UserProfile) {
  if(profile.experience.has_pet_experience===true&&!hasExperienceCareDetails(profile.experience.care_experience)) {
    return "Вы сказали, что опыт был. Как вы поступали, если питомец серьёзно заболевал: обращались к ветеринару, давали лекарства по назначению? Если с таким не сталкивались, так и скажите.";
  }
  return "Был ли у вас раньше опыт ухода за животными? Если да, за кем именно?";
}

export function getChatScenario(profile:UserProfile,topic:ChatTopic):ChatScenario {
  const childrenMissing=profile.household.children===null;
  const animalsMissing=profile.household.other_animals_confirmed!==true;
  const experienceMissing=profile.experience.has_pet_experience===null;
  const experienceDetailsMissing=profile.experience.has_pet_experience===true&&
    !hasExperienceCareDetails(profile.experience.care_experience);
  let question:string;
  let guidance:string;

  switch(topic) {
    case "housing":
      question=profile.housing.type===null&&childrenMissing&&animalsMissing
        ?"Где вы живёте — в квартире или частном доме? С кем делите жильё: есть ли дети (примерный возраст) или другие животные?"
        :profile.housing.type===null
          ?"Это квартира или частный дом? Есть ли у жилья двор или ограничения для животных?"
          :"Кто ещё живёт вместе с вами: есть ли дети или другие животные? Если нет, так и скажите.";
      guidance="Собери связанные сведения о жилье и домочадцах одним коротким сообщением. Заполни только явно названные тип жилья, состав семьи, возраст детей, других животных и двор.";
      break;
    case "family":
      question=childrenMissing&&animalsMissing
        ?"Кто будет жить вместе с питомцем: есть ли дети (примерный возраст) или другие животные? Если нет, так и скажите."
        :childrenMissing
          ?"Есть ли в семье дети? Если да, какого они примерно возраста?"
          :"Есть ли сейчас другие домашние животные? Какие? Если нет, так и скажите.";
      guidance="Уточни только недостающие сведения о семье: число и возраст детей, взрослых и других животных. Явное «других животных нет» означает подтверждённое отсутствие питомцев; не делай такой вывод из молчания.";
      break;
    case "routine":
      question=profile.lifestyle.hours_away_daily===null
        ?"Сколько часов в обычный день никого не будет дома и сколько прогулок в день реально получится? Ваш ритм скорее спокойный или активный?"
        :"Какой ритм вам ближе — спокойные прогулки или долгие активные? Сколько прогулок в день будет реально?";
      guidance="В одном ответе можно собрать время отсутствия, рабочий график, число прогулок и предпочитаемый уровень активности. Не выводи часы отсутствия из факта работы и не придумывай распорядок.";
      break;
    case "animal_type":
      question=profile.preferences.animal_type===null&&experienceMissing
        ?"Кого вы рассматриваете — кошку или собаку? Был ли у вас раньше опыт ухода за животными, и за кем именно?"
        :profile.preferences.animal_type===null&&experienceDetailsMissing
          ?"Кого вы рассматриваете — кошку или собаку? И уточню про прежний опыт: как вы заботились о питомце во время серьёзной болезни?"
          :profile.preferences.animal_type===null
            ?"Кого вы рассматриваете — кошку или собаку?"
            :experienceQuestion(profile);
      guidance="Уточни предпочтительный вид питомца и, если опыт ещё неизвестен, спроси о прежнем опыте в той же реплике. Если человек подтвердил опыт, но ещё не описал уход во время болезни, задай отдельный уточняющий вопрос.";
      break;
    case "experience":
      question=experienceQuestion(profile);
      guidance=experienceDetailsMissing
        ?"Это обязательное уточнение после ответа «да»: спроси, что человек делал при серьёзной болезни питомца, обращался ли к ветеринару и выполнял ли назначения. Не принимай простое «да, был опыт» за описание ухода."
        :"Спроси, был ли опыт ухода и за какими животными. Не спрашивай о болезнях, пока человек не подтвердил опыт.";
      break;
    case "activity":
      question="Какой уровень активности питомца вам подходит: спокойный ритм или долгие активные прогулки? Сколько прогулок в день вы сможете обеспечить?";
      guidance="Собери предпочитаемый уровень активности и число прогулок. Не приписывай пользователю физические возможности или свободное время.";
      break;
    case "special_care":
      question=profile.readiness.special_care===null&&profile.readiness.financial_readiness_confirmed===null
        ?"Если питомцу понадобятся постоянные лекарства и регулярные визиты к ветеринару, готовы ли вы к такому уходу и связанным с ним расходам?"
        :profile.readiness.special_care===null
          ?"Если питомцу понадобится дополнительный уход или лекарства, готовы ли вы этим заниматься?"
          :"Готовы ли вы к регулярным и непредвиденным расходам на содержание и ветеринарную помощь?";
      guidance="При необходимости одним деликатным вопросом уточни готовность к медицинскому уходу и расходам. Заполняй эти два поля отдельно и никогда не делай вывод о готовности по доходу или семейному положению.";
      break;
    case "financial_readiness":
      question="Готовы ли вы к регулярным расходам на содержание и непредвиденным счетам ветеринара? Доход называть не нужно.";
      guidance="Уточни только прямую готовность к расходам на питомца. Не спрашивай размер дохода и не выводи ответ из косвенных признаков.";
      break;
  }

  return {question,guidance};
}
