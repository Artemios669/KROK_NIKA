import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {describe,expect,it,vi} from "vitest";
import baseCasesJson from "@/evals/fixtures/chat-cases.json";
import criteriaFixtureJson from "@/evals/fixtures/chat-criteria-cases.json";
import {askGemini} from "@/lib/ai/gemini";
import {chatTopicSchema} from "@/lib/chat/progress";
import {userProfileSchema} from "@/lib/validation/profile";
import {emptyProfile} from "@/types/user";
import {z} from "zod";

vi.mock("server-only",()=>({}));

const profileTemplateSchema=z.enum([
  "empty",
  "family-complete",
  "requirements-complete",
  "experience-followup",
  "experience-unknown",
  "readiness-unknown",
]);
const historyItemSchema=z.object({
  role:z.enum(["assistant","user"]),
  text:z.string(),
});
const modelCaseSchema=z.object({
  id:z.string(),
  message:z.string(),
  currentTopic:chatTopicSchema.optional(),
  profileTemplate:profileTemplateSchema,
  profileOverrides:z.record(z.string(),z.unknown()).optional(),
  history:z.array(historyItemSchema).optional(),
  expectedModel:z.record(z.string(),z.unknown()).optional(),
  expectedExtracted:z.record(z.string(),z.unknown()).optional(),
  expectedProfile:z.record(z.string(),z.unknown()).optional(),
  categoryFields:z.array(z.string()).optional(),
  mustRemainUnknown:z.array(z.string()).optional(),
  noUnsupportedFacts:z.array(z.string()).optional(),
  mustNotInfer:z.array(z.string()).optional(),
});
const apiCaseSchema=modelCaseSchema.extend({
  expectedNextTopic:chatTopicSchema,
  questionMustContainAny:z.array(z.string()).min(1),
  unresolvedField:z.string(),
  unresolvedFieldMustNotContainAny:z.array(z.string()).optional(),
  excludeFromAi04:z.boolean().optional(),
  ai04ExclusionReason:z.string().optional(),
});
const repeatSchema=z.object({id:z.string(),repeatOf:z.string()});
const savedCheckSchema=z.object({
  field:z.string(),
  pass:z.boolean(),
  expected:z.unknown().optional(),
  actual:z.unknown().optional(),
});
const savedResultSchema=z.object({
  id:z.string(),
  kind:z.enum(["model","stability","api"]),
  schemaValid:z.boolean(),
  profile:userProfileSchema.nullable(),
  assistantMessage:z.string().optional(),
  fieldChecks:z.array(savedCheckSchema).optional(),
  categoryChecks:z.array(savedCheckSchema).optional(),
  unsupportedChecks:z.array(savedCheckSchema).optional(),
  unknownChecks:z.array(savedCheckSchema).optional(),
  inferenceChecks:z.array(savedCheckSchema).optional(),
  stabilityPass:z.boolean().optional(),
  clarificationChecks:z.array(savedCheckSchema).optional(),
  error:z.string().optional(),
});
const savedReportSchema=z.object({
  model:z.string(),
  generatedAt:z.string(),
  failedAttempts:z.number().optional(),
  results:z.array(savedResultSchema),
});
const criteriaFixtureSchema=z.object({
  additionalModelCases:z.array(modelCaseSchema),
  selectedModelCaseIds:z.array(z.string()),
  apiClarificationCases:z.array(apiCaseSchema),
  stabilityRepeats:z.array(repeatSchema),
});

type ModelCase=z.infer<typeof modelCaseSchema>;
type ApiCase=z.infer<typeof apiCaseSchema>;
type Profile=ReturnType<typeof userProfileSchema.parse>;
type Check={
  field:string;
  pass:boolean;
  expected?:unknown;
  actual?:unknown;
};
type EvalResult={
  id:string;
  kind:"model"|"stability"|"api";
  schemaValid:boolean;
  profile:Profile|null;
  assistantMessage?:string;
  fieldChecks?:Check[];
  categoryChecks?:Check[];
  unsupportedChecks?:Check[];
  unknownChecks?:Check[];
  inferenceChecks?:Check[];
  stabilityPass?:boolean;
  clarificationChecks?:Check[];
  error?:string;
};

