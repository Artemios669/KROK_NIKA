import {beforeEach,describe,expect,it,vi} from "vitest";
import {POST} from "@/app/api/chat/route";
import {askGemini} from "@/lib/ai/gemini";
import {emptyProfile} from "@/types/user";
import {userProfileSchema} from "@/lib/validation/profile";

vi.mock("@/lib/ai/gemini",()=>({askGemini:vi.fn()}));

const mockedAskGemini=vi.mocked(askGemini);

function request(ip:string) {
  return new Request("http://localhost/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-forwarded-for":ip},
    body:JSON.stringify({message:"Привет"}),
  });
}

describe("POST /api/chat",()=>{
  beforeEach(()=>vi.resetAllMocks());

  it("uses the demo flow when Gemini is not configured",async()=>{
    mockedAskGemini.mockResolvedValue(null);

    const response=await POST(request("10.0.0.1"));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.mode).toBe("demo");
    expect(body.message).toContain("Где вы живёте — в квартире или частном доме?");
  });

  it("returns Gemini errors without silently switching to demo",async()=>{
    mockedAskGemini.mockRejectedValue(Object.assign(new Error("quota exhausted"),{status:429}));

    const response=await POST(request("10.0.0.2"));
    const body=await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("лимит запросов Gemini");
    expect(body.mode).toBeUndefined();
  });

  it("enforces the illness-care follow-up when Gemini skips it",async()=>{
    const profile=structuredClone(emptyProfile);
    profile.housing.type="квартира";
    profile.household.children=0;
    profile.household.other_animals_confirmed=true;
    profile.lifestyle.hours_away_daily=8;
    profile.preferences.animal_type="cat";
    profile.experience.has_pet_experience=true;
    mockedAskGemini.mockResolvedValue({
      message:"Спасибо, это полезно.",
      profile:userProfileSchema.parse(profile),
    });

    const response=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.4"},
      body:JSON.stringify({message:"Да",profile,currentTopic:"experience"}),
    }));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toContain("серьёзно заболевал");
  });

  it("extracts family facts before Gemini and does not repeat completed questions",async()=>{
    mockedAskGemini.mockResolvedValue({
      message:"Сколько у вас детей и сколько им лет?",
      profile:userProfileSchema.parse(emptyProfile),
    });
    const response=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.5"},
      body:JSON.stringify({
        message:"Живём в квартире, двое детей 5 и 8 лет, других животных нет",
        profile:emptyProfile,
        currentTopic:"housing",
        skippedTopics:[],
      }),
    }));
    const body=await response.json();

    expect(response.status).toBe(200);
    expect(body.profile.household.children).toBe(2);
    expect(body.profile.household.children_ages).toEqual([5,8]);
    expect(body.profile.household.other_animals_confirmed).toBe(true);
    expect(body.progress.nextTopic).toBe("routine");
    expect(body.message).not.toMatch(/детей|дет (?:и|какого)/i);
    expect(body.message).toContain("Сколько часов");
    expect(mockedAskGemini.mock.calls[0][1].household.children).toBe(2);
    expect(mockedAskGemini.mock.calls[0][3]).toBe("routine");
  });

  it("uses a previously adopted pet when choosing the later experience question",async()=>{
    mockedAskGemini.mockResolvedValue({
      message:"Понял.",
      profile:userProfileSchema.parse(emptyProfile),
    });
    const firstResponse=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.7"},
      body:JSON.stringify({
        message:"Живу в частном доме с детишками 4 лет и кошкой, которую мы взяли 5 лет назад в приюте",
        profile:emptyProfile,
        currentTopic:"housing",
      }),
    }));
    const firstResult=await firstResponse.json();

    expect(firstResult.profile.experience.has_pet_experience).toBe(true);
    expect(firstResult.profile.experience.care_experience).toBeNull();

    const secondResponse=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.7"},
      body:JSON.stringify({
        message:"Обычно нас нет дома 2 часа, ритм спокойный",
        profile:firstResult.profile,
        currentTopic:"routine",
      }),
    }));
    const secondResult=await secondResponse.json();

    expect(mockedAskGemini.mock.calls[1][1].experience.has_pet_experience).toBe(true);
    expect(secondResult.message).not.toContain("Был ли у вас раньше опыт");
    expect(secondResult.message).toContain("серьёзной болезни");
  });

  it("recovers a prior adopted pet from chat history when the stored profile missed it",async()=>{
    const storedProfile=structuredClone(emptyProfile);
    storedProfile.housing.type="дом";
    storedProfile.household.children=1;
    storedProfile.household.children_ages=[4];
    storedProfile.household.other_animals=["кошка"];
    storedProfile.household.other_animals_confirmed=true;
    storedProfile.lifestyle.hours_away_daily=2;
    storedProfile.preferences.animal_type="cat";
    mockedAskGemini.mockResolvedValue({
      message:"Понял.",
      profile:userProfileSchema.parse(emptyProfile),
    });

    const response=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.8"},
      body:JSON.stringify({
        message:"Да",
        profile:storedProfile,
        currentTopic:"experience",
        history:[
          {role:"user",text:"Живу в частном доме с детишками 4 лет и кошкой, которую мы взяли 5 лет назад в приюте"},
          {role:"assistant",text:"Сколько часов вы отсутствуете дома?"},
          {role:"user",text:"Обычно нас нет дома 2 часа, ритм спокойный"},
          {role:"assistant",text:"Был ли у вас раньше опыт ухода за животными?"},
        ],
      }),
    }));
    const result=await response.json();

    expect(mockedAskGemini.mock.calls[0][1].experience.has_pet_experience).toBe(true);
    expect(result.profile.experience.has_pet_experience).toBe(true);
    expect(result.message).toContain("серьёзно заболевал");
    expect(result.message).not.toContain("Был ли у вас раньше опыт");
  });

  it("preserves conflicting known facts and accepts a clarified correction",async()=>{
    const profile=structuredClone(emptyProfile);
    profile.housing.type="квартира";
    profile.household.children=2;
    profile.household.other_animals_confirmed=true;
    profile.lifestyle.hours_away_daily=8;
    profile.preferences.animal_type="cat";
    const conflictingProfile=structuredClone(profile);
    conflictingProfile.household.children=3;
    mockedAskGemini.mockResolvedValueOnce({
      message:"Вы сказали, что детей трое.",
      profile:userProfileSchema.parse(conflictingProfile),
    });

    const firstResponse=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.6"},
      body:JSON.stringify({message:"Не уверен",profile,currentTopic:"experience"}),
    }));
    const firstResult=await firstResponse.json();

    expect(firstResult.profile.household.children).toBe(2);
    expect(firstResult.message).toContain("число детей");

    mockedAskGemini.mockResolvedValueOnce({
      message:"Спасибо, записал.",
      profile:userProfileSchema.parse(conflictingProfile),
    });
    const secondResponse=await POST(new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.6"},
      body:JSON.stringify({
        message:"Трое",
        profile:firstResult.profile,
        currentTopic:"experience",
        history:[{role:"assistant",text:firstResult.message}],
      }),
    }));
    const secondResult=await secondResponse.json();

    expect(secondResult.profile.household.children).toBe(3);
    expect(secondResult.message).not.toContain("противоречивые сведения");
  });

  it("rejects malformed profile input",async()=>{
    const invalid=new Request("http://localhost/api/chat",{
      method:"POST",
      headers:{"Content-Type":"application/json","x-forwarded-for":"10.0.0.3"},
      body:JSON.stringify({message:"Привет",profile:{}}),
    });
    const response=await POST(invalid);

    expect(response.status).toBe(400);
  });
});
