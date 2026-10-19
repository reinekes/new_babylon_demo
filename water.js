import {buildingKey,isOperational} from './definitions.js';
import {isDryPoint,river,WIDTH,HEIGHT} from './world.js';
import {generateStreets} from './city-life.js';

// Water remains in vessels and homes, never in the city's abstract material stock.
export const WATER_DAY=60;
export const waterBusy=c=>!!c.waterTrip;
// A broken vessel/death spills water; it cannot teleport into a house or store.
export function recoverWater(s,c){const amount=c.waterTrip?.load||0;if(c.waterTrip)finish(s,c);return amount;}
const caches=new WeakMap(),changes=new WeakSet(),eps=1e-7;
const demand=c=>c.age<16?.5:1;
const point=p=>({x:p.x,y:p.y});
const key=p=>`${Math.round(p.x+.5)},${Math.round(p.y+.5)}`;
const dryEdge=(s,a,b)=>[0,.25,.5,.75,1].every(t=>isDryPoint(s,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t));
function navigation(s){
 const signature=[...s.buildings,...s.roadAnchors||[]].map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||''}`).join('|');
 let cache=caches.get(s);if(cache?.signature===signature)return cache;
 const network=generateStreets([...s.buildings,...s.roadAnchors||[]],s),ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p])),nodes=new Map(),graph=new Map();
 for(let y=0;y<=HEIGHT;y++)for(let x=0;x<=WIDTH;x++){const p={x:x-.5,y:y-.5};if(isDryPoint(s,p.x,p.y)){nodes.set(`${x},${y}`,p);graph.set(`${x},${y}`,[]);}}
 for(const [k,p]of nodes)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const q={x:p.x+dx,y:p.y+dy},qk=key(q);if(nodes.has(qk)&&dryEdge(s,p,q))graph.get(k).push(qk);}
 cache={signature,network,ports,nodes,graph,banks:new Map(),roads:new Map()};caches.set(s,cache);return cache;
}
function path(nodes,graph,from,to){
 if(!nodes.has(from))return null;const prev=new Map([[from,null]]),queue=[from];
 for(let i=0;i<queue.length;i++){const k=queue[i];if(to(k,nodes.get(k))){const result=[];for(let at=k;at!==null;at=prev.get(at))result.push(point(nodes.get(at)));return result.reverse();}for(const next of graph.get(k)||[])if(!prev.has(next)){prev.set(next,k);queue.push(next);}}
 return null;
}
function bankRoute(s,nav,origin){
 if(!nav.banks.has(origin)){const p=nav.ports.get(origin);nav.banks.set(origin,p?path(nav.nodes,nav.graph,key(p),(_,q)=>Math.abs(q.x-river(q.y))<2.25):null);}return nav.banks.get(origin);
}
function roadRoute(nav,from,to){
 const id=`${from}>${to}`;if(!nav.roads.has(id)){const a=nav.ports.get(from),b=nav.ports.get(to);nav.roads.set(id,a&&b?path(nav.network.nodes,nav.network.graph,a.key,k=>k===b.key):null);}return nav.roads.get(id);
}
const targetStock=b=>b.type==='house'?b.water:b.brickmaking?.water||0;
function targetCapacity(s,b){return b.type==='house'?Math.max(2,s.citizens.filter(c=>c.home===buildingKey(b)).reduce((n,c)=>n+demand(c),0)*3):2;}
export function waterSummary(s,b){
 const residents=s.citizens.filter(c=>c.home===buildingKey(b)),daily=residents.reduce((n,c)=>n+demand(c),0),trips=s.citizens.filter(c=>c.waterTrip?.target===buildingKey(b));
 return {stock:targetStock(b)||0,demand:daily,capacity:targetCapacity(s,b),delivered:b.waterDelivered||0,inTransit:trips.reduce((n,c)=>n+c.waterTrip.load,0),couriers:trips.length,thirsty:residents.filter(c=>(c.thirst||0)>30).length};
}
export function initializeWater(s){
 const demands=new Map();for(const c of s.citizens||[]){c.thirst??=0;demands.set(c.home,(demands.get(c.home)||0)+demand(c));}
 for(const b of s.buildings||[])if(b.type==='house'){const daily=demands.get(buildingKey(b))||0;b.water??=daily*2;b.waterDelivered??=b.water;}
}
function eligible(c){return c.age>=16&&c.health>20&&!c.clinic&&!c.school&&!c.waterTrip&&!c.pantryTrip&&!c.craftSite&&!c.seedField&&c.clothingTarget===undefined&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);}
function need(s,b){
 if(!isOperational(b)||!['house','brickyard'].includes(b.type))return 0;
 const id=buildingKey(b);if(s.citizens.some(c=>c.waterTrip?.target===id))return 0;
 if(b.type==='brickyard')return b.brickmaking&&!b.brickmaking.wet&&!b.brickmaking.ready?Math.max(0,2-b.brickmaking.water):0;
 const v=waterSummary(s,b);return v.demand>0&&v.stock<v.demand?Math.max(0,v.capacity-v.stock):0;
}
function begin(s,c,b,station,nav,from=null){
 const origin=station||from||buildingKey(b),source=bankRoute(s,nav,origin),out=origin!==buildingKey(b)?roadRoute(nav,origin,buildingKey(b)):null;
 if(!source||origin!==buildingKey(b)&&!out)return false;
 const load=Math.min(station?12:6,Math.max(0,targetCapacity(s,b)-targetStock(b)));
 if(load<=eps)return false;
 // Couriers start at their actual home/work port. No resource is credited here.
 if(Math.hypot(c.x-source[0].x,c.y-source[0].y)>.8)return false;
 c.waterTrip={target:buildingKey(b),station:station||null,origin,load:0,amount:load,phase:'source',route:[point(c),...source.map(point)],index:1,elapsed:0};c.phase='waterTrip';return true;
}
function setRoute(t,route,phase,c){t.route=[point(c),...route.map(point)];t.index=1;t.phase=phase;}
// A city funeral returns everyone home. Resume from that real position rather
// than drawing a straight line to a stale waypoint on the opposite riverbank.
export function resumeWaterAtHome(s,c){
 const t=c.waterTrip;if(!t)return false;const nav=navigation(s),home=nav.ports.get(c.home);
 if(!home||Math.hypot(c.x-home.x,c.y-home.y)>.05)return false;
 const destination=t.load>eps?t.target:t.origin,roads=roadRoute(nav,c.home,destination);
 if(!roads){recoverWater(s,c);return false;}
 if(t.load>eps)setRoute(t,roads,'deliver',c);
 else{const source=bankRoute(s,nav,t.origin);if(!source){recoverWater(s,c);return false;}setRoute(t,[...roads,...source],'source',c);}
 return true;
}
function finish(s,c){if(c.pendingRole)changes.add(s);const t=c.waterTrip;c.phase=t.origin===c.home?'home':c.work===t.origin?'working':'home';c.route=[];c.routeIndex=0;delete c.waterTrip;}
function advanceTrip(s,c,dt,nav){
 const t=c.waterTrip,b=s.buildings.find(b=>buildingKey(b)===t.target&&isOperational(b));
 if(!b){finish(s,c);return;}
 let budget=dt;
 for(let turn=0;turn<8&&budget>eps;turn++){
  if(t.phase==='fill'){
   const used=Math.min(budget,2-t.elapsed);t.elapsed+=used;budget-=used;if(t.elapsed<2-eps)return;
   t.load=t.amount;const back=[...bankRoute(s,nav,t.origin)||[]].reverse();const delivery=t.origin!==t.target?roadRoute(nav,t.origin,t.target):[];
   if(t.origin!==t.target&&!delivery)return;setRoute(t,[...back,...delivery||[]],'deliver',c);continue;
  }
  const next=t.route[t.index];
  if(next){const d=Math.hypot(next.x-c.x,next.y-c.y),speed=(t.station?1.35:1.05)*(s.buffs?.haste?1.5:1)*(t.station&&c.calling==='watercarrier'&&c.role==='watercarrier'?1.2:1),time=d/speed;if(time>budget){c.x+=(next.x-c.x)*budget/time;c.y+=(next.y-c.y)*budget/time;return;}c.x=next.x;c.y=next.y;t.index++;budget-=time;continue;}
  if(t.phase==='source'){t.phase='fill';t.elapsed=0;continue;}
  if(t.phase==='deliver'){
   const amount=Math.min(t.load,Math.max(0,targetCapacity(s,b)-targetStock(b)));
   if(b.type==='house')b.water+=amount;else b.brickmaking.water+=amount;b.waterDelivered=(b.waterDelivered||0)+amount;t.load-=amount;
   if(t.origin!==t.target){const back=roadRoute(nav,t.target,t.origin);if(!back)return;setRoute(t,back,'return',c);}else finish(s,c);
   if(!c.waterTrip)return;continue;
  }
  finish(s,c);return;
 }
}
export function advanceWater(s,dt){
 if(!Number.isFinite(dt)||dt<=0)return;initializeWater(s);
 const houses=new Map(s.buildings.filter(b=>b.type==='house').map(b=>[buildingKey(b),b]));
 for(const c of s.citizens){const b=houses.get(c.home),amount=demand(c)*dt/WATER_DAY,drunk=b?Math.min(b.water,amount):0;if(b)b.water=Math.max(0,b.water-drunk);const shortage=amount-drunk;c.thirst=Math.max(0,Math.min(100,c.thirst+(shortage>eps?dt*.8:-dt*3)));if(c.thirst>30){c.health=Math.max(0,c.health-dt*.025*(c.thirst/100));c.mood=Math.max(0,c.mood-dt*.04);}}
 if(s.funeral&&s.funeral.scope!=='family')return;
 const nav=navigation(s),mourning=new Set(s.funeral?.actors.map(a=>a.id)||[]),day=((8+s.simTime*.4)%24+24)%24;
 for(const c of s.citizens)if(c.waterTrip&&!mourning.has(c.id))advanceTrip(s,c,dt,nav);
 if(day<6||day>=19)return changes.delete(s);
 // Build household demand once per step: never rescan every resident per courier.
 const buildings=new Map(s.buildings.map(b=>[buildingKey(b),b])),daily=new Map(),adults=new Set(),assigned=new Set();
 for(const c of s.citizens){daily.set(c.home,(daily.get(c.home)||0)+demand(c));if(c.age>=16&&c.health>20)adults.add(c.home);if(c.waterTrip)assigned.add(c.waterTrip.target);}
 const targets=s.buildings.filter(b=>isOperational(b)&&(b.type==='house'?(daily.get(buildingKey(b))||0)>0&&b.water<(daily.get(buildingKey(b))||0):b.type==='brickyard'&&b.brickmaking&&!b.brickmaking.wet&&!b.brickmaking.ready&&b.brickmaking.water<2-eps));
 const needy=new Set(targets.map(buildingKey)),orphans=targets.filter(b=>b.type==='house'&&!adults.has(buildingKey(b)));
 const wanted=b=>b&&needy.has(buildingKey(b))&&!assigned.has(buildingKey(b));
 const dispatch=(c,b,station=null,origin=null)=>{if(begin(s,c,b,station,nav,origin)){assigned.add(buildingKey(b));return true;}return false;};
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
  if(c.phase==='working'&&work?.type==='brickyard'&&wanted(work))dispatch(c,work);
 }
 return changes.delete(s);
}
export function validateWater(s){
 const finite=(v,max=1e9)=>Number.isFinite(v)&&v>=0&&v<=max;
 if(!s.buildings.every(b=>b.type==='house'?finite(b.water)&&finite(b.waterDelivered):b.water===undefined))return false;
 return s.citizens.every(c=>{if(!finite(c.thirst,100)||c.phase==='waterTrip'&&!c.waterTrip)return false;const t=c.waterTrip;if(!t)return true;
  return c.age>=16&&c.phase==='waterTrip'&&typeof t.target==='string'&&s.buildings.some(b=>buildingKey(b)===t.target&&['house','brickyard'].includes(b.type))&&(t.station===null||s.buildings.some(b=>buildingKey(b)===t.station&&b.type==='waterpoint'))&&typeof t.origin==='string'&&finite(t.load,12)&&finite(t.amount,12)&&t.amount>0&&t.load<=t.amount&&['source','fill','deliver','return'].includes(t.phase)&&finite(t.elapsed,2.01)&&Array.isArray(t.route)&&t.route.length>0&&t.route.length<4000&&t.route.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-.5&&p.x<=WIDTH-.5&&p.y>=-.5&&p.y<=HEIGHT-.5)&&Number.isInteger(t.index)&&t.index>=1&&t.index<=t.route.length&&!c.pantryTrip&&!c.craftSite&&!Object.values(c.cargo||{}).some(n=>n>0)&&!Object.values(c.buildCargo||{}).some(n=>n>0);
 });
}