const baseCases=z.array(modelCaseSchema).parse(baseCasesJson);
const criteriaFixture=criteriaFixtureSchema.parse(criteriaFixtureJson);
const candidateById=new Map(criteriaFixture.additionalModelCases.map(testCase=>[testCase.id,testCase]));
const selectedCases=criteriaFixture.selectedModelCaseIds.map(id=>{
  const testCase=candidateById.get(id);
  if(!testCase)throw new Error(`Selected model case not found: ${id}`);
  return testCase;
});
const modelCases=[...baseCases,...selectedCases];
const modelCaseById=new Map(modelCases.map(testCase=>[testCase.id,testCase]));
const apiCaseById=new Map(criteriaFixture.apiClarificationCases.map(testCase=>[testCase.id,testCase]));
const scoredApiCaseIds=new Set(criteriaFixture.apiClarificationCases
  .filter(testCase=>!testCase.excludeFromAi04)
  .map(testCase=>testCase.id));
const output=path.resolve("eval-results/chat-criteria.json");
const apiUrl=new URL(process.env.CHAT_EVAL_URL||"http://localhost:3000/api/chat");
const modelName=process.env.GEMINI_MODEL||"gemini-3.5-flash-lite";
const delayMs=Number(process.env.CHAT_EVAL_DELAY_MS||6500);

function isRecord(value:unknown):value is Record<string,unknown> {
  return typeof value==="object"&&value!==null&&!Array.isArray(value);
}

function mergeRecords(target:unknown,source:unknown):unknown {
  if(!isRecord(target)||!isRecord(source))return structuredClone(source);
  const merged:Record<string,unknown>={...target};
  for(const [key,value] of Object.entries(source)) {
    merged[key]=Object.hasOwn(merged,key)?mergeRecords(merged[key],value):structuredClone(value);
  }
  return merged;
}

function profileFor(testCase:Pick<ModelCase,"profileTemplate"|"profileOverrides">):Profile {
  const profile=structuredClone(emptyProfile);
  if(testCase.profileTemplate!=="empty") {
    profile.housing.type="квартира";
    profile.household.children=0;
    profile.household.other_animals_confirmed=true;
    profile.lifestyle.hours_away_daily=8;
  }
  if(testCase.profileTemplate==="requirements-complete"||
    testCase.profileTemplate==="experience-followup"||
    testCase.profileTemplate==="experience-unknown"||
    testCase.profileTemplate==="readiness-unknown") {
    profile.preferences.animal_type="dog";
  }
  if(testCase.profileTemplate==="experience-followup")profile.experience.has_pet_experience=true;
  if(testCase.profileTemplate==="readiness-unknown") {
    profile.experience.has_pet_experience=false;
    profile.lifestyle.activity_level="low";
    profile.preferences.activity="low";
  }
  return userProfileSchema.parse(mergeRecords(profile,testCase.profileOverrides||{}));
}

function getPath(target:unknown,pathToValue:string):unknown {
  return pathToValue.split(".").reduce<unknown>((value,key)=>{
    return isRecord(value)?value[key]:undefined;
  },target);
}

function normalizeAnimal(value:string) {
  const normalized=value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е");
  if(/кошк|кот/.test(normalized))return "кошка";
  if(/собак|пес/.test(normalized))return "собака";
  return normalized;
}

function normalizeValue(field:string,value:unknown):unknown {
  if(value===null||value===undefined)return null;
  if(field==="housing.type"&&typeof value==="string") {
    const text=value.toLocaleLowerCase("ru").replace(/ё/g,"е");
    if(/квартир|apartment|flat/.test(text))return "квартира";
    if(/дом|коттедж|house|cottage/.test(text))return "дом";
  }
  if(field==="household.other_animals"&&Array.isArray(value)) {
    return value.map(item=>normalizeAnimal(String(item))).sort();
  }
  if(typeof value==="string")return value.trim().toLocaleLowerCase("ru").replace(/ё/g,"е").replace(/\s+/g," ");
  return value;
}

function isUnknown(value:unknown) {
  return value===null||value===undefined||value===""||(Array.isArray(value)&&value.length===0);
}

