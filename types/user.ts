export type UserProfile = {
  housing:{type:string|null;size:string|null;living_conditions:string|null;yard_available:boolean|null};
  household:{adults:number|null;children:number|null;children_ages:number[];other_animals:string[];other_animals_confirmed:boolean|null};
  lifestyle:{works_full_time:boolean|null;hours_away_daily:number|null;activity_level:"low"|"moderate"|"high"|null;walks_per_day:number|null};
  experience:{has_pet_experience:boolean|null;care_experience:string|null};
  preferences:{animal_type:"dog"|"cat"|null;preferred_size:"small"|"medium"|"large"|null;preferred_age:string|null;activity:"low"|"moderate"|"high"|null;character:string[];colors:string[]};
  readiness:{special_care:boolean|null;financial_readiness_confirmed:boolean|null}; missing_fields:string[]; completed:boolean;
};
export const emptyProfile:UserProfile={housing:{type:null,size:null,living_conditions:null,yard_available:null},household:{adults:null,children:null,children_ages:[],other_animals:[],other_animals_confirmed:null},lifestyle:{works_full_time:null,hours_away_daily:null,activity_level:null,walks_per_day:null},experience:{has_pet_experience:null,care_experience:null},preferences:{animal_type:null,preferred_size:null,preferred_age:null,activity:null,character:[],colors:[]},readiness:{special_care:null,financial_readiness_confirmed:null},missing_fields:["условия проживания","семья и другие животные","время отсутствия дома","предпочтительный тип питомца"],completed:false};
