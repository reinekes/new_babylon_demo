import {riverStoreDemolitionReason} from './river-stores.js';
import {retireMonumentLife} from './campaign.js';
import {retireStarForecastAt} from './star-forecast.js';
import {retireDepthPressure} from './depth-supply.js';
import {reservedArrivalBeds} from './arrival-hospitality.js';
import {householdAwaitingFamily} from './household-initiative.js';
import {groundShapingBatch} from './shaping-batch.js';
import {moveGiftFood} from './abundance-origin.js';
import {addCreatorStock,takeCreatorStock} from './creator-materials.js';
import {appendFish,takeFish} from './fish-provenance.js';
import {isStrictSumer} from './scenario-profiles.js';
import {protectsGuestBuilding} from './external-guest.js';
import {restReeds,advanceReedBeds} from './reed-stock.js';
import {forestFor,restForest} from './forest-stock.js';
import {restFishery} from './fishery-stock.js';
import {fisheryOptions} from './labor-life.js';
import {enableAutumnCrops} from './agriculture.js';
import {fieldRestYear} from './crop-calendar.js';
import {soilCareEnabled} from './field-soil.js';
import {canalMaintenanceEnabled,needsCanalCleaning} from './canal-maintenance.js';
import {harvestDemand,unloadDemand} from './city-labor.js';
import {preparedFisherInspiration,acceptFisherInspiration} from './miracle-discovery.js';
import {discardFishingOutput} from './cat-fishing-ledger.js';
import {godhoodInspirationReason,firstBuilderInspiration,acceptGodhoodInspiration,isAwakening} from './godhood.js';
import {relicControlActive,relicCommandReason} from './relic-quest.js';
import {cityCommandReason} from './city-command-lock.js';
import {recoverFestivalCitizen,retireFirstBeerVenue} from './festival.js';
import {recordProfessionEpithet,recordInspirationOutcome} from './citizen-epithets.js';
import {workTool,toolResource} from './axe-kit.js';
import {isArtisan,artisanOutput} from './artisan.js';
import {isTradePort} from './river-trade.js';
import {upgradeCost} from './masonry.js';
import {craftLoad,craftResource,craftState} from './textiles.js';
import {putStock,stockStores,storeCapacity,refundSources,syncInventory} from './inventory.js';
import {ROLES,inspirationChance,newMedicalSkill} from './education.js';
import {PROFESSION_IDS,professionRole,canStaffBuilding,workplaceCapacity,hasWorkplace} from './professions.js';
import {affectResidents} from './wellbeing.js';
import {canWork} from './demography.js';
import {registerInspiration} from './divinity.js';
import {BUILDINGS,buildingKey,capacityOf,housingOf,storageOf,levelOf,MATERIALS} from './definitions.js';
import {isComplete,constructionEntities} from './construction.js';
import {syncCitizens,invalidateAssignments,rerouteCitizens,networkFor,recoverCitizenCargo} from './workforce.js';
import {bridgeSpanAt,worldFromRiver,onBridge,worldWidth,worldHeight} from './world.js';
const roles=ROLES;
const hasLoad=c=>!!c.waterTrip||c.clothingTarget!==undefined||!!c.craftSite||!!c.seedField||c.pantryFood>0||Object.values(c.cargo||{}).some(v=>v>0)||Object.values(c.buildCargo||{}).some(v=>v>0);
const find=(s,x,y)=>constructionEntities(s).find(b=>b.x===x&&b.y===y);
const blocked=s=>cityCommandReason(s)||(s.funeral?'Жители прощаются с умершими':s.lost?'Поселение покинуто':s.event?'Сначала заверши событие':'');
const upgradePrice=(b,level)=>({...level===2?(b.type==='house'?{wood:4,hides:2}:b.type!=='bridge'?{stone:8}:{}):{},clay:Math.ceil(BUILDINGS[b.type].clay*(level===1?1.5:2.5)),reed:Math.max(4,Math.ceil(BUILDINGS[b.type].reed*(level===1?1.5:2.5)))});
function note(s,title,text){s.news.unshift({title,text,kind:'build',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);}
export function cancellationRefund(b){const q=b?.construction;return q?{...q.required,faith:q.kind==='new'?(BUILDINGS[b.type]?.faith||0):0}:{clay:0,reed:0,faith:0};}
export function demolitionRefund(b){
 if(!b||b.reedCamp||!isComplete(b))return {clay:0,reed:0};
 const total=Object.fromEntries(MATERIALS.map(k=>[k,BUILDINGS[b.type][k]||0]));
 total.joinery+=(b.joineryLevels?.length||0)*2;
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
 const anchors=b.type==='bridge'?[bridgeSpanAt(b,s).left,bridgeSpanAt(b,s).right].map(x=>({type:'road',...worldFromRiver(x-.5,bridgeSpanAt(b,s).y-.5,s)})):[{type:'road',x:b.x,y:b.y}];
 // Preserve the removed doorstep and the nodes currently occupied by residents.
 const old=networkFor(s);
 for(const c of s.citizens){let nearest=null,d=Infinity;for(const p of old.nodes.values()){const n=Math.abs(p.x-c.x)+Math.abs(p.y-c.y);if(n<d){d=n;nearest=p;}}
  if(nearest){const x=nearest.x-.5,y=nearest.y-.5;if(x>=0&&y>=0&&x<worldWidth(s)&&y<worldHeight(s))anchors.push({type:'road',x,y});}
 }
 for(const a of anchors)if(!s.roadAnchors.some(p=>p.x===a.x&&p.y===a.y))s.roadAnchors.push(a);
}
function refundOrder(s,b){
 const refund=cancellationRefund(b),key=buildingKey(b);refundSources(s,b.construction.allocations,b.construction.creatorAllocations);s.resources.faith+=refund.faith||0;
 for(const c of s.citizens)if(c.site===key)c.buildCargo={};
 delete b.construction;return refund;
}
function removalChanged(b,expected){
 return expected&&(b!==expected.building||b.construction!==expected.order||b.level!==expected.level);
}
const staleRemoval=()=>({ok:false,reason:'Постройка или заказ изменились. Открой подтверждение заново.'});
export function cancelConstruction(s,x,y,expected){
 const b=find(s,x,y),reason=blocked(s);if(reason)return {ok:false,reason};if(removalChanged(b,expected))return staleRemoval();if(!b?.construction)return {ok:false,reason:'Здесь нет незавершённой стройки'};
 const fresh=b.construction.kind==='new';if(fresh)rememberApproaches(s,b);
 if(s.buildings.includes(b))retireStarForecastAt(s,x,y,'construction');
 const refund=refundOrder(s,b);if(fresh)s.buildings=s.buildings.filter(v=>v!==b);
 s.capacity=housingOf(s);rerouteCitizens(s);note(s,`Отменено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Зарезервированная цена полностью возвращена, включая доставленные материалы и груз в пути.');return {ok:true,refund};
}
function ports(s){const net=networkFor(s),map=new Map(net.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));for(const p of net.ports.filter(p=>p.building.siteKey))map.set(`site:${p.building.siteKey}:${p.building.side}`,p);return {net,map};}
function relocations(s,b){
 if(b.type!=='house')return new Map();
 const {net,map}=ports(s),source=map.get(buildingKey(b)),residents=s.citizens.filter(c=>c.home===buildingKey(b));
 const beds=s.buildings.filter(h=>h!==b&&h.type==='house'&&isComplete(h)&&!householdAwaitingFamily(s,h)).map(h=>({key:buildingKey(h),free:capacityOf(h)-reservedArrivalBeds(s,buildingKey(h))-s.citizens.filter(c=>c.home===buildingKey(h)).length}));
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
function localDemolitionStock(b){const goods={...b.workshopStock?.output};const kit=workTool(b),tool=toolResource(b);if(kit?.[tool])goods[tool]=kit[tool];if(kit?.copper)goods.copper=kit.copper;if(b.sickle?.pottery)goods.pottery=(goods.pottery||0)+b.sickle.pottery;if(b.dairy?.reed||b.flock?.reed)goods.reed=(goods.reed||0)+(b.dairy?.reed||0)+(b.flock?.reed||0);for(const [k,n]of Object.entries(b.workshopStock?.input||{}))goods[k]=(goods[k]||0)+n;for(const [k,n]of Object.entries(b.householdStock||{}))if(MATERIALS.includes(k))goods[k]=(goods[k]||0)+n;return goods;}
function workshopDemolitionStock(b){
 const batches=[];
 if(b.brickmaking)batches.push({amounts:{clay:b.brickmaking.clay,reed:b.brickmaking.reed,brick:b.brickmaking.ready}});
 if(isArtisan(b)){
  const {clay,reed,food,pottery,flax,milk,copper,timber,ready}=b.artisan;
  const amounts={clay,reed,food,pottery,flax,milk,copper,timber},output=artisanOutput(b);
  amounts[output]=(amounts[output]||0)+ready;
  batches.push({amounts,gift:b.giftInput});
 }
 if(b.firing)batches.push({amounts:{brick:b.firing.brick,reed:b.firing.reed,firedBrick:b.firing.ready}});
 if((b.weaving?.wool||b.tailoring?.cloth)>0){
  const resource=craftResource(b);
  batches.push({amounts:{[resource]:craftState(b)[resource]}});
 }
 return batches.filter(({amounts})=>Object.values(amounts).some(n=>n>0));
}
function localRefundStore(s,b){const net=networkFor(s,{materializeRoads:false}),p=net.ports.find(p=>p.building===b);return stockStores(s).find(a=>a!==b&&net.ports.some(port=>port.building===a&&p&&net.components.get(port.key)===net.components.get(p.key)));}
export function canDemolish(s,b){
 // networkFor lazily materializes automatic roads; preview a private road array.
 if(b?.starterHut)s={...s,roads:[...(s.roads||[])]};
 const reason=blocked(s);if(reason)return reason;if(!b||!s.buildings.includes(b))return 'Выбери здание';if([s.relicQuest,s.landRelicQuest].some(q=>q?.artifact?.location==='temple'&&q.artifact.temple===buildingKey(b)))return 'Здесь хранится единственный артефакт бога';if(isTradePort(b)&&(((s.trade?.deliveries||[]).some(q=>q.market===buildingKey(b)&&q.delivered<q.amount)||(s.trade?.sales||[]).some(q=>q.market===buildingKey(b)&&q.loaded+q.cancelled<q.amount))||s.trade?.caravan?.market===buildingKey(b)))return 'Торговый двор занят купцами или оплаченными грузами';if(s.citizens.some(c=>c.memorialMove?.source===buildingKey(b)||c.memorialMove?.target===buildingKey(b)))return 'Дождись переноса семейной памяти';if(s.citizens.some(c=>c.commonMealTarget===buildingKey(b)))return 'Дождись работников, которые идут на общую трапезу';if(b.crop?.sheaves>0)return 'Сначала обмолоти снопы на току';if(!isComplete(b))return 'Незавершённую стройку можно отменить с полным возвратом';
 const riverReason=riverStoreDemolitionReason(s,b);if(riverReason)return riverReason;
 if(b.type==='bridge'&&s.citizens.some(c=>c.waterTrip))return 'Дождись возвращения жителей с водой';
 if(isArtisan(b)&&!['idle','ready'].includes(b.artisan.stage))return 'Дождись завершения ремесленной партии';
 if(b.firing?.hot>0)return 'Дождись завершения обжига и остывания печи';
 if(b.brickmaking?.wet>0)return 'Дождись высыхания партии сырца';
 if(Object.values(localDemolitionStock(b)).some(n=>n>1e-7)&&!localRefundStore(s,b))return 'Нужен доступный склад для домашних запасов и готовой продукции';
 if(workshopDemolitionStock(b).length&&!localRefundStore(s,b))return 'Нужен доступный склад для возврата ремесленных запасов';
 if(s.citizens.some(c=>c.fireShelter&&[c.home,c.fireShelter.host,c.fireShelter.kiln].includes(buildingKey(b))))return 'Дождись возвращения семьи из укрытия';
 if(s.citizens.some(c=>c.floodShelter&&(c.floodShelter===buildingKey(b)||c.home===buildingKey(b))))return 'Дождись окончания эвакуации из-за разлива';
 if(s.citizens.some(c=>c.waterTrip&&(c.waterTrip.target===buildingKey(b)||c.waterTrip.origin===buildingKey(b)||c.waterTrip.station===buildingKey(b))))return 'Дождись доставки воды';
 if(s.citizens.some(c=>c.pantryTrip&&c.pantryTarget===buildingKey(b)))return 'Дождись доставки еды соседям';
 if(b.type==='healer'&&s.citizens.some(c=>c.clinic===buildingKey(b)))return 'Дождись возвращения пациентов домой';
 const key=buildingKey(b),group=s.arrivalGroup;
 if(group&&(group.home===key||Object.hasOwn(group.provisions,key)))return 'Здесь зарезервированы жильё или припасы для переселенцев';
 if(s.votiveOfferings?.some(v=>v.temple===key&&v.receivedTick!==null))return 'Храм хранит именные посвящения';if(protectsGuestBuilding(s,key))return 'Здание используется приглашённым мастером';if(s.festival&&(s.festival.temple===key||s.festival.allocations[key]))return 'Сначала заверши или отмени праздник: здесь зарезервировано угощение';if(!b.starterHut)syncInventory(s);if(Object.values(b.stock||{}).some(n=>n>1e-7)&&!foundingStockTransfer(s,b))return 'Сначала перенеси запасы в другой склад';if((s.district?.jobs||[]).some(q=>q.delivered+q.cancelled<q.amount&&(q.target===key||q.source===key&&!q.shapingBatch)&&(!q.automatic||s.citizens.some(c=>c.districtJob===q.id&&Object.values(c.cargo||{}).some(n=>n>0)))))return 'Склад участвует в переносе грузов';if(constructionEntities(s).some(v=>v.construction&&[v.construction.sources,v.construction.allocations].some(a=>Object.values(a?.[key]||{}).some(n=>n>0)))||(s.trade?.sales||[]).some(q=>q.loaded+q.cancelled<q.amount&&[q.sources,q.allocations].some(a=>Object.values(a?.[key]||{}).some(n=>n>0))))return 'Склад хранит зарезервированные материалы';
 const future={...s,buildings:s.buildings.filter(v=>v!==b)};
 if(future.buildings.reduce((n,home)=>n+capacityOf(home),0)<s.population||!relocations(s,b))return 'Нет доступного жилья для переселения жителей';
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
  const caravan=s.trade?.caravan;if(caravan&&caravan.transport!=='river'&&caravan.x!==null){if(onBridge([b],caravan.x,caravan.y,s))return 'Дождись, пока караван сойдёт с моста';const net=networkFor(future),near=[...net.nodes.values()].sort((a,b)=>Math.abs(a.x-caravan.x)+Math.abs(a.y-caravan.y)-Math.abs(b.x-caravan.x)-Math.abs(b.y-caravan.y))[0],market=net.ports.find(p=>buildingKey(p.building)===caravan.market);if(near&&(!net.nodes.has(caravan.entry)||net.components.get(near.key)!==net.components.get(caravan.entry)||market&&net.components.get(near.key)!==net.components.get(market.key)))return 'Снос перекроет путь каравана';}
  if(s.citizens.some(c=>onBridge([b],c.x,c.y,s)))return 'Дождись, пока все жители сойдут с моста';
  const {net,map}=ports(future);
  for(const c of s.citizens){let nearest=null,min=Infinity;for(const p of net.nodes.values()){const d=Math.abs(c.x-p.x)+Math.abs(c.y-p.y);if(d<min){min=d;nearest=p;}}
   const home=map.get(c.home);if(!nearest||!home||net.components.get(nearest.key)!==net.components.get(home.key))return 'Снос отрежет жителей от их домов';
  }
 }
 return '';
}
export function demolish(s,x,y,expected){
 const b=find(s,x,y);if(removalChanged(b,expected))return staleRemoval();
 const reason=canDemolish(s,b);if(reason)return {ok:false,reason};
 const homes=relocations(s,b),refund=demolitionRefund(b),transfer=b.starterHut?foundingStockTransfer(s,b):null;
 const workshopBatches=workshopDemolitionStock(b);
 const workshopTarget=workshopBatches.length?localRefundStore(s,b):null;
 if(workshopBatches.length&&!workshopTarget)return {ok:false,reason:'Нужен доступный склад для возврата ремесленных запасов'};
 for(const q of s.district?.jobs||[])if(q.automatic&&(q.source===buildingKey(b)||q.target===buildingKey(b))){q.cancelled+=q.remaining;q.remaining=0;for(const c of s.citizens.filter(c=>c.districtJob===q.id))recoverCitizenCargo(s,c.id);}
 // All capacity, reservation, resident and route gates above have succeeded.
 // This emergency relocation follows the existing demolition-refund abstraction.
 if(transfer)for(const {target,key,amount}of transfer){target.stock??=Object.fromEntries(MATERIALS.map(k=>[k,0]));if(key==='food')moveGiftFood(b,'giftStock',target,'giftStock',amount,b.stock.food,target.stock.food);if(key==='food'&&b.fishStock)appendFish(target,'fishStock',takeFish(b,'fishStock',amount,b.stock.food),target.stock.food);if(b.creatorStock)addCreatorStock(target,key,takeCreatorStock(b,key,amount));target.stock[key]+=amount;b.stock[key]-=amount;}
 const localGoods=localDemolitionStock(b),localTarget=Object.values(localGoods).some(n=>n>0)?localRefundStore(s,b):null;if(localTarget){for(const [k,n]of Object.entries(localGoods))if(n>0){
  const accepted=putStock(s,buildingKey(localTarget),k,n,{overflow:true});
  if(k==='food'&&b.giftInput)moveGiftFood(b,'giftInput',localTarget,'giftStock',accepted,b.workshopStock.input.food,localTarget.stock.food-accepted);
  if(k==='food'&&b.fishOutput)appendFish(localTarget,'fishStock',takeFish(b,'fishOutput',Math.min(accepted,b.workshopStock.output.food),b.workshopStock.output.food),localTarget.stock.food-accepted);
 }if(b.workshopStock){b.workshopStock.output={};if(b.workshopStock.input)for(const k of Object.keys(b.workshopStock.input))b.workshopStock.input[k]=0;}if(b.householdStock)for(const k of Object.keys(b.householdStock))b.householdStock[k]=0;if(b.dairy)b.dairy.reed=0;}
 for(const {amounts,gift} of workshopBatches)for(const [resource,amount] of Object.entries(amounts))if(amount>0){
  putStock(s,buildingKey(workshopTarget),resource,amount,{overflow:true,gift:resource==='food'?gift:undefined});
 }
 if(b.brickmaking)Object.assign(b.brickmaking,{clay:0,reed:0,ready:0});
 if(b.firing)Object.assign(b.firing,{brick:0,reed:0,ready:0});
 if((b.weaving?.wool||b.tailoring?.cloth)>0)craftState(b)[craftResource(b)]=0;
 rememberApproaches(s,b);if(b.pantry){
 const receiver=b.giftHome&&stockStores(s).find(store=>store!==b);
 if(receiver){
  const key=buildingKey(receiver),accepted=putStock(s,key,'food',b.pantry,{overflow:true});
  moveGiftFood(b,'giftHome',receiver,'giftStock',accepted,b.pantry,receiver.stock.food-accepted);
 }else s.resources.food+=b.pantry;
}if(b.crop?.seedStock){
 const receiver=b.giftSeedStock&&stockStores(s).find(store=>store!==b);
 if(receiver)putStock(s,buildingKey(receiver),'food',b.crop.seedStock,{overflow:true,gift:b.giftSeedStock});
 else s.resources.food+=b.crop.seedStock;
}for(const c of s.citizens)if(c.craftSite===buildingKey(b)||c.seedField===buildingKey(b))recoverCitizenCargo(s,c.id);
 if(b.construction){const cancelled=refundOrder(s,b);for(const [k,n]of Object.entries(cancelled))refund[k]=(refund[k]||0)+n;}
 for(const [k,n]of Object.entries(demolitionRefund(b)))s.resources[k]+=n;
 for(const c of s.citizens){if(homes.has(c.id))c.home=homes.get(c.id);if(c.work===buildingKey(b))c.work=null;if(c.store===buildingKey(b))c.store=null;}
 if(b.type==='house')delete s.demography?.lastBirth?.[buildingKey(b)];
 if(b.type==='canal')retireDepthPressure(s,b.x,b.y);
 retireStarForecastAt(s,b.x,b.y);
 retireFirstBeerVenue(s,b);
 retireMonumentLife(s,b);
 groundShapingBatch(s,b);
 s.buildings=s.buildings.filter(v=>v!==b);discardFishingOutput(s,b);for(const c of s.citizens){if(c.workplace===buildingKey(b))delete c.workplace;if(c.guardPost===buildingKey(b))delete c.guardPost;}s.capacity=housingOf(s);rerouteCitizens(s);
 syncInventory(s);note(s,`Снесено: ${(BUILDINGS[b.type]?.name||'Дорога')}`,'Половина вложенной глины и тростника возвращена. Жители получили новые маршруты.');return {ok:true,refund};
}

export function builderConsent(s,c,profession){
 if(profession!=='builder'||!isStrictSumer(s)||!isAwakening(s)||firstBuilderInspiration(s,c,profession))return null;
 if(!canWork(c))return 'Сможет принять работу строителя с 16 лет';
 if(c.clinic||c.health<60)return 'Сначала нужно восстановить здоровье';
 if(c.hunger>=30)return 'Сначала нужна еда: житель голоден';
 if(c.waterTrip||c.pantryTrip||c.memorialMove||c.districtJob||c.saleJob||c.tradeJob||c.craftSite||c.seedField||c.clothingTarget!==undefined||
  Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0))return 'Сначала нужно завершить текущую доставку';
 return '';
}
export function inspirationReason(s,id,profession){const reason=blocked(s);if(reason)return reason;const c=s.citizens.find(c=>c.id===id),role=professionRole(profession);if(!c||!PROFESSION_IDS.includes(profession))return 'Неизвестный житель или роль';if(profession==='lawmaker'&&(!s.civicOrder||c.age<16))return 'Законодателем может стать взрослый в новом «Пробуждении»';if(profession==='auto'&&(c.role||'auto')==='auto'||c.pendingRole===profession)return 'Эта профессия уже выбрана';if(c.calling===profession&&((c.role||'auto')===role||c.pendingRole===role||c.futureRole===role))return 'Это призвание уже открыто';const knowledge=godhoodInspirationReason(s,c,profession);if(knowledge)return knowledge;const consent=builderConsent(s,c,profession);if(consent)return consent;if(s.resources.faith<1)return 'Нужна 1 вера';return '';}
export function inspirationSuccessChance(s,c,profession){
 if(!c)return 0;
 const consent=builderConsent(s,c,profession);
 if(consent!==null)return consent?0:1;
 return firstBuilderInspiration(s,c,profession)||preparedFisherInspiration(s,c,profession)?1:inspirationChance(c,profession);
}
export function inspireCitizen(s,id,profession){
 const reason=inspirationReason(s,id,profession);if(reason)return {ok:false,reason,message:reason};
 const subject=s.citizens.find(c=>c.id===id),role=professionRole(profession),consent=builderConsent(s,subject,profession);
 s.resources.faith-=1;
 if(consent===null)s.rngState=((s.rngState??117)*1664525+1013904223)>>>0;
 const success=consent===''||s.rngState/4294967296<inspirationSuccessChance(s,subject,profession);
 registerInspiration(s,success);affectResidents(s,{faith:success?6:-5,mood:success?4:-3},[id]);const c=s.citizens.find(c=>c.id===id);
 if(success){if(role==='healer')c.medicine??=newMedicalSkill(s.year);c.calling=profession;acceptGodhoodInspiration(s,c,profession);acceptFisherInspiration(s,c,profession);if(canWork(c))setCitizenRole(s,id,role);else c.futureRole=role;}
 recordInspirationOutcome(s,s.citizens.find(c=>c.id===id),success);
 const message=`Житель ${id+1}: ${success?'вдохновение принято':'вдохновение не принято'}`;note(s,'Вдохновение',message);return {ok:true,success,message};
}

export function cancelRoadRoute(s,group,expectedOrder){if(!Number.isSafeInteger(group)||group<0)return {ok:false,reason:'Неизвестный дорожный маршрут'};const reason=blocked(s);if(reason)return {ok:false,reason};const roads=(s.roads||[]).filter(r=>r.construction?.routeOrder===group);if(expectedOrder!==undefined&&!roads.some(r=>r.construction===expectedOrder))return {ok:false,reason:'Дорожный заказ изменился. Обнови карточку участка.'};if(!roads.length)return {ok:false,reason:'У маршрута нет незавершённых работ'};for(const r of roads)refundOrder(s,r);rerouteCitizens(s);note(s,'Маршрут отменён','Незавершённые дорожные работы отменены, их материалы возвращены. Готовые участки сохранены.');return {ok:true,count:roads.length};}

function callCityWorkers(s,kind,hasWork,emptyReason){
 const reason=blocked(s);
 if(reason)return {ok:false,reason};
 if(s.cityLabor?.year===s.year)return {ok:false,reason:'Городской призыв уже использован в этом году'};
 if(!hasWork(s))return {ok:false,reason:emptyReason};
 s.cityLabor={kind,year:s.year,started:s.simTime};
 invalidateAssignments(s);
 syncCitizens(s);
 return {ok:true};
}

export function callHarvestWorkers(s){
 return callCityWorkers(s,'harvest',state=>harvestDemand(state).fields.length,'Нет полей, готовых к жатве или обмолоту');
}

export function callUnloadWorkers(s){
 return callCityWorkers(s,'unload',state=>unloadDemand(state).orders.length,'Нет купленных товаров, ожидающих доставки');
}

export function queueCanalCleaning(s,key){
 const reason=blocked(s);
 if(reason)return {ok:false,reason};
 const b=s.buildings.find(b=>buildingKey(b)===key);
 if(!canalMaintenanceEnabled(s)||b?.type!=='canal'||!isComplete(b)||!(b.silt>0))return {ok:false,reason:'Нужен готовый заиленный канал'};
 if(b.canalCleaning)return {ok:false,reason:'Расчистка уже заказана'};
 b.canalCleaning=true;
 invalidateAssignments(s);
 syncCitizens(s);
 return {ok:true};
}

export function callRepairWorkers(s){
 return callCityWorkers(s,'repair',state=>state.buildings.some(needsCanalCleaning),'Сначала закажи расчистку заиленного канала');
}

export function adoptAutumnCrops(s){
 const reason=blocked(s);
 if(reason)return {ok:false,reason};
 if(!enableAutumnCrops(s))return {ok:false,reason:'Этот календарь уже включён или недоступен в выбранном сценарии'};
 invalidateAssignments(s);
 syncCitizens(s);
 return {ok:true};
}

export function closeReedBed(state,x,y){
 const reason=blocked(state);
 if(reason)return {ok:false,reason};
 return restReeds(state,x,y)?{ok:true}:{ok:false,reason:'Угодье осушено, уже отдыхает или запас полный'};
}

export function closeForestForRest(state,building){
 const reason=blocked(state);
 if(reason)return {ok:false,reason};
 if(building?.type!=='logging'||!state.buildings.includes(building)||!isComplete(building))return {ok:false,reason:'Нужна готовая лесозаготовка'};
 const forest=forestFor(state,building.x,building.y);
 return forest&&restForest(state,forest)?{ok:true}:{ok:false,reason:'Роща недоступна, уже закрыта или запас полный'};
}

export function closeFishingGround(state,building,ground){
 const reason=blocked(state);
 if(reason)return {ok:false,reason};
 if(building?.type!=='fishing'||!state.buildings.includes(building)||!isComplete(building))return {ok:false,reason:'Нужен готовый рыбацкий двор'};
 const origin=networkFor(state).ports.find(p=>p.building===building);
 if(!fisheryOptions(state,origin).some(option=>option.key===ground)||!restFishery(state,ground))return {ok:false,reason:'Участок недоступен, уже закрыт или запас полный'};
 return {ok:true};
}

export function setFieldRest(s,key,rest){
 const reason=blocked(s);
 if(reason)return {ok:false,reason};
 const field=s.buildings.find(b=>buildingKey(b)===key);
 if(!soilCareEnabled(s)||field?.type!=='field'||!isComplete(field)||typeof rest!=='boolean')return {ok:false,reason:'Нужно готовое поле'};
 const year=fieldRestYear(s,field);
 if(rest)field.soil={...field.soil,salt:field.soil?.salt||0,restYear:year};
 else if(field.soil?.restYear===year)delete field.soil.restYear;
 invalidateAssignments(s);
 syncCitizens(s);
 return {ok:true,year};
}

export function setCanalDrain(s,key,drain){
 const reason=blocked(s);
 if(reason)return {ok:false,reason};
 const canal=s.buildings.find(b=>buildingKey(b)===key);
 if(!soilCareEnabled(s)||canal?.type!=='canal'||!isComplete(canal)||typeof drain!=='boolean')return {ok:false,reason:'Нужен готовый канал'};
 if(drain)canal.drain=true;
 else delete canal.drain;
 advanceReedBeds(s);
 return {ok:true};
}

export function assignWorkplace(s,id,key){
 const reason=blocked(s);if(reason)return {ok:false,reason};const c=s.citizens.find(c=>c.id===id);if(!c||!canWork(c))return {ok:false,reason:'Нужен взрослый работник'};
 if(key){const b=s.buildings.find(b=>buildingKey(b)===key);if(!b||!isComplete(b)||!hasWorkplace(b.type))return {ok:false,reason:'Нужна готовая производственная постройка'};
  if(!canStaffBuilding(c,b))return {ok:false,reason:'Не подходит профессия: сначала вдохнови жителя'};
  if(s.citizens.filter(v=>v.id!==id&&v.workplace===key).length>=workplaceCapacity(b.type))return {ok:false,reason:'Все постоянные места заняты'};
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
