import {describe,expect,it} from "vitest";
import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import cases from "@/evals/fixtures/chat-cases.json";
import {extractProfileFacts} from "@/lib/chat/demo";
import {emptyProfile} from "@/types/user";
import {ChatTopic} from "@/lib/chat/progress";

function getPath(target:unknown,path:string):unknown {
  return path.split(".").reduce<unknown>((value,key)=>{
    if(typeof value!=="object"||value===null)return undefined;
    return (value as Record<string,unknown>)[key];
  },target);
}

function evaluateCases() {
  const perField:Record<string,{checked:number;correct:number}>={};
  const results=cases.map(testCase=>{
    const profile=extractProfileFacts(
      testCase.message,
      structuredClone(emptyProfile),
      testCase.currentTopic as ChatTopic,
    );
    const fields=Object.entries(testCase.expectedExtracted).map(([field,expected])=>{
      const actual=getPath(profile,field);
      const pass=JSON.stringify(actual)===JSON.stringify(expected);
      perField[field]??={checked:0,correct:0};
      perField[field].checked++;
      if(pass)perField[field].correct++;
      return {field,expected,actual,pass};
    });
    return {
      id:testCase.id,
      fields,
      correct:fields.filter(field=>field.pass).length,
      checked:fields.length,
    };
  });
  const checked=results.reduce((total,result)=>total+result.checked,0);
  const correct=results.reduce((total,result)=>total+result.correct,0);
  return {
    generatedAt:new Date().toISOString(),
    cases:results.length,
    expectedFacts:checked,
    correctFacts:correct,
    exactFactAccuracy:checked?correct/checked:null,
    perField:Object.fromEntries(Object.entries(perField).map(([field,counts])=>[
      field,{...counts,exactAccuracy:counts.correct/counts.checked},
    ])),
    results,
  };
}

describe("chat fact extraction eval fixtures",()=>{
  it.each(cases)("$id",testCase=>{
    const result=extractProfileFacts(
      testCase.message,
      structuredClone(emptyProfile),
      testCase.currentTopic as ChatTopic,
    );
    for(const [field,expected] of Object.entries(testCase.expectedExtracted)) {
      expect(getPath(result,field),field).toEqual(expected);
    }
  });

  it("reports aggregate extraction accuracy for the fixed fixture set",async()=>{
    const report=evaluateCases();
    expect(report.exactFactAccuracy).toBe(1);
    if(process.env.CHAT_EVAL_WRITE_REPORT==="1") {
      await mkdir("eval-results",{recursive:true});
      const output=path.resolve("eval-results/chat-offline.json");
      await writeFile(output,`${JSON.stringify(report,null,2)}\n`,"utf8");
      console.log(`Offline chat eval report: ${output}`);
    }
  });
});
