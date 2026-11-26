import {Animal} from "@/types/animal";
import {UserProfile} from "@/types/user";
import {characteristicMatches,SwipeReaction} from "@/lib/characteristics";

type ActivityLevel="low"|"moderate"|"high";
type WeightedFactor={weight:number;score:number};
type AgeRange={min:number;max:number};

export type Match={
  animal:Animal;
  score:number|null;
  dataCompleteness:number;
  explanation:string;
  matches:string[];
  mismatches:string[];
  risks:string[];
  questions:string[];
  swipeSignal:number;
};

const activityRank:Record<ActivityLevel,number>={low:0,moderate:1,high:2};
const terminalAdjective=/(?:ая|яя|ое|ее|ый|ий|ой|ые|ие|ую|юю)$/u;

function normalize(value:string) {
  return value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/\s+/g," ");
}

function canonicalize(value:string) {
  return normalize(value).replace(terminalAdjective,"");
}

function containsAny(value:string,patterns:RegExp[]) {
  return patterns.some(pattern=>pattern.test(value));
}

function ageRange(preference:string):AgeRange|null|undefined {
  const value=normalize(preference);
  if(containsAny(value,[/любой/,/любого/,/не важно/,/неважно/,/без разницы/]))return null;
  if(containsAny(value,[/котен/,/щен/,/до года/]))return {min:0,max:1};
  if(containsAny(value,[/молод/]))return {min:0,max:3};
  if(containsAny(value,[/взросл/]))return {min:2,max:8};
  if(containsAny(value,[/пожил/,/старш/]))return {min:8,max:Number.POSITIVE_INFINITY};

  const bounded=value.match(/(?:от\s*)?(\d+(?:[.,]\d+)?)\s*(?:лет|года|год)?\s*(?:-|–|до)\s*(\d+(?:[.,]\d+)?)/);
  if(bounded) {
    return {
      min:Number(bounded[1].replace(",",".")),
      max:Number(bounded[2].replace(",",".")),
    };
  }
  const upTo=value.match(/до\s*(\d+(?:[.,]\d+)?)/);
  if(upTo)return {min:0,max:Number(upTo[1].replace(",","."))};
  const from=value.match(/от\s*(\d+(?:[.,]\d+)?)/);
  if(from)return {min:Number(from[1].replace(",",".")),max:Number.POSITIVE_INFINITY};
  const exact=value.match(/(\d+(?:[.,]\d+)?)/);
  if(exact) {
    const target=Number(exact[1].replace(",","."));
    return {min:Math.max(0,target-1),max:target+1};
  }
  return undefined;
}

function petKind(value:string):"cat"|"dog"|null {
  const normalized=normalize(value);
  if(/кошк|кот(?:\b|а|у|ом|е|ы|ов|ам|ами|ах)|\bcat\b/u.test(normalized))return "cat";
  if(/собак|пес|пёс|щен|\bdog\b/u.test(normalized))return "dog";
  return null;
}

function homeKind(value:string):"apartment"|"house"|null {
  const normalized=normalize(value);
  if(/квартир|апартамент/.test(normalized))return "apartment";
  if(/дом|коттедж/.test(normalized))return "house";
  return null;
}

function similarity(left:string,right:string) {
  return canonicalize(left)===canonicalize(right);
}

function pushUnique(target:string[],value:string) {
  if(!target.includes(value))target.push(value);
}

