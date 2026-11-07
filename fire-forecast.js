import {buildingKey,isOperational} from './definitions.js';
import {weatherAt} from './environment.js';
import {FIRING_SECONDS} from './kilns.js';
import {isStrictSumer} from './scenario-profiles.js';
import {waterDemand} from './water.js';

const MIN_RESPONSE_WATER=2;

export function fireForecast(s){
 if(!isStrictSumer(s))return null;
 const kilns=s.buildings.filter(b=>b.type==='kiln'&&isOperational(b));
 if(!kilns.length)return null;
 const weather=weatherAt(s).type,wind=weather==='wind';
 const dry=weather!=='rain'&&(s.drought>0||s.season===1&&(weather==='sunny'||wind));
 const householdNeeds=new Map();
 for(const citizen of s.citizens){
  if(!citizen.home||citizen.floodShelter)continue;
  householdNeeds.set(citizen.home,(householdNeeds.get(citizen.home)||0)+waterDemand(citizen));
 }
 const homes=new Map(s.buildings.filter(b=>b.type==='house'&&isOperational(b)).map(b=>[buildingKey(b),b]));
 const sites=[];
 for(const kiln of kilns){
  if(!kiln.firing?.hot||kiln.firing.time>=FIRING_SECONDS)continue;
  const exposed=[];
  let reserve=0;
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
   if(!dx&&!dy)continue;
   const key=buildingKey({x:kiln.x+dx,y:kiln.y+dy}),home=homes.get(key),need=householdNeeds.get(key);
   if(!home||need===undefined)continue;
   exposed.push(key);
   reserve+=Math.max(0,(home.water||0)-need);
  }
  const level=!exposed.length||!dry&&!wind?'low':dry&&wind&&reserve<MIN_RESPONSE_WATER?'high':'watch';
  sites.push({key:buildingKey(kiln),homes:exposed,reserve,level});
 }
 return {dry,wind,sites,banked:kilns.filter(b=>b.kilnBanked).map(buildingKey)};
}