function scoreModelCase(testCase:ModelCase,profile:Profile) {
  const expected=modelExpected(testCase);
  const fieldChecks=Object.entries(expected).map(([field,value])=>{
    const actual=getPath(profile,field);
    return {field,expected:value,actual,pass:equalValues(field,actual,value)};
  });
  const categoryChecks=(testCase.categoryFields||[]).map(field=>{
    const expectedValue=expected[field];
    const actual=getPath(profile,field);
    return {field,expected:expectedValue,actual,pass:equalValues(field,actual,expectedValue)};
  });
  const checksFor=(fields:string[]|undefined)=> (fields||[]).map(field=>{
    const actual=getPath(profile,field);
    return {field,actual,pass:isUnknown(actual)};
  });
  return {
    fieldChecks,
    categoryChecks,
    unsupportedChecks:checksFor(testCase.noUnsupportedFacts),
    unknownChecks:checksFor(testCase.mustRemainUnknown),
    inferenceChecks:checksFor(testCase.mustNotInfer),
  };
}

function scoreApiClarification(
  testCase:ApiCase,
  profile:Profile,
  actualMode:unknown,
  actualTopic:unknown,
  message:string,
):Check[] {
  const unresolved=getPath(profile,testCase.unresolvedField);
  const messageLower=message.toLocaleLowerCase("ru");
  const isQuestion=/[?？]/.test(message);
  const questionMatches=isQuestion&&testCase.questionMustContainAny.some(value=>{
    return messageLower.includes(value.toLocaleLowerCase("ru"));
  });
  const unresolvedPass=testCase.unresolvedFieldMustNotContainAny
    ?typeof unresolved!=="string"||!testCase.unresolvedFieldMustNotContainAny.some(value=>{
      return unresolved.toLocaleLowerCase("ru").includes(value.toLocaleLowerCase("ru"));
    })
    :isUnknown(unresolved);
  return [
    {field:"mode",expected:"gemini",actual:actualMode,pass:actualMode==="gemini"},
    {field:"progress.nextTopic",expected:testCase.expectedNextTopic,actual:actualTopic,pass:actualTopic===testCase.expectedNextTopic},
    {field:"questionMustContainAny",expected:testCase.questionMustContainAny,actual:message,pass:questionMatches},
    {
      field:testCase.unresolvedField,
      expected:testCase.unresolvedFieldMustNotContainAny?"no matching detail":"unknown",
      actual:unresolved,
      pass:unresolvedPass,
    },
  ];
}

function equalValues(field:string,actual:unknown,expected:unknown) {
  return JSON.stringify(normalizeValue(field,actual))===JSON.stringify(normalizeValue(field,expected));
}

function modelExpected(testCase:ModelCase) {
  return testCase.expectedModel??{
    ...(testCase.expectedExtracted||{}),
    ...(testCase.expectedProfile||{}),
  };
}

function historyFor(testCase:ModelCase) {
  return (testCase.history||[]).map(item=>({role:item.role,text:item.text}));
}

function stableProfile(profile:Profile) {
  const copy=structuredClone(profile);
  copy.household.children_ages.sort((left,right)=>left-right);
  copy.household.other_animals=copy.household.other_animals.map(normalizeAnimal).sort();
  copy.preferences.character.sort();
  copy.preferences.colors.sort();
  copy.missing_fields.sort();
  const housingType=normalizeValue("housing.type",copy.housing.type);
  if(typeof housingType==="string"||housingType===null)copy.housing.type=housingType;
  if(copy.experience.care_experience!==null) {
    copy.experience.care_experience=copy.experience.care_experience
      .toLocaleLowerCase("ru")
      .replace(/ё/g,"е")
      .replace(/[.,!?;:]/g,"")
      .replace(/^раньше\s+/,"")
      .replace(/\s+/g," ")
      .trim();
  }
  return JSON.stringify(copy);
}

function errorText(error:unknown) {
  const message=error instanceof Error?error.message:String(error);
  const key=process.env.GEMINI_API_KEY;
  return key?message.split(key).join("[redacted API key]"):message;
}

