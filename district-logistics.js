import {dryFishLotStock,dryFishRoom,collectDryFishLot} from './fish-drying.js';
import {appendGrain,takeGrain} from './grain-origin.js';
import {addGiftFood} from './abundance-origin.js';
import {toolResource} from './axe-kit.js';
import {isStrictSumer} from './scenario-profiles.js';
import {harvestNameEvidence} from './causal-facts.js';
import {supplyHome,residentsByHome,ration,homeMealFood,pantryRestockTarget} from './households.js';
import {isDinnerTime,mealCycle,mealRation} from './wellbeing.js';
import {findShapingBatch,loadShapingBatch} from './shaping-batch.js';
import {markWindCargo} from './wind-delivery.js';
import {markCreatorCargo} from './creator-materials.js';
import {appendFish,takeFish} from './fish-provenance.js';
import {pickupFieldGrain} from './field-grain.js';
import {isVotiveTemple} from './votive-offerings.js';
import {pickupFishingOutput,pickupDryFishingEvidence} from './cat-fishing-ledger.js';
import {cityCommandReason as relicCommandReason} from './city-command-lock.js';
import {isResidence,MATERIALS,BUILDINGS,buildingKey,isOperational} from './definitions.js';
import {stockStores,storeCapacity,storeStock,foodAvailableAt,foodAvailability,takeStock,syncInventory,refundSources} from './inventory.js';
import {networkFor,invalidateAssignments} from './workforce.js';
import {isBuildingStore,isProductionStore,initializeBuildingInventory,collectReadyOutputs,buildingInputRoom,buildingInputStock,putBuildingInput,takeBuildingOutput,inputNeeds,homeStockCapacity} from './building-inventory.js';
const eps=1e-7;
const store=(s,key,pass)=>pass?pass.endpoints.get(key):s.buildings.find(b=>buildingKey(b)===key&&isOperational(b)&&(stockStores(s).includes(b)||isBuildingStore(b)));
const central=(s,b,pass)=>pass?pass.central.has(b):stockStores(s).includes(b);
const entry=(key,resource)=>`${key}:${resource}`;
const add=(map,key,n)=>map.set(key,(map.get(key)||0)+n);
const mealRoute=(source,target,k,targetKind)=>`${source}>${target}:${k}:${targetKind||''}`;
const looseMeal=(k,from)=>['food','milk'].includes(k)&&from&&from.grainFieldId===undefined&&from.grainEvidence===undefined;

function indexMealOrders(s,pass,protectedJobs){
 const routes=new Map(),duplicates=new Set();
 for(const q of s.district.jobs){
  if(!q.automatic||q.remaining<=eps||protectedJobs.has(q.id)||q.fishLot||q.shapingBatch||q.campSalvage||q.targetKind==='votive'||!looseMeal(q.resource,store(s,q.source,pass)))continue;
  const key=mealRoute(q.source,q.target,q.resource,q.targetKind),first=routes.get(key);
  if(!first){routes.set(key,q);continue;}
  // An untouched duplicate has no cargo owner or delivery history. The
  // original route's reservation totals stay the same when it absorbs it.
  if(pass.owners.has(q.id)||q.delivered||q.cancelled||q.amount!==q.remaining||first.amount+q.amount>1e9)continue;
  first.amount+=q.amount;
  first.remaining+=q.remaining;
  duplicates.add(q.id);
  pass.jobsById.delete(q.id);
  pass.active--;
 }
 if(duplicates.size){
  s.district.jobs=s.district.jobs.filter(q=>!duplicates.has(q.id));
  invalidateAssignments(s);
 }
 return routes;
}
/** A transient read-only index: no saved cache and no repeated resident scan per job. */
export function indexDistrictJobs(s){
 const jobsById=new Map((s.district?.jobs||[]).map(q=>[q.id,q])),owners=new Map(),carried=new Map(),incoming=new Map(),queued=new Map(),outgoing=new Map(),carriedTo=new Map(),routeOwners=new Map(),extra=new Map();let active=0;
 for(const c of s.citizens||[]){const id=c.districtJob,q=jobsById.get(id);if(id!=null){if(!owners.has(id))owners.set(id,[]);owners.get(id).push(c);if(q)add(carried,id,c.cargo?.[q.resource]||0);}if(c.pantryTrip)add(extra,entry(c.pantryTarget||c.home,'food'),c.pantryFood||0);if(c.craftSite)add(extra,entry(c.craftSite,c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool')),(c.craftAmount||0)+(c.craftWool||0)+(c.craftCloth||0));}
 for(const q of s.district?.jobs||[]){const load=carried.get(q.id)||0;if(q.targetKind!=='votive'){if(!q.fishLot)add(queued,entry(q.source,q.resource),q.remaining);add(outgoing,entry(q.source,q.resource),q.remaining+load);if(!q.fishLot||q.targetKind==='input'){add(incoming,entry(q.target,q.resource),q.remaining+load);add(carriedTo,entry(q.target,q.resource),load);}}add(routeOwners,`${q.source}>${q.target}`,owners.get(q.id)?.length||0);if(q.remaining+load>eps)active++;}
 return {jobsById,owners,carried,incoming,queued,outgoing,carriedTo,routeOwners,extra,active};
}
export function createDistrictPass(s,{network=null}={}){
 const food=foodAvailability(s),stores=stockStores(s),central=new Set(stores),endpoints=new Map(s.buildings.filter(b=>isOperational(b)&&(central.has(b)||isBuildingStore(b)||isVotiveTemple(b))).map(b=>[buildingKey(b),b])),net=network||networkFor(s),components=new Map();
 for(const p of net.ports)if(!p.building.siteKey)components.set(buildingKey(p.building),net.components.get(p.key));
 return {...indexDistrictJobs(s),food,stores,central,endpoints,components};
}
export const logisticsStock=(s,b,k)=>central(s,b)?storeStock(s,buildingKey(b),k):b.workshopStock?.output?.[k]||0;
export const logisticsRoom=(s,b,k,targetKind=null,pass=null)=>!b?0:targetKind==='input'?buildingInputRoom(s,b,k,k==='food'?pass?.mealHouseholds:pass?.households):central(s,b,pass)?Math.max(0,storeCapacity(b)-(pass?b.stock?.[k]||0:storeStock(s,buildingKey(b),k))):buildingInputRoom(s,b,k,k==='food'?pass?.mealHouseholds:pass?.households);
export function logisticsDeposit(s,key,k,n,targetKind=null){const b=store(s,key);return !b?0:central(s,b)&&targetKind!=='input'?0:putBuildingInput(s,b,k,n);}
export function initializeDistricts(s){s.district??={nextId:1,jobs:[],lastScan:-1};}
export const storeMinimum=(b,k)=>b.stockMinimum?.[k]??(b.type==='depot'&&k==='food'?12*(b.level||1):0);
export function connectedStores(s,a,b,pass=null){if(pass)return pass.components.has(a)&&pass.components.has(b)&&pass.components.get(a)===pass.components.get(b);const net=networkFor(s),ports=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p.key])),from=ports.get(a),to=ports.get(b);return !!from&&!!to&&net.components.get(from)===net.components.get(to);}
export function exportable(s,key,k,pass=null){const b=store(s,key,pass);if(!b||b.noExport)return 0;if(!central(s,b,pass))return b.workshopStock?.output?.[k]||0;return Math.max(0,Math.min((pass?b.stock?.[k]||0:storeStock(s,key,k))-storeMinimum(b,k),k==='food'?(pass?pass.food.get(key)||0:foodAvailableAt(s,key)):Infinity));}
export const CAMP_REEDS=4;
export const districtReceiptRoom=(s,q,b,pass)=>q.fishLot&&!q.targetKind?dryFishRoom(s,b):logisticsRoom(s,b,q.resource,q.targetKind,pass);
export const districtExportable=(s,q,pass)=>q.fishLot?dryFishLotStock(store(s,q.source,pass),q.fishLot):q.campSalvage?
 store(s,q.source,pass)?.campSalvage?.reed||0:q.shapingBatch?
 findShapingBatch(s,q.shapingBatch)?.remaining[q.resource]||0:exportable(s,q.source,q.resource,pass);
