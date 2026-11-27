import {beforeEach,describe,expect,it,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";

vi.mock("@/lib/ai/gemini",()=>({
  askGemini:vi.fn(),
  askRecommendationAssistant:vi.fn(),
}));
vi.mock("@/lib/supabase/server",()=>({getSupabase:vi.fn()}));
vi.mock("@/lib/supabase/animal-catalog",()=>({loadSupabaseAnimalById:vi.fn()}));

import {askRecommendationAssistant} from "@/lib/ai/gemini";
import {getSupabase} from "@/lib/supabase/server";
import {loadSupabaseAnimalById} from "@/lib/supabase/animal-catalog";
import {POST} from "@/app/api/recommendation-assistant/route";
import {emptyProfile} from "@/types/user";
import {animals} from "@/lib/demo-data";

const mockedAskAssistant=vi.mocked(askRecommendationAssistant);

function request(body:unknown,ip:string) {
  return new Request("http://localhost/api/recommendation-assistant",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-forwarded-for":ip},
    body:JSON.stringify(body),
  });
}

function requestBody(animalId="luna") {
  return {
    message:"Почему у неё такой процент?",
    animalId,
    profile:emptyProfile,
    swipes:[],
    history:[],
  };
}

describe("POST /api/recommendation-assistant",()=>{
  beforeEach(()=>{
    vi.resetAllMocks();
    vi.mocked(getSupabase).mockReturnValue(null);
  });

  it("answers using a server-calculated match and the supplied conversation context",async()=>{
    mockedAskAssistant.mockResolvedValue("Оценка рассчитана по известным критериям.");

    const response=await POST(request(requestBody(), "10.0.1.1"));
    const result=await response.json();

    expect(response.status).toBe(200);
    expect(result).toEqual({message:"Оценка рассчитана по известным критериям.",mode:"gemini"});
    expect(mockedAskAssistant.mock.calls[0][3].animal.id).toBe("luna");
  });

  it("rejects malformed profile data",async()=>{
    const response=await POST(request({...requestBody(),profile:{}}, "10.0.1.2"));

    expect(response.status).toBe(400);
    expect(mockedAskAssistant).not.toHaveBeenCalled();
  });

  it("does not answer about an animal outside the current recommendation list",async()=>{
    const response=await POST(request(requestBody("not-in-catalog"), "10.0.1.3"));

    expect(response.status).toBe(404);
    expect(mockedAskAssistant).not.toHaveBeenCalled();
  });

  it("reports missing Gemini configuration instead of showing a fake AI response",async()=>{
    mockedAskAssistant.mockResolvedValue(null);

    const response=await POST(request(requestBody(), "10.0.1.4"));

    expect(response.status).toBe(503);
    expect(mockedAskAssistant).toHaveBeenCalled();
  });

  it("uses only the current Supabase record rather than client-provided animal details",async()=>{
    const client=createClient("https://example.supabase.co","test-anon-key");
    const luna=animals.find(animal=>animal.id==="luna");
    if(!luna)throw new Error("Missing demo fixture.");
    vi.mocked(getSupabase).mockReturnValue(client);
    vi.mocked(loadSupabaseAnimalById).mockResolvedValue({...luna,name:"Мята"});
    mockedAskAssistant.mockResolvedValue("В карточке питомца указано имя Мята.");

    const response=await POST(request(requestBody(), "10.0.1.5"));
    const result=await response.json();

    expect(response.status).toBe(200);
    expect(result.message).toContain("Мята");
    expect(mockedAskAssistant.mock.calls[0][3].animal.name).toBe("Мята");
    expect(loadSupabaseAnimalById).toHaveBeenCalledWith(client,"luna");
  });
});
