import {beforeEach,describe,expect,it,vi} from "vitest";

vi.mock("@/lib/admin-auth",()=>({isAdmin:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({getSupabaseAdmin:vi.fn()}));

import {isAdmin} from "@/lib/admin-auth";
import {getSupabaseAdmin} from "@/lib/supabase/server";
import {PATCH as answerQuestion} from "@/app/api/admin/questions/[id]/route";
import {PATCH as updateRequestStatus} from "@/app/api/admin/adoption-requests/[id]/route";

const request=(body:unknown)=>new Request("http://localhost/api/admin",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
const context={params:Promise.resolve({id:"123e4567-e89b-42d3-a456-426614174000"})};

describe("admin workflows",()=>{
  beforeEach(()=>{
    vi.mocked(isAdmin).mockResolvedValue(true);
    vi.mocked(getSupabaseAdmin).mockReturnValue(null);
  });

  it("requires admin authentication before changing a question",async()=>{
    vi.mocked(isAdmin).mockResolvedValue(false);

    const response=await answerQuestion(request({answer:"Ответ приюта"}),context);

    expect(response.status).toBe(401);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects an unsupported adoption request status",async()=>{
    const response=await updateRequestStatus(request({status:"closed"}),context);

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("rejects empty staff answers",async()=>{
    const response=await answerQuestion(request({answer:"  "}),context);

    expect(response.status).toBe(400);
    expect(getSupabaseAdmin).not.toHaveBeenCalled();
  });
});
