import {beforeEach,describe,expect,it,vi} from "vitest";
import {POST} from "@/app/api/chat/route";
import {askGemini} from "@/lib/ai/gemini";

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
    expect(body.message).toBe("Вы живёте в квартире или частном доме?");
  });

  it("returns Gemini errors without silently switching to demo",async()=>{
    mockedAskGemini.mockRejectedValue(Object.assign(new Error("quota exhausted"),{status:429}));

    const response=await POST(request("10.0.0.2"));
    const body=await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toContain("лимит запросов Gemini");
    expect(body.mode).toBeUndefined();
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
