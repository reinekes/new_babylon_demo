import {advanceCampaignChapter,campaignChapterView,validateCampaignChapter,validateHearthEnding,validateWaterEnding,validateCraftEnding,advanceMonumentLife,validateCityEnding,validateMonumentLife,advanceForeignName,validateForeignName} from './campaign.js';
import {cityCommandReason} from './city-command-lock.js';
import {validateInannaDiscovery} from './inanna-discovery.js';
import {landMemoryCastQuote,validateLandMemory} from './land-memory.js';
import {retireDepthPressure,validateDepthSupply} from './depth-supply.js';
import {recordStarForecast,retireStarForecastAt} from './star-forecast.js';
import {validateStarObservations} from './star-observations.js';
import {advanceArrivalOpening,arrivalHousing,reserveArrival,validateArrivalHospitality} from './arrival-hospitality.js';
import {connectedStores} from './district-logistics.js';
import {createShapingBatch,validateShapingBatches} from './shaping-batch.js';
import {validateShapingModel} from './shaping-model.js';
import {validateShapingProjects} from './shaping-projects.js';
import {revelationAdviceQuote} from './revelation-advice.js';
import {validateRevelationEvidence,validateRevelationTraining} from './revelation-evidence.js';
import {validateSunlightFeast,validateSunlightService} from './sunlight-gathering.js';
import {validateAbundanceDiscovery} from './abundance-discovery.js';
import {validateAbundanceOrigin} from './abundance-origin.js';
import {ABUNDANCE_LIMIT,receiveAbundance,validateAbundanceGift} from './abundance-gift.js';
import {validateWindDelivery} from './wind-delivery.js';
import {validateCreatorMaterials,advanceCreatorEvidence} from './creator-materials.js';
import {richCatchQuote,startRichCatch,expireRichCatch,validateRichCatch} from './rich-catch.js';
import {validateFishProvenance} from './fish-provenance.js';
import {advanceFieldGrain,validateFieldGrain} from './field-grain.js';
import {PEACE_MOOD,peaceQuote,validatePeaceDiscovery} from './peace-discovery.js';
import {advanceBlessingDiscovery,validateBlessingDiscovery} from './blessing-discovery.js';
import {recordRainCast,validateRainDiscovery} from './rain-discovery.js';
import {recordMiracleCast,validateMiracleHistory} from './miracle-history.js';
import {advanceMonumentChapter,monumentChapterReason,validateMonumentChapter} from './monument-chapter.js';
import {validateEveningGames} from './household-games.js';
import {validateCausalFacts} from './causal-facts.js';
import {advanceAutonomousHousing,autonomousHousingBoundary,validateHouseholdInitiatives} from './household-initiative.js';
import {validateHumanProjects} from './human-projects.js';
import {fortificationAccess} from './navigation.js';
import {advanceSupplyVow,validateSupplyVows} from './supply-vow.js';
import {validateCommonMeals} from './common-meal.js';
import {validateFamilyCare} from './family-care.js';
import {pastureCredits} from './pasture.js';
import {settleManagedFlocks} from './textiles.js';
import {validateVotiveOfferings} from './votive-offerings.js';
import {validateExternalGuest} from './external-guest.js';
import {validateReedBeds} from './reed-stock.js';
import {validateForests} from './forest-stock.js';
import {clayRemaining,stoneRemaining,validateMineralPits} from './mineral-stock.js';
import {validateFisheries} from './fishery-stock.js';
import {AUTUMN_CROPS} from './crop-calendar.js';
import {changeFloodSeason,validateRiverFlood,floodFootprint,floodStorageRisk,floodedRoads} from './river-flood.js';
import {validateFieldSoil} from './field-soil.js';
import {depositCanalSilt,validateCanalMaintenance} from './canal-maintenance.js';
import {validateCityLabor} from './city-labor.js';
import {initializeCatDiscovery,validateCatDiscovery,miraclePrice} from './miracle-discovery.js';
import {calendarRateFor,DAYS_PER_MONTH} from './calendar.js';
import {initializeCatFishing,validateCatFishing,usesCatDiscovery} from './cat-fishing-ledger.js';
import {buildingDefinition,buildingPresentation} from './building-presentation.js';
import {legacyScenario,validateScenario,isStrictSumer} from './scenario-profiles.js';
import {validateManualGathering} from './manual-gathering.js';
import {startMiracleCelebration,advanceMiracleCelebration,validateMiracleCelebration,miracleCelebrationReason,miracleCelebrationTargetReason} from './miracle-celebration.js';
import {ceremonyActive} from './ceremony-time.js';
import {cityEventDefinition,createCityEvent,isAdditionalCityEvent,cityEventReason,applyCityEvent} from './city-events.js';
import {initializeGodhood,validateGodhood,buildingKnowledgeReason,miracleKnowledgeReason} from './godhood.js';
import {initializeRelicQuest,validateRelicQuest,relicControlActive,relicCommandReason,deferRelicEvent,relicSiteReserved,interruptRelicForFuneral} from './relic-quest.js';
import {initializeSacredUnlocks,syncSacredUnlocks,validateSacredUnlocks,miracleLockReason,applySacredMiracle} from './sacred-unlocks.js';
import {validateMusic} from './music.js';
import {validateCitizenEpithets} from './citizen-epithets.js';
import {orchardMaturity,validateOrchards} from './orchard-layout.js';
import {stampBuildingCompletion,validateBuildingChronology} from './building-chronology.js';
import {validateStockAccounts} from './scribes.js';
import {initializeProductionAccounting,validateProductionHistory} from './building-production-history.js';
import {validateDairy,settleManagedDairy,settleMilkSpoilage} from './dairy.js';
import {initializeBuildingInventory,validateBuildingInventory} from './building-inventory.js';
import {initializeEcology,advanceEcology,validateEcology} from './ecology.js';
import {starterHomes,distributeFounders} from './starter-settlement.js';
import {initializeLifeAnalytics,syncLifeAnalytics,recordLifeBirth,recordLifeDeath,snapshotLifeAnalytics,validateLifeAnalytics} from './life-analytics.js';
import {validRotation} from './placement.js';
import {newFootprint,footprintCells,occupiesCell,insideFootprint} from './footprints.js';
import {initializeGathering,validateGathering} from './labor-life.js';
import {initializeFestival,validateFestival,festivalReason,orderFestival,festivalInvitation,advanceFestival} from './festival.js';
import {initializeArtisans,validateArtisans} from './artisan.js';
import {isRiverBank} from './river-trade.js';
import {upgradeCost,legacyUpgradeCost} from './masonry.js';
export {upgradeCost} from './masonry.js';
import {initializeKilns,validateKilns} from './kilns.js';
import {initializeBricks,validateBricks} from './bricks.js';
import {depthWaterpointTarget,initializeWater,validateWater,WATERPOINT_CAPACITY} from './water.js';
import {initializeTextiles,validateTextiles} from './textiles.js';
import {syncInventory,validateInventory,stockStores,reserveStock,takeStock} from './inventory.js';
import {initializeDistricts,validateDistricts} from './district-logistics.js';
import {initializeFoodPlan,availableFood,validateFoodPlan} from './food-planning.js';
import {initializePests,syncPestSites,validatePests,catReason,bringCat} from './pests.js';
import {initializeCrops,changeCropSeason,cropSummary,validateCrops} from './agriculture.js';
import {depthCanalTarget,fieldWater,irrigationFor,lowWaterYear} from './irrigation.js';
import {initializeClothing,validateClothing} from './clothing.js';
import {ROLES,validateEducation,newMedicalSkill,advanceMedicalYear} from './education.js';
import {PROFESSION_IDS,professionRole,canStaffBuilding,hasWorkplace} from './professions.js';
import {initializeWellbeing,validateWellbeing,affectResidents,mournResidents,mealRation} from './wellbeing.js';
import {validateHouseholds} from './households.js';
import {initializeDemography,advanceGenerations,validateDemography} from './demography.js';
import {startFuneral,advanceFuneral,validateFuneral} from './funerals.js';
import {marketAccess,initializeTrade,advanceTrade,validateTrade} from './trading.js';
import {roadUpgradeCost,roadKey} from './roads.js';
import {createOrder,isComplete,nextOrder,MAX_CONSTRUCTION_ORDER,constructionEntities,workRequired,floodRepairCost,boatRepairCost,boatTenderCost,joineryBoatCost,joineryUpgradeTypes,joineryUpgradeCost} from './construction.js';
import {WIDTH,HEIGHT,worldWidth,worldHeight,bridgeSpanAt,riverLocal,signedRiverDistance,terrain,river,bridgeSpan,initializeWorld,initializeGeneratedWorld,nearDeposit,isShore,validateWorld,isDryPoint,ensureResourceSites} from './world.js';
import {BUILDINGS,MIRACLES,RESOURCE_NAMES,MATERIALS,levelOf,capacityOf,outputMultiplier,buildingKey,storageOf,housingOf,citizenName,isCityFortification} from './definitions.js';
import {networkFor,syncCitizens,advanceWorkers,workforceStats,recoverCitizenCargo} from './workforce.js';
import {createDivinity,registerMiracle,refreshResultName,usesResultNames} from './divinity.js';
export {WIDTH,HEIGHT,terrain,river,bridgeSpan,BUILDINGS,MIRACLES};
export const VERSION=36;
export const SEASONS=['Весна','Лето','Осень','Зима'];
const emptyResources=()=>({...Object.fromEntries(MATERIALS.map(k=>[k,0])),food:0,clay:0,reed:0,wood:0,stone:0,hides:0,wool:0,cloth:0,clothing:0,brick:0,firedBrick:0,pottery:0,beer:0,faith:0,prestige:0});
const emptyCooldowns=()=>Object.fromEntries(Object.keys(MIRACLES).filter(k=>k!=='richCatch').map(k=>[k,0]));
const emptyBuffs=()=>({fertility:0,inspiration:0,haste:0,sunlight:0,inannaProtection:0,earthMemory:0});
export function log(s,title,text='',kind='info'){const last=s.news[0];if(last&&last.title===title&&last.tick===s.tick)return;s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});s.news=s.news.slice(0,80);}
export function createGame({start='beehives',mode,seed,generationVersion=2,scenario=legacyScenario()}={}){
 if(!validateScenario(scenario)||usesCatDiscovery({scenario})&&mode!=='awakening')throw Error('Invalid scenario profile');
 const s={version:VERSION,scenario:{...scenario},year:1,season:0,tick:0,seasonElapsed:0,simTime:0,population:12,capacity:16,happiness:75,rngState:117,roads:[],funeral:null,deaths:0,resources:{...Object.fromEntries(MATERIALS.map(k=>[k,0])),food:100,clay:90,reed:45,wood:20,stone:0,hides:0,wool:0,cloth:0,clothing:0,brick:0,firedBrick:0,pottery:0,beer:0,faith:25,prestige:10},buildings:[{type:'house',x:8,y:8,level:1},{type:'house',x:9,y:9,level:1},{type:'field',x:12,y:8,level:1},{type:'clay',x:7,y:7,level:1},{type:'shrine',x:9,y:8,level:1}],cooldowns:emptyCooldowns(),buffs:emptyBuffs(),divinity:createDivinity(),citizens:[],deliveries:0,delivered:emptyResources(),lastDelivery:null,drought:0,rain:0,droughtSeen:false,memories:[],news:[],event:null,won:false,lost:false,continued:false,hungry:0,miracleCount:0,name:'Безымянный дух',achievements:[]};
 if(start!=='established'){s.buildings=starterHomes(s.resources);s.capacity=housingOf(s);}
 if(seed!==undefined)initializeGeneratedWorld(s,seed,{version:generationVersion});
 for(const b of s.buildings)stampBuildingCompletion(s,b);initializeProductionAccounting(s);
 initializeBuildingInventory(s);initializeEcology(s,{legacy:start==='established'});initializeGathering(s);initializeFestival(s);initializeWorld(s);ensureResourceSites(s);initializeTrade(s);initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeArtisans(s);initializeCrops(s);initializeFoodPlan(s);initializePests(s);syncPestSites(s);syncCitizens(s);for(const c of s.citizens)delete c.age;initializeDemography(s,{mixed:true});for(const c of s.citizens)c.mealEaten=mealRation(c);if(start!=='established')distributeFounders(s);syncCitizens(s);syncInventory(s);initializeDistricts(s);initializeWater(s);initializeGodhood(s,{mode});initializeCatFishing(s);initializeCatDiscovery(s);initializeLifeAnalytics(s);snapshotLifeAnalytics(s);initializeRelicQuest(s);syncSacredUnlocks(s);log(s,'У города появился покровитель',start==='established'?'Двенадцать жителей оставили у реки первое подношение. Храм принимает первые грузы; рабочие отправляются на поля и в карьер.':isStrictSumer(s)?'Пять сырцовых домов с плоскими крышами дали кров двенадцати жителям. Еда и материалы хранятся внутри домов; первые мастерские и поля ещё предстоит построить.':'Пять сырцовых домов-ульев дали кров двенадцати жителям. Еда и материалы хранятся внутри домов; первые мастерские и поля ещё предстоит построить.','good');return s;
}
export const count=(s,type)=>s.buildings.filter(b=>b.type===type&&isComplete(b)).length;
export const storage=storageOf;
export function workers(s){const needed=s.buildings.filter(b=>isComplete(b)&&Object.keys(BUILDINGS[b.type].output).length).reduce((n,b)=>n+(b.type==='musicHouse'?1:2),0);return needed?Math.min(1,workforceStats(s).employed/needed):1;}
export function buildingAt(s,x,y){return s.buildings.find(b=>occupiesCell(b,x,y))||s.buildings.find(b=>{if(b.type!=='bridge')return false;const p=riverLocal(x,y,s),span=bridgeSpanAt(b,s);return p.along===span.y-.5&&terrain(x,y,s)==='water'&&p.across>=span.left&&p.across<=span.right;});}
export function canBuild(s,type,x,y,placementOnly=false,rotation=0,{householdInitiative=false}={}){
 if(!placementOnly&&s.miracleCelebration)return miracleCelebrationReason(s);
 if(!placementOnly&&relicControlActive(s))return relicCommandReason(s);
 const knowledge=type==='house'&&householdInitiative&&isStrictSumer(s)?'':buildingKnowledgeReason(s,type);if(knowledge)return knowledge;
 if(BUILDINGS[type]?.unique&&s.buildings.some(b=>b.type===type))return 'Эта уникальная постройка уже заложена';
 if(!validRotation(type,rotation))return 'Недопустимый поворот здания';
 const b=buildingDefinition(s,type);if(!b)return 'Неизвестная постройка';if(!placementOnly&&s.lost)return 'Поселение покинуто';if(!placementOnly&&s.event)return 'Сначала реши судьбу события';if(terrain(x,y,s)==='void')return 'За пределами долины';if(buildingAt(s,x,y))return 'Эта клетка уже занята';
 if(type==='bridge'){
  if(terrain(x,y,s)!=='water'||terrain(x,y,{world:{...s.world,lakes:[]}})!=='water')return 'Выбери клетку воды: мост соединит оба берега';
  if(s.buildings.some(b=>b.type==='bridge'&&riverLocal(b.x,b.y,s).along===riverLocal(x,y,s).along))return 'На этом участке уже есть мост';
 }else if(terrain(x,y,s)==='water')return 'На воде можно построить мост';
 if(type==='levee'&&(!isStrictSumer(s)||Math.abs(signedRiverDistance(x,y,s))>=3.5))return 'Береговой вал строится на суше у реки в Южном Шумере';
 if(type==='quarry'&&stoneRemaining(s,x,y)<=1e-8&&nearDeposit(s,'stone',x,y))return 'Месторождение камня исчерпано';
 if(type==='clay'&&clayRemaining(s,x,y)<=1e-8&&nearDeposit(s,'clay',x,y))return 'Залежь глины исчерпана';
 if(type==='harbor'&&!isRiverBank(s,x,y))return 'Пристани нужен сухой берег главной реки, не озеро';
 if(type==='field'&&!fieldWater(s,{x,y}).productive)return 'Полю нужна приречная земля или готовый канал с водой рядом';
 if(['clay','reed','quarry','logging','hunting','garden'].includes(type)&&!nearDeposit(s,({quarry:'stone',logging:'forest',hunting:'wildlife',garden:'dates'})[type]||type,x,y))return type==='garden'?'Нужен отмеченный финиковый участок':'Нужно отмеченное месторождение';
 if(['fishing','waterpoint'].includes(type)&&!isShore(s,x,y))return 'Нужна сухая клетка у воды';
 const footprint=newFootprint(type),prospective={type,x,y,...footprint>1?{footprint}:{}},cells=footprintCells(prospective);
 if(cells.some(p=>relicSiteReserved(s,p.x,p.y)))return 'Здесь лежит уникальная реликвия: сначала найди печать земли';
 if(footprint>1){
  if((s.roads||[]).some(r=>[r.a,r.b].some(p=>insideFootprint(prospective,p.x,p.y))))return `Выбери площадку ${footprint} × ${footprint} без улицы внутри`;
  if(type==='ziggurat'&&s.buildings.some(b=>b.type===type))return 'Зиккурат уже построен';
  for(const cell of cells){if(['water','void'].includes(terrain(cell.x,cell.y,s)))return `Постройке «${b.name}» нужна сухая площадка ${footprint} × ${footprint}`;if(buildingAt(s,cell.x,cell.y))return `Для постройки «${b.name}» нужны ${footprint**2} свободных клеток`;}
 }
 if(isCityFortification(type)){
  const current=fortificationAccess(s.buildings),planned=fortificationAccess([...s.buildings,{...prospective,rotation,construction:{kind:'new'}}]);
  if(s.citizens.some(c=>(!current||current.pointClear(c))&&!planned.pointClear(c)))return 'Дождись, пока жители освободят площадку';
 }
 if(!placementOnly&&(b.prestige||0)>s.resources.prestige)return `Нужно ${b.prestige} престижа`;
 for(const k of [...MATERIALS,'faith'])if(!placementOnly&&(b[k]||0)>s.resources[k])return `Не хватает: ${RESOURCE_NAMES[k]}`;
 return '';
}
export const canPlace=(s,type,x,y,rotation=0)=>canBuild(s,type,x,y,true,rotation);
export function build(s,type,x,y,rotation=0,{eligibleStores,humanWaterProject,householdInitiative}={}){const reason=canBuild(s,type,x,y,false,rotation,{householdInitiative});if(reason)return {ok:false,reason};const order=nextOrder(s);if(order===null)return {ok:false,reason:'Достигнут предел номеров стройки'};const creatorAllocations={};const sources=reserveStock(s,BUILDINGS[type],{eligibleStores,creatorAllocations});if(!sources)return {ok:false,reason:'Не хватает материалов'};if(type==='canal')retireDepthPressure(s,x,y);retireStarForecastAt(s,x,y);s.resources.faith-=BUILDINGS[type].faith||0;s.buildings.push({type,x,y,level:1,rotation,...humanWaterProject?{humanWaterProject}:{},...householdInitiative?{starterHut:true,householdInitiative}:{},...(newFootprint(type)>1?{footprint:newFootprint(type)}:{}),construction:{...createOrder(BUILDINGS[type]),sources,allocations:structuredClone(sources),...(Object.keys(creatorAllocations).length?{creatorAllocations}:{}),order}});s.nextConstructionOrder=order+1;initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeArtisans(s);initializeCrops(s);s.capacity=housingOf(s);syncCitizens(s);initializeWater(s);log(s,`Заложено: ${buildingDefinition(s,type).name}`,'Материалы зарезервированы. Жители доставят их и возведут здание.','build');check(s);return {ok:true};}

