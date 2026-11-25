import {Animal} from "@/types/animal"; import {UserProfile} from "@/types/user";
export type Match={animal:Animal;score:number;dataCompleteness:number;matches:string[];mismatches:string[];risks:string[];questions:string[]};
const avg=(items:(number|null)[])=>{const x=items.filter((v):v is number=>v!==null);return x.length?x.reduce((a,b)=>a+b,0)/x.length:null};
export function matchAnimal(a:Animal,p:UserProfile):Match|null { const risks:string[]=[]; const questions:string[]=[];
 if(!a.adoption_available || (p.preferences.animal_type&&a.type!==p.preferences.animal_type)) return null;
 if(p.household.children && p.household.children>0 && a.good_with_children===false)return null;
 if(p.household.other_animals.includes("кошка")&&a.good_with_cats===false)return null;
 if(p.lifestyle.hours_away_daily&&a.can_stay_alone_hours!==null&&p.lifestyle.hours_away_daily>a.can_stay_alone_hours) return null;
 const activity=p.lifestyle.activity_level||p.preferences.activity; const scores:(number|null)[]=[]; const matches:string[]=[]; const mismatches:string[]=[];
 const equal=(label:string,want:string|null,got:string)=>{if(!want)return null; if(want===got){matches.push(label);return 1} mismatches.push(label);return 0};
 scores.push(equal("Подходящий уровень активности",activity,a.activity_level));
 scores.push(p.preferences.character.length? a.character.some(x=>p.preferences.character.includes(x))?1:0:null);
 scores.push(p.housing.type? a.housing_requirements.includes("квартира")&&p.housing.type==="квартира"?1:0.7:null);
 if(p.household.other_animals.includes("кошка")&&a.good_with_cats===null)questions.push("уточнить совместимость с кошками");
 if(p.household.children&&a.good_with_children===null)questions.push("уточнить совместимость с детьми");
 if(a.special_care)risks.push("Есть особенности ухода — обсудите их с приютом.");
 const data=avg(scores); const score=Math.round((data??0.55)*100); return {animal:a,score,dataCompleteness:Math.round(scores.filter(x=>x!==null).length/scores.length*100),matches,mismatches,risks,questions}; }
export const recommendations=(animals:Animal[],p:UserProfile)=>animals.map(a=>matchAnimal(a,p)).filter((x):x is Match=>x!==null).sort((a,b)=>b.score-a.score);
