import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";

const apiUrl=new URL(process.env.CHAT_EVAL_URL||"http://localhost:3000/api/chat");
if(!["localhost","127.0.0.1","::1"].includes(apiUrl.hostname)) {
  throw new Error("Live eval is restricted to a local chat API. Use localhost or 127.0.0.1.");
}
if(!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is missing. Live eval does not run in demo mode.");
}

const cases=JSON.parse(await readFile("evals/fixtures/chat-cases.json","utf8"));
const emptyProfile={
  housing:{type:null,size:null,living_conditions:null,yard_available:null},
  household:{adults:null,children:null,children_ages:[],other_animals:[],other_animals_confirmed:null},
  lifestyle:{works_full_time:null,hours_away_daily:null,activity_level:null,walks_per_day:null},
  experience:{has_pet_experience:null,care_experience:null},
  preferences:{animal_type:null,preferred_size:null,preferred_age:null,activity:null,character:[],colors:[]},
  readiness:{special_care:null,financial_readiness_confirmed:null},
  missing_fields:["условия проживания","семья и другие животные","время отсутствия дома","предпочтительный тип питомца"],
  completed:false,
};

function profileFor(template) {
  const profile=structuredClone(emptyProfile);
  if(template==="empty")return profile;
  profile.housing.type="квартира";
  profile.household.children=0;
  profile.household.other_animals_confirmed=true;
  profile.lifestyle.hours_away_daily=8;
  if(template==="family-complete")return profile;
  profile.preferences.animal_type="dog";
  if(template==="requirements-complete")return profile;
  if(template==="experience-followup") {
    profile.experience.has_pet_experience=true;
    return profile;
  }
  if(template==="experience-unknown")return profile;
  profile.experience.has_pet_experience=false;
  profile.lifestyle.activity_level="low";
  profile.preferences.activity="low";
  if(template==="readiness-unknown")return profile;
  throw new Error(`Unknown profile template: ${template}`);
}

function getPath(target,pathToValue) {
  return pathToValue.split(".").reduce((value,key)=>value?.[key],target);
}

const results=[];
for(const testCase of cases) {
  const response=await fetch(apiUrl,{
    method:"POST",
    headers:{"Content-Type":"application/json","x-forwarded-for":"127.0.0.1"},
    body:JSON.stringify({
      message:testCase.message,
      profile:profileFor(testCase.profileTemplate),
      currentTopic:testCase.currentTopic,
      history:testCase.history||[],
    }),
  });
  const body=await response.json();
  if(!response.ok) {
    throw new Error(`Case ${testCase.id} failed with HTTP ${response.status}: ${body.error||"unknown API error"}`);
  }
  if(body.mode!=="gemini") {
    throw new Error(`Case ${testCase.id} returned mode "${body.mode||"unknown"}"; live eval requires Gemini, not demo mode.`);
  }

  const expectedProfile={...testCase.expectedExtracted,...(testCase.expectedProfile||{})};
  const fieldResults=Object.entries(expectedProfile).map(([field,expected])=>{
    const actual=getPath(body.profile,field);
    return {field,expected,actual,pass:JSON.stringify(actual)===JSON.stringify(expected)};
  });
  const nextTopicPass=testCase.expectedNextTopic===undefined||body.progress?.nextTopic===testCase.expectedNextTopic;
  const replyContainsPass=!testCase.replyMustContain||body.message?.toLocaleLowerCase("ru").includes(testCase.replyMustContain.toLocaleLowerCase("ru"));
  const forbiddenPhrases=testCase.replyMustNotContain||[];
  const replyExclusionPass=forbiddenPhrases.every(phrase=>!body.message?.toLocaleLowerCase("ru").includes(phrase.toLocaleLowerCase("ru")));
  results.push({
    id:testCase.id,
    mode:body.mode,
    expectedNextTopic:testCase.expectedNextTopic??null,
    actualNextTopic:body.progress?.nextTopic??null,
    nextTopicPass,
    replyMustContain:testCase.replyMustContain??null,
    replyContainsPass,
    replyMustNotContain:forbiddenPhrases,
    replyExclusionPass,
    fields:fieldResults,
    fieldAccuracy:fieldResults.length?fieldResults.filter(field=>field.pass).length/fieldResults.length:null,
    message:body.message,
  });
  console.log(`${testCase.id}: ${fieldResults.filter(field=>field.pass).length}/${fieldResults.length} expected facts; next topic ${nextTopicPass?"OK":"MISMATCH"}`);
}

const allFields=results.flatMap(result=>result.fields);
const allChecksPass=results.every(result=>
  result.fields.every(field=>field.pass)&&
  result.nextTopicPass&&
  result.replyContainsPass&&
  result.replyExclusionPass,
);
const perField={};
for(const field of allFields) {
  perField[field.field]??={checked:0,correct:0};
  perField[field.field].checked++;
  if(field.pass)perField[field.field].correct++;
}
for(const counts of Object.values(perField))counts.exactAccuracy=counts.correct/counts.checked;
const report={
  generatedAt:new Date().toISOString(),
  endpoint:apiUrl.toString(),
  cases:results.length,
  modeCounts:Object.fromEntries([...new Set(results.map(result=>result.mode))].map(mode=>[mode,results.filter(result=>result.mode===mode).length])),
  expectedFactCount:allFields.length,
  expectedFactAccuracy:allFields.length?allFields.filter(field=>field.pass).length/allFields.length:null,
  perField,
  nextTopicAccuracy:results.filter(result=>result.expectedNextTopic!==null).length
    ?results.filter(result=>result.expectedNextTopic!==null&&result.nextTopicPass).length/results.filter(result=>result.expectedNextTopic!==null).length
    :null,
  replyConstraintPasses:results.filter(result=>result.replyMustContain!==null).length
    ?results.filter(result=>result.replyMustContain!==null&&result.replyContainsPass).length/results.filter(result=>result.replyMustContain!==null).length
    :null,
  replyExclusionPasses:results.filter(result=>result.replyMustNotContain.length>0).length
    ?results.filter(result=>result.replyMustNotContain.length>0&&result.replyExclusionPass).length/results.filter(result=>result.replyMustNotContain.length>0).length
    :null,
  allChecksPass,
  results,
};

await mkdir("eval-results",{recursive:true});
await writeFile("eval-results/chat-live.json",`${JSON.stringify(report,null,2)}\n`,"utf8");
console.log(`Report saved to ${path.resolve("eval-results/chat-live.json")}`);
if(process.argv.includes("--strict")&&!allChecksPass)process.exitCode=1;
