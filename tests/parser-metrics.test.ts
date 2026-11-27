import {describe,expect,it} from "vitest";
import {scoreAnimalParserReview} from "@/evals/parser-metrics.mjs";

describe("animal parser review metrics",()=>{
  it("measures exact categorical fields and treats reviewed unknowns as true negatives",()=>{
    const result=scoreAnimalParserReview([
      {record_id:"1",predicted:{type:"собака"},expected:{type:"dog"},reviewed_fields:["type"]},
      {record_id:"2",predicted:{type:"cat"},expected:{type:null},reviewed_fields:["type"]},
      {record_id:"3",predicted:{type:null},expected:{type:null},reviewed_fields:["type"]},
    ]);

    expect(result.perField.type.exactMatches).toBe(2);
    expect(result.perField.type.reviewed).toBe(3);
    expect(result.perField.type.tp).toBe(1);
    expect(result.perField.type.fp).toBe(1);
    expect(result.perField.type.tn).toBe(1);
    expect(result.perField.type.exactAccuracy).toBeCloseTo(2/3);
  });

  it("scores multi-value fields by item-level precision and recall",()=>{
    const result=scoreAnimalParserReview([
      {
        record_id:"4",
        predicted:{character:["friendly","calm"]},
        expected:{character:["calm","playful"]},
        reviewed_fields:["character"],
      },
    ]);

    expect(result.perField.character.tokenTp).toBe(1);
    expect(result.perField.character.tokenFp).toBe(1);
    expect(result.perField.character.tokenFn).toBe(1);
    expect(result.perField.character.precision).toBe(0.5);
    expect(result.perField.character.recall).toBe(0.5);
  });

  it("counts omitted text predictions as false negatives",()=>{
    const result=scoreAnimalParserReview([
      {
        record_id:"6",
        predicted:{health_notes:null},
        expected:{health_notes:"нужно лечение у ветеринара"},
        reviewed_fields:["health_notes"],
      },
    ]);

    expect(result.perField.health_notes.tokenFn).toBeGreaterThan(0);
    expect(result.perField.health_notes.precision).toBe(0);
    expect(result.perField.health_notes.recall).toBe(0);
    expect(result.perField.health_notes.f1).toBe(0);
  });

  it("rejects reviewed fields without a gold value",()=>{
    expect(()=>scoreAnimalParserReview([
      {record_id:"5",predicted:{type:"dog"},expected:{},reviewed_fields:["type"]},
    ])).toThrow("Missing predicted or expected value");
  });
});
