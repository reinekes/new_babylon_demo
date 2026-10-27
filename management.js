import {godhoodInspirationReason,firstBuilderInspiration,acceptGodhoodInspiration} from './godhood.js';
import {relicControlActive,relicCommandReason} from './relic-quest.js';
import {recoverFestivalCitizen} from './festival.js';
import {recordProfessionEpithet,recordInspirationOutcome} from './citizen-epithets.js';
import {isArtisan,artisanOutput} from './artisan.js';
import {isTradePort} from './river-trade.js';
import {upgradeCost} from './masonry.js';
import {craftLoad,craftResource,craftState} from './textiles.js';
import {putStock,stockStores,storeCapacity,refundSources,syncInventory} from './inventory.js';
import {ROLES,inspirationChance,newMedicalSkill} from './education.js';
import {PROFESSION_IDS,professionRole,canStaffBuilding} from './professions.js';
import {affectResidents} from './wellbeing.js';
import {canWork} from './demography.js';
import {registerInspiration} from './divinity.js';
import {BUILDINGS,buildingKey,capacityOf,housingOf,storageOf,levelOf,MATERIALS} from './definitions.js';
import {isComplete,constructionEntities} from './construction.js';
import {syncCitizens,invalidateAssignments,rerouteCitizens,networkFor,recoverCitizenCargo} from './workforce.js';
import {bridgeSpan,onBridge,WIDTH,HEIGHT} from './world.js';
const roles=ROLES;
const hasLoad=c=>!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||c.pantryFood>0||Object.values(c.cargo||{}).some(v=>v>0)||Object.values(c.buildCargo||{}).some(v=>v>0);
const find=(s,x,y)=>constructionEntities(s).find(b=>b.x===x&&b.y===y);
const blocked=s=>relicControlActive(s)?relicCommandReason(s):s.funeral?'Жители прощаются с умершими':s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':'';
const upgradePrice=(b,level)=>({...level===2?(b.type==='house'?{wood:4,hides:2}:b.type!=='bridge'?{stone:8}:{}):{},clay:Math.ceil(BUILDINGS[b.type].clay*(level===1?1.5:2.5)),reed:Math.max(4,Math.ceil(BUILDINGS[b.type].reed*(level===1?1.5:2.5)))});
function note(s,title,text){s.news.unshift({title,text,kind:'build',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}
export function cancellationRefund(b){const q=b?.construction;return q?{...q.required,faith:q.kind==='new'?(BUILDINGS[b.type]?.faith||0):0}:{clay:0,reed:0,faith:0};}
export function demolitionRefund(b){
 if(!b||!isComplete(b))return {clay:0,reed:0};
 const total=Object.fromEntries(MATERIALS.map(k=>[k,BUILDINGS[b.type][k]||0]));
 if(b.legacyFiringLevel)total.firedBrick=0;
 for(let level=1;level<levelOf(b);level++){
  if(level<(b.legacyMasonryLevel||1)){
   if(level>=(b.legacyFiringLevel||1)&&((level===2&&['house','granary','depot','shrine','market','ziggurat'].includes(b.type))||b.type==='ziggurat'))total.firedBrick+=b.type==='ziggurat'?16:b.type==='house'?8:4;
   const cost=upgradePrice(b,level);for(const k of MATERIALS)total[k]+=cost[k]||0;
  }else{const cost=upgradeCost({...b,level});for(const k of MATERIALS)total[k]+=cost[k]||0;}
 }
 return Object.fromEntries(Object.entries(total).filter(([,n])=>n>0).map(([k,n])=>[k,Math.floor(n/2)]));
}
export function setPriority(s,x,y,priority){
 const b=find(s,x,y),reason=blocked(s);if(reason)return {ok:false,reason};
 if(!b?.construction||![0,1,2].includes(priority))return {ok:false,reason:'Выбери стройку и её приоритет'};
 if(b.construction.routeOrder!==undefined){for(const r of s.roads||[])if(r.construction?.routeOrder===b.construction.routeOrder)r.construction.priority=priority;}else b.construction.priority=priority;invalidateAssignments(s);syncCitizens(s);return {ok:true};
}
export function setCitizenRole(s,id,role){
 const reason=blocked(s);if(reason)return {ok:false,reason};const c=s.citizens.find(c=>c.id===id);
 if(!c||!roles.includes(role))return {ok:false,reason:'Неизвестный житель или роль'};if(!canWork(c))return {ok:false,reason:'Дети начинают работать с 16 лет'};
 const previousRole=c.role||'auto';if(c.phase==='festival')recoverFestivalCitizen(s,id);
 if(hasLoad(c)){if(role===(c.role||'auto'))delete c.pendingRole;else c.pendingRole=role;}
 else{c.role=role;delete c.pendingRole;}
 invalidateAssignments(s);syncCitizens(s);const current=s.citizens.find(v=>v.id===id);if(current&&current.role!==previousRole)recordProfessionEpithet(s,current);return {ok:true};
}
function rememberApproaches(s,b){
 s.roadAnchors??=[];
 const anchors=b.type==='bridge'?[bridgeSpan(b.y).left,bridgeSpan(b.y).right].map(x=>({type:'road',x:x-.5,y:b.y})):[{type:'road',x:b.x,y:b.y}];
 // Preserve the removed doorstep and the nodes currently occupied by residents.
 const old=networkFor(s);
 for(const c of s.citizens){let nearest=null,d=Infinity;for(const p of old.nodes.values()){const n=Math.abs(p.x-c.x)+Math.abs(p.y-c.y);if(n<d){d=n;nearest=p;}}
  if(nearest){const x=nearest.x-.5,y=nearest.y-.5;if(x>=0&&y>=0&&x<WIDTH&&y<HEIGHT)anchors.push({type:'road',x,y});}
 }
 for(const a of anchors)if(!s.roadAnchors.some(p=>p.x===a.x&&p.y===a.y))s.roadAnchors.push(a);
}
function refundOrder(s,b){
 const refund=cancellationRefund(b),key=buildingKey(b);refundSources(s,b.construction.allocations);s.resources.faith+=refund.faith||0;
 for(const c of s.citizens)if(c.site===key)c.buildCargo={};
 delete b.construction;return refund;
}
export function cancelConstruction(s,x,y){
 const b=find(s,x,y),reason=blocked(s);if(reason)return {ok:false,reason};if(!b?.construction)return {ok:false,reason:'Здесь нет незавершённой стройки'};
 const fresh=b.construction.kind==='new';if(fresh)rememberApproaches(s,b);
 const refund=refundOrder(s,b);if(fresh)s.buildings=s.buildings.filter(v=>v!==b);
 s.capacity=housingOf(s);rerouteCitizens(s);note(s,`Отменено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Зарезервированная цена полностью возвращена, включая доставленные материалы и груз в пути.');return {ok:true,refund};
}
function ports(s){const net=networkFor(s),map=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));for(const p of net.ports.filter(p=>p.building.siteKey))map.set(`site:${p.building.siteKey}:${p.building.side}`,p);return {net,map};}
function relocations(s,b){
 if(b.type!=='house')return new Map();
 const {net,map}=ports(s),source=map.get(buildingKey(b)),residents=s.citizens.filter(c=>c.home===buildingKey(b));
 const beds=s.buildings.filter(h=>h!==b&&h.type==='house'&&isComplete(h)).map(h=>({key:buildingKey(h),free:capacityOf(h)-s.citizens.filter(c=>c.home===buildingKey(h)).length}));
 const result=new Map();
 for(const c of residents){const target=beds.find(h=>h.free>0&&source&&map.get(h.key)&&net.components.get(source.key)===net.components.get(map.get(h.key).key));if(!target)return null;target.free--;result.set(c.id,target.key);}
 return result;
}
// A founding hut may be removed with its supplies. Plan first without writes:
// connected storage and capacity must exist for every unit before demolition.
function foundingStockTransfer(s,b){
 if(!b.starterHut||b.type!=='house')return null;
 const {net,map}=ports(s),source=map.get(buildingKey(b));if(!source)return null;
 const component=net.components.get(source.key),targets=s.buildings.filter(t=>t!==b&&isComplete(t)&&['house','shrine','granary','depot'].includes(t.type)&&map.get(buildingKey(t))&&net.components.get(map.get(buildingKey(t)).key)===component).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y));
 const plan=[];
 for(const k of MATERIALS){let left=b.stock?.[k]||0;
  for(const target of targets){const n=Math.min(left,Math.max(0,storeCapacity(target)-(target.stock?.[k]||0)));if(n>0){plan.push({target,key:k,amount:n});left-=n;}if(left<1e-7)break;}
  if(left>1e-7)return null;
 }
 return plan;
}
function localDemolitionStock(b){const goods={...b.workshopStock?.output};if(b.dairy?.reed)goods.reed=(goods.reed||0)+b.dairy.reed;for(const [k,n]of Object.entries(b.workshopStock?.input||{}))goods[k]=(goods[k]||0)+n;for(const [k,n]of Object.entries(b.householdStock||{}))if(MATERIALS.includes(k))goods[k]=(goods[k]||0)+n;return goods;}
function localRefundStore(s,b){const net=networkFor(s),p=net.ports.find(p=>p.building===b);return stockStores(s).find(a=>a!==b&&net.ports.some(port=>port.building===a&&p&&net.components.get(port.key)===net.components.get(p.key)));}
export function canDemolish(s,b){
 // networkFor lazily materializes automatic roads; preview a private road array.
 if(b?.starterHut)s={...s,roads:[...(s.roads||[])]};
 const reason=blocked(s);if(reason)return reason;if(!b||!s.buildings.includes(b))return 'Выбери здание';if([s.relicQuest,s.landRelicQuest].some(q=>q?.artifact?.location==='temple'&&q.artifact.temple===buildingKey(b)))return 'Здесь хранится единственный артефакт бога';if(isTradePort(b)&&(((s.trade?.deliveries||[]).some(q=>q.market===buildingKey(b)&&q.delivered<q.amount)||(s.trade?.sales||[]).some(q=>q.market===buildingKey(b)&&q.loaded+q.cancelled<q.amount))||s.trade?.caravan?.market===buildingKey(b)))return 'Торговый двор занят купцами или оплаченными грузами';if(b.crop?.sheaves>0)return 'Сначала обмолоти снопы на току';if(!isComplete(b))return 'Незавершённую стройку можно отменить с полным возвратом';
 if(b.type==='bridge'&&s.citizens.some(c=>c.waterTrip))return 'Дождись возвращения жителей с водой';
 if(isArtisan(b)&&!['idle','ready'].includes(b.artisan.stage))return 'Дождись завершения ремесленной партии';
 if(b.firing?.hot>0)return 'Дождись завершения обжига и остывания печи';
 if(b.brickmaking?.wet>0)return 'Дождись высыхания партии сырца';
 if(Object.values(localDemolitionStock(b)).some(n=>n>1e-7)&&!localRefundStore(s,b))return 'Нужен доступный склад для домашних запасов и готовой продукции';
 if(s.citizens.some(c=>c.waterTrip&&(c.waterTrip.target===buildingKey(b)||c.waterTrip.origin===buildingKey(b)||c.waterTrip.station===buildingKey(b))))return 'Дождись доставки воды';
 if(s.citizens.some(c=>c.pantryTrip&&c.pantryTarget===buildingKey(b)))return 'Дождись доставки еды соседям';
 if(b.type==='healer'&&s.citizens.some(c=>c.clinic===buildingKey(b)))return 'Дождись возвращения пациентов домой';
 const key=buildingKey(b);if(s.festival&&(s.festival.temple===key||s.festival.allocations[key]))return 'Сначала заверши или отмени праздник: здесь зарезервировано угощение';if(!b.starterHut)syncInventory(s);if(Object.values(b.stock||{}).some(n=>n>1e-7)&&!foundingStockTransfer(s,b))return 'Сначала перенеси запасы в другой склад';if((s.district?.jobs||[]).some(q=>q.delivered+q.cancelled<q.amount&&(q.source===key||q.target===key)&&(!q.automatic||s.citizens.some(c=>c.districtJob===q.id&&Object.values(c.cargo||{}).some(n=>n>0)))))return 'Склад участвует в переносе грузов';if(constructionEntities(s).some(v=>v.construction&&[v.construction.sources,v.construction.allocations].some(a=>Object.values(a?.[key]||{}).some(n=>n>0)))||(s.trade?.sales||[]).some(q=>q.loaded+q.cancelled<q.amount&&[q.sources,q.allocations].some(a=>Object.values(a?.[key]||{}).some(n=>n>0))))return 'Склад хранит зарезервированные материалы';
 const future={...s,buildings:s.buildings.filter(v=>v!==b)};
 if(housingOf(future)<s.population||!relocations(s,b))return 'Нет доступного жилья для переселения жителей';
 if(['shrine','granary','depot'].includes(b.type)&&s.buildings.filter(v=>isComplete(v)&&['shrine','granary','depot'].includes(v.type)).length<=1)return 'Нельзя снести последнее готовое хранилище';
 if(storageOf(future)<storageOf(s)&&MATERIALS.some(k=>storageOf(future)<(s.resources[k]||0)))return 'Сначала освободи еду: оставшихся амбаров недостаточно';
 if(['bridge','shrine','granary','depot'].includes(b.type)){
  const {net,map}=ports(future);
  for(const q of [...s.trade?.deliveries||[],...s.trade?.sales||[]]){if((q.delivered??((q.loaded||0)+(q.cancelled||0)))>=q.amount)continue;const market=map.get(q.market),component=market&&net.components.get(market.key);if(!market||!future.buildings.some(store=>['shrine','granary','depot'].includes(store.type)&&isComplete(store)&&map.get(buildingKey(store))&&net.components.get(map.get(buildingKey(store)).key)===component))return 'На рынке ждут оплаченные покупки: нужен доступный склад';}
  for(const c of s.citizens.filter(hasLoad)){
   let nearest=null,min=Infinity;for(const p of net.nodes.values()){const d=Math.abs(c.x-p.x)+Math.abs(c.y-p.y);if(d<min){min=d;nearest=p;}}
   const component=nearest&&net.components.get(nearest.key);
   const stores=future.buildings.filter(v=>isComplete(v)&&['shrine','granary','depot'].includes(v.type));
   if(!stores.some(v=>map.get(buildingKey(v))&&net.components.get(map.get(buildingKey(v)).key)===component))return 'Есть грузы в пути: нужен другой доступный склад на этом берегу';
   if(c.tradeJob||c.saleJob){const market=map.get(c.tradeMarket||c.saleMarket);if(!market||net.components.get(market.key)!==component)return 'Дождись доставки покупок: снос перекроет путь к рынку';}
   if(c.clothingLoad){const target=map.get(c.home);if(!target||net.components.get(target.key)!==component)return 'Дождись доставки одежды домой';}
   if(c.craftSite&&craftLoad(c)>0){const target=map.get(c.craftSite);if(!target||net.components.get(target.key)!==component)return 'Дождись доставки сырья: снос перекроет путь к мастерской';}
   if(Object.values(c.buildCargo||{}).some(n=>n>0)&&c.site!==buildingKey(b)){
    const target=map.get(c.sitePort);if(!target||net.components.get(target.key)!==component)return 'Сначала дождись доставки материалов: снос перекроет их путь к стройке';
   }
  }
 }
 if(b.type==='bridge'){
  const caravan=s.trade?.caravan;if(caravan&&caravan.transport!=='river'&&caravan.x!==null){if(onBridge([b],caravan.x,caravan.y))return 'Дождись, пока караван сойдёт с моста';const net=networkFor(future),near=[...net.nodes.values()].sort((a,b)=>Math.abs(a.x-caravan.x)+Math.abs(a.y-caravan.y)-Math.abs(b.x-caravan.x)-Math.abs(b.y-caravan.y))[0],market=net.ports.find(p=>buildingKey(p.building)===caravan.market);if(near&&(!net.nodes.has(caravan.entry)||net.components.get(near.key)!==net.components.get(caravan.entry)||market&&net.components.get(near.key)!==net.components.get(market.key)))return 'Снос перекроет путь каравана';}
  if(s.citizens.some(c=>onBridge([b],c.x,c.y)))return 'Дождись, пока все жители сойдут с моста';
  const {net,map}=ports(future);
  for(const c of s.citizens){let nearest=null,min=Infinity;for(const p of net.nodes.values()){const d=Math.abs(c.x-p.x)+Math.abs(c.y-p.y);if(d<min){min=d;nearest=p;}}
   const home=map.get(c.home);if(!nearest||!home||net.components.get(nearest.key)!==net.components.get(home.key))return 'Снос отрежет жителей от их домов';
  }
 }
 return '';
}
export function demolish(s,x,y){
 const b=find(s,x,y),reason=canDemolish(s,b);if(reason)return {ok:false,reason};
 const homes=relocations(s,b),refund=demolitionRefund(b),transfer=b.starterHut?foundingStockTransfer(s,b):null;
 for(const q of s.district?.jobs||[])if(q.automatic&&(q.source===buildingKey(b)||q.target===buildingKey(b))){q.cancelled+=q.remaining;q.remaining=0;for(const c of s.citizens.filter(c=>c.districtJob===q.id))recoverCitizenCargo(s,c.id);}
 // All capacity, reservation, resident and route gates above have succeeded.
 // This emergency relocation follows the existing demolition-refund abstraction.
 if(transfer)for(const {target,key,amount}of transfer){target.stock??=Object.fromEntries(MATERIALS.map(k=>[k,0]));target.stock[key]+=amount;b.stock[key]-=amount;}
 const localGoods=localDemolitionStock(b),localTarget=Object.values(localGoods).some(n=>n>0)?localRefundStore(s,b):null;if(localTarget){for(const [k,n]of Object.entries(localGoods))if(n>0)putStock(s,buildingKey(localTarget),k,n,{overflow:true});if(b.workshopStock){b.workshopStock.output={};if(b.workshopStock.input)for(const k of Object.keys(b.workshopStock.input))b.workshopStock.input[k]=0;}if(b.householdStock)for(const k of Object.keys(b.householdStock))b.householdStock[k]=0;if(b.dairy)b.dairy.reed=0;}
 if(b.brickmaking){const amounts={clay:b.brickmaking.clay,reed:b.brickmaking.reed,brick:b.brickmaking.ready};if(Object.values(amounts).some(n=>n>0)){const net=networkFor(s),p=net.ports.find(p=>p.building===b),target=stockStores(s).find(a=>{const port=net.ports.find(p=>p.building===a);return port&&p&&net.components.get(port.key)===net.components.get(p.key);});if(!target)return {ok:false,reason:'Нужен доступный склад для возврата сырья и сырца'};for(const [k,n]of Object.entries(amounts))if(n>0)putStock(s,buildingKey(target),k,n,{overflow:true});b.brickmaking.clay=0;b.brickmaking.reed=0;b.brickmaking.ready=0;}}
if(isArtisan(b)){const v=b.artisan,amounts={clay:v.clay,reed:v.reed,food:v.food,pottery:v.pottery};amounts[artisanOutput(b)]=(amounts[artisanOutput(b)]||0)+v.ready;if(Object.values(amounts).some(n=>n>0)){const net=networkFor(s),p=net.ports.find(p=>p.building===b),target=stockStores(s).find(a=>{const port=net.ports.find(p=>p.building===a);return port&&p&&net.components.get(port.key)===net.components.get(p.key);});if(!target)return {ok:false,reason:'Нужен доступный склад для возврата ремесленных грузов'};for(const [k,n]of Object.entries(amounts))if(n>0)putStock(s,buildingKey(target),k,n,{overflow:true});}}
if(b.firing){const amounts={brick:b.firing.brick,reed:b.firing.reed,firedBrick:b.firing.ready};if(Object.values(amounts).some(n=>n>0)){const net=networkFor(s),p=net.ports.find(p=>p.building===b),target=stockStores(s).find(a=>{const port=net.ports.find(p=>p.building===a);return port&&p&&net.components.get(port.key)===net.components.get(p.key);});if(!target)return {ok:false,reason:'Нужен доступный склад для возврата топлива и кирпича'};for(const [k,n]of Object.entries(amounts))if(n>0)putStock(s,buildingKey(target),k,n,{overflow:true});b.firing.brick=0;b.firing.reed=0;b.firing.ready=0;}}
if((b.weaving?.wool||b.tailoring?.cloth)>0){const net=networkFor(s),p=net.ports.find(p=>p.building===b),target=stockStores(s).find(a=>{const port=net.ports.find(p=>p.building===a);return port&&p&&net.components.get(port.key)===net.components.get(p.key);});if(!target)return {ok:false,reason:'Нужен доступный склад для возврата сырья'};putStock(s,buildingKey(target),craftResource(b),craftState(b)[craftResource(b)],{overflow:true});craftState(b)[craftResource(b)]=0;}rememberApproaches(s,b);if(b.pantry)s.resources.food+=b.pantry;if(b.crop?.seedStock)s.resources.food+=b.crop.seedStock;for(const c of s.citizens)if(c.craftSite===buildingKey(b)||c.seedField===buildingKey(b))recoverCitizenCargo(s,c.id);
 if(b.construction){const cancelled=refundOrder(s,b);for(const [k,n]of Object.entries(cancelled))refund[k]=(refund[k]||0)+n;}
 for(const [k,n]of Object.entries(demolitionRefund(b)))s.resources[k]+=n;
 for(const c of s.citizens){if(homes.has(c.id))c.home=homes.get(c.id);if(c.work===buildingKey(b))c.work=null;if(c.store===buildingKey(b))c.store=null;}
 s.buildings=s.buildings.filter(v=>v!==b);for(const c of s.citizens){if(c.workplace===buildingKey(b))delete c.workplace;if(c.guardPost===buildingKey(b))delete c.guardPost;}s.capacity=housingOf(s);rerouteCitizens(s);
 syncInventory(s);note(s,`Снесено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Половина вложенной глины и тростника возвращена. Жители получили новые маршруты.');return {ok:true,refund};
}

export function inspirationReason(s,id,profession){const reason=blocked(s);if(reason)return reason;const c=s.citizens.find(c=>c.id===id),role=professionRole(profession);if(!c||!PROFESSION_IDS.includes(profession))return 'Неизвестный житель или роль';if(profession==='auto'&&(c.role||'auto')==='auto'||c.pendingRole===profession)return 'Эта профессия уже выбрана';if(c.calling===profession&&((c.role||'auto')===role||c.pendingRole===role||c.futureRole===role))return 'Это призвание уже открыто';const knowledge=godhoodInspirationReason(s,c,profession);if(knowledge)return knowledge;if(s.resources.faith<1)return 'Нужна 1 вера';return '';}
export function inspireCitizen(s,id,profession){
 const reason=inspirationReason(s,id,profession);if(reason)return {ok:false,reason,message:reason};
 s.resources.faith-=1;s.rngState=((s.rngState??117)*1664525+1013904223)>>>0;
 const subject=s.citizens.find(c=>c.id===id),role=professionRole(profession),success=firstBuilderInspiration(s,subject,profession)||s.rngState/4294967296<inspirationChance(subject,profession);
 registerInspiration(s,success);affectResidents(s,{faith:success?6:-5,mood:success?4:-3},[id]);const c=s.citizens.find(c=>c.id===id);
 if(success){if(role==='healer')c.medicine??=newMedicalSkill(s.year);c.calling=profession;acceptGodhoodInspiration(s,c,profession);if(canWork(c))setCitizenRole(s,id,role);else c.futureRole=role;}
 recordInspirationOutcome(s,s.citizens.find(c=>c.id===id),success);
 const message=`Житель ${id+1}: ${success?'вдохновение принято':'вдохновение не принято'}`;note(s,'Вдохновение',message);return {ok:true,success,message};
}

export function cancelRoadRoute(s,group){if(!Number.isSafeInteger(group)||group<0)return {ok:false,reason:'Неизвестный дорожный маршрут'};const reason=blocked(s);if(reason)return {ok:false,reason};const roads=(s.roads||[]).filter(r=>r.construction?.routeOrder===group);if(!roads.length)return {ok:false,reason:'У маршрута нет незавершённых работ'};for(const r of roads)refundOrder(s,r);rerouteCitizens(s);note(s,'Маршрут отменён','Незавершённые дорожные работы отменены, их материалы возвращены. Готовые участки сохранены.');return {ok:true,count:roads.length};}

export function assignWorkplace(s,id,key){
 const reason=blocked(s);if(reason)return {ok:false,reason};const c=s.citizens.find(c=>c.id===id);if(!c||!canWork(c))return {ok:false,reason:'Нужен взрослый работник'};
 if(key){const b=s.buildings.find(b=>buildingKey(b)===key);if(!b||!isComplete(b)||!Object.keys(BUILDINGS[b.type].output).length&&!['healer','depot','waterpoint'].includes(b.type))return {ok:false,reason:'Нужна готовая производственная постройка'};
  if(!canStaffBuilding(c,b))return {ok:false,reason:'Не подходит профессия: сначала вдохнови жителя'};
  if(s.citizens.filter(v=>v.id!==id&&v.workplace===key).length>=(['healer','musicHouse'].includes(b.type)?1:2))return {ok:false,reason:'Все постоянные места заняты'};
  const {net,map}=ports(s),home=map.get(c.home),target=map.get(key);if(!home||!target||net.components.get(home.key)!==net.components.get(target.key))return {ok:false,reason:'Нет дороги от дома к работе'};
  c.workplace=key;delete c.guardPost;
 }else{delete c.workplace;delete c.guardPost;}
 invalidateAssignments(s);syncCitizens(s);return {ok:true};
}

export function assignGuard(s,id,key){
 const reason=blocked(s);if(reason)return {ok:false,reason};const c=s.citizens.find(c=>c.id===id);if(!c||!canWork(c)||!['auto','production'].includes(c.role))return {ok:false,reason:'Нужен взрослый со свободной производственной профессией'};
 if(key){const b=s.buildings.find(b=>buildingKey(b)===key);if(!b||!isComplete(b)||!['shrine','granary','depot'].includes(b.type))return {ok:false,reason:'Нужен готовый амбар или храм-склад'};if(s.citizens.some(v=>v.id!==id&&v.guardPost===key))return {ok:false,reason:'У склада уже есть сторож'};const {net,map}=ports(s),home=map.get(c.home),target=map.get(key);if(!home||!target||net.components.get(home.key)!==net.components.get(target.key))return {ok:false,reason:'Нет дороги от дома к складу'};c.guardPost=key;delete c.workplace;}else delete c.guardPost;
 invalidateAssignments(s);syncCitizens(s);return {ok:true};
}
