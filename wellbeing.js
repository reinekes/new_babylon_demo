import {occupiesCell} from './footprints.js';
import {takeStock} from './inventory.js';
import {exportable} from './district-logistics.js';
import {takeBuildingOutput} from './building-inventory.js';
import {networkFor,invalidateAssignments} from './workforce.js';
import {navigationSegmentClear,nearestWalkingNode,obstacleIndex} from './navigation.js';
import {floodedSegment} from './river-flood.js';
import {takeFish} from './fish-provenance.js';
import {eatFishingOutput,acceptFishingCargo} from './cat-fishing-ledger.js';
import {pickupFieldGrain,acceptFieldGrain} from './field-grain.js';
import {recordGrainDinner,takeGrain} from './grain-origin.js';
import {recordArrivalShelter} from './arrival-hospitality.js';
import {takeGiftFood} from './abundance-origin.js';
import {advanceEveningGame} from './household-games.js';
import {tellWaterStoryAtDinner} from './life-analytics.js';
import {isStrictSumer} from './scenario-profiles.js';
import {isAwakening,knowsPresence} from './godhood.js';
import {COMMUNAL_MOOD_PENALTY,isOperational,isResidence,buildingKey} from './definitions.js';
import {homeFoodCouriers,homeMealFood,ration,supplyHome} from './households.js';
import {professionMatchesTask} from './professions.js';
export const COMMON_PORTION=.4;
const clamp=n=>Math.max(0,Math.min(100,n));
export const hourOf=t=>((8+t*.4)%24+24)%24;
export const mealCycle=t=>Math.floor((t-30+1e-7)/60);
export const mealRation=c=>ration(c)*4/3;
export const isDinnerTime=t=>hourOf(t)>=20||hourOf(t)<6;
export function householdDinner(time,residents,food){
 const day=mealCycle(time),inProgress=isDinnerTime(time),lastDay=day-Number(inProgress);
 let lastNeed=0,lastEaten=0,need=0,remaining=0;
 for(const c of residents){
  const portion=mealRation(c);
  need+=portion;
  if(lastDay>=0&&c.mealEvaluated===lastDay){
   lastNeed+=portion;
   lastEaten+=portion*c.lastMealQuality;
  }
  if(inProgress)remaining+=Math.max(0,portion-(c.mealDay===day?c.mealEaten:0));
 }
 return {lastPercent:lastNeed?Math.round(lastEaten/lastNeed*100):null,
  need,reserve:Math.max(0,food-remaining),remaining};
}
export function initializeWellbeing(s){const day=mealCycle(s.simTime||0);for(const c of s.citizens){c.hunger??=0;c.health??=100;c.mood??=75;c.faith??=60;c.mealDay??=day;c.mealEaten??=mealRation(c);c.mealEvaluated??=day;c.missedMeals??=0;c.lastMealQuality??=1;c.familyMeal??=false;c.diningUntil??=0;c.prayerTotal??=0;}}
// Keep event and meal mood as the intrinsic value. Moving homes changes only the housing adjustment.
export const residentMood=(c,home)=>Math.max(0,(c.mood??75)-(home?.type==='communalHouse'?COMMUNAL_MOOD_PENALTY:0));
export const workRate=(c,task=c.siteDuty||c.role,home)=>Math.max(.15,Math.min(1.2,(.5+residentMood(c,home)/150)*(.4+.6*(c.health??100)/100)*(1-.6*(c.hunger||0)/100)))*(professionMatchesTask(c,task)?1.2:1);
export const beliefMultiplier=s=>s.citizens.length?s.citizens.reduce((n,c)=>n+(c.faith??60),0)/(s.citizens.length*60):0;
export function affectResidents(s,{faith=0,mood=0}={},ids=null){const affected=ids&&new Set(ids);for(const c of s.citizens||[])if(!affected||affected.has(c.id)){c.faith=clamp((c.faith??60)+faith);c.mood=clamp((c.mood??75)+mood);}}
export function mournResidents(s,ids,natural=false){const dead=new Set(ids);for(const c of s.citizens){if(dead.has(c.id))continue;const family=dead.has(c.partner)||c.parents?.some(id=>dead.has(id));c.mood=clamp((c.mood??75)-(family?20:6));c.faith=clamp((c.faith??60)-(natural?(family?4:1):(family?22:10)));}}
export function createEmergencyMealContext(s){
 return {buildings:new Map(s.buildings.map(b=>[buildingKey(b),b]))};
}

