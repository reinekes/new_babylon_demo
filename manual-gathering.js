import {recordManualProduction} from './building-production-history.js';
import {reedStatus,takeReeds,REED_CAPACITY} from './reed-stock.js';
import {CLAY_CAPACITY,STONE_CAPACITY,mineralRemaining,takeMineral} from './mineral-stock.js';
import {FOREST_CAPACITY,forestStock,takeWood} from './forest-stock.js';
import {depositAt,depositSiteAt,isDryPoint,worldWidth,worldHeight} from './world.js';
import {buildingKey} from './definitions.js';
import {footprintSize} from './footprints.js';
import {canWork} from './demography.js';
import {stockStores,storeCapacity} from './inventory.js';
import {nearestWalkingNode} from './navigation.js';
import {cityCommandReason} from './city-command-lock.js';
import {isStrictSumer} from './scenario-profiles.js';

// One small basket of raw material. A quarter is usable without a workplace.
export const MANUAL_YIELD=.25;
export const MANUAL_GATHERING=Object.freeze({
 clay:{workSeconds:18,batchSize:1,resource:'clay',task:'clay',capacity:CLAY_CAPACITY,inspiration:true},
 reed:{workSeconds:18,batchSize:1,resource:'reed',task:'reed',capacity:REED_CAPACITY,inspiration:true},
 stone:{workSeconds:28,batchSize:1,resource:'stone',task:'quarry',capacity:STONE_CAPACITY},
 forest:{workSeconds:28,batchSize:1,resource:'wood',task:'logging',capacity:FOREST_CAPACITY},
 dates:{workSeconds:18,batchSize:1,resource:'food',task:'garden'},
});
const rawBatchSize=(kind,boosted)=>MANUAL_GATHERING[kind].batchSize*(boosted&&MANUAL_GATHERING[kind].inspiration?1.75:1);
const customPhase=p=>p==='toManualGathering'||p==='manualGathering';
const hasLoad=c=>Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0);
const keyOf=(x,y)=>`${x},${y}`;
const orders=s=>s.manualGathering?.orders||[];
const accessFailures=new WeakMap();
const daylight=s=>{const hour=((8+(s.simTime||0)*.4)%24+24)%24;return hour>=6&&hour<19;};
const commandReason=s=>cityCommandReason(s)||(s.funeral?'Жители прощаются с умершими':s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':'');
function occupied(s,x,y){return s.buildings.some(b=>x>=b.x&&y>=b.y&&x<b.x+footprintSize(b)&&y<b.y+footprintSize(b));}
function siteReason(s,x,y){
 const kind=depositAt(s,x,y);
 if(!Number.isInteger(x)||!Number.isInteger(y)||!MANUAL_GATHERING[kind])return 'Выбери глину, тростник, камень, лес или финиковые пальмы';
 if(mineralRemaining(s,kind,x,y)<=1e-8)return 'Месторождение исчерпано';
 if(kind==='reed'){
  const {resting,stock}=reedStatus(s,x,y);
  if(resting)return 'Тростниковое угодье отдыхает';
  if(stock<=1e-8)return 'Тростниковое угодье исчерпано';
 }
 if(kind==='forest'&&isStrictSumer(s)){
  const {resting,stock}=forestStock(s,keyOf(x,y));
  if(resting)return 'Лес восстанавливается';
  if(stock<=1e-8)return 'Лесной участок исчерпан';
 }
 if(occupied(s,x,y))return 'На участке уже есть здание или стройка';
 if(!isDryPoint(s,x,y))return 'К участку нет подхода с суши';
 return '';
}
export function orderManualGathering(s,x,y){
 const reason=commandReason(s)||siteReason(s,x,y);if(reason)return {ok:false,reason};
 s.manualGathering??={version:1,orders:[]};const key=keyOf(x,y),existing=orders(s).find(q=>q.key===key);
 if(existing)existing.active=true;else s.manualGathering.orders.push({key,x,y,resource:depositAt(s,x,y),active:true});
 return {ok:true};
}
export function cancelManualGathering(s,x,y){const reason=commandReason(s);if(reason)return {ok:false,reason};const q=orders(s).find(q=>q.key===keyOf(x,y));if(!q)return {ok:false,reason:'Здесь нет поручения'};q.active=false;return {ok:true};}
export function manualGatheringView(s,x,y){
 const site=depositSiteAt(s,x,y),kind=site?.kind,config=MANUAL_GATHERING[kind];if(!config)return null;
 const {resource,workSeconds}=config,capacity=site.capacity??config.capacity,key=keyOf(x,y),q=orders(s).find(q=>q.key===key),workers=s.citizens.filter(c=>c.manualGathering?.key===key).map(c=>({id:c.id,phase:c.phase,progress:c.manualGathering.progress/workSeconds,carrying:(c.cargo?.[resource]||0)>0}));
 const reason=commandReason(s)||siteReason(s,x,y),active=!!q?.active,status=reason?'blocked':!active?'inactive':workers.some(c=>c.phase==='manualGathering')?'working':workers.some(c=>c.carrying)?'carrying':workers.length?'walking':'waiting';
 const statusReason=!active?'':!daylight(s)?'Ночью жители отдыхают; добыча продолжится утром':workers.length?'':accessFailures.get(s)?.get(key)||(!s.citizens.some(eligible)?'Нет свободных взрослых: занятые работой, стройкой и снабжением жители не отвлекаются':'Свободные жители готовятся выйти к залежи');
 const wetland=kind==='reed'?reedStatus(s,x,y):null,forest=kind==='forest'&&isStrictSumer(s)?forestStock(s,key):null;
 return {key,kind,resource,wetland,remaining:wetland?.stock??forest?.stock??mineralRemaining(s,kind,x,y),capacity,active,status,reason,cancelReason:commandReason(s),statusReason,workers,progress:Math.max(0,...workers.map(c=>c.progress)),workSeconds,batchSize:rawBatchSize(kind,s.buffs?.inspiration)*MANUAL_YIELD,maxWorkers:2};
}
export function manualGatheringOrder(s,c){return orders(s).find(q=>q.key===c.manualGathering?.key);}
export function manualGatheringStillAssigned(s,c){
 const q=manualGatheringOrder(s,c);return !!q?.active&&!siteReason(s,q.x,q.y)&&canWork(c)&&c.role==='auto'&&!c.pendingRole&&!c.workplace&&!c.guardPost&&!c.work&&!c.site&&!c.tradeJob&&!c.saleJob&&!c.districtJob&&!c.clinic&&!c.school&&!['festival','relic','relicGuest','awakening'].includes(c.phase)&&c.health>=40;
}
export function releaseManualGathering(c){delete c.manualGathering;}
export function manualGatheringActivity(s,c){
 const q=manualGatheringOrder(s,c);if(!q||!customPhase(c.phase))return null;
 const {task,workSeconds}=MANUAL_GATHERING[q.resource];
 return {kind:['quarry','logging'].includes(task)?task:'gathering',task,target:{x:q.x,y:q.y},progress:c.manualGathering.progress/workSeconds,stage:c.phase==='toManualGathering'?'approach':'working'};
}
function eligible(c){return canWork(c)&&c.role==='auto'&&c.phase==='home'&&c.health>=60&&c.hunger<60&&!c.pendingRole&&!c.workplace&&!c.guardPost&&!c.work&&!c.site&&!c.clinic&&!c.school&&!c.pantryTrip&&!c.waterTrip&&!c.craftSite&&c.clothingTarget===undefined&&!c.seedField&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!hasLoad(c);}
/** Claim only genuinely idle adults, after household supply and normal work. */
export function beginManualGathering(s,c,ctx,routeFor){
 if(!s.manualGathering?.orders.some(q=>q.active)||!eligible(c))return false;
 const own=c.manualGathering,origin=nearestWalkingNode(ctx.network,c);if(!origin)return false;
 const candidates=orders(s).filter(q=>q.active&&!siteReason(s,q.x,q.y)&&(!own||own.key===q.key)&&s.citizens.filter(p=>p.id!==c.id&&p.manualGathering?.key===q.key).length<2).sort((a,b)=>Math.hypot(c.x-a.x,c.y-a.y)-Math.hypot(c.x-b.x,c.y-b.y));
 let failures=accessFailures.get(s);if(!failures){failures=new Map();accessFailures.set(s,failures);}
 for(const q of candidates){
  let reachable=false;const stands=[];for(const [dx,dy]of [[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){const p=ctx.network.nodes.get(`${q.x+dx+.5},${q.y+dy+.5}`);if(p&&isDryPoint(s,p.x,p.y)&&!s.citizens.some(v=>v.id!==c.id&&v.manualGathering?.key===q.key&&v.manualGathering.stand.x===p.x&&v.manualGathering.stand.y===p.y))stands.push(p);}
  stands.sort((a,b)=>Math.hypot(a.x-c.x,a.y-c.y)-Math.hypot(b.x-c.x,b.y-c.y));
  for(const stand of stands){
   const route=routeFor(origin.key,stand.key);if(!route)continue;reachable=true;
   const {resource}=MANUAL_GATHERING[q.resource];
   let store=null,storeDistance=Infinity;for(const b of stockStores(s)){if((b.stock?.[resource]||0)>=storeCapacity(b)-1e-7)continue;const key=buildingKey(b),port=ctx.ports.get(key),toStore=port&&routeFor(stand.key,port.key);if(toStore&&toStore.length<storeDistance){store=key;storeDistance=toStore.length;}}
   if(!store)continue;
   c.manualGathering={key:q.key,progress:own?.progress||0,stand:{x:stand.x,y:stand.y}};c.store=store;c.route=[{x:c.x,y:c.y},...route.map(p=>({x:p.x,y:p.y}))];c.routeIndex=1;c.phase='toManualGathering';failures.delete(q.key);return true;
  }
  failures.set(q.key,reachable?'Нет доступного склада со свободным местом: освободи склад или построй его на этом берегу':'Нет сухого пути к залежи: нужен мост или свободный подход');
 }
 return false;
}
/** Produces an owned load at the deposit; inventory changes only on delivery. */
export function workManualGathering(s,c,dt,rate=1){
 const q=manualGatheringOrder(s,c),job=c.manualGathering;if(!q||!job||c.phase!=='manualGathering'||Math.hypot(c.x-job.stand.x,c.y-job.stand.y)>1e-6||hasLoad(c))return false;
 const config=MANUAL_GATHERING[q.resource];job.progress=Math.min(config.workSeconds,job.progress+dt*Math.max(0,rate));if(job.progress<config.workSeconds-1e-7)return false;
 const batch=rawBatchSize(q.resource,s.buffs?.inspiration);
 const taken=q.resource==='reed'?takeReeds(s,q.x,q.y,batch):q.resource==='forest'?takeWood(s,q.key,batch):q.resource==='dates'?batch:takeMineral(s,q.resource,q.x,q.y,batch);
 const amount=taken*MANUAL_YIELD;
 job.progress=0;
 if(amount<=1e-8)return false;
 c.cargo={[config.resource]:amount};recordManualProduction(s,{x:q.x,y:q.y,resource:config.resource},amount);return true;
}
export function validateManualGathering(s){
 const m=s.manualGathering,custom=(s.citizens||[]).filter(c=>c.manualGathering!==undefined||customPhase(c.phase));if(m===undefined)return custom.length===0;
 if(!m||m.version!==1||!Array.isArray(m.orders)||m.orders.length>(s.world?.deposits?.length||0))return false;
 const seen=new Set();for(const q of m.orders){if(!q||typeof q!=='object'||Array.isArray(q)||Object.keys(q).some(k=>!['key','x','y','resource','active'].includes(k))||!Number.isInteger(q.x)||!Number.isInteger(q.y)||q.x<0||q.y<0||q.x>=worldWidth(s)||q.y>=worldHeight(s)||q.key!==keyOf(q.x,q.y)||seen.has(q.key)||!MANUAL_GATHERING[q.resource]||q.resource!==depositAt(s,q.x,q.y)||typeof q.active!=='boolean')return false;seen.add(q.key);}
 const counts=new Map(),stands=new Set();for(const c of custom){const j=c.manualGathering,q=j&&m.orders.find(q=>q.key===j.key);if(!q||!j||Object.keys(j).some(k=>!['key','progress','stand'].includes(k))||!Number.isFinite(j.progress)||j.progress<0||j.progress>MANUAL_GATHERING[q.resource].workSeconds||!j.stand||!Number.isFinite(j.stand.x)||!Number.isFinite(j.stand.y)||Math.abs(j.stand.x-q.x)!==.5||Math.abs(j.stand.y-q.y)!==.5)return false;
  const standKey=`${q.key}:${j.stand.x},${j.stand.y}`;if(stands.has(standKey))return false;stands.add(standKey);
  const n=(counts.get(q.key)||0)+1;if(n>2)return false;counts.set(q.key,n);
  if(customPhase(c.phase)&&(hasLoad(c)||c.work||c.site||c.pantryTrip||c.waterTrip||c.craftSite||c.clothingTarget!==undefined||c.tradeJob||c.saleJob||c.districtJob||c.clinic||c.school))return false;
  // Keep the old maximum for a basket already owned before the yield change.
  if(Object.keys(c.cargo||{}).some(k=>(c.cargo[k]||0)>0&&(k!==MANUAL_GATHERING[q.resource].resource||c.cargo[k]>rawBatchSize(q.resource,true))))return false;
  if(c.phase==='manualGathering'&&!s.funeral?.actors.some(a=>a.id===c.id)&&Math.hypot(c.x-j.stand.x,c.y-j.stand.y)>1e-6)return false;
 }
 return true;
}
