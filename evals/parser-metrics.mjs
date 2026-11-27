const listFields=new Set(["color","character","housing_requirements","interesting_facts"]);
const textFields=new Set(["age_text","coat_details","ear_shape","shelter_story","health_notes","care_notes"]);
const booleanFields=new Set(["good_with_children","good_with_cats","good_with_dogs","good_with_other_animals","special_care"]);
const numericFields=new Set(["age_years","can_stay_alone_hours"]);

function parseMaybeJson(value) {
  if(typeof value!=="string")return value;
  const text=value.trim();
  if(!text)return null;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

function normalizeText(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("ru")
    .replace(/ё/g,"е")
    .replace(/[^\p{L}\p{N}]+/gu," ")
    .replace(/\s+/g," ")
    .trim();
}

function normalizeBoolean(value) {
  if(typeof value==="boolean")return value;
  if(typeof value==="number")return value===1?true:value===0?false:null;
  const text=normalizeText(value);
  if(/^(true|yes|да|совместим|подходит|дружит|нужен|требуется)$/.test(text))return true;
  if(/^(false|no|нет|несовместим|не подходит|не дружит|не требуется|не нужен)$/.test(text))return false;
  return null;
}

function normalizeNumber(value) {
  if(typeof value==="number")return Number.isFinite(value)?value:null;
  const match=String(value??"").replace(",",".").match(/-?\d+(?:\.\d+)?/);
  return match?Number(match[0]):null;
}

function normalizeScalar(field,value) {
  const parsed=parseMaybeJson(value);
  if(parsed===null||parsed===undefined||parsed==="")return null;
  if(booleanFields.has(field))return normalizeBoolean(parsed);
  if(numericFields.has(field))return normalizeNumber(parsed);
  const text=normalizeText(parsed);
  if(!text||/^(unknown|неизвестно|не указано|нет данных|n a)$/.test(text))return null;
  if(field==="type") {
    if(/^(dog|собака|пес|песель|щенок)/.test(text))return "dog";
    if(/^(cat|кошка|кот|котенок)/.test(text))return "cat";
  }
  if(field==="sex") {
    if(/^(male|самец|кобель|мальчик|мужской)/.test(text))return "male";
    if(/^(female|самка|сука|девочка|женский)/.test(text))return "female";
  }
  if(field==="size") {
    if(/^(small|маленький|малый|небольшой|мелкий)/.test(text))return "small";
    if(/^(medium|средний)/.test(text))return "medium";
    if(/^(large|крупный|большой)/.test(text))return "large";
  }
  if(field==="activity_level") {
    if(/^(low|низкий|спокойный|неактивный)/.test(text))return "low";
    if(/^(moderate|medium|умеренный|средний)/.test(text))return "moderate";
    if(/^(high|высокий|активный|энергичный|подвижный)/.test(text))return "high";
  }
  return text;
}

function normalizeList(field,value) {
  const parsed=parseMaybeJson(value);
  if(parsed===null||parsed===undefined||parsed==="")return [];
  const values=Array.isArray(parsed)?parsed:String(parsed).split(/[,;|\n•]+/);
  return [...new Set(values.map(item=>normalizeScalar(field,item)).filter(Boolean))].sort();
}

function tokenSet(value) {
  const text=normalizeText(value);
  return new Set(text?text.split(" "):[]);
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

export function scoreAnimalParserReview(rows) {
  const scores=new Map();
  let reviewedCells=0;
  let exactMatches=0;

  function getStats(field) {
    if(!scores.has(field))scores.set(field,{
      reviewed:0,exactMatches:0,tp:0,fp:0,fn:0,tn:0,tokenTp:0,tokenFp:0,tokenFn:0,
    });
    return scores.get(field);
  }

  for(const row of rows) {
    if(!Array.isArray(row.reviewed_fields)||!row.expected||typeof row.expected!=="object") {
      throw new Error(`Invalid review record: ${row.record_id||"unknown ID"}`);
    }
    for(const field of row.reviewed_fields) {
      if(!(field in row.predicted)||!(field in row.expected)) {
        throw new Error(`Missing predicted or expected value for ${row.record_id}.${field}`);
      }
      const stats=getStats(field);
      stats.reviewed++;
      reviewedCells++;
      const predicted=listFields.has(field)
        ?normalizeList(field,row.predicted[field])
        :normalizeScalar(field,row.predicted[field]);
      const expected=listFields.has(field)
        ?normalizeList(field,row.expected[field])
        :normalizeScalar(field,row.expected[field]);

      if(listFields.has(field)) {
        const predictedSet=new Set(predicted);
        const expectedSet=new Set(expected);
        let overlap=0;
        for(const item of predictedSet) {
          if(expectedSet.has(item))overlap++;
          else stats.tokenFp++;
        }
        for(const item of expectedSet) {
          if(predictedSet.has(item))stats.tokenTp++;
          else stats.tokenFn++;
        }
        if(predictedSet.size===expectedSet.size&&overlap===expectedSet.size) {
          stats.exactMatches++;
          exactMatches++;
        }
        if(predictedSet.size===0&&expectedSet.size===0)stats.tn++;
        continue;
      }

      const same=predicted===expected;
      if(same) {
        stats.exactMatches++;
        exactMatches++;
      }
      if(textFields.has(field)) {
        const predictedTokens=tokenSet(predicted??"");
        const expectedTokens=tokenSet(expected??"");
        for(const token of predictedTokens) {
          if(expectedTokens.has(token))stats.tokenTp++;
          else stats.tokenFp++;
        }
        for(const token of expectedTokens) {
          if(!predictedTokens.has(token))stats.tokenFn++;
        }
        if(predictedTokens.size===0&&expectedTokens.size===0)stats.tn++;
      } else if(same&&expected!==null) {
        stats.tp++;
      } else if(same) {
        stats.tn++;
      } else if(predicted===null) {
        stats.fn++;
      } else if(expected===null) {
        stats.fp++;
      } else {
        stats.fp++;
        stats.fn++;
      }
    }
  }

  const perField=Object.fromEntries([...scores.entries()].map(([field,stats])=>{
    const usesTokens=textFields.has(field)||listFields.has(field);
    const positiveTp=usesTokens?stats.tokenTp:stats.tp;
    const positiveFp=usesTokens?stats.tokenFp:stats.fp;
    const positiveFn=usesTokens?stats.tokenFn:stats.fn;
    const precision=positiveTp+positiveFp
      ?positiveTp/(positiveTp+positiveFp)
      :positiveFn?0:null;
    const recall=positiveTp+positiveFn?positiveTp/(positiveTp+positiveFn):null;
    return [field,{
      ...stats,
      exactAccuracy:stats.reviewed?stats.exactMatches/stats.reviewed:null,
      accuracy95:stats.reviewed?wilsonInterval(stats.exactMatches,stats.reviewed):null,
      precision,
      recall,
      f1:precision===null||recall===null?null:precision+recall===0?0:2*precision*recall/(precision+recall),
    }];
  }));
  return {
    reviewedCells,
    exactMatches,
    exactAccuracy:reviewedCells?exactMatches/reviewedCells:null,
    perField,
  };
}
