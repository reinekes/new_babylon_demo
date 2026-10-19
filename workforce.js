import {advanceFuneral} from './funerals.js';
import {advanceTradeLogistics,loadSaleCargo} from './trading.js';
import {ensureRoads,roadSpeed} from './roads.js';
import {isComplete,materialsReady,finishConstruction,orderedSites,constructionEntities,workRequired} from './construction.js';
import {BUILDINGS,buildingKey,capacityOf,outputMultiplier,storageOf,isOperational,MATERIALS} from './definitions.js';
import {generateStreets,DAY_SECONDS} from './city-life.js';
import {onBridge} from './world.js';

const caches=new WeakMap();
const hasCargo=c=>Object.values(c.cargo).some(v=>v>0);
const hasBuildCargo=c=>Object.values(c.buildCargo||{}).some(v=>v>0);
export function invalidateAssignments(s){const cache=caches.get(s);if(cache)cache.synced=null;}
function beginSiteTrip(s,c,ctx){startTrip(s,c,c.siteDuty==='builder'?c.sitePort:c.store,c.siteDuty==='builder'?'toSite':'toSupply',ctx);}
const hourAt=t=>((8+t*24/DAY_SECONDS)%24+24)%24;
export const isWorkday=t=>hourAt(t)>=6&&hourAt(t)<19;
const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);