// Only unclaimed stock and a family's own ordinary open order may feed a resident here.
function foodAtDoor(s,homeKey,b,wanted,minimum){
 const food=localPortion(s,homeKey,b,'food',wanted,minimum);
 return food||.5*localPortion(s,homeKey,b,'milk',2*wanted,2*minimum);
}
function localPortion(s,homeKey,b,resource,wanted,minimum){
 if(!isOperational(b)||b.noExport)return 0;
 const key=buildingKey(b),stock=exportable(s,key,resource);
 if(stock<=1e-7)return 0;
 let free=stock;
 const family=[];
 for(const q of s.district.jobs){
  if(q.source!==key||q.resource!==resource||q.remaining<=1e-7||q.fishLot||q.shapingBatch)continue;
  if(q.automatic&&q.targetKind==='input'&&q.target===homeKey)family.push(q);
  else free-=q.remaining;
 }
 if(free+1e-7<minimum)return 0;
 const amount=Math.min(wanted,free),before=b.workshopStock?.output?.food||0;
 const warehouse=['depot','granary','shrine'].includes(b.type)||isResidence(b)||b.recoveryOnly;
 const taken=warehouse?takeStock(s,key,resource,amount):takeBuildingOutput(b,resource,amount);
 if(!warehouse&&resource==='food'){
  takeGrain(b,'grainOutput',taken,before);
  takeFish(b,'fishOutput',taken,before);
  eatFishingOutput(s,b,taken,before);
  pickupFieldGrain(b,{},taken,before);
 }
 let used=taken;
 for(const q of family){
  if(used<=1e-7)break;
  const n=Math.min(used,q.remaining);
  q.remaining-=n;q.cancelled+=n;used-=n;
 }
 if(family.length&&taken>0)invalidateAssignments(s);
 return taken;
}

const DOOR_REACH=.4;
function doorReachable(s,c,p,nav){
 return !(nav.flooded&&floodedSegment(nav.flooded,c,p))&&(!nav.fortifications||nav.fortifications.segmentClear(c,p))&&navigationSegmentClear(s,c,p,nav.obstacles);
}

function currentWorkCourt(c,ctx){
 const work=ctx.buildings.get(c.work);
 return c.phase==='working'&&work&&isOperational(work)&&occupiesCell(work,Math.floor(c.x+.5),Math.floor(c.y+.5))?work:null;
}
// The freight scheduler owns the route. At the seasonal boundary only establish
// that someone can reach the address, even if the flood has just receded.
function canReachMealAddress(s,c,port,net,ctx){
 const work=currentWorkCourt(c,ctx);
 let from;
 if(work){
  from=net.ports.find(p=>p.building===work);
  const exit={...net.navigation,obstacles:obstacleIndex(s.buildings.filter(b=>b!==work))};
  if(!from||!doorReachable(s,c,from,exit))return false;
 }else from=nearestWalkingNode(net,c,p=>doorReachable(s,c,p,net.navigation));
 return !!from&&net.components.has(port.key)&&net.components.get(from.key)===net.components.get(port.key);
}
const EMERGENCY_SHARE=.25;

function loadedForHome(s,p,key){
 if(p.pantryTrip&&(p.pantryTarget||p.home)===key&&p.phase!=='toDistrictStore')return p.pantryFood||0;
 const job=p.districtJob&&s.district.jobs.find(q=>q.id===p.districtJob);
 if(job?.targetKind!=='input'||job.target!==key||p.phase==='toPantryHome')return 0;
 if(job.resource==='milk')return (p.cargo?.milk||0)*.5;
 return job.resource==='food'?p.cargo?.food||0:0;
}

