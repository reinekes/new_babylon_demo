import {recordCompletedCare} from './peace-discovery.js';
import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {homeMealFood} from './households.js';
import {hourOf,mealRation} from './wellbeing.js';

const CARE_TIME=1.5;
const CARE_WATER=.25;
const careDay=time=>Math.floor(time/60);
const atHome=c=>c.phase==='home'&&!c.clinic&&!c.school&&!c.floodShelter&&!c.waterTrip&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.pantryTrip&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);
const related=(a,b)=>a.id!==b.id&&(a.partner===b.id||a.parents?.includes(b.id)||b.parents?.includes(a.id)||a.parents?.some(id=>b.parents?.includes(id)));
const need=c=>c.health<65?3:c.age<3?2:c.age>=55?1:0;

export function advanceFamilyCare(s,dt,mourners){
 const hour=hourOf(s.simTime);
 if(!isStrictSumer(s)||hour<18||hour>=20)return null;
 const day=careDay(s.simTime),families=new Map(),busy=new Set();
 for(const c of s.citizens){
  if(!families.has(c.home))families.set(c.home,{people:[],meal:0});
  const family=families.get(c.home);
  family.meal+=mealRation(c);
  if(atHome(c)&&!mourners?.has(c.id))family.people.push(c);
 }
 for(const house of s.buildings){
  if(house.type!=='house'||!isOperational(house)||house.water<CARE_WATER||house.familyCare?.day===day&&house.familyCare.done)continue;
  const family=families.get(buildingKey(house));
  if(!family||family.people.length<2||homeMealFood(house)+1e-7<family.meal)continue;
  const patients=family.people.filter(c=>need(c)>0).sort((a,b)=>need(b)-need(a)||a.health-b.health||a.id-b.id);
  for(const patient of patients){
   const helper=family.people.find(c=>c.age>=16&&c.health>=65&&c.hunger<30&&related(c,patient));
   if(!helper)continue;
   const old=house.familyCare;
   const visit=old?.day===day&&old.helper===helper.id&&old.target===patient.id?old:{day,helper:helper.id,target:patient.id,work:0,done:false};
   house.familyCare=visit;
   visit.work=Math.min(CARE_TIME,visit.work+dt);
   busy.add(helper.id);busy.add(patient.id);
   if(visit.work>=CARE_TIME-1e-8){
    visit.work=CARE_TIME;visit.done=true;
    house.water-=CARE_WATER;
    patient.thirst=Math.max(0,patient.thirst-10);
    patient.mood=Math.min(100,patient.mood+8);
    recordCompletedCare(s,helper,patient);
   }
   break;
  }
 }
 return busy;
}

export function validateFamilyCare(s){
 return s.buildings.every(b=>{
  const v=b.familyCare;
  return v===undefined||isStrictSumer(s)&&b.type==='house'&&isOperational(b)&&v&&typeof v==='object'&&Object.keys(v).length===5&&
   Number.isSafeInteger(v.day)&&v.day>=0&&v.day<=careDay(s.simTime)&&
   Number.isSafeInteger(v.helper)&&v.helper>=0&&Number.isSafeInteger(v.target)&&v.target>=0&&v.helper!==v.target&&
   Number.isFinite(v.work)&&v.work>0&&v.work<=CARE_TIME&&v.done===(v.work===CARE_TIME);
 });
}
