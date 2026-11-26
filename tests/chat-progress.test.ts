import {describe,expect,it} from "vitest";
import {createDemoChatReply} from "@/lib/chat/demo";
import {getChatProgress,normalizeChatProfile,preserveSkippedTopic} from "@/lib/chat/progress";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile} from "@/types/user";

describe("chat progress",()=>{
  it("asks the next unresolved topic instead of combining questions",()=>{
    const reply=createDemoChatReply({
      message:"В квартире",
      profile:emptyProfile,
      currentTopic:"housing",
      skippedTopics:[],
      skipCurrentQuestion:false,
    });

    expect(reply.profile.housing.type).toBe("квартира");
    expect(reply.message).toBe("Есть ли в семье дети или другие домашние животные?");
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
    expect(reply.message).toBe("Хорошо, оставлю этот пункт неизвестным. Есть ли в семье дети или другие домашние животные?");
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
