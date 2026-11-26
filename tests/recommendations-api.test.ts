import {beforeEach,describe,expect,it,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server",()=>({getSupabase:vi.fn()}));
vi.mock("@/lib/supabase/animal-catalog",()=>({loadSupabaseAnimalCatalog:vi.fn()}));

import {getSupabase} from "@/lib/supabase/server";
import {loadSupabaseAnimalCatalog} from "@/lib/supabase/animal-catalog";
import {normalizeImportedAnimal} from "@/lib/animal-catalog";
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

  it("calculates recommendations from imported text-based animal records",async()=>{
    const animal=normalizeImportedAnimal({
      id:"imported-cat-1",
      name:"Мята",
      type:"Кошка",
      age_years:"3",
      size:"маленький",
      character:"спокойная, ласковая",
      activity_level:"низкий",
      good_with_children:"да",
      good_with_cats:"неизвестно",
      good_with_dogs:"нет",
      adoption_available:"да",
    });
    if(!animal)throw new Error("Imported animal fixture is invalid.");
    const client=createClient("https://example.supabase.co","test-anon-key");
    vi.mocked(getSupabase).mockReturnValue(client);
    vi.mocked(loadSupabaseAnimalCatalog).mockResolvedValue({
      animals:[animal],
      table:"animalsss",
      totalRecords:1,
      unconfirmedAvailability:0,
      unavailableRecords:0,
    });

    const response=await POST(request({profile:emptyProfile,swipes:[]}));
    const result=await response.json();

    expect(response.status).toBe(200);
    expect(result.source).toBe("supabase");
    expect(result.recommendations[0].animal.id).toBe("imported-cat-1");
  });
});
