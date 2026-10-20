import {naturalAnimalsFor} from './fauna.js';
import {catPettingPairs} from './pests.js';
import {isDryPoint,WIDTH,HEIGHT} from './world.js';
import {BUILDINGS,buildingKey,isOperational} from './definitions.js';

export const GATHERING_TYPES=['logging','quarry','hunting','fishing'];
const kindFor={logging:'tree',quarry:'rock'},clamp=n=>Math.max(0,Math.min(1,n));
const localLegs=new WeakMap();
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function initializeGathering(s){s.gathering??={features:[],jobs:[],kills:[]};return s.gathering;}
export function clearGround(s,p){return isDryPoint(s,p.x,p.y)&&!s.buildings.some(b=>!['field','garden','canal','bridge'].includes(b.type)&&Math.abs(p.x-b.x)<.43&&Math.abs(p.y-b.y)<.43);}
export function gatheringPathClear(s,a,b){const steps=Math.max(1,Math.ceil(distance(a,b)*18));for(let i=0;i<=steps;i++)if(!clearGround(s,{x:a.x+(b.x-a.x)*i/steps,y:a.y+(b.y-a.y)*i/steps}))return false;return true;}
function pointNear(s,origin,radius,angle){return {x:origin.x+Math.cos(angle)*radius,y:origin.y+Math.sin(angle)*radius};}
function featureTargets(s,b,origin){
 const g=initializeGathering(s),kind=kindFor[b.type],prefix=`${kind}:${buildingKey(b)}:`;
 let features=g.features.filter(f=>f.id.startsWith(prefix));if(features.length)return features;
 for(let i=0;i<12&&features.length<4;i++){const p=pointNear(s,origin,.32+(i%3)*.15,i*2.399);if(!clearGround(s,p)||!gatheringPathClear(s,origin,p))continue;
  const f={id:prefix+features.length,kind,...p,health:1,felledAt:null,recoverAt:null};g.features.push(f);features.push(f);
 }return features;
}
function stance(s,c,target,reach=.15){const d=distance(c,target)||1,p={x:target.x+(c.x-target.x)/d*reach,y:target.y+(c.y-target.y)/d*reach};return clearGround(s,p)&&gatheringPathClear(s,c,p)?p:null;}
function newJob(s,c,b,origin){
 const g=initializeGathering(s),reserved=new Set(g.jobs.filter(j=>j.citizen!==c.id).map(j=>j.target.id));let target=null,stand=null;
 if(kindFor[b.type]){
  const options=featureTargets(s,b,origin).filter(f=>f.health>0&&!reserved.has(f.id)).sort((a,b)=>distance(c,a)-distance(c,b));
  for(const f of options){const p=stance(s,c,f);if(p){target={id:f.id,kind:f.kind,x:f.x,y:f.y};stand=p;break;}}
 }else if(b.type==='hunting'){
  const killed=new Set(g.kills.filter(k=>s.simTime<k.respawnAt).map(k=>k.id));
  const prey=naturalAnimalsFor(s).filter(a=>a.kind==='gazelle'&&!reserved.has(a.id)&&!killed.has(a.id)&&distance(origin,a)<6).sort((a,b)=>distance(c,a)-distance(c,b));
  for(const a of prey){const p=stance(s,c,a,.65);if(p){target={id:a.id,kind:a.kind,x:a.x,y:a.y};stand=p;break;}}
 }else if(b.type==='fishing'){
  const fish=naturalAnimalsFor(s).filter(a=>a.kind==='fish'&&!reserved.has(a.id)&&distance(origin,a)<3).sort((a,b)=>distance(c,a)-distance(c,b));
  for(const a of fish){
   // Walk to an actual dry bank, then cast a plain line into visible water.
   for(let d=.23;d<1.7&&!stand;d+=.09)for(let i=0;i<12;i++){const p=pointNear(s,a,d,i*Math.PI/6);if(clearGround(s,p)&&gatheringPathClear(s,c,p)&&g.jobs.every(j=>distance(j.stand,p)>.18)){stand=p;break;}}
   if(stand){target={id:a.id,kind:'fish',x:a.x,y:a.y};break;}
  }
 }
 if(!target||!stand)return null;
 const job={citizen:c.id,work:c.work,kind:b.type,target,stand,origin:{x:origin.x,y:origin.y},stage:'approach',progress:0};g.jobs.push(job);return job;
}
function move(c,to,dt,rate=1){const d=distance(c,to),step=Math.min(d,dt*.65*Math.max(.5,rate));if(d>1e-8){c.x+=(to.x-c.x)*step/d;c.y+=(to.y-c.y)*step/d;}return d-step<1e-6;}
/** Actual local work trip. A load can only be collected once its target was worked. */
export function workGathering(s,c,b,dt,rate,origin){
 const g=initializeGathering(s);let j=g.jobs.find(j=>j.citizen===c.id);
 if(j&&j.work!==c.work){g.jobs=g.jobs.filter(v=>v!==j);j=null;}
 if(!j)j=newJob(s,c,b,origin||c);if(!j)return false;
 if(j.stage==='approach'){if(move(c,j.stand,dt,rate))j.stage='working';return false;}
 c.workElapsed=Math.min(BUILDINGS[b.type].workTime,c.workElapsed+dt*rate);j.progress=clamp(c.workElapsed/BUILDINGS[b.type].workTime);
 if(j.progress<1)return false;
 if(b.type==='hunting'){
  // The same living actor falls; this ID cannot yield a second load until recovery.
  if(g.kills.some(k=>k.id===j.target.id&&s.simTime<k.respawnAt)){g.jobs=g.jobs.filter(v=>v!==j);c.workElapsed=0;return false;}
  g.kills.push({...j.target,time:s.simTime,respawnAt:s.simTime+180});
 }else if(kindFor[b.type]){
  const f=g.features.find(f=>f.id===j.target.id);if(!f||f.health<=0){g.jobs=g.jobs.filter(v=>v!==j);c.workElapsed=0;return false;}
  f.health=Math.max(0,f.health-(b.type==='logging'?1:.2));if(f.health<1e-7){f.health=0;f.felledAt=s.simTime;f.recoverAt=s.simTime+(b.type==='logging'?120:180);}
 }
 // Collect at the target, then carry the actual load back over the same dry leg.
 g.jobs=g.jobs.filter(v=>v!==j);c.workElapsed=0;return j.origin;
}
export function advanceGathering(s){
 const g=initializeGathering(s),active=new Set(s.buildings.filter(isOperational).filter(b=>GATHERING_TYPES.includes(b.type)).map(buildingKey));
 const signature=s.buildings.map(b=>`${b.type}:${b.x},${b.y}`).join('|');let paths=localLegs.get(s);if(paths?.signature!==signature){paths={signature,legs:new WeakMap()};localLegs.set(s,paths);}
 g.jobs=g.jobs.filter(j=>{if(!active.has(j.work)||!s.citizens.some(c=>c.id===j.citizen&&c.work===j.work&&c.phase==='working'))return false;if(!paths.legs.has(j))paths.legs.set(j,clearGround(s,j.stand)&&gatheringPathClear(s,j.origin,j.stand));return paths.legs.get(j);});
 g.features=g.features.filter(f=>active.has(f.id.split(':')[1]));
 for(const f of g.features)if(f.recoverAt!==null&&s.simTime>=f.recoverAt){f.health=1;f.felledAt=null;f.recoverAt=null;}
 g.kills=g.kills.filter(k=>s.simTime<k.respawnAt);
}
/** Read-only renderer contract; no rewards, moves or writes occur in a view. */
export function actorWorkActivity(s,c,pettingPairs){
 if(c.activity)return c.activity;
 const j=s.gathering?.jobs.find(j=>j.citizen===c.id&&j.work===c.work&&c.phase==='working');
 if(j)return {kind:j.kind,target:j.target,progress:j.progress,stage:j.stage==='working'&&j.progress>.8?'strike':j.stage};
 const pair=(pettingPairs||catPettingPairs(s)).find(p=>p.citizenId===c.id);return pair?{kind:'petting',target:{x:pair.x,y:pair.y},progress:((s.simTime||0)%3)/3,stage:'working'}:null;
}
export function validateGathering(s){
 const g=s.gathering,finite=(n,min=0,max=1e9)=>Number.isFinite(n)&&n>=min&&n<=max,point=p=>p&&finite(p.x,-.5,WIDTH-.5)&&finite(p.y,-.5,HEIGHT-.5),unique=a=>new Set(a).size===a.length;
 if(!g||!Array.isArray(s.citizens)||!Array.isArray(s.buildings)||!Array.isArray(g.features)||!Array.isArray(g.jobs)||!Array.isArray(g.kills)||g.features.length>5120||g.jobs.length>s.population||g.kills.length>128)return false;
 if(!unique(g.features.map(f=>f.id))||!unique(g.jobs.map(j=>j.citizen))||!unique(g.kills.map(k=>k.id)))return false;
 if(g.features.some(f=>typeof f.id!=='string'||!/^((tree)|(rock)):\d+,\d+:[0-3]$/.test(f.id)||!['tree','rock'].includes(f.kind)||!point(f)||!finite(f.health,0,1)||(f.felledAt!==null&&!finite(f.felledAt,0,s.simTime+.1))||(f.recoverAt!==null&&!finite(f.recoverAt))||((f.health===0)!==(f.recoverAt!==null))))return false;
 if(g.kills.some(k=>typeof k.id!=='string'||!/^gazelle-\d+$/.test(k.id)||k.kind!=='gazelle'||!point(k)||!finite(k.time,0,s.simTime+.1)||!finite(k.respawnAt,k.time, k.time+180.001)))return false;
 const natural=new Map(naturalAnimalsFor(s).map(a=>[a.id,a]));
 if(!unique(g.jobs.map(j=>j.target?.id)))return false;
 return !g.jobs.some(j=>{
  if(!Number.isInteger(j.citizen)||!s.citizens.some(c=>c.id===j.citizen&&c.work===j.work)||typeof j.work!=='string'||!s.buildings.some(b=>buildingKey(b)===j.work&&b.type===j.kind)||!GATHERING_TYPES.includes(j.kind)||!point(j.target)||typeof j.target.id!=='string'||!point(j.stand)||!point(j.origin)||!['approach','working','return'].includes(j.stage)||!finite(j.progress,0,1))return true;
  if(!clearGround(s,j.stand)||!gatheringPathClear(s,j.origin,j.stand))return true;
  if(kindFor[j.kind])return !g.features.some(f=>f.id===j.target.id&&f.kind===kindFor[j.kind]&&f.health>0&&f.x===j.target.x&&f.y===j.target.y);
  return natural.get(j.target.id)?.kind!==(j.kind==='hunting'?'gazelle':'fish')||j.target.kind!==(j.kind==='hunting'?'gazelle':'fish');
 });
}
