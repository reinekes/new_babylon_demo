import {REVELATION_PRICE} from './revelation-advice.js';
import {rainTrialReady} from './rain-discovery.js';
import {footprintSize} from './footprints.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {catTargetSite} from './pests.js';
import {foodAvailability,takeStock} from './inventory.js';
import {buildingKey,isOperational,MIRACLES} from './definitions.js';
import {hourOf,mealRation} from './wellbeing.js';
import {worldWidth,worldHeight,isDryPoint} from './world.js';
import {relicControlActive} from './relic-quest.js';

// Historical caller identity survives death; eligibility can pass to a survivor.
export function initializeCatDiscovery(s){if(usesCatDiscovery(s))s.catDiscovery??={version:1,firstCallingId:null,phase:'learning',initiatorId:null,offeredAt:null,eyesAt:null,openedAt:null,offering:null,trace:null,trial:'locked',usedAt:null};}
export function preparedFisherInspiration(s,c,profession){
 if(!usesCatDiscovery(s)||profession!=='fisher'||!c||c.age<16||s.godhood?.stage!=='recognized'||s.catFishing?.lessons?.[c.id]!==3||!s.catDiscovery||s.catDiscovery.phase!=='learning')return false;
 const first=s.catDiscovery.firstCallingId;
 return first===null||!s.citizens.some(v=>v.id===first);
}
export function acceptFisherInspiration(s,c,profession){
 if(!preparedFisherInspiration(s,c,profession))return;
 s.catDiscovery.firstCallingId=c.id;
 if(!s.godhood.believerIds.includes(c.id))s.godhood.believerIds.push(c.id);
 c.faith=Math.max(c.faith,55);
}
const nightAt=t=>hourOf(t)>=20||hourOf(t)<6?t:t+(20-hourOf(t))/ .4;
const dawnAfter=t=>t+((6-hourOf(t)+24)%24)/.4;
function news(s,title,text){s.news.unshift({title,text,kind:'good',year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
export function advanceCatDiscovery(s,dt){
 if(!usesCatDiscovery(s)||!Number.isFinite(dt)||dt<=0||!s.catDiscovery||s.lost||s.event||s.funeral||s.festival||s.miracleCelebration||relicControlActive(s))return;
 const q=s.catDiscovery,t=s.simTime||0;if(q.phase==='opened')return;
 if(q.phase==='learning'){
  if(s.godhood?.stage!=='recognized')return;
  const fisher=s.citizens.find(c=>c.age>=16&&c.calling==='fisher'&&c.role==='production'&&!c.pendingRole&&s.catFishing?.lessons?.[c.id]===3);
  if(!fisher)return;const site=catTargetSite(s);if(!site)return;
  const available=foodAvailability(s),total=[...available.values()].reduce((a,b)=>a+b,0),minimum=s.citizens.reduce((n,c)=>n+2*mealRation(c),0);
  let offering;
  if(total>=minimum+1){const sources={};let left=1;for(const [key,n]of available){const taken=takeStock(s,key,'food',Math.min(n,left));if(taken>0){sources[key]=taken;left-=taken;}if(left<1e-9)break;}offering={kind:'food',amount:1,sources};}
  else {const home=s.buildings.find(b=>b.type==='house'&&isOperational(b)&&b.water>=1);if(!home)return;home.water-=1;offering={kind:'water',amount:1,sources:{[buildingKey(home)]:1}};}
  Object.assign(q,{phase:'offering',initiatorId:fisher.id,offeredAt:t,offering,trace:{site:site.key,x:site.x,y:site.y}});
  news(s,'Тот, кто пришёл без приглашения',offering.kind==='food'?'Рыбак оставил малую порцию еды у хранилища. Ночью станет ясно, кто откликнется.':'Рыбак поставил чашу воды у хранилища. Ночью станет ясно, кто откликнется.');
 }
 const night=nightAt(q.offeredAt);
 if(q.phase==='offering'&&t+1e-7>=night){q.phase='eyes';q.eyesAt=night;news(s,'Два отражения в темноте','У чаши блеснули глаза. До утра никто не решился подойти.');}
 if(q.phase==='eyes'&&t+1e-7>=dawnAfter(q.eyesAt)){q.phase='opened';q.openedAt=dawnAfter(q.eyesAt);q.trial='ready';news(s,'След на глине','На рассвете у чаши нашли отпечатки лап. Открыт дар кошки: первый призыв не требует веры.');}
}
export function validateCatDiscovery(s){
 if(!usesCatDiscovery(s))return s.catDiscovery===undefined;
 const q=s.catDiscovery,fields=['version','firstCallingId','phase','initiatorId','offeredAt','eyesAt','openedAt','offering','trace','trial','usedAt'],id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId,time=n=>Number.isFinite(n)&&n>=0&&n<=(s.simTime||0)+1e-7,key=k=>typeof k==='string'&&/^\d+,\d+$/.test(k)&&k.split(',').every((v,i)=>Number(v)<(i?worldHeight(s):worldWidth(s)));
 if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).length!==fields.length||!fields.every(k=>Object.hasOwn(q,k))||q.version!==1||q.firstCallingId!==null&&!id(q.firstCallingId)||!['learning','offering','eyes','opened'].includes(q.phase))return false;
 if(q.phase==='learning')return q.initiatorId===null&&q.offeredAt===null&&q.eyesAt===null&&q.openedAt===null&&q.offering===null&&q.trace===null&&q.trial==='locked'&&q.usedAt===null;
 if(!id(q.initiatorId)||!time(q.offeredAt)||!q.offering||Object.keys(q.offering).length!==3||!['food','water'].includes(q.offering.kind)||q.offering.amount!==1||!q.offering.sources||typeof q.offering.sources!=='object'||Array.isArray(q.offering.sources)||Object.keys(q.offering.sources).length>worldWidth(s)*worldHeight(s)||Object.entries(q.offering.sources).some(([k,n])=>!key(k)||!Number.isFinite(n)||n<=0||n>1)||Math.abs(Object.values(q.offering.sources).reduce((a,b)=>a+b,0)-1)>1e-7||!q.trace||Object.keys(q.trace).length!==3||!key(q.trace.site)||!Number.isFinite(q.trace.x)||!Number.isFinite(q.trace.y)||q.trace.x<0||q.trace.y<0||q.trace.x>=worldWidth(s)||q.trace.y>=worldHeight(s))return false;
 if(q.phase==='offering')return q.eyesAt===null&&q.openedAt===null&&q.trial==='locked'&&q.usedAt===null;
 if(!time(q.eyesAt)||Math.abs(q.eyesAt-nightAt(q.offeredAt))>1e-7)return false;
 if(q.phase==='eyes')return q.openedAt===null&&q.trial==='locked'&&q.usedAt===null;
 return time(q.openedAt)&&Math.abs(q.openedAt-dawnAfter(q.eyesAt))<1e-7&&(q.trial==='ready'&&q.usedAt===null||q.trial==='spent'&&time(q.usedAt)&&q.usedAt>=q.openedAt);
}

export function miraclePrice(s,id){if(id==='revelation'&&s.revelationEvidence)return REVELATION_PRICE;if(id==='rain'&&rainTrialReady(s))return 0;return id==='cat'&&usesCatDiscovery(s)&&s.catDiscovery?.phase==='opened'&&s.catDiscovery.trial==='ready'?0:MIRACLES[id]?.cost;}

// Presentation reads a saved deed; it never opens the gift or spawns an animal.
export function catDiscoveryView(s){
 const q=s.catDiscovery,p=q?.trace;if(!usesCatDiscovery(s)||!p||q.phase==='learning')return null;
 const free=(x,y)=>isDryPoint(s,x,y)&&!s.buildings.some(b=>{const n=footprintSize(b);return x>b.x-.56&&x<b.x+n-.44&&y>b.y-.56&&y<b.y+n-.44;});
 if(!free(p.x,p.y))return null;
 const tracks=q.phase==='opened'?[[-.18,.15],[-.10,.10],[-.02,.04],[.06,-.01]].map(([dx,dy],i)=>({x:p.x+dx,y:p.y+dy,angle:-.7+(i%2)*.2})).filter(a=>free(a.x,a.y)):[];
 return {x:p.x,y:p.y,bowl:q.offering.kind,eyes:q.phase==='eyes'&&(hourOf(s.simTime||0)>=20||hourOf(s.simTime||0)<6),tracks};
}