const criterionDefinitions=[
  {id:"AI-01",name:"Извлечение информации",description:"Точное сравнение размеченных полей в 50 уникальных ответах Gemini.",select:(result:EvalResult)=>result.fieldChecks||[]},
  {id:"AI-02",name:"Структурирование JSON",description:"Профиль ответа проходит Zod-схему.",select:(result:EvalResult)=>[{pass:result.schemaValid}]},
  {id:"AI-03",name:"Отсутствие галлюцинаций",description:"Не заполнены поля, для которых в сценарии нет подтверждения.",select:(result:EvalResult)=>result.unsupportedChecks||[]},
  {id:"AI-04",name:"Обработка неоднозначности",description:"В девяти неоднозначных сценариях /api/chat оставляет поле неизвестным и задаёт релевантный вопрос.",select:(result:EvalResult)=>scoredApiCaseIds.has(result.id)?result.clarificationChecks||[]:[]},
  {id:"AI-05",name:"Корректность параметров",description:"Точные значения отдельно размеченных категориальных полей.",select:(result:EvalResult)=>result.categoryChecks||[]},
  {id:"AI-06",name:"Работа с пропусками",description:"Неизвестные значения остаются null или пустым списком.",select:(result:EvalResult)=>result.unknownChecks||[]},
  {id:"AI-07",name:"Соблюдение ограничений",description:"Модель не выводит дополнительные факты, прямо запрещённые сценарием.",select:(result:EvalResult)=>result.inferenceChecks||[]},
  {id:"AI-08",name:"Стабильность",description:"Профиль в повторном запросе совпадает с исходным, без сравнения свободного текста.",select:(result:EvalResult)=>result.kind==="stability"?[{pass:result.stabilityPass===true}]:[]},
];

function summarize(results:EvalResult[]) {
  return criterionDefinitions.map(criterion=>{
    const checks=results.flatMap(criterion.select);
    const passed=checks.filter(check=>check.pass).length;
    return {
      id:criterion.id,
      criterion:criterion.name,
      description:criterion.description,
      passed,
      total:checks.length,
      rate:checks.length?passed/checks.length:null,
    };
  });
}

function responseMetric(results:EvalResult[]) {
  const checks=results.filter(result=>result.kind==="model"||result.kind==="stability"||result.kind==="api");
  return {passed:checks.filter(result=>result.schemaValid).length,total:checks.length};
}

