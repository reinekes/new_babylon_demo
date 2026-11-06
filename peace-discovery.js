import {usesCatDiscovery} from './scenario-profiles.js';
import {mealCycle} from './wellbeing.js';

const CARE_REQUIRED=3;
const MEALS_REQUIRED=2;

export const newPeaceDiscovery=()=>({version:1,care:[],meals:[]});

export function recordCompletedCare(s,helper,recipient){
 const care=s.peaceDiscovery?.care;
 if(!care||care.length>=CARE_REQUIRED||care.some(f=>f.recipientId===recipient.id))return;
 care.push({helperId:helper.id,recipientId:recipient.id,time:s.simTime});
}

export function recordCalmMeal(s,diner,peer,day,outcome){
 const meals=s.peaceDiscovery?.meals;
 if(!meals||meals.length>=MEALS_REQUIRED||outcome==='disputed'||diner.home===peer.home||
  peer.commonMealDay!==day||meals.some(f=>f.day===day))return;
 meals.push({day,people:[diner.id,peer.id].sort((a,b)=>a-b),time:s.simTime});
}

export function peaceDiscoveryView(s){
 const evidence=s.peaceDiscovery;
 if(!evidence)return null;
 const care=evidence.care.length,meals=evidence.meals.length;
 return {qualified:care>=CARE_REQUIRED||meals>=MEALS_REQUIRED,care,meals,careRequired:CARE_REQUIRED,mealsRequired:MEALS_REQUIRED};
}

export function validatePeaceDiscovery(s){
 const evidence=s.peaceDiscovery;
 if(evidence===undefined)return true;
 if(!usesCatDiscovery(s)||!evidence||evidence.version!==1||Object.keys(evidence).length!==3||
  !Array.isArray(evidence.care)||evidence.care.length>CARE_REQUIRED||!Array.isArray(evidence.meals)||evidence.meals.length>MEALS_REQUIRED)return false;
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 const time=(f,prev)=>Number.isFinite(f.time)&&f.time>=(prev?.time??0)&&f.time<=s.simTime;
 const seen=new Set();
 for(const [i,f] of evidence.care.entries()){
  if(!f||Object.keys(f).length!==3||!id(f.helperId)||!id(f.recipientId)||f.helperId===f.recipientId||
   seen.has(f.recipientId)||!time(f,evidence.care[i-1]))return false;
  seen.add(f.recipientId);
 }
 return evidence.meals.every((f,i)=>f&&Object.keys(f).length===3&&time(f,evidence.meals[i-1])&&
  f.day===mealCycle(f.time)+1&&f.day>(evidence.meals[i-1]?.day??-1)&&Array.isArray(f.people)&&
  f.people.length===2&&f.people.every(id)&&f.people[0]<f.people[1]);
}
