import {kilnFireRisk} from './fire-forecast.js';
import {cityCommandReason} from './city-command-lock.js';
import {isStrictSumer} from './scenario-profiles.js';
import {recordBuildingProduction} from './building-production-history.js';
import {isOperational,outputMultiplier} from './definitions.js';
export const KILN_RECIPE=Object.freeze({brick:4,reed:3});
export const KILN_WEAR_LIMIT=8;
export const kilnNeedsRepair=b=>b?.kilnWear===KILN_WEAR_LIMIT;
export const FIRING_SECONDS=20,COOLING_SECONDS=8,IGNITION_CHECK=10,FIRE_RESPONSE_SECONDS=60;
const fields=['brick','reed','hot','time','ready'];
const empty=()=>({brick:0,reed:0,hot:0,time:0,ready:0});
function valid(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===fields.length&&fields.every(k=>Number.isFinite(v[k])&&v[k]>=0)&&v.brick<=4&&v.reed<=3&&[0,4].includes(v.hot)&&[0,4].includes(v.ready)&&!(v.hot&&v.ready)&&v.time<FIRING_SECONDS+COOLING_SECONDS&&(!v.time||v.hot>0)&&(!v.hot&&!v.ready||v.brick===0&&v.reed===0);}
export function initializeKilns(s){for(const b of s.buildings||[])if(b.type==='kiln'&&b.firing===undefined)b.firing=empty();}
export function kilnNeeds(b){const v=b?.firing;return b?.type==='kiln'&&isOperational(b)&&valid(v)&&!v.hot&&!v.ready?(kilnNeedsRepair(b)?{brick:Math.max(0,1-v.brick),reed:0}:{brick:4-v.brick,reed:3-v.reed}):{brick:0,reed:0};}
// Loading/ignition is worker action; charged fuel keeps burning overnight.
export function startFiring(b){const v=b?.firing;if(b?.type!=='kiln'||!isOperational(b)||!valid(v)||b.kilnBanked||v.hot||v.ready||kilnNeedsRepair(b)||v.brick<4||v.reed<3)return 0;v.brick-=4;v.reed-=3;v.hot=4;v.time=0;return 4;}
function bankBatch(b){
 const batch=b.firing;
 Object.assign(batch,{brick:batch.hot,hot:0,time:0});
 delete b.kilnFire;
 delete b.kilnFireElapsed;
 b.kilnBanked=true;
}
export function setKilnBanked(s,b,banked){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 if(!isStrictSumer(s)||!s.buildings.includes(b)||b.type!=='kiln'||!isOperational(b)||!valid(b.firing))return {ok:false,reason:'Нужна действующая кирпичная печь'};
 if(!banked){
  if(!b.kilnBanked)return {ok:false,reason:'Печь не остановлена'};
  delete b.kilnBanked;
  return {ok:true};
 }
 const batch=b.firing;
 if(!batch.hot||batch.time>=FIRING_SECONDS)return {ok:false,reason:'Можно остановить только горящий обжиг'};
 bankBatch(b);
 return {ok:true};
}
// Called after a resident completes the ordinary kiln work interval.
export function repairKiln(b){
 const v=b?.firing;
 if(!kilnNeedsRepair(b)||!isOperational(b)||!valid(v)||v.hot||v.ready||v.brick<1)return false;
 v.brick--;b.kilnWear=0;
 return true;
}
export function advanceKilns(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;
 for(const b of s.buildings||[]){
  const batch=b.firing;
  if(b.type!=='kiln'||!isOperational(b)||!valid(batch)||!batch.hot)continue;
  if(b.kilnFire){
   const elapsed=(b.kilnFireElapsed||0)+dt;
   if(elapsed+1e-8<FIRE_RESPONSE_SECONDS)b.kilnFireElapsed=elapsed;
   else{
    bankBatch(b);
    b.kilnWear=KILN_WEAR_LIMIT;
    if(s.news){s.news.unshift({title:'Очаг повредил кирпичную печь',text:'Сырец сохранён. Печнику нужен один сырцовый кирпич для ремонта.',kind:'bad',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
   }
   continue;
  }
  const next=batch.time+dt*outputMultiplier(b);
  if(batch.time<IGNITION_CHECK&&next>=IGNITION_CHECK&&isStrictSumer(s)&&kilnFireRisk(s,b)){
   batch.time=IGNITION_CHECK;
   b.kilnFire=true;
   if(s.news){s.news.unshift({title:'Очаг у кирпичной печи',text:'Останови обжиг или используй запас воды соседей в обзоре города.',kind:'bad',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
   continue;
  }
  batch.time=next;
  if(batch.time>=FIRING_SECONDS+COOLING_SECONDS){
   batch.ready=batch.hot;batch.hot=0;batch.time=0;
   if(b.kilnWear!==undefined)b.kilnWear++;
   recordBuildingProduction(s,b,'firedBrick',batch.ready);
  }
 }
}
export function collectFired(b){if(b?.type!=='kiln'||!isOperational(b)||!valid(b.firing))return 0;const n=b.firing.ready;b.firing.ready=0;return n;}
export function validateKilns(s){return Array.isArray(s.buildings)&&s.buildings.every(b=>b.type==='kiln'?valid(b.firing)&&(b.kilnFire===undefined||b.kilnFire===true&&isStrictSumer(s)&&b.firing.hot>0&&b.firing.time===IGNITION_CHECK)&&(b.kilnFireElapsed===undefined||b.kilnFire===true&&Number.isFinite(b.kilnFireElapsed)&&b.kilnFireElapsed>=0&&b.kilnFireElapsed<FIRE_RESPONSE_SECONDS)&&(b.kilnBanked===undefined||b.kilnBanked===true&&isStrictSumer(s)&&!b.firing.hot&&!b.firing.ready)&&(b.kilnWear===undefined||Number.isInteger(b.kilnWear)&&b.kilnWear>=0&&b.kilnWear<=KILN_WEAR_LIMIT&&!(b.firing.hot&&kilnNeedsRepair(b))):!Object.hasOwn(b,'kilnFireElapsed')&&!Object.hasOwn(b,'kilnFire')&&!Object.hasOwn(b,'kilnBanked')&&!Object.hasOwn(b,'firing')&&!Object.hasOwn(b,'kilnWear'));}
