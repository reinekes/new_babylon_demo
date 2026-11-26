import {motionRateFor,motionTimeFor} from './calendar.js';
import {clinicPlaces} from './game3d/clinic-contacts.js';
import {routeThroughCourt,serviceExit} from './service-court.js';
import {MIN_CART_LOAD,freightCartCapacity,availableFreightCarts,atFreightCartStand,borrowFreightCart} from './freight-carts.js';
import {extractableCourts,extractionSource,isExtractionCourt} from './extraction-courts.js';
import {availableExtractionSources} from './extraction-stock.js';
import {recordCivicAidReaction} from './resident-reactions.js';
import {recordWaterCrisisDelivery} from './water-crisis.js';
import {appendGrain,takeGrain} from './grain-origin.js';
import {householdAwaitingFamily} from './household-initiative.js';
import {log} from './engine.js';
import {peaceResting} from './peace-discovery.js';
import {cityCommandReason} from './city-command-lock.js';
import {advanceArrivalGroup,arrivalHousing,createArrivalFamily,shelterHome} from './arrival-hospitality.js';
import {deliverShapingLoad,returnShapingLoad} from './shaping-batch.js';
import {advanceShapingModel} from './shaping-model.js';
import {recordSunlightService} from './sunlight-gathering.js';
import {recordAbundanceHome} from './abundance-discovery.js';
import {addGiftFood,giftInputFood,moveGiftFood,takeGiftFood} from './abundance-origin.js';
import {recordWindDelivery} from './wind-delivery.js';
import {markCreatorCargo,acceptCreatorCargo,addCreatorStock,recordCreatorUse} from './creator-materials.js';
import {foodYieldMultiplier,useRichCatch,richCatchCharges,RICH_CATCH_CHARGES} from './rich-catch.js';
import {appendFish,takeFish as takeFishEvidence,recordHomeFish,recordInspiredCatch} from './fish-provenance.js';
import {acceptFieldGrain,recordFieldGrain} from './field-grain.js';
import {recordNeighborFoodFact} from './causal-facts.js';
import {isStrictSumer} from './scenario-profiles.js';
import {availableEveningPlayer,peacefulGame} from './household-games.js';
import {recordVowDelivery} from './supply-vow.js';
import {finishMemorialMove,recordMedicalRecovery} from './life-analytics.js';
import {commonMealWindow,commonMealDay,commonMealAvailable,serveCommonMeal,isMealDepot} from './common-meal.js';
import {advanceFamilyCare} from './family-care.js';
import {receiveVotive,recordVotiveMemory} from './votive-offerings.js';
import {advanceExternalGuest,externalGuestView,visitorsView} from './external-guest.js';
import {orchardMaturity,takeDates} from './orchard-layout.js';
import {takeReeds,advanceReedBeds} from './reed-stock.js';
import {forestFor,takeWood} from './forest-stock.js';
import {takeClay,takeStone} from './mineral-stock.js';
import {takeFish} from './fishery-stock.js';
import {fieldCalendar} from './crop-calendar.js';
import {floodPhase,floodFootprint,floodProtectionRevision,floodedSegment,floodEscapeRoute} from './river-flood.js';
import {fieldResting} from './field-soil.js';
import {needsCanalCleaning,clearCanalSilt} from './canal-maintenance.js';
import {activeLaborKind,planLaborWork,laborCandidates,unloadDemand,UNLOAD_PORTERS} from './city-labor.js';
import {advanceCatDiscovery} from './miracle-discovery.js';
import {returnDryFishingEvidence,recordFishingCatch,moveFishingCargoToOutput,acceptFishingCargo,discardFishingCargo,reconcileCatFishing} from './cat-fishing-ledger.js';
import {beginManualGathering,workManualGathering,manualGatheringStillAssigned,releaseManualGathering} from './manual-gathering.js';
import {ceremonyActive} from './ceremony-time.js';
import {advanceGodhood,godhoodCitizenView,canLeadConstruction,isAwakening,applyBuilderInstruction} from './godhood.js';
import {advanceRelicQuest,relicCitizenView,recoverRelicCitizen} from './relic-quest.js';
import {recordCitizenDelivery,recordCitizenHarvest,recordProfessionEpithet} from './citizen-epithets.js';
import {recordBuildingProduction} from './building-production-history.js';
import {workMusic} from './music.js';
import {canStaffBuilding,workplaceCapacity,hasWorkplace,professionForBuilding,professionRole,innateProfession,residentCareerRoll} from './professions.js';
import {queueGranaryReceipt,workOnAccount} from './scribes.js';
import {canCopyLaw,copyLaw} from './civic-order.js';
import {workDairy} from './dairy.js';
import {advanceFestival,recoverFestivalCitizen,festivalCitizenView} from './festival.js';
import {toolResource,wearWorkTool} from './axe-kit.js';
import {dressingClaim,dressingSeconds} from './harvest-handling.js';
import {GATHERING_TYPES,fishingLandingSeconds,workGathering,advanceGathering} from './labor-life.js';
import {initializeArtisans,isArtisan,artisanNeeds,workArtisan,advanceArtisans,collectArtisan} from './artisan.js';
import {advanceKilns,kilnNeeds,startFiring,collectFired,kilnNeedsRepair,repairKiln} from './kilns.js';
import {addDryFishLot,dryFishLotStock,hangFreshCatch} from './fish-drying.js';
import {initializeBricks,advanceBricks,brickNeeds,formBricks,collectBricks,BRICK_RECIPE} from './bricks.js';
import {initializeWater,advanceWater,waterBusy,recoverWater,resumeWaterAtHome} from './water.js';
import {initializeTextiles,advanceTextiles,gatherWool,weaveCloth,weavingBatch,makeClothing,craftResource,craftState,craftLoad,craftBatch} from './textiles.js';
import {initializeClothing,advanceClothing,equipClothing,REPLACE_CLOTHING_AT} from './clothing.js';
import {stockStores,storeStock,storeCapacity,syncInventory,putStock,putRecoveryStock,takeStock,foodAvailableAt,foodAvailability,warehouseSeedTarget,takeReserved} from './inventory.js';
import {initializeDistricts,syncDistrictJobs,districtPickup,districtExportable,districtReceiptRoom,connectedStores,logisticsDeposit,logisticsRoom,createDistrictPass} from './district-logistics.js';
import {initializeBuildingInventory,collectReadyOutputs,isProductionStore,putProductionOutput,productionOutputFits,outputCapacity,outputRoom} from './building-inventory.js';
import {SEED_COST,seedTarget} from './food-planning.js';
import {advancePests,syncPestSites} from './pests.js';
import {cropFor,workField,advanceCrops,canTillField,fieldActive} from './agriculture.js';
import {fieldWater} from './irrigation.js';
import {medicalLevel,qualifiedHealer,newMedicalSkill,STUDY_SECONDS,healingSpeed,healingQuality,healingCost} from './education.js';
import {initializeWellbeing,advanceWellbeing,workRate,beliefMultiplier,isDinnerTime,mealCycle} from './wellbeing.js';
import {ration,homeMealFood,supplyHome,recordHomeRation,residentsByHome,pantryRestockTarget,PANTRY_LOAD_LIMIT} from './households.js';
import {childPlay} from './local-motion.js';
import {canWork,initializeDemography,lifeStage} from './demography.js';
import {advanceFuneral} from './funerals.js';
import {advanceTradeLogistics,loadSaleCargo} from './trading.js';
import {ensureRoads,roadSegment,roadPace,roadTopologyRevision} from './roads.js';
import {recordFootsteps,residentFootpathPositions,routingTraffic} from './footpaths.js';
import {watchOnDuty,watchOnShift,watchPatrolRoute,watchShift} from './watch-house.js';
import {canDepartForWork,isWorkplaceOpen,residentReturnHour,workHourAt} from './work-schedule.js';
import {isComplete,materialsReady,finishConstruction,orderedSites,constructionEntities,workRequired} from './construction.js';
import {housingPriority,isResidence,BUILDINGS,buildingKey,guardCapacity,capacityOf,levelOf,outputMultiplier,storageOf,isOperational,MATERIALS,citizenName} from './definitions.js';
import {generateStreets,DAY_SECONDS} from './city-life.js';
import {onBridge,isDryPoint} from './world.js';
import {createWalkingNetwork,shortestWalkingPath,nearestWalkingNode,navigationSegmentClear} from './navigation.js';

const caches=new WeakMap();
const hasCargo=c=>Object.values(c.cargo).some(v=>v>0);
const hasBuildCargo=c=>Object.values(c.buildCargo||{}).some(v=>v>0);
export function invalidateAssignments(s){const cache=caches.get(s);if(cache)cache.synced=null;}
function reconcileManualGathering(s,c,ctx){
 if(!c.manualGathering||manualGatheringStillAssigned(s,c))return;
 const moving=['toManualGathering','manualGathering'].includes(c.phase);releaseManualGathering(c);invalidateAssignments(s);
 if(moving)startTrip(s,c,c.home,'toHome',ctx);
}
function beginSiteTrip(s,c,ctx){
 const site=ctx.buildings.get(c.site)?.construction;
 if(s.calendarDaysPerMonth===1&&Object.values(site?.sources?.[c.home]||{}).some(n=>n>0)){
  c.store=c.home;startTrip(s,c,c.store,'toSupply',ctx);return;
 }
 startTrip(s,c,c.siteDuty==='builder'?c.sitePort:c.store,c.siteDuty==='builder'?'toSite':'toSupply',ctx);
}
const hourAt=workHourAt;
export const isWorkday=t=>hourAt(t)>=6&&hourAt(t)<19;
function shiftType(c,ctx){
 if(c.guardPost)return 'guard';
 if(c.site)return 'construction';
 if(c.tradeJob||c.saleJob)return ctx.buildings.get(c.tradeMarket||c.saleMarket)?.type||'market';
 if(c.districtJob)return 'depot';
 return ctx.buildings.get(c.work)?.type;
}
function urgentShift(s,c,ctx){
 const policy=s.cityLabor;
 if(policy&&(policy.kind==='unload'&&c.tradeJob||policy.kind==='harvest'&&ctx.buildings.get(c.work)?.type==='field'||
  policy.kind==='repair'&&(c.site||ctx.buildings.get(c.work)?.type==='canal'))&&activeLaborKind(s))return true;
 if(c.site){
  const site=ctx.buildings.get(c.site);
  if(site?.construction?.kind==='repair'||site?.humanWaterProject||site?.householdInitiative)return true;
 }
 const work=ctx.buildings.get(c.work);
 return work?.type==='healer'||!!(work?.humanWaterProject&&!work.humanWaterProject.delivery);
}
// A paid unloading run that already left the house can finish its market pickup after dusk.
const unloadingAtMarket=(s,c)=>c.phase==='toMarket'&&c.tradeJob&&activeLaborKind(s)==='unload';
function shiftOpen(s,c,ctx){
 const type=shiftType(c,ctx),hour=hourAt(s.simTime);
 return !!unloadingAtMarket(s,c)||hour>=5&&hour<19&&(urgentShift(s,c,ctx)||hour<residentReturnHour(type,c.id));
}
const scheduledArrivals=new Set(['toWork','returnWork','toSite','toSupply','toMarket','toSaleSupply','toDistrictSupply']);
const shiftDeparture=(s,c,ctx)=>canDepartForWork(shiftType(c,ctx),c.id,s.simTime,s)||isWorkday(s.simTime)&&urgentShift(s,c,ctx);
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

