import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("@/lib/supabase/server",()=>({getSupabase:vi.fn()}));

import {getSupabase} from "@/lib/supabase/server";
import {POST} from "@/app/api/recommendations/route";
import {emptyProfile} from "@/types/user";

const request=(body:unknown)=>new Request("http://localhost/api/recommendations",{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(body),
});

describe("server recommendations API",()=>{
  beforeEach(()=>vi.mocked(getSupabase).mockReturnValue(null));

  it("validates the profile before calculating recommendations",async()=>{
    const response=await POST(request({profile:{completed:true},swipes:[]}));

    expect(response.status).toBe(400);
  });

  it("rejects more swipe reactions than the supported card limit",async()=>{
    const swipes=Array.from({length:11},(_,index)=>({
      cardId:`color:${index}`,
      field:"color",
      value:"серый",
      reaction:"like",
    }));
    const response=await POST(request({profile:emptyProfile,swipes}));

    expect(response.status).toBe(400);
  });

  it("computes demo recommendations on the server when Supabase is not configured",async()=>{
    const response=await POST(request({profile:emptyProfile,swipes:[]}));
    const result=await response.json();

    expect(response.status).toBe(200);
    expect(result.source).toBe("demo");
    expect(result.recommendations[0].score).toBeNull();
    expect(result.recommendations[0].dataCompleteness).toBe(0);
  });
});
