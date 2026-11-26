import {describe,expect,it} from "vitest";
import {createDemoChatReply} from "@/lib/chat/demo";
import {getChatProgress,hasExperienceCareDetails,normalizeChatProfile,preserveSkippedTopic} from "@/lib/chat/progress";
import {getChatScenario} from "@/lib/chat/scenarios";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile} from "@/types/user";

describe("chat progress",()=>{
  it("combines related home and household questions and captures both answers",()=>{
    const reply=createDemoChatReply({
      message:"Живём в квартире, двое детей 5 и 8 лет, у нас есть кот",
      profile:emptyProfile,
      currentTopic:"housing",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(reply.profile.housing.type).toBe("квартира");
    expect(reply.profile.household.children).toBe(2);
    expect(reply.profile.household.children_ages).toEqual([5,8]);
    expect(reply.profile.household.other_animals).toEqual(["кошка"]);
    expect(reply.profile.household.other_animals_confirmed).toBe(true);
  });

  it("does not mistake a wanted or past animal for a current household pet",()=>{
    const wanted=createDemoChatReply({
      message:"Хочу кошку",
      profile:emptyProfile,
      currentTopic:"family",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });
    const past=createDemoChatReply({
      message:"Раньше у меня была собака",
      profile:emptyProfile,
      currentTopic:"family",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(wanted.profile.household.other_animals_confirmed).toBeNull();
    expect(past.profile.household.other_animals_confirmed).toBeNull();
  });

  it("asks about illness care after experience is confirmed, but not before",()=>{
    const profile=structuredClone(emptyProfile);
    profile.experience.has_pet_experience=true;

    expect(getChatScenario(profile,"experience").question).toContain("серьёзно заболевал");
    expect(getChatScenario(emptyProfile,"experience").question).not.toContain("серьёзно заболевал");
    expect(hasExperienceCareDetails("Да, раньше был кот")).toBe(false);
    expect(hasExperienceCareDetails("Не сталкивался с серьёзными болезнями")).toBe(true);
    expect(hasExperienceCareDetails("Нет опыта лечения")).toBe(false);
  });

  it("requires a real illness-care follow-up after a yes and stores its answer",()=>{
    const profile=structuredClone(emptyProfile);
    profile.housing.type="квартира";
    profile.household.children=0;
    profile.household.other_animals_confirmed=true;
    profile.lifestyle.hours_away_daily=8;
    const experience=createDemoChatReply({
      message:"Хочу кошку, опыт был",
      profile,
      currentTopic:"animal_type",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(experience.profile.preferences.animal_type).toBe("cat");
    expect(experience.profile.experience.has_pet_experience).toBe(true);
    expect(experience.profile.experience.care_experience).toBeNull();
    expect(experience.message).toContain("серьёзно заболевал");

    const followUp=createDemoChatReply({
      message:"Обращались к ветеринару и давали лекарства по назначению",
      profile:experience.profile,
      currentTopic:"experience",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });
    expect(followUp.profile.experience.care_experience).toContain("ветеринару");
  });

  it("records several connected preferences from one answer",()=>{
    const reply=createDemoChatReply({
      message:"Хочу собаку, у меня был опыт с кошками",
      profile:emptyProfile,
      currentTopic:"animal_type",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(reply.profile.preferences.animal_type).toBe("dog");
    expect(reply.profile.experience.has_pet_experience).toBe(true);
  });

  it("accepts detailed care descriptions up to 400 characters",()=>{
    const profile=structuredClone(emptyProfile);
    profile.experience.care_experience="x".repeat(400);

    expect(userProfileSchema.safeParse(profile).success).toBe(true);
    profile.experience.care_experience+="x";
    expect(userProfileSchema.safeParse(profile).success).toBe(false);
  });

  it("asks the next unresolved topic with a combined question",()=>{
    const reply=createDemoChatReply({
      message:"В квартире",
      profile:emptyProfile,
      currentTopic:"housing",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(reply.profile.housing.type).toBe("квартира");
    expect(reply.message).toContain("дети (примерный возраст) или другие животные");
  });

  it("tracks absence hours and confirmed household answers independently",()=>{
    const household=createDemoChatReply({
      message:"Детей нет, других животных тоже нет",
      profile:emptyProfile,
      currentTopic:"family",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });
    expect(household.profile.household.children).toBe(0);
    expect(household.profile.household.other_animals_confirmed).toBe(true);

    const routine=createDemoChatReply({
      message:"Обычно меня нет дома 7 часов",
      profile:emptyProfile,
      currentTopic:"routine",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });
    expect(routine.profile.lifestyle.hours_away_daily).toBe(7);
    expect(routine.profile.lifestyle.works_full_time).toBeNull();
  });

  it("keeps skipped fields unknown and offers the next topic",()=>{
    const reply=createDemoChatReply({
      message:"Пропустить вопрос",
      profile:emptyProfile,
      currentTopic:"housing",
      skippedTopics:[],
      skipCurrentQuestion:true,
    });

    expect(reply.profile.housing.type).toBeNull();
    expect(reply.progress.skippedTopics).toContain("housing");
    expect(reply.message).toContain("Хорошо, оставлю этот пункт неизвестным.");
    expect(reply.message).toContain("дети (примерный возраст) или другие животные");
    expect(reply.progress.canProceedWithPartialProfile).toBe(false);
  });

  it("permits partial progression only after every required unknown topic is skipped",()=>{
    const profile=structuredClone(emptyProfile);
    profile.housing.type="квартира";
    profile.household.children=0;
    profile.household.other_animals_confirmed=true;
    profile.lifestyle.hours_away_daily=4;
    profile.preferences.animal_type="cat";

    expect(getChatProgress(profile).canProceedWithPartialProfile).toBe(true);
    expect(getChatProgress(emptyProfile,["housing","family","routine"]).canProceedWithPartialProfile).toBe(false);
    expect(getChatProgress(emptyProfile,["housing","family","routine","animal_type"]).canProceedWithPartialProfile).toBe(true);
  });

  it("does not accept an AI profile mutation for a skipped topic",()=>{
    const updated=structuredClone(emptyProfile);
    updated.housing.type="дом";
    const result=preserveSkippedTopic(updated,emptyProfile,"housing");

    expect(result.housing.type).toBeNull();
  });

  it("canonicalizes completion flags and accepts older stored profiles",()=>{
    const oldProfile=JSON.parse(JSON.stringify(emptyProfile)) as {household:Record<string,unknown>};
    delete oldProfile.household.other_animals_confirmed;
    const parsed=userProfileSchema.parse(oldProfile);
    expect(parsed.household.other_animals_confirmed).toBeNull();

    const inconsistent=structuredClone(emptyProfile);
    inconsistent.completed=true;
    inconsistent.missing_fields=[];
    const normalized=normalizeChatProfile(inconsistent);
    expect(normalized.completed).toBe(false);
    expect(normalized.missing_fields).toContain("условия проживания");
  });
});
