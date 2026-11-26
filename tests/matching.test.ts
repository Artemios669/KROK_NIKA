import {describe,it,expect} from "vitest";
import {animals} from "@/lib/demo-data";
import {emptyProfile} from "@/types/user";
import {matchAnimal,recommendations} from "@/lib/matching";
import {Animal} from "@/types/animal";

describe("weighted matching",()=>{
  it("ranks a calmer animal ahead of a high-activity animal for a calm full-time worker",()=>{
    const profile=structuredClone(emptyProfile);
    profile.preferences.animal_type="dog";
    profile.preferences.activity="low";
    profile.lifestyle.activity_level="low";
    profile.lifestyle.works_full_time=true;
    profile.lifestyle.hours_away_daily=5;

    const candidates=animals
      .filter(animal=>animal.id==="mira"||animal.id==="taiga")
      .map(animal=>({...animal,can_stay_alone_hours:8}));
    const results=recommendations(candidates,profile);

    expect(results[0].animal.id).toBe("mira");
    expect(results.find(match=>match.animal.id==="taiga")?.score).toBeLessThan(results[0].score!);
  });

  it("filters a confirmed incompatibility with children",()=>{
    const profile=structuredClone(emptyProfile);
    profile.household.children=1;

    expect(recommendations(animals,profile).find(match=>match.animal.id==="bars")).toBeUndefined();
  });

  it("keeps unknown compatibility with cats and asks the shelter to clarify",()=>{
    const profile=structuredClone(emptyProfile);
    profile.household.other_animals=["кошка"];

    const result=recommendations(animals,profile).find(match=>match.animal.id==="mira");
    expect(result?.questions).toContain("Уточнить у приюта совместимость с кошками.");
  });

  it("filters confirmed dog incompatibility but does not exclude unknown housing requirements",()=>{
    const profile=structuredClone(emptyProfile);
    profile.household.other_animals=["собака"];
    const incompatible=matchAnimal(animals.find(animal=>animal.id==="bars")!,profile);
    expect(incompatible).toBeNull();

    profile.household.other_animals=[];
    profile.housing.type="квартира";
    const housingUnknown=matchAnimal({...animals[0],housing_requirements:[]},profile);
    expect(housingUnknown).not.toBeNull();
    expect(housingUnknown?.questions).toContain("Уточнить у приюта требования к условиям содержания.");
  });

  it("filters a confirmed alone-time mismatch and asks about unknown limits",()=>{
    const profile=structuredClone(emptyProfile);
    profile.lifestyle.hours_away_daily=9;
    expect(matchAnimal(animals[0],profile)).toBeNull();

    const unknownLimit=matchAnimal({...animals[0],can_stay_alone_hours:null},profile);
    expect(unknownLimit).not.toBeNull();
    expect(unknownLimit?.questions).toContain("Уточнить у приюта, как долго животное может оставаться одно.");
  });

  it("does not score unknown profile or animal information as a match",()=>{
    const result=matchAnimal(animals[0],emptyProfile,[]);

    expect(result?.score).toBeNull();
    expect(result?.dataCompleteness).toBe(0);
    expect(result?.matches).toEqual([]);
    expect(result?.explanation).toContain("Процент не рассчитан");
    expect(result?.explanation).toContain("нет подтверждённых совпадений");
  });

  it("explains the recommendation using concrete matches and the data actually scored",()=>{
    const profile=structuredClone(emptyProfile);
    profile.lifestyle.activity_level="low";
    profile.lifestyle.hours_away_daily=4;

    const result=matchAnimal(animals.find(animal=>animal.id==="luna")!,profile);

    expect(result?.explanation).toContain("активности подходит");
    expect(result?.explanation).toContain("Оценка");
    expect(result?.explanation).toContain("30% весов критериев");
  });

  it("returns no recommendations when every animal fails a confirmed safety filter",()=>{
    const profile=structuredClone(emptyProfile);
    profile.household.children=1;

    expect(recommendations([animals.find(animal=>animal.id==="bars")!],profile)).toEqual([]);
  });

  it("uses the full 100-point weight distribution when all relevant factors are known",()=>{
    const profile=structuredClone(emptyProfile);
    profile.housing.type="квартира";
    profile.housing.living_conditions="тихая спокойная обстановка";
    profile.housing.yard_available=true;
    profile.household.children=1;
    profile.household.other_animals=["кошка","собака"];
    profile.lifestyle.activity_level="low";
    profile.lifestyle.hours_away_daily=4;
    profile.preferences.character=["спокойный"];
    profile.preferences.preferred_size="small";
    profile.preferences.preferred_age="молодой";
    profile.preferences.colors=["серый"];
    profile.readiness.special_care=true;

    const animal:Animal={
      ...animals[0],
      age_years:2,
      size:"small",
      color:["серая"],
      character:["спокойная"],
      activity_level:"low",
      housing_requirements:["квартира","двор необходим","тихий дом"],
      good_with_children:true,
      good_with_cats:true,
      good_with_dogs:true,
      can_stay_alone_hours:6,
      special_care:true,
    };
    const result=matchAnimal(animal,profile,[]);

    expect(result?.score).toBe(100);
    expect(result?.dataCompleteness).toBe(100);
  });

  it("does not let swipes bypass confirmed safety filters",()=>{
    const profile=structuredClone(emptyProfile);
    profile.household.children=1;
    const unsafe=animals.find(animal=>animal.id==="bars")!;
    const safe=animals.find(animal=>animal.id==="luna")!;
    const results=recommendations([unsafe,safe],profile,[{
      cardId:"character:спокойная",
      field:"character",
      value:"спокойная",
      reaction:"like",
    }]);

    expect(results.map(match=>match.animal.id)).toEqual(["luna"]);
  });

  it("accumulates several related likes as a bounded ranking signal",()=>{
    const calm=animals.find(animal=>animal.id==="luna")!;
    const other=animals.find(animal=>animal.id==="snow")!;
    const oneLike=recommendations([other,calm],emptyProfile,[{
      cardId:"character:спокойная",
      field:"character",
      value:"спокойная",
      reaction:"like",
    }]);
    const severalLikes=recommendations([other,calm],emptyProfile,[
      {cardId:"character:спокойная",field:"character",value:"спокойная",reaction:"like"},
      {cardId:"color:серая",field:"color",value:"серая",reaction:"like"},
      {cardId:"activity_level:спокойный уровень активности",field:"activity_level",value:"спокойный уровень активности",reaction:"like"},
    ]);

    expect(oneLike.find(match=>match.animal.id==="luna")?.score).toBe(severalLikes.find(match=>match.animal.id==="luna")?.score);
    expect(severalLikes[0].animal.id).toBe("luna");
    expect(severalLikes.find(match=>match.animal.id==="luna")?.swipeSignal).toBeGreaterThan(oneLike.find(match=>match.animal.id==="luna")!.swipeSignal);
  });
});