export function canWaitForDinner(s,c,ctx){
 if(s.calendarDaysPerMonth!==1||c.health>0||c.missedMeals<3||c.waitedForDinner)return false;
 const key=supplyHome(c,{arrived:true}),home=ctx.buildings.get(key);
 if(!home||!isOperational(home))return false;
 const net=ctx.network??=networkFor(s),port=net.ports.find(p=>p.building===home);
 if(!port)return false;
 const present=c.floodShelter||c.fireShelter||['home','resting'].includes(c.phase)&&Math.hypot(c.x-port.x,c.y-port.y)<=1;
 if(!present&&!canReachMealAddress(s,c,port,net,ctx))return false;
 // Count each family member's share once. An uncollected order contributes zero.
 const minimum=EMERGENCY_SHARE*s.citizens.reduce((n,p)=>n+(supplyHome(p)===key?mealRation(p):0),0);
 let food=homeMealFood(home);
 for(const p of homeFoodCouriers(s,key)){
  if(food+1e-7>=minimum)break;
  if(!['blocked','toPantryHome','toDistrictStore'].includes(p.phase)||p.fireShelter||p.floodShelter&&net.navigation.flooded)continue;
  const loaded=loadedForHome(s,p,key);
  if(loaded>0&&canReachMealAddress(s,p,port,net,ctx))food+=loaded;
 }
 if(food+1e-7<minimum)return false;
 // The next check can still record starvation if the food never arrives.
 // Health and hunger only change on a real meal.
 c.waitedForDinner=true;
 return true;
}

export function tryEmergencyMeal(s,c,ctx){
 if(s.calendarDaysPerMonth!==1||c.missedMeals<3||c.health>0||c.mealDay!==mealCycle(s.simTime))return false;
 const portion=mealRation(c),needed=portion-c.mealEaten;
 if(needed<=1e-7)return false;
 const homeKey=supplyHome(c,{arrived:true}),home=ctx.buildings.get(homeKey);
 // A trace quantity cannot rescue a dying resident. A smaller remainder can
 // complete an ordinary dinner if the resident has already eaten most of it.
 const minimum=Math.min(EMERGENCY_SHARE*portion,needed);
 // Evacuation changes the dinner address but not ownership of a load in hand.
 const ownLoad=destination=>destination===c.home||destination===supplyHome(c);
 let amount=0;
 if(home&&homeMealFood(home)>=minimum){
  let present=c.floodShelter||c.fireShelter||c.phase==='home'||c.phase==='resting'||
   Math.hypot(c.x-home.x,c.y-home.y)<.4;
  if(!present){
   const network=ctx.network??=networkFor(s),port=network.ports.find(p=>p.building===home);
   present=port&&Math.hypot(c.x-port.x,c.y-port.y)<=DOOR_REACH&&doorReachable(s,c,port,network.navigation);
  }
  if(present){
   amount=Math.min(needed,homeMealFood(home));
   const milk=Math.min(home.householdStock?.milk||0,2*amount);
   if(milk)home.householdStock.milk-=milk;
   const food=amount-.5*milk;
   takeGiftFood(home,'giftHome',food,home.pantry);
   recordGrainDinner(s,home,food);
   home.pantry=Math.max(0,(home.pantry||0)-food);
  }
 }
 if(!amount&&c.pantryTrip&&ownLoad(c.pantryTarget||c.home)&&c.pantryFood>=minimum){
  const before=c.pantryFood;
  amount=Math.min(needed,before);
  takeGiftFood(c,'giftPantry',amount,before);
  takeFish(c,'fishPantry',amount,before);
  takeGrain(c,'grainPantry',amount,before);
  c.pantryFood-=amount;
  if(c.pantryFood<=1e-7){delete c.pantryOrigin;delete c.pantryRemainder;}
 }
 if(!amount&&c.districtJob){
  const job=s.district.jobs.find(q=>q.id===c.districtJob),resource=job?.resource;
  const value=resource==='milk'?.5:1,before=c.cargo?.[resource]||0;
  // At the point of starvation a carrier can eat from an ordinary household
  // delivery and still bring its remainder to the original address.
  const familyDelivery=job?.automatic&&!job.fishLot&&isResidence(ctx.buildings.get(job.target));
  if((resource==='food'||resource==='milk')&&before*value>=minimum&&job.targetKind==='input'&&(ownLoad(job.target)||familyDelivery)&&!job.shapingBatch){
   const used=Math.min(needed/value,before);
   amount=used*value;
   if(resource==='food'){
    takeGiftFood(c,'giftCargo',used,before);
    takeFish(c,'fishCargo',used,before);
    if(!c.fishCargo)delete c.inspiredFishReturn;
    takeGrain(c,'grainCargo',used,before);
    acceptFishingCargo(s,c,used,before);
    acceptFieldGrain(s,c,used,false);
   }
   c.cargo[resource]-=used;
   if(c.cargo[resource]<=1e-7)delete c.cargo[resource];
   if(c.windCargo){
    c.windCargo=Math.min(c.windCargo,c.cargo[resource]||0);
    if(!c.windCargo){delete c.windCargo;delete c.windRoute;}
   }
   // The portion eaten on the road is no longer owed at the door.
   job.cancelled+=used;
   invalidateAssignments(s);
  }
 }
 if(!amount){
  const work=currentWorkCourt(c,ctx);
  if(work)amount=foodAtDoor(s,homeKey,work,needed,minimum);
 }
 if(!amount){
  const x=Math.round(c.x+.5)-.5,y=Math.round(c.y+.5)-.5;
  if(Math.hypot(c.x-x,c.y-y)>DOOR_REACH)return false;
  const network=ctx.network??=networkFor(s),nav=network.navigation;
  for(const p of network.ports){
   const b=p.building;
   if(p.x!==x||p.y!==y||b.siteKey||!(b===home&&b.stock||['depot','granary','shrine'].includes(b.type)||b.workshopStock?.output?.food>0||b.workshopStock?.output?.milk>0))continue;
   if(!doorReachable(s,c,p,nav))continue;
   amount=foodAtDoor(s,homeKey,p.building,needed,minimum);
   if(amount>0)break;
  }
 }
 if(!amount)return false;
 c.mealEaten=Math.min(portion,c.mealEaten+amount);
 c.hunger=clamp(c.hunger-45*amount/portion);
 c.health=clamp(c.health+2*amount/portion);
 return true;
}