function explainMatch(match:Pick<Match,"score"|"dataCompleteness"|"matches"|"mismatches"|"risks"|"questions"|"swipeSignal">) {
  const reason=match.matches.length
    ?`Подтверждённые совпадения: ${match.matches.slice(0,3).join("; ")}${match.matches.length>3?"; остальные перечислены ниже":""}.`
    :"По заполненным критериям пока нет подтверждённых совпадений.";
  const assessment=match.score===null
    ?"Процент не рассчитан: недостаточно известных факторов для оценки."
    :`Оценка ${match.score}% рассчитана по известным данным; учтено ${match.dataCompleteness}% весов критериев.`;
  const notes=[
    match.mismatches.length?"Есть расхождения с предпочтениями — они перечислены ниже.":"",
    match.risks.length?"В карточке есть особенности, которые стоит обсудить с приютом.":"",
    match.questions.length?"Перед решением стоит уточнить у приюта вопросы, перечисленные ниже.":"",
    match.score===null&&match.swipeSignal>0?"Позиция в списке также учитывает ваши положительные свайпы; они не подтверждают совместимость.":"",
  ].filter(Boolean);
  return [reason,assessment,...notes].join(" ");
}

export function matchAnimal(animal:Animal,profile:UserProfile,swipes:SwipeReaction[]=[]):Match|null {
  if(!animal.adoption_available)return null;
  if(profile.preferences.animal_type&&animal.type!==profile.preferences.animal_type)return null;

  const requirements=(animal.housing_requirements||[]).map(normalize);
  const requirementText=requirements.join(" ");
  const preferredHome=profile.housing.type?homeKind(profile.housing.type):null;
  const listedHomes=new Set<"apartment"|"house">();
  for(const requirement of requirements) {
    const kind=homeKind(requirement);
    if(kind)listedHomes.add(kind);
  }
  const strictHouse=containsAny(requirementText,[/только дом/,/дом обязател/,/частный дом обязател/]);
  const strictApartment=containsAny(requirementText,[/только квартир/,/квартира обязател/]);
  const strictYard=containsAny(requirementText,[/(двор|участок|вольер).*(нужен|обязател|требуется|необходим)/]);
  const hasYardRequirement=containsAny(requirementText,[/двор/,/участок/,/вольер/]);

  if(preferredHome==="apartment"&&strictHouse)return null;
  if(preferredHome==="house"&&strictApartment)return null;
  if(strictYard&&profile.housing.yard_available===false)return null;
  if(requirements.some(value=>value==="опыт")&&profile.experience.has_pet_experience===false)return null;

  const petKindsInHousehold=new Set<"cat"|"dog">();
  for(const pet of profile.household.other_animals) {
    const kind=petKind(pet);
    if(kind)petKindsInHousehold.add(kind);
  }

  if(profile.household.children!==null&&profile.household.children>0&&animal.good_with_children===false)return null;
  if(petKindsInHousehold.has("cat")&&animal.good_with_cats===false)return null;
  if(petKindsInHousehold.has("dog")&&animal.good_with_dogs===false)return null;
  if(profile.readiness.special_care===false&&animal.special_care===true)return null;
  if(profile.lifestyle.hours_away_daily!==null&&animal.can_stay_alone_hours!==null&&profile.lifestyle.hours_away_daily>animal.can_stay_alone_hours)return null;

  const factors:WeightedFactor[]=[];
  const matches:string[]=[];
  const mismatches:string[]=[];
  const risks:string[]=[];
  const questions:string[]=[];

  const addFactor=(weight:number,score:number|null,match:string,mismatch:string)=>{
    if(score===null)return;
    factors.push({weight,score:Math.max(0,Math.min(1,score))});
    if(score>=0.75)pushUnique(matches,match);
    else if(score<=0.25)pushUnique(mismatches,mismatch);
    else {
      pushUnique(matches,match);
      pushUnique(mismatches,mismatch);
    }
  };

  const preferredActivities=[profile.lifestyle.activity_level,profile.preferences.activity]
    .filter((value):value is ActivityLevel=>value!==null);
  if(preferredActivities.length&&animal.activity_level!=="unknown") {
    const scores=preferredActivities.map(level=>1-Math.abs(activityRank[level]-activityRank[animal.activity_level as ActivityLevel])/2);
    addFactor(20,scores.reduce((sum,value)=>sum+value,0)/scores.length,"Уровень активности подходит вашему образу жизни","Уровень активности отличается от предпочтений");
  } else if(preferredActivities.length) {
    pushUnique(questions,"Уточнить у приюта уровень активности животного.");
  }

  if(profile.lifestyle.hours_away_daily!==null) {
    if(animal.can_stay_alone_hours!==null) {
      addFactor(10,1,"Животное может оставаться одно указанное вами время","Время одиночества требует отдельного обсуждения");
    } else {
      pushUnique(questions,"Уточнить у приюта, как долго животное может оставаться одно.");
    }
  } else if(profile.lifestyle.works_full_time===true) {
    pushUnique(questions,"Уточнить ваш обычный график отсутствия и допустимое время одиночества животного.");
  }

  if(profile.preferences.character.length) {
    const animalCharacter=animal.character||[];
    if(animalCharacter.length) {
      const matchedTraits=profile.preferences.character.filter(preference=>animalCharacter.some(trait=>similarity(trait,preference)));
      addFactor(25,matchedTraits.length/profile.preferences.character.length,
        matchedTraits.length?`Совпадает характер: ${matchedTraits.join(", ")}`:"Характер животного описан, но желаемые черты не подтверждены",
        "Указанные предпочтения по характеру не совпадают");
      if(matchedTraits.length<profile.preferences.character.length) {
        pushUnique(mismatches,"Не все желаемые черты характера указаны у животного.");
      }
    } else {
      pushUnique(questions,"Уточнить у приюта темперамент животного.");
    }
  }

  if(preferredHome) {
    if(listedHomes.size) {
      const homeScore=listedHomes.has(preferredHome)?1:0;
      addFactor(12,homeScore,"Указанный тип жилья соответствует рекомендациям","Тип жилья может не соответствовать рекомендациям");
      if(homeScore===0)pushUnique(questions,"Уточнить у приюта, допустим ли ваш тип жилья.");
    } else if(requirements.length===0) {
      pushUnique(questions,"Уточнить у приюта требования к условиям содержания.");
    }
  } else if(listedHomes.size) {
    pushUnique(questions,"Уточнить ваш тип жилья для проверки рекомендаций приюта.");
  }

  if(hasYardRequirement) {
    if(profile.housing.yard_available!==null) {
      const yardScore=profile.housing.yard_available?1:0;
      addFactor(4,yardScore,"Условия с двором подходят требованиям","Наличие двора может быть важным условием");
      if(yardScore===0)pushUnique(questions,"Уточнить у приюта, обязателен ли двор для этого животного.");
    } else {
      pushUnique(questions,"Уточнить, есть ли у вас безопасный двор или участок.");
    }
  }

  if(containsAny(requirementText,[/тих/])) {
    if(profile.housing.living_conditions!==null) {
      const quietConditions=containsAny(normalize(profile.housing.living_conditions),[/тих/,/спокой/,/без шума/]);
      addFactor(4,quietConditions?1:0,"Спокойная домашняя обстановка соответствует описанию","Приюту важно уточнить, насколько дома тихая обстановка");
    } else {
      pushUnique(questions,"Уточнить у приюта, насколько важна спокойная обстановка дома.");
    }
  }

  if(profile.household.children!==null&&profile.household.children>0) {
    if(animal.good_with_children===true) {
      addFactor(7,1,"Животное отмечено как совместимое с детьми","Совместимость с детьми не подтверждена");
    } else if(animal.good_with_children===null) {
      pushUnique(questions,"Уточнить у приюта совместимость с детьми.");
    }
  } else if(profile.household.children===null) {
    pushUnique(questions,"Уточнить, будут ли в доме дети.");
  }

  for(const kind of petKindsInHousehold) {
    const compatible=kind==="cat"?animal.good_with_cats:animal.good_with_dogs;
    if(compatible===true) {
      addFactor(kind==="cat"?4:4,1,`Совместимость с ${kind==="cat"?"кошками":"собаками"} подтверждена`,`Совместимость с ${kind==="cat"?"кошками":"собаками"} не подтверждена`);
    } else if(compatible===null) {
      pushUnique(questions,`Уточнить у приюта совместимость с ${kind==="cat"?"кошками":"собаками"}.`);
    }
  }

  for(const pet of profile.household.other_animals) {
    if(!petKind(pet))pushUnique(questions,`Уточнить у приюта совместимость с животным «${pet}».`);
  }

  if(profile.preferences.preferred_size) {
    if(animal.size!=="unknown") {
      const sizeScore=profile.preferences.preferred_size===animal.size?1:0;
      addFactor(3,sizeScore,"Размер соответствует вашему предпочтению","Размер отличается от предпочтения");
    } else {
      pushUnique(questions,"Уточнить у приюта предполагаемый размер животного.");
    }
  }

  if(profile.preferences.preferred_age) {
    const preferredAge=ageRange(profile.preferences.preferred_age);
    if(preferredAge===null) {
      // The user explicitly has no age preference.
    } else if(preferredAge===undefined) {
      pushUnique(questions,"Уточнить ваш предпочтительный возраст животного.");
    } else {
      const age=animal.age_years;
      if(Number.isFinite(age)) {
        const ageScore=age>=preferredAge.min&&age<=preferredAge.max?1:0;
        addFactor(3,ageScore,"Возраст соответствует вашему предпочтению","Возраст отличается от предпочтения");
      } else {
        pushUnique(questions,"Уточнить у приюта возраст животного.");
      }
    }
  }

  if(profile.preferences.colors.length) {
    if(animal.color?.length) {
      const likedColor=profile.preferences.colors.find(color=>animal.color.some(animalColor=>similarity(color,animalColor)));
      addFactor(2,likedColor?1:0,likedColor?`Подходит окрас: ${likedColor}`:"Окрас указан, но желаемый вариант не найден","Окрас отличается от предпочтений");
    } else {
      pushUnique(questions,"Уточнить у приюта окрас животного.");
    }
  }

  if(animal.special_care===true) {
    pushUnique(risks,"Животному требуется дополнительный уход; обсудите его объём с приютом.");
    if(profile.readiness.special_care===null)pushUnique(questions,"Уточнить у приюта особенности ухода и оценить готовность к ним.");
    else if(profile.readiness.special_care===true)addFactor(2,1,"Вы готовы рассмотреть дополнительный уход","Готовность к дополнительному уходу требует обсуждения");
  } else if(animal.special_care===null) {
    pushUnique(questions,"Уточнить у приюта, требуется ли животному дополнительный уход.");
  }

  if(animal.health_notes) {
    pushUnique(risks,"В карточке есть заметка о здоровье. Уточните её содержание у приюта.");
  }

  const totalWeight=factors.reduce((sum,factor)=>sum+factor.weight,0);
  const weightedScore=factors.reduce((sum,factor)=>sum+factor.weight*factor.score,0);
  const score=totalWeight?Math.round(weightedScore/totalWeight*100):null;
  const swipeSignal=swipes.reduce((sum,swipe)=>{
    return sum+(characteristicMatches(animal,swipe)?(swipe.reaction==="like"?1:-1):0);
  },0)/10;

  const match={
    animal,
    score,
    dataCompleteness:Math.round(totalWeight),
    matches,
    mismatches,
    risks,
    questions,
    swipeSignal,
  };
  return {...match,explanation:explainMatch(match)};
}

export function recommendations(animals:Animal[],profile:UserProfile,swipes:SwipeReaction[]=[]):Match[] {
  return animals
    .map(animal=>matchAnimal(animal,profile,swipes))
    .filter((match):match is Match=>match!==null)
    .sort((left,right)=>{
      if(left.score===null&&right.score!==null)return 1;
      if(left.score!==null&&right.score===null)return -1;
      const leftRank=(left.score??-1)+left.swipeSignal*5;
      const rightRank=(right.score??-1)+right.swipeSignal*5;
      return rightRank-leftRank||
        right.dataCompleteness-left.dataCompleteness||
        (right.score??-1)-(left.score??-1);
    });
}
