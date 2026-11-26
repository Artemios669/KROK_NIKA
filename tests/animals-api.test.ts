import {beforeEach,describe,expect,it,vi} from "vitest";
import {createClient} from "@supabase/supabase-js";

vi.mock("@/lib/supabase/server",()=>({getSupabase:vi.fn()}));
vi.mock("@/lib/supabase/animal-catalog",()=>({loadSupabaseAnimalCatalog:vi.fn()}));

import {GET} from "@/app/api/animals/route";
import {getSupabase} from "@/lib/supabase/server";
import {loadSupabaseAnimalCatalog} from "@/lib/supabase/animal-catalog";
import {animals as demoAnimals} from "@/lib/demo-data";

const client=createClient("https://example.supabase.co","test-anon-key");

describe("animal catalog API",()=>{
  beforeEach(()=>{
    vi.mocked(getSupabase).mockReturnValue(null);
    vi.mocked(loadSupabaseAnimalCatalog).mockReset();
  });

  it("uses demo data only when Supabase is not configured",async()=>{
    const response=await GET();
    const result=await response.json();

    expect(result.source).toBe("demo");
    expect(result.animals).toHaveLength(demoAnimals.length);
  });

  it("returns all eligible records from the configured imported catalog",async()=>{
    const animals=Array.from({length:428},(_,index)=>({
      ...demoAnimals[0],
      id:`imported-${index}`,
      name:`Питомец ${index}`,
    }));
    vi.mocked(getSupabase).mockReturnValue(client);
    vi.mocked(loadSupabaseAnimalCatalog).mockResolvedValue({
      animals,
      table:"animalsss",
      totalRecords:428,
      unconfirmedAvailability:0,
      unavailableRecords:0,
    });

    const response=await GET();
    const result=await response.json();

    expect(result.source).toBe("supabase");
    expect(result.idKind).toBe("text");
    expect(result.totalRecords).toBe(428);
    expect(result.eligibleRecords).toBe(428);
    expect(result.animals).toHaveLength(428);
  });

  it("reports excluded and unconfirmed imported records separately",async()=>{
    const records=[
      {...demoAnimals[0],id:"available-cat",type:"cat",adoption_available:true},
      {...demoAnimals[0],id:"unavailable-dog",adoption_available:false},
      {...demoAnimals[0],id:"unknown-type",type:"unknown",adoption_available:true},
      {...demoAnimals[0],id:"unknown-status",adoption_available:false},
    ];
    vi.mocked(getSupabase).mockReturnValue(client);
    vi.mocked(loadSupabaseAnimalCatalog).mockResolvedValue({
      animals:records,
      table:"animalsss",
      totalRecords:4,
      unconfirmedAvailability:1,
      unavailableRecords:1,
    });

    const response=await GET();
    const result=await response.json();

    expect(result.eligibleRecords).toBe(1);
    expect(result.unavailableRecords).toBe(1);
    expect(result.unsupportedTypeRecords).toBe(1);
    expect(result.unconfirmedAvailabilityRecords).toBe(1);
  });

  it("returns a database error instead of silently substituting demo records",async()=>{
    vi.mocked(getSupabase).mockReturnValue(client);
    vi.mocked(loadSupabaseAnimalCatalog).mockRejectedValue(new Error("relation missing"));

    const response=await GET();
    const result=await response.json();

    expect(response.status).toBe(502);
    expect(result.animals).toBeUndefined();
    expect(result.source).toBeUndefined();
  });
});