describe("Gemini criteria eval",()=>{
  it("defines exactly 70 calls across 50 model cases, 10 API checks, and 10 repeats",()=>{
    const allCandidateIds=criteriaFixture.additionalModelCases.map(testCase=>testCase.id);
    const repeatedIds=criteriaFixture.stabilityRepeats.map(testCase=>testCase.repeatOf);
    const availableIds=new Set([...baseCases,...criteriaFixture.additionalModelCases].map(testCase=>testCase.id));
    expect(new Set(allCandidateIds).size).toBe(allCandidateIds.length);
    expect(new Set(criteriaFixture.selectedModelCaseIds).size).toBe(41);
    expect(new Set(modelCases.map(testCase=>testCase.id)).size).toBe(50);
    expect(criteriaFixture.apiClarificationCases).toHaveLength(10);
    expect(criteriaFixture.stabilityRepeats).toHaveLength(10);
    expect(scoredApiCaseIds.size).toBe(9);
    expect(repeatedIds.every(id=>availableIds.has(id))).toBe(true);
    expect(modelCases.length+criteriaFixture.apiClarificationCases.length+criteriaFixture.stabilityRepeats.length).toBe(70);
  });

  it("compares semantic housing and care-text variants as stable",()=>{
    const first=structuredClone(emptyProfile);
    first.housing.type="квартира";
    first.experience.care_experience="ухаживала за кошкой";
    const repeat=structuredClone(first);
    repeat.housing.type="apartment";
    repeat.experience.care_experience="Раньше ухаживала за кошкой.";
    expect(stableProfile(userProfileSchema.parse(first))).toBe(stableProfile(userProfileSchema.parse(repeat)));
  });

  it.skipIf(process.env.GEMINI_EVAL_CRITERIA!=="1")("runs the 70-call evaluation and saves criterion scores",async()=>{
    if(!process.env.GEMINI_API_KEY)throw new Error("GEMINI_API_KEY is required for the criteria eval.");
    if(!["localhost","127.0.0.1","::1"].includes(apiUrl.hostname)) {
      throw new Error("Live criteria eval is restricted to localhost or 127.0.0.1.");
    }
    if(!Number.isFinite(delayMs)||delayMs<0)throw new Error("CHAT_EVAL_DELAY_MS must be a non-negative number.");
    const results:EvalResult[]=[];
    let generatedAt=new Date().toISOString();
    let failedAttempts=0;
    let status:"in_progress"|"complete"|"failed"="in_progress";
    let failure:string|undefined;

    if(process.env.CHAT_EVAL_RESUME==="1") {
      let savedContents:string;
      try {
        savedContents=await readFile(output,"utf8");
      } catch(error) {
        if(isRecord(error)&&error.code==="ENOENT")throw new Error(`No checkpoint found to resume at ${output}.`);
        throw error;
      }
      const savedReport=savedReportSchema.parse(JSON.parse(savedContents));
      if(savedReport.model!==modelName)throw new Error(`Checkpoint model "${savedReport.model}" differs from configured model "${modelName}".`);
      generatedAt=savedReport.generatedAt;
      failedAttempts=savedReport.failedAttempts??savedReport.results.filter(result=>result.error).length;
      results.push(...savedReport.results.filter(result=>result.profile!==null&&result.error===undefined));
      for(const result of results) {
        if(!result.profile)continue;
        if(result.kind==="model") {
          const testCase=modelCaseById.get(result.id);
          if(testCase)Object.assign(result,scoreModelCase(testCase,result.profile));
        }
        if(result.kind==="api") {
          const testCase=apiCaseById.get(result.id);
          if(testCase) {
            const priorChecks=result.clarificationChecks||[];
            const actualMode=priorChecks.find(check=>check.field==="mode")?.actual;
            const actualTopic=priorChecks.find(check=>check.field==="progress.nextTopic")?.actual;
            result.clarificationChecks=scoreApiClarification(
              testCase,
              result.profile,
              actualMode,
              actualTopic,
              result.assistantMessage||"",
            );
          }
        }
        if(result.kind==="stability") {
          const repeat=criteriaFixture.stabilityRepeats.find(testCase=>testCase.id===result.id);
          const baseline=repeat&&results.find(candidate=>candidate.kind==="model"&&candidate.id===repeat.repeatOf)?.profile;
          if(baseline)result.stabilityPass=stableProfile(result.profile)===stableProfile(baseline);
        }
      }
    }

    const saveReport=async()=>{
      const completedCalls=results.filter(result=>result.profile!==null).length;
      const report={
        generatedAt,
        model:modelName,
        evaluation:"50 raw Gemini cases, 10 repeated raw cases, and 10 full local /api/chat checks.",
        scope:"AI-01/03/05/06/07 score raw model outputs; AI-02 validates structured profiles; AI-04 scores nine semantically ambiguous route cases; AI-08 compares structured profiles only.",
        ai04ExcludedCases:criteriaFixture.apiClarificationCases
          .filter(testCase=>testCase.excludeFromAi04)
          .map(testCase=>({id:testCase.id,reason:testCase.ai04ExclusionReason||"Not an ambiguity case."})),
        status,
        expectedCalls:70,
        completedCalls,
        attemptedCalls:completedCalls+failedAttempts,
        failedAttempts,
        criteria:summarize(results),
        validJson:responseMetric(results),
        results,
        ...(failure?{failure}:{}),
      };
      await mkdir("eval-results",{recursive:true});
      await writeFile(output,`${JSON.stringify(report,null,2)}\n`,"utf8");
    };

    try {
      const preflight=await fetch(apiUrl,{signal:AbortSignal.timeout(10_000)});
      if(preflight.status!==405) {
        throw new Error(`Local /api/chat preflight returned HTTP ${preflight.status}; expected 405 for GET.`);
      }

      const profilesById=new Map<string,Profile>();
      for(const result of results) {
        if(result.kind==="model"&&result.profile)profilesById.set(result.id,result.profile);
      }
      let callsAttempted=0;
      const waitBeforeCall=async()=>{
        if(callsAttempted>0&&delayMs>0)await new Promise(resolve=>setTimeout(resolve,delayMs));
        callsAttempted++;
      };

      for(const testCase of modelCases) {
        if(results.some(result=>result.kind==="model"&&result.id===testCase.id&&result.profile!==null))continue;
        await waitBeforeCall();
        try {
          const response=await askGemini(
            testCase.message,
            profileFor(testCase),
            historyFor(testCase),
            testCase.currentTopic||"housing",
            [],
            false,
          );
          if(!response)throw new Error(`Gemini returned no result for ${testCase.id}.`);
          const parsedProfile=userProfileSchema.safeParse(response.profile);
          if(!parsedProfile.success)throw new Error(`Invalid profile schema for ${testCase.id}: ${parsedProfile.error.message}`);
          const result:EvalResult={
            id:testCase.id,
            kind:"model",
            schemaValid:true,
            profile:parsedProfile.data,
            assistantMessage:response.message,
            ...scoreModelCase(testCase,parsedProfile.data),
          };
          results.push(result);
          profilesById.set(testCase.id,parsedProfile.data);
          await saveReport();
          const fieldChecks=result.fieldChecks||[];
          console.log(`${testCase.id}: ${fieldChecks.filter(check=>check.pass).length}/${fieldChecks.length} expected facts`);
        } catch(error) {
          results.push({id:testCase.id,kind:"model",schemaValid:false,profile:null,error:errorText(error)});
          failedAttempts++;
          failure=errorText(error);
          await saveReport();
          throw error;
        }
      }

      for(const repeat of criteriaFixture.stabilityRepeats) {
        if(results.some(result=>result.kind==="stability"&&result.id===repeat.id&&result.profile!==null))continue;
        const sourceCase=modelCases.find(testCase=>testCase.id===repeat.repeatOf);
        const baseline=profilesById.get(repeat.repeatOf);
        if(!sourceCase||!baseline)throw new Error(`Stability source not found: ${repeat.repeatOf}`);
        await waitBeforeCall();
        try {
          const response=await askGemini(
            sourceCase.message,
            profileFor(sourceCase),
            historyFor(sourceCase),
            sourceCase.currentTopic||"housing",
            [],
            false,
          );
          if(!response)throw new Error(`Gemini returned no result for repeat ${repeat.id}.`);
          const parsedProfile=userProfileSchema.safeParse(response.profile);
          if(!parsedProfile.success)throw new Error(`Invalid profile schema for repeat ${repeat.id}: ${parsedProfile.error.message}`);
          const result:EvalResult={
            id:repeat.id,
            kind:"stability",
            schemaValid:true,
            profile:parsedProfile.data,
            stabilityPass:stableProfile(parsedProfile.data)===stableProfile(baseline),
            assistantMessage:response.message,
          };
          results.push(result);
          await saveReport();
          console.log(`${repeat.id}: structured profile ${result.stabilityPass?"stable":"changed"}`);
        } catch(error) {
          results.push({id:repeat.id,kind:"stability",schemaValid:false,profile:null,stabilityPass:false,error:errorText(error)});
          failedAttempts++;
          failure=errorText(error);
          await saveReport();
          throw error;
        }
      }

      for(const testCase of criteriaFixture.apiClarificationCases) {
        if(results.some(result=>result.kind==="api"&&result.id===testCase.id&&result.profile!==null))continue;
        await waitBeforeCall();
        try {
          const response=await fetch(apiUrl,{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({
              message:testCase.message,
              profile:profileFor(testCase),
              currentTopic:testCase.currentTopic,
              history:historyFor(testCase),
            }),
            signal:AbortSignal.timeout(120_000),
          });
          const body:unknown=await response.json();
          if(!isRecord(body))throw new Error(`Invalid response body for API case ${testCase.id}.`);
          if(!response.ok)throw new Error(`API case ${testCase.id} returned HTTP ${response.status}: ${String(body.error||"unknown error")}`);
          if(body.mode!=="gemini")throw new Error(`API case ${testCase.id} returned mode "${String(body.mode)}"; expected Gemini.`);
          const parsedProfile=userProfileSchema.safeParse(body.profile);
          if(!parsedProfile.success)throw new Error(`Invalid API profile schema for ${testCase.id}: ${parsedProfile.error.message}`);
          const actualTopic=isRecord(body.progress)?body.progress.nextTopic:null;
          const message=typeof body.message==="string"?body.message:"";
          const clarificationChecks=scoreApiClarification(testCase,parsedProfile.data,body.mode,actualTopic,message);
          results.push({
            id:testCase.id,
            kind:"api",
            schemaValid:true,
            profile:parsedProfile.data,
            assistantMessage:message,
            clarificationChecks,
          });
          await saveReport();
          console.log(`${testCase.id}: ${clarificationChecks.filter(check=>check.pass).length}/${clarificationChecks.length} clarification checks`);
        } catch(error) {
          results.push({id:testCase.id,kind:"api",schemaValid:false,profile:null,clarificationChecks:[],error:errorText(error)});
          failedAttempts++;
          failure=errorText(error);
          await saveReport();
          throw error;
        }
      }

      status="complete";
      await saveReport();
      console.log(`Criteria eval report: ${output}`);
      for(const criterion of summarize(results)) {
        console.log(`${criterion.id} ${criterion.criterion}: ${criterion.passed}/${criterion.total}`);
      }
      expect(results).toHaveLength(70);
    } catch(error) {
      status="failed";
      failure=errorText(error);
      await saveReport();
      throw error;
    }
  },900_000);
});
