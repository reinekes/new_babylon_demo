import {recordCalmMeal} from './peace-discovery.js';
import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {foodAvailableAt,takeStock} from './inventory.js';
import {storeMinimum} from './district-logistics.js';
import {hourOf,mealCycle,COMMON_PORTION} from './wellbeing.js';

export const commonMealWindow=time=>hourOf(time)>=11&&hourOf(time)<16;
export const commonMealDay=time=>mealCycle(time)+1;
export const isMealDepot=b=>b?.type==='depot'&&isOperational(b)&&b.commonMeals===true;

export function setCommonMeals(s,key,enabled){
 const lock=cityCommandReason(s);
 if(lock||s.event||s.lost||s.funeral)return {ok:false,reason:lock||'Сначала заверши текущее событие'};
 const depot=s.buildings.find(b=>buildingKey(b)===key);
 if(!isStrictSumer(s)||depot?.type!=='depot'||!isOperational(depot)||typeof enabled!=='boolean')return {ok:false,reason:'Выбери готовый раздаточный двор'};
 if(enabled)depot.commonMeals=true;
 else delete depot.commonMeals;
 return {ok:true};
}

export function commonMealAvailable(s,b){
 return isMealDepot(b)&&b.stock?.food+1e-8>=storeMinimum(b,'food')+COMMON_PORTION&&foodAvailableAt(s,buildingKey(b))+1e-8>=COMMON_PORTION;
}

function talkAtMeal(s,depot,diner,peer,day){
 const people=[diner.id,peer.id].sort((a,b)=>a-b);
 const topic=s.news.find(n=>n.tick>=s.tick-1&&typeof n.title==='string'&&n.title.length>0)?.title.slice(0,160)??null;
 let dispute=depot.mealDispute,outcome='talk';
 if(dispute?.status==='open'&&(day-dispute.day>7||!dispute.people.every(id=>s.citizens.some(c=>c.id===id))))dispute=undefined;
 if(dispute?.status==='open'&&day>dispute.day&&people.every((id,i)=>id===dispute.people[i])&&!diner.missedMeals&&!peer.missedMeals){
  dispute.status='resolved';
  outcome='reconciled';
  diner.mood=Math.min(100,diner.mood+6);
  peer.mood=Math.min(100,peer.mood+6);
 }else if(dispute?.status!=='open'&&dispute?.day!==day&&diner.home!==peer.home&&Boolean(diner.missedMeals)!==Boolean(peer.missedMeals)){
  dispute={day,people,status:'open'};
  outcome='disputed';
 }
 if(dispute)depot.mealDispute=dispute;
 else delete depot.mealDispute;
 depot.mealTalk={day,people,topic,outcome};
 recordCalmMeal(s,diner,peer,day,outcome);
}

export function serveCommonMeal(s,c,b){
 const day=commonMealDay(s.simTime);
 if(!isStrictSumer(s)||c.age<16||!commonMealWindow(s.simTime)||c.commonMealDay===day||!commonMealAvailable(s,b))return false;
 if(takeStock(s,buildingKey(b),'food',COMMON_PORTION)!==COMMON_PORTION)return false;
 c.commonMealDay=day;
 c.hunger=Math.max(0,c.hunger-22.5);
 c.mood=Math.min(100,c.mood+3);
 for(const peer of s.citizens){
  if(peer.id===c.id||peer.phase!=='commonMeal'||peer.commonMealUntil<=s.simTime||peer.commonMealTarget!==buildingKey(b))continue;
  peer.mood=Math.min(100,peer.mood+2);
  c.mood=Math.min(100,c.mood+2);
  talkAtMeal(s,b,c,peer,day);
  break;
 }
 return true;
}

export function validateCommonMeals(s){
 const strict=isStrictSumer(s);
 const depots=new Set(s.buildings.filter(b=>b.type==='depot'&&isOperational(b)).map(buildingKey));
 const pair=v=>v&&Number.isSafeInteger(v.day)&&v.day>=0&&v.day<=commonMealDay(s.simTime)&&Array.isArray(v.people)&&v.people.length===2&&v.people.every(id=>Number.isSafeInteger(id)&&id>=0)&&v.people[0]<v.people[1];
 return s.buildings.every(b=>{
  if(b.commonMeals!==undefined&&(!strict||!isMealDepot(b)))return false;
  if(b.mealTalk===undefined&&b.mealDispute===undefined)return true;
  if(!strict||b.type!=='depot'||!isOperational(b))return false;
  const t=b.mealTalk,d=b.mealDispute;
  return pair(t)&&['talk','disputed','reconciled'].includes(t.outcome)&&(t.topic===null||typeof t.topic==='string'&&t.topic.length>0&&t.topic.length<=160)&&
   (d===undefined||pair(d)&&d.day<=t.day&&['open','resolved'].includes(d.status));
 })&&s.citizens.every(c=>
  (c.commonMealDay===undefined||strict&&c.age>=16&&Number.isSafeInteger(c.commonMealDay)&&c.commonMealDay>=0&&c.commonMealDay<=commonMealDay(s.simTime))&&
  (c.commonMealTarget===undefined?!['toCommonMeal','commonMeal'].includes(c.phase)&&c.commonMealUntil===undefined:strict&&c.age>=16&&depots.has(c.commonMealTarget)&&['toCommonMeal','commonMeal','blocked'].includes(c.phase)&&
   (c.commonMealUntil===undefined?c.phase!=='commonMeal':Number.isFinite(c.commonMealUntil)&&c.commonMealUntil>=0&&c.commonMealUntil<=s.simTime+1.01)&&
   !c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.waterTrip&&!c.pantryTrip&&!c.clinic&&!c.school&&!c.site&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&
   !Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0)));
}
