import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("@/lib/supabase/server",()=>({getSupabase:vi.fn()}));

import {getSupabase} from "@/lib/supabase/server";
import {POST as submitQuestion} from "@/app/api/questions/route";
import {POST as submitAdoptionRequest} from "@/app/api/adoption-requests/route";

const request=(body:unknown)=>new Request("http://localhost/api",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});

describe("Supabase submissions",()=>{
  beforeEach(()=>vi.mocked(getSupabase).mockReturnValue(null));

  it("does not claim a question was saved when Supabase is not configured",async()=>{
    const response=await submitQuestion(request({
      animal_id:"123e4567-e89b-42d3-a456-426614174000",
      question:"Можно узнать о характере?",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({error:expect.stringContaining("не сохранён")});
  });

  it("does not claim an adoption request was saved when Supabase is not configured",async()=>{
    const response=await submitAdoptionRequest(request({
      animal_id:null,
      contact_name:"Анна",
      contact_email:"anna@example.com",
      request_type:"adoption",
    }));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({error:expect.stringContaining("не сохранена")});
  });
});
