// A festival is an order with local reservations and citizen-owned trips, never a flat exchange.
import {buildingKey,isOperational} from './definitions.js';
import {refundSources,takeReserved,stockStores,syncInventory,foodAvailability,takeStock} from './inventory.js';
import {seedTarget,foodForecast} from './food-planning.js';
import {mealRation,hourOf,affectResidents} from './wellbeing.js';
import {canWork} from './demography.js';
import {networkFor,routeBetween,invalidateAssignments} from './workforce.js';
import {roadSpeed} from './roads.js';
export const FESTIVAL_COST=Object.freeze({food:12,beer:6,prestige:15});
export const FESTIVAL_SECONDS=12;
const keys=['food','beer'],sum=o=>Object.values(o||{}).reduce((n,v)=>n+v,0),distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
const readyTemple=b=>['shrine','ziggurat'].includes(b.type)&&isOperational(b)&&!b.construction;
export function initializeFestival(s){if(s.festival===undefined)s.festival=null;}
function port(s,key){return networkFor(s).ports.find(p=>!p.building.siteKey&&buildingKey(p.building)===key);}
function route(s,c,key){const net=networkFor(s),target=port(s,key);if(!target)return null;let near=null,d=Infinity;for(const n of net.nodes.values()){const v=distance(c,n);if(v<d){near=n;d=v;}}return near&&routeBetween(s,near.key,target.key)?.map(p=>({x:p.x,y:p.y,key:p.key}));}
const busy=c=>!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||!!c.pantryTrip||!!c.clinic||!!c.school||!!c.districtJob||!!c.saleJob||!!c.tradeJob||sum(c.cargo)>0||sum(c.buildCargo)>0;
const eligible=c=>canWork(c)&&c.age>=16&&(c.health??100)>=60&&!c.recovering&&!c.site&&!busy(c)&&!c.pendingRole&&!c.workplace&&!c.guardPost;
function templeFor(s){return s.buildings.find(b=>readyTemple(b)&&s.citizens.some(c=>eligible(c)&&['auto','carrier'].includes(c.role||'auto')&&route(s,c,buildingKey(b))));}
function festivalSources(s,temple){
 const food=foodAvailability(s),destination=port(s,temple),sources={};
 for(const material of keys){let remaining=FESTIVAL_COST[material];for(const b of stockStores(s)){const key=buildingKey(b),origin=port(s,key);if(!origin||!destination||!routeBetween(s,origin.key,destination.key))continue;const n=Math.min(remaining,material==='food'?food.get(key)||0:b.stock?.[material]||0);if(n>0){(sources[key]??={})[material]=n;remaining-=n;}if(remaining<=1e-7)break;}if(remaining>1e-7)return null;}
 return sources;
}
export function festivalReason(s,{ignoreEvent=false}={}){
 if(s.festival)return 'Праздник уже заказан';if(s.funeral)return 'Сначала проводи умерших';if(s.event&&!ignoreEvent||s.lost)return 'Сначала заверши событие';
 if(!s.buildings.some(readyTemple))return 'Нужен готовый храм или зиккурат';if(!templeFor(s))return 'Нужен свободный взрослый носильщик (авто/носильщик) и дорога к храму';
 syncInventory(s);if(s.resources.prestige<15)return 'Нужно 15 престижа';if(s.resources.beer<6)return 'Нужно 6 пива';
 // Even opening the seed reserve for emergency food does not authorize spending it on a feast.
 const reserve=seedTarget(s),meal=s.citizens.reduce((n,c)=>n+mealRation(c),0);
 if(s.resources.food-12<reserve+meal-1e-7)return 'Нужно 12 еды сверх семенного резерва и еды на сезон (один полный ужин)';
 if(!festivalSources(s,buildingKey(templeFor(s))))return 'Нет безопасной дороги от запасов еды и пива к храму';
 return '';
}
export function orderFestival(s){
 const reason=festivalReason(s);if(reason)return {ok:false,reason};const temple=templeFor(s),sources=festivalSources(s,buildingKey(temple));if(!sources)return {ok:false,reason:'Не хватает доступных незарезервированных запасов'};
 // Attach references before withdrawing: reconciliation must retain even an emptied household source.
 s.festival={temple:buildingKey(temple),stage:'supplying',sources,allocations:structuredClone(sources),delivered:{food:0,beer:0},actors:[],rewarded:[],consumed:false,started:null,ordered:s.simTime};
 for(const [key,materials]of Object.entries(sources))for(const [material,n]of Object.entries(materials))takeStock(s,key,material,n);
 s.resources.prestige-=15;invalidateAssignments(s);
 return {ok:true,warning:festivalSummary(s).warning};
}
function release(s,a){const c=s.citizens.find(c=>c.id===a.id);if(!c)return;if(c.phase==='festival'){const path=route(s,c,c.home);c.route=path?.map(p=>({x:p.x,y:p.y}))||[];c.routeIndex=0;c.phase=path?'toHome':'blocked';}invalidateAssignments(s);}
export function cancelFestival(s){
 const q=s.festival;if(!q)return {ok:false,reason:'Нет заказанного праздника'};
 if(!q.consumed){refundSources(s,q.allocations);s.resources.prestige+=15;}
 for(const a of q.actors)release(s,a);s.festival=null;invalidateAssignments(s);return {ok:true,refunded:!q.consumed};
}
// Death/role change gives a festival load back to its original reserved ledger, never ordinary cargo.
export function recoverFestivalCitizen(s,id){const q=s.festival,a=q?.actors.find(a=>a.id===id);if(!a)return false;if(a.load>0)(q.sources[a.source]??={})[a.material]=(q.sources[a.source]?.[a.material]||0)+a.load;release(s,a);q.actors=q.actors.filter(v=>v!==a);return true;}
function enlist(s,q,c,kind,target,source=null,material=null){const path=route(s,c,target);if(!path)return false;
 if(kind==='guest'){const net=networkFor(s),center=port(s,target),places=[...net.nodes.values()].filter(p=>distance(p,center)<=2&&net.components.get(p.key)===net.components.get(center.key));const place=places[q.actors.filter(a=>a.kind==='guest').length%places.length],approach=place&&routeBetween(s,path.at(-1).key,place.key);if(approach)path.push(...approach.slice(1).map(p=>({x:p.x,y:p.y,key:p.key})));}
 q.actors.push({id:c.id,kind,stage:kind==='carrier'?'pickup':'arriving',source,material,load:0,route:path,routeIndex:0,role:c.role||'auto'});c.phase='festival';c.route=[];c.routeIndex=0;invalidateAssignments(s);return true;}
