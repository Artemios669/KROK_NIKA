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