export function canUpgrade(s,b,{joinery=false}={}){if(s.godhood?.namelessEndingAt!==undefined)return cityCommandReason(s);if(s.miracleCelebration)return miracleCelebrationReason(s);if(relicControlActive(s))return relicCommandReason(s);if(!b)return 'Выбери здание';const key=buildingKey(b);if(s.festival&&(s.festival.temple===key||s.festival.allocations[key]))return 'Сначала заверши или отмени праздник: здесь зарезервировано угощение';const knowledge=buildingKnowledgeReason(s,b.type,levelOf(b)+1);if(knowledge)return knowledge;if(isCityFortification(b.type)||['canal','levee'].includes(b.type))return 'У сооружения один уровень';if(b.construction)return 'Строительство уже идёт';if(s.event||s.lost)return 'Сначала заверши событие';if(levelOf(b)>=3)return 'Достигнут третий уровень';if(joinery&&(!isStrictSumer(s)||!joineryUpgradeTypes.includes(b.type)))return 'Готовые детали доступны для крупных построек Южного Шумера';const cost=joinery?joineryUpgradeCost(b):upgradeCost(b);if(MATERIALS.some(k=>(s.resources[k]||0)<(cost[k]||0)))return 'Нужно: '+Object.entries(cost).map(([k,n])=>`${n} ${RESOURCE_NAMES[k]}`).join(', ');return '';}
export function upgrade(s,x,y,{joinery=false}={}){const b=buildingAt(s,x,y),reason=canUpgrade(s,b,{joinery});if(reason)return {ok:false,reason};const order=nextOrder(s);if(order===null)return {ok:false,reason:'Достигнут предел номеров стройки'};const cost=joinery?joineryUpgradeCost(b):upgradeCost(b);const sources=reserveStock(s,cost);if(!sources)return {ok:false,reason:'Не хватает материалов'};retireStarForecastAt(s,x,y,'construction');b.construction={...createOrder(cost,levelOf(b)+1,'upgrade'),...joinery?{joinery:true}:{},sources,allocations:structuredClone(sources),order};s.nextConstructionOrder=order+1;s.capacity=housingOf(s);syncCitizens(s);log(s,`Улучшение: ${buildingDefinition(s,b.type).name}`,'Строители доставят материалы. Прежний уровень работает до завершения.','build');check(s);return {ok:true};}
export function repairFloodDamage(s,b){
 if(!isStrictSumer(s)||!b?.floodDamage||!['house','road'].includes(b.type)||!constructionEntities(s).includes(b))return {ok:false,reason:'Выбери повреждённый дом или дорогу'};
 return orderSiteWork(s,b,'repair',floodRepairCost(b));
}
export function repairHarborBoat(s,b,{joinery=false}={}){
 if(!isStrictSumer(s)||b?.type!=='harbor'||!b.boatWear||!s.buildings.includes(b))return {ok:false,reason:'Выбери пристань, где требуется обслуживание'};
 return orderHarborWork(s,b,'repair',joinery?joineryBoatCost('repair'):boatRepairCost,joinery);
}
export function buildHarborTender(s,b,{joinery=false}={}){
 if(!isStrictSumer(s)||b?.type!=='harbor'||!isComplete(b)||b.boatTender||!s.buildings.includes(b))return {ok:false,reason:'Нужна готовая пристань без перегрузочной лодки'};
 return orderHarborWork(s,b,'boat',joinery?joineryBoatCost('boat'):boatTenderCost,joinery);
}
function orderHarborWork(s,b,kind,cost,joinery){
 const preview={...s,roads:[...s.roads]},access=marketAccess(preview,buildingKey(b),'harbor');
 if(!access)return {ok:false,reason:'Нужен проходимый путь от пристани к складу и жилому двору'};
 const network=networkFor(preview),group=network.components.get(access.p.key);
 const stores=new Set(network.ports.filter(p=>network.components.get(p.key)===group).map(p=>buildingKey(p.building)));
 return orderSiteWork(s,b,kind,cost,stores,joinery);
}
function orderSiteWork(s,b,kind,cost,eligibleStores,joinery=false){
 if(s.miracleCelebration||relicControlActive(s)||s.event||s.lost||s.funeral&&s.funeral.scope!=='family')return {ok:false,reason:'Сначала заверши текущее событие'};
 if(b.construction)return {ok:false,reason:'Работы уже идут'};
 const order=nextOrder(s);
 if(order===null)return {ok:false,reason:'Достигнут предел номеров стройки'};
 const sources=reserveStock(s,cost,{eligibleStores});
 if(!sources)return {ok:false,reason:'Не хватает материалов'};
 if(s.buildings.includes(b))retireStarForecastAt(s,b.x,b.y,'construction');
 b.construction={...createOrder(cost,b.level,kind),...joinery?{joinery:true}:{},sources,allocations:structuredClone(sources),order};
 s.nextConstructionOrder=order+1;
 syncCitizens(s);
 return {ok:true};
}
export function yieldSummary(s,b){
 const level=levelOf(b),def=BUILDINGS[b.type];if(b.type==='field'&&Number.isInteger(b.x))return cropSummary(s,b)+' · 2 рабочих места';if(b.type==='house')return `${b.starterHut&&level===1?buildingPresentation(s,b).name+' · только улучшение или снос · ':''}Жильё: ${capacityOf(b)} жителей`;
 if(b.type==='garden'&&isStrictSumer(s)&&(!Number.isInteger(b.x)||b.construction?.kind==='new'))return 'После посадки: первый урожай через 4 смены сезона, полный через 12';
 if(b.type==='garden'&&b.orchardPlantedTick!==undefined){
  const stage=orchardMaturity(s,b),food=(def.output.food*outputMultiplier(b)*stage.yield).toLocaleString('ru-RU',{maximumFractionDigits:2});
  return `${stage.label} · ${food} еды за рейс · 2 рабочих места · +${2+2*level} довольства`;
 }
 if(b.type==='levee')return 'Земляной вал · замкни разрывы вдоль берега';
 if(b.type==='canal')return !Number.isInteger(b.x)?'Соединяй участки от реки или озера · полив соседних полей':b.construction?'Вода появится после завершения связного пути от реки или озера':b.silt>=.95?'Русло перекрыто илом · закажи расчистку':irrigationFor(s).wet.has(`${b.x},${b.y}`)?'Канал наполнен · полив по доступным долям':'Сухое русло · проверь источник и участки выше по течению';
 if(b.type==='pottery')return `4 глины + 2 воды + 2 тростника → 2 керамики · формовка ${(5/outputMultiplier(b)).toFixed(1)} с · труд ×${outputMultiplier(b)} · сушка 12 с · обжиг 12 с · остывание 6 с`;
 if(b.type==='bakery')return '4 еды + 2 воды + 2 тростника → 5 еды · помол и выпечка · семенной резерв защищён';
 if(b.type==='brewery')return `4 еды + 3 воды → 3 напитка · ${(15/outputMultiplier(b)).toFixed(1)} с труда · труд ×${outputMultiplier(b)} · 1 сосуд на 4 партии · семенной резерв защищён`;
 if(b.type==='kiln')return `4 сырца + 3 тростника → 4 обожжённых · обжиг ${(20/outputMultiplier(b)).toFixed(1)} с + остывание ${(8/outputMultiplier(b)).toFixed(1)} с`;
 if(b.type==='brickyard')return '4 глины + 1 тростник + 2 воды → 4 сырца · сушка на солнце 30 с · 2 работника';
 if(b.type==='musicHouse')return `1 вдохновлённый музыкант · ${def.workTime} с игры → ${(def.output.prestige*outputMultiplier(b)).toLocaleString('ru-RU')} престижа · тихая музыка и отдых соседей`;
 if(b.type==='ishtarGate')return s.inannaDiscovery?'Священный порог для истории «Покров Инанны»':`Уникальные культовые ворота · после завершения открывают чудо «${MIRACLES.inannaProtection.name}»`;
 if(b.type==='waterpoint')return 'Вода домам и кирпичным дворам · 2 водоноса';
 if(b.type==='healer')return `1 обученный лекарь · ${1+level} места · база ${1+(level-1)*.5} здоровья/с · требуется обучение в храме`;
 if(b.type==='harbor')return `Грузовые лодки · 2 носильщика · до ${4+2*level} ед. за рейс`;
 if(b.type==='market')return `Приём караванов · 2 носильщика · до ${4+2*level} ед. груза за рейс`;
 if(b.type==='granary')return `+${150*level} хранения каждого материала · принимает все грузы`;
 if(b.type==='bridge')return `Соединяет берега · скорость на мосту ×${(1+(level-1)*.25).toFixed(2)}`;
 const output=Object.entries(def.output).map(([k,n])=>`${(n*outputMultiplier(b)).toFixed(n<1?2:1)} ${RESOURCE_NAMES[k]}`).join(' + ');
 return `${b.type==='field'?(Number.isInteger(b.x)?fieldWater(s,b).label:'Приречная земля или полив из канала')+' · ':''}${output} за рейс работника · 2 рабочих места${b.type==='garden'?` · +${2+2*level} довольства`:''}`;
}
function freeArrivalBeds(s){
 const vacant=arrivalHousing(s).reduce((total,row)=>total+row.beds,0);
 const pending=Math.max(0,s.population-s.citizens.length);
 return Math.max(0,vacant-pending);
}
export function populationMiracleQuote(s,id){
 const limit=id==='bless'?3:id==='healing'&&!s.arrivalHospitality?6:0;
 if(!limit)return null;
 const count=Math.min(limit,freeArrivalBeds(s));
 return {count,reason:!count&&s.happiness>=100?'Довольство уже максимальное. Для новых жителей нужно свободное жильё.':''};
}
export function miracle(s,id,target){
 if((s.miracleCelebration||['cat','fertility'].includes(id))&&miracleCelebrationReason(s))return {ok:false,reason:miracleCelebrationReason(s)};
 if(relicControlActive(s))return {ok:false,reason:relicCommandReason(s)};const lock=miracleKnowledgeReason(s,id)||miracleLockReason(s,id);if(lock)return {ok:false,reason:lock};
 const m=MIRACLES[id],price=miraclePrice(s,id);if(!m)return {ok:false,reason:'Неизвестное чудо'};if(s.event||s.lost)return {ok:false,reason:'Сначала заверши текущее событие'};if(s.cooldowns[id])return {ok:false,reason:`Будет доступно через ${s.cooldowns[id]} сез.`};if(s.resources.faith<price)return {ok:false,reason:`Нужно ${price} веры`};if(id==='cat'&&catReason(s))return {ok:false,reason:catReason(s)};if(id==='abundance'&&!s.abundanceGift&&s.resources.food>=storage(s))return {ok:false,reason:'Амбары уже полны'};
 if(s.funeral&&['bless','healing'].includes(id))return {ok:false,reason:'Дождись возвращения траурной процессии'};
 const populationQuote=populationMiracleQuote(s,id);
 if(populationQuote?.reason)return {ok:false,reason:populationQuote.reason};
 if(['cat','fertility'].includes(id)){const reason=miracleCelebrationTargetReason(s,id==='fertility'?target:null);if(reason)return {ok:false,reason};}
 const fishing=id==='richCatch'?richCatchQuote(s,target):null;
 if(fishing?.reason)return {ok:false,reason:fishing.reason};
 if(id==='fertility'&&!startMiracleCelebration(s,id,{center:target}))return {ok:false,reason:'Нет безопасного места для церемонии'};
 if(id==='cat'&&!bringCat(s))return {ok:false,reason:'Нет безопасного двора для кошки'};
 if(id==='cat'&&usesCatDiscovery(s)&&s.catDiscovery.trial==='ready'){s.catDiscovery.trial='spent';s.catDiscovery.usedAt=s.simTime;}
 if(id==='abundance'&&s.abundanceGift){
  const gift=receiveAbundance(s,target);
  if(!gift.ok)return gift;
 }
 const peace=id==='peace'&&s.peaceDiscovery?peaceQuote(s,target):null;
 if(peace?.reason)return {ok:false,reason:peace.reason};
 if(peace&&target.ids!==undefined&&(!Array.isArray(target.ids)||target.ids.length!==peace.ids.length||
  target.ids.some((id,i)=>id!==peace.ids[i])))return {ok:false,reason:'Список жителей изменился. Проверь квартал перед применением'};
 if(id==='healing'&&s.arrivalHospitality){
  if(s.arrivalGroup)return {ok:false,reason:'Группа уже в пути'};
  if(!reserveArrival(s,networkFor(s),target))return {ok:false,reason:'Условия приёма изменились. Проверь жильё, путь и провизию'};
 }
 if(id==='shaping'&&s.shapingProjects){
  const batch=createShapingBatch(s,target,{connected:(from,to)=>connectedStores(s,from,to)});
  if(!batch.ok)return batch;
  s.district.lastScan=-1;
 }
 if(id==='revelation'&&s.revelationEvidence){
  const advice=revelationAdviceQuote(s,target?.branch);
  if(!advice.ok)return advice;
  if(advice.note)s.revelationEvidence.advice=advice.note;
 }
 const depthCanal=id==='relicAwakening'?depthCanalTarget(s,target):null;
 const depthIntake=id==='relicAwakening'?depthWaterpointTarget(s,target):null;
 if(id==='earthMemory'&&s.landMemoryCast)return {ok:false,reason:'Дождись последнего сезонного отклика'};
 const land=id==='earthMemory'&&s.landMemoryChapter===1?landMemoryCastQuote(s):null;
 if(land&&!land.ids.length)return {ok:false,reason:'У сохранённых историй пока нет живых участников'};
 if(land)s.landMemoryCast=land;
 if(depthIntake)depthIntake.waterReserve=WATERPOINT_CAPACITY;
 if(depthCanal)s.depthSupply.pressure={x:depthCanal.x,y:depthCanal.y,tick:s.tick};
 const populationBefore=s.population,happinessBefore=s.happiness;
 s.resources.faith-=price;s.cooldowns[id]=m.cooldown;s.miracleCount++;
 if(!s.memories.includes('first')){s.memories.push('first');log(s,'Первое чудо','Люди запомнят этот день. У святилища зажгли огни.','good');}
 const oldName=s.name;registerMiracle(s,m.domain,peace?{ids:peace.ids,mood:PEACE_MOOD}:land?{ids:land.ids}:undefined);
 if(id==='cat'){const first=s.pests.cats.length===1;log(s,'Бог привёл кошку',first?'Первая кошка пришла по твоей воле и охраняет хранилище.':'Ещё одна кошка охотится у незащищённого хранилища.','good');}
 if(id==='rain'){recordRainCast(s);if(s.drought){if(!s.memories.includes('rain'))s.memories.push('rain');log(s,'Дождь победил засуху','Поля ожили. Люди запомнят, как ты вернул воду.','good');}s.drought=0;s.rain=2;}
 if(fishing)startRichCatch(s,fishing.yard);
 if(id==='abundance'&&!s.abundanceGift)s.resources.food=Math.min(storage(s),s.resources.food+ABUNDANCE_LIMIT);
 if(id==='bless'||id==='healing'){affectResidents(s,{mood:id==='bless'?12:7});s.happiness=Math.min(100,s.happiness+(id==='bless'?15:10));s.population+=populationQuote?.count??0;}
 if(['fertility','inspiration','haste','sunlight'].includes(id))s.buffs[id]=3;
 if(id==='sunlight'){affectResidents(s,{mood:7});s.happiness=Math.min(100,s.happiness+10);}
 if(id==='revelation'){if(!s.revelationEvidence)s.resources.faith+=20;s.resources.prestige+=12;}
 if(id==='stars'){s.resources.prestige+=18;if(s.starObservations)recordStarForecast(s);}
 if(peace){
  s.peaceDiscovery.lastCast={x:target.x,y:target.y,at:s.simTime,ids:peace.ids};
  const keepsakes=s.peaceDiscovery.keepsakes??=[];
  if(!keepsakes.includes(peace.ids[0]))keepsakes.push(peace.ids[0]);
  if(keepsakes.length>80)keepsakes.shift();
 }
 else if(id==='peace'){affectResidents(s,{mood:22});s.happiness=Math.min(100,s.happiness+25);}
 if(id==='shaping'&&!s.shapingProjects){s.resources.clay+=60;s.resources.reed+=40;}
 applySacredMiracle(s,id);log(s,m.name,id==='revelation'&&s.revelationEvidence?'Получено 12 престижа.':id==='shaping'&&s.shapingProjects?'У двора сложена партия из 60 глины и 40 тростника.':id==='healing'&&s.arrivalGroup?`Из-за края долины вышла группа · ${s.arrivalGroup.count} чел.`:peace?`Поддержаны жители квартала · ${peace.ids.length} чел.`:depthCanal?'Дождь и дополнительная доля воды в выбранной сети каналов до конца сезона.':depthIntake?'Дождь и полный запас воды в выбранном водозаборе. Водоносы доставят воду.':land?`Поддержаны живые участники историй · ${land.ids.length} чел.`:m.desc,'miracle');if(s.name!==oldName)log(s,`Новое имя: ${s.name}`,'Люди называют тебя по твоим деяниям. Все заслуженные имена остаются в пантеоне.','good');syncCitizens(s);syncLifeAnalytics(s);check(s);
 const receipt={faithSpent:price};
 if(id==='bless'||id==='healing')receipt.population={newResidents:s.population-populationBefore,
  happiness:s.happiness-happinessBefore,reserved:id==='healing'?s.arrivalGroup?.count??0:0};
 recordMiracleCast(s,id,receipt);
 return {ok:true,receipt};
}
function check(s){
 s.capacity=housingOf(s);
 if(s.population<=0){s.population=0;s.lost=true;s.event=null;syncCitizens(s);return;}
 advanceCreatorEvidence(s);
 if(advanceFieldGrain(s))log(s,'Три поля дали зерно','Склад принял урожай с трёх действующих полей. Открылось чудо «Дыхание земли».','good');
 if(advanceBlessingDiscovery(s))log(s,'Соседи поддержали друг друга','Три двора обеспечены едой и водой, две доставки помощи подтверждены. Условия истории «Благословение» выполнены.','good');
 advanceArrivalOpening(s);
 if(advanceMonumentChapter(s))log(s,'Поздняя глава · Великий зиккурат','Город вступил в эпоху монументального строительства. Следующая цель — возвести Великий зиккурат.','good');
 if(advanceForeignName(s)){
  const reported=s.foreignName.reportedAt!==null;
  log(s,reported?'Весть из-за реки':'Купцы увозят рассказ',reported?'Паломник хранит посвящение и имя в своём городе.':'Паломник вернулся к купцам. Их рассказ отправится за пределы долины.','good');
 }
 if(advanceCampaignChapter(s)){const chapter=campaignChapterView(s);log(s,'Глава '+chapter.title,chapter.condition,'good');}
 if(advanceMonumentLife(s))log(s,'Жизнь после монумента','Зиккурат открыт. Сохрани новое посвящение и исполни новый обет дворам.','good');
 const resultName=refreshResultName(s);
 if(resultName)log(s,'Город дал богу имя',resultName,'good');
 const unnamed=s.godhood?.mode==='awakening'&&s.godhood.stage!=='recognized',hasMiracles=usesResultNames(s)||unnamed||s.deaths>0||s.relicQuest?.phase==='completed'||s.landRelicQuest?.phase==='completed'||Object.values(s.divinity.domains).some(v=>v>0);
 if(s.population>=24&&!s.achievements.includes('population')){s.achievements.push('population');log(s,'Поселение стало городом','Двадцать четыре человека называют это место домом.','good');}
 if(s.resources.food>=150&&!s.achievements.includes('food')){s.achievements.push('food');if(!hasMiracles){s.name='Наполняющий амбары';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}log(s,'Полные амбары','Запас еды достиг 150. Город встречает будущее с надеждой.','good');}
 if(s.population>=30&&!s.achievements.includes('keeper')){s.achievements.push('keeper');if(!hasMiracles){s.name='Хранитель людей';if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);}}
 if(s.year>=10&&s.population>=30&&count(s,'ziggurat')&&!s.won){s.won=true;log(s,'Город коснулся неба','Великий зиккурат возвышается над долиной. Твоё имя останется в веках.','good');}
}
function settleSeason(s){
 syncLifeAnalytics(s);
 depositCanalSilt(s,irrigationFor(s));
 const previous=s.season,pasture=pastureCredits(s,previous);s.tick++;expireRichCatch(s);s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);changeCropSeason(s,previous);settleManagedFlocks(s,pasture);settleManagedDairy(s,pasture);advanceTrade(s);advanceMedicalYear(s);
 const spoiledMilk=settleMilkSpoilage(s);
 if(spoiledMilk>0)log(s,'Часть молока испортилась',`В запасах потеряно ${Number(spoiledMilk.toFixed(2))} ед. свежего молока. Сухой сыр остаётся в запасе еды.`,'bad');
 const flood=changeFloodSeason(s);
 if(flood==='warning')log(s,'Весной ожидается разлив','Проверь дороги и запасы под угрозой в обзоре города, в разделе «Работа».','bad');
 if(flood==='active'){
  log(s,'Река вышла из берегов','Жители ищут сухой путь в обход затопленных дорог.','bad');
  syncInventory(s);
  const footprint=floodFootprint(s,s.riverFlood);
  const homes=s.buildings.filter(b=>b.type==='house'&&isComplete(b)&&footprint.has(buildingKey(b)));
  const roads=floodedRoads(s,footprint);
  for(const b of [...homes,...roads])b.floodDamage=true;
  let weaveLost=0;
  for(const home of homes)if(home.householdStock?.mat>0){
   const lost=Math.min(1,home.householdStock.mat);
   home.householdStock.mat-=lost;weaveLost+=lost;
  }
  if(weaveLost>0)log(s,'Разлив повредил плетение',`Утрачено ${Number(weaveLost.toFixed(2))} ед. циновок и навесов. Жители пополнят их после ремонта домов.`,'bad');
  if(homes.length||roads.length)log(s,'Разлив повредил дома и улицы',`Домов: ${homes.length}, участков дорог: ${roads.length}. Ремонт заказывается в карточке на карте.`,'bad');
  const exposed=floodStorageRisk(s,footprint);
  let foodLost=0,jarsLost=0;
  for(const {key,loss,jars} of exposed){
   if(loss>0)foodLost+=takeStock(s,key,'food',loss);
   if(jars>0)jarsLost+=takeStock(s,key,'pottery',jars);
  }
  if(foodLost>0)log(s,'Разлив испортил запасы',`Сырость испортила ${Number(foodLost.toFixed(2))} ед. еды.`,'bad');
  if(jarsLost>0)log(s,'Разлив повредил тару',`Сосуды сохранили припасы. Треснувших сосудов списано: ${jarsLost}.`,'bad');
 }
 const dampHomes=new Set(s.buildings.filter(b=>b.type==='house'&&b.floodDamage).map(buildingKey));
 if(dampHomes.size)affectResidents(s,{mood:-4},s.citizens.filter(c=>dampHomes.has(c.home)).map(c=>c.id));
 if(flood==='ended')log(s,'Вода отступила','Проходы у берега снова открыты.','good');
 if(lowWaterYear(s)&&s.season===0)log(s,'Летом ожидается маловодье','Проверь поля и запасные водозаборы в обзоре города, в разделе «Работа».','bad');
 if(s.funeral&&s.funeral.scope!=='family'){syncCitizens(s);snapshotLifeAnalytics(s);check(s);return;}
 for(const k of Object.keys(s.cooldowns))s.cooldowns[k]=Math.max(0,s.cooldowns[k]-1);
 // Production is already in citizens' delivered cargo. Never credit it here.
 const hungry=s.citizens.filter(c=>c.hunger>=30);s.hungry=hungry.length?Math.max(...hungry.map(c=>c.missedMeals)):0;
 s.happiness=s.citizens.length?s.citizens.reduce((n,c)=>n+c.mood,0)/s.citizens.length:0;
 if(hungry.length)log(s,'Голод в семьях',`${hungry.length} жителей недоедают. Проверь домашние запасы и доставку еды.`,'bad');
 const victims=!s.funeral?s.citizens.filter(c=>c.health<=0&&c.missedMeals>=3&&recoverCitizenCargo(s,c.id)!==false):[];
 if(victims.length){const deceased=victims.map(c=>({id:c.id,name:citizenName(c.id),x:c.x,y:c.y}));mournResidents(s,victims.map(c=>c.id));for(const c of victims)recordLifeDeath(s,c,'starvation');const ids=new Set(victims.map(c=>c.id));s.citizens=s.citizens.filter(c=>!ids.has(c.id));s.population=s.citizens.length;s.deaths+=victims.length;syncCitizens(s);startFuneral(s,deceased);log(s,'Смерть от голода',`Погибли ${victims.length} жителей из семей, которым не хватало еды. Город провожает умерших.`,'bad');}
 if(!s.funeral||s.funeral.scope==='family'){const report=advanceGenerations(s,id=>{const citizen=s.citizens.find(c=>c.id===id);if(recoverCitizenCargo(s,id)===false)return false;if(citizen)recordLifeDeath(s,citizen,'oldAge');return true;});for(const c of report.newborns)recordLifeBirth(s,c);syncCitizens(s);if(report.deceased.length)startFuneral(s,report.deceased,{family:true});}
 if(s.funeral&&s.funeral.scope!=='family'){syncCitizens(s);snapshotLifeAnalytics(s);check(s);return;}
 if(s.buffs.earthMemory>0){
  const land=s.landMemoryCast;
  affectResidents(s,{mood:2,faith:1},land?.ids);
  if(land){
   const witnesses=[...new Set(land.stories.map(row=>citizenName(row.citizenId)))].join(', ');
   log(s,'Память земли · сезонный отклик',`Истории жителей: ${witnesses}. Осталось откликов: ${s.buffs.earthMemory-1}.`,'miracle');
   if(s.buffs.earthMemory===1)delete s.landMemoryCast;
  }
 }
 s.drought=Math.max(0,s.drought-1);s.rain=Math.max(0,s.rain-1);for(const k of Object.keys(s.buffs))s.buffs[k]=Math.max(0,s.buffs[k]-1);
 if(s.season===0){
  log(s,`Начался ${s.year}-й год`,`В городе ${s.population} жителей. В амбарах ${Math.floor(s.resources.food)} еды.`,'year');
  if(s.year===3||(!s.droughtSeen&&s.year>=4)){s.drought=3;s.droughtSeen=true;affectResidents(s,{faith:-8,mood:-7});log(s,'На долину опустилась засуха','Нужен полив ячменя: соедини поля с рекой каналами или призови Небесный дождь.','bad');}
  else if(!s.funeral&&s.year%5===0)s.event={id:'refugees',title:'Люди у городских ворот',text:'Три семьи покинули истощённые земли. Прими до шести жителей за 20 еды — если для них найдётся жильё.'};
  else if(s.year%3===1){s.resources.food+=Math.max(0,Math.min(30,storage(s)-s.resources.food));log(s,'Щедрый разлив','Река принесла плодородный ил. Общие амбары получили 30 еды.','good');}
  else if(!s.funeral)s.event={id:'festival',title:'Ночь тысячи огней',text:festivalInvitation()};
 }
 if(!s.event&&!s.funeral&&!s.festival&&s.tick>=6&&s.season===2){const events=['riverGift','potterVisit','wellRepair','harvestThanks','storyteller'];s.event=createCityEvent(s,events[(s.year-2)%events.length]);}
 syncCitizens(s);snapshotLifeAnalytics(s);check(s);
}
export function advanceTime(s,seconds,{calendarRate=calendarRateFor(s)}={}){
 if(!Number.isFinite(calendarRate)||calendarRate<=0||calendarRate>1)throw new RangeError('Invalid calendar rate');
 deferRelicEvent(s);
 if(s.godhood?.namelessEndingAt!==undefined&&s.event)resolveEvent(s,'skip');
 if(s.lost&&!s.funeral||s.event||!Number.isFinite(seconds)||seconds<=0)return 0;
 initializeProductionAccounting(s);syncInventory(s);let remaining=Math.min(seconds,3600),advanced=0;
 while(remaining>1e-7&&(!s.lost||s.funeral)&&!s.event){
  if(s.funeral&&relicControlActive(s))interruptRelicForFuneral(s);
  if(ceremonyActive(s)){const dt=Math.min(remaining,.1);if(s.miracleCelebration)advanceMiracleCelebration(s,dt);else if(s.funeral){advanceFestival(s,dt,{ceremony:true});advanceFuneral(s,dt);}else advanceFestival(s,dt,{ceremony:true});remaining-=dt;advanced+=dt;continue;}
  advanceSupplyVow(s);
  advanceAutonomousHousing(s);
  const vowRemaining=s.supplyVows?.active?s.supplyVows.active.deadline-s.simTime:Infinity;
  const dt=Math.min(remaining,(45-s.seasonElapsed)/calendarRate,vowRemaining,autonomousHousingBoundary(s)),worked=advanceWorkers(s,dt,{stopForCeremony:true,cropRate:s.calendarDaysPerMonth===DAYS_PER_MONTH?calendarRate:1});syncSacredUnlocks(s);advanceSupplyVow(s);s.seasonElapsed+=worked*calendarRate;if(calendarRate!==1)s.calendarOffset=(s.calendarOffset||0)+worked*(1-calendarRate);remaining-=worked;advanced+=worked;
  if(s.seasonElapsed>=45-1e-7*calendarRate){s.seasonElapsed=0;settleSeason(s);deferRelicEvent(s);}
 }
 if(s.godhood?.namelessEndingAt!==undefined&&s.event)resolveEvent(s,'skip');
 advanceEcology(s);syncInventory(s);check(s);return advanced;
}
export function advanceSeason(s){return advanceTime(s,(45-s.seasonElapsed)/calendarRateFor(s))>0;}
export const refugeeArrivalCount=s=>Math.min(6,freeArrivalBeds(s));
export function eventReason(s){if(!s.event)return 'Нет события';if(isAdditionalCityEvent(s.event.id))return cityEventReason(s);if(s.event.id==='festival')return festivalReason(s,{ignoreEvent:true});const price={caravan:35,refugees:20,festival:20}[s.event.id];if(availableFood(s)<price)return `Нужно ${price} еды`;if(s.event.id==='refugees'&&!refugeeArrivalCount(s))return 'Нет свободного жилья';return '';}
export function resolveEvent(s,choice){
 if(choice==='accept'&&s.godhood?.namelessEndingAt!==undefined)return {ok:false,reason:'История завершена: доступно наблюдение'};
 if(s.miracleCelebration)return {ok:false,reason:miracleCelebrationReason(s)};
 if(relicControlActive(s))return {ok:false,reason:relicCommandReason(s)};
 if(!s.event||!['accept','skip'].includes(choice))return {ok:false,reason:'Нет такого решения'};
 if(choice==='accept'&&s.event.id==='festival'){const event=s.event;s.event=null;const result=orderFestival(s);if(!result.ok){s.event=event;return result;}log(s,event.title,'Жители готовят угощение и вечерний сбор у храма.','good');syncCitizens(s);check(s);return result;}
 if(isAdditionalCityEvent(s.event.id)){const result=applyCityEvent(s,s.event.id,choice);if(!result.ok)return result;}
 else if(choice==='accept'){
  const reason=eventReason(s);if(reason)return {ok:false,reason};const id=s.event.id;s.resources.food-=id==='caravan'?35:20;
  if(id==='caravan'){s.resources.clay+=25;s.resources.reed+=20;}if(id==='refugees')s.population+=refugeeArrivalCount(s);
 }
 log(s,s.event.title,choice==='accept'?'Город принял твоё решение.':'Город сохранил запасы и продолжил свой путь.',choice==='accept'?'good':'info');s.event=null;syncCitizens(s);syncLifeAnalytics(s);check(s);return {ok:true};
}
export function goals(s){
 const list=[
  {label:'Построить новое поле',done:count(s,'field')>=2},
  {label:'Поселить 24 жителя',done:s.achievements.includes('population')},
  {label:'Спасти поля от засухи',done:s.memories.includes('rain')},
  {label:'Набрать 50 престижа',done:s.resources.prestige>=50}
 ];
 if(s.monumentChapter){
  list.push({label:monumentChapterReason(s)||'Открыта поздняя глава · Великий зиккурат',done:s.monumentChapter.openedAt!==null});
 }
 list.push({label:'Возвести зиккурат и встретить 10-й год с 30 жителями',done:s.won});
 return list;
}
export const encode=s=>{if(s?.resources&&Array.isArray(s.buildings))syncInventory(s);if(Array.isArray(s?.citizens)&&Array.isArray(s.lifeAnalytics?.people))syncLifeAnalytics(s);return JSON.stringify(s);};
export function decode(raw){
 try{
  const s=JSON.parse(raw),legacy=s?.version===1,old=s?.version<3,oldTrade=s?.version<4,oldLogistics=s?.version<5,oldMortality=s?.version<6,oldGenerations=s?.version<7,oldHouseholds=s?.version<8,oldWellbeing=s?.version<9,oldCalling=s?.version<10,oldEducation=s?.version<11,oldAgriculture=s?.version<12,oldPests=s?.version<13,oldFoodPlan=s?.version<14,oldInventory=s?.version<15,oldTextiles=s?.version<16,oldClothing=s?.version<17,oldBricks=s?.version<18,oldFiring=s?.version<19,oldMasonry=s?.version<20,oldArtisans=s?.version<22,oldGathering=s?.version<23,oldLifeAnalytics=s?.version<26,oldEcology=s?.version<27,oldBuildingInventory=s?.version<28,oldFlax=s?.version<31,oldBaskets=s?.version<32,oldMats=s?.version<33,oldCopper=s?.version<34,oldToolTypes=s?.version<35,oldJoinery=s?.version<36;
  if(!s||!Number.isInteger(s.version)||s.version<1||s.version>VERSION)return null;
  // Enroll old cities before any older migration rewrites the save version.
  if(s.version<30)s.scenario=legacyScenario();
  else if(!validateScenario(s.scenario))return null;
  if(s.cooldowns&&typeof s.cooldowns==='object'){s.cooldowns.inannaProtection??=0;s.cooldowns.relicAwakening??=0;s.cooldowns.earthMemory??=0;}if(s.buffs&&typeof s.buffs==='object'){s.buffs.inannaProtection??=0;s.buffs.earthMemory??=0;}
  if(legacy){
   s.version=VERSION;s.simTime=s.tick*45;s.seasonElapsed=0;s.citizens=[];s.deliveries=0;s.delivered=emptyResources();s.lastDelivery=null;s.buffs=emptyBuffs();s.divinity=createDivinity();
   if(s.memories?.includes('rain'))s.divinity.domains.water=1;
   if(!s.divinity.names.includes(s.name))s.divinity.names.push(s.name);
   s.cooldowns={...emptyCooldowns(),...s.cooldowns};
   if(Array.isArray(s.buildings))s.buildings=s.buildings.map(b=>({...b,level:1}));
  }
  if(old){
   const migrate=r=>{if(!r)return; r.food=(r.food||0)+(r.grain||0);delete r.grain;for(const k of MATERIALS)r[k]??=0;};
   migrate(s.resources);migrate(s.delivered);for(const c of s.citizens||[])if(c.cargo?.grain!==undefined){c.cargo.food=(c.cargo.food||0)+c.cargo.grain;delete c.cargo.grain;}
   if(s.lastDelivery?.cargo?.grain!==undefined){s.lastDelivery.cargo.food=(s.lastDelivery.cargo.food||0)+s.lastDelivery.cargo.grain;delete s.lastDelivery.cargo.grain;}
   for(const b of s.buildings||[])if(b.construction)b.construction.legacyPrice=true;
   s.version=VERSION;s.roads=[];s.rngState=117;
  }
  if(oldTrade){s.version=VERSION;delete s.trade;initializeTrade(s);}
  if(oldLogistics){s.version=VERSION;initializeTrade(s);}
  if(oldMortality){s.version=VERSION;initializeTrade(s);s.funeral=null;s.deaths=0;s.divinity.rating=s.miracleCount*2;s.divinity.inspirationAttempts=0;s.divinity.inspirationSuccesses=0;}
  if(oldPests){initializePests(s);s.cooldowns.cat??=0;syncPestSites(s);}
  if(oldTextiles){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.wool??=0;r.cloth??=0;}
   const c=s.trade?.caravan;if(c){for(const [k,base] of [['wool',4],['cloth',22]]){c.stock[k]??=0;c.prices[k]??={buy:base+2,sell:base};}}
   initializeTextiles(s);initializeBricks(s);initializeKilns(s);initializeArtisans(s);
  }
  if(oldClothing){for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.clothing??=0;const c=s.trade?.caravan;if(c){c.stock.clothing??=0;c.prices.clothing??={buy:54,sell:52};}initializeClothing(s);}
  if(oldBricks){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.brick??=0;
   const c=s.trade?.caravan;if(c){c.stock.brick??=0;c.prices.brick??={buy:10,sell:8};}
   for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction)b.construction.legacyBricks=true;
   initializeBricks(s);initializeKilns(s);initializeArtisans(s);initializeWater(s);
  }
  if(oldFiring){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.firedBrick??=0;
   const c=s.trade?.caravan;if(c){c.stock.firedBrick??=0;c.prices.firedBrick??={buy:18,sell:16};}
   for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction)b.construction.legacyFiring=true;
   for(const b of s.buildings||[])b.legacyFiringLevel=levelOf(b);
   initializeKilns(s);initializeArtisans(s);
  }
  if(oldMasonry){for(const b of s.buildings||[])b.legacyMasonryLevel=levelOf(b);for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction?.kind==='upgrade')b.construction.legacyMasonry=true;}
  if(oldArtisans){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.pottery??=0;r.beer??=0;}
   const c=s.trade?.caravan;if(c)for(const [k,base]of [['pottery',14],['beer',8]]){c.stock[k]??=0;c.prices[k]??={buy:base+2,sell:base};}
   initializeArtisans(s);
  }
  if(oldBuildingInventory){initializeBuildingInventory(s);for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)for(const k of MATERIALS)r[k]??=0;const c=s.trade?.caravan;if(c&&MATERIALS.includes('milk')){c.stock.milk??=0;c.prices.milk??={buy:3,sell:1};}}
  if(oldFlax){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.flax??=0;
   const c=s.trade?.caravan;if(c){c.stock.flax??=0;c.prices.flax??={buy:8,sell:6};}
  }
  if(oldBaskets){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.basket??=0;
   const c=s.trade?.caravan;if(c){c.stock.basket??=0;c.prices.basket??={buy:14,sell:12};}
  }
  if(oldMats){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r)r.mat??=0;
   const c=s.trade?.caravan;if(c){c.stock.mat??=0;c.prices.mat??={buy:16,sell:14};}
  }
  if(oldCopper){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.copper??=0;r.axe??=0;}
   const c=s.trade?.caravan;if(c){c.stock.copper??=0;c.stock.axe??=0;c.prices.copper??={buy:12,sell:10};c.prices.axe??={buy:36,sell:34};}
  }
  if(oldToolTypes){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.blade??=0;r.chisel??=0;}
   const c=s.trade?.caravan;if(c)for(const k of ['blade','chisel']){c.stock[k]??=0;c.prices[k]??={buy:36,sell:34};}
  }
  if(oldJoinery){
   for(const r of [s.resources,s.delivered,...(s.buildings||[]).map(b=>b.stock)])if(r){r.timber??=0;r.joinery??=0;}
   const c=s.trade?.caravan;if(c)for(const [k,sell]of [['timber',8],['joinery',24]]){c.stock[k]??=0;c.prices[k]??={buy:sell+2,sell};}
  }
  if(oldGathering&&s.gathering===undefined)initializeGathering(s);if(!validateGathering(s)||!validateFisheries(s))return null;
  if(s.world&&!validateWorld(s)||!validateMineralPits(s,'clay')||!validateMineralPits(s,'stone')||!validateForests(s)||!validateReedBeds(s))return null;
  if(oldEcology)initializeEcology(s,{legacy:true});
  if(!validateEcology(s))return null;
  initializeWorld(s);ensureResourceSites(s);
  const finite=(v,min=0,max=1e9)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const integer=(v,min=0,max=1e6)=>Number.isInteger(v)&&v>=min&&v<=max;
  if(!integer(s.tick)||!integer(s.year,1)||s.year!==1+Math.floor(s.tick/4)||s.season!==s.tick%4||!integer(s.population)||!integer(s.capacity)||!finite(s.happiness,0,100))return null;
  for(const k of Object.keys(emptyResources()))if(!finite(s.resources?.[k])||!finite(s.delivered?.[k]))return null;
 if(s.calendarDaysPerMonth!==undefined&&s.calendarDaysPerMonth!==DAYS_PER_MONTH)return null;
 if(!finite(s.simTime)||!finite(s.seasonElapsed,0,44.99999999)||!finite(s.calendarOffset??0)||Math.abs(s.simTime-(s.tick*45+s.seasonElapsed+(s.calendarOffset||0)))>.001||!integer(s.deliveries))return null;
  if(!Array.isArray(s.buildings)||s.buildings.length>worldWidth(s)*worldHeight(s))return null;
  if(!oldInventory&&!validateTrade(s))return null;
  if(!validateWorld(s)||!Number.isInteger(s.rngState)||s.rngState<0||s.rngState>4294967295||!Array.isArray(s.roads)||s.roads.length>worldWidth(s)*worldHeight(s)*4)return null;
  const roadIds=new Set();for(const r of s.roads){if(r.type!=='road'||!integer(r.level,1,3)||typeof r.id!=='string'||roadIds.has(r.id)||!r.a||!r.b||!finite(r.x,-.5,worldWidth(s))||!finite(r.y,-.5,worldHeight(s))||Math.abs(Math.abs(r.a.x-r.b.x)+Math.abs(r.a.y-r.b.y)-1)>1e-7||[r.a,r.b,{x:r.x,y:r.y}].some(p=>!isDryPoint(s,p.x,p.y))||r.id!==roadKey(r.a,r.b)||r.x!==(r.a.x+r.b.x)/2||r.y!==(r.a.y+r.b.y)/2)return null;roadIds.add(r.id);}
  const cells=new Set(),bridgeRows=new Set();
  for(const b of s.buildings){
   const key=buildingKey(b),land=terrain(b.x,b.y,s);if(b.starterHut!==undefined&&(b.type!=='house'||b.starterHut!==true))return null;if(b.rotation!==undefined&&!validRotation(b.type,b.rotation))return null;if(b.footprint!==undefined&&(newFootprint(b.type)===1||b.footprint!==newFootprint(b.type)))return null;
   if(!BUILDINGS[b.type]||land==='void'||cells.has(key)||!integer(b.level,1,3))return null;
   if(['linenYard','dairyStore','basketry','matYard','coppersmith','joineryYard'].includes(b.type)&&!isStrictSumer(s))return null;
   if(isCityFortification(b.type)&&(!isStrictSumer(s)||b.level!==1||b.construction?.kind==='upgrade'||b.type==='cityGate'&&b.footprint!==2))return null;
   if(b.joineryLevels!==undefined&&(!isStrictSumer(s)||!joineryUpgradeTypes.includes(b.type)||!Array.isArray(b.joineryLevels)||!b.joineryLevels.length||b.joineryLevels.some((v,i)=>!integer(v,2,b.level)||i>0&&v<=b.joineryLevels[i-1])))return null;
   if(b.legacyMasonryLevel!==undefined&&!integer(b.legacyMasonryLevel,1,b.level))return null;
   if(b.legacyFiringLevel!==undefined&&!integer(b.legacyFiringLevel,1,b.level))return null;
   if(b.type==='bridge'){if(land!=='water'||bridgeRows.has(riverLocal(b.x,b.y,s).along))return null;bridgeRows.add(riverLocal(b.x,b.y,s).along);}
   else if(land==='water'||b.type==='harbor'&&!isRiverBank(s,b.x,b.y)||['canal','levee'].includes(b.type)&&(b.level!==1||b.construction?.kind==='upgrade')||b.type==='levee'&&(!isStrictSumer(s)||Math.abs(signedRiverDistance(b.x,b.y,s))>=3.5))return null;
   for(const cell of footprintCells(b)){const k=`${cell.x},${cell.y}`;if(cells.has(k)||terrain(cell.x,cell.y,s)==='void'||b.type!=='bridge'&&terrain(cell.x,cell.y,s)==='water')return null;cells.add(k);}
  }
  if(s.roadAnchors!==undefined&&(!Array.isArray(s.roadAnchors)||s.roadAnchors.length>worldWidth(s)*worldHeight(s)||s.roadAnchors.some(b=>terrain(b.x,b.y,s)==='void'||!['road'].includes(b.type))))return null;
  if(s.buildings.filter(b=>b.type==='ziggurat').length>1||Object.entries(BUILDINGS).some(([type,def])=>def.unique&&s.buildings.filter(b=>b.type===type).length>1)||s.capacity!==housingOf(s)||s.population>s.capacity)return null;
  for(const [k,m]of Object.entries(MIRACLES))if(!(k==='richCatch'&&s.cooldowns?.[k]===undefined)&&!integer(s.cooldowns?.[k],0,m.cooldown))return null;
  for(const k of Object.keys(emptyBuffs()))if(!integer(s.buffs?.[k],0,3))return null;
  for(const k of ['drought','rain','hungry','miracleCount'])if(!integer(s[k]))return null;
  if(!validateMiracleHistory(s))return null;
  for(const k of ['droughtSeen','won','lost','continued'])if(typeof s[k]!=='boolean')return null;
  if(s.lost!==(s.population===0)||s.lost&&s.event!==null||s.continued&&!s.won)return null;
  if(typeof s.name!=='string'||s.name.length>100)return null;
  for(const k of ['memories','achievements'])if(!Array.isArray(s[k])||s[k].some(v=>typeof v!=='string'))return null;
  if(!s.divinity||!Array.isArray(s.divinity.names)||s.divinity.names.some(v=>typeof v!=='string'||v.length>100))return null;
  for(const k of Object.keys(createDivinity().domains))if(!integer(s.divinity.domains?.[k]))return null;
  if(s.funeral===undefined||!integer(s.deaths)||!validateFuneral(s))return null;
  for(const k of ['rating','inspirationAttempts','inspirationSuccesses'])if(!integer(s.divinity[k]))return null;
  if(s.divinity.inspirationSuccesses>s.divinity.inspirationAttempts)return null;
  if(!Array.isArray(s.news)||s.news.length>80||s.news.some(n=>typeof n.title!=='string'||typeof n.text!=='string'||!integer(n.year,1)||!integer(n.season,0,3)||typeof n.kind!=='string'))return null;
  if(s.event!==null&&(!s.event||!cityEventDefinition(s.event.id)||typeof s.event.title!=='string'||typeof s.event.text!=='string'))return null;
  if(legacy)syncCitizens(s);
  if(!Array.isArray(s.citizens)||s.citizens.length!==s.population)return null;
  const ids=new Set(),buildings=new Map(constructionEntities(s).map(b=>[buildingKey(b),b]));
  const point=p=>p&&finite(p.x,-.5,worldWidth(s)-.5)&&finite(p.y,-.5,worldHeight(s)-.5);
  for(const c of s.citizens){
   if(!integer(c.id)||ids.has(c.id)||!point(c)||(buildings.get(c.home)?.type!=='house'||!isComplete(buildings.get(c.home)))||!['toEveningGame','eveningGuest','toManualGathering','manualGathering','toCommonMeal','commonMeal','home','toWork','toWorkshop','working','toStore','returnWork','toHome','blocked','toSupply','toSite','constructing','waiting','unloading','toMarket','toSaleSupply','toSaleMarket','toPantrySupply','toPantryHome','toRest','resting','toHealer','treatment','toSchool','studying','toDistrictSupply','toDistrictStore','waterTrip','toCraftSupply','toClothesSupply','toClothesHome','festival','relic','relicGuest','awakening'].includes(c.phase))return null;
   if(c.basketCondition!==undefined&&(!isStrictSumer(s)||c.age<16||!integer(c.basketCondition,0,6)))return null;
   if(['toEveningGame','eveningGuest'].includes(c.phase)&&(!isStrictSumer(s)||c.age<16))return null;
   if(c.floodShelter!==undefined&&(typeof c.floodShelter!=='string'||!/^\d+,\d+$/.test(c.floodShelter)||c.phase!=='blocked'||!isStrictSumer(s)))return null;
   if(c.fireShelter!==undefined){
    const shelter=c.fireShelter;
    if(!isStrictSumer(s)||!shelter||c.floodShelter||c.phase!=='blocked'||shelter.host===c.home||
     buildings.get(shelter.host)?.type!=='house'||buildings.get(shelter.kiln)?.type!=='kiln'||
     shelter.returning!==undefined&&shelter.returning!==true||Object.keys(shelter).length!==2+Number(shelter.returning===true))return null;
   }
   if(c.recovering!==undefined&&typeof c.recovering!=='boolean')return null;
   if(c.clinic!=null&&(buildings.get(c.clinic)?.type!=='healer'||!isComplete(buildings.get(c.clinic))||!['toHealer','treatment','blocked'].includes(c.phase)||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||c.pantryTrip||c.tradeJob||c.saleJob))return null;
   if(['toHealer','treatment'].includes(c.phase)&&!c.clinic)return null;
   if(c.calling!==undefined&&!PROFESSION_IDS.includes(c.calling)||c.futureRole!==undefined&&(!ROLES.includes(c.futureRole)||c.age>=16||c.futureRole!==professionRole(c.calling)))return null;
   ids.add(c.id);if(c.saleJob!=null&&(!s.trade.sales.some(q=>q.id===c.saleJob&&q.market===c.saleMarket)||!['toSaleSupply','toSaleMarket','blocked','toHome','home'].includes(c.phase)))return null;
   if(c.tradeJob!=null&&(!s.trade.deliveries.some(q=>q.id===c.tradeJob&&q.market===c.tradeMarket)||!['toMarket','toStore','unloading','blocked','toHome','home','toRest','resting','toPantrySupply','toPantryHome'].includes(c.phase)))return null;
   if(c.role!==undefined&&!ROLES.includes(c.role)||c.pendingRole!==undefined&&!ROLES.includes(c.pendingRole)||c.siteDuty!=null&&!['carrier','builder'].includes(c.siteDuty))return null;
   if(c.workplace!=null&&(typeof c.workplace!=='string'||!isComplete(buildings.get(c.workplace)||{construction:{kind:'new'}})||!buildings.has(c.workplace)||!hasWorkplace(buildings.get(c.workplace).type)))return null;
   if(c.seedField!==undefined&&(typeof c.seedField!=='string'||buildings.get(c.seedField)?.type!=='field'||!isComplete(buildings.get(c.seedField))||c.work!==c.seedField||!finite(c.seedFood,0,6)||Object.values(c.cargo||{}).some(n=>n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||c.pantryTrip||c.saleJob||c.tradeJob||c.clinic||c.school||!['toStore','toWork','blocked','toHome','home','resting'].includes(c.phase)))return null;
   if(c.seedField===undefined&&c.seedFood!==undefined)return null;
   if(c.phase==='toWorkshop'&&(!c.work||!buildings.get(c.work)?.workshopStock||!Object.entries(c.cargo).some(([k,n])=>MATERIALS.includes(k)&&n>0)||c.districtJob||c.site||c.tradeJob||c.saleJob||c.pantryTrip||c.craftSite))return null;
   if(c.guardPost!=null&&(typeof c.guardPost!=='string'||!['shrine','granary','depot'].includes(buildings.get(c.guardPost)?.type)||!isComplete(buildings.get(c.guardPost))||c.workplace||c.age<16||!['auto','production'].includes(c.role)))return null;
   if(c.work!==null&&(!buildings.has(c.work)||!isComplete(buildings.get(c.work))||c.guardPost!==c.work&&buildings.get(c.work).type!=='canal'&&!hasWorkplace(buildings.get(c.work).type)))return null;
   if(c.store!==null&&!['shrine','granary','depot','house'].includes(buildings.get(c.store)?.type)&&buildings.get(c.store)?.recoveryOnly!==true&&!(c.districtJob&&s.district?.jobs.some(q=>q.id===c.districtJob&&(q.source===c.store||q.target===c.store))))return null;
   if(!Array.isArray(c.route)||c.route.length>worldWidth(s)*worldHeight(s)*2||c.route.some(p=>!point(p))||!integer(c.routeIndex,0,c.route.length)||!finite(c.workElapsed,0,60))return null;
   if(!c.cargo||typeof c.cargo!=='object'||Array.isArray(c.cargo)||Object.entries(c.cargo).some(([k,v])=>!(k in emptyResources())||!finite(v,0,1e6)))return null;
   if(c.phase==='home'&&Object.values(c.cargo).some(v=>v>0)||c.phase==='working'&&!c.work)return null;
   if(c.site!=null&&(!buildings.get(c.site)?.construction||typeof c.sitePort!=='string'||!c.store))return null;
   if(['toSupply','toSite','constructing','waiting'].includes(c.phase)&&!c.site)return null;
   if(c.buildCargo!==undefined&&(!c.buildCargo||typeof c.buildCargo!=='object'||Array.isArray(c.buildCargo)||Object.entries(c.buildCargo).some(([k,v])=>!MATERIALS.includes(k)||!finite(v,0,6))))return null;
   if(Object.values(c.buildCargo||{}).some(v=>v>0)&&(!c.site||!['toSite','blocked'].includes(c.phase)))return null;

  }
  if(s.nextConstructionOrder!==undefined&&!integer(s.nextConstructionOrder,1,MAX_CONSTRUCTION_ORDER+1))return null;
  for(const b of constructionEntities(s)){
   if(b.boatTender!==undefined&&(b.boatTender!==true||!isStrictSumer(s)||b.type!=='harbor'||!isComplete(b)))return null;
   if(b.boatWear!==undefined&&(b.boatWear!==true||!isStrictSumer(s)||b.type!=='harbor'||!isComplete(b)))return null;
   if(b.floodDamage!==undefined&&(b.floodDamage!==true||!isStrictSumer(s)||!['road','house'].includes(b.type)||!isComplete(b)))return null;
   const q=b.construction;if(!q)continue;
   if(q.order>=s.nextConstructionOrder||q.routeOrder>=s.nextConstructionOrder)return null;
   if(!validateRevelationTraining(s,b))return null;
   if(q.joinery!==undefined&&(q.joinery!==true||!isStrictSumer(s)||q.kind==='upgrade'&&(!joineryUpgradeTypes.includes(b.type)||q.legacyMasonry||q.legacyFiring||q.legacyBricks||q.legacyPrice)||q.kind!=='upgrade'&&(!['boat','repair'].includes(q.kind)||b.type!=='harbor')))return null;
   if(q.kind==='boat'&&(!isStrictSumer(s)||b.type!=='harbor'||b.boatTender))return null;
   if(['repair','boat'].includes(q.kind)&&(q.kind==='repair'&&!(b.floodDamage||b.boatWear)||['routeOrder','legacyMasonry','legacyFiring','legacyBricks','legacyPrice'].some(k=>q[k]!==undefined)))return null;
   if(!['new','upgrade','repair','boat'].includes(q.kind)||!integer(q.target,1,3)||q.target!==(q.kind==='new'?1:q.kind==='upgrade'?b.level+1:b.level)||q.kind==='new'&&b.level!==1||!finite(q.work,0,workRequired(b)))return null;
   if(q.routeOrder!==undefined&&(b.type!=='road'||!integer(q.routeOrder,0,1e9)))return null;
   if(q.priority!==undefined&&!integer(q.priority,0,2)||q.order!==undefined&&!integer(q.order,0,1e9))return null;
   const cost=q.joinery?(q.kind==='upgrade'?joineryUpgradeCost(b):joineryBoatCost(q.kind)):q.kind==='boat'?boatTenderCost:q.kind==='repair'?(b.type==='harbor'?boatRepairCost:floodRepairCost(b)):b.type==='road'?roadUpgradeCost(b):q.kind==='new'?BUILDINGS[b.type]:q.legacyMasonry?legacyUpgradeCost(b):upgradeCost(b);
   if(!q.required||!q.remaining||!q.delivered||[q.required,q.remaining,q.delivered].some(v=>Object.keys(v).some(k=>!MATERIALS.includes(k))))return null;
   if([q.remaining,q.delivered].some(v=>Object.keys(v).length!==Object.keys(q.required).length||Object.keys(v).some(k=>!(k in q.required))))return null;
   const expected=q.legacyPrice?{clay:cost.clay||0,reed:cost.reed||0}:{...cost,...q.legacyBricks?{brick:0}:{},...q.legacyFiring?{firedBrick:0}:{}};
   if(q.legacyMasonry!==undefined&&q.legacyMasonry!==true)return null;
   if(q.legacyFiring!==undefined&&q.legacyFiring!==true)return null;
   if(q.legacyBricks!==undefined&&q.legacyBricks!==true)return null;
   if(q.legacyPrice!==undefined&&q.legacyPrice!==true)return null;
   for(const k of MATERIALS){if((q.required[k]||0)!==(expected[k]||0))return null;}
   for(const k of Object.keys(q.required)){
    if(!integer(q.required?.[k])||!finite(q.remaining?.[k],0,q.required[k])||!finite(q.delivered?.[k],0,q.required[k]))return null;
    const carried=s.citizens.filter(c=>c.site===buildingKey(b)).reduce((n,c)=>n+(c.buildCargo?.[k]||0),0);
    if(Math.abs(q.required[k]-q.remaining[k]-q.delivered[k]-carried)>1e-7)return null;
   }
   if(q.work>0&&Object.keys(q.required).some(k=>q.delivered[k]<q.required[k]))return null;
  }
  const guardPosts=new Set();for(const c of s.citizens)if(c.guardPost){if(guardPosts.has(c.guardPost))return null;guardPosts.add(c.guardPost);}
  const permanent=new Map();for(const c of s.citizens)if(c.workplace){const b=buildings.get(c.workplace);if(!canStaffBuilding(c,b))return null;const n=(permanent.get(c.workplace)||0)+1;if(n>(['healer','granary'].includes(b.type)?1:2))return null;permanent.set(c.workplace,n);}
  if(s.lastDelivery!==null&&(!s.lastDelivery||!finite(s.lastDelivery.time,0,s.simTime)||!integer(s.lastDelivery.citizen)||typeof s.lastDelivery.store!=='string'||!s.lastDelivery.cargo||Object.entries(s.lastDelivery.cargo).some(([k,v])=>!(k in emptyResources())||!finite(v))))return null;
  if(oldGenerations){initializeDemography(s);s.version=VERSION;}
  if(oldHouseholds)s.version=VERSION;
  if(oldWellbeing){for(const c of s.citizens)if(c.pantryTrip){if(c.pantryTrip!==true||c.tradeJob!=null||c.saleJob!=null||Object.entries(c.cargo).some(([k,n])=>k!=='food'&&n>0)||Object.values(c.buildCargo||{}).some(n=>n>0)||!['toPantrySupply','toPantryHome','blocked'].includes(c.phase))return null;c.pantryFood=c.cargo.food||0;c.cargo={};}initializeWellbeing(s);s.version=VERSION;}
  if(oldCalling)for(const c of s.citizens){const role=c.pendingRole||c.role;if(role&&role!=='auto')c.calling??=role;}
  if(oldEducation)for(const c of s.citizens)if(buildings.get(c.work)?.type==='healer'){c.role='healer';if(!c.pendingRole)c.calling='healer';c.medicine=newMedicalSkill(s.year,1);}
  if(!validateManualGathering(s))return null;
  if(!validateEducation(s)||!validateDemography(s)||!validateHouseholds(s)||!validateCommonMeals(s)||!validateFamilyCare(s)||!validateWellbeing(s)||!validateEveningGames(s))return null;
  if(s.funeral&&!s.funeral.style){const deceased=s.funeral.deceased;s.funeral=null;startFuneral(s,deceased);}
  if(s.cropCalendar!==undefined&&(s.cropCalendar!==AUTUMN_CROPS||!isStrictSumer(s)))return null;
  if(oldFoodPlan)initializeFoodPlan(s);if(!validateMonumentChapter(s)||!validateCrops(s)||!validateRainDiscovery(s)||!validateFieldSoil(s)||!validateRiverFlood(s)||!validateFoodPlan(s))return null;initializeCrops(s,{legacy:oldAgriculture});
  initializeFestival(s,{legacy:true});if(!validateFestival(s)||!validateSunlightFeast(s)||!validateSunlightService(s)||!validateMiracleCelebration(s))return null;
  if(!validatePests(s)||!validateTextiles(s)||!validateClothing(s)||!validateArtisans(s)||!validateKilns(s)||!validateBricks(s)||!validateWater(s))return null;
  if(oldInventory){syncInventory(s);initializeDistricts(s);const central=stockStores(s)[0];if(!central)return null;const key=buildingKey(central);for(const b of constructionEntities(s)){const q=b.construction;if(q){q.sources={[key]:{...q.remaining}};q.allocations={[key]:{...q.required}};}}for(const q of s.trade.sales){q.sources={[key]:{[q.resource]:q.remaining}};q.allocations={[key]:{[q.resource]:q.amount}};}}
  if(!validateBuildingChronology(s)||!validateOrchards(s)||!validateCitizenEpithets(s)||!validateProductionHistory(s)||!validateStockAccounts(s)||!validateCityLabor(s)||!validateCanalMaintenance(s)||!validateDairy(s)||!validateBuildingInventory(s)||!validateInventory(s)||!validateDistricts(s)||!validateVotiveOfferings(s)||!validateTrade(s))return null;
  for(const b of constructionEntities(s)){const q=b.construction;if(q&&!validSources(s,q.sources,q.remaining)||q&&!validSources(s,q.allocations,q.required))return null;}

  if(s.event?.id==='festival')s.event.text=festivalInvitation();
  if(oldLifeAnalytics)initializeLifeAnalytics(s);
  if(!validateLifeAnalytics(s)||!validateSupplyVows(s)||!validateHumanProjects(s)||!validateHouseholdInitiatives(s)||!validateCausalFacts(s)||!validateRevelationEvidence(s)||!validateStarObservations(s)||!validateDepthSupply(s)||!validateLandMemory(s)||!validateInannaDiscovery(s)||!validateBlessingDiscovery(s)||!validatePeaceDiscovery(s)||!validateFieldGrain(s)||!validateFishProvenance(s)||!validateRichCatch(s)||!validateCreatorMaterials(s)||!validateShapingProjects(s)||!validateShapingModel(s)||!validateShapingBatches(s)||!validateWindDelivery(s)||!validateAbundanceGift(s)||!validateAbundanceOrigin(s)||!validateAbundanceDiscovery(s))return null;
  initializeRelicQuest(s,{reconcileUnusedSite:true});initializeSacredUnlocks(s);if(!validateCampaignChapter(s)||!validateHearthEnding(s)||!validateWaterEnding(s)||!validateCraftEnding(s)||!validateCityEnding(s)||!validateMonumentLife(s)||!validateForeignName(s)||!validateGodhood(s)||!validateExternalGuest(s)||!validateArrivalHospitality(s)||!validateRelicQuest(s)||!validateSacredUnlocks(s)||!validateMusic(s)||!validateCatFishing(s)||!validateCatDiscovery(s))return null;
  s.version=VERSION;return s;
 }catch{return null;}
}

export function validSources(s,sources,expected){if(!sources||typeof sources!=='object'||Array.isArray(sources))return false;const stores=new Set(stockStores(s).map(buildingKey)),totals=Object.fromEntries(MATERIALS.map(k=>[k,0]));for(const [key,stock] of Object.entries(sources)){if(!stores.has(key)||!stock||typeof stock!=='object'||Array.isArray(stock))return false;for(const [k,n]of Object.entries(stock)){if(!MATERIALS.includes(k)||!Number.isFinite(n)||n<0)return false;totals[k]+=n;}}return MATERIALS.every(k=>Math.abs(totals[k]-(expected[k]||0))<1e-7);}