function connected(s,a){const net=networkFor(s);return a.route.every((p,i)=>net.nodes.has(p.key)&&(!i||net.graph.get(a.route[i-1].key)?.has(p.key)));}
function walk(s,c,a,dt){let remaining=dt;while(remaining>1e-8){const target=a.route[a.routeIndex];if(!target)return true;const d=distance(c,target),speed=1.05*roadSpeed(s,c,target),travel=d/speed;if(travel<=remaining+1e-8){c.x=target.x;c.y=target.y;a.routeIndex++;remaining-=travel;}else{c.x+=(target.x-c.x)*remaining/travel;c.y+=(target.y-c.y)*remaining/travel;return false;}}return a.routeIndex>=a.route.length;}
const eveningAt=t=>hourOf(t)>=21||hourOf(t)<3;
const evening=s=>eveningAt(s.simTime);
export function advanceFestival(s,dt){
 initializeFestival(s);const q=s.festival;if(!q||!Number.isFinite(dt)||dt<=0)return;
 const stores=new Set(stockStores(s).map(buildingKey));
 if(s.funeral||s.lost||!s.buildings.some(b=>buildingKey(b)===q.temple&&readyTemple(b))||Object.keys(q.allocations).some(k=>!stores.has(k))){cancelFestival(s);return;}
 for(const a of [...q.actors]){const c=s.citizens.find(c=>c.id===a.id);if(!c||!canWork(c)||c.pendingRole||(c.role||'auto')!==a.role||c.phase!=='festival'){recoverFestivalCitizen(s,a.id);continue;}if(!connected(s,a)){cancelFestival(s);return;}}
 // Close the gathering window before moving or rewarding any late guests.
 if(q.stage==='celebrating'&&(s.simTime-q.started>=FESTIVAL_SECONDS||!evening(s))){cancelFestival(s);return;}
 if(q.stage==='waiting'&&!evening(s)){for(const a of q.actors)release(s,a);q.actors=[];return;}
 if(q.stage==='supplying'){
  for(const c of s.citizens){if(q.actors.length>=2)break;if(!eligible(c)||!['auto','carrier'].includes(c.role||'auto')||!['home','working','resting'].includes(c.phase))continue;
   const entry=Object.entries(q.sources).find(([key,v])=>keys.some(k=>v[k]>1e-7)&&route(s,c,key)&&routeBetween(s,port(s,key)?.key,port(s,q.temple)?.key));if(!entry)continue;
   const [source,materials]=entry,material=keys.find(k=>materials[k]>1e-7);enlist(s,q,c,'carrier',source,source,material);
  }
 }
 if(q.stage==='waiting'&&evening(s)){
  for(const c of s.citizens)if(q.actors.length<24&&eligible(c)&&['home','resting'].includes(c.phase)&&c.mealEaten>=mealRation(c)*.95)enlist(s,q,c,'guest',q.temple);
 }
 for(const a of [...q.actors]){
  const c=s.citizens.find(c=>c.id===a.id);if(!c)continue;if(a.stage==='dancing')continue;if(!walk(s,c,a,dt))continue;
  if(a.kind==='carrier'){
   if(a.stage==='pickup'){
    a.load=takeReserved(s,q.sources,a.source,a.material,6);if(a.load<=1e-7){release(s,a);q.actors=q.actors.filter(v=>v!==a);continue;}
    const path=route(s,c,q.temple);if(!path){cancelFestival(s);return;}a.route=path;a.routeIndex=0;a.stage='delivery';
   }else{q.delivered[a.material]+=a.load;a.load=0;release(s,a);q.actors=q.actors.filter(v=>v!==a);}
  }else{
   if(!eveningAt(s.simTime+dt)){release(s,a);q.actors=q.actors.filter(v=>v!==a);continue;}
   a.stage='dancing';if(!q.consumed){q.consumed=true;q.stage='celebrating';q.started=s.simTime;}
   if(!q.rewarded.includes(c.id)){affectResidents(s,{mood:8,faith:4},[c.id]);q.rewarded.push(c.id);}
  }
 }
 if(q.stage==='supplying'&&keys.every(k=>Math.abs(q.delivered[k]-FESTIVAL_COST[k])<1e-7)&&!q.actors.length)q.stage='waiting';
 if(q.stage==='celebrating'&&(s.simTime-q.started>=FESTIVAL_SECONDS||!evening(s)))cancelFestival(s);
}
export function festivalSummary(s){const q=s.festival,forecast=foodForecast(s,{includeCrops:false}),warning=forecast.balance-(q?0:12)<0?'После заказа прогнозируется нехватка еды до жатвы':'';return {active:!!q,stage:q?.stage||'none',label:!q?'Общинный праздник':q.stage==='supplying'?'Жители несут угощение':q.stage==='waiting'?'Ждём вечера и сытых взрослых':'Праздник у храма',cost:FESTIVAL_COST,delivered:q?{...q.delivered}:{food:0,beer:0},participants:q?.actors.filter(a=>a.kind==='guest').length||0,warning,reason:festivalReason(s)};}
export function festivalView(s){const q=s.festival;if(!q)return null;const b=s.buildings.find(b=>buildingKey(b)===q.temple);return {stage:q.stage,temple:q.temple,x:b?.x,y:b?.y,consumed:q.consumed,participants:q.actors.filter(a=>a.kind==='guest').map(a=>a.id),dancing:q.actors.filter(a=>a.stage==='dancing').map(a=>a.id),carriers:q.actors.filter(a=>a.kind==='carrier').map(a=>({id:a.id,load:a.load,material:a.material})),elapsed:q.started===null?0:s.simTime-q.started};}
export function validateFestival(s){
 const q=s.festival;if(q===null||q===undefined)return !s.citizens?.some(c=>c.phase==='festival');
 const exact=(o,list)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).length===list.length&&list.every(k=>k in o),finite=(n,max=1e9)=>Number.isFinite(n)&&n>=0&&n<=max,id=n=>Number.isSafeInteger(n)&&n>=0;
 if(!exact(q,['temple','stage','sources','allocations','delivered','actors','rewarded','consumed','started','ordered'])||!s.buildings.some(b=>buildingKey(b)===q.temple&&readyTemple(b))||!['supplying','waiting','celebrating'].includes(q.stage)||!exact(q.delivered,keys)||!keys.every(k=>finite(q.delivered[k],FESTIVAL_COST[k]))||!finite(q.ordered,s.simTime)||typeof q.consumed!=='boolean'||(q.consumed?(q.stage!=='celebrating'||!finite(q.started,s.simTime)||q.started<q.ordered):(q.started!==null||q.stage==='celebrating'))||!Array.isArray(q.actors)||q.actors.length>24||!Array.isArray(q.rewarded)||q.rewarded.length>24||new Set(q.rewarded).size!==q.rewarded.length||!q.rewarded.every(id)||(!q.consumed&&q.rewarded.length))return false;
 const stores=new Set(stockStores(s).map(buildingKey)),totals={food:0,beer:0},left={food:0,beer:0};
 for(const [map,total]of [[q.allocations,totals],[q.sources,left]]){if(!map||typeof map!=='object'||Array.isArray(map))return false;for(const [key,v]of Object.entries(map)){if(!stores.has(key)||!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))return false;for(const [k,n]of Object.entries(v)){if(!finite(n,FESTIVAL_COST[k]))return false;total[k]+=n;if(map===q.sources&&n>(q.allocations[key]?.[k]||0)+1e-7)return false;}}}
 const ids=new Set();for(const a of q.actors){const c=s.citizens.find(c=>c.id===a.id);if(!exact(a,['id','kind','stage','source','material','load','route','routeIndex','role'])||!c||!id(a.id)||ids.has(a.id)||c.phase!=='festival'||!canWork(c)||busy(c)||typeof a.role!=='string'||!finite(a.load,6)||!Array.isArray(a.route)||!a.route.length||a.route.length>4096||!id(a.routeIndex)||a.routeIndex>a.route.length||a.route.some((p,i)=>!exact(p,['x','y','key'])||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.key!==`${p.x+.5},${p.y+.5}`||i&&Math.abs(distance(p,a.route[i-1])-1)>1e-7)||!connected(s,a))return false;ids.add(a.id);
  if(a.kind==='carrier'){if(q.stage!=='supplying'||!['pickup','delivery'].includes(a.stage)||!stores.has(a.source)||!keys.includes(a.material)||!(q.allocations[a.source]?.[a.material]>0)||a.stage==='pickup'&&a.load!==0||a.stage==='delivery'&&a.load<=0||a.route.at(-1)?.key!==port(s,a.stage==='pickup'?a.source:q.temple)?.key)return false;left[a.material]+=a.load;
  }else if(a.kind==='guest'){if(q.stage==='supplying'||a.source!==null||a.material!==null||a.load!==0||!['arriving','dancing'].includes(a.stage)||a.stage==='dancing'&&!q.rewarded.includes(a.id)||distance(a.route.at(-1),port(s,q.temple))>2)return false;}else return false;
 }
 if(s.citizens.some(c=>c.phase==='festival'&&!ids.has(c.id))||q.stage==='waiting'&&q.rewarded.length)return false;
 return keys.every(k=>Math.abs(totals[k]-FESTIVAL_COST[k])<1e-7&&Math.abs(left[k]+q.delivered[k]-FESTIVAL_COST[k])<1e-7)&&(q.stage==='supplying'||keys.every(k=>Math.abs(q.delivered[k]-FESTIVAL_COST[k])<1e-7));
}

export function festivalCitizenView(s,c){const a=s.festival?.actors.find(a=>a.id===c.id);return a?{walking:a.stage!=='dancing',carrying:a.load>0,cargo:a.load>0?{[a.material]:a.load}:{},celebrating:a.stage==='dancing'}:{};}
