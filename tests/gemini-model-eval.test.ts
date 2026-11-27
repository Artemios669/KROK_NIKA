import {mkdir,writeFile} from "node:fs/promises";
import path from "node:path";
import {describe,expect,it,vi} from "vitest";
import cases from "@/evals/fixtures/chat-cases.json";
import {askGemini} from "@/lib/ai/gemini";
import {ChatTopic} from "@/lib/chat/progress";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile} from "@/types/user";

type ModelEvalField={field:string;expected:unknown;actual:unknown;pass:boolean};
type ModelEvalCase={
  id:string;
  fields:ModelEvalField[];
  correct:number;
  checked:number;
  assistantMessage:string;
  modelProfile:ReturnType<typeof userProfileSchema.parse>;
};

vi.mock("server-only",()=>({}));

function profileFor(template:string) {
  const profile=structuredClone(emptyProfile);
  if(template==="empty")return userProfileSchema.parse(profile);
  profile.housing.type="квартира";
  profile.household.children=0;
  profile.household.other_animals_confirmed=true;
  profile.lifestyle.hours_away_daily=8;
  if(template==="family-complete")return userProfileSchema.parse(profile);
  profile.preferences.animal_type="dog";
  if(template==="requirements-complete")return userProfileSchema.parse(profile);
  if(template==="experience-followup") {
    profile.experience.has_pet_experience=true;
    return userProfileSchema.parse(profile);
  }
  if(template==="experience-unknown")return userProfileSchema.parse(profile);
  profile.experience.has_pet_experience=false;
  profile.lifestyle.activity_level="low";
  profile.preferences.activity="low";
  if(template==="readiness-unknown")return userProfileSchema.parse(profile);
  throw new Error(`Unknown profile template: ${template}`);
}

function getPath(target:unknown,pathToValue:string):unknown {
  return pathToValue.split(".").reduce<unknown>((value,key)=>{
    if(typeof value!=="object"||value===null)return undefined;
    return (value as Record<string,unknown>)[key];
  },target);
}

function normalizeHistoryRole(role:string):"assistant"|"user" {
  if(role==="assistant"||role==="user")return role;
  throw new Error(`Invalid history role: ${role}`);
}

function normalizeValue(field:string,value:unknown) {
  if(value===null||value===undefined)return null;
  if(field==="housing.type"&&typeof value==="string") {
    const text=value.toLocaleLowerCase("ru").replace(/ё/g,"е");
    if(/квартир/.test(text))return "квартира";
    if(/дом|коттедж/.test(text))return "дом";
  }
  if(field==="household.other_animals"&&Array.isArray(value)) {
    return [...value].map(item=>String(item).toLocaleLowerCase("ru").replace(/ё/g,"е")).sort();
  }
  if(typeof value==="string")return value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/\s+/g," ");
  return value;
}

function wilsonInterval(successes:number,total:number) {
  if(total===0)return null;
  const z=1.96;
  const proportion=successes/total;
  const denominator=1+z*z/total;
  const center=(proportion+z*z/(2*total))/denominator;
  const margin=z*Math.sqrt((proportion*(1-proportion)+z*z/(4*total))/total)/denominator;
  return [Math.max(0,center-margin),Math.min(1,center+margin)];
}

describe("Gemini model-only eval",()=>{
  it.skipIf(process.env.GEMINI_EVAL_LIVE!=="1")("scores raw model outputs against synthetic cases",async()=>{
    if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY is required for model-only eval.");
    const results:ModelEvalCase[]=[];
    const model=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
    const generatedAt=new Date().toISOString();
    const output=path.resolve("eval-results/chat-model-only.json");
    const saveReport=async(status:"in_progress"|"complete")=>{
      const expectedFacts=results.reduce((total,result)=>total+result.checked,0);
      const correctFacts=results.reduce((total,result)=>total+result.correct,0);
      const perField:Record<string,{checked:number;correct:number}>={};
      for(const result of results) {
        for(const field of result.fields) {
          perField[field.field]??={checked:0,correct:0};
          perField[field.field].checked++;
          if(field.pass)perField[field.field].correct++;
        }
      }
      const report={
        generatedAt,
        model,
        evaluation:"raw Gemini output before deterministic extraction, profile merge, and server-selected next question",
        goldSet:"Manually annotated expectedModel fields for synthetic Russian chat cases; small pilot, not representative.",
        scoring:"Exact profile-field comparison with canonical housing labels.",
        status,
        completedCases:results.length,
        totalCases:cases.length,
        expectedFacts,
        correctFacts,
        exactFactAccuracy:expectedFacts?correctFacts/expectedFacts:null,
        exactFactAccuracy95:wilsonInterval(correctFacts,expectedFacts),
        perField:Object.fromEntries(Object.entries(perField).map(([field,counts])=>[
          field,{...counts,exactAccuracy:counts.correct/counts.checked},
        ])),
        results,
      };
      await mkdir("eval-results",{recursive:true});
      await writeFile(output,`${JSON.stringify(report,null,2)}\n`,"utf8");
    };

    for(const testCase of cases) {
      const expectedProfile={...testCase.expectedExtracted,...(testCase.expectedProfile||{})};
      const modelExpected=testCase.expectedModel||expectedProfile;
      const history=(testCase.history||[]).map(item=>{
        return {role:normalizeHistoryRole(item.role),text:item.text};
      });
      const response=await askGemini(
        testCase.message,
        profileFor(testCase.profileTemplate),
        history,
        testCase.currentTopic as ChatTopic,
        [],
        false,
      );
      if(!response)throw new Error(`Gemini returned no result for ${testCase.id}.`);
      const fields=Object.entries(modelExpected).map(([field,expected])=>{
        const actual=getPath(response.profile,field);
        return {field,expected,actual,pass:JSON.stringify(normalizeValue(field,actual))===JSON.stringify(normalizeValue(field,expected))};
      });
      results.push({
        id:testCase.id,
        fields,
        correct:fields.filter(field=>field.pass).length,
        checked:fields.length,
        assistantMessage:response.message,
        modelProfile:response.profile,
      });
      await saveReport("in_progress");
      console.log(`${testCase.id}: ${fields.filter(field=>field.pass).length}/${fields.length} expected facts`);
    }

    await saveReport("complete");
    console.log(`Model-only eval report: ${output}`);
    expect(results).toHaveLength(cases.length);
  },120_000);
});
