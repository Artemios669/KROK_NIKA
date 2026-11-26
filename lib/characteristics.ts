import {Animal} from "@/types/animal";

export const MAX_CHARACTERISTIC_CARDS=10;

export type CharacteristicField="color"|"coat_details"|"character"|"activity_level"|"size"|"ear_shape"|"interesting_fact"|"shelter_story"|"health_notes"|"special_care";
export type SwipeReaction={cardId:string;field:CharacteristicField;value:string;reaction:"like"|"dislike"};
export type CharacteristicCard={id:string;field:CharacteristicField;value:string;title:string;text:string;imageUrl:string};

const fieldOrder:CharacteristicField[]=["color","character","activity_level","size","coat_details","ear_shape","interesting_fact","shelter_story","health_notes","special_care"];
const activityLabels:Record<string,string>={low:"спокойный уровень активности",moderate:"умеренный уровень активности",high:"высокий уровень активности"};
const sizeLabels:Record<string,string>={small:"небольшой размер",medium:"средний размер",large:"крупный размер"};
const titles:Record<CharacteristicField,string>={color:"Окрас",coat_details:"Шерсть",character:"Характер",activity_level:"Активность",size:"Размер",ear_shape:"Форма ушей",interesting_fact:"Интересный факт",shelter_story:"История приюта",health_notes:"Здоровье",special_care:"Особенности ухода"};

export function anonymizeAnimalName(value:string,name:string){const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");return value.replace(new RegExp(escaped,"gi"),"питомец").trim()}

function valuesFor(animal:Animal,field:CharacteristicField):string[]{switch(field){
  case "color":return animal.color;
  case "coat_details":return animal.coat_details?[animal.coat_details]:[];
  case "character":return animal.character;
  case "activity_level":return activityLabels[animal.activity_level]?[activityLabels[animal.activity_level]]:[];
  case "size":return sizeLabels[animal.size]?[sizeLabels[animal.size]]:[];
  case "ear_shape":return animal.ear_shape?[animal.ear_shape]:[];
  case "interesting_fact":return animal.interesting_facts||[];
  case "shelter_story":return animal.shelter_story?[animal.shelter_story]:[];
  case "health_notes":return animal.health_notes?[animal.health_notes]:[];
  case "special_care":return animal.special_care===true?["Требуется дополнительный уход; подробности уточняются у приюта."]:[];
}}

export function buildCharacteristicCards(animals:Animal[]):CharacteristicCard[]{
  const decks=new Map<CharacteristicField,CharacteristicCard[]>(fieldOrder.map(field=>[field,[]]));
  const seen=new Set<string>();
  for(const field of fieldOrder)for(const animal of animals)for(const rawValue of valuesFor(animal,field)){
    const value=anonymizeAnimalName(rawValue,animal.name);
    if(!value)continue;
    const key=`${field}:${value.toLocaleLowerCase("ru")}`;
    if(seen.has(key))continue;
    seen.add(key);
    const text=field==="color"?`Окрас: ${value}`:field==="coat_details"?`Шерсть: ${value}`:field==="character"?`Характер: ${value}`:field==="activity_level"?value:field==="size"?value:field==="ear_shape"?`Форма ушей: ${value}`:field==="interesting_fact"?`Интересный факт: ${value}`:field==="shelter_story"?`История приюта: ${value}`:field==="health_notes"?`Заметка о здоровье: ${value}`:value;
    decks.get(field)?.push({id:key,field,value,title:titles[field],text,imageUrl:animal.image_url.trim()});
  }
  const cards:CharacteristicCard[]=[];
  while(cards.length<MAX_CHARACTERISTIC_CARDS){
    let added=false;
    for(const field of fieldOrder){
      const card=decks.get(field)?.shift();
      if(card){cards.push(card);added=true;if(cards.length===MAX_CHARACTERISTIC_CARDS)break}
    }
    if(!added)break;
  }
  return cards;
}

export function readTraitSwipes():SwipeReaction[]{
  if(typeof window==="undefined")return [];
  try{
    const value:unknown=JSON.parse(localStorage.getItem("niker-character-swipes")||"[]");
    if(!Array.isArray(value))return [];
    return value.filter((item):item is SwipeReaction=>typeof item==="object"&&item!==null&&typeof item.cardId==="string"&&typeof item.field==="string"&&fieldOrder.includes(item.field as CharacteristicField)&&typeof item.value==="string"&&(item.reaction==="like"||item.reaction==="dislike")).slice(0,MAX_CHARACTERISTIC_CARDS);
  }catch{return []}
}

export function characteristicMatches(animal:Animal,swipe:SwipeReaction):boolean{
  switch(swipe.field){
    case "color":return animal.color.some(value=>anonymizeAnimalName(value,animal.name).toLocaleLowerCase("ru")===swipe.value.toLocaleLowerCase("ru"));
    case "coat_details":return animal.coat_details!==null&&animal.coat_details!==undefined&&anonymizeAnimalName(animal.coat_details,animal.name)===swipe.value;
    case "character":return animal.character.some(value=>anonymizeAnimalName(value,animal.name).toLocaleLowerCase("ru")===swipe.value.toLocaleLowerCase("ru"));
    case "activity_level":return activityLabels[animal.activity_level]===swipe.value;
    case "size":return sizeLabels[animal.size]===swipe.value;
    case "ear_shape":return animal.ear_shape!==null&&animal.ear_shape!==undefined&&anonymizeAnimalName(animal.ear_shape,animal.name)===swipe.value;
    case "interesting_fact":return animal.interesting_facts?.some(fact=>anonymizeAnimalName(fact,animal.name)===swipe.value)===true;
    case "shelter_story":return animal.shelter_story!==null&&animal.shelter_story!==undefined&&anonymizeAnimalName(animal.shelter_story,animal.name)===swipe.value;
    case "health_notes":return animal.health_notes!==null&&animal.health_notes!==undefined&&anonymizeAnimalName(animal.health_notes,animal.name)===swipe.value;
    case "special_care":return animal.special_care===true;
  }
}
