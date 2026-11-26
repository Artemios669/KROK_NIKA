import {Animal} from "@/types/animal";

const photo=(id:string)=>`https://images.unsplash.com/${id}?auto=format&fit=crop&w=1000&q=80`;

const demoAnimals:Animal[]=[
  {
    id:"luna",name:"Луна",type:"cat",age_years:3,sex:"female",size:"small",
    color:["серая"],character:["спокойная","ласковая"],activity_level:"low",
    housing_requirements:["квартира"],good_with_children:true,good_with_cats:true,
    good_with_dogs:null,can_stay_alone_hours:8,special_care:false,
    description:"Тестовая карточка: спокойная взрослая кошка для размеренного дома.",
    image_url:photo("photo-1514888286974-6c03e2ca1dba"),adoption_available:true,guardianship_available:true,
  },
  {
    id:"ryzhik",name:"Рыжик",type:"cat",age_years:2,sex:"male",size:"medium",
    color:["рыжий"],character:["любопытный","общительный"],activity_level:"moderate",
    housing_requirements:["дом","квартира"],good_with_children:true,good_with_cats:null,
    good_with_dogs:false,can_stay_alone_hours:6,special_care:false,
    description:"Тестовая карточка: любит игру и общение, но его совместимость с кошками нужно уточнить.",
    image_url:photo("photo-1495360010541-f48722b34f7d"),adoption_available:true,guardianship_available:false,
  },
  {
    id:"mira",name:"Мира",type:"dog",age_years:5,sex:"female",size:"medium",
    color:["бежевая"],character:["уравновешенная","внимательная"],activity_level:"moderate",
    housing_requirements:["регулярные прогулки"],good_with_children:true,good_with_cats:null,
    good_with_dogs:true,can_stay_alone_hours:6,special_care:false,
    description:"Тестовая карточка: взрослая собака, которой важны спокойные ежедневные прогулки.",
    image_url:photo("photo-1552053831-71594a27632d"),adoption_available:true,guardianship_available:true,
  },
  {
    id:"bars",name:"Барс",type:"cat",age_years:7,sex:"male",size:"large",
    color:["полосатый"],character:["независимый","спокойный"],activity_level:"low",
    housing_requirements:["тихий дом"],good_with_children:false,good_with_cats:true,
    good_with_dogs:false,can_stay_alone_hours:8,special_care:true,
    description:"Тестовая карточка: взрослому коту потребуется обсуждение особенностей ухода с командой приюта.",
    image_url:photo("photo-1573865526739-10659fec78a5"),adoption_available:true,guardianship_available:true,
  },
  {
    id:"taiga",name:"Тайга",type:"dog",age_years:1,sex:"female",size:"large",
    color:["чёрная"],character:["энергичная","умная"],activity_level:"high",
    housing_requirements:["активные прогулки","опыт"],good_with_children:true,good_with_cats:false,
    good_with_dogs:true,can_stay_alone_hours:3,special_care:false,
    description:"Тестовая карточка: молодая активная собака для семьи с большим запасом времени.",
    image_url:photo("photo-1558788353-f76d92427f16"),adoption_available:true,guardianship_available:false,
  },
  {
    id:"snow",name:"Снежок",type:"cat",age_years:1,sex:"male",size:"small",
    color:["белый"],character:["игривый","нежный"],activity_level:"moderate",
    housing_requirements:["дом","квартира"],good_with_children:true,good_with_cats:true,
    good_with_dogs:true,can_stay_alone_hours:5,special_care:false,
    description:"Тестовая карточка: молодой и любознательный кот, которому важна компания.",
    image_url:photo("photo-1596854407944-bf87f6fdd49e"),adoption_available:true,guardianship_available:true,
  },
];

type AdditionalAnimalSeed=Pick<Animal,
  "id"|"name"|"type"|"age_years"|"sex"|"size"|"color"|"character"|"activity_level"|
  "housing_requirements"|"good_with_children"|"good_with_cats"|"good_with_dogs"|
  "can_stay_alone_hours"|"special_care"|"guardianship_available"|"description"
>&Partial<Pick<Animal,"coat_details"|"ear_shape"|"shelter_story"|"health_notes"|"interesting_facts">>&{
  photo_id:string;
};

