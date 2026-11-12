import {buildingKey,isOperational} from './definitions.js';
import {homeMealFood} from './households.js';

const LIMIT=8;
const dayOf=s=>Math.floor(s.simTime/60);

export function recordWaterChoice(s,preferred,before,after){
 if(!s.civicOrder)return;
 const lost=[...before.keys()].filter(key=>!after.has(key));
 const gained=[...after.keys()].filter(key=>!before.has(key));
 if(!lost.length||!gained.length)return;
 const gainedKeys=new Set(gained);
 const fields=[...gained.slice(0,6),...lost.slice(0,6)].map(key=>{
  const field=s.buildings.find(b=>b.type==='field'&&buildingKey(b)===key);
  return {key,order:field?.built?.order??null,irrigated:gainedKeys.has(key),yield:null,harvested:null};
 });
 const crisis={day:dayOf(s),year:s.year,preferred,fields,aid:null};
 s.waterCrises=[crisis,...(s.waterCrises||[])].slice(0,LIMIT);
}

export function linkWaterCrisisAid(s,crisis,incident,job){
 if(!s.waterCrises?.includes(crisis)||crisis.aid||!incident||job?.target!==incident.home||job.resource!=='food')return false;
 const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===incident.home&&isOperational(b));
 if(!home)return false;
 crisis.aid={job:job.id,home:incident.home,homeId:home.waterEntityId??null,person:incident.person,
  day:dayOf(s),initialFood:homeMealFood(home),ordered:job.amount,delivered:job.delivered,after:null};
 return true;
}

export function recordWaterCrisisDelivery(s,job){
 for(const crisis of s.waterCrises||[])if(crisis.aid?.job===job.id)crisis.aid.delivered=job.delivered;
}

export function reviewWaterCrisisNeeds(s){
 const day=dayOf(s);
 for(const {aid} of s.waterCrises||[]){
  if(!aid||aid.after||day<aid.day+3)continue;
  const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===aid.home&&(b.waterEntityId??null)===aid.homeId);
  const person=s.citizens.find(c=>c.id===aid.person&&c.home===aid.home);
  aid.after={day,food:home?homeMealFood(home):null,hunger:person?.hunger??null};
 }
}

export function recordWaterCrisisHarvest(s,field,crop,stage){
 for(const crisis of s.waterCrises||[]){
  const row=crisis.fields.find(f=>f.key===buildingKey(field)&&f.order===(field.built?.order??null));
  if(!row)continue;
  if(stage==='ready'&&row.yield===null)row.yield=crop.total;
  if(stage==='closed'&&row.yield!==null&&row.harvested===null)row.harvested=crop.harvested;
 }
}

export function validateWaterCrises(s){
 if(s.waterCrises===undefined)return true;
 const key=x=>typeof x==='string'&&/^\d+,\d+$/.test(x);
 const int=(x,max=Infinity)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
 const value=x=>Number.isFinite(x)&&x>=0;
 const maybe=x=>x===null||value(x);
 const aid=a=>a===null||!!a&&int(a.job)&&key(a.home)&&(a.homeId===null||int(a.homeId))&&int(a.person)&&
  int(a.day,dayOf(s))&&value(a.initialFood)&&value(a.ordered)&&a.ordered>0&&value(a.delivered)&&a.delivered<=a.ordered+1e-7&&
  (a.after===null||!!a.after&&int(a.after.day,dayOf(s))&&a.after.day>=a.day+3&&maybe(a.after.food)&&maybe(a.after.hunger));
 return Array.isArray(s.waterCrises)&&s.waterCrises.length<=LIMIT&&s.waterCrises.every(c=>
  c&&int(c.day,dayOf(s))&&int(c.year,s.year)&&(c.preferred===null||key(c.preferred))&&aid(c.aid)&&
  Array.isArray(c.fields)&&c.fields.length>=2&&c.fields.length<=12&&c.fields.some(f=>f?.irrigated===true)&&
  c.fields.some(f=>f?.irrigated===false)&&c.fields.every(f=>f&&key(f.key)&&(f.order===null||int(f.order))&&
   typeof f.irrigated==='boolean'&&maybe(f.yield)&&maybe(f.harvested)));
}