export function advanceWellbeing(s,dt){
 const day=mealCycle(s.simTime),night=isDinnerTime(s.simTime),evaluating=!night&&s.citizens.some(c=>c.mealDay===day&&c.mealEvaluated<day),gardenJoy=evaluating?s.buildings.filter(b=>b.type==='garden'&&b.construction?.kind!=='new').reduce((n,b)=>n+2+2*(b.level||1),0):0;
 if(night){
  const households=new Map();
  let storyRecords;
  for(const c of s.citizens){
   if(c.mealDay!==day){c.mealDay=day;c.mealEaten=c.commonMealDay===day?COMMON_PORTION:0;c.familyMeal=false;}
   const mourning=s.funeral?.actors.some(a=>a.id===c.id);
   if(mourning&&s.funeral.scope!=='family')continue;
   const home=supplyHome(c,{arrived:true});
   if(!home)continue;
   if(!households.has(home))households.set(home,{members:[],diners:[]});
   const household=households.get(home);
   household.members.push(c);
   if(mourning)continue;
   if(!c.floodShelter&&!c.fireShelter&&(!['home','resting'].includes(c.phase)||c.phase!=='resting'&&Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)))continue;
   household.diners.push(c);
  }
  for(const b of s.buildings){const key=`${b.x},${b.y}`,household=households.get(key),family=household?.diners||[],members=household?.members;if(!isResidence(b)||!members||!((b.pantry||0)+(b.householdStock?.milk||0)*.5>0))continue;const requests=members.map(c=>Math.max(0,Math.min(mealRation(c)-c.mealEaten,mealRation(c)*.4*dt))),total=requests.reduce((a,b)=>a+b,0);if(total<=1e-9)continue;const share=Math.min(1,((b.pantry||0)+(b.householdStock?.milk||0)*.5)/total),present=new Set(family.map(c=>c.id)),fedAtHome=[];for(let i=0;i<members.length;i++){const amount=requests[i]*share;if(amount<=1e-9)continue;const c=members[i];c.mealEaten=Math.min(mealRation(c),c.mealEaten+amount);const milk=Math.min(b.householdStock?.milk||0,amount*2);if(milk)b.householdStock.milk-=milk;if(b.giftHome)takeGiftFood(b,'giftHome',amount-milk*.5,b.pantry);recordGrainDinner(s,b,amount-milk*.5);b.pantry=Math.max(0,(b.pantry||0)-(amount-milk*.5));c.hunger=clamp(c.hunger-45*amount/mealRation(c));c.health=clamp(c.health+2*amount/mealRation(c));if(present.has(c.id)){c.diningUntil=s.simTime+2;c.familyMeal||=family.length>1;fedAtHome.push(c);}if(c.floodShelter)recordArrivalShelter(s,b,c,amount);}
   if(s.godhood?.firstWaterHelp?.deliveredAt!==undefined&&family.length>1){
    storyRecords??=new Map((s.lifeAnalytics?.people||[]).map(p=>[p.id,p]));
    tellWaterStoryAtDinner(s,fedAtHome,storyRecords);
   }
  }
  for(const b of s.buildings)advanceEveningGame(s,b,households.get(`${b.x},${b.y}`)?.diners);
 }else if(evaluating){
  const furnished=new Map(s.buildings.filter(b=>isResidence(b)&&b.householdStock?.mat>=1&&!b.floodDamage).map(b=>[buildingKey(b),b.householdStock.mat]));
  const camps=new Set(s.buildings.filter(b=>b.reedCamp).map(buildingKey));
  for(const c of s.citizens){if(c.mealDay!==day||c.mealEvaluated>=day)continue;const quality=Math.min(1,c.mealEaten/mealRation(c)),fed=quality>=.95;const beforeMood=c.mood;c.lastMealQuality=quality;c.mealEvaluated=day;c.missedMeals=fed?0:c.missedMeals+1;if(fed)delete c.waitedForDinner;c.hunger=clamp(fed?c.hunger-20:Math.max(c.hunger+20*(1-quality),(1-quality)*100));const health=c.health;c.health=clamp(health+5*quality-28*(1-quality)-c.hunger*.04);if(camps.has(c.home))c.health=Math.min(c.health,Math.max(65,health-4));const mats=furnished.get(supplyHome(c,{arrived:true}))||0,comfort=mats>=1?1+Number(mats>=2&&s.season===1):0;c.mood=clamp(c.mood+(fed?3+comfort+(c.familyMeal?2:0)+Math.min(4,gardenJoy*.25):-12*(1-quality)));c.mealImpact={time:s.simTime,health:c.health-health,mood:c.mood-beforeMood};
  c.faith=clamp(c.faith+(fed?1:-8*(1-quality)));const prayer=knowsPresence(s,c)?c.faith/100*.15:0;s.resources.faith+=prayer;c.prayerTotal+=prayer;if(prayer>0&&isStrictSumer(s)&&isAwakening(s))s.godhood.lastPrayerCycle=day;}
 }

}
function validMealImpact(value,time){
 return value===undefined||!!value&&Number.isFinite(value.time)&&value.time>=0&&value.time<=time+1e-7&&
  ['health','mood'].every(key=>Number.isFinite(value[key])&&Math.abs(value[key])<=100);
}
export function validateWellbeing(s){const pct=n=>Number.isFinite(n)&&n>=0&&n<=100,int=n=>Number.isSafeInteger(n)&&n>=-1&&n<=1e9;return s.citizens.every(c=>(c.waitedForDinner===undefined||c.waitedForDinner===true&&c.missedMeals>=3)&&validMealImpact(c.mealImpact,s.simTime)&&['hunger','health','mood','faith'].every(k=>pct(c[k]))&&int(c.mealDay)&&c.mealDay<=mealCycle(s.simTime)&&int(c.mealEvaluated)&&c.mealEvaluated<=c.mealDay&&Number.isFinite(c.mealEaten)&&c.mealEaten>=0&&c.mealEaten<=mealRation(c)+1e-7&&Number.isInteger(c.missedMeals)&&c.missedMeals>=0&&c.missedMeals<=1e6&&Number.isFinite(c.lastMealQuality)&&c.lastMealQuality>=0&&c.lastMealQuality<=1&&typeof c.familyMeal==='boolean'&&Number.isFinite(c.diningUntil)&&c.diningUntil>=0&&c.diningUntil<=s.simTime+2.1&&Number.isFinite(c.prayerTotal)&&c.prayerTotal>=0&&c.prayerTotal<=1e9);}
