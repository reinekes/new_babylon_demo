import {recordArrivalShelter} from './arrival-hospitality.js';
import {takeGiftFood} from './abundance-origin.js';
import {advanceEveningGame} from './household-games.js';
import {tellWaterStoryAtDinner} from './life-analytics.js';
import {isStrictSumer} from './scenario-profiles.js';
import {isAwakening,knowsPresence} from './godhood.js';
import {buildingKey} from './definitions.js';
import {ration,supplyHome} from './households.js';
import {professionMatchesTask} from './professions.js';
export const COMMON_PORTION=.4;
const clamp=n=>Math.max(0,Math.min(100,n));
export const hourOf=t=>((8+t*.4)%24+24)%24;
export const mealCycle=t=>Math.floor((t-30+1e-7)/60);
export const mealRation=c=>ration(c)*4/3;
export const isDinnerTime=t=>hourOf(t)>=20||hourOf(t)<6;
export function initializeWellbeing(s){const day=mealCycle(s.simTime||0);for(const c of s.citizens){c.hunger??=0;c.health??=100;c.mood??=75;c.faith??=60;c.mealDay??=day;c.mealEaten??=mealRation(c);c.mealEvaluated??=day;c.missedMeals??=0;c.lastMealQuality??=1;c.familyMeal??=false;c.diningUntil??=0;c.prayerTotal??=0;}}
export const workRate=(c,task=c.siteDuty||c.role)=>Math.max(.15,Math.min(1.2,(.5+(c.mood??75)/150)*(.4+.6*(c.health??100)/100)*(1-.6*(c.hunger||0)/100)))*(professionMatchesTask(c,task)?1.2:1);
export const beliefMultiplier=s=>s.citizens.length?s.citizens.reduce((n,c)=>n+(c.faith??60),0)/(s.citizens.length*60):0;
export function affectResidents(s,{faith=0,mood=0}={},ids=null){const affected=ids&&new Set(ids);for(const c of s.citizens||[])if(!affected||affected.has(c.id)){c.faith=clamp((c.faith??60)+faith);c.mood=clamp((c.mood??75)+mood);}}
export function mournResidents(s,ids,natural=false){const dead=new Set(ids);for(const c of s.citizens){if(dead.has(c.id))continue;const family=dead.has(c.partner)||c.parents?.some(id=>dead.has(id));c.mood=clamp((c.mood??75)-(family?20:6));c.faith=clamp((c.faith??60)-(natural?(family?4:1):(family?22:10)));}}
export function advanceWellbeing(s,dt){
 const day=mealCycle(s.simTime),night=isDinnerTime(s.simTime),evaluating=!night&&s.citizens.some(c=>c.mealDay===day&&c.mealEvaluated<day),gardenJoy=evaluating?s.buildings.filter(b=>b.type==='garden'&&b.construction?.kind!=='new').reduce((n,b)=>n+2+2*(b.level||1),0):0;
 if(night){
  const families=new Map();
  let storyRecords;
  for(const c of s.citizens){
   if(c.mealDay!==day){c.mealDay=day;c.mealEaten=c.commonMealDay===day?COMMON_PORTION:0;c.familyMeal=false;}
   if(s.funeral?.actors.some(a=>a.id===c.id))continue;
   const home=supplyHome(c,{arrived:true});
   if(!home||!c.floodShelter&&!c.fireShelter&&(!['home','resting'].includes(c.phase)||c.phase!=='resting'&&Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)))continue;
   if(!families.has(home))families.set(home,[]);
   families.get(home).push(c);
  }
  for(const b of s.buildings){const family=families.get(`${b.x},${b.y}`);if(b.type!=='house'||!family||!((b.pantry||0)+(b.householdStock?.milk||0)*.5>0))continue;const requests=family.map(c=>Math.max(0,Math.min(mealRation(c)-c.mealEaten,mealRation(c)*.4*dt))),total=requests.reduce((a,b)=>a+b,0);if(total<=1e-9)continue;const share=Math.min(1,((b.pantry||0)+(b.householdStock?.milk||0)*.5)/total);for(let i=0;i<family.length;i++){const amount=requests[i]*share;if(amount<=1e-9)continue;const c=family[i];c.mealEaten=Math.min(mealRation(c),c.mealEaten+amount);const milk=Math.min(b.householdStock?.milk||0,amount*2);if(milk)b.householdStock.milk-=milk;if(b.giftHome)takeGiftFood(b,'giftHome',amount-milk*.5,b.pantry);b.pantry=Math.max(0,(b.pantry||0)-(amount-milk*.5));c.hunger=clamp(c.hunger-45*amount/mealRation(c));c.health=clamp(c.health+2*amount/mealRation(c));c.diningUntil=s.simTime+2;c.familyMeal||=family.length>1;if(c.floodShelter)recordArrivalShelter(s,b,c,amount);}
   if(s.godhood?.firstWaterHelp?.deliveredAt!==undefined&&family.length>1){
    storyRecords??=new Map((s.lifeAnalytics?.people||[]).map(p=>[p.id,p]));
    tellWaterStoryAtDinner(s,family.filter((_,i)=>requests[i]*share>1e-9),storyRecords);
   }
  }
  for(const b of s.buildings)advanceEveningGame(s,b,families.get(`${b.x},${b.y}`));
 }else if(evaluating){
  const furnished=new Map(s.buildings.filter(b=>b.type==='house'&&b.householdStock?.mat>=1&&!b.floodDamage).map(b=>[buildingKey(b),b.householdStock.mat]));
  for(const c of s.citizens){if(c.mealDay!==day||c.mealEvaluated>=day)continue;const quality=Math.min(1,c.mealEaten/mealRation(c)),fed=quality>=.95;c.lastMealQuality=quality;c.mealEvaluated=day;c.missedMeals=fed?0:c.missedMeals+1;c.hunger=clamp(fed?c.hunger-20:Math.max(c.hunger+20*(1-quality),(1-quality)*100));c.health=clamp(c.health+5*quality-28*(1-quality)-c.hunger*.04);const mats=furnished.get(supplyHome(c,{arrived:true}))||0,comfort=mats>=1?1+Number(mats>=2&&s.season===1):0;c.mood=clamp(c.mood+(fed?3+comfort+(c.familyMeal?2:0)+Math.min(4,gardenJoy*.25):-12*(1-quality)));c.faith=clamp(c.faith+(fed?1:-8*(1-quality)));const prayer=knowsPresence(s,c)?c.faith/100*.15:0;s.resources.faith+=prayer;c.prayerTotal+=prayer;if(prayer>0&&isStrictSumer(s)&&isAwakening(s))s.godhood.lastPrayerCycle=day;}
 }
}
export function validateWellbeing(s){const pct=n=>Number.isFinite(n)&&n>=0&&n<=100,int=n=>Number.isSafeInteger(n)&&n>=-1&&n<=1e9;return s.citizens.every(c=>['hunger','health','mood','faith'].every(k=>pct(c[k]))&&int(c.mealDay)&&c.mealDay<=mealCycle(s.simTime)&&int(c.mealEvaluated)&&c.mealEvaluated<=c.mealDay&&Number.isFinite(c.mealEaten)&&c.mealEaten>=0&&c.mealEaten<=mealRation(c)+1e-7&&Number.isInteger(c.missedMeals)&&c.missedMeals>=0&&c.missedMeals<=1e6&&Number.isFinite(c.lastMealQuality)&&c.lastMealQuality>=0&&c.lastMealQuality<=1&&typeof c.familyMeal==='boolean'&&Number.isFinite(c.diningUntil)&&c.diningUntil>=0&&c.diningUntil<=s.simTime+2.1&&Number.isFinite(c.prayerTotal)&&c.prayerTotal>=0&&c.prayerTotal<=1e9);}
