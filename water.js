import {isStrictSumer} from './scenario-profiles.js';
import {log} from './engine.js';
import {recordDepthSupply} from './depth-supply.js';
import {recordCreatorUse} from './creator-materials.js';
import {recordNeighborWaterFact} from './causal-facts.js';
import {confirmProjectWater} from './human-projects.js';
import {cancelFirstWaterHelp,confirmFirstWaterHelp} from './godhood.js';
import {fortificationAccess} from './navigation.js';
import {floodPhase,floodFootprint,floodProtectionRevision,floodedSegment} from './river-flood.js';
import {supplyHome} from './households.js';
import {cachedStreetsFor} from './workforce.js';
import {recordCitizenDelivery} from './citizen-epithets.js';
import {dairyNeeds} from './dairy.js';
import {isArtisan,artisanNeeds} from './artisan.js';
import {buildingKey,citizenName,isOperational} from './definitions.js';
import {isDryPoint,signedRiverDistance,worldWidth,worldHeight} from './world.js';
import {generateStreets} from './city-life.js';

// Water remains in vessels and homes, never in the city's abstract material stock.
export const WATER_DAY=60;
export const WATERPOINT_CAPACITY=12;
export function depthWaterpointTarget(s,target){
 if(!s.depthSupply||!Number.isInteger(target?.x)||!Number.isInteger(target?.y))return null;
 return s.buildings.find(b=>b.type==='waterpoint'&&b.x===target.x&&b.y===target.y&&isOperational(b))||null;
}
export const waterBusy=c=>!!c.waterTrip;
// A broken vessel/death spills water; it cannot teleport into a house or store.
export function recoverWater(s,c){const amount=c.waterTrip?.load||0;if(c.waterTrip)finish(s,c);return amount;}
const caches=new WeakMap(),blockedWaterTrips=new WeakMap(),changes=new WeakSet(),eps=1e-7;
export const waterDemand=c=>c.age<16?.5:1;
const point=p=>({x:p.x,y:p.y});
const key=p=>`${Math.round(p.x+.5)},${Math.round(p.y+.5)}`;
const dryEdge=(s,a,b)=>[0,.25,.5,.75,1].every(t=>isDryPoint(s,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t));
function navigation(s){
 const flood=floodPhase(s)==='active'?s.riverFlood:null;
 const geometry=(flood?`${flood.along},${flood.bank}:${floodProtectionRevision(s)}|`:'')+s.buildings.map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||''}:${b.type==='cityGate'?b.rotation||0:''}`).join('|'),signature=geometry+'|anchors:'+(s.roadAnchors||[]).map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||''}`).join('|');
 let cache=caches.get(s);const sameTerrain=cache&&cache.world===s.world&&cache.river===s.world?.river&&cache.lakes===s.world?.lakes&&cache.lakeCount===(s.world?.lakes?.length||0);if(cache?.signature===signature&&sameTerrain)return cache;
 const reuse=cache?.geometry===geometry&&sameTerrain;
 const network=cachedStreetsFor(s)||generateStreets([...s.buildings,...s.roadAnchors||[]],s),ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p])),nodes=reuse?cache.nodes:new Map(),graph=reuse?cache.graph:new Map();
 const flooded=reuse?cache.flooded:flood?floodFootprint(s,flood):null;
 const forts=reuse?cache.forts:fortificationAccess(s.buildings);
 if(!reuse){
  for(let y=0;y<=worldHeight(s);y++)for(let x=0;x<=worldWidth(s);x++){const p={x:x-.5,y:y-.5};if(isDryPoint(s,p.x,p.y)&&(!forts||forts.pointClear(p))&&(!flooded||!floodedSegment(flooded,p,p))){nodes.set(`${x},${y}`,p);graph.set(`${x},${y}`,[]);}}
  for(const [k,p]of nodes)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},qk=key(q);if(nodes.has(qk)&&dryEdge(s,p,q)&&(!forts||forts.segmentClear(p,q))&&(!flooded||!floodedSegment(flooded,p,q)))graph.get(k).push(qk);}
 }
 cache={signature,geometry,flooded,forts,world:s.world,river:s.world?.river,lakes:s.world?.lakes,lakeCount:s.world?.lakes?.length||0,network,ports,nodes,graph,banks:reuse?cache.banks:new Map(),roads:new Map()};caches.set(s,cache);return cache;
}
function path(nodes,graph,from,to,flooded=null){
 if(!nodes.has(from))return null;const prev=new Map([[from,null]]),queue=[from];
 for(let i=0;i<queue.length;i++){const k=queue[i];if(to(k,nodes.get(k))){const result=[];for(let at=k;at!==null;at=prev.get(at))result.push(point(nodes.get(at)));return result.reverse();}for(const next of graph.get(k)||[])if(!prev.has(next)&&(!flooded||!floodedSegment(flooded,nodes.get(k),nodes.get(next)))){prev.set(next,k);queue.push(next);}}
 return null;
}
function bankRoute(s,nav,origin){
 if(!nav.banks.has(origin)){const p=nav.ports.get(origin);nav.banks.set(origin,p?path(nav.nodes,nav.graph,key(p),(_,q)=>Math.abs(signedRiverDistance(q.x,q.y,s))<2.25):null);}return nav.banks.get(origin);
}
function roadRoute(nav,from,to){
 const id=`${from}>${to}`;if(!nav.roads.has(id)){const a=nav.ports.get(from),b=nav.ports.get(to);nav.roads.set(id,a&&b?path(nav.network.nodes,nav.network.graph,a.key,k=>k===b.key,nav.flooded):null);}return nav.roads.get(id);
}
export function waterpointCanReach(s,station,home){
 return !!roadRoute(navigation(s),station,home);
}
const targetStock=b=>b.type==='house'?b.water:(b.type==='cowshed'?b.dairy?.water:isArtisan(b)?b.artisan?.water:b.brickmaking?.water)||0;
function targetCapacity(s,b){return b.type==='cowshed'?12:b.type==='house'?Math.max(2,s.citizens.filter(c=>supplyHome(c)===buildingKey(b)).reduce((n,c)=>n+waterDemand(c),0)*3):b.type==='brewery'?3:2;}
export function waterSummary(s,b){
 const residents=s.citizens.filter(c=>supplyHome(c)===buildingKey(b)),daily=residents.reduce((n,c)=>n+waterDemand(c),0),trips=s.citizens.filter(c=>c.waterTrip?.target===buildingKey(b));
 return {stock:targetStock(b)||0,demand:daily,capacity:targetCapacity(s,b),delivered:b.waterDelivered||0,inTransit:trips.reduce((n,c)=>n+c.waterTrip.load,0),couriers:trips.length,thirsty:residents.filter(c=>(c.thirst||0)>30).length};
}
export function initializeWater(s){
 const demands=new Map();for(const c of s.citizens||[]){c.thirst??=0;demands.set(c.home,(demands.get(c.home)||0)+waterDemand(c));}
 for(const b of s.buildings||[])if(b.type==='house'){const daily=demands.get(buildingKey(b))||0;b.water??=daily*2;b.waterDelivered??=b.water;}
}
function eligible(c){return c.age>=16&&c.health>20&&!c.clinic&&!c.school&&!c.waterTrip&&!c.pantryTrip&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);}
function need(s,b){
 if(!isOperational(b)||!['house','brickyard','pottery','brewery','bakery','linenYard','cowshed'].includes(b.type))return 0;
 const id=buildingKey(b);if(s.citizens.some(c=>c.waterTrip?.target===id))return 0;
 if(b.type==='cowshed')return dairyNeeds(b).water;
 if(isArtisan(b))return artisanNeeds(b).water||0;
 if(b.type==='brickyard')return b.brickmaking&&!b.brickmaking.wet&&!b.brickmaking.ready?Math.max(0,2-b.brickmaking.water):0;
 const v=waterSummary(s,b);return v.demand>0&&v.stock<v.demand?Math.max(0,v.capacity-v.stock):0;
}
function begin(s,c,b,station,nav,from=null){
 const target=buildingKey(b),origin=station||from||target;
 const out=origin!==target?roadRoute(nav,origin,target):null;
 if(origin!==target&&!out)return false;
 const load=Math.min(station?WATERPOINT_CAPACITY:6,Math.max(0,targetCapacity(s,b)-targetStock(b)));
 if(load<=eps)return false;
 const intake=station&&nav.ports.get(station);
 const reserve=intake?.building.waterReserve||0;
 if(reserve>eps&&out&&Math.hypot(c.x-intake.x,c.y-intake.y)<=.8){
  const amount=Math.min(load,reserve);
  intake.building.waterReserve=reserve-amount;
  c.waterTrip={target,station,origin,load:amount,amount,phase:'deliver',route:[point(c),...out.map(point)],index:1,elapsed:0};
  c.phase='waterTrip';
  return true;
 }
 const source=bankRoute(s,nav,origin);
 if(!source)return false;
 // Couriers start at their actual home/work port. No resource is credited here.
 if(Math.hypot(c.x-source[0].x,c.y-source[0].y)>.8)return false;
 c.waterTrip={target:buildingKey(b),station:station||null,origin,load:0,amount:load,phase:'source',route:[point(c),...source.map(point)],index:1,elapsed:0};c.phase='waterTrip';return true;
}
export function neighborWaterRoute(s,c,b){
 if(!c||!b||b.type!=='house'||!isOperational(b)||!eligible(c)||c.health<60||c.phase!=='home'||c.floodShelter||c.site||c.workplace||
  c.home===buildingKey(b)||s.citizens.some(p=>p.waterTrip?.target===buildingKey(b))||targetCapacity(s,b)-targetStock(b)<1)return null;
 const nav=navigation(s),source=bankRoute(s,nav,c.home);
 if(!source||Math.hypot(c.x-source[0].x,c.y-source[0].y)>.8||!roadRoute(nav,c.home,buildingKey(b)))return null;
 return nav;
}
export function dispatchNeighborWater(s,c,b){
 const nav=neighborWaterRoute(s,c,b);
 return !!nav&&begin(s,c,b,null,nav,c.home);
}
export function planFireWaterTrips(s,kiln,sources,amount){
 const nav=navigation(s),target=buildingKey(kiln),trips=[];
 let remaining=amount;
 for(const {home,surplus} of sources){
  const origin=buildingKey(home),route=roadRoute(nav,origin,target);
  if(!route)continue;
  const courier=s.citizens.find(c=>c.home===origin&&c.phase==='home'&&eligible(c)&&c.health>=60&&!c.floodShelter&&
   !c.pendingRole&&!c.site&&!c.guardPost&&Math.hypot(c.x-route[0].x,c.y-route[0].y)<=.8);
  if(!courier)continue;
  const load=Math.min(surplus,remaining);
  trips.push({home,courier,trip:{fire:true,target,origin,station:null,load,amount:load,phase:'deliver',route:[point(courier),...route.map(point)],index:1,elapsed:0}});
  remaining-=load;
  if(remaining<=eps)return trips;
 }
 return null;
}
function setRoute(t,route,phase,c){t.route=[point(c),...route.map(point)];t.index=1;t.phase=phase;}
// A city funeral returns everyone home. Resume from that real position rather
// than drawing a straight line to a stale waypoint on the opposite riverbank.
export function resumeWaterAtHome(s,c){
 const t=c.waterTrip;if(!t)return false;const nav=navigation(s),home=nav.ports.get(c.home);
 if(!home||Math.hypot(c.x-home.x,c.y-home.y)>.05)return false;
 const returning=t.fire&&(t.phase==='return'||t.load<=eps||!s.buildings.some(b=>buildingKey(b)===t.target&&b.kilnFire));
 const destination=!returning&&t.load>eps?t.target:t.origin,roads=roadRoute(nav,c.home,destination);
 if(!roads){recoverWater(s,c);return false;}
 if(returning)setRoute(t,roads,'return',c);
 else if(t.load>eps)setRoute(t,roads,'deliver',c);
 else if(t.neighborRecorded)setRoute(t,roads,'return',c);
 else{const source=bankRoute(s,nav,t.origin);if(!source){recoverWater(s,c);return false;}setRoute(t,[...roads,...source],'source',c);}
 return true;
}
function finish(s,c){cancelFirstWaterHelp(s,c.id);if(c.pendingRole)changes.add(s);const t=c.waterTrip;c.phase=t.origin===c.home?'home':c.work===t.origin?'working':'home';c.route=[];c.routeIndex=0;delete c.waterTrip;}
function waterDetour(s,c,t,nav,phase=t.phase){
 const blocked=blockedWaterTrips.get(t);
 if(blocked?.nav===nav&&blocked.phase===phase)return null;
 const x=Math.round(c.x+.5),y=Math.round(c.y+.5),starts=[];
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
  const p={x:x+dx-.5,y:y+dy-.5};
  if((!nav.forts||nav.forts.pointClear(p)&&nav.forts.segmentClear(c,p))&&dryEdge(s,c,p)&&(!nav.flooded||!floodedSegment(nav.flooded,c,p)))starts.push(p);
 }
 starts.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
 const destination=phase==='source'?null:nav.ports.get(phase==='deliver'?t.target:t.origin);
 for(const p of starts){
  const at=key(p);
  const route=phase==='source'
   ?path(nav.nodes,nav.graph,at,(_,q)=>Math.abs(signedRiverDistance(q.x,q.y,s))<2.25)
   :destination&&(path(nav.network.nodes,nav.network.graph,at,k=>k===destination.key,nav.flooded)||
     path(nav.nodes,nav.graph,at,k=>k===destination.key));
  if(route)return route;
 }
 blockedWaterTrips.set(t,{nav,phase});
 return null;
}
function advanceTrip(s,c,dt,nav){
 const t=c.waterTrip,b=s.buildings.find(b=>buildingKey(b)===t.target&&isOperational(b));
 if(t.fire&&t.phase==='deliver'&&!b?.kilnFire){
  const route=waterDetour(s,c,t,nav,'return');
  if(!route)return;
  setRoute(t,route,'return',c);
 }
 if(!b&&!t.fire){finish(s,c);return;}
 let budget=dt;
 for(let turn=0;turn<8&&budget>eps;turn++){
  if(t.phase==='fill'){
   const used=Math.min(budget,2-t.elapsed);t.elapsed+=used;budget-=used;if(t.elapsed<2-eps)return;
   if(nav.forts){
    t.load=t.amount;
    const route=waterDetour(s,c,t,nav,'deliver');
    if(!route)return;
    setRoute(t,route,'deliver',c);continue;
   }
   const origin=nav.ports.get(t.origin);
   const back=nav.flooded?origin&&path(nav.nodes,nav.graph,key(c),k=>k===origin.key):[...bankRoute(s,nav,t.origin)||[]].reverse();
   if(!back)return;
   t.load=t.amount;const delivery=t.origin!==t.target?roadRoute(nav,t.origin,t.target):[];
   if(t.origin!==t.target&&!delivery)return;setRoute(t,[...back,...delivery||[]],'deliver',c);continue;
  }
  const next=t.route[t.index];
  if(next&&nav.flooded&&floodedSegment(nav.flooded,c,next))return;
  if(next&&nav.forts&&!nav.forts.segmentClear(c,next)){
   const route=waterDetour(s,c,t,nav);
   if(!route)return;
   setRoute(t,route,t.phase,c);continue;
  }
  if(next){const d=Math.hypot(next.x-c.x,next.y-c.y),speed=(t.station?1.35:1.05)*(s.buffs?.haste?1.5:1)*(t.station&&c.calling==='watercarrier'&&c.role==='watercarrier'?1.2:1),time=d/speed;if(time>budget){c.x+=(next.x-c.x)*budget/time;c.y+=(next.y-c.y)*budget/time;return;}c.x=next.x;c.y=next.y;t.index++;budget-=time;continue;}
  if(t.phase==='source'){t.phase='fill';t.elapsed=0;continue;}
  if(t.phase==='deliver'){
   if(t.fire){
    if(t.load>eps&&b.kilnFire){
     const amount=t.load;
     b.kilnFireWater=(b.kilnFireWater||0)+amount;
     t.load=0;
     const extinguished=b.kilnFireWater+eps>=2;
     if(extinguished){
      delete b.kilnFire;delete b.kilnFireElapsed;delete b.kilnFireWater;
     }
     log(s,`${citizenName(c.id)} принёс воду к печи`,`Из двора ${t.origin} к печи ${t.target} · ${Math.round(amount*100)/100} воды. ${extinguished?'Очаг потушен.':'Ждут остальную воду.'}`,'good');
    }
    const route=roadRoute(nav,t.target,t.origin);
    if(!route)return;
    setRoute(t,route,'return',c);continue;
   }
   const amount=Math.min(t.load,Math.max(0,targetCapacity(s,b)-targetStock(b)));
   if(b.type==='house')b.water+=amount;else if(b.type==='cowshed')b.dairy.water+=amount;else if(isArtisan(b))b.artisan.water+=amount;else b.brickmaking.water+=amount;b.waterDelivered=(b.waterDelivered||0)+amount;
   if(amount>0&&t.station&&s.creatorMaterials)recordCreatorUse(s,s.buildings.find(site=>site.type==='waterpoint'&&buildingKey(site)===t.station));recordCitizenDelivery(s,c,{water:amount});t.load-=amount;recordDepthSupply(s,c,b,amount);recordNeighborWaterFact(s,c,b,t,amount);confirmFirstWaterHelp(s,c,b,amount);confirmProjectWater(s,c,t.station,b,amount);
   if(t.origin!==t.target){const back=roadRoute(nav,t.target,t.origin);if(!back)return;setRoute(t,back,'return',c);}else finish(s,c);
   if(!c.waterTrip)return;continue;
  }
  if(t.fire&&t.load>eps){
   const origin=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===t.origin);
   if(origin)origin.water+=t.load;
  }
  finish(s,c);return;
 }
}
export function advanceWater(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;initializeWater(s);
 const houses=new Map(s.buildings.filter(b=>b.type==='house').map(b=>[buildingKey(b),b]));
 for(const c of s.citizens){const b=houses.get(supplyHome(c,{arrived:true})),amount=waterDemand(c)*dt/WATER_DAY,drunk=b?Math.min(b.water,amount):0;if(b)b.water=Math.max(0,b.water-drunk);const shortage=amount-drunk;c.thirst=Math.max(0,Math.min(100,c.thirst+(shortage>eps?dt*.8:-dt*3)));if(c.thirst>30){c.health=Math.max(0,c.health-dt*.025*(c.thirst/100));c.mood=Math.max(0,c.mood-dt*.04);}}
 if(s.funeral&&s.funeral.scope!=='family')return;
 const nav=navigation(s),mourning=new Set(s.funeral?.actors.map(a=>a.id)||[]),day=((8+s.simTime*.4)%24+24)%24;
 for(const c of s.citizens)if(c.waterTrip&&!mourning.has(c.id))advanceTrip(s,c,dt,nav);
 if(isStrictSumer(s)){
  const assigned=new Set(s.citizens.filter(c=>c.waterTrip).map(c=>c.waterTrip.target));
  for(const c of s.citizens){
   if(c.thirst<30||!['home','working','resting'].includes(c.phase)||!eligible(c)||c.guardPost||c.manualGathering||mourning.has(c.id))continue;
   const home=houses.get(c.home);
   if(!home||!isOperational(home)||home.water>=waterDemand(c)||assigned.has(c.home))continue;
   const origin=c.phase==='working'?c.work:c.home;
   if(origin&&begin(s,c,home,null,nav,origin))assigned.add(c.home);
  }
 }
 if(day<6||day>=19)return changes.delete(s);
 // Build household demand once per step: never rescan every resident per courier.
 const buildings=new Map(s.buildings.map(b=>[buildingKey(b),b])),daily=new Map(),adults=new Set(),assigned=new Set();
 for(const c of s.citizens){const home=supplyHome(c);daily.set(home,(daily.get(home)||0)+waterDemand(c));if(c.age>=16&&c.health>20&&!c.floodShelter)adults.add(home);if(c.waterTrip)assigned.add(c.waterTrip.target);}
 const targets=s.buildings.filter(b=>isOperational(b)&&(b.type==='house'?(daily.get(buildingKey(b))||0)>0&&b.water<(daily.get(buildingKey(b))||0):b.type==='cowshed'?dairyNeeds(b).water>eps:isArtisan(b)?(artisanNeeds(b).water||0)>eps:b.type==='brickyard'&&b.brickmaking&&!b.brickmaking.wet&&!b.brickmaking.ready&&b.brickmaking.water<2-eps));
 const needy=new Set(targets.map(buildingKey)),orphans=targets.filter(b=>b.type==='house'&&!adults.has(buildingKey(b)));
 const wanted=b=>b&&needy.has(buildingKey(b))&&!assigned.has(buildingKey(b));
 const dispatch=(c,b,station=null,origin=null)=>{if(begin(s,c,b,station,nav,origin)){assigned.add(buildingKey(b));return true;}return false;};
 const firstDeliveries=new Map();
 for(const station of s.buildings){
  const project=station.humanWaterProject,home=houses.get(project?.home);
  if(project&&!project.delivery&&isOperational(station)&&wanted(home)&&
   (project.homeId===undefined||project.homeId===home.waterEntityId))firstDeliveries.set(buildingKey(station),home);
 }
 if(firstDeliveries.size){
  const suppliedHomes=new Set(s.citizens.map(c=>supplyHome(c,{arrived:true})));
  for(const c of s.citizens){
   const home=firstDeliveries.get(c.work);
   if(wanted(home)&&suppliedHomes.has(buildingKey(home))&&c.phase==='working'&&eligible(c)&&!mourning.has(c.id))dispatch(c,home,c.work);
  }
 }
 for(const c of s.citizens){if(!['home','working'].includes(c.phase)||!eligible(c)||mourning.has(c.id))continue;
  const work=buildings.get(c.work),home=houses.get(c.home);
  if(work?.type==='waterpoint'&&isOperational(work)&&c.phase==='working'){
   const station=buildingKey(work),candidates=targets.filter(b=>wanted(b)&&roadRoute(nav,station,buildingKey(b))).sort((a,b)=>targetStock(a)-targetStock(b)||Math.hypot(a.x-work.x,a.y-work.y)-Math.hypot(b.x-work.x,b.y-work.y));
   if(candidates[0])dispatch(c,candidates[0],station);continue;
  }
  if(c.phase==='home'&&wanted(home)){dispatch(c,home);continue;}
  if(c.phase==='home'&&home&&home.water>(daily.get(c.home)||0)){
   const neighbor=orphans.find(b=>wanted(b)&&roadRoute(nav,c.home,buildingKey(b)));if(neighbor&&dispatch(c,neighbor,null,c.home))continue;
  }
  if(c.phase==='working'&&(work?.type==='brickyard'||work?.type==='cowshed'||isArtisan(work))&&wanted(work))dispatch(c,work);
 }
 return changes.delete(s);
}
export function validateWater(s){
 const finite=(v,max=1e9)=>Number.isFinite(v)&&v>=0&&v<=max;
 if(!s.buildings.every(b=>(b.type==='house'?finite(b.water)&&finite(b.waterDelivered):b.water===undefined)&&
  (b.waterReserve===undefined||s.depthSupply&&b.type==='waterpoint'&&isOperational(b)&&finite(b.waterReserve,WATERPOINT_CAPACITY))))return false;
 return s.citizens.every(c=>{if(!finite(c.thirst,100)||c.phase==='waterTrip'&&!c.waterTrip)return false;const t=c.waterTrip;if(!t)return true;
  return c.age>=16&&c.phase==='waterTrip'&&typeof t.target==='string'&&s.buildings.some(b=>buildingKey(b)===t.target&&(t.fire===true?b.type==='kiln':['house','brickyard','pottery','brewery','bakery','linenYard','cowshed'].includes(b.type)))&&(t.fire===undefined||t.fire===true&&t.station===null&&t.origin!==t.target&&s.buildings.some(b=>b.type==='house'&&buildingKey(b)===t.origin)&&['deliver','return'].includes(t.phase)&&t.amount<=2&&t.neighborRecorded===undefined)&&(t.station===null||s.buildings.some(b=>buildingKey(b)===t.station&&b.type==='waterpoint'))&&typeof t.origin==='string'&&(t.neighborRecorded===undefined||t.neighborRecorded===true&&t.station===null&&t.origin!==t.target&&['deliver','return'].includes(t.phase))&&finite(t.load,12)&&finite(t.amount,12)&&t.amount>0&&t.load<=t.amount&&['source','fill','deliver','return'].includes(t.phase)&&finite(t.elapsed,2.01)&&Array.isArray(t.route)&&t.route.length>0&&t.route.length<worldWidth(s)*worldHeight(s)*4&&t.route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=worldWidth(s)-.5&&p.y>=-.5&&p.y<=worldHeight(s)-.5)&&Number.isInteger(t.index)&&t.index>=1&&t.index<=t.route.length&&!c.pantryTrip&&!c.craftSite&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);
 });
}