export const transferCarried=(s,q,pass=null)=>pass?pass.carried.get(q.id)||0:s.citizens.filter(c=>c.districtJob===q.id).reduce((n,c)=>n+(c.cargo?.[q.resource]||0),0);
const pending=(s,target,k,pass=null)=>pass?pass.incoming.get(entry(target,k))||0:s.district.jobs.filter(q=>q.target===target&&q.resource===k).reduce((n,q)=>n+q.remaining+transferCarried(s,q),0);
function stockOwnDinner(s,home,key,family,pass){
 const free=Math.min(pass.food.get(key)||0,home.stock.food-storeMinimum(home,'food'))-(pass.queued.get(entry(key,'food'))||0);
 if(free<=eps)return;
 const day=mealCycle(s.simTime);
 let needed=0;
 for(const c of family){
  const eaten=c.mealDay===day?c.mealEaten:0;
  needed+=Math.max(0,mealRation(c)-eaten);
 }
 const amount=Math.min(free,needed-homeMealFood(home));
 if(amount<=eps)return;
 // Both bins are in the same courtyard. This is local use, with no courier
 // or story credit for moving a family's meal off the public stockpile.
 const labels={},before=home.pantry||0;
 const moved=takeStock(s,key,'food',amount,{grainTo:labels,giftTo:labels});
 putBuildingInput(s,home,'food',moved);
 appendGrain(home,'grainPantry',labels.grainCargo||[],before);
 addGiftFood(home,'giftHome',labels.giftCargo||[],before);
 add(pass.food,key,-moved);
 return moved>0&&home.stock.food<=eps;
}
function stockOwnDinners(s,pass){
 const yards=pass.stores.filter(b=>isResidence(b)&&b.stock?.food>eps&&!b.campSalvage);
 if(!yards.length)return;
 const families=new Map(yards.map(b=>[buildingKey(b),[]]));
 for(const c of s.citizens)families.get(supplyHome(c,{arrived:true}))?.push(c);
 let exhausted=false;
 for(const b of yards){
  const key=buildingKey(b),family=families.get(key);
  if(family.length&&stockOwnDinner(s,b,key,family,pass))exhausted=true;
 }
 if(exhausted){
  pass.stores=stockStores(s);
  pass.central=new Set(pass.stores);
 }
}
const blocked=s=>s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':s.funeral&&s.funeral.scope!=='family'?'Жители провожают умерших':'';
export function setStoreMinimum(s,key,k,n){const reason=relicCommandReason(s)||blocked(s),b=store(s,key);if(reason)return {ok:false,reason};if(!b||!central(s,b)||!MATERIALS.includes(k)||!Number.isFinite(n)||n<0||n>storeCapacity(b))return {ok:false,reason:'Минимум должен быть от нуля до вместимости склада'};syncInventory(s);b.stockMinimum??={};b.stockMinimum[k]=n;initializeDistricts(s);s.district.lastScan=-1;invalidateAssignments(s);return {ok:true};}
export function setStoreExports(s,key,allowed){const reason=relicCommandReason(s)||blocked(s),b=store(s,key);if(reason)return {ok:false,reason};if(!b||!central(s,b)||typeof allowed!=='boolean')return {ok:false,reason:'Выбери готовый склад'};b.noExport=!allowed;initializeDistricts(s);s.district.lastScan=-1;invalidateAssignments(s);return {ok:true};}
export function requestTransfer(s,source,target,k,n,{automatic=false,targetKind=null}={},pass=null){
 const reason=(!automatic&&relicCommandReason(s))||blocked(s);if(reason)return {ok:false,reason};const from=store(s,source,pass),to=store(s,target,pass);if(targetKind!==null&&(targetKind!=='input'||!isBuildingStore(to)))return {ok:false,reason:'Недопустимый местный склад'};if(!from||!to||from===to||!MATERIALS.includes(k)||!Number.isFinite(n)||n<=eps||n>1e6||!automatic&&!Number.isSafeInteger(n))return {ok:false,reason:'Выбери два разных склада, груз и целое количество'};
 if(!pass){initializeBuildingInventory(s);initializeDistricts(s);pass=createDistrictPass(s);}
 const route=automatic&&pass.mealOrders&&looseMeal(k,from)?mealRoute(source,target,k,targetKind):null;
 const existing=route&&pass.mealOrders.get(route);
 const growing=existing&&existing.amount+n<=1e9;
 if(!growing&&pass.active>=128)return {ok:false,reason:'Слишком много перевозок'};
 if(!connectedStores(s,source,target,pass))return {ok:false,reason:'Нет дороги между складами: нужен готовый мост'};
 if(exportable(s,source,k,pass)-(pass.queued.get(entry(source,k))||0)+eps<n)return {ok:false,reason:'Нет свободного груза: проверь местный запас, минимум и разрешение отправки'};
 if(logisticsRoom(s,to,k,targetKind,pass)-pending(s,target,k,pass)+eps<n)return {ok:false,reason:'На принимающем складе не хватает места'};
 let q=existing;
 if(growing){
  q.amount+=n;
  q.remaining+=n;
 }else{
  q={id:s.district.nextId++,source,target,resource:k,amount:n,remaining:n,delivered:0,cancelled:0,automatic,...targetKind?{targetKind}:{}};
  s.district.jobs.push(q);pass.jobsById.set(q.id,q);pass.active++;
  if(route)pass.mealOrders.set(route,q);
 }
 add(pass.incoming,entry(target,k),n);add(pass.queued,entry(source,k),n);invalidateAssignments(s);return {ok:true,id:q.id};
}
export function cancelTransfer(s,id){const reason=relicCommandReason(s)||blocked(s);if(reason)return {ok:false,reason};const q=s.district?.jobs.find(q=>q.id===Number(id));if(!q||q.remaining<=eps)return {ok:false,reason:'Неотправленного груза нет; груз в руках сначала доставят'};if(q.targetKind==='votive')refundSources(s,{[q.source]:{pottery:q.remaining}});q.cancelled+=q.remaining;q.remaining=0;invalidateAssignments(s);return {ok:true};}
// Racks and granary reserves own distinct lots. They use ordinary carrier
// routes and cargo, but never reserve the same units as loose market food.
function scheduleDryFish(s,pass,destinations,nearest){
 const sources=destinations.filter(b=>b.dryFishLots?.length);
 for(const granary of pass.stores)if(granary.type==='granary'&&granary.dryFishLots?.length)sources.push(granary);
 if(!sources.length)return;
 const inGranary=new Map(),reserved=new Map();
 const claimKey=(source,lot)=>source+'#'+lot.id;
 for(const q of s.district.jobs)if(q.fishLot){
  add(reserved,claimKey(q.source,q.fishLot),q.remaining);
  if(!q.targetKind)add(inGranary,q.target,q.remaining+transferCarried(s,q,pass));
 }
 const homes=destinations.filter(isResidence);
 for(const source of sources){
  const from=buildingKey(source),housebound=source.type==='granary';
  if(!housebound&&source.noExport||housebound&&!source.fishReserveOpen&&pass.stores.some(store=>
   (pass.food.get(buildingKey(store))||0)>eps&&connectedStores(s,from,buildingKey(store),pass)))continue;
  const targets=housebound?homes.filter(b=>connectedStores(s,from,buildingKey(b),pass)).sort((a,b)=>
   Math.hypot(a.x-source.x,a.y-source.y)-Math.hypot(b.x-source.x,b.y-source.y)):nearest(source).filter(b=>b.type==='granary');
  for(const lot of source.dryFishLots){
   let available=lot.amount-(reserved.get(claimKey(from,lot))||0);
   for(const target of targets){
    if(available<.01||pass.active>=128)break;
    const to=buildingKey(target),destKey=entry(to,'food');
    const room=housebound?buildingInputRoom(s,target,'food',pass.mealHouseholds)-(pass.incoming.get(destKey)||0)-(pass.extra.get(destKey)||0):
     dryFishRoom(s,target)-(inGranary.get(to)||0);
    const n=Math.min(available,room);
    if(n<.01)continue;
    const job={id:s.district.nextId++,source:from,target:to,resource:'food',amount:n,remaining:n,delivered:0,cancelled:0,
     automatic:true,fishLot:{yard:lot.yard,id:lot.id},...housebound?{targetKind:'input'}:{}};
    s.district.jobs.push(job);pass.jobsById.set(job.id,job);pass.active++;available-=n;
    if(housebound)add(pass.incoming,destKey,n);else add(inGranary,to,n);
    invalidateAssignments(s);
   }
  }
 }
}
export function syncDistrictJobs(s){
 initializeDistricts(s);if(blocked(s))return;const scan=Math.floor(s.simTime||0);if(s.district.lastScan===scan)return;s.district.lastScan=scan;collectReadyOutputs(s);const pass=createDistrictPass(s);
 // This synchronous scan creates orders, but no resident moves home during it.
 pass.households=residentsByHome(s.citizens);
 pass.mealHouseholds=s.citizens.some(c=>c.floodShelter||c.fireShelter)?residentsByHome(s.citizens,supplyHome):pass.households;
 // Keep user orders and every owned ID. Only obsolete automatic history is compacted.
 const civicJobs=new Set([s.civicOrder?.case?.aid,...(s.civicOrder?.history||[]).flatMap(q=>[q.aid,q.restitution?.job])]);
 const completed=s.district.jobs.filter(q=>!civicJobs.has(q.id)&&q.automatic&&!pass.owners.has(q.id)&&q.remaining+transferCarried(s,q,pass)<=eps),recent=new Set(completed.slice(-16).map(q=>q.id));
 if(completed.length>16)s.district.jobs=s.district.jobs.filter(q=>civicJobs.has(q.id)||!q.automatic||pass.owners.has(q.id)||q.remaining+transferCarried(s,q,pass)>eps||recent.has(q.id));
 // A maker or family shopper can fill a buffer before the porter arrives.
 for(const q of s.district.jobs){const b=store(s,q.target,pass);if(!b||q.targetKind==='votive'||central(s,b,pass)&&q.targetKind!=='input'||q.remaining<=eps)continue;const key=entry(q.target,q.resource),load=transferCarried(s,q,pass),other=(pass.incoming.get(key)||0)-q.remaining-load,allowed=Math.max(0,logisticsRoom(s,b,q.resource,q.targetKind,pass)-load-other),cancelled=Math.max(0,q.remaining-allowed);if(cancelled>eps){q.remaining-=cancelled;q.cancelled+=cancelled;add(pass.incoming,key,-cancelled);if(!q.fishLot)add(pass.queued,entry(q.source,q.resource),-cancelled);if(q.remaining+load<=eps)pass.active--;invalidateAssignments(s);}}
 if(s.calendarDaysPerMonth===1)pass.mealOrders=indexMealOrders(s,pass,civicJobs);
 for(const batch of s.shapingBatches?.rows||[]){
  const source=`${batch.x},${batch.y}`;
  for(const [resource,amount] of Object.entries(batch.remaining)){
   if(amount<=eps||pass.active>=128||s.district.jobs.some(q=>q.shapingBatch===batch.id&&q.resource===resource&&(q.remaining>eps||transferCarried(s,q,pass)>eps)))continue;
   const target=pass.stores.find(b=>buildingKey(b)!==source&&connectedStores(s,source,buildingKey(b),pass)&&
    logisticsRoom(s,b,resource,null,pass)-pending(s,buildingKey(b),resource,pass)>eps);
   if(!target)continue;
   const key=buildingKey(target),n=Math.min(amount,logisticsRoom(s,target,resource,null,pass)-pending(s,key,resource,pass));
   const q={id:s.district.nextId++,source,target:key,resource,amount:n,remaining:n,delivered:0,cancelled:0,automatic:true,shapingBatch:batch.id};
   s.district.jobs.push(q);pass.jobsById.set(q.id,q);pass.active++;
   add(pass.incoming,entry(key,resource),n);invalidateAssignments(s);
  }
 }
 const occupied=new Set(s.citizens.flatMap(c=>[c.home,c.floodShelter,c.fireShelter?.host,c.waterTrip?.target,c.waterTrip?.origin,c.pantryTarget,c.memorialMove?.source,c.memorialMove?.target]));
 for(const b of s.buildings){
  if(!b.reedCamp||!b.campVacating)continue;
  const source=buildingKey(b);
  if(occupied.has(source)||s.arrivalGroup?.home===source||
   s.citizens.some(c=>Math.abs(c.x-b.x)<.75&&Math.abs(c.y-b.y)<.75))continue;
  b.campSalvage??={reed:CAMP_REEDS};
  const amount=b.campSalvage.reed;
  if(amount<=eps||pass.active>=128||s.district.jobs.some(q=>q.campSalvage&&q.source===source&&(q.remaining>eps||transferCarried(s,q,pass)>eps)))continue;
  const target=pass.stores.find(t=>t!==b&&!t.reedCamp&&connectedStores(s,source,buildingKey(t),pass)&&
   logisticsRoom(s,t,'reed',null,pass)-pending(s,buildingKey(t),'reed',pass)>=amount-eps);
  if(!target)continue;
  const key=buildingKey(target);
  const job={id:s.district.nextId++,source,target:key,resource:'reed',amount,remaining:amount,delivered:0,cancelled:0,automatic:true,campSalvage:true};
  s.district.jobs.push(job);pass.jobsById.set(job.id,job);pass.active++;
  add(pass.incoming,entry(key,'reed'),amount);invalidateAssignments(s);
 }
 // Warehouse food can be eaten or reserved for seed after a household order
 // is issued. An uncollectable promise must not block a replacement delivery.
 if(s.calendarDaysPerMonth===1){
  for(let i=s.district.jobs.length-1;i>=0;i--){
   const q=s.district.jobs[i];
   if(!q.automatic||q.targetKind!=='input'||q.resource!=='food'||q.fishLot||q.shapingBatch||civicJobs.has(q.id)||q.remaining<=eps||
    !isResidence(store(s,q.target,pass))||!central(s,store(s,q.source,pass),pass))continue;
   const promised=pass.queued.get(entry(q.source,'food'))||0;
   const uncollected=Math.min(q.remaining,promised-districtExportable(s,q,pass));
   if(uncollected<=eps)continue;
   q.cancelled+=uncollected;q.remaining-=uncollected;
   add(pass.queued,entry(q.source,'food'),-uncollected);
   add(pass.incoming,entry(q.target,'food'),-uncollected);
   if(q.remaining<=eps&&!transferCarried(s,q,pass))pass.active--;
   invalidateAssignments(s);
  }
 }
 if(s.calendarDaysPerMonth===1&&isDinnerTime(s.simTime))stockOwnDinners(s,pass);
 const stores=pass.stores,destinations=[...pass.endpoints.values()].filter(b=>isBuildingStore(b)&&!b.campSalvage),donors=new Map();
 const nearest=(b,metric='round')=>{const target=buildingKey(b),id=target+metric;if(!donors.has(id))donors.set(id,stores.filter(a=>a!==b&&connectedStores(s,buildingKey(a),target,pass)).sort((a,c)=>metric==='round'?Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y):Math.abs(a.x-b.x)+Math.abs(a.y-b.y)-Math.abs(c.x-b.x)-Math.abs(c.y-b.y)));return donors.get(id);};
 const homes=destinations.filter(isResidence);
 const dinnerNeeds=new Map();
 if(s.calendarDaysPerMonth===1)for(const b of homes){
  const key=buildingKey(b),family=pass.mealHouseholds.get(key)||[];
  dinnerNeeds.set(key,family.reduce((n,c)=>n+mealRation(c),0)-homeMealFood(b));
 }
 const unreservedDinner=key=>Math.max(0,dinnerNeeds.get(key)-pending(s,key,'food',pass)-(pass.extra.get(entry(key,'food'))||0));
 const inbound=(b,k,need)=>{
  const target=buildingKey(b);
  let wanted=need-pending(s,target,k,pass)-(pass.extra.get(entry(target,k))||0);
  if(wanted<=eps)return;
  const householdFood=k==='food'&&dinnerNeeds.has(target);
  const dinner=householdFood?unreservedDinner(target):0;
  const donors=nearest(b);
  if(householdFood&&wanted>dinner+eps){
   // A reserve order may use only the stock left after unreserved first dinners on this bank.
   const free=donors.reduce((sum,a)=>{const key=buildingKey(a);return sum+Math.max(0,exportable(s,key,k,pass)-(pass.queued.get(entry(key,k))||0));},0);
   if(free<wanted+.8*s.population){
    let otherDinners=0;
    for(const key of dinnerNeeds.keys())if(key!==target&&connectedStores(s,key,target,pass))otherDinners+=unreservedDinner(key);
    wanted=Math.min(wanted,Math.max(dinner,free-otherDinners));
   }
  }
  const minimum=dinner>eps?eps:isResidence(b)&&k==='food'?Math.min(1,homeStockCapacity(s,b,'food',pass.mealHouseholds)/2):.01;
  if(wanted<minimum)return;
  for(const a of donors){
   const source=buildingKey(a),free=exportable(s,source,k,pass)-(pass.queued.get(entry(source,k))||0);
   const amount=Math.min(wanted,free);
   if(amount<=eps||dinner<=eps&&amount<.01)continue;
   if(requestTransfer(s,source,target,k,amount,{automatic:true,targetKind:'input'},pass).ok){
    wanted-=amount;
    if(dinner<=eps||wanted<=eps)break;
   }
  }
 };
 if(s.lastFishLotId)scheduleDryFish(s,pass,destinations,nearest);
 const markedFields=s.earthDiscovery?.qualifiedAt!=null&&!harvestNameEvidence(s)?
  destinations.filter(b=>b.type==='field'&&b.grainEvidence?.inspired):[];
 const harvestRecipients=new Map(),credited=s.causalFacts?.harvest||[];
 if(markedFields.length)for(const c of s.citizens){
  const home=supplyHome(c,{arrived:true});
  if(home&&!harvestRecipients.has(home))harvestRecipients.set(home,c.id);
 }
 const emergency=s.calendarDaysPerMonth===1&&s.resources.food<.8*s.population;
 const freshFood=emergency?destinations.filter(b=>isProductionStore(b)&&!b.recoveryOnly&&exportable(s,buildingKey(b),'food',pass)>eps):[];
 const reroutable=new Map();
 if(freshFood.length)for(const q of s.district.jobs){
  if(!q.automatic||q.remaining<=eps||q.resource!=='food'||q.targetKind||q.fishLot||q.campSalvage||q.shapingBatch||civicJobs.has(q.id))continue;
  if(!reroutable.has(q.source))reroutable.set(q.source,[]);
  reroutable.get(q.source).push(q);
 }
 if(emergency){
  const coverage=b=>{
   const key=buildingKey(b),dinner=(pass.mealHouseholds.get(key)||[]).reduce((n,c)=>n+mealRation(c),0);
   return dinner?(homeMealFood(b)+pending(s,key,'food',pass))/dinner:Infinity;
  };
  const priorities=new Map(homes.map(b=>[b,coverage(b)]));
  homes.sort((a,b)=>priorities.get(a)-priorities.get(b));
 }
 for(const b of homes){
  const target=buildingKey(b);
  const dinner=(pass.mealHouseholds.get(target)||[]).reduce((sum,c)=>sum+ration(c)*4/3,0);
  const need=s.calendarDaysPerMonth===1?Math.max(0,pantryRestockTarget(s,dinner)-homeMealFood(b)):buildingInputRoom(s,b,'food',pass.mealHouseholds);
  const incoming=pending(s,target,'food',pass),wanted=need-incoming-(pass.extra.get(entry(target,'food'))||0);
  const recipient=harvestRecipients.get(target);
  if(wanted>=1&&incoming<=eps&&recipient!==undefined&&!credited.some(f=>f.home===target||f.recipientId===recipient)){
   for(const field of markedFields){
    const source=buildingKey(field),mark=field.grainEvidence,queued=pass.queued.get(entry(source,'food'))||0;
    const amount=Math.min(12,wanted,mark.prefix+mark.amount,exportable(s,source,'food',pass)-queued);
    if(queued>eps||amount<=mark.prefix+eps)continue;
    if(requestTransfer(s,source,target,'food',amount,{automatic:true,targetKind:'input'},pass).ok)break;
   }
  }
  inbound(b,'food',need);
  if(!freshFood.length)continue;
  let short=Math.min(2*dinner-homeMealFood(b),buildingInputRoom(s,b,'food',pass.mealHouseholds))-pending(s,target,'food',pass);
  if(short<=eps)continue;
  const producers=freshFood.filter(a=>connectedStores(s,buildingKey(a),target,pass))
   .sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
  for(const a of producers){
   if(short<=eps||pass.active>=128)break;
   const source=buildingKey(a),key=entry(source,'food');
   let free=Math.max(0,exportable(s,source,'food',pass)-(pass.queued.get(key)||0));
   for(const q of reroutable.get(source)||[]){
    const n=Math.min(q.remaining,short-free);
    if(short-free<=eps)break;
    if(n<=eps)continue;
    q.remaining-=n;q.cancelled+=n;free+=n;
    add(pass.queued,key,-n);add(pass.incoming,entry(q.target,'food'),-n);
    if(q.remaining<=eps&&!transferCarried(s,q,pass))pass.active--;
   }
   const n=Math.min(short,free);
   if(n>eps&&requestTransfer(s,source,target,'food',n,{automatic:true,targetKind:'input'},pass).ok)short-=n;
  }
 }
 // An emergency yard first returns recovered stock. Its ordinary finished
 // goods remain safely in their separate output buffer until that stock clears.
 for(const b of [...destinations.filter(b=>isProductionStore(b)&&!b.recoveryOnly),...stores.filter(b=>b.recoveryOnly)])for(const [k,amount]of Object.entries(b.recoveryOnly?b.stock:b.workshopStock?.output||{})){const source=buildingKey(b),queued=pass.queued.get(entry(source,k))||0;if(amount-queued<.01)continue;const target=nearest(b).find(a=>logisticsRoom(s,a,k,null,pass)-pending(s,buildingKey(a),k,pass)>.01);if(target){const key=buildingKey(target),n=Math.min(amount-queued,logisticsRoom(s,target,k,null,pass)-pending(s,key,k,pass));if(n>=.01)requestTransfer(s,source,key,k,n,{automatic:true},pass);}}
 for(const b of destinations)if(!isResidence(b)&&(!toolResource(b)||isStrictSumer(s)))for(const [k,need]of Object.entries(inputNeeds(b)))if(k!=='water')inbound(b,k,need);
 for(const b of destinations)if(isResidence(b))for(const k of ['clothing','pottery','beer','milk','mat'])inbound(b,k,buildingInputRoom(s,b,k,pass.households));
 for(const b of stores)for(const k of MATERIALS){const target=buildingKey(b),need=storeMinimum(b,k)-(b.stock?.[k]||0)-pending(s,target,k,pass);if(need<=eps||need<Math.min(1,storeMinimum(b,k))-eps)continue;for(const a of nearest(b,'taxicab')){const source=buildingKey(a),n=Math.min(need,Math.max(0,exportable(s,source,k,pass)-(pass.queued.get(entry(source,k))||0)));if(n>eps&&requestTransfer(s,source,target,k,n,{automatic:true},pass).ok)break;}}
}
export function districtPickup(s,c){
 const pass=createDistrictPass(s),q=pass.jobsById.get(c.districtJob);if(!q||q.remaining<=eps||!connectedStores(s,q.source,q.target,pass))return 0;const target=store(s,q.target,pass);if(!target)return 0;if(q.targetKind==='votive'){
 if(!isVotiveTemple(target)||q.remaining!==1)return 0;
 q.remaining=0;c.cargo={pottery:1};c.store=q.target;invalidateAssignments(s);return 1;
}
 const source=store(s,q.source,pass),fromStock=central(s,source,pass);
 if(q.fishLot){
  const key=entry(q.target,'food');
  const reserved=q.targetKind==='input'?(pass.carriedTo.get(key)||0)+(pass.extra.get(key)||0):0;
  const room=districtReceiptRoom(s,q,target,pass)-reserved;
  const actual=collectDryFishLot(source,q.fishLot,Math.max(0,Math.min(q.remaining,room)));
  if(actual<=eps)return 0;
  if(!q.targetKind)pickupDryFishingEvidence(s,c,q.fishLot.id,actual,dryFishLotStock(source,q.fishLot)+actual);
  q.remaining=Math.max(0,q.remaining-actual);c.cargo={food:actual};c.store=q.target;
  markWindCargo(s,c,actual);invalidateAssignments(s);return actual;
 }
 const eligible=!c.freightCart&&isStrictSumer(s)&&c.role==='carrier'&&['food','clay','reed'].includes(q.resource);
 const surplus=k=>exportable(s,q.source,k,pass)-(pass.queued.get(entry(q.source,k))||0);
 const issue=eligible&&fromStock&&c.basketCondition===undefined&&surplus('basket')>=1;
 const repair=eligible&&fromStock&&c.basketCondition===0&&surplus('reed')>=2;
 const basket=eligible&&(c.basketCondition>0||issue||repair);
 const mealFreight=s.calendarDaysPerMonth===1&&q.resource==='food'&&!q.shapingBatch;
 const handLimit=mealFreight?18.75:12;
 const basketLimit=mealFreight?25:16;
 const cartLimit=mealFreight?37.5:24;
 const loadLimit=c.freightCart?cartLimit:basket?basketLimit:handLimit;
 // At pickup the porter can top up a small household order with spare food.
 if(s.calendarDaysPerMonth===1&&s.resources.food>=1.6*s.population&&q.automatic&&q.resource==='food'&&q.targetKind==='input'&&isResidence(target)&&!q.shapingBatch){
  const dinner=s.citizens.reduce((sum,person)=>supplyHome(person)===q.target?sum+mealRation(person):sum,0);
  const room=Math.min(logisticsRoom(s,target,'food','input',pass),pantryRestockTarget(s,dinner)-homeMealFood(target));
  const key=entry(q.target,'food');
  const wanted=Math.min(loadLimit-q.remaining,room-(pass.incoming.get(key)||0)-(pass.extra.get(key)||0),1e9-q.amount);
  let free=surplus('food');
  if(wanted>eps&&wanted>free&&looseMeal('food',source)){
   for(const shipment of s.district.jobs){
    if(!shipment.automatic||shipment.source!==q.source||shipment.resource!=='food'||shipment.targetKind||shipment.shapingBatch||shipment.fishLot||shipment.campSalvage||pass.owners.has(shipment.id)||shipment.remaining<=eps)continue;
    if(s.civicOrder?.case?.aid===shipment.id||s.civicOrder?.history?.some(h=>h.aid===shipment.id||h.restitution?.job===shipment.id))continue;
    const released=Math.min(shipment.remaining,wanted-free);
    shipment.remaining-=released;shipment.cancelled+=released;free+=released;
    if(free>=wanted-eps)break;
   }
  }
  const extra=Math.min(wanted,free);
  if(extra>eps){q.amount+=extra;q.remaining+=extra;}
 }
 const key=entry(q.target,q.resource),n=Math.min(loadLimit,q.remaining,districtExportable(s,q,pass),Math.max(0,logisticsRoom(s,target,q.resource,q.targetKind,pass)-(pass.carriedTo.get(key)||0)-(pass.extra.get(key)||0)));if(n<=eps)return 0;const beforeOutput=source?.workshopStock?.output?.food||0,actual=q.campSalvage?n:q.shapingBatch?loadShapingBatch(s,c,q.shapingBatch,q.resource,n):fromStock?takeStock(s,q.source,q.resource,n,{fishTo:c,giftTo:c,creatorTo:c,grainTo:c}):takeBuildingOutput(source,q.resource,n);if(basket&&actual>handLimit+eps){
  if(issue)takeStock(s,q.source,'basket',1);
  if(repair)takeStock(s,q.source,'reed',2);
  c.basketCondition=(issue||repair?6:c.basketCondition)-1;
 }if(q.campSalvage)source.campSalvage.reed-=actual;
 q.remaining-=actual;if(q.remaining<eps)q.remaining=0;c.cargo={[q.resource]:actual};if(!fromStock&&!q.shapingBatch)markWindCargo(s,c,actual);if(!q.shapingBatch&&!fromStock&&source?.type===q.resource)markCreatorCargo(s,c,q.resource,actual);if(q.resource==='food'&&!fromStock){appendGrain(c,'grainCargo',takeGrain(source,'grainOutput',actual,beforeOutput),0);pickupFishingOutput(s,source,c,actual,beforeOutput);pickupFieldGrain(source,c,actual,beforeOutput);if(source?.fishOutput)appendFish(c,'fishCargo',takeFish(source,'fishOutput',actual,beforeOutput),0);}c.store=q.target;invalidateAssignments(s);return actual;
}
export function districtReport(s){
 initializeDistricts(s);const pass=createDistrictPass(s),jobs=s.district.jobs.map(q=>{const inTransit=transferCarried(s,q,pass),carriers=pass.owners.get(q.id)||[],done=q.remaining+inTransit<=eps;return {...q,inTransit,status:done?(q.delivered>eps?'done':'cancelled'):!connectedStores(s,q.source,q.target,pass)||carriers.some(c=>c.phase==='blocked')?'blocked':inTransit>eps?'carrying':carriers.length?'active':q.targetKind!=='votive'&&districtExportable(s,q,pass)<=eps?'blocked':'waiting'};});
 return {jobs,carriers:[...pass.owners.values()].reduce((n,owners)=>n+owners.length,0),stores:pass.stores.map(b=>{const key=buildingKey(b),incoming=Object.fromEntries(MATERIALS.map(k=>[k,pass.incoming.get(entry(key,k))||0])),outgoing=Object.fromEntries(MATERIALS.map(k=>[k,pass.outgoing.get(entry(key,k))||0]));return {key,type:b.type,name:isResidence(b)?'Запасы на земле':BUILDINGS[b.type]?.name||'Склад',x:b.x,y:b.y,capacity:storeCapacity(b),stock:{...b.stock},minimum:Object.fromEntries(MATERIALS.map(k=>[k,storeMinimum(b,k)])),noExport:!!b.noExport,incoming,outgoing,reason:storeMinimum(b,'food')-b.stock.food>=Math.min(1,storeMinimum(b,'food'))&&storeMinimum(b,'food')>0?'Запас ниже минимума: нужен доступный склад-донор и носильщик':''};})};
}
export function validateDistricts(s){
 const d=s.district,finite=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e9;
 if(!d||!Number.isSafeInteger(d.nextId)||d.nextId<1||d.lastScan!==undefined&&(!Number.isInteger(d.lastScan)||d.lastScan< -1||d.lastScan>Math.floor(s.simTime))||!Array.isArray(d.jobs)||d.jobs.length>256&&d.jobs.filter(q=>q.automatic).length>Math.max(256,s.citizens.length+144))return false;const ids=new Set(),index=indexDistrictJobs(s),warehouses=new Set(stockStores(s)),pass={...index,endpoints:new Map(s.buildings.filter(b=>isOperational(b)&&(warehouses.has(b)||isBuildingStore(b)||isVotiveTemple(b))).map(b=>[buildingKey(b),b]))};
 for(const b of s.buildings){if(b.noExport!==undefined&&typeof b.noExport!=='boolean'||b.stockMinimum!==undefined&&(!b.stock||!b.stockMinimum||Array.isArray(b.stockMinimum)||Object.entries(b.stockMinimum).some(([k,n])=>!MATERIALS.includes(k)||!finite(n)||n>storeCapacity(b))))return false;}
 for(const q of d.jobs){if(!Number.isSafeInteger(q.id)||q.id<1||q.id>=d.nextId||ids.has(q.id)||typeof q.source!=='string'||typeof q.target!=='string'||q.source===q.target||!MATERIALS.includes(q.resource)||typeof q.automatic!=='boolean'||q.targetKind!==undefined&&(!['input','votive'].includes(q.targetKind)||q.remaining+transferCarried(s,q,pass)>eps&&!(q.targetKind==='votive'?isVotiveTemple(store(s,q.target,pass)):isBuildingStore(store(s,q.target,pass))))||!['amount','remaining','delivered','cancelled'].every(k=>finite(q[k]))||q.amount<=0||Math.abs(q.amount-q.remaining-q.delivered-q.cancelled-transferCarried(s,q,pass))>1e-6)return false;ids.add(q.id);
  if(q.fishLot!==undefined){
   const lot=q.fishLot,source=store(s,q.source,pass),target=store(s,q.target,pass);
   if(!lot||typeof lot.yard!=='string'||!/^\d+,\d+$/.test(lot.yard)||!Number.isSafeInteger(lot.id)||lot.id<1||lot.id>(s.lastFishLotId||0)||
    !q.automatic||q.resource!=='food'||q.amount>2+eps||q.campSalvage||q.shapingBatch||q.targetKind==='votive'||
    q.remaining+transferCarried(s,q,pass)>eps&&(q.targetKind==='input'?
      source?.type!=='granary'||!isResidence(target):source?.type!=='fishing'||lot.yard!==q.source||target?.type!=='granary')||
    q.remaining>dryFishLotStock(source,lot)+eps)return false;
  }
  if(q.campSalvage!==undefined&&(q.campSalvage!==true||!q.automatic||q.resource!=='reed'||q.shapingBatch||q.targetKind||
   q.remaining+transferCarried(s,q,pass)>eps&&(!store(s,q.source,pass)?.campSalvage||q.remaining>store(s,q.source,pass).campSalvage.reed+eps)))return false;
  if(q.shapingBatch!==undefined){
   const batch=findShapingBatch(s,q.shapingBatch);
   if(!batch||q.source!==`${batch.x},${batch.y}`||!Object.hasOwn(batch.remaining,q.resource)||!q.automatic||q.targetKind||
    q.remaining>batch.remaining[q.resource]+eps)return false;
  }
  if(q.remaining+transferCarried(s,q,pass)>eps&&(!q.shapingBatch&&!store(s,q.source,pass)||!store(s,q.target,pass)))return false;}
 for(const c of s.citizens){if(c.districtJob==null){if(c.shapingLoad||['toCollectCart','toDistrictSupply','toDistrictStore'].includes(c.phase))return false;continue;}const q=index.jobsById.get(c.districtJob);if(!q||c.shapingLoad&&(c.shapingLoad.batchId!==q.shapingBatch||c.shapingLoad.resource!==q.resource)||q.shapingBatch&&(c.cargo?.[q.resource]||0)>eps&&!c.shapingLoad||['toDistrictStore','unloading'].includes(c.phase)&&c.store!==q.target||c.phase==='toDistrictSupply'&&c.store!==q.source||c.pantryTrip||c.seedField||c.saleJob||c.tradeJob||c.clinic||c.school||c.site||c.work||Object.values(c.buildCargo||{}).some(n=>n>0)||!['home','toHome','toCollectCart','toDistrictSupply','toDistrictStore','unloading','blocked'].includes(c.phase)||Object.entries(c.cargo||{}).some(([k,n])=>n>0&&k!==q.resource)||c.age<16)return false;}
 return true;
}
