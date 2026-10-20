import {advanceFestival,recoverFestivalCitizen,festivalCitizenView} from './festival.js';
import {GATHERING_TYPES,workGathering,advanceGathering} from './labor-life.js';
import {initializeArtisans,isArtisan,artisanNeeds,artisanOutput,workArtisan,advanceArtisans,collectArtisan} from './artisan.js';
import {advanceKilns,kilnNeeds,startFiring,collectFired,KILN_RECIPE} from './kilns.js';
import {initializeBricks,advanceBricks,brickNeeds,formBricks,collectBricks,BRICK_RECIPE} from './bricks.js';
import {initializeWater,advanceWater,waterBusy,recoverWater,resumeWaterAtHome} from './water.js';
import {initializeTextiles,advanceTextiles,gatherWool,weaveCloth,weavingBatch,makeClothing,craftResource,craftState,craftLoad,craftBatch} from './textiles.js';
import {initializeClothing,advanceClothing,equipClothing,REPLACE_CLOTHING_AT} from './clothing.js';
import {stockStores,storeStock,storeCapacity,syncInventory,putStock,takeStock,foodAvailableAt,foodAvailability,takeReserved} from './inventory.js';
import {initializeDistricts,syncDistrictJobs,districtPickup,exportable,connectedStores} from './district-logistics.js';
import {SEED_COST,seedReserve,availableFood} from './food-planning.js';
import {advancePests,isPestStore,syncPestSites} from './pests.js';
import {cropFor,workField,advanceCrops,fieldActive} from './agriculture.js';
import {fieldWater} from './irrigation.js';
import {medicalLevel,qualifiedHealer,newMedicalSkill,STUDY_SECONDS,healingSpeed,healingQuality,healingCost} from './education.js';
import {initializeWellbeing,advanceWellbeing,workRate,beliefMultiplier} from './wellbeing.js';
import {ration} from './households.js';
import {childPlay} from './local-motion.js';
import {canWork,initializeDemography,lifeStage} from './demography.js';
import {advanceFuneral} from './funerals.js';
import {advanceTradeLogistics,loadSaleCargo} from './trading.js';
import {ensureRoads,roadSpeed} from './roads.js';
import {isComplete,materialsReady,finishConstruction,orderedSites,constructionEntities,workRequired} from './construction.js';
import {BUILDINGS,buildingKey,capacityOf,outputMultiplier,storageOf,isOperational,MATERIALS,citizenName} from './definitions.js';
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
// Internal callers reuse a validated access context within the same city network.
export function routeBetween(s,from,to,ctx){
 const network=ctx?.network||networkFor(s),cache=caches.get(s),key=`${from}>${to}`;
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
 const network=networkFor(s),cache=caches.get(s);
 // Access tables and nearest stores depend on topology, not the simulation clock.
 if(cache.context?.roadSource===s.roads&&cache.context.roadCount===s.roads.length)return cache.context;
 const ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));
 for(const p of network.ports.filter(p=>p.building.siteKey))ports.set(`site:${p.building.siteKey}:${p.building.side}`,p);
 const stores=stockStores(s);
 if(!stores.length&&s.buildings.some(b=>b.type==='house'&&isComplete(b)))stores.push(s.buildings.find(b=>b.type==='house'&&isComplete(b)));
 for(const r of s.roads||[])ports.set(r.id,{...r.a,building:r});
 return cache.context={network,ports,stores,roadSource:s.roads,roadCount:s.roads.length,closestStores:new Map(),healers:s.buildings.filter(b=>b.type==='healer'),temples:s.buildings.filter(b=>['shrine','ziggurat'].includes(b.type)),buildings:new Map(constructionEntities(s).map(b=>[buildingKey(b),b]))};
}
function houseDemand(s,ctx,home){if(ctx.foodCitizens!==s.citizens){ctx.foodCitizens=s.citizens;ctx.foodDemand=new Map();for(const c of s.citizens)ctx.foodDemand.set(c.home,(ctx.foodDemand.get(c.home)||0)+ration(c));}return ctx.foodDemand.get(home)||0;}
function closestStore(s,ctx,work){
 if(ctx.closestStores.has(work))return ctx.closestStores.get(work);
 const p=ctx.ports.get(work);if(!p)return null;
 let best=null,length=Infinity;
 for(const b of ctx.stores){const key=buildingKey(b),target=ctx.ports.get(key);if(!target)continue;const route=routeBetween(s,p.key,target.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
 ctx.closestStores.set(work,best);return best;
}
function closestStock(s,ctx,origin,k,{seed=false,sources=null,receiving=false}={}){
 const p=ctx.ports.get(origin);if(!p)return null;syncInventory(s);const food=k==='food'&&!seed&&!sources&&!receiving?foodAvailability(s):null;let best=null,length=Infinity;
 for(const b of ctx.stores){const key=buildingKey(b),amount=sources?Object.values(sources[key]||{}).reduce((n,v)=>n+v,0):receiving?Math.max(0,storeCapacity(b)-(b.stock?.[k]||0)):food?food.get(key)||0:b.stock?.[k]||0;if(amount<=1e-8||k==='clothing'&&amount<1)continue;const target=ctx.ports.get(key),route=target&&routeBetween(s,p.key,target.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
 return best;
}
function receivingStore(s,ctx,origin,cargo){for(const [k,n]of Object.entries(cargo||{}))if(n>0&&MATERIALS.includes(k)){const key=closestStock(s,ctx,origin,k,{receiving:true});if(key)return key;}return closestStore(s,ctx,origin);}
function localRecoveryStore(s,c){const ctx=context(s);let nearest=null,d=Infinity;for(const p of ctx.network.nodes.values()){const n=distance(c,p);if(n<d){d=n;nearest=p;}}let best=null,length=Infinity;for(const b of ctx.stores){const p=ctx.ports.get(buildingKey(b)),route=p&&nearest&&routeBetween(s,nearest.key,p.key,ctx);if(route&&route.length<length){best=buildingKey(b);length=route.length;}}return best;}
function startTrip(s,c,targetKey,phase,ctx,via=null){
 const target=ctx.ports.get(targetKey);if(!target){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 let origin=null,min=Infinity;
 for(const p of ctx.network.nodes.values()){const d=distance(via||c,p);if(d<min){origin=p;min=d;}}
 const route=origin&&routeBetween(s,origin.key,target.key,ctx);
 if(!route){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 c.route=[{x:c.x,y:c.y},...(via?[{x:via.x,y:via.y}]:[]),...route.map(p=>({x:p.x,y:p.y}))];c.routeIndex=1;c.phase=phase;
}
function siteAccess(s,ctx,c,b){
 const home=ctx.ports.get(c.home);if(!home)return null;
 const key=buildingKey(b),targets=b.type==='bridge'?[`site:${key}:0`,`site:${key}:1`]:[key];
 for(const target of targets){const p=ctx.ports.get(target);if(!p||!routeBetween(s,home.key,p.key,ctx))continue;
  const store=b.construction?.sources&&Object.values(b.construction.remaining).some(n=>n>0)?closestStock(s,ctx,target,'clay',{sources:b.construction.sources}):closestStore(s,ctx,target);if(store)return {site:key,sitePort:target,store};
 }
 return null;
}
export function syncCitizens(s){
 if(s.funeral&&s.funeral.scope!=='family')return;
 initializeBricks(s);initializeArtisans(s);syncInventory(s);initializeDistricts(s);syncPestSites(s);s.simTime??=s.tick*45;s.citizens??=[];s.deliveries??=0;s.delivered??={food:0,clay:0,reed:0,wood:0,stone:0,hides:0,faith:0,prestige:0};
 const ctx=context(s),cache=caches.get(s),signature=`${cache.signature}/${s.population}/${s.season}:${s.buildings.filter(b=>b.type==='field').map(b=>Number(fieldActive(s,b))).join('')}/${constructionEntities(s).map(b=>`${b.level||1}:${b.construction?.priority??1}:${b.construction?.order??0}:${b.construction?materialsReady(b.construction):0}`).join(',')}/${s.district.jobs.map(q=>`${q.id}:${q.remaining}`).join(',')}/${(s.trade?.sales||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${(s.trade?.deliveries||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${s.citizens.map(c=>`${c.id}:${c.home}:${canWork(c)}:${c.role||'auto'}:${c.pendingRole||''}:${c.workplace||''}:${c.guardPost||''}`).join(',')}`;
 if(cache.synced===signature)return;
 // Population is a count; stable IDs are never reused after a death.
 while(s.citizens.length>s.population){const c=s.citizens.at(-1);recoverCitizenCargo(s,c.id);s.citizens.pop();}
 const available=new Map(s.buildings.filter(b=>b.type==='house'&&isComplete(b)).map(b=>[buildingKey(b),capacityOf(b)])),homes=[];
 for(const c of s.citizens){if(!available.get(c.home))continue;homes[c.id]=c.home;available.set(c.home,available.get(c.home)-1);}
 let nextId=Math.max(s.demography?.nextId||0,1+Math.max(-1,...s.citizens.map(c=>c.id)));
 while(s.citizens.length<s.population)s.citizens.push({id:nextId++});
 if(s.demography)s.demography.nextId=nextId;
 const citizens=[];
 for(let c of s.citizens){
  const id=c.id;if(!homes[id]){const home=[...available].find(([,beds])=>beds>0)?.[0];if(!home)continue;homes[id]=home;available.set(home,available.get(home)-1);}
  const home=homes[id],p=ctx.ports.get(home);if(!p)continue;
  if(c.phase===undefined)Object.assign(c,{home,work:null,store:null,x:p.x,y:p.y,phase:'home',route:[],routeIndex:0,workElapsed:0,cargo:{},site:null,sitePort:null,buildCargo:{},role:'auto',siteDuty:null});
  if(c.futureRole&&canWork(c)){c.role=c.futureRole;delete c.futureRole;}
  if(c.role==='healer')c.medicine??=newMedicalSkill(s.year);
  c.buildCargo??={};c.site??=null;c.sitePort??=null;c.role??='auto';c.siteDuty??=null;
  if(c.pendingRole&&!waterBusy(c)&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.pantryFood&&!c.seedField&&!c.craftSite&&c.clothingTarget===undefined){c.role=c.pendingRole;delete c.pendingRole;}citizens.push(c);
 }
 s.citizens=citizens;initializeDemography(s);initializeWellbeing(s);initializeClothing(s);initializeWater(s);const livingIds=new Set(citizens.map(c=>c.id));for(const c of citizens)if(c.partner!==null&&!livingIds.has(c.partner))c.partner=null;
 for(const c of citizens)if(c.clothingTarget!==undefined&&!citizens.some(p=>p.id===c.clothingTarget&&p.home===c.home))recoverCitizenCargo(s,c.id);
 for(const c of citizens)if(c.rehousing){delete c.rehousing;startTrip(s,c,c.home,'toHome',ctx);}
 for(const c of citizens){const home=ctx.ports.get(c.home),store=ctx.ports.get(c.store);if(c.store&&!ctx.buildings.has(c.store)||(hasCargo(c)||c.pantryTrip)&&(!store||!home||!routeBetween(s,home.key,store.key,ctx)))c.store=closestStore(s,ctx,c.home);}
 for(const c of citizens)if(c.school&&(!['shrine','ziggurat'].includes(ctx.buildings.get(c.school)?.type)||!isComplete(ctx.buildings.get(c.school))||c.role!=='healer'||medicalLevel(c)>0)){delete c.school;startTrip(s,c,c.home,'toHome',ctx);}
 for(const c of citizens)if(c.workplace&&(!ctx.buildings.has(c.workplace)||!isComplete(ctx.buildings.get(c.workplace))||(ctx.buildings.get(c.workplace).type==='healer'?c.role!=='healer'||!qualifiedHealer(c):ctx.buildings.get(c.workplace).type==='tailor'?c.role!=='tailor':ctx.buildings.get(c.workplace).type==='waterpoint'?c.role!=='watercarrier':!['auto','production'].includes(c.role))))delete c.workplace;
 for(const c of citizens)if(c.guardPost&&(!isPestStore(ctx.buildings.get(c.guardPost))||!['auto','production'].includes(c.role)))delete c.guardPost;
 const reserved=new Set(citizens.filter(c=>c.workplace||c.guardPost).map(c=>c.id));
 const assignments=new Map(),locked=new Set(citizens.filter(c=>c.phase==='festival'||!canWork(c)||c.pantryTrip||c.clinic||c.school).map(c=>c.id));
 for(const c of citizens)if(c.pantryTrip){if(c.work&&!ctx.buildings.has(c.work))c.work=null;if(c.site&&!ctx.buildings.get(c.site)?.construction){c.site=null;c.sitePort=null;c.siteDuty=null;}}
 for(const c of citizens)if(!canWork(c)){c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.store=null;}
 if(s.funeral?.scope==='family')for(const a of s.funeral.actors)locked.add(a.id);
 // A load already in someone's hands belongs to its old destination.
 for(const c of citizens)if((waterBusy(c)||c.clothingTarget!==undefined||c.craftSite||c.districtJob||c.seedField||c.pantryTrip||hasCargo(c)||hasBuildCargo(c))&&((!c.work||ctx.buildings.has(c.work))&&(!c.site||ctx.buildings.get(c.site)?.construction))){
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
   for(const c of candidates){if(n>=2)break;if(reserved.has(c.id)||locked.has(c.id)||assignments.has(c.id)||!['auto',duty].includes(c.role))continue;
    // Automatic workers deliver first, rather than leaving scarce carriers idle.
    if(duty==='builder'&&c.role==='auto'&&!materialsReady(q)&&![...assignments.values()].some(a=>a.site===key&&a.siteDuty==='carrier'))continue;
    const access=siteAccess(s,ctx,{...c,home:homes[c.id]},b);if(access){assignments.set(c.id,{...access,siteDuty:duty});n++;}
   }
  }
 }
 const tradeAssignments=new Map();
 const jobsQueue=[...(s.trade?.deliveries||[]).map(q=>({q,sale:false})),...(s.trade?.sales||[]).map(q=>({q,sale:true}))].sort((a,b)=>a.q.id-b.q.id);
 for(const {q,sale} of jobsQueue){if(q.remaining<=0)continue;if(sale&&s.trade.caravan?.id!==q.caravanId)continue;const market=ctx.ports.get(q.market),store=sale&&q.sources?closestStock(s,ctx,q.market,q.resource,{sources:q.sources}):closestStore(s,ctx,q.market);if(!market||!store)continue;
  let assigned=citizens.filter(c=>locked.has(c.id)&&(c.tradeMarket||c.saleMarket)===q.market).length+[...tradeAssignments.values()].filter(a=>(a.tradeMarket||a.saleMarket)===q.market).length;
  for(const c of [...citizens].sort((a,b)=>Number(!!a.work)-Number(!!b.work)||b.id-a.id)){if(assigned>=2)break;if(reserved.has(c.id)||locked.has(c.id)||assignments.has(c.id)||tradeAssignments.has(c.id)||!['auto','carrier'].includes(c.role)||!routeBetween(s,ctx.ports.get(c.home)?.key,market.key,ctx))continue;tradeAssignments.set(c.id,{...sale?{saleJob:q.id,saleMarket:q.market}:{tradeJob:q.id,tradeMarket:q.market},store});assigned++;}
 }
 const districtAssignments=new Map();
 for(const q of s.district.jobs){if(q.remaining<=1e-8||exportable(s,q.source,q.resource)<=1e-8||!connectedStores(s,q.source,q.target))continue;let n=citizens.filter(c=>c.districtJob&&s.district.jobs.find(j=>j.id===c.districtJob)?.target===q.target).length+[...districtAssignments.values()].filter(a=>a.target===q.target).length;
  for(const c of [...citizens].sort((a,b)=>Number(b.workplace===q.target)-Number(a.workplace===q.target)||Number(!!a.work)-Number(!!b.work)||b.id-a.id)){if(n>=2)break;const pinned=c.workplace===q.target&&ctx.buildings.get(q.target)?.type==='depot';if(!['home','working'].includes(c.phase)||c.phase==='working'&&!pinned||!canWork(c)||locked.has(c.id)||assignments.has(c.id)||tradeAssignments.has(c.id)||districtAssignments.has(c.id)||reserved.has(c.id)&&!pinned||!['auto','carrier'].includes(c.role)&&!pinned)continue;const home=ctx.ports.get(c.home),source=ctx.ports.get(q.source);if(!home||!source||!routeBetween(s,home.key,source.key,ctx))continue;const house=ctx.buildings.get(c.home);if(c.phase==='home'&&house&&(house.pantry||0)<houseDemand(s,ctx,c.home)*4/3&&closestStock(s,ctx,c.home,'food'))continue;districtAssignments.set(c.id,{districtJob:q.id,store:q.source,target:q.target});n++;}
 }
 const priority={waterpoint:-.5,pottery:1,brewery:1,kiln:1,brickyard:1,tailor:1,sheepfold:1,weaver:1,depot:-.5,healer:-1,field:0,garden:1,fishing:1,hunting:1,clay:2,reed:3,logging:3,quarry:3,shrine:4,ziggurat:5};
 const jobs=s.buildings.filter(b=>isComplete(b)&&(['depot','healer','waterpoint'].includes(b.type)||Object.keys(BUILDINGS[b.type].output).length)).sort((a,b)=>priority[a.type]-priority[b.type]);
 const slots=jobs.flatMap(b=>b.type==='healer'?[buildingKey(b)]:[buildingKey(b),buildingKey(b)]),used=new Set();
 for(const c of citizens.filter(c=>locked.has(c.id)&&c.work&&!c.guardPost)){const j=slots.findIndex((key,i)=>key===c.work&&!used.has(i));if(j>=0)used.add(j);}
 for(const c of [...citizens].sort((a,b)=>Number(!!b.workplace)-Number(!!a.workplace))){
  if(locked.has(c.id))continue;
  const oldDistrict=c.districtJob;const oldSale=c.saleJob;const oldTrade=c.tradeJob;delete c.districtJob;const oldHome=c.home,oldWork=c.work,oldStore=c.store,oldSite=c.site,oldPort=c.sitePort,oldDuty=c.siteDuty;c.home=homes[c.id];c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;
  const assignment=assignments.get(c.id);
  if(c.guardPost){const p=ctx.ports.get(c.guardPost),home=ctx.ports.get(c.home),store=closestStore(s,ctx,c.guardPost);if(p&&home&&store&&routeBetween(s,home.key,p.key,ctx)){c.work=c.guardPost;c.store=store;}else c.store=closestStore(s,ctx,c.home);}
  else if(assignment)Object.assign(c,assignment);
  else if(tradeAssignments.has(c.id))Object.assign(c,tradeAssignments.get(c.id));
  else if(districtAssignments.has(c.id)){const {target,...job}=districtAssignments.get(c.id);Object.assign(c,job);}
  else{
   const p=ctx.ports.get(c.home);
   for(let j=0;j<slots.length&&['auto','production','healer','tailor','watercarrier'].includes(c.role);j++){if(used.has(j))continue;const work=slots[j];if(c.workplace&&c.workplace!==work)continue;if(!c.workplace&&ctx.buildings.get(work).type==='depot')continue;if(!c.workplace&&ctx.buildings.get(work).type==='field'&&!fieldActive(s,ctx.buildings.get(work)))continue;const isWater=ctx.buildings.get(work)?.type==='waterpoint',isHealer=ctx.buildings.get(work)?.type==='healer',isTailor=ctx.buildings.get(work)?.type==='tailor';if(isWater?c.role!=='watercarrier':isHealer?c.role!=='healer'||!qualifiedHealer(c):isTailor?c.role!=='tailor':['healer','tailor','watercarrier'].includes(c.role))continue;const workPort=ctx.ports.get(work),store=closestStore(s,ctx,work);if(workPort&&store&&routeBetween(s,p.key,workPort.key,ctx)){used.add(j);c.work=work;c.store=store;break;}}
   if(!c.work)c.store=closestStore(s,ctx,c.home);
  }
  if(oldDistrict!==c.districtJob||oldSale!==c.saleJob||oldTrade!==c.tradeJob||oldHome!==c.home||oldWork!==c.work||oldStore!==c.store||oldSite!==c.site||oldPort!==c.sitePort||oldDuty!==c.siteDuty){
   c.workElapsed=0;
   if(c.districtJob)startTrip(s,c,c.store,'toDistrictSupply',ctx);
   else if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
   else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
   else if(Object.values(c.buildCargo).some(n=>n>0)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
   else if(c.saleJob&&isWorkday(s.simTime))startTrip(s,c,c.store,'toSaleSupply',ctx);
   else if(c.tradeJob&&isWorkday(s.simTime))startTrip(s,c,c.tradeMarket,'toMarket',ctx);
   else if(c.phase!=='home'){if(c.site&&isWorkday(s.simTime))beginSiteTrip(s,c,ctx);else startTrip(s,c,c.home,'toHome',ctx);}
  }
 }
 s.citizens=citizens;advanceGathering(s);cache.synced=signature;
}

function harvest(s,c,ctx,via=null){
 const b=ctx.buildings.get(c.work);if(!b)return false;
 if(b.type==='kiln'){const amount=collectFired(b);if(amount>0){c.cargo={firedBrick:amount};c.store=receivingStore(s,ctx,c.work,c.cargo)||c.store;startTrip(s,c,c.store,'toStore',ctx);return true;}startFiring(b);return false;}
 if(b.type==='brickyard'){const amount=collectBricks(b);if(amount>0){c.cargo={brick:amount};c.store=receivingStore(s,ctx,c.work,c.cargo)||c.store;startTrip(s,c,c.store,'toStore',ctx);return true;}formBricks(b);return false;}
 if(['sheepfold','weaver','tailor'].includes(b.type)){const kind=b.type==='sheepfold'?'wool':b.type==='weaver'?'cloth':'clothing',amount=b.type==='sheepfold'?gatherWool(s,b):b.type==='weaver'?weaveCloth(s,b):makeClothing(s,b);if(amount<=1e-8)return false;c.cargo={[kind]:amount};c.store=receivingStore(s,ctx,c.work,c.cargo)||c.store;startTrip(s,c,c.store,'toStore',ctx);return true;}
 if(b.type==='field'){const food=workField(s,b,BUILDINGS.field.workTime);if(food>0){c.cargo={food};startTrip(s,c,c.store,'toStore',ctx);if(!fieldActive(s,b))invalidateAssignments(s);}else c.workElapsed=0;return food>0;}
 const def=BUILDINGS[b.type],boost=s.buffs||{};c.cargo={};
 for(const [resource,base]of Object.entries(def.output)){
  let mult=outputMultiplier(b);
  if(resource==='food')mult*=boost.fertility?1.6:1;
  if(resource==='clay'||resource==='reed')mult*=boost.inspiration?1.75:1;
  if(resource==='faith'||resource==='prestige')mult*=boost.sunlight?1.8:1;if(resource==='faith')mult*=beliefMultiplier(s);
  c.cargo[resource]=base*mult;
 }
 startTrip(s,c,c.store,'toStore',ctx,via);return true;
}
function deposit(s,c){
 let delivered=0;const actual={};
 for(const [resource,amount]of Object.entries(c.cargo)){
  const accepted=MATERIALS.includes(resource)?putStock(s,c.store,resource,amount):amount;
  if(!MATERIALS.includes(resource))s.resources[resource]=(s.resources[resource]||0)+accepted;s.delivered[resource]=(s.delivered[resource]||0)+accepted;if(c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q)q.delivered+=accepted;}c.cargo[resource]-=accepted;if(c.cargo[resource]<1e-8)delete c.cargo[resource];if(c.tradeJob){const q=s.trade?.deliveries.find(q=>q.id===c.tradeJob);if(q){q.delivered=Math.min(q.amount,q.delivered+accepted);if(Math.abs(q.amount-q.delivered)<1e-7)q.delivered=q.amount;}}actual[resource]=accepted;delivered+=accepted;
 }
 if(delivered>0){s.deliveries++;s.lastDelivery={time:s.simTime,citizen:c.id,store:c.store,cargo:actual,...c.tradeJob?{source:'market'}:{}};}
 return !hasCargo(c);
}
function arrival(s,c,ctx){
 c.route=[];c.routeIndex=0;
 if(c.phase==='toClothesSupply'){
  const target=s.citizens.find(p=>p.id===c.clothingTarget&&p.home===c.home),amount=target&&target.clothing<=REPLACE_CLOTHING_AT&&storeStock(s,c.store,'clothing')>=1?takeStock(s,c.store,'clothing',1):0;
  if(amount===1){c.clothingLoad=1;startTrip(s,c,c.home,'toClothesHome',ctx);}else{delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
 }
 if(c.phase==='toClothesHome'){
  const target=s.citizens.find(p=>p.id===c.clothingTarget&&p.home===c.home);if(target&&c.clothingLoad===1)equipClothing(target);else if(c.clothingLoad)putStock(s,c.store,'clothing',c.clothingLoad,{overflow:true});delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);c.phase='home';return;
 }
 if(c.phase==='toCraftSupply'){
  const b=ctx.buildings.get(c.craftSite),k=c.craftMaterial||craftResource(b),buffer=craftState(b),incoming=s.citizens.filter(p=>p.id!==c.id&&p.craftSite===c.craftSite&&(!c.craftMaterial||p.craftMaterial===k)).reduce((n,p)=>n+craftLoad(p),0),need=isArtisan(b)?Math.max(0,(artisanNeeds(b)[k]||0)-incoming):buffer?Math.max(0,(['brickyard','kiln'].includes(b.type)?(b.type==='kiln'?KILN_RECIPE:BRICK_RECIPE)[k]:craftBatch(b))-buffer[k]-incoming):0,amount=takeStock(s,c.store,k,Math.min(3,need,k==='food'?foodAvailableAt(s,c.store):Infinity));
  if(amount>1e-8){if(['brickyard','kiln'].includes(b.type)||isArtisan(b))c.craftAmount=amount;else if(b.type==='tailor')c.craftCloth=amount;else c.craftWool=amount;startTrip(s,c,c.craftSite,'toWork',ctx);}else{delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
 }
 if(c.craftSite&&c.phase==='toWork'){const b=ctx.buildings.get(c.craftSite),k=c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool');if(craftState(b))craftState(b)[k]+=craftLoad(c);else putStock(s,c.store,k,craftLoad(c),{overflow:true});delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;invalidateAssignments(s);}
 if(c.phase==='toDistrictSupply'){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(isWorkday(s.simTime)&&q&&districtPickup(s,c)>0){startTrip(s,c,q.target,'toDistrictStore',ctx);return;}delete c.districtJob;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;}
 if(c.phase==='toDistrictStore'){if(!deposit(s,c)){c.phase='unloading';return;}delete c.districtJob;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;}
 if(c.seedField&&c.phase==='toStore'){const b=ctx.buildings.get(c.seedField),crop=b?.type==='field'?cropFor(s,b):null;const incoming=s.citizens.filter(p=>p.id!==c.id&&p.seedField===c.seedField).reduce((n,p)=>n+(p.seedFood||0),0),need=crop?Math.max(0,SEED_COST-crop.seedUsed-crop.seedStock-incoming):0,stock=storeStock(s,c.store,'food'),amount=Math.min(6,need,stock);if(amount>1e-8){takeStock(s,c.store,'food',amount);c.seedFood=amount;startTrip(s,c,c.seedField,'toWork',ctx);}else{delete c.seedField;delete c.seedFood;startTrip(s,c,c.home,'toHome',ctx);}return;}
 if(c.seedField&&c.phase==='toWork'){const b=ctx.buildings.get(c.seedField);if(b?.type==='field')cropFor(s,b).seedStock+=c.seedFood||0;else putStock(s,c.store,'food',c.seedFood||0,{overflow:true});delete c.seedField;delete c.seedFood;invalidateAssignments(s);}
 if(c.phase==='toHome'){c.phase='home';return;}
 if(c.phase==='toSchool'){c.phase='studying';return;}
 if(c.phase==='toHealer'){c.phase='treatment';return;}
 if(c.phase==='toRest'){c.phase='resting';return;}
 if(c.phase==='toPantrySupply'){
  const b=ctx.buildings.get(c.home),inTransit=s.citizens.filter(p=>p.pantryTrip&&p.home===c.home).reduce((n,p)=>n+(p.pantryFood||0),0),amount=b?Math.min(6,Math.max(0,houseDemand(s,ctx,c.home)*8/3-(b.pantry||0)-inTransit),foodAvailableAt(s,c.store)):0;
  if(amount>1e-8){takeStock(s,c.store,'food',amount);c.pantryFood=amount;startTrip(s,c,c.home,'toPantryHome',ctx);}else{delete c.pantryTrip;delete c.pantryFood;startTrip(s,c,c.home,hasCargo(c)?'toRest':'toHome',ctx);}return;
 }
 if(c.phase==='toPantryHome'){
  const b=ctx.buildings.get(c.home),amount=c.pantryFood||0;if(b){b.pantry=(b.pantry||0)+amount;b.pantryDelivered=(b.pantryDelivered||0)+amount;}else putStock(s,c.store,'food',amount,{overflow:true});
  delete c.pantryTrip;delete c.pantryFood;c.phase=hasCargo(c)?'resting':'home';return;
 }
 if(c.phase==='toSaleSupply'){
  const q=s.trade?.sales?.find(q=>q.id===c.saleJob),market=ctx.buildings.get(c.saleMarket);if(q&&market&&isWorkday(s.simTime)){const amount=q.sources?takeReserved(s,q.sources,c.store,q.resource,Math.min(q.remaining,4+2*(market.level||1))):Math.min(q.remaining,4+2*(market.level||1));q.remaining-=amount;c.cargo={[q.resource]:amount};if(amount>0){startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);return;}}
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
  const k=MATERIALS.find(k=>q.remaining[k]>0&&(!q.sources||(q.sources[c.store]?.[k]||0)>0));
  if(k){const amount=q.sources?takeReserved(s,q.sources,c.store,k,Math.min(6,q.remaining[k])):Math.min(6,q.remaining[k]);q.remaining[k]-=amount;c.buildCargo={[k]:amount};}else{const next=q.sources&&closestStock(s,ctx,c.sitePort,'clay',{sources:q.sources});if(next){c.store=next;startTrip(s,c,next,'toSupply',ctx);}else c.phase='waiting';return;}
  startTrip(s,c,c.sitePort,'toSite',ctx);return;
 }
 if(c.phase==='toSite'){
  const q=ctx.buildings.get(c.site)?.construction;
  if(!q){startTrip(s,c,c.home,'toHome',ctx);return;}
  for(const [k,n]of Object.entries(c.buildCargo))q.delivered[k]+=n;c.buildCargo={};invalidateAssignments(s);
  if(!isWorkday(s.simTime))startTrip(s,c,c.home,'toHome',ctx);
  else if(c.siteDuty==='builder'&&materialsReady(q))c.phase='constructing';
  else if(c.siteDuty!=='builder'&&Object.values(q.remaining).some(n=>n>0)){c.store=q.sources?closestStock(s,ctx,c.sitePort,'clay',{sources:q.sources}):c.store;startTrip(s,c,c.store,'toSupply',ctx);}
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
 if(c.phase==='festival')return;
 const day=isWorkday(s.simTime);if(c.health>=(c.careGoal||85)){delete c.recovering;delete c.careGoal;}
 if(c.clinic){const clinic=ctx.buildings.get(c.clinic);if(!day||!clinic||!isComplete(clinic)||c.health>=(c.careGoal||85)){delete c.clinic;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}else if(c.phase==='treatment')return;else if(c.phase==='blocked'){startTrip(s,c,c.clinic,'toHealer',ctx);if(c.phase==='blocked')return;}}
 if(!c.clinic&&c.phase==='home'&&day&&(c.health<60||c.recovering)&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.seedField&&!c.pantryTrip&&!c.saleJob&&!c.tradeJob&&ctx.buildings.get(c.work)?.type!=='healer'){
  const home=ctx.ports.get(c.home);let best=null,length=Infinity;
  for(const {building:b,key,staff,patients} of ctx.care?.values()||[]){const port=ctx.ports.get(key);if(!port||patients.length>=1+(b.level||1)||!staff)continue;const route=routeBetween(s,home?.key,port.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
  if(best){c.careGoal=healingQuality(ctx.care.get(best).staff);c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.workElapsed=0;c.recovering=true;c.clinic=best;ctx.care.get(best).patients.push(c);startTrip(s,c,best,'toHealer',ctx);invalidateAssignments(s);}
 }

 if(c.school){if(!day||c.role!=='healer'||!ctx.buildings.has(c.school)){delete c.school;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}else if(c.phase==='blocked')startTrip(s,c,c.school,'toSchool',ctx);}
 if(!c.school&&!c.clinic&&day&&canWork(c)&&c.role==='healer'&&!medicalLevel(c)&&c.phase==='home'&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.pantryTrip&&!c.tradeJob&&!c.saleJob){
  const home=ctx.ports.get(c.home);let best=null,length=Infinity;
  for(const b of ctx.temples){if(!isComplete(b))continue;const key=buildingKey(b),port=ctx.ports.get(key),route=port&&routeBetween(s,home?.key,port.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
  if(best){c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.school=best;startTrip(s,c,best,'toSchool',ctx);invalidateAssignments(s);}
 }
 if(!day&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.seedField&&!c.pantryTrip&&!c.saleJob&&!hasBuildCargo(c)&&hasCargo(c)&&['toStore','unloading','blocked'].includes(c.phase))startTrip(s,c,c.home,'toRest',ctx);
 if(c.phase==='resting'){if((day||hourAt(s.simTime)>=19&&hourAt(s.simTime)<20)&&!c.saleJob&&availableFood(s)>0){const b=ctx.buildings.get(c.home);if(b&&houseDemand(s,ctx,c.home)*8/3-(b.pantry||0)>1e-7&&!s.citizens.some(p=>p.pantryTrip&&p.home===c.home)){c.store=closestStock(s,ctx,c.home,'food');if(c.store){c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,c.store,'toPantrySupply',ctx);}}}if(!c.pantryTrip){if(!day)return;if(hasCargo(c))startTrip(s,c,c.store,'toStore',ctx);else c.phase='home';}}
 if(c.phase==='unloading'){if(hasCargo(c)){if(!deposit(s,c)){if(!c.districtJob){const next=receivingStore(s,ctx,c.store||c.home,c.cargo);if(next&&next!==c.store){c.store=next;startTrip(s,c,next,'toStore',ctx);}}return;}if(c.tradeJob){c.tradeJob=null;c.tradeMarket=null;}if(c.districtJob)delete c.districtJob;invalidateAssignments(s);}startTrip(s,c,c.home,'toHome',ctx);}
 if(c.phase==='blocked'&&c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q)startTrip(s,c,hasCargo(c)?q.target:q.source,hasCargo(c)?'toDistrictStore':'toDistrictSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.clothingTarget!==undefined){startTrip(s,c,c.clothingLoad?c.home:c.store,c.clothingLoad?'toClothesHome':'toClothesSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.craftSite){startTrip(s,c,craftLoad(c)>0?c.craftSite:c.store,craftLoad(c)>0?'toWork':'toCraftSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.seedField){startTrip(s,c,c.seedFood>0?c.seedField:c.store,c.seedFood>0?'toWork':'toStore',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.saleJob&&!hasCargo(c)&&day)startTrip(s,c,c.store,'toSaleSupply',ctx);
 if(c.phase==='blocked'&&c.tradeJob&&!hasCargo(c)&&day)startTrip(s,c,c.tradeMarket,'toMarket',ctx);
 if(c.phase==='blocked'&&c.pantryTrip){startTrip(s,c,c.pantryFood>0?c.home:c.store,c.pantryFood>0?'toPantryHome':'toPantrySupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&(hasBuildCargo(c)||hasCargo(c))){
  const target=hasBuildCargo(c)?c.sitePort:c.saleJob?c.saleMarket:c.store;if(target)startTrip(s,c,target,hasBuildCargo(c)?'toSite':c.saleJob?'toSaleMarket':'toStore',ctx);if(c.phase==='blocked')return;
 }
 if(!day&&c.clothingTarget!==undefined&&!c.clothingLoad){delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}
 if(!day&&c.craftSite&&!craftLoad(c)){delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;}
 if(!day&&c.seedField&&!c.seedFood){delete c.seedField;delete c.seedFood;}
 if(!day&&!['home','toHome','toStore','toSaleMarket','toPantrySupply','toPantryHome','toDistrictStore','toClothesHome','toRest','resting'].includes(c.phase)&&!(c.phase==='toWork'&&(c.seedFood>0||craftLoad(c)>0))&&!(c.phase==='toSite'&&Object.values(c.buildCargo||{}).some(n=>n>0))){
  if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);else startTrip(s,c,c.home,'toHome',ctx);
 }
 if(c.phase==='home'){
  const evening=hourAt(s.simTime)>=19&&hourAt(s.simTime)<20;
  if(canWork(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&(day||evening)&&availableFood(s)>0&&!s.citizens.some(p=>p.pantryTrip&&p.home===c.home)){
   const b=ctx.buildings.get(c.home),needs=b&&houseDemand(s,ctx,c.home)*8/3-(b.pantry||0)>1e-7,store=needs?closestStock(s,ctx,c.home,'food'):null;if(store){c.store=store;c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,store,'toPantrySupply',ctx);}
  }
  if(!c.pantryTrip&&day&&canWork(c)&&c.clothingTarget===undefined&&!c.craftSite&&!c.districtJob&&!c.saleJob&&!c.tradeJob&&!hasCargo(c)&&!hasBuildCargo(c)&&s.resources.clothing>=1){
   const targets=s.citizens.filter(p=>p.home===c.home&&p.clothing<=REPLACE_CLOTHING_AT&&!s.citizens.some(q=>q.clothingTarget===p.id)).sort((a,b)=>a.clothing-b.clothing||a.id-b.id),target=targets[0],store=target?closestStock(s,ctx,c.home,'clothing'):null;
   if(store){c.store=store;c.clothingTarget=target.id;c.clothingLoad=0;startTrip(s,c,store,'toClothesSupply',ctx);}
  }
  if(c.pantryTrip||c.clothingTarget!==undefined){}else if(day&&c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);startTrip(s,c,q?.source,'toDistrictSupply',ctx);}else if(day&&c.saleJob)startTrip(s,c,c.store,'toSaleSupply',ctx);else if(day&&c.tradeJob)startTrip(s,c,c.tradeMarket,'toMarket',ctx);else if(day&&c.site)beginSiteTrip(s,c,ctx);else if(day&&c.work)startTrip(s,c,c.work,'toWork',ctx);else return;
 }
 let remaining=dt;
 for(let transition=0;transition<12&&remaining>1e-8;transition++){
  if(c.phase==='waiting'||c.phase==='constructing'){
   const q=ctx.buildings.get(c.site)?.construction;if(!q){startTrip(s,c,c.home,'toHome',ctx);continue;}
   if(materialsReady(q)&&c.siteDuty==='builder'){c.phase='constructing';q.work=Math.min(workRequired(ctx.buildings.get(c.site)),q.work+remaining*workRate(c,'builder'));}return;
  }
  if(c.phase==='studying'){
   c.medicine.study=Math.min(STUDY_SECONDS,c.medicine.study+remaining);
   if(c.medicine.study>=STUDY_SECONDS){c.medicine.level=1;c.medicine.year=s.year;c.medicine.practice=0;s.news.unshift({title:'Обучение завершено',text:`${citizenName(c.id)} освоил врачевание в храме и может принимать пациентов.`,kind:'good',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);delete c.school;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
  }
  if(c.phase==='working'){
   const b=ctx.buildings.get(c.work);if(!b){startTrip(s,c,c.home,'toHome',ctx);continue;}
   if(c.guardPost===c.work||['depot','waterpoint'].includes(b.type))return;
   if(isArtisan(b)){
    const v=b.artisan;
    if(v.stage==='ready'){const amount=collectArtisan(b);if(amount){c.cargo={[artisanOutput(b)]:amount};c.store=receivingStore(s,ctx,c.work,c.cargo)||c.store;startTrip(s,c,c.store,'toStore',ctx);}return;}
    if(['drying','firing','cooling'].includes(v.stage))return;
    const needs=artisanNeeds(b),k=Object.keys(needs).find(k=>k!=='water'&&needs[k]>1e-8);
    if(k){const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}
    if(needs.water>1e-8)return;
    workArtisan(b,remaining*workRate(c,'production'));return;
   }
   if(b.type==='kiln'){const v=b.firing;if(v.hot)return;if(!v.ready){const needs=kilnNeeds(b),k=['brick','reed'].find(k=>needs[k]>1e-8);if(k){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}}}
   if(b.type==='brickyard'){const v=b.brickmaking;if(v.wet)return;if(!v.ready){const needs=brickNeeds(b);const k=['clay','reed'].find(k=>needs[k]>1e-8);if(k){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}if(needs.water>1e-8)return;}}
   if(b.type==='sheepfold'&&(b.flock?.fleece||0)<1-1e-8)return;
   if(['weaver','tailor'].includes(b.type)){const k=craftResource(b),input=craftState(b)?.[k]||0;if(input+1e-8<craftBatch(b)){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work).reduce((n,p)=>n+craftLoad(p),0);if(input+incoming+1e-8<craftBatch(b)){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;if(b.type==='tailor')c.craftCloth=0;else c.craftWool=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}}
   if(b.type==='field'){if(s.season===0&&cropFor(s,b).sheaves<=1e-8){const crop=cropFor(s,b),before=crop.sown;if(crop.sown<1-1e-8&&crop.seedStock<=1e-8&&!s.citizens.some(p=>p.id!==c.id&&p.seedField===c.work)){c.seedField=c.work;c.seedFood=0;c.store=closestStock(s,ctx,c.work,'food',{seed:true});if(c.store)startTrip(s,c,c.store,'toStore',ctx);else{delete c.seedField;delete c.seedFood;}return;}workField(s,b,remaining*workRate(c,'production'));if(before<1&&crop.sown>=1)invalidateAssignments(s);return;}if(cropFor(s,b).sheaves<=1e-8&&(s.season!==2||cropFor(s,b).remaining<=0))return;}
   if(b.type==='healer'){
    const patients=(ctx.care?.get(c.work)?.patients||[]).filter(p=>p.phase==='treatment'&&p.health<(p.careGoal||85)&&!s.funeral?.actors.some(a=>a.id===p.id));
    let budget=remaining*(1+(b.level-1)*.5)*workRate(c,'healer')*healingSpeed(c);const cost=healingCost(c);
    for(const patient of patients){const amount=Math.max(0,Math.min(budget/patients.length,(patient.careGoal||85)-patient.health,Math.min(availableFood(s),foodAvailableAt(s,c.store))/(.04*cost),storeStock(s,c.store,'reed')/(.02*cost)));patient.health+=amount;if(amount>0)c.medicine.practice+=amount;takeStock(s,c.store,'food',amount*.04*cost);takeStock(s,c.store,'reed',amount*.02*cost);}return;
   }
   const rate=workRate(c,b.type==='tailor'?'tailor':'production');
   if(GATHERING_TYPES.includes(b.type)){
    const via=workGathering(s,c,b,remaining,rate,ctx.ports.get(c.work));if(via)harvest(s,c,ctx,via);
    return;
   }
   const needed=(BUILDINGS[b.type].workTime-c.workElapsed)/rate;
   if(remaining<needed){c.workElapsed+=remaining*rate;return;}
   remaining-=Math.max(0,needed);c.workElapsed=0;harvest(s,c,ctx);continue;
  }
  if(!['toWork','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','toHealer','toSchool','toDistrictSupply','toDistrictStore','toCraftSupply','toClothesSupply','toClothesHome'].includes(c.phase))return;
  const next=c.route[c.routeIndex];
  if(!next){arrival(s,c,ctx);if(c.phase==='home'||c.phase==='resting')return;continue;}
  const dist=distance(c,next);
  let speed=1.05*(s.buffs?.haste?1.5:1)*roadSpeed(s,c,next);if(!c.pantryTrip&&!['toHome','toRest'].includes(c.phase))speed*=workRate(c,c.siteDuty==='builder'?'builder':c.siteDuty==='carrier'||c.districtJob||c.tradeJob||c.saleJob?'carrier':c.work?'production':null);
  if(onBridge(s.buildings,c.x,c.y)){
   const bridge=s.buildings.find(b=>b.type==='bridge'&&Math.abs(b.y+.5-c.y)<.16);speed*=1+((bridge?.level||1)-1)*.25;
  }
  const travel=dist/speed;
  if(travel<=remaining+1e-8){c.x=next.x;c.y=next.y;c.routeIndex++;remaining-=travel;}
  else{const fraction=remaining/travel;c.x+=(next.x-c.x)*fraction;c.y+=(next.y-c.y)*fraction;return;}
 }
}
function prepareCare(s,ctx){
 if(!ctx.healers.length)return;
 ctx.care=new Map(ctx.healers.filter(isComplete).map(b=>[buildingKey(b),{key:buildingKey(b),building:b,staff:false,patients:[]}]));
 for(const c of s.citizens){const workplace=ctx.care.get(c.work);if(workplace&&qualifiedHealer(c))workplace.staff=c;const clinic=ctx.care.get(c.clinic);if(clinic)clinic.patients.push(c);}
}
export function advanceWorkers(s,seconds){
 syncDistrictJobs(s);
 if(!s.funeral||s.funeral.scope==='family')syncCitizens(s);let ctx=context(s);const start=s.simTime;
 for(let elapsed=0;elapsed<seconds-1e-8;){const dt=Math.min(.1,seconds-elapsed);s.simTime=start+elapsed;advanceGathering(s);advanceFestival(s,dt);const family=s.funeral?.scope==='family',mourners=family?new Set(s.funeral.actors.map(a=>a.id)):null;if(advanceFuneral(s,dt)&&!family){advanceWater(s,dt);advanceClothing(s,dt);advanceTextiles(s,dt);advanceBricks(s,dt);advanceKilns(s,dt);advanceArtisans(s,dt);advanceCrops(s,dt);advancePests(s,dt);elapsed+=dt;ctx=context(s);continue;}advanceTradeLogistics(s,dt);ctx=context(s);prepareCare(s,ctx);if(advanceWater(s,dt))invalidateAssignments(s);for(const c of s.citizens)if(!waterBusy(c)&&!mourners?.has(c.id))advanceCitizen(s,c,dt,ctx);advanceWellbeing(s,dt);advanceClothing(s,dt);advanceTextiles(s,dt);advanceBricks(s,dt);advanceKilns(s,dt);advanceArtisans(s,dt);advanceCrops(s,dt);advancePests(s,dt);const finished=finishConstruction(s);if(finished||caches.get(s)?.synced===null){syncCitizens(s);ctx=context(s);}elapsed+=dt;}
 s.simTime=start+seconds;
}
export function visibleCitizens(s){
 return (s.citizens||[]).filter(c=>!['home','resting','treatment','studying'].includes(c.phase)||c.phase==='home'&&c.age>=3&&c.age<16&&isWorkday(s.simTime)).map(c=>({...c,lifeStage:lifeStage(c),kind:'person',walking:waterBusy(c)||['toWork','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','toHealer','toSchool','toDistrictSupply','toDistrictStore','toCraftSupply','toClothesSupply','toClothesHome'].includes(c.phase),carrying:c.waterTrip?.load>0?true:c.clothingLoad>0?true:craftLoad(c)>0?true:c.seedFood>0?true:c.pantryTrip?c.pantryFood>0:hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0),cargo:c.waterTrip?.load>0?{water:c.waterTrip.load}:c.clothingLoad>0?{clothing:c.clothingLoad}:craftLoad(c)>0?c.craftMaterial?{[c.craftMaterial]:c.craftAmount}:c.craftCloth>0?{cloth:c.craftCloth}:{wool:c.craftWool}:c.seedFood>0?{food:c.seedFood}:c.pantryTrip?{food:c.pantryFood||0}:hasCargo(c)?c.cargo:c.buildCargo,robe:c.role==='tailor'?'#ad826b':c.role==='healer'?(medicalLevel(c)?'#e6eee1':'#80aaa3'):['#f0dfb5','#b76c4e','#527f82','#d2b66e','#a195ac','#e6e4cf'][c.id%6],step:(s.simTime||0)*(4+(c.id%4)*.2),guarding:c.guardPost===c.work&&c.phase==='working'&&!s.funeral?.actors.some(a=>a.id===c.id),...isWorkday(s.simTime)?childPlay(s,c):null,...festivalCitizenView(s,c)}));
}
export function workforceStats(s){
 syncCitizens(s);const ctx=context(s),people=s.citizens;
 const disconnected=s.buildings.filter(b=>isOperational(b)&&Object.keys(BUILDINGS[b.type].output).length).filter(b=>{
  const p=ctx.ports.get(buildingKey(b));return !p||!closestStore(s,ctx,buildingKey(b))||!s.buildings.some(h=>h.type==='house'&&ctx.ports.get(buildingKey(h))&&routeBetween(s,ctx.ports.get(buildingKey(h)).key,p.key,ctx));
 }).length;
 return {total:people.length,employed:people.filter(c=>c.work).length,builders:people.filter(c=>c.site&&c.siteDuty==='builder').length,carriers:people.filter(c=>c.site&&c.siteDuty==='carrier').length,sites:constructionEntities(s).filter(b=>b.construction).length,working:people.filter(c=>c.phase==='working').length,carrying:people.filter(c=>c.clothingLoad>0||craftLoad(c)>0||c.seedFood>0||c.pantryFood>0||hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0)).length,atHome:people.filter(c=>['home','resting'].includes(c.phase)).length,disconnected,deliveries:s.deliveries};
}

export function rerouteCitizens(s){
 invalidateAssignments(s);syncCitizens(s);const ctx=context(s);
 for(const c of s.citizens){
  if(c.phase==='festival')continue;
  if(waterBusy(c)){resumeWaterAtHome(s,c);continue;}
  if(c.school)startTrip(s,c,c.school,'toSchool',ctx);
  else if(c.clinic)startTrip(s,c,c.clinic,'toHealer',ctx);
  else if(c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q)startTrip(s,c,hasCargo(c)?q.target:q.source,hasCargo(c)?'toDistrictStore':'toDistrictSupply',ctx);}
  else if(c.pantryTrip)startTrip(s,c,c.pantryFood>0?c.home:c.store,c.pantryFood>0?'toPantryHome':'toPantrySupply',ctx);
  else if(c.clothingTarget!==undefined)startTrip(s,c,c.clothingLoad?c.home:c.store,c.clothingLoad?'toClothesHome':'toClothesSupply',ctx);
  else if(c.craftSite)startTrip(s,c,craftLoad(c)>0?c.craftSite:c.store,craftLoad(c)>0?'toWork':'toCraftSupply',ctx);
  else if(c.seedField)startTrip(s,c,c.seedFood>0?c.seedField:c.store,c.seedFood>0?'toWork':'toStore',ctx);
  else if(hasBuildCargo(c)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
  else if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
  else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
  else if(c.phase!=='home'||distance(c,ctx.ports.get(c.home)||c)>.01)startTrip(s,c,c.home,'toHome',ctx);
 }
}

export function recoverCitizenCargo(s,id){recoverFestivalCitizen(s,id);const c=s.citizens?.find(c=>c.id===id);if(!c)return false;const site=constructionEntities(s).find(b=>buildingKey(b)===c.site)?.construction;if(site)for(const [k,n]of Object.entries(c.buildCargo||{})){site.remaining[k]=(site.remaining[k]||0)+n;if(site.sources)(site.sources[c.store]??={})[k]=(site.sources[c.store]?.[k]||0)+n;}else for(const [k,n]of Object.entries(c.buildCargo||{}))s.resources[k]=(s.resources[k]||0)+n;
 if(c.waterTrip)recoverWater(s,c);
 const recovery=localRecoveryStore(s,c);const district=s.district?.jobs.find(q=>q.id===c.districtJob);const purchase=s.trade?.deliveries?.find(q=>q.id===c.tradeJob),sale=s.trade?.sales?.find(q=>q.id===c.saleJob);for(const [k,n]of Object.entries(c.cargo||{})){if(purchase&&k===purchase.resource)purchase.remaining+=n;else if(sale&&k===sale.resource){sale.remaining+=n;if(sale.sources)(sale.sources[c.store]??={})[k]=(sale.sources[c.store]?.[k]||0)+n;}else if(MATERIALS.includes(k)){if(recovery)putStock(s,recovery,k,n,{overflow:true});if(district)district.cancelled+=n;}else s.resources[k]=(s.resources[k]||0)+n;}c.cargo={};c.buildCargo={};if(craftLoad(c)&&recovery)putStock(s,recovery,c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool'),craftLoad(c),{overflow:true});const hadCraft=!!c.craftSite||c.clothingTarget!==undefined;if(c.clothingLoad&&recovery)putStock(s,recovery,'clothing',c.clothingLoad,{overflow:true});delete c.clothingTarget;delete c.clothingLoad;delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;if(c.seedFood&&recovery)putStock(s,recovery,'food',c.seedFood,{overflow:true});delete c.seedField;delete c.seedFood;if(c.pantryFood&&recovery)putStock(s,recovery,'food',c.pantryFood,{overflow:true});delete c.pantryTrip;delete c.pantryFood;delete c.districtJob;c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;if(district||hadCraft)startTrip(s,c,c.home,'toHome',context(s));invalidateAssignments(s);return true;}