export function networkFor(s){
 const signature=[...s.buildings,...s.roadAnchors||[]].map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||'ready'}`).join('|');
 let cache=caches.get(s);
 if(!cache||cache.signature!==signature){cache={signature,network:generateStreets([...s.buildings,...s.roadAnchors||[]],s),paths:new Map(),synced:null};caches.set(s,cache);}
 if(cache.roads!==s.roads||cache.roadCount!==s.roads?.length){ensureRoads(s,cache.network);cache.roads=s.roads;cache.roadCount=s.roads.length;}return cache.network;
}
export function routeBetween(s,from,to){
 const network=networkFor(s),cache=caches.get(s),key=`${from}>${to}`;
 if(cache.paths.has(key))return cache.paths.get(key);
 if(!from||!to||network.components.get(from)!==network.components.get(to)){cache.paths.set(key,null);return null;}
 const queue=[from],prev=new Map([[from,null]]);
 for(let i=0;i<queue.length;i++){
  const current=queue[i];
  if(current===to){const path=[];for(let p=current;p!==null;p=prev.get(p))path.push(network.nodes.get(p));const result=path.reverse();cache.paths.set(key,result);return result;}
  for(const next of network.graph.get(current)||[])if(!prev.has(next)){prev.set(next,current);queue.push(next);}
 }
 cache.paths.set(key,null);return null;
}
function context(s){
 const network=networkFor(s),ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));
 for(const p of network.ports.filter(p=>p.building.siteKey))ports.set(`site:${p.building.siteKey}:${p.building.side}`,p);
 const stores=s.buildings.filter(b=>isComplete(b)&&(b.type==='granary'||b.type==='shrine'));
 if(!stores.length&&s.buildings.some(b=>b.type==='house'&&isComplete(b)))stores.push(s.buildings.find(b=>b.type==='house'&&isComplete(b)));
 for(const r of s.roads||[])ports.set(r.id,{...r.a,building:r});
 return {network,ports,stores,buildings:new Map(constructionEntities(s).map(b=>[buildingKey(b),b]))};
}
function closestStore(s,ctx,work){
 const p=ctx.ports.get(work);if(!p)return null;
 let best=null,length=Infinity;
 for(const b of ctx.stores){const key=buildingKey(b),target=ctx.ports.get(key);if(!target)continue;const route=routeBetween(s,p.key,target.key);if(route&&route.length<length){best=key;length=route.length;}}
 return best;
}
function startTrip(s,c,targetKey,phase,ctx){
 const target=ctx.ports.get(targetKey);if(!target){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 let origin=null,min=Infinity;
 for(const p of ctx.network.nodes.values()){const d=distance(c,p);if(d<min){origin=p;min=d;}}
 const route=origin&&routeBetween(s,origin.key,target.key);
 if(!route){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 c.route=[{x:c.x,y:c.y},...route.map(p=>({x:p.x,y:p.y}))];c.routeIndex=1;c.phase=phase;
}
function siteAccess(s,ctx,c,b){
 const home=ctx.ports.get(c.home);if(!home)return null;
 const key=buildingKey(b),targets=b.type==='bridge'?[`site:${key}:0`,`site:${key}:1`]:[key];
 for(const target of targets){const p=ctx.ports.get(target);if(!p||!routeBetween(s,home.key,p.key))continue;
  const store=closestStore(s,ctx,target);if(store)return {site:key,sitePort:target,store};
 }
 return null;
}
export function syncCitizens(s){
 if(s.funeral)return;
 s.simTime??=s.tick*45;s.citizens??=[];s.deliveries??=0;s.delivered??={food:0,clay:0,reed:0,wood:0,stone:0,hides:0,faith:0,prestige:0};
 const ctx=context(s),cache=caches.get(s),signature=`${cache.signature}/${s.population}/${constructionEntities(s).map(b=>`${b.level||1}:${b.construction?.priority??1}:${b.construction?.order??0}:${b.construction?materialsReady(b.construction):0}`).join(',')}/${(s.trade?.sales||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${(s.trade?.deliveries||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${s.citizens.map(c=>`${c.role||'auto'}:${c.pendingRole||''}`).join(',')}`;
 if(cache.synced===signature)return;
 // Return undelivered reserved cargo when a resident leaves the city.
 for(const c of s.citizens.filter(c=>c.id>=s.population))recoverCitizenCargo(s,c.id);
 const available=new Map(s.buildings.filter(b=>b.type==='house'&&isComplete(b)).map(b=>[buildingKey(b),capacityOf(b)])),homes=[];
 for(const c of s.citizens){if(c.id>=s.population||!available.get(c.home))continue;homes[c.id]=c.home;available.set(c.home,available.get(c.home)-1);}
 for(let id=0;id<s.population;id++)if(!homes[id]){const home=[...available].find(([,beds])=>beds>0)?.[0];if(!home)break;homes[id]=home;available.set(home,available.get(home)-1);}
 const citizens=[];
 for(let id=0;id<s.population;id++){
  const home=homes[id],p=ctx.ports.get(home);if(!p)continue;
  let c=s.citizens.find(c=>c.id===id);
  if(!c)c={id,home,work:null,store:null,x:p.x,y:p.y,phase:'home',route:[],routeIndex:0,workElapsed:0,cargo:{},site:null,sitePort:null,buildCargo:{},role:'auto',siteDuty:null};
  c.buildCargo??={};c.site??=null;c.sitePort??=null;c.role??='auto';c.siteDuty??=null;
  if(c.pendingRole&&!hasCargo(c)&&!hasBuildCargo(c)){c.role=c.pendingRole;delete c.pendingRole;}citizens.push(c);
 }
 for(const c of citizens){const home=ctx.ports.get(c.home),store=ctx.ports.get(c.store);if(c.store&&!ctx.buildings.has(c.store)||hasCargo(c)&&(!store||!home||!routeBetween(s,home.key,store.key)))c.store=closestStore(s,ctx,c.home);}
 const assignments=new Map(),locked=new Set();
 // A load already in someone's hands belongs to its old destination.
 for(const c of citizens)if((hasCargo(c)||hasBuildCargo(c))&&((!c.work||ctx.buildings.has(c.work))&&(!c.site||ctx.buildings.get(c.site)?.construction))){
  locked.add(c.id);if(c.site){c.siteDuty??='carrier';assignments.set(c.id,{site:c.site,sitePort:c.sitePort,store:c.store,siteDuty:c.siteDuty});}
 }
 for(const b of orderedSites(s)){
  const key=buildingKey(b),q=b.construction;
  for(const duty of ['carrier','builder']){
   if(duty==='carrier'&&!Object.values(q.remaining).some(n=>n>0))continue;
   let n=[...assignments.values()].filter(a=>a.site===key&&a.siteDuty===duty).length;
   const candidates=[...citizens].sort((a,b)=>{
    const rank=c=>c.role===duty?0:c.site===key&&c.siteDuty===duty?1:c.work?3:2;return rank(a)-rank(b)||a.id-b.id;
   });
   for(const c of candidates){if(n>=2)break;if(locked.has(c.id)||assignments.has(c.id)||!['auto',duty].includes(c.role))continue;
    // Automatic workers deliver first, rather than leaving scarce carriers idle.
    if(duty==='builder'&&c.role==='auto'&&!materialsReady(q)&&![...assignments.values()].some(a=>a.site===key&&a.siteDuty==='carrier'))continue;
    const access=siteAccess(s,ctx,{...c,home:homes[c.id]},b);if(access){assignments.set(c.id,{...access,siteDuty:duty});n++;}
   }
  }
 }
 const tradeAssignments=new Map();
 const jobsQueue=[...(s.trade?.deliveries||[]).map(q=>({q,sale:false})),...(s.trade?.sales||[]).map(q=>({q,sale:true}))].sort((a,b)=>a.q.id-b.q.id);
 for(const {q,sale} of jobsQueue){if(q.remaining<=0)continue;if(sale&&s.trade.caravan?.id!==q.caravanId)continue;const market=ctx.ports.get(q.market),store=closestStore(s,ctx,q.market);if(!market||!store)continue;
  let assigned=citizens.filter(c=>locked.has(c.id)&&(c.tradeMarket||c.saleMarket)===q.market).length+[...tradeAssignments.values()].filter(a=>(a.tradeMarket||a.saleMarket)===q.market).length;
  for(const c of [...citizens].sort((a,b)=>Number(!!a.work)-Number(!!b.work)||b.id-a.id)){if(assigned>=2)break;if(locked.has(c.id)||assignments.has(c.id)||tradeAssignments.has(c.id)||!['auto','carrier'].includes(c.role)||!routeBetween(s,ctx.ports.get(c.home)?.key,market.key))continue;tradeAssignments.set(c.id,{...sale?{saleJob:q.id,saleMarket:q.market}:{tradeJob:q.id,tradeMarket:q.market},store});assigned++;}
 }
 const priority={field:0,garden:1,fishing:1,hunting:1,clay:2,reed:3,logging:3,quarry:3,shrine:4,ziggurat:5};
 const jobs=s.buildings.filter(b=>isComplete(b)&&Object.keys(BUILDINGS[b.type].output).length).sort((a,b)=>priority[a.type]-priority[b.type]);
 const slots=jobs.flatMap(b=>[buildingKey(b),buildingKey(b)]),used=new Set();
 for(const c of citizens.filter(c=>locked.has(c.id)&&c.work)){const j=slots.findIndex((key,i)=>key===c.work&&!used.has(i));if(j>=0)used.add(j);}
 for(const c of citizens){
  if(locked.has(c.id))continue;
  const oldSale=c.saleJob;const oldTrade=c.tradeJob;const oldHome=c.home,oldWork=c.work,oldStore=c.store,oldSite=c.site,oldPort=c.sitePort,oldDuty=c.siteDuty;c.home=homes[c.id];c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;
  const assignment=assignments.get(c.id);
  if(assignment)Object.assign(c,assignment);
  else if(tradeAssignments.has(c.id))Object.assign(c,tradeAssignments.get(c.id));
  else{
   const p=ctx.ports.get(c.home);
   for(let j=0;j<slots.length&&['auto','production'].includes(c.role);j++){if(used.has(j))continue;const work=slots[j],workPort=ctx.ports.get(work),store=closestStore(s,ctx,work);if(workPort&&store&&routeBetween(s,p.key,workPort.key)){used.add(j);c.work=work;c.store=store;break;}}
   if(!c.work)c.store=closestStore(s,ctx,c.home);
  }
  if(oldSale!==c.saleJob||oldTrade!==c.tradeJob||oldHome!==c.home||oldWork!==c.work||oldStore!==c.store||oldSite!==c.site||oldPort!==c.sitePort||oldDuty!==c.siteDuty){
   c.workElapsed=0;
   if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
   else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
   else if(Object.values(c.buildCargo).some(n=>n>0)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
   else if(c.saleJob&&isWorkday(s.simTime))startTrip(s,c,c.store,'toSaleSupply',ctx);
   else if(c.tradeJob&&isWorkday(s.simTime))startTrip(s,c,c.tradeMarket,'toMarket',ctx);
   else if(c.phase!=='home'){if(c.site&&isWorkday(s.simTime))beginSiteTrip(s,c,ctx);else startTrip(s,c,c.home,'toHome',ctx);}
  }
 }
 s.citizens=citizens;cache.synced=signature;
}

function harvest(s,c,ctx){
 const b=ctx.buildings.get(c.work);if(!b)return false;
 const def=BUILDINGS[b.type],boost=s.buffs||{};c.cargo={};
 for(const [resource,base]of Object.entries(def.output)){
  let mult=outputMultiplier(b);
  if(resource==='food')mult*=(b.type==='field'?[.8,1,1.6,.3][s.season]*(s.drought?.5:1)*(s.rain?1.5:1):1)*(boost.fertility?1.6:1);
  if(resource==='clay'||resource==='reed')mult*=boost.inspiration?1.75:1;
  if(resource==='faith'||resource==='prestige')mult*=boost.sunlight?1.8:1;
  c.cargo[resource]=base*mult;
 }
 startTrip(s,c,c.store,'toStore',ctx);return true;
}
function deposit(s,c){
 let delivered=0;const actual={};
 for(const [resource,amount]of Object.entries(c.cargo)){
  const accepted=MATERIALS.includes(resource)?Math.max(0,Math.min(amount,storageOf(s)-(s.resources[resource]||0))):amount;
  s.resources[resource]=(s.resources[resource]||0)+accepted;s.delivered[resource]=(s.delivered[resource]||0)+accepted;c.cargo[resource]-=accepted;if(c.cargo[resource]<1e-8)delete c.cargo[resource];if(c.tradeJob){const q=s.trade?.deliveries.find(q=>q.id===c.tradeJob);if(q){q.delivered=Math.min(q.amount,q.delivered+accepted);if(Math.abs(q.amount-q.delivered)<1e-7)q.delivered=q.amount;}}actual[resource]=accepted;delivered+=accepted;
 }
 if(delivered>0){s.deliveries++;s.lastDelivery={time:s.simTime,citizen:c.id,store:c.store,cargo:actual,...c.tradeJob?{source:'market'}:{}};}
 return !hasCargo(c);
}
function arrival(s,c,ctx){
 c.route=[];c.routeIndex=0;
 if(c.phase==='toHome'){c.phase='home';return;}
 if(c.phase==='toSaleSupply'){
  const q=s.trade?.sales?.find(q=>q.id===c.saleJob),market=ctx.buildings.get(c.saleMarket);if(q&&market&&isWorkday(s.simTime)){const amount=Math.min(q.remaining,4+2*(market.level||1));q.remaining-=amount;c.cargo={[q.resource]:amount};if(amount>0){startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);return;}}
  c.saleJob=null;c.saleMarket=null;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toSaleMarket'){
  if(!loadSaleCargo(s,c)){c.phase='blocked';return;}startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toMarket'){
  const q=s.trade?.deliveries.find(q=>q.id===c.tradeJob),market=ctx.buildings.get(c.tradeMarket);if(q&&market&&isWorkday(s.simTime)){const amount=Math.min(q.remaining,4+2*(market.level||1));q.remaining-=amount;c.cargo={[q.resource]:amount};if(amount>0){startTrip(s,c,c.store,'toStore',ctx);return;}}
  c.tradeJob=null;c.tradeMarket=null;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toSupply'){
  const q=ctx.buildings.get(c.site)?.construction;
  if(!q){startTrip(s,c,c.home,'toHome',ctx);return;}
  if(!isWorkday(s.simTime)){startTrip(s,c,c.home,'toHome',ctx);return;}
  const k=MATERIALS.find(k=>q.remaining[k]>0);
  if(k){const amount=Math.min(6,q.remaining[k]);q.remaining[k]-=amount;c.buildCargo={[k]:amount};}
  startTrip(s,c,c.sitePort,'toSite',ctx);return;
 }
 if(c.phase==='toSite'){
  const q=ctx.buildings.get(c.site)?.construction;
  if(!q){startTrip(s,c,c.home,'toHome',ctx);return;}
  for(const [k,n]of Object.entries(c.buildCargo))q.delivered[k]+=n;c.buildCargo={};invalidateAssignments(s);
  if(!isWorkday(s.simTime))startTrip(s,c,c.home,'toHome',ctx);
  else if(c.siteDuty==='builder'&&materialsReady(q))c.phase='constructing';
  else if(c.siteDuty!=='builder'&&Object.values(q.remaining).some(n=>n>0))startTrip(s,c,c.store,'toSupply',ctx);
  else c.phase='waiting';return;
 }
 if(c.phase==='toStore'){
  if(!deposit(s,c)){c.phase='unloading';return;}if(c.tradeJob){c.tradeJob=null;c.tradeMarket=null;}invalidateAssignments(s);
  if(isWorkday(s.simTime)&&c.site)beginSiteTrip(s,c,ctx);else if(isWorkday(s.simTime)&&c.work)startTrip(s,c,c.work,'returnWork',ctx);else startTrip(s,c,c.home,'toHome',ctx);
  return;
 }
 c.phase='working';c.workElapsed=0;
}
function advanceCitizen(s,c,dt,ctx){
 if(c.phase==='unloading'){if(hasCargo(c)){if(!deposit(s,c))return;if(c.tradeJob){c.tradeJob=null;c.tradeMarket=null;}invalidateAssignments(s);}startTrip(s,c,c.home,'toHome',ctx);}
 const day=isWorkday(s.simTime);
 if(c.phase==='blocked'&&c.saleJob&&!hasCargo(c)&&day)startTrip(s,c,c.store,'toSaleSupply',ctx);
 if(c.phase==='blocked'&&c.tradeJob&&!hasCargo(c)&&day)startTrip(s,c,c.tradeMarket,'toMarket',ctx);
 if(c.phase==='blocked'&&(hasBuildCargo(c)||hasCargo(c))){
  const target=hasBuildCargo(c)?c.sitePort:c.saleJob?c.saleMarket:c.store;if(target)startTrip(s,c,target,hasBuildCargo(c)?'toSite':c.saleJob?'toSaleMarket':'toStore',ctx);if(c.phase==='blocked')return;
 }
 if(!day&&!['home','toHome','toStore','toSaleMarket'].includes(c.phase)&&!(c.phase==='toSite'&&Object.values(c.buildCargo||{}).some(n=>n>0))){
  if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);else startTrip(s,c,c.home,'toHome',ctx);
 }
 if(c.phase==='home'){
  if(day&&c.saleJob)startTrip(s,c,c.store,'toSaleSupply',ctx);else if(day&&c.tradeJob)startTrip(s,c,c.tradeMarket,'toMarket',ctx);else if(day&&c.site)beginSiteTrip(s,c,ctx);else if(day&&c.work)startTrip(s,c,c.work,'toWork',ctx);else return;
 }
 let remaining=dt;
 for(let transition=0;transition<12&&remaining>1e-8;transition++){
  if(c.phase==='waiting'||c.phase==='constructing'){
   const q=ctx.buildings.get(c.site)?.construction;if(!q){startTrip(s,c,c.home,'toHome',ctx);continue;}
   if(materialsReady(q)&&c.siteDuty==='builder'){c.phase='constructing';q.work=Math.min(workRequired(ctx.buildings.get(c.site)),q.work+remaining);}return;
  }
  if(c.phase==='working'){
   const b=ctx.buildings.get(c.work);if(!b){startTrip(s,c,c.home,'toHome',ctx);continue;}
   const needed=BUILDINGS[b.type].workTime-c.workElapsed;
   if(remaining<needed){c.workElapsed+=remaining;return;}
   remaining-=Math.max(0,needed);c.workElapsed=0;harvest(s,c,ctx);continue;
  }
  if(!['toWork','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket'].includes(c.phase))return;
  const next=c.route[c.routeIndex];
  if(!next){arrival(s,c,ctx);if(c.phase==='home')return;continue;}
  const dist=distance(c,next);
  let speed=1.05*(s.buffs?.haste?1.5:1)*roadSpeed(s,c,next);
  if(onBridge(s.buildings,c.x,c.y)){
   const bridge=s.buildings.find(b=>b.type==='bridge'&&Math.abs(b.y+.5-c.y)<.16);speed*=1+((bridge?.level||1)-1)*.25;
  }
  const travel=dist/speed;
  if(travel<=remaining+1e-8){c.x=next.x;c.y=next.y;c.routeIndex++;remaining-=travel;}
  else{const fraction=remaining/travel;c.x+=(next.x-c.x)*fraction;c.y+=(next.y-c.y)*fraction;return;}
 }
}
export function advanceWorkers(s,seconds){
 if(!s.funeral)syncCitizens(s);let ctx=context(s);const start=s.simTime;
 for(let elapsed=0;elapsed<seconds-1e-8;){const dt=Math.min(.1,seconds-elapsed);s.simTime=start+elapsed;if(advanceFuneral(s,dt)){elapsed+=dt;ctx=context(s);continue;}advanceTradeLogistics(s,dt);ctx=context(s);for(const c of s.citizens)advanceCitizen(s,c,dt,ctx);const finished=finishConstruction(s);if(finished||caches.get(s)?.synced===null){syncCitizens(s);ctx=context(s);}elapsed+=dt;}
 s.simTime=start+seconds;
}
export function visibleCitizens(s){
 return (s.citizens||[]).filter(c=>c.phase!=='home').map(c=>({...c,kind:'person',walking:['toWork','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket'].includes(c.phase),carrying:hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0),cargo:hasCargo(c)?c.cargo:c.buildCargo,robe:['#f0dfb5','#b76c4e','#527f82','#d2b66e','#a195ac','#e6e4cf'][c.id%6],step:(s.simTime||0)*(4+(c.id%4)*.2)}));
}
export function workforceStats(s){
 syncCitizens(s);const ctx=context(s),people=s.citizens;
 const disconnected=s.buildings.filter(b=>isOperational(b)&&Object.keys(BUILDINGS[b.type].output).length).filter(b=>{
  const p=ctx.ports.get(buildingKey(b));return !p||!closestStore(s,ctx,buildingKey(b))||!s.buildings.some(h=>h.type==='house'&&ctx.ports.get(buildingKey(h))&&routeBetween(s,ctx.ports.get(buildingKey(h)).key,p.key));
 }).length;
 return {total:people.length,employed:people.filter(c=>c.work).length,builders:people.filter(c=>c.site&&c.siteDuty==='builder').length,carriers:people.filter(c=>c.site&&c.siteDuty==='carrier').length,sites:constructionEntities(s).filter(b=>b.construction).length,working:people.filter(c=>c.phase==='working').length,carrying:people.filter(c=>hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0)).length,atHome:people.filter(c=>c.phase==='home').length,disconnected,deliveries:s.deliveries};
}

export function rerouteCitizens(s){
 invalidateAssignments(s);syncCitizens(s);const ctx=context(s);
 for(const c of s.citizens){
  if(hasBuildCargo(c)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
  else if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
  else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
  else if(c.phase!=='home'||distance(c,ctx.ports.get(c.home)||c)>.01)startTrip(s,c,c.home,'toHome',ctx);
 }
}

export function recoverCitizenCargo(s,id){const c=s.citizens?.find(c=>c.id===id);if(!c)return false;const site=constructionEntities(s).find(b=>buildingKey(b)===c.site)?.construction;if(site)for(const [k,n]of Object.entries(c.buildCargo||{}))site.remaining[k]=(site.remaining[k]||0)+n;else for(const [k,n]of Object.entries(c.buildCargo||{}))s.resources[k]=(s.resources[k]||0)+n;
 const purchase=s.trade?.deliveries?.find(q=>q.id===c.tradeJob),sale=s.trade?.sales?.find(q=>q.id===c.saleJob);for(const [k,n]of Object.entries(c.cargo||{})){if(purchase&&k===purchase.resource)purchase.remaining+=n;else if(sale&&k===sale.resource)sale.remaining+=n;else s.resources[k]=(s.resources[k]||0)+n;}c.cargo={};c.buildCargo={};c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;invalidateAssignments(s);return true;}
