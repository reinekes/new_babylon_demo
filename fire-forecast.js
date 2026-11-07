import {buildingKey,isOperational} from './definitions.js';
import {weatherAt} from './environment.js';
import {FIRING_SECONDS,FIRE_RESPONSE_SECONDS,kilnNeedsRepair} from './kilns.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {waterDemand,waterpointCanReach} from './water.js';

const MIN_RESPONSE_WATER=2;

function fireConditions(s){
 const weather=weatherAt(s).type,wind=weather==='wind';
 return {wind,dry:weather!=='rain'&&(s.drought>0||s.season===1&&(weather==='sunny'||wind))};
}
function exposedHomes(s,kiln){
 const homes=new Map();
 for(const b of s.buildings){
  if(b.type==='house'&&isOperational(b)&&Math.max(Math.abs(b.x-kiln.x),Math.abs(b.y-kiln.y))<=1)
   homes.set(buildingKey(b),{home:b,need:0});
 }
 for(const c of s.citizens){
  const row=homes.get(c.home);
  if(row&&!c.floodShelter)row.need+=waterDemand(c);
 }
 return [...homes.values()].filter(row=>row.need>0).map(({home,need})=>({home,surplus:Math.max(0,(home.water||0)-need)}));
}
const totalWater=rows=>rows.reduce((sum,row)=>sum+row.surplus,0);
function reachableWater(s,kiln,homes){
 const key=buildingKey(kiln);
 return homes.filter(({home,surplus})=>surplus>0&&waterpointCanReach(s,key,buildingKey(home)));
}
export function kilnFireRisk(s,kiln){
 const {dry,wind}=fireConditions(s);
 if(!dry||!wind)return false;
 const homes=exposedHomes(s,kiln);
 return homes.length>0&&totalWater(reachableWater(s,kiln,homes))+1e-8<MIN_RESPONSE_WATER;
}
export function extinguishKilnFire(s,kiln){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 if(!kiln?.kilnFire||!s.buildings.includes(kiln))return {ok:false,reason:'У этой печи нет очага'};
 const sources=reachableWater(s,kiln,exposedHomes(s,kiln));
 if(totalWater(sources)+1e-8<MIN_RESPONSE_WATER)return {ok:false,reason:'Нужны 2 единицы воды сверх питьевого запаса в соседних дворах с проходом'};
 let remaining=MIN_RESPONSE_WATER;
 for(const {home,surplus} of sources){
  const used=Math.min(surplus,remaining);
  home.water-=used;
  remaining-=used;
  if(remaining<=1e-8)break;
 }
 delete kiln.kilnFire;
 delete kiln.kilnFireElapsed;
 return {ok:true};
}
export function fireForecast(s){
 if(!isStrictSumer(s))return null;
 const kilns=s.buildings.filter(b=>b.type==='kiln'&&isOperational(b));
 if(!kilns.length)return null;
 const {dry,wind}=fireConditions(s);
 const sites=[];
 for(const kiln of kilns){
  if(!kiln.firing?.hot||kiln.firing.time>=FIRING_SECONDS)continue;
  const homes=exposedHomes(s,kiln),reserve=totalWater(reachableWater(s,kiln,homes)),fire=kiln.kilnFire===true;
  const level=!homes.length||!dry&&!wind?'low':dry&&wind&&reserve+1e-8<MIN_RESPONSE_WATER?'high':'watch';
  sites.push({key:buildingKey(kiln),homes:homes.map(({home})=>buildingKey(home)),reserve,level,fire,remaining:fire?Math.max(0,FIRE_RESPONSE_SECONDS-(kiln.kilnFireElapsed||0)):null,
   canExtinguish:fire&&reserve+1e-8>=MIN_RESPONSE_WATER});
 }
 return {dry,wind,sites,banked:kilns.filter(b=>b.kilnBanked).map(b=>({key:buildingKey(b),repair:kilnNeedsRepair(b)}))};
}