function makeAdditionalAnimal({photo_id,...animal}:AdditionalAnimalSeed):Animal {
  return {...animal,image_url:photo(photo_id),adoption_available:true};
}

const additionalAnimals:Animal[]=[
  makeAdditionalAnimal({
    id:"demo-0",name:"Веста",type:"dog",age_years:4,sex:"female",size:"medium",
    color:["светло-бежевая"],character:["спокойная","контактная"],activity_level:"moderate",
    housing_requirements:["квартира","регулярные прогулки"],good_with_children:true,good_with_cats:null,
    good_with_dogs:true,can_stay_alone_hours:5,special_care:false,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Взрослая собака среднего размера; совместимость с кошками не проверена.",
    photo_id:"photo-1552053831-71594a27632d",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая светло-бежевая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: мягко свисающие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: собаку передали в учебный приют после переезда семьи.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: спокойно ждёт поводок перед прогулкой."],
  }),
  makeAdditionalAnimal({
    id:"demo-1",name:"Граф",type:"dog",age_years:6,sex:"male",size:"large",
    color:["чёрный"],character:["сдержанный","наблюдательный"],activity_level:"moderate",
    housing_requirements:["тихий дом","опыт"],good_with_children:false,good_with_cats:false,
    good_with_dogs:null,can_stay_alone_hours:6,special_care:false,guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Крупной собаке подойдёт спокойный дом с опытным взрослым.",
    photo_id:"photo-1558788353-f76d92427f16",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: густая короткая чёрная шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: полустоячие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: собаку нашли без сопровождения и доставили в учебный приют.",
    health_notes:"ТЕСТОВАЯ ЗАМЕТКА: медицинская история не указана.",
  }),
  makeAdditionalAnimal({
    id:"demo-2",name:"Боня",type:"cat",age_years:8,sex:"female",size:"medium",
    color:["трёхцветная"],character:["ласковая","неторопливая"],activity_level:"low",
    housing_requirements:["квартира","тихий дом"],good_with_children:true,good_with_cats:null,
    good_with_dogs:null,can_stay_alone_hours:8,special_care:true,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Взрослая кошка; необходимость дополнительного ухода требует уточнения.",
    photo_id:"photo-1514888286974-6c03e2ca1dba",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая трёхцветная шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: небольшие прямостоячие уши.",
    health_notes:"ТЕСТОВАЯ ЗАМЕТКА: отмечена потребность в дополнительном уходе; диагноз не указан.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: предпочитает отдыхать в спокойном месте."],
  }),
  makeAdditionalAnimal({
    id:"demo-3",name:"Филя",type:"cat",age_years:1,sex:"male",size:"small",
    color:["серый","белый"],character:["игривый","любознательный"],activity_level:"high",
    housing_requirements:["квартира","безопасные окна"],good_with_children:true,good_with_cats:null,
    good_with_dogs:false,can_stay_alone_hours:3,special_care:false,guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Молодой кот с высоким уровнем активности; совместимость с кошками неизвестна.",
    photo_id:"photo-1495360010541-f48722b34f7d",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая серая шерсть с белыми отметинами.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: крупные прямостоячие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: котёнка нашли на улице и передали в учебный приют.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: любит исследовать новые безопасные игрушки."],
  }),
  makeAdditionalAnimal({
    id:"demo-4",name:"Нора",type:"dog",age_years:2,sex:"female",size:"large",
    color:["рыжая"],character:["энергичная","дружелюбная"],activity_level:"high",
    housing_requirements:["активные прогулки","опыт"],good_with_children:true,good_with_cats:false,
    good_with_dogs:true,can_stay_alone_hours:4,special_care:false,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Молодой собаке нужны активные прогулки; с кошками не совместима.",
    photo_id:"photo-1552053831-71594a27632d",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая рыжая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: мягко свисающие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: прежние владельцы не смогли продолжить уход.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: любит игры на поиск предметов."],
  }),
  makeAdditionalAnimal({
    id:"demo-5",name:"Пиксель",type:"cat",age_years:3,sex:"male",size:"small",
    color:["чёрно-белый"],character:["общительный","игривый"],activity_level:"moderate",
    housing_requirements:["квартира"],good_with_children:true,good_with_cats:true,
    good_with_dogs:null,can_stay_alone_hours:5,special_care:false,guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Общительный кот; отношение к собакам не проверено.",
    photo_id:"photo-1573865526739-10659fec78a5",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая чёрно-белая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: небольшие округлые уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: кота нашли одного и привезли в учебный приют.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: охотно играет с мячиками."],
  }),
  makeAdditionalAnimal({
    id:"demo-6",name:"Ива",type:"dog",age_years:5,sex:"female",size:"medium",
    color:["коричневая"],character:["уравновешенная","внимательная"],activity_level:"low",
    housing_requirements:["квартира","спокойные прогулки"],good_with_children:true,good_with_cats:true,
    good_with_dogs:null,can_stay_alone_hours:7,special_care:false,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Спокойная собака; отношение к другим собакам нужно уточнить.",
    photo_id:"photo-1558788353-f76d92427f16",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая коричневая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: полустоячие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: собаку передали в учебный приют из-за изменения семейных обстоятельств.",
  }),
  makeAdditionalAnimal({
    id:"demo-7",name:"Тоша",type:"cat",age_years:4,sex:"male",size:"medium",
    color:["кремовый"],character:["спокойный","независимый"],activity_level:"low",
    housing_requirements:["квартира","тихий дом"],good_with_children:null,good_with_cats:false,
    good_with_dogs:null,can_stay_alone_hours:8,special_care:false,guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Спокойный кот; совместимость с детьми и собаками не проверена.",
    photo_id:"photo-1596854407944-bf87f6fdd49e",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая кремовая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: прямостоячие уши.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: любит отдыхать на тёплой лежанке."],
  }),
  makeAdditionalAnimal({
    id:"demo-8",name:"Соня",type:"cat",age_years:6,sex:"female",size:"small",
    color:["черепаховая"],character:["ласковая","осторожная"],activity_level:"low",
    housing_requirements:["квартира","тихий дом"],good_with_children:true,good_with_cats:null,
    good_with_dogs:false,can_stay_alone_hours:7,special_care:false,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Взрослая кошка, которой подойдёт спокойный дом.",
    photo_id:"photo-1514888286974-6c03e2ca1dba",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: черепаховый окрас и короткая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: небольшие прямостоячие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: кошку оставили в учебном приюте после переезда.",
  }),
  makeAdditionalAnimal({
    id:"demo-9",name:"Ральф",type:"dog",age_years:3,sex:"male",size:"large",
    color:["золотистый"],character:["дружелюбный","активный"],activity_level:"high",
    housing_requirements:["активные прогулки"],good_with_children:true,good_with_cats:null,
    good_with_dogs:true,can_stay_alone_hours:4,special_care:false,guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Активной собаке нужны регулярные прогулки; совместимость с кошками неизвестна.",
    photo_id:"photo-1552053831-71594a27632d",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: густая золотистая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: мягко свисающие уши.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: любит длительные прогулки и игры на свежем воздухе."],
  }),
  makeAdditionalAnimal({
    id:"demo-10",name:"Капля",type:"cat",age_years:2,sex:"female",size:"small",
    color:["белая"],character:["нежная","игривая"],activity_level:"moderate",
    housing_requirements:["квартира","безопасные окна"],good_with_children:true,good_with_cats:true,
    good_with_dogs:null,can_stay_alone_hours:5,special_care:false,guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Молодая кошка; отношение к собакам пока не проверено.",
    photo_id:"photo-1596854407944-bf87f6fdd49e",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая белая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: небольшие прямостоячие уши.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: кошку нашли одну и передали в учебный приют.",
  }),
  makeAdditionalAnimal({
    id:"demo-11",name:"Мартин",type:"dog",age_years:7,sex:"male",size:"large",
    color:["серый"],character:["спокойный","преданный"],activity_level:"low",
    housing_requirements:["тихий дом","регулярные прогулки"],good_with_children:true,
    good_with_cats:null,good_with_dogs:true,can_stay_alone_hours:6,special_care:true,
    guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Пожилой собаке может понадобиться дополнительный уход; подробности уточняются.",
    photo_id:"photo-1558788353-f76d92427f16",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая серая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: мягко свисающие уши.",
    health_notes:"ТЕСТОВАЯ ЗАМЕТКА: дополнительный уход указан; диагноз и лечение не указаны.",
    shelter_story:"ТЕСТОВАЯ ИСТОРИЯ: собаку передали в учебный приют для поиска спокойного дома.",
  }),
  makeAdditionalAnimal({
    id:"demo-12",name:"Лада",type:"dog",age_years:1,sex:"female",size:"medium",
    color:["чёрная"],character:["любознательная","энергичная"],activity_level:"high",
    housing_requirements:["активные прогулки","обучение"],good_with_children:true,
    good_with_cats:false,good_with_dogs:true,can_stay_alone_hours:3,special_care:false,
    guardianship_available:false,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Молодой собаке нужны занятия и активные прогулки; с кошками не совместима.",
    photo_id:"photo-1552053831-71594a27632d",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: короткая чёрная шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: высокие прямостоячие уши.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: быстро осваивает новые игровые задания."],
  }),
  makeAdditionalAnimal({
    id:"demo-13",name:"Плюш",type:"cat",age_years:9,sex:"male",size:"medium",
    color:["кремовый"],character:["спокойный","ласковый"],activity_level:"low",
    housing_requirements:["квартира","тихий дом"],good_with_children:true,
    good_with_cats:null,good_with_dogs:null,can_stay_alone_hours:8,special_care:true,
    guardianship_available:true,
    description:"ТЕСТОВЫЕ ДАННЫЕ. Пожилому коту может потребоваться дополнительный уход; совместимость с другими животными неизвестна.",
    photo_id:"photo-1573865526739-10659fec78a5",coat_details:"ТЕСТОВОЕ ОПИСАНИЕ: густая кремовая шерсть.",
    ear_shape:"ТЕСТОВОЕ ОПИСАНИЕ: небольшие округлые уши.",
    health_notes:"ТЕСТОВАЯ ЗАМЕТКА: требуется уточнить индивидуальный режим ухода; диагноз не указан.",
    interesting_facts:["ТЕСТОВЫЙ ФАКТ: любит спокойное общение и мягкие лежанки."],
  }),
];

