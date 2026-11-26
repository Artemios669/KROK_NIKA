import {readFileSync} from "node:fs";
import {describe,expect,it} from "vitest";
import {animals,getAnimalCatalogSource} from "@/lib/demo-data";

const seedSql=readFileSync(new URL("../supabase/seed.sql",import.meta.url),"utf8");

describe("demo animal catalog",()=>{
  it("contains twenty distinct, clearly labeled demo animals",()=>{
    expect(animals).toHaveLength(20);
    expect(new Set(animals.map(animal=>animal.id)).size).toBe(20);
    expect(new Set(animals.map(animal=>animal.name)).size).toBe(20);
    expect(animals.every(animal=>/тест/i.test(animal.description))).toBe(true);
    expect(animals.filter(animal=>animal.type==="cat")).toHaveLength(11);
    expect(animals.filter(animal=>animal.type==="dog")).toHaveLength(9);
  });

  it("keeps the SQL seed catalog names and count aligned with the local demo catalog",()=>{
    const records=[...seedSql.matchAll(/^\(\s*'([0-9a-f-]{36})','([^']+)'/gm)];

    expect(records).toHaveLength(20);
    expect(new Set(records.map(([,id])=>id)).size).toBe(20);
    expect(records.map(([,id,name])=>({id,name})).map(record=>record.name))
      .toEqual(animals.map(animal=>animal.name));
  });

  it("keeps unknown compatibility unknown instead of converting it to false",()=>{
    expect(animals.find(animal=>animal.id==="ryzhik")?.good_with_cats).toBeNull();
    expect(animals.find(animal=>animal.id==="mira")?.good_with_cats).toBeNull();
    expect(animals.find(animal=>animal.id==="demo-2")?.health_notes).toContain("диагноз не указан");
  });

  it("distinguishes test-only, shelter-only, and mixed catalogs",()=>{
    expect(getAnimalCatalogSource(animals)).toBe("demo");
    expect(getAnimalCatalogSource([{description:"Карточка приюта"}])).toBe("supabase");
    expect(getAnimalCatalogSource([
      animals[0],
      {description:"Карточка приюта"},
    ])).toBe("mixed");
  });
});