const floodGeometry=s=>floodPhase(s)==='active'?`${s.riverFlood.along},${s.riverFlood.bank}:${floodProtectionRevision(s)}`:'';
const geometrySignature=s=>s.buildings.map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||'ready'}:${b.footprint||1}:${b.type==='bridge'?b.level||1:b.type==='cityGate'?b.rotation||0:''}`).join('|')+`|roads:${roadTopologyRevision(s)}|flood:${floodGeometry(s)}`;
const anchorSignature=s=>(s.roadAnchors||[]).map(b=>`${b.type}:${b.x},${b.y}:${b.construction?.kind||'ready'}:${b.footprint||1}:${b.type==='bridge'?b.level||1:''}`).join('|');
const sameWorld=(cache,s)=>cache&&cache.river===s.world?.river&&cache.lakes===s.world?.lakes&&cache.lakeCount===(s.world?.lakes?.length||0);
// Pure cached view for water couriers; never creates roads or warms a new network.
export function cachedStreetsFor(s){const cache=caches.get(s);return sameWorld(cache,s)&&cache.signature===geometrySignature(s)+'|anchors:'+anchorSignature(s)?cache.streets:null;}
export function networkFor(s,{materializeRoads=true}={}){
 const geometry=geometrySignature(s),signature=geometry+'|anchors:'+anchorSignature(s);
 let cache=caches.get(s);
 if(!sameWorld(cache,s)||cache.signature!==signature){
  const reuse=sameWorld(cache,s)&&cache.geometry===geometry,streets=generateStreets([...s.buildings,...s.roadAnchors||[]],s);
  // Entry anchors change streets/ports, not land obstacles or walking costs.
  const network=reuse?{...streets,nodes:cache.network.nodes,graph:cache.network.graph,components:cache.network.components,navigation:cache.network.navigation}:createWalkingNetwork(s,streets,floodGeometry(s)?floodFootprint(s,s.riverFlood):null);
  cache={signature,geometry,streets,river:s.world?.river,lakes:s.world?.lakes,lakeCount:s.world?.lakes?.length||0,network,paths:reuse?cache.paths:new Map(),synced:null};caches.set(s,cache);
 }
 if(materializeRoads&&(cache.roads!==s.roads||cache.roadCount!==s.roads?.length)){ensureRoads(s,cache.network);cache.roads=s.roads;cache.roadCount=s.roads.length;}return cache.network;
}
// Internal callers reuse a validated access context within the same city network.
export function routeBetween(s,from,to,ctx,residentId){
 const network=ctx?.network||networkFor(s),cache=caches.get(s);
 // Stable cohorts notice lightly worn paths at different thresholds. No random
 // draw is needed and a loaded resident makes the same choice.
 const cohort=(residentId||0)%4,snapshot=residentId===undefined||from===to?null:routingTraffic(s);
 const traffic=snapshot?.maxBand>cohort?snapshot:null;
 let paths=cache.paths,key=from+'>'+to,backKey=to+'>'+from;
 if(traffic){
  if(cache.traffic!==traffic){cache.traffic=traffic;cache.residentPaths=new Map();}
  paths=cache.residentPaths;key=cohort+':'+key;backKey=cohort+':'+backKey;
 }
 if(paths.has(key))return paths.get(key);
 // Canonical direction keeps equal-cost ties independent of earlier route
 // requests: a reloaded city chooses the same paths as the running city.
 const reverse=String(from)>String(to),start=reverse?to:from,end=reverse?from:to;
 const usual=traffic?routeBetween(s,start,end,ctx):null;
 const path=shortestWalkingPath(network,start,end,traffic,cohort,usual),result=path&&reverse?[...path].reverse():path;
 paths.set(key,result);paths.set(backKey,result?[...result].reverse():null);return result;
}
export function cachedWalkingRoute(s,from,to){
 return caches.get(s)?.paths.get(from+'>'+to);
}
function context(s){
 const network=networkFor(s),cache=caches.get(s);
 // Access tables and nearest stores depend on topology, not the simulation clock.
 if(cache.context?.roadSource===s.roads&&cache.context.roadCount===s.roads.length){if(cache.context.stores.some(b=>!b.stock)){cache.context.stores=stockStores(s);cache.context.closestStores.clear();}return cache.context;}
 const ports=new Map(network.ports.filter(p=>!p.building.siteKey).map(p=>[buildingKey(p.building),p]));
 for(const p of network.ports.filter(p=>p.building.siteKey))ports.set(`site:${p.building.siteKey}:${p.building.side}`,p);
 const stores=stockStores(s);
 if(!stores.length&&s.buildings.some(b=>isResidence(b)&&isComplete(b)))stores.push(s.buildings.find(b=>isResidence(b)&&isComplete(b)));
 for(const r of s.roads||[])ports.set(r.id,{...r.a,building:r});
 return cache.context={network,ports,stores,roadSource:s.roads,roadCount:s.roads.length,closestStores:new Map(),mealDepots:s.buildings.filter(b=>b.type==='depot'),healers:s.buildings.filter(b=>b.type==='healer'),temples:s.buildings.filter(b=>['shrine','ziggurat'].includes(b.type)),buildings:new Map(constructionEntities(s).map(b=>[buildingKey(b),b]))};
}
function houseDemand(s,ctx,home){if(ctx.foodCitizens!==s.citizens){ctx.foodCitizens=s.citizens;ctx.foodDemand=new Map();for(const c of s.citizens){const key=supplyHome(c);ctx.foodDemand.set(key,(ctx.foodDemand.get(key)||0)+ration(c));}}return ctx.foodDemand.get(home)||0;}
function pantryDeficit(s,ctx,key){
 const dinner=houseDemand(s,ctx,key)*4/3,home=ctx.buildings.get(key);
 if(!home)return 0;
 const stock=s.calendarDaysPerMonth===1?homeMealFood(home):home.pantry||0;
 return Math.max(0,pantryRestockTarget(s,dinner)-stock);
}
function needsReserveTrip(s,ctx,key){
 const deficit=pantryDeficit(s,ctx,key);
 return s.calendarDaysPerMonth===1?deficit+1e-7>=houseDemand(s,ctx,key)*4/3&&deficit>1e-7:deficit>1e-7;
}
function residentsAtHome(s,ctx,home){
 ctx.citizenPass.residentsByHome??=residentsByHome(s.citizens);
 return ctx.citizenPass.residentsByHome.get(home)||[];
}
function hasMealStock(s,ctx){
 const stock=s.resources.food;
 if(stock<=0)return false;
 return s.foodPlan?.protectSeeds===false||stock>(ctx.citizenPass.mealSeedTarget??=seedTarget(s));
}
function invalidateSeedBudget(ctx){
 ctx.citizenPass.mealSeedTarget=undefined;
 ctx.citizenPass.warehouseSeedTarget=undefined;
}
function workFieldWithSeedBudget(s,b,seconds,ctx,worker){
 const crop=cropFor(s,b),seed=crop.seedStock,sown=crop.sown;
 const food=workField(s,b,seconds,worker);
 if(crop.seedStock!==seed||crop.sown!==sown)invalidateSeedBudget(ctx);
 return food;
}
function closestStore(s,ctx,work){
 if(ctx.closestStores.has(work))return ctx.closestStores.get(work);
 const p=ctx.ports.get(work);if(!p)return null;
 let best=null,length=Infinity;
 for(const b of ctx.stores){const key=buildingKey(b),target=ctx.ports.get(key);if(!target)continue;const route=routeBetween(s,p.key,target.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
 ctx.closestStores.set(work,best);return best;
}
function closestStock(s,ctx,origin,k,{seed=false,sources=null,receiving=false}={}){
 const p=ctx.ports.get(origin);if(!p)return null;
 const normalFood=k==='food'&&!seed&&!sources&&!receiving,pass=ctx.citizenPass;
 // A warehouse cannot issue meals when the whole city stock is reserved.
 // Keep the usual reconciliation and route selection whenever food is free.
 if(normalFood&&pass){
  const total=s.resources.food;
  if(total<=1e-8||total<=(pass.warehouseSeedTarget??=warehouseSeedTarget(s))){
   // Reconciliation also clears emptied temporary holders and their routes.
   const permanentStores=pass.permanentStores??=!s.buildings.some(b=>b.stock&&(isResidence(b)||b.recoveryOnly));
   if(permanentStores)return null;
  }
 }
 syncInventory(s);const food=normalFood?foodAvailability(s):null;let best=null,length=Infinity;
 for(const b of stockStores(s)){const key=buildingKey(b),amount=sources?Object.values(sources[key]||{}).reduce((n,v)=>n+v,0):receiving?Math.max(0,storeCapacity(b)-(b.stock?.[k]||0)):food?food.get(key)||0:b.stock?.[k]||0;if(amount<=1e-8||k==='clothing'&&amount<1)continue;const target=ctx.ports.get(key),route=target&&routeBetween(s,p.key,target.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
 return best;
}
function receivingStore(s,ctx,origin,cargo){for(const [k,n]of Object.entries(cargo||{}))if(n>0&&MATERIALS.includes(k)){const key=closestStock(s,ctx,origin,k,{receiving:true});if(key)return key;}return closestStore(s,ctx,origin);}
function localRecoveryStore(s,c){syncInventory(s);const ctx=context(s);let nearest=null,d=Infinity;for(const p of ctx.network.nodes.values()){const n=distance(c,p);if(n<d){d=n;nearest=p;}}const select=buildings=>{let best=null,length=Infinity;for(const b of buildings){const p=ctx.ports.get(buildingKey(b)),route=p&&nearest&&routeBetween(s,nearest.key,p.key,ctx);if(route&&route.length<length){best=buildingKey(b);length=route.length;}}return best;};return select(stockStores(s))||select(s.buildings.filter(b=>isResidence(b)&&isOperational(b)))||select(s.buildings.filter(isOperational));}
function collectCartForLoad(s,c,ctx,source,amount){
 if(amount>=MIN_CART_LOAD&&!c.freightCart)borrowFreightCart(s,c,ctx.buildings.get(source),ctx.ports.get(source));
}
function startTrip(s,c,targetKey,phase,ctx,via=null,considerCart=true){
 if(c.freightCart&&!hasCargo(c)&&!hasBuildCargo(c)&&phase!=='toDistrictSupply'){
  const owner=ctx.buildings.get(c.freightCart);
  if(!freightCartCapacity(owner)||atFreightCartStand(c,owner,ctx.ports.get(c.freightCart))){
   delete c.freightCart;
   if(phase==='toReturnCart'){targetKey=c.home;phase='toHome';invalidateAssignments(s);}
  }else{
   if(c.districtJob){delete c.districtJob;c.store=closestStore(s,ctx,c.home);invalidateAssignments(s);}
   targetKey=c.freightCart;phase='toReturnCart';via=null;
  }
 }
 if(considerCart&&phase==='toDistrictSupply'&&!c.freightCart&&!freightCartCapacity(ctx.buildings.get(targetKey))){
  const order=s.district.jobs.find(q=>q.id===c.districtJob);
  if(order&&order.remaining>=MIN_CART_LOAD&&availableFreightCarts(s,ctx.buildings.get(order.target))){
   targetKey=order.target;phase='toCollectCart';
  }
 }
 const target=ctx.ports.get(targetKey);if(!target){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 const forts=ctx.network.navigation.fortifications;
 const exit=via?null:serviceExit(s,c,ctx);
 const origin=exit?.port||nearestWalkingNode(ctx.network,via||c,forts&&(p=>forts.segmentClear(via||c,p)));
 const route=origin&&routeBetween(s,origin.key,target.key,ctx,c.id);
 const flooded=ctx.network.navigation.flooded;
 if(!route||forts&&via&&!forts.segmentClear(c,via)||flooded&&(via&&floodedSegment(flooded,c,via)||floodedSegment(flooded,via||c,origin))){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
 const approach=routeThroughCourt(s,c,target.building,target,phase,ctx);
 c.route=[{x:c.x,y:c.y},...(exit?.path||[]),...(via?[{x:via.x,y:via.y}]:[]),...route.map(p=>({x:p.x,y:p.y})),...approach];c.routeIndex=1;c.phase=phase;
}
function siteAccess(s,ctx,c,b){
 const home=ctx.ports.get(c.home);if(!home)return null;
 const key=buildingKey(b),targets=b.type==='bridge'||b.type==='cityGate'?[`site:${key}:0`,`site:${key}:1`]:[key];
 for(const target of targets){const p=ctx.ports.get(target);if(!p||!routeBetween(s,home.key,p.key,ctx))continue;
  const store=b.construction?.sources&&Object.values(b.construction.remaining).some(n=>n>0)?closestStock(s,ctx,target,'clay',{sources:b.construction.sources}):closestStore(s,ctx,target);if(store)return {site:key,sitePort:target,store};
 }
 return null;
}
const readyForHousingMove=c=>['home','resting'].includes(c.phase)&&!shelterHome(c)&&!c.rehousing&&!c.pantryTrip&&c.clothingTarget===undefined&&!c.seedField&&!c.craftSite&&!waterBusy(c)&&!hasCargo(c)&&!hasBuildCargo(c);
const readyForPrivateHome=c=>!c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.memorialMove&&readyForHousingMove(c);
export function syncCitizens(s){
 if(s.funeral&&s.funeral.scope!=='family')return;
 initializeBricks(s);initializeArtisans(s);initializeBuildingInventory(s);syncInventory(s);initializeDistricts(s);syncPestSites(s);s.simTime??=s.tick*45;s.citizens??=[];s.deliveries??=0;s.delivered??={food:0,clay:0,reed:0,wood:0,stone:0,hides:0,faith:0,prestige:0};
 const familyHomes=s.population>s.citizens.length?s.buildings.filter(b=>householdAwaitingFamily(s,b)).map(buildingKey):[];
 const ctx=context(s),cache=caches.get(s),laborKind=isWorkday(s.simTime)?activeLaborKind(s):null,signature=`${cache.signature}/${laborKind||''}/${s.population}/${s.calendarDaysPerMonth===1&&s.resources.food<.8*s.population}/${Number(isWorkday(s.simTime))}/${s.season}:${s.arrivalGroup?.home||''}:${s.arrivalGroup?.count||0}:${familyHomes.join('|')}:${s.buildings.filter(b=>b.type==='field').map(b=>Number(fieldActive(s,b))).join('')}/${constructionEntities(s).map(b=>`${b.level||1}:${b.construction?.priority??1}:${b.construction?.order??0}:${b.construction?materialsReady(b.construction):0}:${b.canalCleaning?1:0}`).join(',')}/${s.district.jobs.map(q=>`${q.id}:${q.remaining}`).join(',')}/${(s.trade?.sales||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${(s.trade?.deliveries||[]).map(q=>`${q.id}:${q.remaining}`).join(',')}/${s.citizens.map(c=>`${c.id}:${c.home}:${shelterHome(c)||''}:${canWork(c)}:${c.role||'auto'}:${c.pendingRole||''}:${c.workplace||''}:${c.guardPost||''}`).join(',')}`;
 for(const c of s.citizens)reconcileManualGathering(s,c,ctx);
 if(cache.synced===signature&&!cache.waitingForPrivateHome?.some(readyForPrivateHome))return;
 // Population is a count; stable IDs are never reused after a death.
 while(s.citizens.length>s.population){const c=s.citizens.at(-1);if(recoverCitizenCargo(s,c.id)===false){s.population=s.citizens.length;break;}s.citizens.pop();}
 const available=new Map(s.buildings.filter(b=>isResidence(b)&&isComplete(b)&&!b.campSalvage).sort((a,b)=>housingPriority(a)-housingPriority(b)).map(b=>[buildingKey(b),capacityOf(b)])),homes=[];
 for(const c of s.citizens){if(!available.get(c.home))continue;homes[c.id]=c.home;available.set(c.home,available.get(c.home)-1);}
 const reservations=new Map();
 if(s.arrivalGroup)reservations.set(s.arrivalGroup.home,s.arrivalGroup.count);
 for(const c of s.citizens){
  const shelter=shelterHome(c);
  if(shelter&&shelter!==c.home)reservations.set(shelter,(reservations.get(shelter)||0)+1);
 }
 const flooded=ctx.network.navigation.flooded;
 if(reservations.size||flooded?.size||familyHomes.length){
  // Existing residents keep priority over requests to add population.
  for(const c of s.citizens){
   if(homes[c.id])continue;
   const home=[...available].find(([,beds])=>beds>0)?.[0];
   if(home){homes[c.id]=home;available.set(home,available.get(home)-1);}
  }
  for(const [home,count] of reservations)if(available.has(home))available.set(home,Math.max(0,available.get(home)-count));
  for(const home of familyHomes)available.delete(home);
  if(flooded)for(const home of available.keys())if(flooded.has(home))available.set(home,0);
  const free=[...available.values()].reduce((n,beds)=>n+beds,0);
  s.population=Math.min(s.population,s.citizens.length+free);
 }
 // Families move together during the generational pass. Single adults can take a
 // private bed sooner. A resident with a delivery always finishes it first.
 const camps=new Set(s.buildings.filter(b=>b.reedCamp).map(buildingKey));
 const communalHomes=new Set(s.buildings.filter(b=>b.type==='communalHouse').map(buildingKey));
 const caregivers=communalHomes.size?new Set(s.citizens.filter(c=>c.age<16).flatMap(c=>c.parents||[])):null;
 const privateVacancy=communalHomes.size&&[...available].some(([key,beds])=>beds>0&&!communalHomes.has(key)&&!camps.has(key));
 cache.waitingForPrivateHome=null;
 if(camps.size||privateVacancy)for(const c of s.citizens){
  const current=homes[c.id],inCamp=camps.has(current);
  if(!inCamp&&(!communalHomes.has(current)||c.age<16||c.partner!=null||caregivers.has(c.id)))continue;
  if(!inCamp&&!readyForPrivateHome(c)){
   if(privateVacancy)(cache.waitingForPrivateHome??=[]).push(c);
   continue;
  }
  if(inCamp&&!readyForHousingMove(c))continue;
  const origin=ctx.ports.get(c.home);
  const destination=[...available].find(([key,beds])=>beds>0&&!camps.has(key)&&(inCamp||!communalHomes.has(key))&&!householdAwaitingFamily(s,ctx.buildings.get(key))&&origin&&routeBetween(s,origin.key,ctx.ports.get(key)?.key,ctx))?.[0];
  if(!destination)continue;
  available.set(c.home,(available.get(c.home)||0)+Number(!flooded?.has(c.home)));
  available.set(destination,available.get(destination)-1);
  if(inCamp)ctx.buildings.get(c.home).campVacating=true;
  c.home=homes[c.id]=destination;
  c.rehousing=true;
 }
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
  if(c.freightCart&&!freightCartCapacity(ctx.buildings.get(c.freightCart))){
   delete c.freightCart;
   if(c.phase==='toReturnCart')startTrip(s,c,c.home,'toHome',ctx);
  }
  if(c.pendingRole&&!c.freightCart&&!waterBusy(c)&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.pantryFood&&!c.seedField&&!c.craftSite&&c.clothingTarget===undefined){c.role=c.pendingRole;delete c.pendingRole;recordProfessionEpithet(s,c);}citizens.push(c);
 }
 s.citizens=citizens;initializeDemography(s);initializeWellbeing(s);initializeClothing(s);initializeWater(s);const livingIds=new Set(citizens.map(c=>c.id));for(const c of citizens)if(c.partner!==null&&!livingIds.has(c.partner))c.partner=null;
 for(const c of citizens)if(c.clothingTarget!==undefined&&!citizens.some(p=>p.id===c.clothingTarget&&p.home===c.home))recoverCitizenCargo(s,c.id);
 for(const c of citizens)if(c.rehousing&&!['relic','relicGuest','awakening'].includes(c.phase)){delete c.rehousing;startTrip(s,c,c.home,'toHome',ctx);}
 // District orders retain their endpoints even while a flood closes the route.
 for(const c of citizens){if(c.districtJob)continue;const home=ctx.ports.get(c.home),store=ctx.ports.get(c.store);if(c.store&&!ctx.buildings.has(c.store)||(hasCargo(c)||c.pantryTrip)&&(!store||!home||!routeBetween(s,home.key,store.key,ctx)))c.store=closestStore(s,ctx,c.home);}
 for(const c of citizens)if(c.school&&(!['shrine','ziggurat'].includes(ctx.buildings.get(c.school)?.type)||!isComplete(ctx.buildings.get(c.school))||c.role!=='healer'||medicalLevel(c)>0)){delete c.school;startTrip(s,c,c.home,'toHome',ctx);}
 for(const c of citizens)if(c.workplace&&(!ctx.buildings.has(c.workplace)||!isComplete(ctx.buildings.get(c.workplace))||!canStaffBuilding(c,ctx.buildings.get(c.workplace))))delete c.workplace;
 for(const c of citizens)if(c.guardPost){const b=ctx.buildings.get(c.guardPost);if(!guardCapacity(b?.type)||!isComplete(b)||!canWork(c)||!['auto','production'].includes(c.role))delete c.guardPost;}
 const reserved=new Set(citizens.filter(c=>c.workplace||c.guardPost).map(c=>c.id));
 const assignments=new Map(),locked=new Set(citizens.filter(c=>['festival','relic','relicGuest','awakening'].includes(c.phase)||c.floodShelter||c.fireShelter||c.commonMealTarget||c.memorialMove||!canWork(c)||c.manualGathering||c.pantryTrip||c.clinic||c.school||unloadingAtMarket(s,c)).map(c=>c.id));
 for(const c of citizens)if(c.pantryTrip||waterBusy(c)){
  // A completed construction releases an assignment, even while its worker is fetching water.
  locked.add(c.id);
  if(c.work&&!ctx.buildings.has(c.work))c.work=null;
  if(c.site&&!ctx.buildings.get(c.site)?.construction){c.site=null;c.sitePort=null;c.siteDuty=null;}
 }
 for(const c of citizens)if(!canWork(c)){c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.store=null;}
 if(s.funeral?.scope==='family')for(const a of s.funeral.actors)locked.add(a.id);
 // Keep owned loads and committed trips to construction reserves with their original jobs.
 for(const c of citizens)if((c.freightCart||waterBusy(c)||c.clothingTarget!==undefined||c.craftSite||c.districtJob||c.seedField||c.pantryTrip||s.calendarDaysPerMonth===1&&c.site&&c.phase==='toSupply'||hasCargo(c)||hasBuildCargo(c))&&((!c.work||ctx.buildings.has(c.work))&&(!c.site||ctx.buildings.get(c.site)?.construction))){
  locked.add(c.id);if(c.site){c.siteDuty??='carrier';assignments.set(c.id,{site:c.site,sitePort:c.sitePort,store:c.store,siteDuty:c.siteDuty});}
 }
 const laborAccess=(c,key)=>{
  const home=ctx.ports.get(c.home),port=ctx.ports.get(key);
  return home&&port&&routeBetween(s,home.key,port.key,ctx)?closestStore(s,ctx,key):null;
 };
 const labor=laborKind?planLaborWork(s,laborKind,citizens,ctx.buildings,{locked,reserved,access:laborAccess}):new Map();
 // Keep an existing cleaner on the same physical order through night
 // and the end of the call. Ordinary work rules still send them home.
 const staffedCanals=new Set(citizens.filter(c=>locked.has(c.id)&&needsCanalCleaning(ctx.buildings.get(c.work))).map(c=>c.work));
 for(const assignment of labor.values())if(needsCanalCleaning(ctx.buildings.get(assignment.work)))staffedCanals.add(assignment.work);
 for(const c of citizens){
  if(!['auto','production'].includes(c.role)||locked.has(c.id)||reserved.has(c.id)||labor.has(c.id)||staffedCanals.has(c.work)||!needsCanalCleaning(ctx.buildings.get(c.work)))continue;
  const store=laborAccess(c,c.work);
  if(store){labor.set(c.id,{work:c.work,store});staffedCanals.add(c.work);}
 }
 if(s.calendarDaysPerMonth===1&&s.resources.food<1.6*citizens.length){
  // A burst of construction orders should leave some of the existing food shift intact.
  const staffed=new Set(citizens.filter(c=>locked.has(c.id)&&c.work).map(c=>c.work));
  let remaining=Math.floor(citizens.filter(canWork).length/3);
  for(const c of citizens){
   const b=ctx.buildings.get(c.work);
   if(remaining<=0)break;
   if(!b||!isComplete(b)||!['fishing','hunting','garden','field'].includes(b.type)||b.type==='field'&&!fieldActive(s,b)||
    staffed.has(c.work)||reserved.has(c.id)||locked.has(c.id)||labor.has(c.id))continue;
   const store=laborAccess(c,c.work);
   if(store){labor.set(c.id,{work:c.work,store});staffed.add(c.work);remaining--;}
  }
 }
 for(const id of labor.keys())reserved.add(id);
 const tradeAssignments=new Map();
 if(laborKind==='unload'){
  const candidates=laborCandidates(citizens,ctx.buildings,['auto','carrier'],true);
  const occupied=new Map();
  for(const c of citizens)if(locked.has(c.id)&&(c.tradeMarket||c.saleMarket)){
   const key=c.tradeMarket||c.saleMarket;
   occupied.set(key,(occupied.get(key)||0)+1);
  }
  for(const order of unloadDemand(s).orders){
   const port=ctx.ports.get(order.market);
   const store=port&&closestStore(s,ctx,order.market);
   if(!store)continue;
   let count=occupied.get(order.market)||0;
   const limit=Math.min(UNLOAD_PORTERS,count+Math.ceil(order.remaining/(4+2*levelOf(port.building))));
   const ordered=[...candidates].sort((a,b)=>Number(b.tradeJob===order.id)-Number(a.tradeJob===order.id));
   for(const c of ordered){
    if(count>=limit)break;
    if(reserved.has(c.id)||locked.has(c.id))continue;
    const home=ctx.ports.get(c.home);
    if(!home||!routeBetween(s,home.key,port.key,ctx))continue;
    tradeAssignments.set(c.id,{tradeJob:order.id,tradeMarket:order.market,store});
    reserved.add(c.id);
    count++;
   }
   occupied.set(order.market,count);
  }
 }

 const districtAssignments=new Map(),districtPass=createDistrictPass(s,{network:ctx.network}),routeAssigned=new Map(districtPass.routeOwners);
 districtPass.households=residentsByHome(citizens);
 function assignDistrictFreight(emergency){
  if(isWorkday(s.simTime)&&s.district.jobs.length){
   const order=citizens.filter(c=>['home','working'].includes(c.phase)&&canWork(c)&&!districtAssignments.has(c.id)&&!locked.has(c.id)&&!assignments.has(c.id)&&!tradeAssignments.has(c.id)).sort((a,b)=>Number(!!a.work)-Number(!!b.work)||b.id-a.id);
   const free=[],depotStaff=new Map(),houseSupply=new Map(),freeCursor=new Map(),staffCursor=new Map(),foodCarriersBySource=new Map();
   for(const c of order){
    if(c.workplace&&ctx.buildings.get(c.workplace)?.type==='depot'){
     if(!depotStaff.has(c.workplace))depotStaff.set(c.workplace,[]);
     depotStaff.get(c.workplace).push(c);
    }else if(!reserved.has(c.id)&&['auto','carrier'].includes(c.role)&&(c.phase!=='working'||c.role==='auto'&&!c.workplace))free.push(c);
   }
   const dinner=0.8*citizens.length;
   const transferPriority=q=>{
    if(q.remaining<=1e-8||!['food','milk'].includes(q.resource))return 2;
    const home=ctx.buildings.get(q.target);
    if(q.targetKind==='input'&&isResidence(home)&&homeMealFood(home)+1e-7<houseDemand(s,ctx,q.target)*4/3)return 0;
    const producer=ctx.buildings.get(q.source);
    if(!isProductionStore(producer))return 2;
    // Leave time for the subsequent warehouse-to-home leg before the reserve runs out.
    const filling=(producer.workshopStock?.output?.[q.resource]||0)>=outputCapacity(producer)/2;
    return s.resources.food<2*dinner||s.resources.food<4*dinner&&filling?1:2;
   };
   const queues=s.calendarDaysPerMonth===1?[[],[],[]]:[s.district.jobs];
   if(queues.length===3)for(const q of s.district.jobs)queues[transferPriority(q)].push(q);
   for(const q of emergency?queues[0].concat(queues[1]):queues.flat()){
    if(q.remaining<=1e-8||q.targetKind!=='votive'&&(districtReceiptRoom(s,q,ctx.buildings.get(q.target),districtPass)<=1e-8||districtExportable(s,q,districtPass)<=1e-8)||!connectedStores(s,q.source,q.target,districtPass))continue;
    const pair=q.source+'>'+q.target,source=ctx.ports.get(q.source);
    let n=routeAssigned.get(pair)||0;
    if(n>=2||!source)continue;
    const food=s.calendarDaysPerMonth===1&&['food','milk'].includes(q.resource);
    const owners=districtPass.owners.get(q.id)||[];
    const waiting=food?owners.filter(c=>!hasCargo(c)).length:0;
    const limit=food?Math.min(2,n+Math.max(0,Math.ceil(q.remaining/6)-waiting)):2;
    if(n>=limit)continue;
    // Order, home food decisions, and routes stay fixed during this assignment
    // pass. Resume at the next candidate when another order shares the source.
    function assignFrom(list,cursors,key){
     let i=cursors.get(key)||0;
     for(;i<list.length&&n<limit;i++){
      const c=list[i],home=ctx.ports.get(c.home);
      if(districtAssignments.has(c.id)||!home||!routeBetween(s,home.key,source.key,ctx))continue;
      if(c.phase==='home'){
       if(!houseSupply.has(c.home)){const house=ctx.buildings.get(c.home);houseSupply.set(c.home,!!(house&&homeMealFood(house)<houseDemand(s,ctx,c.home)*4/3&&closestStock(s,ctx,c.home,'food')));}
       if(houseSupply.get(c.home))continue;
      }
      districtAssignments.set(c.id,{districtJob:q.id,store:q.source,target:q.target,source:q.source});
      reserved.add(c.id);n++;
     }
     cursors.set(key,i);
    }
    const staff=depotStaff.get(q.target);if(staff)assignFrom(staff,staffCursor,pair);
    if(n<limit){
     if(food&&!foodCarriersBySource.has(q.source)){
      foodCarriersBySource.set(q.source,[...free].sort((a,b)=>distance(a,source)-distance(b,source)||a.id-b.id));
     }
     assignFrom(food?foodCarriersBySource.get(q.source):free,freeCursor,food?'food:'+q.source:q.source);
    }
    routeAssigned.set(pair,n);
   }
  }
 }
 if(s.calendarDaysPerMonth===1&&s.resources.food<.8*citizens.length)assignDistrictFreight(true);
 for(const b of orderedSites(s)){
  const key=buildingKey(b),q=b.construction;
  const project=q.kind==='new'?b.humanWaterProject:null;
  const family=q.kind==='new'?b.householdInitiative:null;
  // Before the first store opens, household courtyards hold construction supplies.
  const sourceKeys=Object.keys(q.sources||{});
  const localCrew=s.calendarDaysPerMonth===1&&!project&&!family&&sourceKeys.some(key=>isResidence(ctx.buildings.get(key)));
  const supplyHomes=localCrew?new Set(sourceKeys.filter(key=>isResidence(ctx.buildings.get(key))&&Object.values(q.sources[key]).some(n=>n>0))):null;
  for(const duty of ['carrier','builder']){
   if(duty==='carrier'&&!Object.values(q.remaining).some(n=>n>0))continue;
   let n=[...assignments.values()].filter(a=>a.site===key&&a.siteDuty===duty).length;
   const rank=c=>{
    if(project){
     if(duty==='builder'&&c.id===project.organizerId)return -2;
     if(project.participantIds?.includes(c.id))return -1;
    }
    if(family?.members.includes(c.id))return -1;
    if(localCrew)return c.role===duty?0:supplyHomes.has(homes[c.id])?1:2;
    return c.role===duty?0:c.site===key&&c.siteDuty===duty?1:c.work?3:2;
   };
   const candidates=[...citizens].sort((first,second)=>rank(first)-rank(second)||
    (localCrew?distance(first,b)-distance(second,b):0)||first.id-second.id);
   for(const c of candidates){if(n>=2)break;if(duty==='carrier'&&c.id===project?.organizerId||reserved.has(c.id)||locked.has(c.id)||assignments.has(c.id)||!['auto',duty].includes(c.role))continue;
    // Automatic workers deliver first, rather than leaving scarce carriers idle.
    if(duty==='builder'&&!canLeadConstruction(s,c,b))continue;
    if(duty==='builder'&&c.role==='auto'&&!materialsReady(q)){
     const needed=localCrew?supplyHomes.has(homes[c.id]):[...assignments.values()].some(a=>a.site===key&&a.siteDuty==='carrier');
     if(!needed)continue;
    }
    const access=siteAccess(s,ctx,{...c,home:homes[c.id]},b);if(access){assignments.set(c.id,{...access,siteDuty:duty});n++;}
   }
  }
 }
 const jobsQueue=[...(s.trade?.deliveries||[]).map(q=>({q,sale:false})),...(s.trade?.sales||[]).map(q=>({q,sale:true}))].sort((a,b)=>a.q.id-b.q.id);
 for(const {q,sale} of jobsQueue){if(q.remaining<=0)continue;if(!sale&&laborKind==='unload')continue;if(sale&&s.trade.caravan?.id!==q.caravanId)continue;const market=ctx.ports.get(q.market),store=sale&&q.sources?closestStock(s,ctx,q.market,q.resource,{sources:q.sources}):closestStore(s,ctx,q.market);if(!market||!store)continue;
  let assigned=citizens.filter(c=>locked.has(c.id)&&(c.tradeMarket||c.saleMarket)===q.market).length+[...tradeAssignments.values()].filter(a=>(a.tradeMarket||a.saleMarket)===q.market).length;
  for(const c of [...citizens].sort((a,b)=>Number(!!a.work)-Number(!!b.work)||b.id-a.id)){if(assigned>=2)break;if(reserved.has(c.id)||locked.has(c.id)||assignments.has(c.id)||tradeAssignments.has(c.id)||!['auto','carrier'].includes(c.role)||!routeBetween(s,ctx.ports.get(c.home)?.key,market.key,ctx))continue;const home=ctx.buildings.get(c.home);if(c.phase==='home'&&home&&homeMealFood(home)<houseDemand(s,ctx,c.home)*4/3&&closestStock(s,ctx,c.home,'food'))continue;tradeAssignments.set(c.id,{...sale?{saleJob:q.id,saleMarket:q.market}:{tradeJob:q.id,tradeMarket:q.market},store});assigned++;}
 }
 assignDistrictFreight(false);
 if(isWorkday(s.simTime)&&laborKind!=='repair'){
  const candidates=s.buildings.some(needsCanalCleaning)?laborCandidates(citizens,ctx.buildings):[];
  for(const b of s.buildings.filter(needsCanalCleaning)){
   const key=buildingKey(b);
   if(citizens.some(c=>c.work===key&&locked.has(c.id)))continue;
   const worker=candidates.find(c=>!locked.has(c.id)&&!reserved.has(c.id)&&!assignments.has(c.id)&&!tradeAssignments.has(c.id)&&!districtAssignments.has(c.id)&&laborAccess(c,key));
   if(worker){labor.set(worker.id,{work:key,store:laborAccess(worker,key)});reserved.add(worker.id);}
  }
 }
 const priority={waterpoint:-.5,pottery:1,brewery:1,bakery:1,linenYard:1,dairyStore:1,basketry:1,matYard:1,coppersmith:1,joineryYard:1,kiln:1,brickyard:1,tailor:1,sheepfold:1,weaver:1,depot:-.5,granary:5,healer:-1,field:0,garden:1,fishing:1,hunting:1,clay:2,reed:3,logging:3,quarry:3,shrine:4,ziggurat:5,musicHouse:6};
 const jobs=s.buildings.filter(b=>isComplete(b)&&hasWorkplace(b.type)&&(b.type!=='garden'||orchardMaturity(s,b).yield>0)&&(!['clay','quarry'].includes(b.type)||availableExtractionSources(s,b).length)).sort((a,b)=>priority[a.type]-priority[b.type]);
 // Map order retains the stable workplace priority. Once a job fills, later
 // workers in this pass cannot take any of its seats.
 const workplaces=new Map(),automatic=new Map();
 for(const b of jobs){
  const key=buildingKey(b),job={key,building:b,remaining:workplaceCapacity(b.type)};
  workplaces.set(key,job);
  if(!['depot','musicHouse','granary'].includes(b.type)&&(b.type!=='field'||fieldActive(s,b)))automatic.set(key,job);
 }
 const byHome=new Map();
 function automaticJobs(home){
  if(s.calendarDaysPerMonth!==1)return automatic.values();
  if(!byHome.has(home)){
   const p=ctx.ports.get(home);
   byHome.set(home,p?[...automatic.values()].sort((a,b)=>distance(p,a.building)-distance(p,b.building)):[]);
  }
  return byHome.get(home);
 }
 function reserveSeat(key){
  const job=workplaces.get(key);
  if(!job?.remaining)return;
  job.remaining--;
  if(!job.remaining)automatic.delete(key);
 }
 for(const c of citizens)if(locked.has(c.id)&&c.work&&!c.guardPost)reserveSeat(c.work);
 // Keep the promised seat while a pinned worker finishes an earlier delivery.
 for(const c of citizens)if(locked.has(c.id)&&c.workplace&&c.workplace!==c.work)reserveSeat(c.workplace);
 for(const assignment of labor.values())reserveSeat(assignment.work);
 for(const c of [...citizens].sort((a,b)=>Number(!!b.workplace)-Number(!!a.workplace))){
  if(locked.has(c.id))continue;
  const oldDistrict=c.districtJob;const oldSale=c.saleJob;const oldTrade=c.tradeJob;delete c.districtJob;const oldHome=c.home,oldWork=c.work,oldStore=c.store,oldSite=c.site,oldPort=c.sitePort,oldDuty=c.siteDuty;c.home=homes[c.id];c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;
  const assignment=assignments.get(c.id)||labor.get(c.id);
  if(c.guardPost){const p=ctx.ports.get(c.guardPost),home=ctx.ports.get(c.home),store=closestStore(s,ctx,c.guardPost);if(p&&home&&store&&routeBetween(s,home.key,p.key,ctx)){c.work=c.guardPost;c.store=store;}else c.store=closestStore(s,ctx,c.home);}
  else if(assignment)Object.assign(c,assignment);
  else if(tradeAssignments.has(c.id))Object.assign(c,tradeAssignments.get(c.id));
  else if(districtAssignments.has(c.id)){const {target,source,...job}=districtAssignments.get(c.id);Object.assign(c,job);}
  else{
   const p=ctx.ports.get(c.home);
   if(['auto','production','healer','tailor','watercarrier','carrier'].includes(c.role)){
    const candidates=c.workplace?[workplaces.get(c.workplace)]:automaticJobs(c.home);
    for(const job of candidates){
     if(!job?.remaining||!canStaffBuilding(c,job.building))continue;
     const work=job.key,workPort=ctx.ports.get(work),store=closestStore(s,ctx,work);
     if(workPort&&store&&routeBetween(s,p.key,workPort.key,ctx)){
      reserveSeat(work);c.work=work;c.store=store;break;
     }
    }
   }
   if(!c.work)c.store=closestStore(s,ctx,c.home);
  }
  if(oldDistrict!==c.districtJob||oldSale!==c.saleJob||oldTrade!==c.tradeJob||oldHome!==c.home||oldWork!==c.work||oldStore!==c.store||oldSite!==c.site||oldPort!==c.sitePort||oldDuty!==c.siteDuty){
   c.workElapsed=0;
   if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
   else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
   else if(Object.values(c.buildCargo).some(n=>n>0)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
   else if(c.phase!=='home'&&c.phase!=='resting'){
    if(c.districtJob&&shiftOpen(s,c,ctx))startTrip(s,c,c.store,'toDistrictSupply',ctx);
    else if(c.saleJob&&shiftOpen(s,c,ctx))startTrip(s,c,c.store,'toSaleSupply',ctx);
    else if(c.tradeJob&&shiftOpen(s,c,ctx))startTrip(s,c,c.tradeMarket,'toMarket',ctx);
    else if(c.site&&shiftOpen(s,c,ctx))beginSiteTrip(s,c,ctx);
    else startTrip(s,c,c.home,'toHome',ctx);
   }
  }
 }
 s.citizens=citizens;reconcileCatFishing(s);advanceGathering(s);cache.synced=signature;
}

function workshopIncoming(s,key,k){return (s.district?.jobs||[]).filter(q=>q.target===key&&q.resource===k).reduce((n,q)=>n+q.remaining+s.citizens.filter(c=>c.districtJob===q.id).reduce((a,c)=>a+(c.cargo?.[k]||0),0),0);}
function harvest(s,c,ctx,via=null){
 const b=ctx.buildings.get(c.work);if(!b)return false;
 const produced=(goods,options)=>{if(!putProductionOutput(s,b,goods,options))return false;recordCitizenHarvest(s,c,goods);if(b.type==='fishing'){
  const amount=goods.food||0,before=(b.workshopStock.output.food||0)-amount;
  recordFishingCatch(s,b,c,amount,{inBuffer:true,before});
  if(s.richCatchEvidence)appendFish(b,'fishOutput',[amount],before);
  recordInspiredCatch(s,b,c,amount);
  hangFreshCatch(s,b,amount);
  useRichCatch(s,b,amount);
 }return true;};
 if(b.type==='kiln'){const amount=collectFired(b);if(amount>0){return produced({firedBrick:amount},{record:false});}if(kilnNeedsRepair(b))repairKiln(b);else startFiring(b);return false;}
 if(b.type==='brickyard'){const amount=collectBricks(b);if(amount>0){return produced({brick:amount},{record:false});}formBricks(b);return false;}
 if(['sheepfold','weaver','tailor'].includes(b.type)){const kind=b.type==='sheepfold'?'wool':b.type==='weaver'?'cloth':'clothing',amount=b.type==='sheepfold'?gatherWool(s,b):b.type==='weaver'?weaveCloth(s,b):makeClothing(s,b);if(amount<=1e-8)return false;return produced({[kind]:amount});}
 if(b.type==='field'){
  const before=cropFor(s,b).humanSheaves||0,prefix=b.workshopStock?.output?.food||0;
  const food=workFieldWithSeedBudget(s,b,BUILDINGS.field.workTime,ctx,c);
  if(food>0){
   if(produced({food})){
    appendGrain(b,'grainOutput',[{field:buildingKey(b),amount:food,end:food}],prefix);
    recordFieldGrain(s,b,c,Math.min(food,before),prefix);
   }
   if(!fieldActive(s,b))invalidateAssignments(s);
  }else c.workElapsed=0;
  return food>0;
 }
 const def=BUILDINGS[b.type],boost=s.buffs||{},source=via?.source||extractionSource(b);c.cargo={};
 for(const [resource,base]of Object.entries(def.output)){
  let mult=outputMultiplier(b);
  if(resource==='food')mult*=foodYieldMultiplier(s,b)*(b.type==='garden'?orchardMaturity(s,b).yield:1);
  if(resource==='clay'||resource==='reed')mult*=boost.inspiration?1.75:1;
  if(resource==='faith'||resource==='prestige')mult*=boost.sunlight?1.8:1;if(resource==='faith')mult*=beliefMultiplier(s);
  const amount=b.type==='reed'&&resource==='reed'?takeReeds(s,source.x,source.y,base*mult):b.type==='logging'&&resource==='wood'?takeWood(s,forestFor(s,source.x,source.y),base*mult):b.type==='clay'&&resource==='clay'?takeClay(s,source.x,source.y,base*mult):b.type==='quarry'&&resource==='stone'?takeStone(s,source.x,source.y,base*mult):b.type==='garden'&&via?.source?takeDates(s,source,base*mult):b.type==='fishing'&&resource==='food'&&via?.fishery?takeFish(s,via.fishery,base*mult):base*mult;
  if(amount<=1e-8)continue;
  c.cargo[resource]=amount;if(!MATERIALS.includes(resource))recordBuildingProduction(s,b,resource,amount);
 }
 if(toolResource(b)&&hasCargo(c))wearWorkTool(b);
 if(c.cargo.faith>0&&c.calling==='priest')recordSunlightService(s,b,c);
 if(['clay','quarry'].includes(b.type)&&!availableExtractionSources(s,b).length)invalidateAssignments(s);
 if(['fishing','clay','quarry','logging','reed','garden'].includes(b.type)&&!hasCargo(c))return false;
 if(isProductionStore(b)){if(via){
  // The target has already yielded this load. Returning to the local shed is
  // transport, even if New Year or a save/reload happens while it is carried.
  if(via.prey){const kill=s.gathering.kills.find(k=>k.id===via.prey);if(kill){kill.taken=true;kill.hauler=c.id;}}
  for(const [resource,amount]of Object.entries(c.cargo))recordBuildingProduction(s,b,resource,amount);
  recordCitizenHarvest(s,c,c.cargo);if(b.type==='fishing'){recordFishingCatch(s,b,c,c.cargo.food||0);
   if(via.bite){const charges=richCatchCharges(s,b);c.fishingLanding={target:via.bite,elapsed:0,firstBlessed:charges===RICH_CATCH_CHARGES,blessed:charges>0};}
   useRichCatch(s,b,c.cargo.food||0);if(s.richCatchEvidence){
   appendFish(c,'fishCargo',[c.cargo.food||0],0);
   if(c.calling==='fisher'&&c.fishCargo)c.inspiredFishReturn=c.work;
  }}startTrip(s,c,c.work,'toWorkshop',ctx,via);return true;
 }const goods=c.cargo;c.cargo={};return produced(goods);}
 startTrip(s,c,c.store,'toStore',ctx,via);return true;
}
function deposit(s,c,ctx){
 const dryJob=s.lastFishLotId&&c.districtJob&&s.district.jobs.find(q=>q.id===c.districtJob&&q.fishLot);
 if(dryJob&&!dryJob.targetKind){
  const granary=ctx.buildings.get(dryJob.target),amount=c.cargo.food;
  if(granary?.type!=='granary'||!amount)return false;
  addDryFishLot(granary,dryJob.fishLot,amount);
  acceptFishingCargo(s,c,amount,amount,{qualifies:true});
  granary.lastFishReceipt={...dryJob.fishLot,amount,carrier:c.id,at:s.simTime};
  dryJob.delivered+=amount;
  recordWindDelivery(s,c,dryJob,amount);
  s.deliveries++;s.delivered.food=(s.delivered.food||0)+amount;
  recordCitizenDelivery(s,c,{food:amount});
  s.lastDelivery={time:s.simTime,citizen:c.id,store:c.store,cargo:{food:amount}};
  c.cargo={};return true;
 }
 if(c.shapingLoad){
  const resource=c.shapingLoad.resource,job=s.district.jobs.find(q=>q.id===c.districtJob);
  const accepted=deliverShapingLoad(s,c,c.store);
  if(job)job.delivered+=accepted;
  if(accepted>0){s.delivered[resource]=(s.delivered[resource]||0)+accepted;s.deliveries++;recordCitizenDelivery(s,c,{[resource]:accepted});}
  return !c.shapingLoad;
 }

 let delivered=0;const actual={},stored={};
 for(const [resource,amount]of Object.entries(c.cargo)){
  const destination=c.districtJob&&s.district.jobs.find(q=>q.id===c.districtJob),site=destination&&s.buildings.find(b=>buildingKey(b)===c.store),local=destination&&site&&(destination.targetKind==='votive'||destination.targetKind==='input'||!stockStores(s).includes(site));const accepted=MATERIALS.includes(resource)?local?destination.targetKind==='votive'?receiveVotive(s,destination,c,amount):logisticsDeposit(s,c.store,resource,amount,destination.targetKind):putStock(s,c.store,resource,amount):amount;
  if(c.windCargo)recordWindDelivery(s,c,destination,accepted);
  if(local&&destination.targetKind==='input'&&(resource==='food'||resource==='milk'))recordVowDelivery(s,site,c,accepted);
  if(!local&&accepted>0&&MATERIALS.includes(resource))stored[resource]=accepted;
  if(c.creatorCargo){const tagged=acceptCreatorCargo(s,c,resource,accepted);if(tagged&&!local)addCreatorStock(ctx.buildings.get(c.store),resource,tagged);}
  if(resource==='food'){
   let gift=0;
   if(c.giftCargo){
    const receiver=local?site:ctx.buildings.get(c.store),home=local&&isResidence(site);
    const remaining=home?receiver.pantry:local?giftInputFood(receiver):receiver?.stock?.food||0;
    gift=moveGiftFood(c,'giftCargo',receiver,home?'giftHome':local?'giftInput':'giftStock',accepted,amount,remaining-accepted);
   }
   const grain=takeGrain(c,'grainCargo',accepted,amount);
   if(!local){
    const store=ctx.buildings.get(c.store);
    appendGrain(store,'grainStock',grain,(store?.stock?.food||0)-accepted);
   }else if(destination.targetKind==='input'&&isResidence(site)){
    appendGrain(site,'grainPantry',grain,site.pantry-accepted);
   }
   if(dryJob&&local&&isResidence(site)&&accepted>0){
    site.lastFishRation={...dryJob.fishLot,granary:dryJob.source,amount:accepted,carrier:c.id,at:s.simTime};
    recordHomeFish(s,site,[accepted],c);
   }
   if(local&&destination.targetKind==='input'){recordAbundanceHome(s,site,c,ctx.buildings.get(destination.source),accepted,gift);recordHomeRation(s,site,c,accepted,destination.source,grain);}
   acceptFishingCargo(s,c,accepted,amount,{qualifies:!local&&!c.tradeJob&&!c.saleJob});acceptFieldGrain(s,c,accepted,!local,local&&destination.targetKind==='input'&&isResidence(site)?site:null);
   if(c.fishCargo){
    const parts=takeFishEvidence(c,'fishCargo',accepted,amount),store=ctx.buildings.get(c.store);
    if(!local)appendFish(store,'fishStock',parts,(store?.stock?.food||0)-accepted);
    else if(destination.targetKind==='input')recordHomeFish(s,site,parts,c);
    if(!c.fishCargo)delete c.inspiredFishReturn;
   }
  }
  if(!MATERIALS.includes(resource))s.resources[resource]=(s.resources[resource]||0)+accepted;if(!local)s.delivered[resource]=(s.delivered[resource]||0)+accepted;if(c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q){const before=q.delivered;q.delivered+=accepted;if(s.civicOrder?.case?.aid===q.id)recordCivicAidReaction(s,q,before);if(s.waterCrises)recordWaterCrisisDelivery(s,q);}}c.cargo[resource]-=accepted;if(c.cargo[resource]<1e-8)delete c.cargo[resource];if(c.tradeJob){const q=s.trade?.deliveries.find(q=>q.id===c.tradeJob);if(q){q.delivered=Math.min(q.amount,q.delivered+accepted);if(Math.abs(q.amount-q.delivered)<1e-7)q.delivered=q.amount;}}actual[resource]=accepted;delivered+=accepted;
 }
 if(delivered>0){recordCreatorUse(s,ctx.buildings.get(c.store));queueGranaryReceipt(s,ctx.buildings.get(c.store),c,stored);recordCitizenDelivery(s,c,actual);s.deliveries++;s.lastDelivery={time:s.simTime,citizen:c.id,store:c.store,cargo:actual,...c.tradeJob?{source:'market'}:{}};}
 return !hasCargo(c);
}
function returnFromCommonMeal(s,c,ctx){
 delete c.commonMealTarget;delete c.commonMealUntil;
 if(c.work&&shiftOpen(s,c,ctx)&&ctx.ports.has(c.work))startTrip(s,c,c.work,'returnWork',ctx);
 else startTrip(s,c,c.home,'toHome',ctx);
}

function visitCommonMeal(s,c,ctx){
 if(!ctx.mealDepots.length||!commonMealWindow(s.simTime)||c.commonMealDay===commonMealDay(s.simTime)||c.age<16||c.guardPost||c.clinic||c.school||c.site||c.craftSite||c.seedField||c.pantryTrip||c.waterTrip||c.districtJob||c.saleJob||c.tradeJob||c.clothingTarget!==undefined||hasCargo(c)||hasBuildCargo(c))return false;
 const work=ctx.ports.get(c.work),home=ctx.ports.get(c.home);
 if(!work||!home||distance(work,home)<3)return false;
 let target=null,length=8;
 for(const b of ctx.mealDepots){
  if(!isMealDepot(b))continue;
  const port=ctx.ports.get(buildingKey(b)),route=port&&routeBetween(s,work.key,port.key,ctx);
  if(route&&route.length<length&&commonMealAvailable(s,b)){target=b;length=route.length;}
 }
 if(!target)return false;
 c.commonMealTarget=buildingKey(target);
 startTrip(s,c,c.commonMealTarget,'toCommonMeal',ctx);
 if(c.phase==='blocked'){returnFromCommonMeal(s,c,ctx);return false;}
 return true;
}

function arrival(s,c,ctx){
 c.route=[];c.routeIndex=0;
 if(c.phase==='toCollectCart'){
  const order=s.district.jobs.find(q=>q.id===c.districtJob);
  if(order?.remaining>0&&shiftOpen(s,c,ctx)){
   if(order.remaining>=MIN_CART_LOAD)borrowFreightCart(s,c,ctx.buildings.get(order.target),ctx.ports.get(order.target));
   startTrip(s,c,order.source,'toDistrictSupply',ctx,null,false);
  }else{delete c.districtJob;c.store=closestStore(s,ctx,c.home);invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}
  return;
 }
 if(c.phase==='toReturnCart'){
  delete c.freightCart;invalidateAssignments(s);
  if(c.site&&ctx.buildings.get(c.site)?.construction&&shiftOpen(s,c,ctx))beginSiteTrip(s,c,ctx);
  else startTrip(s,c,c.home,'toHome',ctx);
  return;
 }
 if(c.phase==='toEveningGame'){c.phase='eveningGuest';return;}
 if(c.phase==='toCommonMeal'){
  if(serveCommonMeal(s,c,ctx.buildings.get(c.commonMealTarget))){c.phase='commonMeal';c.commonMealUntil=s.simTime+1;}
  else returnFromCommonMeal(s,c,ctx);
  return;
 }
 if(c.phase==='toManualGathering'){c.phase='manualGathering';return;}
 if(c.phase==='toWorkshop'){const b=ctx.buildings.get(c.work);if(b&&putProductionOutput(s,b,c.cargo,{record:false})){moveFishingCargoToOutput(s,b,c,c.cargo.food||0,(b.workshopStock.output.food||0)-(c.cargo.food||0),c.cargo.food||0);if(c.fishCargo){
  const amount=c.cargo.food||0;
  appendFish(b,'fishOutput',takeFishEvidence(c,'fishCargo',amount,amount),b.workshopStock.output.food-amount);
  recordInspiredCatch(s,b,c,amount,{inspired:c.inspiredFishReturn===buildingKey(b)});
  delete c.inspiredFishReturn;
 }if(b.type==='fishing'&&hangFreshCatch(s,b,c.cargo.food||0))c.hangingFishElapsed=0;
 const game=dressingClaim(s,c);if(game){delete game.hauler;c.workElapsed=0;}c.cargo={};c.phase='working';if(!isWorkday(s.simTime))startTrip(s,c,c.home,'toHome',ctx);}else if(!b){c.store=receivingStore(s,ctx,c.home,c.cargo);startTrip(s,c,c.store,'toStore',ctx);}return;}
 if(c.phase==='toClothesSupply'){
  const target=s.citizens.find(p=>p.id===c.clothingTarget&&p.home===c.home),amount=target&&target.clothing<=REPLACE_CLOTHING_AT&&storeStock(s,c.store,'clothing')>=1?takeStock(s,c.store,'clothing',1):0;
  if(amount===1){c.clothingLoad=1;startTrip(s,c,c.home,'toClothesHome',ctx);}else{delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
 }
 if(c.phase==='toClothesHome'){
  const target=s.citizens.find(p=>p.id===c.clothingTarget&&p.home===c.home);if(target&&c.clothingLoad===1)equipClothing(target);else if(c.clothingLoad)putStock(s,c.store,'clothing',c.clothingLoad,{overflow:true});delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);c.phase='home';return;
 }
 if(c.phase==='toCraftSupply'){
  const b=ctx.buildings.get(c.craftSite),k=c.craftMaterial||craftResource(b),buffer=craftState(b),incoming=s.citizens.filter(p=>p.id!==c.id&&p.craftSite===c.craftSite&&(!c.craftMaterial||p.craftMaterial===k)).reduce((n,p)=>n+craftLoad(p),0)+workshopIncoming(s,c.craftSite,k),need=b?.type==='kiln'?Math.max(0,(kilnNeeds(b)[k]||0)-incoming):isArtisan(b)?Math.max(0,(artisanNeeds(b)[k]||0)-incoming):buffer?Math.max(0,(b.type==='brickyard'?BRICK_RECIPE[k]:craftBatch(b))-buffer[k]-incoming):0,amount=takeStock(s,c.store,k,Math.min(3,need,k==='food'?foodAvailableAt(s,c.store):Infinity),{giftTo:c,giftKey:'giftCraft'});
  if(amount>1e-8){if(['brickyard','kiln'].includes(b.type)||isArtisan(b))c.craftAmount=amount;else if(b.type==='tailor')c.craftCloth=amount;else c.craftWool=amount;startTrip(s,c,c.craftSite,'toWork',ctx);}else{delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
 }
 if(c.craftSite&&c.phase==='toWork'){const b=ctx.buildings.get(c.craftSite),k=c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool');const buffer=craftState(b),load=craftLoad(c);if(buffer){moveGiftFood(c,'giftCraft',b,'giftInput',load,load,buffer[k]);buffer[k]+=load;}else putStock(s,c.store,k,load,{overflow:true,gift:c.giftCraft});delete c.giftCraft;delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;invalidateAssignments(s);}
 if(c.phase==='toDistrictSupply'){
  const q=s.district.jobs.find(q=>q.id===c.districtJob);
  let amount=0;
  if(q&&shiftOpen(s,c,ctx)){
   collectCartForLoad(s,c,ctx,q.source,q.remaining);
   amount=districtPickup(s,c);
  }
  if(amount>0){
   startTrip(s,c,q.target,'toDistrictStore',ctx);return;
  }
  delete c.districtJob;c.store=closestStore(s,ctx,c.home);invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toDistrictStore'){if(!deposit(s,c,ctx)){c.phase='unloading';return;}delete c.districtJob;c.store=closestStore(s,ctx,c.home);invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;}
 if(c.seedField&&c.phase==='toStore'){const b=ctx.buildings.get(c.seedField),crop=b?.type==='field'?cropFor(s,b):null;const incoming=s.citizens.filter(p=>p.id!==c.id&&p.seedField===c.seedField).reduce((n,p)=>n+(p.seedFood||0),0),need=crop?Math.max(0,SEED_COST-crop.seedUsed-crop.seedStock-incoming):0,stock=storeStock(s,c.store,'food'),amount=Math.min(6,need,stock);invalidateSeedBudget(ctx);if(amount>1e-8){c.seedFood=takeStock(s,c.store,'food',amount,{giftTo:c,giftKey:'giftSeed'});startTrip(s,c,c.seedField,'toWork',ctx);}else{delete c.seedField;delete c.seedFood;startTrip(s,c,c.home,'toHome',ctx);}return;}
 if(c.seedField&&c.phase==='toWork'){const b=ctx.buildings.get(c.seedField);const amount=c.seedFood||0;if(b?.type==='field'){const crop=cropFor(s,b);moveGiftFood(c,'giftSeed',b,'giftSeedStock',amount,amount,crop.seedStock);crop.seedStock+=amount;}else putStock(s,c.store,'food',amount,{overflow:true,gift:c.giftSeed});invalidateSeedBudget(ctx);delete c.giftSeed;delete c.seedField;delete c.seedFood;invalidateAssignments(s);}
 if(c.phase==='toHome'){finishMemorialMove(s,c);c.phase='home';if(s.district?.jobs.some(q=>q.remaining>1e-7))invalidateAssignments(s);return;}
 if(c.phase==='toSchool'){c.phase='studying';return;}
 if(c.phase==='toHealer'){c.phase='treatment';return;}
 if(c.phase==='toRest'){c.phase='resting';return;}
 if(c.phase==='toPantrySupply'){
  const target=c.pantryTarget||c.home;
  const inTransit=s.citizens.filter(p=>p.pantryTrip&&(p.pantryTarget||p.home)===target).reduce((n,p)=>n+(p.pantryFood||0),0);
  const limit=s.calendarDaysPerMonth===1?Math.min(PANTRY_LOAD_LIMIT,Math.max(8,houseDemand(s,ctx,target)*4/3)):6;
  const amount=Math.min(limit,Math.max(0,pantryDeficit(s,ctx,target)-inTransit),foodAvailableAt(s,c.store));
  if(amount>1e-8){
   const before=storeStock(s,c.store,'food');
   c.pantryFood=takeStock(s,c.store,'food',amount,{fishTo:c,fishKey:'fishPantry',giftTo:c,giftKey:'giftPantry',grainTo:c,grainKey:'grainPantry'});
   if(c.pantryFood>0){
    c.pantryOrigin=c.store;
    c.pantryRemainder=Math.max(0,before-c.pantryFood);
    startTrip(s,c,target,'toPantryHome',ctx);
    return;
   }
  }
  delete c.pantryTrip;delete c.pantryFood;delete c.pantryOrigin;delete c.pantryRemainder;delete c.pantryTarget;
  startTrip(s,c,c.home,hasCargo(c)?'toRest':'toHome',ctx);
  return;
 }
 if(c.phase==='toPantryHome'){
  const target=c.pantryTarget||c.home,b=ctx.buildings.get(target),amount=c.pantryFood||0;if(b){b.pantry=(b.pantry||0)+amount;b.pantryDelivered=(b.pantryDelivered||0)+amount;const grain=takeGrain(c,'grainPantry',amount,amount);
   appendGrain(b,'grainPantry',grain,b.pantry-amount);
   recordHomeRation(s,b,c,amount,c.pantryOrigin??null,grain);recordCitizenDelivery(s,c,{food:amount});recordVowDelivery(s,b,c,amount);recordNeighborFoodFact(s,c,b,amount);
   const gift=moveGiftFood(c,'giftPantry',b,'giftHome',amount,amount,b.pantry-amount);
   recordAbundanceHome(s,b,c,ctx.buildings.get(c.store),amount,gift);
   if(c.fishPantry)recordHomeFish(s,b,takeFishEvidence(c,'fishPantry',amount,amount),c);
  }else{
   const accepted=putStock(s,c.store,'food',amount,{overflow:true}),store=ctx.buildings.get(c.store);
   appendGrain(store,'grainStock',takeGrain(c,'grainPantry',accepted,amount),(store?.stock?.food||0)-accepted);
   moveGiftFood(c,'giftPantry',store,'giftStock',accepted,amount,(store?.stock?.food||0)-accepted);
   if(c.fishPantry)appendFish(store,'fishStock',takeFishEvidence(c,'fishPantry',accepted,amount),(store?.stock?.food||0)-accepted);
  }
  delete c.fishPantry;delete c.giftPantry;
  delete c.pantryTrip;delete c.pantryFood;delete c.pantryOrigin;delete c.pantryRemainder;delete c.pantryTarget;if(target!==c.home)startTrip(s,c,c.home,hasCargo(c)?'toRest':'toHome',ctx);else c.phase=hasCargo(c)?'resting':'home';return;
 }
 if(c.phase==='toSaleSupply'){
  const q=s.trade?.sales?.find(q=>q.id===c.saleJob),market=ctx.buildings.get(c.saleMarket);
  if(q&&market&&shiftOpen(s,c,ctx)){
   const stock=q.sources?.[c.store],food=stock?.food;
   collectCartForLoad(s,c,ctx,c.store,Math.min(q.remaining,stock?.[q.resource]??q.remaining));
   const limit=(4+2*(market.level||1))*(c.freightCart?2:1),batch=Math.min(q.remaining,limit);
   const amount=q.sources?takeReserved(s,q.sources,c.store,q.resource,batch):batch;
   if(q.giftReserve?.[c.store]){moveGiftFood(q.giftReserve,c.store,c,'giftCargo',amount,food,0);if(!Object.keys(q.giftReserve).length)delete q.giftReserve;}
   q.remaining-=amount;c.cargo={[q.resource]:amount};
   if(amount>0){startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);return;}
  }
  c.saleJob=null;c.saleMarket=null;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toSaleMarket'){
  if(!loadSaleCargo(s,c)){c.phase='blocked';return;}startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toMarket'){
  const q=s.trade?.deliveries.find(q=>q.id===c.tradeJob),market=ctx.buildings.get(c.tradeMarket);
  if(q&&market&&shiftOpen(s,c,ctx)){
   collectCartForLoad(s,c,ctx,c.tradeMarket,q.remaining);
   const limit=(4+2*(market.level||1))*(c.freightCart?2:1),amount=Math.min(q.remaining,limit);
   moveGiftFood(q,'giftFood',c,'giftCargo',amount,q.remaining,0);q.remaining-=amount;c.cargo={[q.resource]:amount};
   if(amount>0){startTrip(s,c,c.store,'toStore',ctx);return;}
  }
  c.tradeJob=null;c.tradeMarket=null;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);return;
 }
 if(c.phase==='toSupply'){
  const q=ctx.buildings.get(c.site)?.construction;
  if(!q){startTrip(s,c,c.home,'toHome',ctx);return;}
  if(!shiftOpen(s,c,ctx)){if(s.calendarDaysPerMonth!==1)startTrip(s,c,c.home,'toHome',ctx);return;}
  const k=MATERIALS.find(k=>q.remaining[k]>0&&(!q.sources||(q.sources[c.store]?.[k]||0)>0));
  if(k){
   if(c.siteDuty==='carrier')collectCartForLoad(s,c,ctx,c.store,Math.min(q.remaining[k],q.sources?.[c.store]?.[k]??q.remaining[k]));
   let room=c.freightCart?12:6;
   c.buildCargo={};
   for(const material of s.calendarDaysPerMonth===1?MATERIALS:[k]){
    if(room<=0)break;
    if(q.remaining[material]<=0||q.sources&&!(q.sources[c.store]?.[material]>0))continue;
    const batch=Math.min(room,q.remaining[material]);
    const amount=q.sources?takeReserved(s,q.sources,c.store,material,batch):batch;
    q.remaining[material]-=amount;c.buildCargo[material]=amount;room-=amount;
   }
  }else{const next=q.sources&&closestStock(s,ctx,c.sitePort,'clay',{sources:q.sources});if(next){c.store=next;startTrip(s,c,next,'toSupply',ctx);}else c.phase='waiting';return;}
  startTrip(s,c,c.sitePort,'toSite',ctx);return;
 }
 if(c.phase==='toSite'){
  const q=ctx.buildings.get(c.site)?.construction;
  if(!q){startTrip(s,c,c.home,'toHome',ctx);return;}
  for(const [k,n]of Object.entries(c.buildCargo))q.delivered[k]+=n;c.buildCargo={};invalidateAssignments(s);
  if(c.freightCart){startTrip(s,c,c.freightCart,'toReturnCart',ctx);return;}
  if(!shiftOpen(s,c,ctx))startTrip(s,c,c.home,'toHome',ctx);
  else if(c.siteDuty==='builder'&&materialsReady(q))c.phase='constructing';
  else if(c.siteDuty!=='builder'&&Object.values(q.remaining).some(n=>n>0)){c.store=q.sources?closestStock(s,ctx,c.sitePort,'clay',{sources:q.sources}):c.store;startTrip(s,c,c.store,'toSupply',ctx);}
  else c.phase='waiting';return;
 }
 if(c.phase==='toStore'){
  if(!deposit(s,c,ctx)){c.phase='unloading';return;}if(c.tradeJob){c.tradeJob=null;c.tradeMarket=null;}invalidateAssignments(s);
  if(shiftOpen(s,c,ctx)&&c.site)beginSiteTrip(s,c,ctx);else if(shiftOpen(s,c,ctx)&&c.work)startTrip(s,c,c.work,'returnWork',ctx);else startTrip(s,c,c.home,'toHome',ctx);
  return;
 }
 c.phase='working';c.workElapsed=0;if(c.role==='auto'&&!c.workplace&&s.district?.jobs.some(q=>q.remaining>1e-7))invalidateAssignments(s);
}
// Interrupt work only when the resident can take a real route and has no
// material order in hand. Existing pantry logistics retain stock provenance.
function criticalFoodTrip(s,c,ctx){
 if(!isStrictSumer(s)||(c.hunger??0)<70||!['working','constructing','toWork','returnWork'].includes(c.phase)||
  !canWork(c)||c.guardPost||c.clinic||c.school||c.manualGathering||c.pantryTrip||c.craftSite||
  c.clothingTarget!==undefined||c.districtJob||c.tradeJob||c.saleJob||c.seedField||hasCargo(c)||hasBuildCargo(c))return false;
 const home=ctx.buildings.get(c.home);
 if(!home)return false;
 const hasMeal=homeMealFood(home)+1e-7>=ration(c)*4/3;
 if(hasMeal&&s.calendarDaysPerMonth===1)return false;
 const store=hasMeal?null:closestStock(s,ctx,c.home,'food');
 if(!hasMeal&&(!store||s.citizens.some(p=>p.pantryTrip&&(p.pantryTarget||p.home)===c.home)))return false;
 const draft={...c};
 startTrip(s,draft,hasMeal?c.home:store,hasMeal?'toHome':'toPantrySupply',ctx);
 if(draft.phase==='blocked')return false;
 c.route=draft.route;c.routeIndex=draft.routeIndex;c.phase=draft.phase;
 if(store){c.store=store;c.pantryTrip=true;c.pantryFood=0;}
 return true;
}
// A household's next meal takes precedence over elective care/study. This also
// permits a late returning worker to fetch dinner, keeping their other load.
function urgentHouseholdSupply(s,c,ctx){
 if(!['home','resting'].includes(c.phase)||!canWork(c)||c.clinic||c.school||c.pantryTrip||c.craftSite||c.clothingTarget!==undefined||c.districtJob||c.tradeJob||c.saleJob||c.seedField||hasBuildCargo(c)||c.phase==='home'&&hasCargo(c))return false;
 const b=ctx.buildings.get(c.home);if(!b)return false;
 let needed=houseDemand(s,ctx,c.home)*4/3;
 if(isDinnerTime(s.simTime)){const cycle=mealCycle(s.simTime);needed=Math.max(0,needed-residentsAtHome(s,ctx,c.home).reduce((n,p)=>n+(p.mealDay===cycle?p.mealEaten||0:0),0));}
 if((b.pantry||0)+(b.householdStock?.milk||0)*.5+1e-7>=needed||s.citizens.some(p=>p.pantryTrip&&(p.pantryTarget||p.home)===c.home))return false;
 const store=closestStock(s,ctx,c.home,'food');if(!store)return false;
 c.store=store;c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,store,'toPantrySupply',ctx);return true;
}
function dependentHouseholds(s,ctx){
 if(ctx.dependentCitizens!==s.citizens){
  const families=new Map();for(const p of s.citizens){if(!families.has(p.home))families.set(p.home,[]);families.get(p.home).push(p);}
  ctx.dependentHomes=s.buildings.filter(b=>isResidence(b)&&isComplete(b)).map(b=>({building:b,residents:families.get(buildingKey(b))||[]})).filter(h=>h.residents.length&&!h.residents.some(canWork));ctx.dependentCitizens=s.citizens;
 }
 return ctx.dependentHomes;
}
function neighborHouseholdSupply(s,c,ctx){
 const dependent=dependentHouseholds(s,ctx);if(!dependent.length)return false;
 if(c.phase!=='home'||!canWork(c)||c.health<=20||c.clinic||c.school||c.pantryTrip||c.craftSite||c.clothingTarget!==undefined||c.districtJob||c.tradeJob||c.saleJob||c.seedField||hasCargo(c)||hasBuildCargo(c))return false;
 const own=ctx.buildings.get(c.home);if(!own||homeMealFood(own)+1e-7<houseDemand(s,ctx,c.home)*4/3)return false;
 const homePort=ctx.ports.get(c.home);if(!homePort)return false;
 let best=null,bestStore=null,length=Infinity;
 for(const {building:b,residents} of dependent){
  const target=buildingKey(b);if(s.citizens.some(p=>p.pantryTrip&&(p.pantryTarget||p.home)===target))continue;
  const needed=residents.reduce((n,p)=>n+(isDinnerTime(s.simTime)?Math.max(0,ration(p)*4/3-(p.mealDay===mealCycle(s.simTime)?p.mealEaten||0:0)):ration(p)*4/3),0);
  if((b.pantry||0)+(b.householdStock?.milk||0)*.5+1e-7>=needed)continue;
  const port=ctx.ports.get(target),route=port&&routeBetween(s,homePort.key,port.key,ctx),store=route&&closestStock(s,ctx,target,'food');
  if(store&&route.length<length){best=target;bestStore=store;length=route.length;}
 }
 if(!best)return false;
 c.pantryTarget=best;c.store=bestStore;c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,bestStore,'toPantrySupply',ctx);return true;
}
function waitForHomeMeal(s,c,ctx){
 if(!['home','resting'].includes(c.phase)||c.pantryTrip||c.waterTrip||c.craftSite||c.clothingTarget!==undefined||c.districtJob||c.tradeJob||c.saleJob||c.seedField||hasBuildCargo(c))return false;
 const house=ctx.buildings.get(c.home),food=(house?.pantry||0)+(house?.householdStock?.milk||0)*.5,portion=ration(c)*4/3;
 if(food<=1e-8)return false;
 // Finish the real meal before leaving on another chore. A severely hungry
 // resident with a portion at home also rests until dinner instead of making
 // an optional long refill that repeatedly misses the eating window.
 const dining=isDinnerTime(s.simTime)&&(c.mealDay!==mealCycle(s.simTime)||c.mealEaten+1e-7<portion);
 const waiting=dining||c.hunger>=70&&(c.missedMeals>0||isStrictSumer(s))&&food+1e-7>=portion;
 // Working loads are retained at home in the established resting phase;
 // wellbeing deliberately refuses to dine in a cargo-bearing home phase.
 if(waiting&&c.phase==='home'&&hasCargo(c))c.phase='resting';
 return waiting;
}
// Saved indoor positions use the house's street access point for evacuation.
function fireShelterDoor(c,ctx,host){
 for(const key of [c.home,host]){
  const house=ctx.buildings.get(key);
  if(isResidence(house)&&Math.abs(c.x-house.x)<.47&&Math.abs(c.y-house.y)<.47)return ctx.ports.get(key);
 }
}
function fireShelterTrip(s,c,target,ctx,door){
 if(!door)return startTrip(s,c,target,'toHome',ctx);
 const {x,y}=c;
 c.x=door.x;c.y=door.y;
 startTrip(s,c,target,'toHome',ctx);
 if(!c.route.length)Object.assign(c,{x,y});
}
export function evacuateFireHome(s,kiln,home){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 const source=s.buildings.find(b=>buildingKey(b)===home);
 if(!isStrictSumer(s)||!kiln?.kilnFire||!s.buildings.includes(kiln)||!isResidence(source)||
  Math.max(Math.abs(kiln.x-source.x),Math.abs(kiln.y-source.y))>1)return {ok:false,reason:'Нужен жилой двор рядом с активным очагом'};
 const family=s.citizens.filter(c=>c.home===home);
 if(!family.length||family.some(c=>!['home','resting'].includes(c.phase)||c.floodShelter||c.fireShelter||
  hasCargo(c)||hasBuildCargo(c)||c.waterTrip||c.pantryTrip||c.site||c.clinic||c.school||c.craftSite||
  c.seedField||c.manualGathering||c.tradeJob||c.saleJob||c.districtJob||c.memorialMove||c.commonMealTarget||c.clothingTarget!==undefined))
  return {ok:false,reason:'Дождись, пока все жители вернутся домой и сдадут грузы'};
 const ctx=context(s),fires=s.buildings.filter(b=>b.kilnFire);
 const safe=arrivalHousing(s).filter(row=>{
  const b=ctx.buildings.get(row.home);
  return row.beds>=family.length&&s.citizens.some(c=>c.home===row.home&&!c.fireShelter&&!c.floodShelter)&&
   fires.every(fire=>Math.max(Math.abs(fire.x-b.x),Math.abs(fire.y-b.y))>1);
 });
 for(const {home:host} of safe){
  const routes=family.map(c=>{const traveler={...c};fireShelterTrip(s,traveler,host,ctx,fireShelterDoor(c,ctx,host));return traveler;});
  if(routes.some(c=>c.phase==='blocked'))continue;
  family.forEach((c,i)=>{
   c.fireShelter={host,kiln:buildingKey(kiln)};
   const {x,y,route,routeIndex}=routes[i];
   Object.assign(c,{x,y,phase:'blocked',route,routeIndex});
  });
  ctx.foodCitizens=null;invalidateAssignments(s);
  return {ok:true};
 }
 return {ok:false,reason:'Нужен безопасный соседний дом с местами и открытым проходом'};
}
function advanceFireShelter(s,c,dt,ctx){
 const shelter=c.fireShelter;
 if(!shelter)return false;
 const homeFlooded=ctx.network.navigation.flooded?.has(c.home);
 if(homeFlooded&&shelter.returning){
  delete shelter.returning;c.route=[];c.routeIndex=0;ctx.foodCitizens=null;
 }
 const goingHome=!homeFlooded&&(shelter.returning||!ctx.buildings.get(shelter.kiln)?.kilnFire);
 const door=fireShelterDoor(c,ctx,shelter.host);
 if(goingHome&&!shelter.returning||!c.route.length||door){
  const {route,routeIndex}=c;
  fireShelterTrip(s,c,goingHome?c.home:shelter.host,ctx,door);
  c.phase='blocked';
  if(!c.route.length){c.route=route;c.routeIndex=routeIndex;return true;}
  if(goingHome)shelter.returning=true;
 }
 const wasWalking=c.routeIndex<c.route.length;
 let travel=dt*motionRateFor(s)*1.05;
 while(travel>1e-8&&c.routeIndex<c.route.length){
  const next=c.route[c.routeIndex],length=distance(c,next),flooded=ctx.network.navigation.flooded;
  if(!navigationSegmentClear(s,c,next,ctx.network.navigation.obstacles)||flooded&&floodedSegment(flooded,c,next)){
   c.route=[];c.routeIndex=0;return true;
  }
  if(length<=travel){c.x=next.x;c.y=next.y;c.routeIndex++;travel-=length;}
  else{c.x+=(next.x-c.x)*travel/length;c.y+=(next.y-c.y)*travel/length;break;}
 }
 if(c.routeIndex>=c.route.length){
  if(shelter.returning){
   delete c.fireShelter;c.phase='home';c.route=[];c.routeIndex=0;ctx.foodCitizens=null;invalidateAssignments(s);
  }else if(wasWalking){
   const family=s.citizens.filter(p=>p.home===c.home&&p.fireShelter?.host===shelter.host&&p.fireShelter.kiln===shelter.kiln);
   if(family.every(p=>supplyHome(p,{arrived:true})===shelter.host)){
    const host=s.citizens.find(p=>p.home===shelter.host&&p.age>=16&&!p.fireShelter&&!p.floodShelter&&['home','resting'].includes(p.phase));
    const title=host?`${citizenName(host.id)} принял семью из двора ${c.home}`:`Двор ${shelter.host} принял семью из двора ${c.home}`;
    log(s,title,`Жильцы двора ${c.home} дошли до укрытия в доме ${shelter.host} · ${family.length} чел.`,'good');
   }
  }
 }
 return true;
}
function advanceFloodShelter(s,c,dt,ctx){
 const flooded=ctx.network.navigation.flooded;
 if(!flooded){
  if(c.floodShelter){
   delete c.floodShelter;ctx.foodCitizens=null;
   c.route=[];c.routeIndex=0;
   if(!hasCargo(c)&&!hasBuildCargo(c)&&!c.pantryTrip&&!c.seedField&&!c.craftSite&&c.clothingTarget===undefined&&!c.clinic&&!c.school&&!c.districtJob&&!c.tradeJob&&!c.saleJob)startTrip(s,c,c.home,'toHome',ctx);
  }
  return false;
 }
 if(c.fireShelter&&!flooded.has(c.fireShelter.host)&&!floodedSegment(flooded,c,c))return false;
 if(c.floodShelter&&!ctx.buildings.has(c.floodShelter)){delete c.floodShelter;ctx.foodCitizens=null;}
 if(!c.floodShelter){
  const refuge=c.fireShelter?.host||c.home;
  if(!floodedSegment(flooded,c,c)&&!flooded.has(refuge))return false;
  const cache=caches.get(s);
  if(!cache.evacuation){
   const normal=createWalkingNetwork(s,cache.streets);
   const shelters=new Map(),houses=new Set();
   for(const [key,port] of ctx.ports){
    const b=ctx.buildings.get(key);
    if(b&&['house','communalHouse','shrine'].includes(b.type)&&isOperational(b)&&!flooded.has(`${b.x},${b.y}`)&&ctx.network.nodes.has(port.key)){
     if(isResidence(b))houses.add(port.key);
     if(isResidence(b)||!shelters.has(port.key))shelters.set(port.key,key);
    }
   }
   cache.evacuation={normal,shelters,houses,paths:new Map()};
  }
  const {normal,shelters,houses,paths}=cache.evacuation;
  const inWater=floodedSegment(flooded,c,c);
  const start=nearestWalkingNode(inWater?normal:ctx.network,c);
  if(!start||!navigationSegmentClear(s,c,start,normal.navigation.obstacles)||!inWater&&floodedSegment(flooded,c,start))return false;
  if(!paths.has(start.key))paths.set(start.key,floodEscapeRoute(normal,ctx.network,start.key,houses)||floodEscapeRoute(normal,ctx.network,start.key,shelters));
  const route=paths.get(start.key);
  if(!route)return false;
  delete c.fireShelter;
  c.floodShelter=shelters.get(route.at(-1).key);ctx.foodCitizens=null;c.phase='blocked';c.route=route.map(({x,y})=>({x,y}));c.routeIndex=0;
 }
 let travel=dt*motionRateFor(s)*1.05;
 while(travel>1e-8&&c.routeIndex<c.route.length){
  const next=c.route[c.routeIndex],length=distance(c,next);
  if(!navigationSegmentClear(s,c,next,ctx.network.navigation.obstacles)||!floodedSegment(flooded,c,c)&&floodedSegment(flooded,c,next)){delete c.floodShelter;ctx.foodCitizens=null;c.route=[];c.routeIndex=0;return true;}
  if(length<=travel){c.x=next.x;c.y=next.y;c.routeIndex++;travel-=length;}
  else{c.x+=(next.x-c.x)*travel/length;c.y+=(next.y-c.y)*travel/length;break;}
 }
 return true;
}
const eveningVisitCheck=new WeakMap();
function scheduleEveningVisit(s,ctx){
 const hour=hourAt(s.simTime),second=Math.floor(s.simTime);
 if(!isStrictSumer(s)||hour<21||hour>=23||eveningVisitCheck.get(s)===second)return;
 eveningVisitCheck.set(s,second);
 const day=mealCycle(s.simTime);
 if(s.buildings.some(b=>b.eveningGame?.day===day&&b.eveningGame.guestHome))return;
 const eligible=s.citizens.filter(c=>{
  const home=ctx.buildings.get(c.home);
  return isResidence(home)&&home.eveningGame?.day!==day&&peacefulGame(s,home)&&availableEveningPlayer(c,s.simTime,day,c.home);
 });
 const tryVisit=(host,guest)=>{
  if(!host||!guest||guest.home===host.home||Math.abs(guest.x-host.x)+Math.abs(guest.y-host.y)>4)return false;
  const from=ctx.ports.get(guest.home),to=ctx.ports.get(host.home),route=from&&to&&routeBetween(s,from.key,to.key,ctx);
  if(!route||route.length>5)return false;
  const saved={phase:guest.phase,route:guest.route,routeIndex:guest.routeIndex};
  startTrip(s,guest,host.home,'toEveningGame',ctx);
  if(guest.phase!=='toEveningGame'){Object.assign(guest,saved);return false;}
  ctx.buildings.get(host.home).eveningGame={day,players:[host.id,guest.id],guestHome:guest.home,startedAt:s.simTime,status:'waiting'};
  return true;
 };
 const welcomes=s.arrivalHospitality?.welcomes;
 if(welcomes?.length){
  const byId=new Map(eligible.map(c=>[c.id,c]));
  for(let i=welcomes.length-1;i>=0;i--){
   const {host,dispute}=welcomes[i];
   if(dispute?.choice==='queue'&&tryVisit(byId.get(host),byId.get(dispute.guest)))return;
  }
 }
 for(const host of eligible)for(const guest of eligible)if(tryVisit(host,guest))return;
}
export function residentWalkingSpeed(s,c,buildings,road,position=c){
 let speed=motionRateFor(s)*1.05*(s.buffs?.haste?1.5:1)*roadPace(road);
 if(!c.pantryTrip&&c.phase!=='toHome'&&c.phase!=='toRest'){
  const duty=c.siteDuty==='builder'?'builder':c.siteDuty==='carrier'||c.districtJob||c.tradeJob||c.saleJob?'carrier':c.work?buildings.get(c.work)?.type:null;
  speed*=workRate(c,duty,buildings.get(c.home));
 }
 if(onBridge(s.buildings,position.x,position.y,s)){
  const bridge=s.buildings.find(b=>b.type==='bridge'&&Math.abs(b.y+.5-position.y)<.16);
  speed*=1+((bridge?.level||1)-1)*.25;
 }
 return speed;
}
function advanceCitizen(s,c,dt,ctx,constructionWork,fishingTimerRate){
 reconcileManualGathering(s,c,ctx);
 if(c.phase==='festival'||advanceFloodShelter(s,c,dt,ctx)||advanceFireShelter(s,c,dt,ctx)){
  if(c.fishingLanding)delete c.fishingLanding;
  if(c.hangingFishElapsed!==undefined)delete c.hangingFishElapsed;
  return;
 }
 if(c.hangingFishElapsed!==undefined){
  if(c.phase==='working'&&ctx.buildings.get(c.work)?.fishRack?.batch){
   const hold=Math.min(dt,(1.5-c.hangingFishElapsed)/fishingTimerRate);c.hangingFishElapsed+=hold*fishingTimerRate;dt-=hold;
   if(c.hangingFishElapsed<1.5-1e-8)return;
  }
  delete c.hangingFishElapsed;
 }
 if(c.fishingLanding){
  const q=c.fishingLanding;
  if(c.phase==='toWorkshop'&&c.cargo.food>0&&!c.floodShelter&&!c.fireShelter){
   const hold=Math.min(dt,Math.max(0,fishingLandingSeconds(q)-q.elapsed)/fishingTimerRate);q.elapsed+=hold*fishingTimerRate;dt-=hold;
   if(q.elapsed+1e-8<fishingLandingSeconds(q))return;
  }
  delete c.fishingLanding;
 }
 if(['toEveningGame','eveningGuest'].includes(c.phase)){
  const game=s.buildings.find(b=>b.eveningGame?.guestHome===c.home&&b.eveningGame.players[1]===c.id&&['waiting','playing'].includes(b.eveningGame.status))?.eveningGame;
  if(!game||!availableEveningPlayer(c,s.simTime,game.day,c.home,['toEveningGame','eveningGuest']))startTrip(s,c,c.home,'toHome',ctx);
  else if(c.phase==='eveningGuest')return;
 }
 if(c.memorialMove&&c.phase==='blocked'){startTrip(s,c,c.home,'toHome',ctx);if(c.phase==='blocked')return;}
 if(c.commonMealTarget){
  if(c.phase==='commonMeal'&&s.simTime<c.commonMealUntil)return;
  if(c.phase!=='toCommonMeal'||!commonMealWindow(s.simTime)||!isMealDepot(ctx.buildings.get(c.commonMealTarget)))returnFromCommonMeal(s,c,ctx);
 }
 if(c.districtJob&&!hasCargo(c)&&['home','resting'].includes(c.phase)){const b=ctx.buildings.get(c.home),canRefill=homeMealFood(b)+1e-7<houseDemand(s,ctx,c.home)*4/3&&closestStock(s,ctx,c.home,'food');if(canRefill||!isWorkday(s.simTime)){delete c.districtJob;c.store=closestStore(s,ctx,c.home);invalidateAssignments(s);}}
 if(criticalFoodTrip(s,c,ctx)||waitForHomeMeal(s,c,ctx))return;
 if(!urgentHouseholdSupply(s,c,ctx))neighborHouseholdSupply(s,c,ctx);
 const departed=canDepartForWork(undefined,c.id,s.simTime,s),day=isWorkday(s.simTime)||departed;if(c.health>=(c.careGoal||85)){delete c.recovering;delete c.careGoal;}
 if(c.clinic){const clinic=ctx.buildings.get(c.clinic);if(!day||!clinic||!isComplete(clinic)||c.health>=(c.careGoal||85)){delete c.clinic;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}else if(c.phase==='treatment')return;else if(c.phase==='blocked'){startTrip(s,c,c.clinic,'toHealer',ctx);if(c.phase==='blocked')return;}}
 if(!c.clinic&&c.phase==='home'&&day&&(c.health<60||c.recovering)&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.seedField&&!c.pantryTrip&&!c.saleJob&&!c.tradeJob&&ctx.buildings.get(c.work)?.type!=='healer'){
  const home=ctx.ports.get(c.home);let best=null,length=Infinity;
  for(const {building:b,key,staff,patients} of ctx.care?.values()||[]){const port=ctx.ports.get(key);if(!port||patients.length>=1+(b.level||1)||!staff)continue;const route=routeBetween(s,home?.key,port.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
  if(best){c.careGoal=healingQuality(ctx.care.get(best).staff);c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.workElapsed=0;c.recovering=true;c.clinic=best;ctx.care.get(best).patients.push(c);startTrip(s,c,best,'toHealer',ctx);invalidateAssignments(s);}
 }

 if(c.school){if(!day||c.role!=='healer'||!ctx.buildings.has(c.school)){delete c.school;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}else if(c.phase==='blocked')startTrip(s,c,c.school,'toSchool',ctx);}
 if(!c.school&&!c.clinic&&departed&&canWork(c)&&c.role==='healer'&&!medicalLevel(c)&&c.phase==='home'&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.pantryTrip&&!c.tradeJob&&!c.saleJob){
  const home=ctx.ports.get(c.home);let best=null,length=Infinity;
  for(const b of ctx.temples){if(!isComplete(b))continue;const key=buildingKey(b),port=ctx.ports.get(key),route=port&&routeBetween(s,home?.key,port.key,ctx);if(route&&route.length<length){best=key;length=route.length;}}
  if(best){c.work=null;c.site=null;c.sitePort=null;c.siteDuty=null;c.school=best;startTrip(s,c,best,'toSchool',ctx);invalidateAssignments(s);}
 }
 // Like outgoing caravan goods, an already collected purchase completes its trip
 // after sunset. If the receiver is full, the owner can still rest with the load.
 if(!day&&!(c.tradeJob&&c.phase==='toStore')&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.seedField&&!c.pantryTrip&&!c.saleJob&&!hasBuildCargo(c)&&hasCargo(c)&&['toStore','unloading','blocked'].includes(c.phase))startTrip(s,c,c.home,'toRest',ctx);
 if(c.phase==='resting'){if((day||hourAt(s.simTime)>=19&&hourAt(s.simTime)<20)&&!c.saleJob&&hasMealStock(s,ctx)&&needsReserveTrip(s,ctx,c.home)&&!s.citizens.some(p=>p.pantryTrip&&(p.pantryTarget||p.home)===c.home)){c.store=closestStock(s,ctx,c.home,'food');if(c.store){c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,c.store,'toPantrySupply',ctx);}}if(!c.pantryTrip){if(!day)return;if(hasCargo(c))startTrip(s,c,c.store,'toStore',ctx);else c.phase='home';}}
 if(c.phase==='unloading'){if(hasCargo(c)){if(!deposit(s,c,ctx)){if(!c.districtJob){const next=receivingStore(s,ctx,c.store||c.home,c.cargo);if(next&&next!==c.store){c.store=next;startTrip(s,c,next,'toStore',ctx);}}return;}if(c.tradeJob){c.tradeJob=null;c.tradeMarket=null;}if(c.districtJob){delete c.districtJob;c.store=closestStore(s,ctx,c.home);}invalidateAssignments(s);}startTrip(s,c,c.home,'toHome',ctx);}
 if(c.freightCart&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.districtJob&&c.phase==='blocked'){startTrip(s,c,c.freightCart,'toReturnCart',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q)startTrip(s,c,hasCargo(c)?q.target:q.source,hasCargo(c)?'toDistrictStore':'toDistrictSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.clothingTarget!==undefined){startTrip(s,c,c.clothingLoad?c.home:c.store,c.clothingLoad?'toClothesHome':'toClothesSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.craftSite){startTrip(s,c,craftLoad(c)>0?c.craftSite:c.store,craftLoad(c)>0?'toWork':'toCraftSupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.seedField){startTrip(s,c,c.seedFood>0?c.seedField:c.store,c.seedFood>0?'toWork':'toStore',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&c.saleJob&&!hasCargo(c)&&shiftOpen(s,c,ctx))startTrip(s,c,c.store,'toSaleSupply',ctx);
 if(c.phase==='blocked'&&c.tradeJob&&!hasCargo(c)&&shiftOpen(s,c,ctx))startTrip(s,c,c.tradeMarket,'toMarket',ctx);
 if(c.phase==='blocked'&&c.pantryTrip){startTrip(s,c,c.pantryFood>0?(c.pantryTarget||c.home):c.store,c.pantryFood>0?'toPantryHome':'toPantrySupply',ctx);if(c.phase==='blocked')return;}
 if(c.phase==='blocked'&&dressingClaim(s,c)&&ctx.buildings.get(c.work)?.type==='hunting'){
  startTrip(s,c,c.work,'toWorkshop',ctx);if(c.phase==='blocked')return;
 }
 if(c.phase==='blocked'&&(hasBuildCargo(c)||hasCargo(c))){
  const target=hasBuildCargo(c)?c.sitePort:c.saleJob?c.saleMarket:c.store;if(target)startTrip(s,c,target,hasBuildCargo(c)?'toSite':c.saleJob?'toSaleMarket':'toStore',ctx);if(c.phase==='blocked')return;
 }
 if(!day&&c.clothingTarget!==undefined&&!c.clothingLoad){delete c.clothingTarget;delete c.clothingLoad;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}
 if(!day&&c.craftSite&&!craftLoad(c)){delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;}
 if(!day&&c.seedField&&!c.seedFood){delete c.seedField;delete c.seedFood;}
 const watch=c.guardPost&&c.guardPost===c.work?watchShift(s,c,ctx.buildings.get(c.work)):null;
 const watchOpen=watch&&watchOnShift(watch,s.simTime);
 // A distant first commute can span a whole short day. Reach the yard and wait
 // for it to open, otherwise the worker retraces the same half-route every day.
 const freightPickup=c.districtJob&&['toDistrictSupply','toCollectCart'].includes(c.phase);
 const finishCommute=s.calendarDaysPerMonth===1&&!watch&&
  (freightPickup||c.site&&c.phase==='toSupply'||c.phase==='toMarket'&&c.tradeJob||c.phase==='toWork'&&!c.seedField&&!c.craftSite||c.phase==='toSite'&&c.siteDuty==='builder');
 // A remote gathering trip keeps its chosen tree, prey or fishing spot overnight.
 // Opening hours below still pause work, and the worker returns with the actual load.
 const finishFieldTrip=s.calendarDaysPerMonth===1&&c.phase==='working'&&GATHERING_TYPES.includes(ctx.buildings.get(c.work)?.type)&&
  (!day||!shiftOpen(s,c,ctx))&&distance(c,ctx.ports.get(c.home)||c)>DAY_SECONDS/4*motionRateFor(s)*1.05&&
  s.gathering?.jobs.some(j=>j.citizen===c.id&&j.work===c.work);
 if(watchOpen&&c.phase==='blocked')startTrip(s,c,c.work,'toWork',ctx);
 if(!day&&!watchOpen&&!finishCommute&&!finishFieldTrip&&!unloadingAtMarket(s,c)&&!['toEveningGame','toReturnCart','home','toHome','toStore','toWorkshop','toSaleMarket','toPantrySupply','toPantryHome','toDistrictStore','toClothesHome','toRest','resting'].includes(c.phase)&&!(c.phase==='toWork'&&(c.seedFood>0||craftLoad(c)>0))&&!(c.phase==='toSite'&&Object.values(c.buildCargo||{}).some(n=>n>0))){
  if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);else startTrip(s,c,c.home,'toHome',ctx);
 }
 if((day||watch)&&!finishCommute&&!finishFieldTrip&&['working','toWork','returnWork','waiting','constructing','toSite','toSupply'].includes(c.phase)&&
  !c.craftSite&&!c.seedField&&!hasCargo(c)&&!hasBuildCargo(c)&&!(watch?watchOpen:shiftOpen(s,c,ctx)))startTrip(s,c,c.home,'toHome',ctx);
 if(c.phase==='home'){
  if(day&&canCopyLaw(s,c)){copyLaw(s,dt);return;}
  const own=ctx.buildings.get(c.home);if(own?.householdStock?.clothing>=1){const target=residentsAtHome(s,ctx,c.home).filter(p=>p.clothing<=REPLACE_CLOTHING_AT&&!s.citizens.some(q=>q.clothingTarget===p.id)).sort((a,b)=>a.clothing-b.clothing)[0];if(target){own.householdStock.clothing--;equipClothing(target);}}
  const evening=hourAt(s.simTime)>=19&&hourAt(s.simTime)<20;
  const householdTime=departed;
  if(canWork(c)&&!c.craftSite&&c.clothingTarget===undefined&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&(householdTime||evening)){
   const needs=needsReserveTrip(s,ctx,c.home);
   const store=needs&&hasMealStock(s,ctx)&&!s.citizens.some(p=>p.pantryTrip&&(p.pantryTarget||p.home)===c.home)?closestStock(s,ctx,c.home,'food'):null;
   if(store){c.store=store;c.pantryTrip=true;c.pantryFood=0;startTrip(s,c,store,'toPantrySupply',ctx);}
  }
  if(!c.pantryTrip&&householdTime&&canWork(c)&&c.clothingTarget===undefined&&!c.craftSite&&!c.districtJob&&!c.saleJob&&!c.tradeJob&&!hasCargo(c)&&!hasBuildCargo(c)&&s.resources.clothing>=1){
   const targets=residentsAtHome(s,ctx,c.home).filter(p=>p.clothing<=REPLACE_CLOTHING_AT&&!s.citizens.some(q=>q.clothingTarget===p.id)).sort((a,b)=>a.clothing-b.clothing||a.id-b.id),target=targets[0],store=target?closestStock(s,ctx,c.home,'clothing'):null;
   if(store){c.store=store;c.clothingTarget=target.id;c.clothingLoad=0;startTrip(s,c,store,'toClothesSupply',ctx);}
  }
  if(!c.pantryTrip&&c.clothingTarget===undefined){
   if(c.districtJob||c.saleJob||c.tradeJob||c.site||c.work){
    if(!(watch?watchOpen:shiftDeparture(s,c,ctx)))return;
    if(c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);startTrip(s,c,q?.source,'toDistrictSupply',ctx);}
    else if(c.saleJob)startTrip(s,c,c.store,'toSaleSupply',ctx);
    else if(c.tradeJob)startTrip(s,c,c.tradeMarket,'toMarket',ctx);
    else if(c.site)beginSiteTrip(s,c,ctx);
    else startTrip(s,c,c.work,'toWork',ctx);
   }else if(departed&&beginManualGathering(s,c,ctx,(from,to)=>routeBetween(s,from,to,ctx,c.id)))invalidateAssignments(s);
   else return;
  }
 }
 let remaining=dt;
 for(let transition=0;transition<12&&remaining>1e-8;transition++){
  // Early commuters reach their workplace and wait there until it opens.
  if(['working','waiting','constructing'].includes(c.phase)&&!watchOpen&&!isWorkplaceOpen(shiftType(c,ctx),s.simTime)&&!urgentShift(s,c,ctx))return;
  if(c.phase==='manualGathering'){if(workManualGathering(s,c,remaining,workRate(c,null,ctx.buildings.get(c.home)))){recordCitizenHarvest(s,c,c.cargo);const resource=Object.keys(c.cargo)[0];markCreatorCargo(s,c,resource,c.cargo[resource]);startTrip(s,c,c.store,'toStore',ctx);}return;}
  if(c.phase==='waiting'||c.phase==='constructing'){
   const q=ctx.buildings.get(c.site)?.construction;if(!q){startTrip(s,c,c.home,'toHome',ctx);continue;}
   if(materialsReady(q)&&c.siteDuty==='builder'){
    const site=ctx.buildings.get(c.site),work=remaining*workRate(c,'builder',ctx.buildings.get(c.home));
    c.phase='constructing';
    if(constructionWork){
     if(!constructionWork.has(site))constructionWork.set(site,[]);
     constructionWork.get(site).push({c,work});
    }else q.work=Math.min(workRequired(site),q.work+work);
   }return;
  }
  if(c.phase==='studying'){
   c.medicine.study=Math.min(STUDY_SECONDS,c.medicine.study+remaining);
   if(c.medicine.study>=STUDY_SECONDS){c.medicine.level=1;c.medicine.year=s.year;c.medicine.practice=0;s.news.unshift({title:'Обучение завершено',text:`${citizenName(c.id)} освоил врачевание в храме и может принимать пациентов.`,kind:'good',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);delete c.school;invalidateAssignments(s);startTrip(s,c,c.home,'toHome',ctx);}return;
  }
  if(c.phase==='working'){
   if(visitCommonMeal(s,c,ctx))return;
   const b=ctx.buildings.get(c.work);if(!b){startTrip(s,c,c.home,'toHome',ctx);continue;}
   if(c.guardPost===c.work){
    if(watch!=='night')return;
    c.workElapsed=Math.min(1,c.workElapsed+remaining);
    if(c.workElapsed<1)return;
    const port=ctx.ports.get(c.work),route=port&&watchPatrolRoute(s,ctx.network,port);
    if(!route)return;
    if(distance(c,port)>1e-7){startTrip(s,c,c.work,'toWork',ctx);continue;}
    c.route=route.map(({x,y})=>({x,y}));c.routeIndex=1;c.phase='returnWork';c.workElapsed=0;
    continue;
   }
   if(['depot','waterpoint'].includes(b.type))return;
   if(c.calling==='priest')recordVotiveMemory(s,b,c);
   if(b.type==='canal'){
    if(needsCanalCleaning(b)&&clearCanalSilt(b,remaining*workRate(c,'canal',ctx.buildings.get(c.home))))invalidateAssignments(s);
    return;
   }
   if(b.type==='granary'){if(c.calling==='scribe'&&c.role==='production'&&c.workplace===c.work)workOnAccount(s,b,c,remaining*workRate(c,'granary',ctx.buildings.get(c.home)));return;}
   if(b.type==='musicHouse'){workMusic(s,b,c,remaining*workRate(c,'musicHouse',ctx.buildings.get(c.home)));return;}
   if(b.type==='cowshed'){if(outputRoom(b,'milk')<3-1e-7)return;const amount=workDairy(b,remaining*workRate(c,'cowshed',ctx.buildings.get(c.home))*outputMultiplier(b));if(amount){putProductionOutput(s,b,{milk:amount});recordCitizenHarvest(s,c,{milk:amount});}return;}
   if(b.type==='garden'&&orchardMaturity(s,b).yield===0)return;
   if(!productionOutputFits(s,b))return;
   if(isArtisan(b)){
    const v=b.artisan;
    if(v.stage==='ready'){collectReadyOutputs(s);return;}
    if(['drying','firing','cooling'].includes(v.stage))return;
    const needs=artisanNeeds(b),k=Object.keys(needs).find(k=>k!=='water'&&needs[k]>1e-8);
    if(k){const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0)+workshopIncoming(s,c.work,k);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}
    if(needs.water>1e-8)return;
    workArtisan(b,remaining*workRate(c,b.type,ctx.buildings.get(c.home)),s);return;
   }
   if(b.type==='kiln'){const v=b.firing;if(v.hot)return;if(!v.ready){const needs=kilnNeeds(b),k=['brick','reed'].find(k=>needs[k]>1e-8);if(k){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0)+workshopIncoming(s,c.work,k);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}}}
   if(b.type==='brickyard'){const v=b.brickmaking;if(v.wet)return;if(!v.ready){const needs=brickNeeds(b);const k=['clay','reed'].find(k=>needs[k]>1e-8);if(k){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work&&p.craftMaterial===k).reduce((n,p)=>n+craftLoad(p),0)+workshopIncoming(s,c.work,k);if(needs[k]>incoming+1e-8){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;c.craftMaterial=k;c.craftAmount=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}if(needs.water>1e-8)return;}}
   if(b.type==='sheepfold'&&(b.flock?.fleece||0)<1-1e-8)return;
   if(['weaver','tailor'].includes(b.type)){const k=craftResource(b),input=craftState(b)?.[k]||0;if(input+1e-8<craftBatch(b)){c.workElapsed=0;const incoming=s.citizens.filter(p=>p.craftSite===c.work).reduce((n,p)=>n+craftLoad(p),0)+workshopIncoming(s,c.work,k);if(input+incoming+1e-8<craftBatch(b)){const store=closestStock(s,ctx,c.work,k);if(store){c.store=store;c.craftSite=c.work;if(b.type==='tailor')c.craftCloth=0;else c.craftWool=0;startTrip(s,c,store,'toCraftSupply',ctx);}}return;}}
   if(b.type==='field'){if(canTillField(s,b)){
    workField(s,b,remaining*workRate(c,b.type,ctx.buildings.get(c.home)),c);
    if(!canTillField(s,b))invalidateAssignments(s);
    return;
   }
   if(s.season===fieldCalendar(s,b).sow&&!fieldResting(s,b)&&cropFor(s,b).sheaves<=1e-8){const crop=cropFor(s,b),before=crop.sown;if(crop.sown<1-1e-8&&crop.seedStock<=1e-8&&!s.citizens.some(p=>p.id!==c.id&&p.seedField===c.work)){c.seedField=c.work;c.seedFood=0;c.store=closestStock(s,ctx,c.work,'food',{seed:true});if(c.store)startTrip(s,c,c.store,'toStore',ctx);else{delete c.seedField;delete c.seedFood;}return;}workFieldWithSeedBudget(s,b,remaining*workRate(c,b.type,ctx.buildings.get(c.home)),ctx);if(before<1&&crop.sown>=1)invalidateAssignments(s);return;}if(cropFor(s,b).sheaves<=1e-8&&(s.season!==fieldCalendar(s,b).harvest||cropFor(s,b).remaining<=0))return;}
   if(b.type==='healer'){
    const patients=(ctx.care?.get(c.work)?.patients||[]).filter(p=>p.phase==='treatment'&&p.health<(p.careGoal||85)&&!s.funeral?.actors.some(a=>a.id===p.id));
    let budget=remaining*(1+(b.level-1)*.5)*workRate(c,'healer',ctx.buildings.get(c.home))*healingSpeed(c);const cost=healingCost(c);
    for(const patient of patients){const amount=Math.max(0,Math.min(budget/patients.length,(patient.careGoal||85)-patient.health,(b.workshopStock.input.food||0)/(.04*cost),(b.workshopStock.input.reed||0)/(.02*cost)));const before=patient.health;patient.health+=amount;
     if(amount>0)c.medicine.practice+=amount;
     if(before<60&&patient.health>=60)recordMedicalRecovery(s,c,patient);if(b.giftInput)takeGiftFood(b,'giftInput',amount*.04*cost,b.workshopStock.input.food);b.workshopStock.input.food=Math.max(0,b.workshopStock.input.food-amount*.04*cost);b.workshopStock.input.reed=Math.max(0,b.workshopStock.input.reed-amount*.02*cost);}return;
   }
   const rate=workRate(c,b.type,ctx.buildings.get(c.home));
   if(GATHERING_TYPES.includes(b.type)||isExtractionCourt(b)&&extractableCourts.has(b.type)){
    const via=workGathering(s,c,b,remaining,rate,ctx.ports.get(c.work));if(via)harvest(s,c,ctx,via);
    return;
   }
   const needed=(BUILDINGS[b.type].workTime-c.workElapsed)/rate;
   if(remaining<needed){c.workElapsed+=remaining*rate;return;}
   remaining-=Math.max(0,needed);c.workElapsed=0;harvest(s,c,ctx);continue;
  }
  if(!['toCollectCart','toReturnCart','toEveningGame','toManualGathering','toCommonMeal','toWork','toWorkshop','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','toHealer','toSchool','toDistrictSupply','toDistrictStore','toCraftSupply','toClothesSupply','toClothesHome'].includes(c.phase))return;
  const next=c.route[c.routeIndex];
  if(!next&&dressingClaim(s,c)&&c.workElapsed<dressingSeconds){
   const spent=Math.min(remaining,dressingSeconds-c.workElapsed);c.workElapsed+=spent;remaining-=spent;
   if(c.workElapsed<dressingSeconds)return;
  }
  if(!next){
   if(finishCommute&&!shiftOpen(s,c,ctx))return;
   if(scheduledArrivals.has(c.phase)&&!watchOpen&&(hourAt(s.simTime)<9||finishCommute)&&!isWorkplaceOpen(shiftType(c,ctx),s.simTime)&&!urgentShift(s,c,ctx)&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.seedFood&&!craftLoad(c))return;
   const phase=c.phase;arrival(s,c,ctx);
   // Another worker must clear the full output store before this delivery can advance.
   if(c.phase==='home'||c.phase==='resting'||phase==='toWorkshop'&&c.phase===phase)return;
   continue;
  }
  const flooded=ctx.network.navigation.flooded;
  if(flooded&&floodedSegment(flooded,c,next)||ctx.network.navigation.fortifications&&!ctx.network.navigation.fortifications.segmentClear(c,next)||
   watch==='night'&&c.phase==='returnWork'&&!navigationSegmentClear(s,c,next,ctx.network.navigation.obstacles)){c.phase='blocked';c.route=[];c.routeIndex=0;return;}
  const dist=distance(c,next);
  const road=roadSegment(s,c,next);
  const speed=residentWalkingSpeed(s,c,ctx.buildings,road,c);
  const travel=dist/speed;
  if(c.phase==='toDistrictStore'&&c.windCargo&&!c.windRoute&&!s.windDelivery.path&&dist>1e-8&&remaining>0){
   if(road?.level>=2&&!road.floodDamage)c.windRoute='road';
   else {
    const mid=Math.min(1,remaining/travel)/2;
    if(onBridge(s.buildings,c.x+(next.x-c.x)*mid,c.y+(next.y-c.y)*mid,s))c.windRoute='bridge';
   }
  }
  recordFootsteps(s,c,next,Math.min(dist,remaining*speed),ctx.network.navigation,!!c.freightCart);
  if(travel<=remaining+1e-8){c.x=next.x;c.y=next.y;c.routeIndex++;remaining-=travel;}
  else{const fraction=remaining/travel;c.x+=(next.x-c.x)*fraction;c.y+=(next.y-c.y)*fraction;return;}
 }
}
function prepareCare(s,ctx){
 if(!ctx.healers.length)return;
 ctx.care=new Map(ctx.healers.filter(isComplete).map(b=>[buildingKey(b),{key:buildingKey(b),building:b,staff:false,patients:[]}]));
 for(const c of s.citizens){const workplace=ctx.care.get(c.work);if(workplace&&qualifiedHealer(c))workplace.staff=c;const clinic=ctx.care.get(c.clinic);if(clinic)clinic.patients.push(c);}
}
function advanceCareerChoices(s,ctx){
 const rules=s.careerRules;
 if(!rules||s.funeral||s.festival||ceremonyActive(s)||!isWorkday(s.simTime))return false;
 const day=Math.floor((s.simTime+DAY_SECONDS/12+1e-7)/DAY_SECONDS);
 if(day<=rules.lastChoiceDay)return false;
 rules.lastChoiceDay=day;
 const adults=s.citizens.filter(canWork);
 let openings=Math.floor(adults.length/2)-adults.filter(c=>c.selfCalling).length;
 const pinned=new Map();
 for(const c of adults)if(c.workplace)pinned.set(c.workplace,(pinned.get(c.workplace)||0)+1);
 const jobs=[];
 for(const b of s.buildings){
  const profession=professionForBuilding(b.type),key=buildingKey(b);
  if(!profession||profession==='healer'||profession==='fisher'&&s.catDiscovery&&s.catDiscovery.phase!=='opened'||!isOperational(b)||b.type==='field'&&!fieldActive(s,b))continue;
  const port=ctx.ports.get(key),component=port&&ctx.network.components.get(port.key);
  const free=workplaceCapacity(b.type)-(pinned.get(key)||0);
  if(component!==undefined&&free>0&&closestStore(s,ctx,key))jobs.push({key,profession,component,free});
 }
 let changed=false;
 for(const c of adults){
  if(c.workplace||c.guardPost||c.pendingRole||c.futureRole||!['home','resting'].includes(c.phase)||c.health<65||c.hunger>=30||shelterHome(c)||waterBusy(c)||hasCargo(c)||hasBuildCargo(c)||c.pantryTrip||c.manualGathering||c.districtJob||c.tradeJob||c.saleJob||c.clothingTarget!==undefined||c.craftSite||c.seedField||c.clinic||c.school)continue;
  if(!c.selfCalling&&(openings<=0||c.calling&&c.calling!=='auto'||(c.role||'auto')!=='auto'||residentCareerRoll(s,c.id,day)>.28))continue;
  const home=ctx.ports.get(c.home),component=home&&ctx.network.components.get(home.key);
  const eligible=jobs.filter(job=>job.free>0&&job.component===component);
  const innate=innateProfession(s,c);
  const job=c.selfCalling?eligible.find(job=>job.profession===c.calling):
   eligible.find(job=>job.profession===innate)||eligible.find(job=>job.key===c.work)||eligible[Math.floor(residentCareerRoll(s,c.id,-day)*eligible.length)];
  if(!job)continue;
  if(!c.selfCalling){
   openings--;
   c.calling=job.profession;c.role=professionRole(job.profession);c.selfCalling=true;
   recordProfessionEpithet(s,c);
  }
  c.workplace=job.key;job.free--;changed=true;
 }
 if(changed)invalidateAssignments(s);
 return changed;
}

export function advanceWorkers(s,seconds,{stopForCeremony=false,cropRate=1,fishingTimerRate=1}={}){
 syncDistrictJobs(s);
 if(!s.funeral||s.funeral.scope==='family')syncCitizens(s);let ctx=context(s);const start=s.simTime;
 let elapsed=0,laborKind=isWorkday(s.simTime)?activeLaborKind(s):null;for(;elapsed<seconds-1e-8;){if(stopForCeremony&&ceremonyActive(s))break;const dt=Math.min(.1,seconds-elapsed);s.simTime=start+elapsed;if(advanceCareerChoices(s,ctx)){syncCitizens(s);ctx=context(s);}const activeLabor=isWorkday(s.simTime)?activeLaborKind(s):null;if(activeLabor!==laborKind){laborKind=activeLabor;syncCitizens(s);ctx=context(s);}advanceGathering(s);advanceFestival(s,dt);advanceGodhood(s,dt);advanceRelicQuest(s,dt);const family=s.funeral?.scope==='family',mourners=family?new Set(s.funeral.actors.map(a=>a.id)):null;if(advanceFuneral(s,dt)&&!family){advanceWater(s,dt);advanceClothing(s,dt);advanceTextiles(s,dt);advanceBricks(s,dt);advanceKilns(s,dt);advanceArtisans(s,dt);collectReadyOutputs(s);advanceCrops(s,dt*cropRate);advancePests(s,dt);elapsed+=dt;ctx=context(s);continue;}advanceTradeLogistics(s,dt);ctx=context(s);advanceExternalGuest(s,dt,ctx.network);
  if(advanceArrivalGroup(s,dt,ctx.network)){
   const {home,count,provisions,giftReserve,custom}=s.arrivalGroup,house=ctx.buildings.get(home);
   for(const [source,{food}] of Object.entries(provisions)){
    if(giftReserve?.[source])addGiftFood(house,'giftHome',giftReserve?.[source],house.pantry||0);
    house.pantry=(house.pantry||0)+food;
    house.pantryDelivered=(house.pantryDelivered||0)+food;
   }
   house.water+=count;
   delete s.arrivalGroup;
   s.citizens.push(...createArrivalFamily(s,home,count,custom));
   s.population=s.citizens.length;
   syncCitizens(s);ctx=context(s);
   s.news.unshift({title:'Прибыли новые жители',text:`Поселились в доме ${home} · ${count} чел.`,kind:'good',year:s.year,season:s.season,tick:s.tick});
   s.news=s.news.slice(0,80);
  }
  prepareCare(s,ctx);if(advanceWater(s,dt))invalidateAssignments(s);const familyCare=advanceFamilyCare(s,dt,mourners),constructionWork=isAwakening(s)?new Map():null;
 const modelWorkers=advanceShapingModel(s,dt,{busy:familyCare,reachable:(from,to)=>!!routeBetween(s,from,to,ctx)});
 // Share read work only within this pass. Seed pickup, delivery and sowing
 // invalidate the budget immediately so the next resident sees the new stock.
 ctx.citizenPass={};
 for(const c of s.citizens)if(!modelWorkers.includes(c.id)&&!familyCare?.has(c.id)&&!waterBusy(c)&&!mourners?.has(c.id)&&!['relic','relicGuest','awakening'].includes(c.phase))advanceCitizen(s,c,dt,ctx,constructionWork,fishingTimerRate);
 ctx.citizenPass=null;
 if(constructionWork)for(const [site,contributions] of constructionWork){
  const q=site.construction;q.work+=applyBuilderInstruction(s,contributions,Math.max(0,workRequired(site)-q.work),site);
 }
 advanceWellbeing(s,dt);scheduleEveningVisit(s,ctx);advanceClothing(s,dt);advanceTextiles(s,dt);advanceBricks(s,dt);advanceKilns(s,dt);advanceArtisans(s,dt);collectReadyOutputs(s);advanceCrops(s,dt*cropRate);const finished=finishConstruction(s);advancePests(s,dt);advanceCatDiscovery(s,dt);if(finished||caches.get(s)?.synced===null){syncCitizens(s);ctx=context(s);}elapsed+=dt;}
 const advanced=elapsed>=seconds-1e-8?seconds:elapsed;
 const lastStepWasDinner=isDinnerTime(s.simTime);
 s.simTime=start+advanced;
 // The last work step samples its start time. Finalize dinner if its end crossed dawn.
 if(advanced>0&&lastStepWasDinner&&!isDinnerTime(s.simTime)&&!ceremonyActive(s))advanceWellbeing(s,0);
 advanceReedBeds(s);
 return advanced;
}
// Clinic waiting places are view offsets only: identities, routes and saved
// treatment coordinates remain the actual simulation state.
export function treatmentViewPosition(s,c){
 if(c.phase!=='treatment'||!c.clinic)return null;
 const b=s.buildings.find(b=>buildingKey(b)===c.clinic&&b.type==='healer'&&isOperational(b));if(!b)return null;
 const patients=s.citizens.filter(p=>p.phase==='treatment'&&p.clinic===c.clinic).sort((a,b)=>a.id-b.id),slot=patients.findIndex(p=>p.id===c.id);
 const clinicPlace=clinicPlaces(b,slot,c);
 return {x:clinicPlace.stand.x,y:clinicPlace.stand.y,sourcePhase:c.phase,sourceX:c.x,sourceY:c.y,clinicPlace,activity:{kind:'recovery',stage:'waiting',target:b}};
}
function guardView(s,c){
 if(!c.guardPost||c.guardPost!==c.work)return null;
 const shift=watchShift(s,c);
 const guarding=shift?watchOnDuty(s,c,shift):c.phase==='working'&&!s.funeral?.actors.some(a=>a.id===c.id);
 return {guarding,nightWatch:guarding&&shift==='night'};
}
export function visibleCitizens(s){
 const footpathPosition=residentFootpathPositions(s),motionTime=motionTimeFor(s);
 const people=(s.citizens||[]).filter(c=>!['home','resting','studying'].includes(c.phase)||c.phase==='studying'&&!!c.school||c.phase==='home'&&c.age>=3&&c.age<16&&canDepartForWork(undefined,c.id,s.simTime,s)).map(c=>({...c,lifeStage:lifeStage(c),kind:'person',walking:(c.floodShelter||c.fireShelter)&&c.routeIndex<c.route.length||waterBusy(c)||['toCollectCart','toReturnCart','toEveningGame','toManualGathering','toCommonMeal','toWork','toWorkshop','toStore','returnWork','toHome','toSupply','toSite','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','toHealer','toSchool','toDistrictSupply','toDistrictStore','toCraftSupply','toClothesSupply','toClothesHome'].includes(c.phase),carrying:c.memorialMove?true:c.waterTrip?.load>0?true:c.clothingLoad>0?true:craftLoad(c)>0?true:c.seedFood>0?true:c.pantryTrip?c.pantryFood>0:hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0),cargo:c.waterTrip?.load>0?{water:c.waterTrip.load}:c.clothingLoad>0?{clothing:c.clothingLoad}:craftLoad(c)>0?c.craftMaterial?{[c.craftMaterial]:c.craftAmount}:c.craftCloth>0?{cloth:c.craftCloth}:{wool:c.craftWool}:c.seedFood>0?{food:c.seedFood}:c.pantryTrip?{food:c.pantryFood||0}:hasCargo(c)?c.cargo:c.buildCargo,robe:c.role==='tailor'?'#ad826b':c.role==='healer'?(medicalLevel(c)?'#e6eee1':'#80aaa3'):['#f0dfb5','#b76c4e','#527f82','#d2b66e','#a195ac','#e6e4cf'][c.id%6],step:motionTime*(4+(c.id%4)*.2),...guardView(s,c),...childPlay(s,c),...festivalCitizenView(s,c),...relicCitizenView(s,c),...godhoodCitizenView(s,c),...treatmentViewPosition(s,c),...(c.fishingLanding&&c.phase==='toWorkshop'?{walking:false,carrying:false}:{})}));

 const walkingPlots=s.gathering?.jobs.filter(j=>j.source&&j.stage==='approach');
 if(s.civicOrder?.law?.copyRemaining&&isWorkday(s.simTime)){
  const author=s.citizens.find(c=>c.id===s.civicOrder.law.author);
  if(author&&canCopyLaw(s,author))people.push({...author,kind:'person',lifeStage:lifeStage(author),phase:'copyingLaw',walking:false,carrying:false});
 }
 for(const person of people){
  if(person.walking&&scheduledArrivals.has(person.phase)&&person.route?.length&&person.routeIndex>=person.route.length)person.walking=false;
  if(person.walking)Object.assign(person,footpathPosition(person));
  else if(walkingPlots?.length&&walkingPlots.some(j=>j.citizen===person.id))person.walking=true;
 }
 const cast=s.peaceDiscovery?.lastCast;
 if(cast&&s.simTime-cast.at<60){
  for(const c of s.citizens)if(peaceResting(s,c)){
   const shown=people.find(p=>p.id===c.id);
   if(shown?.walking)continue;
   const pose={peaceRelief:true,peaceKeepsake:s.peaceDiscovery.keepsakes?.includes(c.id)||false,playing:false};
   if(shown)Object.assign(shown,pose);
   else people.push({...c,...pose,kind:'person',lifeStage:lifeStage(c),walking:false,carrying:false,robe:'#d2b66e',step:motionTime*4});
  }
 }
 const guest=externalGuestView(s);if(guest)people.push(guest);
 if(s.externalVisits)people.push(...visitorsView(s));
 const group=s.arrivalGroup;
 if(group)people.push({id:1000010,name:`Переселенцы · ${group.count}`,age:30,sex:'m',lifeStage:'adult',kind:'person',visitor:true,
  x:group.x,y:group.y,phase:'guest',walking:!group.waiting&&group.routeIndex<group.route.length,step:motionTime*4,robe:'#b37b51',carrying:true,cargo:{food:group.count}});
 return people;
}
export function workforceStats(s){
 syncCitizens(s);const ctx=context(s),people=s.citizens;
 const disconnected=s.buildings.filter(b=>isOperational(b)&&Object.keys(BUILDINGS[b.type].output).length).filter(b=>{
  const p=ctx.ports.get(buildingKey(b));return !p||!closestStore(s,ctx,buildingKey(b))||!s.buildings.some(h=>isResidence(h)&&ctx.ports.get(buildingKey(h))&&routeBetween(s,ctx.ports.get(buildingKey(h)).key,p.key,ctx));
 }).length;
 return {total:people.length,employed:people.filter(c=>c.work).length,builders:people.filter(c=>c.site&&c.siteDuty==='builder').length,carriers:people.filter(c=>c.site&&c.siteDuty==='carrier').length,sites:constructionEntities(s).filter(b=>b.construction).length,working:people.filter(c=>['working','manualGathering'].includes(c.phase)).length,manualGatherers:people.filter(c=>c.manualGathering).length,carrying:people.filter(c=>c.clothingLoad>0||craftLoad(c)>0||c.seedFood>0||c.pantryFood>0||hasCargo(c)||Object.values(c.buildCargo||{}).some(n=>n>0)).length,atHome:people.filter(c=>['home','resting'].includes(c.phase)).length,disconnected,deliveries:s.deliveries};
}

export function rerouteCitizens(s){
 invalidateAssignments(s);syncCitizens(s);const ctx=context(s);
 for(const c of s.citizens){
  if(['festival','relic','relicGuest','awakening'].includes(c.phase))continue;
  if(c.fireShelter)continue;
  if(waterBusy(c)){resumeWaterAtHome(s,c);continue;}
  if(c.freightCart&&!hasCargo(c)&&!hasBuildCargo(c)&&!c.districtJob)startTrip(s,c,c.freightCart,'toReturnCart',ctx);
  else if(c.commonMealTarget)returnFromCommonMeal(s,c,ctx);
  else if(c.school)startTrip(s,c,c.school,'toSchool',ctx);
  else if(c.clinic)startTrip(s,c,c.clinic,'toHealer',ctx);
  else if(c.districtJob){const q=s.district.jobs.find(q=>q.id===c.districtJob);if(q)startTrip(s,c,hasCargo(c)?q.target:q.source,hasCargo(c)?'toDistrictStore':'toDistrictSupply',ctx);}
  else if(c.pantryTrip)startTrip(s,c,c.pantryFood>0?(c.pantryTarget||c.home):c.store,c.pantryFood>0?'toPantryHome':'toPantrySupply',ctx);
  else if(c.clothingTarget!==undefined)startTrip(s,c,c.clothingLoad?c.home:c.store,c.clothingLoad?'toClothesHome':'toClothesSupply',ctx);
  else if(c.craftSite)startTrip(s,c,craftLoad(c)>0?c.craftSite:c.store,craftLoad(c)>0?'toWork':'toCraftSupply',ctx);
  else if(c.seedField)startTrip(s,c,c.seedFood>0?c.seedField:c.store,c.seedFood>0?'toWork':'toStore',ctx);
  else if(hasBuildCargo(c)&&c.site)startTrip(s,c,c.sitePort,'toSite',ctx);
  else if(hasCargo(c)&&c.saleJob)startTrip(s,c,c.saleMarket,'toSaleMarket',ctx);
  else if(hasCargo(c)&&c.phase==='toWorkshop'&&c.work)startTrip(s,c,c.work,'toWorkshop',ctx);
  else if(hasCargo(c)&&c.store)startTrip(s,c,c.store,'toStore',ctx);
  else if(c.phase!=='home'||distance(c,ctx.ports.get(c.home)||c)>.01)startTrip(s,c,c.home,'toHome',ctx);
 }
}

export function recoverCitizenCargo(s,id){recoverRelicCitizen(s,id);
 const c=s.citizens?.find(c=>c.id===id);if(!c)return false;
 const site=constructionEntities(s).find(b=>buildingKey(b)===c.site)?.construction,purchase=s.trade?.deliveries?.find(q=>q.id===c.tradeJob),sale=s.trade?.sales?.find(q=>q.id===c.saleJob),district=s.district?.jobs.find(q=>q.id===c.districtJob);
 if(c.shapingLoad){const {amount}=c.shapingLoad;if(returnShapingLoad(s,c)&&district)district.cancelled+=amount;}
 if(district?.fishLot&&c.cargo?.food>0){
  const origin=s.buildings.find(b=>buildingKey(b)===district.source);
  if(!origin)return false;
  if(!district.targetKind)returnDryFishingEvidence(s,c,district.fishLot.id,c.cargo.food,dryFishLotStock(origin,district.fishLot));
  addDryFishLot(origin,district.fishLot,c.cargo.food);
  district.cancelled+=c.cargo.food;delete c.cargo.food;
 }
 const needsHolder=(!site&&hasBuildCargo(c))||craftLoad(c)>0||c.clothingLoad>0||c.seedFood>0||c.pantryFood>0||Object.entries(c.cargo||{}).some(([k,n])=>n>0&&MATERIALS.includes(k)&&!(purchase&&k===purchase.resource)&&!(sale&&k===sale.resource)&&!(district?.targetKind==='votive'&&k===district.resource)),recovery=needsHolder?localRecoveryStore(s,c):null;
 // Callers must retain a stranded owner if neither a warehouse, a home nor an
 // operational yard is reachable. Never clear a load without an accepted unit.
 if(needsHolder&&!recovery)return false;
 delete c.freightCart;
 if(c.phase==='toReturnCart')startTrip(s,c,c.home,'toHome',context(s));
 discardFishingCargo(s,c);delete c.fieldGrain;
 const ctxRecoveryStore=()=>s.buildings.find(b=>buildingKey(b)===recovery);
 const restore=(k,n,fishKey,giftKey=fishKey==='fishCargo'?'giftCargo':fishKey==='fishPantry'?'giftPantry':null)=>{if(!(n>0))return 0;const accepted=putRecoveryStock(s,recovery,k,n);if(accepted!==n)throw new Error('Recovery holder refused owned cargo');
  if(k==='food'&&fishKey){
   const holder=ctxRecoveryStore(),grainKey=fishKey==='fishPantry'?'grainPantry':'grainCargo';
   appendGrain(holder,'grainStock',takeGrain(c,grainKey,n,n),holder.stock.food-n);
  }
  if(k==='food'&&giftKey&&c[giftKey]){
   const holder=ctxRecoveryStore();
   moveGiftFood(c,giftKey,holder,'giftStock',n,n,holder.stock.food-n);
  }
  if(fishKey&&c[fishKey]){
   const holder=s.buildings.find(b=>buildingKey(b)===recovery);
   appendFish(holder,'fishStock',takeFishEvidence(c,fishKey,n,n),holder.stock.food-accepted);
  }
  return accepted;};
 recoverFestivalCitizen(s,id);
 for(const [k,n]of Object.entries(c.buildCargo||{}))if(site){site.remaining[k]=(site.remaining[k]||0)+n;if(site.sources)(site.sources[c.store]??={})[k]=(site.sources[c.store]?.[k]||0)+n;}else restore(k,n);
 if(c.waterTrip)recoverWater(s,c);
 for(const [k,n]of Object.entries(c.cargo||{})){
  if(purchase&&k===purchase.resource){moveGiftFood(c,'giftCargo',purchase,'giftFood',n,n,purchase.remaining);purchase.remaining+=n;}
  else if(sale&&k===sale.resource){sale.remaining+=n;if(sale.sources){const row=sale.sources[c.store]??={};if(k==='food'&&c.giftCargo)moveGiftFood(c,'giftCargo',sale.giftReserve??={},c.store,n,n,row.food||0);row[k]=(row[k]||0)+n;}}
  else if(district?.targetKind==='votive'&&k===district.resource)district.remaining+=n;
  else if(MATERIALS.includes(k)){const accepted=restore(k,n,k==='food'?'fishCargo':null);if(c.creatorCargo?.resource===k)addCreatorStock(s.buildings.find(b=>buildingKey(b)===recovery),k,Math.min(accepted,c.creatorCargo.amount));if(district)district.cancelled+=accepted;}
  else s.resources[k]=(s.resources[k]||0)+n;
 }
 c.cargo={};c.buildCargo={};
 if(craftLoad(c))restore(c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool'),craftLoad(c),null,'giftCraft');
 delete c.giftCraft;
 const hadManual=!!c.manualGathering;releaseManualGathering(c);
 const hadCraft=!!c.craftSite||c.clothingTarget!==undefined;
 if(c.clothingLoad)restore('clothing',c.clothingLoad);
 if(c.seedFood)restore('food',c.seedFood,null,'giftSeed');
 delete c.giftSeed;
 if(c.pantryFood)restore('food',c.pantryFood,'fishPantry');
 delete c.grainCargo;delete c.grainPantry;
 delete c.fishingLanding;delete c.hangingFishElapsed;
 delete c.fishCargo;delete c.fishPantry;delete c.giftCargo;delete c.giftPantry;delete c.inspiredFishReturn;delete c.creatorCargo;delete c.windCargo;delete c.windRoute;
 delete c.clothingTarget;delete c.clothingLoad;delete c.craftSite;delete c.craftWool;delete c.craftCloth;delete c.craftMaterial;delete c.craftAmount;delete c.seedField;delete c.seedFood;delete c.pantryTrip;delete c.pantryFood;delete c.pantryOrigin;delete c.pantryRemainder;delete c.pantryTarget;delete c.districtJob;
 if(district)c.store=recovery;c.tradeJob=null;c.tradeMarket=null;c.saleJob=null;c.saleMarket=null;
 const ctx=context(s);ctx.stores=stockStores(s);ctx.closestStores.clear();if(district||hadCraft||hadManual)startTrip(s,c,c.home,'toHome',ctx);invalidateAssignments(s);return true;
}