const demoCharacteristics:Record<string,Partial<Pick<Animal,"coat_details"|"ear_shape"|"shelter_story"|"health_notes"|"interesting_facts">>>={
  luna:{
    coat_details:"короткая дымчато-серая шерсть",
    ear_shape:"небольшие прямостоячие уши",
    shelter_story:"Учебная история: прежняя семья переехала и не смогла забрать питомца.",
    interesting_facts:["любит наблюдать за улицей из окна"],
  },
  ryzhik:{
    coat_details:"рыжая короткая шерсть с белыми отметинами",
    ear_shape:"широкие прямостоячие уши",
    shelter_story:"Учебная история: питомца нашли одного и передали в приют.",
    interesting_facts:["сначала осторожно изучает новые игрушки"],
  },
  mira:{
    coat_details:"светлая короткая шерсть",
    ear_shape:"мягко свисающие уши",
    shelter_story:"Учебная история: прежняя семья переехала и не смогла забрать питомца.",
    interesting_facts:["спокойно ждёт перед прогулкой"],
  },
  bars:{
    coat_details:"короткая полосатая шерсть",
    ear_shape:"остроконечные прямостоячие уши",
    health_notes:"Тестовая запись: есть особенности ухода; диагноз не указан.",
    shelter_story:"Учебная история: питомцу ищут спокойный дом.",
  },
  taiga:{
    coat_details:"короткая чёрная шерсть",
    ear_shape:"высокие прямостоячие уши",
    interesting_facts:["быстро учится новым командам"],
    shelter_story:"Учебная история: питомца передали в приют, чтобы найти ему подходящую семью.",
  },
  snow:{
    coat_details:"белая пушистая шерсть",
    ear_shape:"небольшие прямостоячие уши",
    interesting_facts:["охотно играет с безопасными игрушками"],
  },
};

export const animals:Animal[]=[...demoAnimals,...additionalAnimals].map(animal=>({
  ...animal,
  ...demoCharacteristics[animal.id],
}));

export type AnimalCatalogSource="demo"|"supabase"|"mixed";

export function getAnimalCatalogSource(records:Pick<Animal,"description">[]):AnimalCatalogSource {
  const demoRecords=records.filter(animal=>/^(?:тестовая карточка|тестовые данные)\s*[:.]/i.test(animal.description));
  if(demoRecords.length===0)return "supabase";
  if(demoRecords.length===records.length)return "demo";
  return "mixed";
}
