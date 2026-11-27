import {readFile,writeFile} from "node:fs/promises";

const reportPath="eval-results/chat-model-only.json";
const report=JSON.parse(await readFile(reportPath,"utf8"));
const cases=JSON.parse(await readFile("evals/fixtures/chat-cases.json","utf8"));
if(report.status!=="complete")throw new Error("Cannot score an incomplete Gemini run.");

function getPath(target,path) {
  return path.split(".").reduce((value,key)=>value?.[key],target);
}

function normalizeValue(field,value) {
  if(value===null||value===undefined)return null;
  if(field==="housing.type"&&typeof value==="string") {
    const text=value.toLocaleLowerCase("ru").replace(/ё/g,"е");
    if(/квартир/.test(text))return "квартира";
    if(/дом|коттедж/.test(text))return "дом";
  }
  if(field==="household.other_animals"&&Array.isArray(value)) {
    return [...value].map(item=>String(item).toLocaleLowerCase("ru").replace(/ё/g,"е")).sort();
  }
  if(typeof value==="string") {
    return value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/\s+/g," ");
  }
  return value;
}

function wilsonInterval(successes,total) {
  if(total===0)return null;
  const z=1.96;
  const proportion=successes/total;
  const denominator=1+z*z/total;
  const center=(proportion+z*z/(2*total))/denominator;
  const margin=z*Math.sqrt((proportion*(1-proportion)+z*z/(4*total))/total)/denominator;
  return [Math.max(0,center-margin),Math.min(1,center+margin)];
}

const runCases=new Map(report.results.map(result=>[result.id,result]));
const results=cases.map(testCase=>{
  const runCase=runCases.get(testCase.id);
  if(!runCase)throw new Error(`Missing Gemini result for ${testCase.id}.`);
  const fields=Object.entries(testCase.expectedModel).map(([field,expected])=>{
    const actual=runCase.modelProfile
      ?getPath(runCase.modelProfile,field)
      :runCase.fields.find(item=>item.field===field)?.actual;
    if(actual===undefined)throw new Error(`Missing Gemini output for ${testCase.id}.${field}.`);
    return {
      field,
      expected,
      actual,
      pass:JSON.stringify(normalizeValue(field,actual))===JSON.stringify(normalizeValue(field,expected)),
    };
  });
  return {
    id:testCase.id,
    fields,
    correct:fields.filter(field=>field.pass).length,
    checked:fields.length,
    assistantMessage:runCase.assistantMessage,
    modelProfile:runCase.modelProfile,
  };
});

const expectedFacts=results.reduce((total,result)=>total+result.checked,0);
const correctFacts=results.reduce((total,result)=>total+result.correct,0);
const perField={};
for(const result of results) {
  for(const field of result.fields) {
    perField[field.field]??={checked:0,correct:0};
    perField[field.field].checked++;
    if(field.pass)perField[field.field].correct++;
  }
}

const scoredReport={
  ...report,
  scoredAt:new Date().toISOString(),
  goldSet:"Manually annotated expectedModel fields for synthetic Russian chat cases; small pilot, not representative.",
  scoring:"Manual expectedModel labels; housing variants normalized to canonical house/apartment values.",
  expectedFacts,
  correctFacts,
  exactFactAccuracy:expectedFacts?correctFacts/expectedFacts:null,
  exactFactAccuracy95:wilsonInterval(correctFacts,expectedFacts),
  perField:Object.fromEntries(Object.entries(perField).map(([field,counts])=>[
    field,{...counts,exactAccuracy:counts.correct/counts.checked},
  ])),
  results,
};
await writeFile(reportPath,`${JSON.stringify(scoredReport,null,2)}\n`,"utf8");
console.log(JSON.stringify({
  model:scoredReport.model,
  cases:scoredReport.completedCases,
  facts:`${correctFacts}/${expectedFacts}`,
  exactFactAccuracy:scoredReport.exactFactAccuracy,
  mismatches:results.flatMap(result=>result.fields.filter(field=>!field.pass).map(field=>({
    case:result.id,field:field.field,expected:field.expected,actual:field.actual,
  }))),
},null,2));
