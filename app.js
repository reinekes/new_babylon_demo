import {harborCargoMultiplier} from './river-trade.js';
import {tradeSealReady} from './scribes.js';
import {approveHouseholdInitiative,householdInitiative,setAutonomousHousing} from './household-initiative.js';
import {approveWaterProject,cityWaterRequest,householdWaterRequest,waterProjectOrganizerReason,waterProjectProposal} from './human-projects.js';
import {acceptSupplyVow,extendSupplyVow,VOW_FAILURE_TEXT} from './supply-vow.js';
import {familyMemorialsAt,LIFE_CAUSE_NAMES} from './life-analytics.js';
import {setCommonMeals} from './common-meal.js';
import {isVotiveTemple,isMemoryKeeper,orderVotive,templeOfferings,votiveOptions} from './votive-offerings.js';
import {reedStatus,REED_CAPACITY} from './reed-stock.js';
import {forestFor,forestStock,FOREST_CAPACITY,FOREST_RECOVERY} from './forest-stock.js';
import {clayRemaining,stoneRemaining,CLAY_CAPACITY,STONE_CAPACITY} from './mineral-stock.js';
import {fisheryOptions} from './labor-life.js';
import {isStrictSumer} from './scenario-profiles.js';
import {storageJarCover,JAR_FOOD_CAPACITY} from './river-flood.js';
import {AUTUMN_CROPS,fieldRestYear} from './crop-calendar.js';
import {soilCareEnabled,nextFieldSalt} from './field-soil.js';
import {irrigationFor,fieldWater} from './irrigation.js';
import {canalMaintenanceEnabled,canalShares} from './canal-maintenance.js';
import {activeLaborKind,UNLOAD_PORTERS} from './city-labor.js';
import {miraclePrice} from './miracle-discovery.js';
import {miracleCelebrationReason} from './miracle-celebration.js';
import {createNewCity} from './new-game.js';
import {buildingDefinition,buildingPresentation} from './building-presentation.js';
import {createUrukInterface} from './ui-uruk.js';
import {createMonthNotice} from './ui-calendar.js';
import {manualGatheringView,orderManualGathering,cancelManualGathering} from './manual-gathering.js';
import {manualGatheringHTML,bindManualGathering,reedBedHTML} from './ui-manual-gathering.js';
import {createSaveLibrary} from './save-library.js';
import {createSaveLibraryUI} from './ui-saves.js';
import {runSeasonJump,seasonJumpReason} from './season-jump.js';
import {festivalBlessingFrame} from './festival-blessing.js';
import {ceremonyActive,ceremonyLabel,createCeremonySpeedControl} from './ceremony-time.js';
import {cityEventDefinition} from './city-events.js';
import {buildingKnowledgeReason,miracleKnowledgeReason,beginFirstSign,beginFirstWaterHelp,gameMode,builderTeachingPair,builderLevel,PRACTICE_PER_PROJECT} from './godhood.js';
import {modeChooserHTML,createGodhoodControls,gameModeLabel} from './ui-godhood.js';
import {relicControlActive,relicQuestView,relicQuestViews} from './relic-quest.js';
import {createRelicControls,relicStartHTML} from './ui-relic-control.js';
import {sacredMiracleUnlocked,miracleLockReason} from './sacred-unlocks.js';
import {musicPerformance} from './music.js';
import {drawRelic2D} from './game3d/relic-scene.js';
import {residentLinkHTML,residentTextHTML,residentTextRenderer,bindResidentLinks} from './ui-resident-links.js';
import {displayName} from './citizen-epithets.js';
import {citizenEpithetHTML} from './ui-citizen-epithets.js';
import {buildingProductionHistoryHTML} from './ui-building-production.js';
import {buildingChronology} from './building-chronology.js';
import {createPanelControls} from './ui-panels.js';
import {buildingInventory} from './building-inventory.js';
import {buildingInventoryHTML} from './ui-building-inventory.js';
import {CROP_NAMES,fieldCropKind} from './game3d/crop-varieties.js';
import {personalMemoryHTML,renderLifeAnalytics} from './ui-life-analytics.js';
import {canRotateBuilding,nextRotation} from './placement.js';
import {calendarAt,MONTH_NAMES,monthTrackHTML,simulationSeconds,clockText,useThreeDayCalendar} from './calendar.js';
import {grantTestResources,triggerTestEvent,triggerTestMiracleScene,instantTestUpgrade,killTestCitizens,testToolsReason} from './test-tools.js';
import {FESTIVAL_COST,festivalReason,orderFestival,cancelFestival,festivalSummary,festivalView} from './festival.js';
import {createCityAudio} from './city-audio.js';
import {cityAudioListener} from './music-audio.js';
import {createPhotoMode} from './photo-mode.js';
import {CITY_ART,artworkHTML} from './ui-art.js';
import {productionReadout} from './ui-production.js';
import {resourceLabel,DISPLAY_RESOURCE_NAMES} from './resource-display.js';
import {PROFESSION_NAMES,hasWorkplace} from './professions.js';
import {renderStaffing,selectedProfession,citizenProfessionName,professionOptionsHTML} from './ui-professions.js';
import {renderCityTools} from './ui-city-tools.js';
import {waterSummary} from './water.js';
import {RESOURCE_GROUPS,seasonBalance} from './season-balance.js';
import {updateMiracleCard,updateBuildingCardName,BUILDING_GROUPS,groupFor,shouldShowMiracle} from './ui-catalog.js';
import {uiIcon} from './ui-icons.js';
import {clothingStatus} from './clothing.js';
import {stockStores,storeCapacity,storeStock} from './inventory.js';
import {districtReport,storeMinimum,setStoreMinimum,setStoreExports,requestTransfer,cancelTransfer} from './district-logistics.js';
import {foodForecast,foodWarnings,seedReserve,availableFood,setSeedProtection} from './food-planning.js';
import {pestReport,isPestStore,catReason} from './pests.js';
import {supplyOverview} from './supply.js';
import {medicalLevel,healingSpeed,healingQuality,healingCost,STUDY_SECONDS} from './education.js';
import {workRate,isDinnerTime,beliefMultiplier} from './wellbeing.js';
import {household} from './households.js';
import {lifeStage,canWork} from './demography.js';
import {setHTML} from './ui-render.js';
import {trade,tradeReason,marketStatus,logisticsSummary,salesSummary,cancelSale,tradeContractOffer,acceptTradeContract,tradePartnerTrust,donkeyFodderOffer,feedDonkeyCaravan} from './trading.js';
import {externalGuestView,externalMasterOffer,inviteExternalMaster,visitorOffer,inviteVisitor,visitorsView} from './external-guest.js';
import {upgradeRoad,roadUpgradeCost,planRoadRoute,upgradeRoadRoute,planNewRoad,layRoad} from './roads.js';
import {weatherAt} from './environment.js';
import {builderConsent,setCitizenRole,assignGuard,assignWorkplace,callHarvestWorkers,callUnloadWorkers,callRepairWorkers,queueCanalCleaning,adoptAutumnCrops,closeFishingGround,closeForestForRest,closeReedBed,setFieldRest,setCanalDrain,setPriority,inspireCitizen,inspirationReason,inspirationSuccessChance,cancelConstruction,demolish,cancellationRefund,demolitionRefund,canDemolish,cancelRoadRoute} from './management.js';
import {resourceIcon} from './resource-icons.js';
import {constructionProgress,orderedSites,floodRepairCost,boatRepairCost,boatTenderCost} from './construction.js';
import {BUILDINGS,MIRACLES,SEASONS,build,advanceTime,advanceSeason,miracle,resolveEvent,eventReason,encode,decode,terrain,count,storage,workers,goals,upgrade,upgradeCost,canUpgrade,buildingAt,yieldSummary,repairFloodDamage,repairHarborBoat,buildHarborTender} from './engine.js';
import {createGameRenderer} from './game3d/renderer.js';
import {workforceStats,visibleCitizens,isWorkday,networkFor} from './workforce.js';
import {RESOURCE_NAMES,MATERIALS,buildingKey,levelOf,outputMultiplier} from './definitions.js';
import {DIVINE_NAMES,DOMAIN_NAMES,MOURNING_NAMES} from './divinity.js';
import {DAY_SECONDS,lightingAt} from './city-life.js';

const $=id=>document.getElementById(id),key='new-babylon-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const foodAmount=n=>Number(n.toFixed(1));
const rounded=n=>Number(n.toFixed(n<10?1:0));
const resourceText=cargo=>Object.entries(cargo).filter(([,v])=>v>.001).map(([k,v])=>`${rounded(v)} ${DISPLAY_RESOURCE_NAMES[k]||resourceLabel(k)}`).join(' · ')||'пусто';
let placementRotation=0,testMapUpgrade=false,lastMiracleTarget=null;
let roadDrawFrom=null,roadDrawTo=null;
let inspectedDeposit=null,inspectedPerson=null,roadMode=false,householdTab='family',routeFrom=null,routeTo=null,routeTarget=2,routeCache=null;
const desiredRoles=new Map();
const entityAt=(x,y)=>state.buildings.find(b=>b.x===x&&b.y===y)||(state.roads||[]).find(b=>b.x===x&&b.y===y);
const entityName=b=>b.type==='road'?'Участок дороги':buildingDefinition(state,b.type).name;
let state=useThreeDayCalendar(createNewCity()),loaded=false,storageOK=true,corrupt=false,legacyRaw=null;
try{const raw=localStorage.getItem(key);if(raw){const saved=decode(raw);if(saved){state=useThreeDayCalendar(saved);loaded=true;if(JSON.parse(raw).version<22)legacyRaw=raw;}else corrupt=true;}}catch{storageOK=false;}
const saveLibrary=createSaveLibrary();
let savesUI=null,switchingCity=false,citySwitchRevision=0;
let encyclopediaUI=null,encyclopediaRequest=0;
let seasonJumping=false;
let urukUI=null;
let waterProjectDraft=null;
let paused=true,speed=1,last=performance.now(),selection=null,inspected=null,toastTimer,modalKind=null,lastUI=0,lastSave=0,newsSignature='';
const ceremonySpeed=createCeremonySpeedControl();
function setSpeed(value){speed=value;for(const button of document.querySelectorAll('[data-speed]')){const active=Number(button.dataset.speed)===speed;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}}
function syncCeremonySpeed(){const next=ceremonySpeed(state,speed);if(next!==speed)setSpeed(next);}
const dialog=$('dialog');
const renderer=await createGameRenderer($('city'),tile=>{
 if(seasonJumping||dialog.open||photo?.active)return;
 lastMiracleTarget={x:tile.x,y:tile.y};
 if(testMapUpgrade){const b=buildingAt(state,tile.x,tile.y);if(!b){toast('Выбери готовое здание для мгновенного улучшения');return;}const r=instantTestUpgrade(state,buildingKey(b));mutate(r,r.ok?`${buildingDefinition(state,b.type).name}: уровень ${b.level}`:'');return;}
 if(relicControlActive(state)){const b=buildingAt(state,tile.x,tile.y),q=relicQuestView(state);if(q.phase==='carrying'&&b&&['shrine','ziggurat'].includes(b.type))relicUI.deliver(buildingKey(b));else relicUI.move(tile);return;}
 if(selection==='waterpoint'&&waterProjectDraft){confirmWaterProjectPlacement(tile);return;}
 if(selection){const result=build(state,selection,tile.x,tile.y,placementRotation);if(result.ok){toast(`${buildingDefinition(state,selection).name}: стройплощадка заложена`);save();update();checkDialogs();}else toast(result.reason);return;}
 if(tile.citizenId!==undefined){if(externalGuestView(state)?.id===tile.citizenId||state.externalVisits&&visitorsView(state).some(g=>g.id===tile.citizenId)){showTrade();return;}const person=state.citizens.find(c=>c.id===tile.citizenId);if(person){personDetail(person);return;}}
 if(tile.animalId){toast(({sheep:'Овца',goat:'Коза',gazelle:'Газель',bird:'Птица',jackal:'Шакал',cat:'Животное',mouse:'Мышь'})[tile.animalKind]||'Животное долины');return;}
 const b=buildingAt(state,tile.x,tile.y);
 if(b){inspected={x:b.x,y:b.y};detail(b.type,false,b);return;}
 if(manualGatheringView(state,tile.x,tile.y)){depositDetail(tile.x,tile.y);return;}
 const person=visibleCitizens(state).find(c=>Math.abs(c.x-tile.x)+Math.abs(c.y-tile.y)<1);
 if(person){if(person.visitor)showTrade();else personDetail(person);return;}
 inspected=null;inspectedDeposit=null;$('tile-detail').hidden=true;
 toast(terrain(tile.x,tile.y,state)==='water'?'Вода: рыбачить можно с сухого берега. Мост строится только через реку.':terrain(tile.x,tile.y,state)==='fertile'?'Плодородная земля — здесь можно посадить ячмень.':'Сухая земля — подходит для домов, мастерских и храмов.');
},{initialState:state});
const monthNotice=createMonthNotice($('city').parentNode);
const seasonVeil=document.createElement('div');seasonVeil.className='season-transition';seasonVeil.hidden=true;seasonVeil.setAttribute('role','status');seasonVeil.setAttribute('aria-live','polite');$('city').parentNode.append(seasonVeil);
document.addEventListener('click',event=>{if(seasonJumping){event.preventDefault();event.stopImmediatePropagation();}},true);
document.addEventListener('keydown',event=>{if(seasonJumping){event.preventDefault();event.stopImmediatePropagation();}},true);
let photoWasPaused=true;
const cityAudio=createCityAudio(text=>toast(text));
const photo=createPhotoMode({renderer,canvas:$('city'),getState:()=>state,onEnter:()=>{photoWasPaused=paused;paused=true;renderer.photoMode=true;},onExit:()=>{renderer.photoMode=false;paused=photoWasPaused;update();},onMessage:text=>toast(text)});
const relicUI=createRelicControls({root:$('city').parentNode,getState:()=>state,renderer,getPaused:()=>paused,onMessage:text=>toast(text),onChange:text=>{toast(text);save();update();checkDialogs();},onPause:()=>{paused=!paused;save();update();},onStart:()=>{if(dialog.open)closeDialog();paused=false;setSpeed(1);selection=null;inspected=null;inspectedPerson=null;inspectedDeposit=null;roadMode=false;renderer.setRoadMode(false);resetRoadDraw();$('tile-detail').hidden=true;const c=state.citizens.find(c=>c.id===relicQuestView(state)?.actorId);if(c)renderer.focusOn(c.x,c.y);}});
// Capture before all city handlers: only the quest, camera, sound and pause remain.
document.addEventListener('click',event=>{if(!relicControlActive(state))return;const target=event.target;if(target.closest?.('.relic-hud,.game3d-options,.panel-controls,[data-uruk-action="menu"],[data-uruk-close]')||['city','pause','toggle-sound','zoom-out','zoom-in','home','overview'].includes(target.id))return;event.preventDefault();event.stopImmediatePropagation();toast('Ты ведёшь избранного: городские команды закрыты до возвращения.');},true);

createPanelControls({onResize:()=>renderer.resize()});
const modeBadge=document.createElement('span');modeBadge.className='game-mode-label';document.querySelector('.game3d-options,.panel-dock')?.append(modeBadge);
const godhoodUI=createGodhoodControls({root:$('city').parentNode,getState:()=>state,onSign:()=>{const r=beginFirstSign(state);if(mutate(r,'Человек услышал зов и идёт к источнику')){paused=false;const c=state.citizens.find(c=>c.id===r.citizenId);if(c)renderer.focusOn(c.x,c.y);save();update();}},onWaterHelp:(helper,recipient)=>{const r=beginFirstWaterHelp(state,helper,recipient);if(mutate(r,'Житель отправился за водой для соседей')){paused=false;const c=state.citizens.find(c=>c.id===helper);if(c)renderer.focusOn(c.x,c.y);save();update();}},onInspire:id=>{const r=inspireCitizen(state,id,'builder');mutate(r,r.success?'Первый строитель вдохновлён. Заложи простой двор: после двух завершённых работ он достигнет II уровня.':'Вдохновение не удалось');},onFocus:()=>{const c=state.citizens.find(c=>c.id===state.godhood?.witnessId);if(c)renderer.focusOn(c.x,c.y);},onBuild:type=>{if(selection!==type)choose(type);},onWork:()=>showCityOverview('workshops'),onRelics:()=>showRelicIntro(),onFisher:id=>{const r=inspireCitizen(state,id,'fisher');mutate(r,r.success?'Рыбак принял призвание. Дождись его подношения у хранилища.':'Вдохновение пока не принято · потрачена 1 вера');},onCat:()=>{const el=$('miracle-cat'),details=el?.closest('details');if(details){if(document.body.dataset.urukPanel!=='miracles')urukUI?.open('miracles');details.open=true;details.scrollIntoView({block:'nearest'});el.focus();}},onCatFocus:()=>{const p=state.catDiscovery?.trace;if(p)renderer.focusOn(p.x,p.y);}});
const resident=value=>residentLinkHTML(state,value);
bindResidentLinks(document,{getState:()=>state,onLiving:c=>{if(dialog.open)closeDialog();renderer.focusOn(c.x,c.y);personDetail(c);},onArchived:id=>showLifeAnalytics(id)});
function toast(text){setHTML($('toast'),residentTextHTML(state,text));$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function save(){
 try{if(legacyRaw){localStorage.setItem('new-babylon-backup-before-valley',legacyRaw);legacyRaw=null;}localStorage.setItem(key,encode(state));storageOK=true;$('save-status').textContent='●  Сохранено';$('save-status').title='Город, жители и грузы сохранены в этом браузере';}
 catch{if(storageOK)toast('Браузер не разрешает сохранение. Игра продолжится до закрытия вкладки.');storageOK=false;$('save-status').textContent='○  Без сохранения';}
}
const roles=PROFESSION_NAMES;
const phases={toEveningGame:'Идёт к соседям на игру',eveningGuest:'В гостях у соседей',toManualGathering:'Идёт к залежи за сырьём',manualGathering:'Медленно собирает сырьё вручную',awakening:'Идёт к источнику: первый знак бога',toWorkshop:'Несёт добытое сырьё в свой двор',waterTrip:'Несёт воду / набирает у берега',toClothesSupply:'Забирает одежду со склада',toClothesHome:'Несёт одежду семье',toCraftSupply:'Идёт за сырьём на склад',toDistrictSupply:'Идёт за грузом на склад',toDistrictStore:'Перевозит между складами',toSchool:'Идёт учиться в храм',studying:'Учится в храме',home:'Дома',resting:'Дома · груз сохранён до утра',toHealer:'Идёт к лекарю',treatment:'Лечится в доме лекаря',toRest:'Идёт домой с грузом',toWork:'Идёт на работу',working:'Собирает ресурс',toStore:'Несёт груз на склад',returnWork:'Возвращается к работе',toHome:'Возвращается домой',blocked:'Нет доступного пути',toSupply:'Идёт за материалами',toSite:'Идёт на стройку',constructing:'Возводит здание',waiting:'Ждёт материалы',unloading:'Ждёт свободного места на складе',toMarket:'Идёт за покупками на рынок',toSaleSupply:'Забирает проданное со склада',toSaleMarket:'Несёт проданный груз в караван',toPantrySupply:'Идёт за едой для семьи',toPantryHome:'Несёт еду домой',playing:'Играет у дома'};
const label=resourceLabel;
function costs(cost,available=true,showStock=true){return `<div class="cost-list">${Object.entries(cost).filter(([k,v])=>RESOURCE_NAMES[k]&&v>0).map(([k,v])=>`<span class="cost-row ${available&&state.resources[k]<v?'shortage':''}">${resourceIcon(k)}<span>${label(k)} — <b>${rounded(v)}</b>${k==='prestige'?' <em>требование, не расходуется</em>':''}${available&&showStock?`<small>есть ${rounded(state.resources[k])}${state.resources[k]<v?` · не хватает ${rounded(v-state.resources[k])}`:''}</small>`:''}</span></span>`).join('')||'<small>Нет возврата ресурсов</small>'}</div>`;}
function priorityControl(b){return `<label class="control-label">${b.construction.routeOrder===undefined?'Приоритет':'Приоритет маршрута'} <select data-priority="${b.x},${b.y}" aria-label="Приоритет: ${entityName(b)}, ${b.x}, ${b.y}">${[[2,'Высокий'],[1,'Обычный'],[0,'Низкий']].map(([v,n])=>`<option value="${v}" ${(b.construction.priority??1)===v?'selected':''}>${n}</option>`).join('')}</select></label>`;}
function familyDetails(c){const stage={child:'Ребёнок',adult:'Взрослый',elder:'Пожилой'}[lifeStage(c)],children=state.citizens.filter(p=>p.parents?.includes(c.id));return `${stage} · ${rounded(c.age)} лет · поколение ${c.generation}${c.partner!==null?`<br>Супруг(а): ${resident(c.partner)}${state.citizens.some(p=>p.id===c.partner)?'':' · в памяти семьи'}`:''}${c.parents?.length?`<br>Родители: ${c.parents.map(id=>`${resident(id)}${state.citizens.some(p=>p.id===id)?'':state.lifeAnalytics?.people.some(p=>p.id===id&&p.diedTick!==null)?' †':' · запись не сохранилась'}`).join(', ')}`:''}${children.length?`<br>Дети: ${children.map(p=>resident(p)).join(', ')}`:''}`;}
function medicalReadout(c){if(!c.medicine)return '';const level=medicalLevel(c);return level?`<small class="role-help">Лекарь · уровень ${level}/5 · мастерство ×${healingSpeed(c).toFixed(2)}<br>Лечение до ${healingQuality(c)}% · экономия припасов ${Math.round((1-healingCost(c))*100)}%<br>${level>=5?'Высшее мастерство':`Следующий уровень в новом году ${c.medicine.practice>0?'· практика получена':'· нужна практика лечения'}`}</small>`:`<small class="role-help">Ученик лекаря · обучение ${Math.floor(c.medicine.study/STUDY_SECONDS*100)}%<br>${!canWork(c)?'Начнёт учиться с 16 лет':c.school?'Дневное обучение в храме':'Нужен доступный храм и свободные руки'} · курс ${STUDY_SECONDS} с в храме</small>`;}
function roleControl(c){const role=selectedProfession(c,desiredRoles.get(c.id)),reason=inspirationReason(state,c.id,role),chance=Math.round(inspirationSuccessChance(state,c,role)*100),consent=builderConsent(state,c,role);return `<div class="inspiration-controls"><label class="control-label">Кем вдохновить <select data-role="${c.id}" aria-label="Желаемая профессия: ${displayName(state,c.id)}">${professionOptionsHTML(role)}</select></label><button class="inspire-button" data-inspire="${c.id}" ${reason?'disabled':''} title="${reason||(consent===null?`${chance}% успеха. Вера расходуется и при неудаче.`:'Житель готов принять призвание')}">Вдохновить · 1 вера</button><small>${consent===null?`Шанс ${chance}%`:consent?consent:'Готов принять призвание'} · ${canWork(c)?`сейчас: ${citizenProfessionName(c)}`:'работа с 16 лет'}${c.pendingRole?` · ${roles[c.pendingRole]} после доставки`:''}${c.calling&&c.calling!=='auto'?`<br>Призвание: ${roles[c.calling]} · +20% в этой работе${c.futureRole?' · когда вырастет':''}`:''}</small>${medicalReadout(c)}${workplaceControl(c)}</div>`;}

function workplaceControl(c){if(!canWork(c))return '';return `<label class="control-label">Постоянное место <select data-workplace="${c.id}" aria-label="Рабочее место: ${displayName(state,c.id)}"><option value="">Авто · свободный работник</option>${state.buildings.filter(b=>(!b.construction||b.construction.kind==='upgrade')&&hasWorkplace(b.type)).map(b=>`<option value="${buildingKey(b)}" ${c.workplace===buildingKey(b)?'selected':''}>${buildingDefinition(state,b.type).name} · ${b.x}, ${b.y}</option>`).join('')}${state.buildings.filter(isPestStore).map(b=>`<option value="guard:${buildingKey(b)}" ${c.guardPost===buildingKey(b)?'selected':''}>Сторож · ${buildingDefinition(state,b.type).name} ${b.x}, ${b.y}</option>`).join('')}</select></label><small>${c.guardPost?'Сторож: защита только на посту, ночью отдыхает дома.':c.workplace?'Закреплён: не уходит на стройки. Груз сначала доставит.':'Автоматическое распределение по свободным работам.'}</small>`;}
const staffingDrafts=new WeakMap();
function staffDraft(key){let drafts=staffingDrafts.get(state);if(!drafts){drafts=new Map();staffingDrafts.set(state,drafts);}if(!drafts.has(key))drafts.set(key,{});return drafts.get(key);}
function staffingControl(b){return renderStaffing(state,b,staffDraft(buildingKey(b)));}
function sealedContractHTML(q){
 const seal=q.seal;
 if(!seal)return '';
 const sale=state.trade.sales.find(order=>order.id===q.saleId);
 const delivery=state.trade.deliveries.find(order=>order.id===q.deliveryId);
 return `<p data-trade-seal><b>Печать · договор № ${q.visit}</b> · ${esc(q.partner)}<br>Ткань у купцов ${foodAmount(sale.loaded)} · ${delivery?`принято городом ${foodAmount(delivery.delivered)} · ${label(delivery.resource)}`:'поставки городу не было'}<br>${resident(seal.author)} · амбар ${esc(seal.archive)} · день ${Math.floor(seal.writtenAt/60)+1}, ${clockText(seal.writtenAt)}</p>`;
}
function stockAccountControl(b){
 if(b.type!=='granary')return '';
 const account=b.stockAccount,archive=b.receiptArchive;
 const amounts=account&&Object.entries(account.stock).filter(([,amount])=>amount>0).map(([resource,amount])=>`${label(resource)} · ${rounded(amount)}`).join(' · ');
 const snapshot=account?`<h4>Последняя табличка учёта</h4><p>${amounts||'Склад был пуст'}</p><small>${esc(displayName(state,account.author))} · год ${account.year} · ${MONTH_NAMES[account.month]} · день ${account.day} · ${clockText(account.simTime)}. Остаток на момент записи.</small>`:'<h4>Табличка учёта</h4><small>Закрепи писца в амбаре. Он запишет остатки, когда обработает ожидающие доставки.</small>';
 const receipts=archive?`<details data-granary-receipts><summary>Квитанции амбара · ${archive.tablets.length} записей</summary><p>Ожидают записи: ${archive.pending.length}. Одна квитанция или сверка архива занимает 12 секунд работы писца.</p>${archive.reading?`<p>${resident(archive.reading.author)} сверил табличку № ${archive.reading.tablet} предыдущего писца.</p>`:''}<ol>${[...archive.tablets].reverse().map(t=>`<li>№ ${t.id} · ${esc(cargoAmount(t.cargo))}<br>Доставил ${resident(t.carrier)} · день ${Math.floor(t.arrivedAt/60)+1}, ${clockText(t.arrivedAt)}<br>Записал ${resident(t.author)} · день ${Math.floor(t.writtenAt/60)+1}, ${clockText(t.writtenAt)}</li>`).join('')}</ol></details>`:'';
 const seals=(state.tradeContracts||[]).filter(q=>q.seal?.archive===buildingKey(b)).slice(-8).reverse().map(sealedContractHTML).join('');
 return `<section class="staffing-panel">${snapshot}${receipts}${seals?'<h4>Печати договоров по этому адресу</h4>'+seals:''}</section>`;
}

function guardControl(b){if(!isPestStore(b))return '';const key=buildingKey(b),guard=state.citizens.find(c=>c.guardPost===key);return `<section class="staffing-panel pest-panel"><h4>Защита запасов</h4><p>${pestReport(state,key)}</p>${guard?`<p>${resident(guard)} · сторож <button data-release-guard="${guard.id}">Освободить</button></p>`:`<label class="control-label">Назначить сторожа <select data-guard-building="${key}" aria-label="Сторож хранилища"><option value="">Выбрать взрослого</option>${state.citizens.filter(c=>canWork(c)&&['auto','production'].includes(c.role)).map(c=>`<option value="${c.id}">${displayName(state,c.id)}${c.workplace||c.guardPost?' · сменит работу':''}</option>`).join('')}</select></label>`}<small>Сторож занимает одного жителя, ест дома и отдыхает ночью. Сторож прогоняет мышей и уменьшает потери запасов. Потери относятся к запасам этого склада; дома и грузы защищены.</small></section>`;}

function votivePanel(b){
 if(!isStrictSumer(state)||!isVotiveTemple(b))return '';
 const key=buildingKey(b),{reason,sources,donors}=votiveOptions(state,key);
 const keeper=state.citizens.find(c=>isMemoryKeeper(c,key));
 const items=templeOfferings(state,key).map(v=>{
  const job=state.district.jobs.find(q=>q.id===v.id);
  const status=v.receivedTick!==null?'В храмовой кладовой':job.cancelled?'Отменено':job.remaining?'Зарезервирован':'Несут в храм';
  const memory=v.memory?`<small>Записал хранитель ${esc(v.memory.keeperName)}.</small>`:'';
  const kitchen=v.feastTick!==undefined?' · Угощение состоялось':state.festival?.dedicationId===v.id?' · Угощение готовится':
   v.memory?` <button type="button" data-dedication-feast="${v.id}">Заказать угощение</button>`:'';
  return `<li>Сосуд №${v.id} · ${esc(v.donorName)} · ${v.visitorKind?'паломник, путь через двор':'склад'} ${esc(v.source)} · ${status} ${memory}${kitchen}</li>`;
 }).join('');
 return `<section class="staffing-panel"><h4>Именные посвящения</h4>
  <p>Хранитель памяти · ${keeper?resident(keeper):'назначь вдохновлённого жреца на работу в этом храме'}.</p>
  <p>Угощение требует 12 еды, 6 пива и 15 престижа. Посвящённый сосуд хранится в кладовой.</p>
  ${items?`<ul>${items}</ul>`:'<p>В кладовой пока нет именных сосудов.</p>'}
  ${reason?`<small>${esc(reason)}</small>`:`<form data-votive-temple="${key}">
   <label>Даритель <select name="donor">${donors.map(c=>`<option value="${c.id}">${esc(displayName(state,c.id))}</option>`).join('')}</select></label>
   <label>Склад сосуда <select name="source">${sources.map(store=>`<option value="${buildingKey(store)}">${esc(entityName(store))} · ${buildingKey(store)}</option>`).join('')}</select></label>
   <button>Посвятить сосуд</button></form>`}</section>`;
}
function siteStatus(b){const q=b.construction,p=constructionProgress(b),people=state.citizens.filter(c=>c.site===buildingKey(b)),pair=builderTeachingPair(state,people.filter(c=>c.siteDuty==='builder'&&c.phase==='constructing'));return `<div class="site-progress"><span>${p.stage} · ${Math.floor(p.ratio*100)}%</span><progress max="1" value="${p.ratio}" aria-label="Готовность стройки"></progress></div><div class="material-table"><span>Материал</span><span>Нужно</span><span>Доставлено</span><span>В пути</span>${Object.entries(q.required).filter(([,v])=>v>0).map(([k,v])=>`<span class="material-name">${resourceIcon(k)}${label(k)}</span><span>${rounded(v)}</span><span>${rounded(q.delivered[k]||0)}</span><span>${rounded(people.reduce((n,c)=>n+(c.buildCargo?.[k]||0),0))}</span>`).join('')}</div><small class="site-workers">${people.length?people.map(c=>`${resident(c)} · ${c.siteDuty==='carrier'?'носильщик':'строитель'}`).join(' · '):'Ожидание: нет свободных работников или доступного пути.'}</small>${pair?`<p class="site-apprenticeship">${resident(pair.mentor)} обучает ${resident(pair.pupil)} · часть труда уходит на обучение.</p>`:''}`;}
function mutate(result,message){if(!result.ok){toast(result.reason||'Действие недоступно');return false;}save();update();toast(message);return true;}
function bindManagement(root){
 for(const button of root.querySelectorAll('[data-dedication-feast]'))button.onclick=()=>{
  const result=orderFestival(state,{dedicationId:Number(button.dataset.dedicationFeast)});
  if(mutate(result,result.warning||'Храмовая кухня заказала угощение')){paused=false;save();showFestival();}
 };
 const votive=root.querySelector('[data-votive-temple]');
 if(votive)votive.onsubmit=e=>{e.preventDefault();const {source,donor}=votive.elements;
  if(mutate(orderVotive(state,votive.dataset.votiveTemple,source.value,Number(donor.value)),'Сосуд зарезервирован. Носильщик отнесёт его в храм.')){
   document.activeElement?.blur();updateDetail();
  }
 };
 bindFoodPlan(root);root.querySelectorAll('[data-open-food-plan]').forEach(el=>el.onclick=showSupply);
 root.querySelectorAll('[data-guard-building]').forEach(el=>el.onchange=()=>{if(el.value!=='')mutate(assignGuard(state,Number(el.value),el.dataset.guardBuilding),'Сторож назначен: сначала закончит текущую доставку');el.blur();updateDetail();});
 root.querySelectorAll('[data-release-guard]').forEach(el=>el.onclick=()=>{mutate(assignGuard(state,Number(el.dataset.releaseGuard),''),'Сторож освобождён');el.blur();updateDetail();});
 root.querySelectorAll('[data-workplace]').forEach(el=>el.onchange=()=>{mutate(el.value.startsWith('guard:')?assignGuard(state,Number(el.dataset.workplace),el.value.slice(6)):assignWorkplace(state,Number(el.dataset.workplace),el.value),'Постоянное место обновлено');el.blur();if(modalKind==='residents')renderManagement();else personDetail(state.citizens.find(c=>c.id===Number(el.dataset.workplace)));});
 root.querySelectorAll('[data-pin-building]').forEach(el=>el.onchange=()=>{const id=Number(el.value),key=el.dataset.pinBuilding,selected=el.value!=='';el.blur();if(selected){const result=assignWorkplace(state,id,key);if(result.ok)Object.assign(staffDraft(key),{citizenId:id,profession:undefined,open:true});mutate(result,'Житель закреплён за зданием');}updateDetail();});
 root.querySelectorAll('.staff-preparation').forEach(el=>el.ontoggle=()=>{if(el.isConnected)staffDraft(el.querySelector('[data-staff-person]').dataset.staffPerson).open=el.open;});
 const editStaff=(el,key,patch,selector)=>{Object.assign(staffDraft(key),patch);el.blur();updateDetail();root.querySelector(selector)?.focus({preventScroll:true});};
 root.querySelectorAll('[data-staff-person]').forEach(el=>el.onchange=()=>editStaff(el,el.dataset.staffPerson,{citizenId:el.value?Number(el.value.slice('resident-'.length)):null,profession:undefined},'[data-staff-person]'));
 root.querySelectorAll('[data-staff-profession]').forEach(el=>el.onchange=()=>editStaff(el,el.dataset.staffProfession,{profession:el.value},'[data-staff-profession]'));
 root.querySelectorAll('[data-staff-inspire]').forEach(el=>el.onclick=()=>{const draft=staffDraft(el.dataset.staffInspire),profession=el.closest('.staff-preparation').querySelector('[data-staff-profession]').value;el.blur();const result=inspireCitizen(state,draft.citizenId,profession);mutate(result,result.success?'Призвание открыто · текущий груз сохранён':'Вдохновение пока не пришло · потрачена 1 вера');updateDetail();});
 root.querySelectorAll('[data-staff-assign]').forEach(el=>el.onclick=()=>{const key=el.dataset.staffAssign;el.blur();mutate(assignWorkplace(state,staffDraft(key).citizenId,key),'Житель закреплён за зданием');updateDetail();});
 root.querySelectorAll('[data-release-worker]').forEach(el=>el.onclick=()=>{mutate(assignWorkplace(state,Number(el.dataset.releaseWorker),''),'Житель вернулся к автоматическому распределению');el.blur();updateDetail();});
 root.querySelectorAll('[data-priority]').forEach(el=>el.onchange=()=>{const [x,y]=el.dataset.priority.split(',').map(Number);mutate(setPriority(state,x,y,Number(el.value)),'Приоритет стройки изменён');});
 root.querySelectorAll('[data-role]').forEach(el=>el.onchange=()=>{desiredRoles.set(Number(el.dataset.role),el.value);const c=state.citizens.find(c=>c.id===Number(el.dataset.role));el.blur();if(modalKind==='residents')renderManagement();else personDetail(c);});
 root.querySelectorAll('[data-inspire]').forEach(el=>el.onclick=()=>{const c=state.citizens.find(c=>c.id===Number(el.dataset.inspire));const result=inspireCitizen(state,c.id,selectedProfession(c,desiredRoles.get(c.id)));mutate(result,result.success?`${displayName(state,c.id)} вдохновился! Потрачена 1 вера.`:`${displayName(state,c.id)} пока не вдохновился. Потрачена 1 вера.`);el.blur();if(modalKind==='residents')renderManagement();else personDetail(c);});
 root.querySelectorAll('[data-inspect]').forEach(el=>el.onclick=event=>{event?.preventDefault();const [x,y]=el.dataset.inspect.split(',').map(Number),b=entityAt(x,y);closeDialog();selection=null;document.body.classList.remove('is-building');for(const card of document.querySelectorAll('.building-card')){card.classList.remove('selected');card.setAttribute('aria-pressed','false');}$('map-hint').textContent='Перетаскивание — карта · колесо — масштаб · клик — выбор';inspected={x,y};if(b.type==='road')roadDetail(b);else detail(b.type,false,b);});
 root.querySelectorAll('[data-cancel]').forEach(el=>el.onclick=()=>{const [x,y]=el.dataset.cancel.split(',').map(Number);confirmRemoval(entityAt(x,y),false);});
}

function roadDetail(road){inspectedPerson=null;inspectedDeposit=null;inspected={x:road.x,y:road.y};renderer.selectedRoad=road.id;$('tile-detail').hidden=false;$('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">ДОРОЖНАЯ СЕТЬ</span><h3>Участок дороги</h3><p>Материалы принесут носильщики, покрытие уложат строители. Пока работы идут, участок открыт на прежнем уровне.</p><strong></strong><div id="building-controls"></div>`;$('tile-detail').querySelector('.detail-close').onclick=()=>{inspected=null;$('tile-detail').hidden=true;};updateRoadDetail(road);}
function floodRepairControl(b){
 const road=b.type==='road';
 return `<p>${road?'Размытое покрытие · скорость на 20% ниже обычной.':'Сырые стены · жильцы теряют 4 настроения при каждой смене сезона.'}</p><h4>Ремонт</h4>${costs(floodRepairCost(b))}<button class="upgrade-button" id="repair-flood-damage">Заказать ремонт</button>`;
}
function bindFloodRepair(b){
 const button=$('repair-flood-damage');
 if(button)button.onclick=()=>{
  if(mutate(repairFloodDamage(state,b),'Ремонт заказан')){
   if(b.type==='road')roadDetail(b);else detail(b.type,false,b);
  }
 };
}
function updateRoadDetail(road){const q=road.construction,level=levelOf(road),price=roadUpgradeCost(road);$('tile-detail').querySelector('strong').textContent=`Уровень ${level} / 3 · скорость ${road.floodDamage?Math.round(((1+(level-1)*.2)*.8-1)*100):`+${(level-1)*20}`}%`;if($('building-controls').contains(document.activeElement))return;$('building-controls').innerHTML=q?`${siteStatus(road)}${priorityControl(road)}<button class="management-button danger" data-cancel="${road.x},${road.y}">${q.kind==='boat'?'Отменить постройку лодки':q.kind==='repair'?'Отменить ремонт':'Отменить улучшение'}</button>`:road.floodDamage?floodRepairControl(road):level>=3?'<p>Кирпичная мостовая · максимальный уровень</p>':`<h4>Улучшение до ${level+1} · скорость +${level*20}%</h4>${costs(price)}<button class="upgrade-button" id="upgrade-road">Улучшить участок</button>`;$('building-controls').insertAdjacentHTML('beforeend',`<button id="route-start">Начало маршрута отсюда</button>${q?.routeOrder!==undefined?'<button id="cancel-route-order" class="danger">Отменить оставшийся маршрут</button>':''}`);$('route-start').onclick=()=>{routeFrom=road.id;routeTo=null;roadMode=true;renderer.setRoadMode(true);$('open-roads').setAttribute('aria-pressed','true');toast('Выбери конечный участок дороги');};if($('cancel-route-order'))$('cancel-route-order').onclick=()=>mutate(cancelRoadRoute(state,q.routeOrder),'Незавершённая часть маршрута отменена');bindManagement($('building-controls'));bindFloodRepair(road);if($('upgrade-road'))$('upgrade-road').onclick=()=>{const result=upgradeRoad(state,road);if(mutate(result,'Работы на дороге начаты'))roadDetail(road);};}

function resetRoadDraw(){renderer.plannedRoads=null;roadDrawFrom=null;roadDrawTo=null;renderer.roadDrawMode=false;$('lay-roads').setAttribute('aria-pressed','false');}
function drawRoadPoint(point){
 inspectedDeposit=null;
 if(dialog.open)return;
 if(!roadDrawFrom||roadDrawTo){roadDrawFrom={x:point.x,y:point.y};roadDrawTo=null;renderer.plannedRoads=null;toast('Начало выбрано. Выбери конец дороги');$('map-hint').textContent='Выбери конец дороги · путь по границам клеток';return;}
 roadDrawTo={x:point.x,y:point.y};const plan=planNewRoad(state,roadDrawFrom,roadDrawTo);renderer.plannedRoads=plan.roads;inspected=null;$('tile-detail').hidden=false;$('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">ТВОЯ УЛИЦА</span><h3>Проложить дорогу</h3><p>От ${roadDrawFrom.x}, ${roadDrawFrom.y} до ${roadDrawTo.x}, ${roadDrawTo.y}. Путь идёт по границам клеток, обходит воду. Простая грунтовая улица бесплатна; затем можно улучшить весь маршрут.</p><strong>${plan.reason||`Новых участков: ${plan.roads.length}`}</strong><button id="confirm-road" class="upgrade-button" ${plan.reason?'disabled':''}>Проложить маршрут</button><button id="cancel-road-draw">Отменить</button>`;
 const cancel=()=>{renderer.plannedRoads=null;roadDrawFrom=null;roadDrawTo=null;$('tile-detail').hidden=true;};$('tile-detail').querySelector('.detail-close').onclick=cancel;$('cancel-road-draw').onclick=cancel;
 $('confirm-road').onclick=()=>{const r=layRoad(state,roadDrawFrom,roadDrawTo);if(mutate(r,`Проложено участков: ${r.count||0}`)){cancel();$('map-hint').textContent='Выбери начало следующей дороги · Escape — выйти';}};
}
function clearRoadRoute(){resetRoadDraw();routeFrom=null;routeTo=null;routeCache=null;renderer.routeRoads=null;}
function renderRoadRoute(){
 inspectedDeposit=null;
 const signature=JSON.stringify([routeFrom,routeTo,routeTarget,state.roads.map(r=>[r.id,r.level,r.construction?.target]),state.buildings.map(b=>[b.type,b.x,b.y,b.construction?.kind]),state.resources.clay,state.resources.reed,state.resources.stone,!!state.funeral,!!state.event,state.lost]);
 if(routeCache?.signature!==signature)routeCache={signature,plan:planRoadRoute(state,routeFrom,routeTo,routeTarget)};
 const plan=routeCache.plan;renderer.routeRoads=new Set(plan.roads.map(r=>r.id));const panel=$('tile-detail');panel.hidden=false;if(panel.contains(document.activeElement))return;
 setHTML(panel,`<button class="detail-close" id="close-route" aria-label="Закрыть маршрут">×</button><span class="eyebrow">ДОРОЖНЫЙ МАРШРУТ</span><h3>Улучшить путь</h3><p>Начало и конец выбраны. Можно выбрать другой конец на карте. Мосты сохраняются; готовые и уже заказанные участки пропускаются.</p><label>Покрытие <select id="route-level"><option value="2" ${routeTarget===2?'selected':''}>II · скорость +20%</option><option value="3" ${routeTarget===3?'selected':''}>III · скорость +40%</option></select></label><p>Участков на пути: ${plan.roads.length} · новых работ: ${plan.pending.length}</p>${Object.keys(plan.cost).length?costs(plan.cost):'<small>Новых затрат нет</small>'}<button id="order-route" ${plan.reason?'disabled':''}>Заказать весь маршрут</button><small>${esc(plan.reason||'Материалы резервируются целиком; жители доставят их и уложат покрытие.')}</small>`);
 $('close-route').onclick=()=>{clearRoadRoute();panel.hidden=true;};$('route-level').onchange=e=>{routeTarget=Number(e.target.value);e.target.blur();renderRoadRoute();};$('order-route').onclick=()=>{const result=upgradeRoadRoute(state,routeFrom,routeTo,routeTarget);if(result.ok){clearRoadRoute();panel.hidden=true;inspected=null;}mutate(result,`Заказано дорожных участков: ${result.count||0}`);};
}

function cropCalendarPanel(){
 if(!isStrictSumer(state))return '';
 if(state.cropCalendar===AUTUMN_CROPS)return '<p>Календарь ячменя · осенний посев и весенняя жатва.</p>';
 return '<p>Календарь ячменя · весенний посев и осенняя жатва.</p><button type="button" data-adopt-autumn-crops>Перейти на осенний посев</button><small>Уже посеянные поля завершат прежний цикл. Выбор сохраняется в этом городе.</small>';
}
function forecastPanel(f=foodForecast(state)){return `<section class="food-forecast ${f.balance<0?'food-shortage':''}"><h3>До следующей жатвы · ${Math.ceil(f.secondsToHarvest)} с</h3><strong>${f.balance>=0?`Готовой еды хватит · остаток около ${foodAmount(f.balance)}`:`Не хватает около ${foodAmount(-f.balance)} еды`}</strong><p>Готово к питанию: ${foodAmount(f.ready)} · расход до жатвы: ${foodAmount(f.demand)}<br>Запас на потери от мышей без защиты: ${foodAmount(f.pestRisk)}<br>Семена на складе: ${foodAmount(f.reserve)} / ${foodAmount(f.target)} · на полях: ${foodAmount(f.seedAtFields)}<br>Ещё не еда: снопы ${foodAmount(f.unthreshed)} · несрезанный урожай ${foodAmount(f.standing)}<br>Ожидаемый будущий урожай: до ${foodAmount(f.cropPotential)}</p>${cropCalendarPanel()}<button data-seed-policy>${f.protected?'Разрешить съесть семена':'Защитить семенной резерв'}</button><small>${f.protected?'Семена не расходуются на ужины, продажу и лечение.':'ВНИМАНИЕ: семена можно съесть или продать; будущему посеву может не хватить зерна.'}<br>Прогноз по нынешним жителям с запасом на рост мышей без постоянной защиты, без будущих уловов и покупок. Снопы и ожидаемый урожай не включены в готовую еду; им нужны работа, вода и доставка. Общий достаток не заменяет доставку каждой семье.</small></section>`;}
function bindFoodPlan(root){
 root.querySelectorAll('[data-adopt-autumn-crops]').forEach(el=>el.onclick=()=>{el.blur();if(mutate(adoptAutumnCrops(state),'Город перешёл на осенний посев'))renderSupply();});
 root.querySelectorAll('[data-seed-policy]').forEach(el=>el.onclick=()=>{const protect=!state.foodPlan.protectSeeds;mutate(setSeedProtection(state,protect),protect?'Семена снова защищены':'Резерв открыт: следующий посев под угрозой');el.blur();if(modalKind==='supply')renderSupply();else updateDetail();});}
const storeMinimumDraft=new Map(),transferDraft={source:'',target:'',resource:'food',amount:10};
function storePolicy(b){
 const key=buildingKey(b);
 const jars=isStrictSumer(state)&&['granary','depot'].includes(b.type)?storageJarCover(b):null;
 const mealDepot=isStrictSumer(state)&&b.type==='depot'?state.buildings.find(v=>buildingKey(v)===key):null;
 const eating=mealDepot?state.citizens.filter(c=>c.phase==='commonMeal'&&c.commonMealTarget===key).length:0;
 const talk=mealDepot?.mealTalk,dispute=mealDepot?.mealDispute;
 const mealTalk=talk?`<small>За столом: ${talk.people.map(id=>resident(id)).join(' и ')}${talk.topic?` · Обсудили «${esc(talk.topic)}»`:''}${talk.outcome==='disputed'?' · Поспорили о нехватке еды':talk.outcome==='reconciled'?' · Помирились':''}.</small>`:'';
 const mealDispute=dispute?.status==='open'?`<small>Спор о нехватке еды: ${dispute.people.map(id=>resident(id)).join(' и ')}. Они смогут помириться за следующей общей трапезой после сытого ужина.</small>`:'';
 const meals=mealDepot?`<label><input type="checkbox" data-common-meals="${esc(key)}" ${mealDepot.commonMeals?'checked':''}> Общая трапеза</label><small>С 11:00 до 16:00 работники из дальних домов приходят за порцией еды из запаса сверх минимума.${eating?` Сейчас за трапезой: ${eating}.`:''}</small>`:'';
 const minimum=(resource,label)=>`<label>${label} <input type="number" min="0" max="${storeCapacity(b)}" step="1" data-store-min="${esc(key)}" data-store-resource="${resource}" value="${storeMinimumDraft.get(`${key}:${resource}`)??storeMinimum(b,resource)}"></label><button data-save-store="${esc(key)}" data-store-resource="${resource}">Задать минимум</button>`;
 const jarInfo=jars?`${minimum('pottery','Минимум тары')}<small>Тара от разлива: защищено ${foodAmount(jars.covered)} ед. еды. Один местный сосуд вмещает до ${JAR_FOOD_CAPACITY} ед.</small>`:'';
 return `<div class="store-policy">${minimum('food','Минимум еды')}<label><input type="checkbox" data-store-export="${esc(key)}" ${b.noExport?'':'checked'}> Отправлять в другие склады сверх минимума</label><small>Минимум защищён от межскладских перевозок. Домашние ужины расходуют местную еду.</small>${jarInfo}${meals}${mealTalk}${mealDispute}</div>`;
}
function bindStorePolicy(root){
 root.querySelectorAll('[data-common-meals]').forEach(el=>el.onchange=()=>{
  const enabled=el.checked;
  if(!mutate(setCommonMeals(state,el.dataset.commonMeals,enabled),enabled?'Общая трапеза открыта':'Общая трапеза закрыта'))el.checked=!enabled;
  el.blur();
 });

 root.querySelectorAll('[data-store-min]').forEach(el=>el.oninput=()=>storeMinimumDraft.set(`${el.dataset.storeMin}:${el.dataset.storeResource}`,el.value));
 root.querySelectorAll('[data-save-store]').forEach(el=>el.onclick=()=>{
  const {saveStore:key,storeResource:resource}=el.dataset;
  const input=root.querySelector(`[data-store-min="${CSS.escape(key)}"][data-store-resource="${resource}"]`);
  if(mutate(setStoreMinimum(state,key,resource,Number(input.value)),'Минимум склада сохранён'))storeMinimumDraft.delete(`${key}:${resource}`);
  el.blur();
 });
 root.querySelectorAll('[data-store-export]').forEach(el=>el.onchange=()=>{mutate(setStoreExports(state,el.dataset.storeExport,el.checked),el.checked?'Вывоз разрешён':'Вывоз запрещён');el.blur();});
}
function districtPanel(){const report=districtReport(state),names=new Map(report.stores.map(b=>[b.key,`${b.name} ${b.x}, ${b.y}`])),storeOptions=chosen=>report.stores.map(b=>`<option value="${esc(b.key)}" ${chosen===b.key?'selected':''}>${esc(names.get(b.key))}</option>`).join('');if(!names.has(transferDraft.source))transferDraft.source=report.stores[0]?.key||'';if(!names.has(transferDraft.target))transferDraft.target=report.stores[1]?.key||transferDraft.source;const jobStatus={waiting:'Ожидает носильщика',pending:'Ожидает',active:'Перевозка',carrying:'В пути',delivering:'Доставка',blocked:'Нет доступного пути или груза',done:'Доставлено',completed:'Доставлено',cancelled:'Отменено'};return `<section class="district-logistics"><h3>Склады и перевозки</h3><p>Носильщиков: ${report.carriers}. Здесь показаны реальные местные запасы; груз переезжает только в руках жителей.</p><div class="supply-store-grid">${report.stores.map(b=>`<article class="management-row"><h4>${esc(names.get(b.key))}</h4><small>Вместимость каждого материала: ${b.capacity}</small>${buildingInventoryHTML({storage:b.stock,capacities:{storage:Object.fromEntries(MATERIALS.map(k=>[k,b.capacity]))},inTransit:{input:b.incoming,output:b.outgoing}},{transitLabels:{input:'Входящие грузы',output:'Исходящие грузы'}})}${b.reason?`<p>${esc(b.reason)}</p>`:''}${storePolicy({ ...b,id:b.key,stockMinimum:b.minimum,level:state.buildings.find(store=>buildingKey(store)===b.key)?.level||1})}</article>`).join('')}</div><form id="district-transfer" class="district-transfer"><label>Откуда<select name="source">${storeOptions(transferDraft.source)}</select></label><label>Куда<select name="target">${storeOptions(transferDraft.target)}</select></label><label>Груз<select name="resource">${MATERIALS.map(k=>`<option value="${k}" ${transferDraft.resource===k?'selected':''}>${label(k)}</option>`).join('')}</select></label><label>Количество<input name="amount" type="number" min="1" max="1000000" step="1" value="${transferDraft.amount}"></label><button ${report.stores.length<2?'disabled':''}>Заказать перевозку</button></form>${report.jobs.map(j=>`<article class="management-row"><b>${label(j.resource)} · ${esc(names.get(j.source)||j.source)} → ${esc(names.get(j.target)||j.target)}</b><p>${esc(jobStatus[j.status]||j.status)} · осталось ${foodAmount(j.remaining||0)} · в пути ${foodAmount(j.inTransit||0)} · доставлено ${foodAmount(j.delivered||0)}</p>${j.remaining>0&&!['done','completed','cancelled'].includes(j.status)?`<button data-cancel-transfer="${esc(j.id)}">Отменить перевозку</button>`:''}</article>`).join('')}</section>`;}
function cargoAmount(cargo){if(typeof cargo==='number')return foodAmount(cargo);return MATERIALS.filter(k=>cargo?.[k]>0).map(k=>`${label(k)} ${foodAmount(cargo[k])}`).join(', ')||'нет';}
function bindDistrict(root){bindStorePolicy(root);const form=root.querySelector('#district-transfer');if(form){form.oninput=()=>{for(const key of ['source','target','resource','amount'])transferDraft[key]=form.elements[key].value;};form.onchange=form.oninput;form.onsubmit=e=>{e.preventDefault();form.oninput();if(mutate(requestTransfer(state,transferDraft.source,transferDraft.target,transferDraft.resource,Number(transferDraft.amount)),'Заказ перевозки создан')){document.activeElement?.blur();renderSupply();}};}root.querySelectorAll('[data-cancel-transfer]').forEach(el=>el.onclick=()=>{mutate(cancelTransfer(state,el.dataset.cancelTransfer),'Перевозка отменена');el.blur();renderSupply();});}
let supplyFilter='all';
function showSupply(filter='all'){supplyFilter=['all','risk'].includes(filter)?filter:'all';openDialog('supply',`<button class="management-close" id="close-supply" aria-label="Вернуться в город">×</button><span class="eyebrow">ПРОДУКТЫ И ДОСТАВКА</span><h2>Снабжение семей</h2><div id="supply-content"></div>`);$('close-supply').onclick=closeDialog;renderSupply();}
function showSupplyHome(key,tab='food'){const [x,y]=key.split(',').map(Number),b=buildingAt(state,x,y);if(b?.type!=='house')return;closeDialog();if(selection)choose(selection);roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');clearRoadRoute();inspected={x,y};householdTab=tab;renderer.focusOn(x,y);detail('house',false,b);$('city').scrollIntoView({block:'center'});}
function renderFoodWarnings(){const w=foodWarnings(state),bar=$('food-warnings');bar.hidden=!w.alerts.length;setHTML(bar,w.alerts.map(a=>`<button class="food-warning ${a.severity}" data-food-warning="${a.id}" title="${esc(a.text)}">${a.severity==='danger'?'!':'△'} ${esc(a.title)} <span>→</span></button>`).join(''));bar.querySelectorAll('[data-food-warning]').forEach(el=>el.onclick=()=>showSupply(el.dataset.foodWarning==='families'?'risk':'all'));$('open-supply').textContent=w.alerts.length?`Снабжение · ! ${w.alerts.length}`:'Снабжение';$('open-supply').classList.toggle('needs-attention',!!w.alerts.length);}
const vowOutcomes={fulfilled:'Исполнен',partial:'Исполнен частично',broken:'Нарушен',renegotiated:'Срок пересогласован'};
const vowDraft=new Set();
let vowDraftCity=null;
function supplyVowPanel(report){
 if(!isStrictSumer(state))return '';
 if(vowDraftCity!==state){vowDraft.clear();vowDraftCity=state;}
 const active=state.supplyVows?.active,history=state.supplyVows?.history||[];
 const houses=new Map(report.houses.map(h=>[h.key,h]));
 const eligible=h=>h?.reachable&&h.residents.length&&h.food+1e-7<2*h.demand;
 for(const key of vowDraft)if(!eligible(houses.get(key)))vowDraft.delete(key);
 const town=h=>h.residents.map(c=>resident(c)).join(', ');
 const forecast=(h,required)=>h
  ? `Дома ${foodAmount(h.food)} из ${foodAmount(required)} · в пути ${foodAmount(h.inTransit)} · на доступных складах ${foodAmount(h.localFood)} · ${h.reachable?'путь открыт':'путь закрыт'}`
  : 'Двор больше недоступен';
 const progress=active?`<p>Осталось ${Math.max(0,(active.deadline-state.simTime)/60).toFixed(1)} игр. дня.</p><ul>${active.targets.map(t=>`<li>Двор ${esc(t.home)} · ${t.residents.map(id=>resident(id)).join(', ')}<br>${t.delivery?`Доставку подтвердил ${resident(t.delivery.witness)}`:forecast(houses.get(t.home),t.required)}</li>`).join('')}</ul>${active.previous===null?'<button type="button" data-vow-extend>Продлить на день · −1 доверие получателей</button>':''}`
  : `<p>Выбери до трёх дворов. Цель — запас на два ужина за два игровых дня.</p><ul>${[...vowDraft].map(key=>{const h=houses.get(key);return `<li>${town(h)} · ${forecast(h,2*h.demand)}</li>`;}).join('')}</ul><button type="button" data-vow-accept ${vowDraft.size&&state.resources.faith>=2?'':'disabled'}>Принять обет · 2 веры</button>`;
 const results=history.slice(-5).reverse().map(v=>`<li><b>${vowOutcomes[v.outcome]}</b> · ${v.targets.map(t=>`${esc(t.home)} — ${t.delivery?'доставлено':v.outcome==='renegotiated'?'ожидают':VOW_FAILURE_TEXT[t.failure]}`).join(', ')}</li>`).join('');
 return `<section class="food-forecast"><h3>Обет снабжения дворов</h3>${progress}${results?`<details><summary>Последние исходы</summary><ul>${results}</ul></details>`:''}</section>`;
}
function vowHouseButton(h){
 if(!isStrictSumer(state)||state.supplyVows?.active||!h?.residents.length||h.food+1e-7>=2*h.demand)return '';
 const selected=vowDraft.has(h.key);
 return `<button type="button" data-vow-house="${esc(h.key)}" aria-pressed="${selected}" ${h.reachable&&(selected||vowDraft.size<3)?'':'disabled'}>${h.reachable?selected?'Убрать из обета':'Выбрать для обета':'Для обета нужен путь к складу'}</button>`;
}
function bindSupplyVow(root){
 root.querySelectorAll('[data-vow-house]').forEach(button=>button.onclick=()=>{
  const key=button.dataset.vowHouse;
  if(!vowDraft.delete(key)&&vowDraft.size<3)vowDraft.add(key);
  renderSupply();
  [...root.querySelectorAll('[data-vow-house]')].find(next=>next.dataset.vowHouse===key)?.focus();
 });
 const accept=root.querySelector('[data-vow-accept]');
 if(accept)accept.onclick=()=>{
  if(mutate(acceptSupplyVow(state,[...vowDraft]),'Обет снабжения принят'))vowDraft.clear();
  renderSupply();
 };
 const extend=root.querySelector('[data-vow-extend]');
 if(extend)extend.onclick=()=>{mutate(extendSupplyVow(state),'Срок обета пересогласован');renderSupply();};
}
function waterRequestCard(request,{city=false}={}){
 if(!request)return '';
 const price=Object.entries(request.cost).filter(([key,amount])=>RESOURCE_NAMES[key]&&amount>0).map(([key,amount])=>`${amount} ${({clay:'глины',reed:'тростника',wood:'дерева'})[key]||label(key)}`).join(', ');
 return `<section class="food-forecast" aria-label="Просьба о воде"><h3>Просьба о воде · двор ${esc(request.home)}</h3><p>${resident(request.requesterId)} просит помочь с водозабором. Дома не хватает ${foodAmount(request.shortage)} воды до суточного запаса.</p><p>Стройка · ${esc(price)} и труд жителей. После стройки понадобится водонос.</p>${city?`<button type="button" data-water-request-home="${esc(request.home)}">Открыть двор и выбрать организатора</button>`:'<small>Выбери организатора и место. Материалы резервируются после подтверждения.</small>'}</section>`;
}
function renderSupply(){
 if(modalKind!=='supply')return;if($('supply-content').contains(document.activeElement)&&['INPUT','SELECT'].includes(document.activeElement.tagName))return;const report=supplyOverview(state),w=foodWarnings(state,foodForecast(state)),byKey=new Map(report.houses.map(h=>[h.key,h])),houses=w.houses.filter(h=>supplyFilter==='all'||h.hungry||h.atRisk);
 const summary=w.alerts.length?`<section class="supply-alerts" aria-label="Предупреждения">${w.alerts.filter(a=>supplyFilter==='all'||a.id==='families').map(a=>`<article class="supply-alert ${a.severity}"><b>${esc(a.title)}</b><p>${esc(a.text)}</p></article>`).join('')}</section>`:'<p class="supply-safe">Признаков недоедания, риска до жатвы и нехватки семян сейчас нет.</p>';
 setHTML($('supply-content'),`${summary}${waterRequestCard(cityWaterRequest(state),{city:true})}${supplyVowPanel(report)}${supplyFilter==='all'?forecastPanel(w.forecast):''}<div class="supply-filters" role="group" aria-label="Семьи"><button data-supply-filter="all" aria-pressed="${supplyFilter==='all'}">Все семьи · ${w.houses.length}</button><button data-supply-filter="risk" aria-pressed="${supplyFilter==='risk'}">Нужна помощь · ${w.riskFamilies.length}</button></div><p>Общий запас: <b>${foodAmount(state.resources.food)}</b> · в домах: <b>${foodAmount(report.atHome)}</b> · несут домой: <b>${foodAmount(report.inTransit)}</b><br>Нужно на полный ужин всему городу: ${foodAmount(report.demand)}. Недоедающих жителей: ${w.hungry}.</p><small>Прогноз без будущих поставок. К вечеру проверяем домашний запас с учётом несомой еды, ночью — оставшуюся часть ужина. Недоедание отмечается также по прошлому неполному ужину.</small><div class="supply-family-grid">${houses.length?houses.map(h=>{const diagnostic=byKey.get(h.key),status=h.hungry?`Недоедают ${h.hungry}${h.hungryChildren?` · дети ${h.hungryChildren}`:''}`:h.atRisk?'Риск остаться без ужина':h.blockedDelivery?'Доставка заблокирована':h.awaitingDelivery?'Еда в пути':h.need<=1e-7?'Семья уже поужинала':h.shortfall>1e-7?'Нужно пополнить домашний запас':'Запас на ужин есть';return `<article class="management-row supply-family ${h.severe?'danger':h.hungry||h.atRisk?'warning':''}"><h3>Дом ${h.x}, ${h.y} · ${h.residents.length} жителей</h3><b>${status}</b>${h.hungry?`<p>Недоедают: ${h.hungryResidents.map(c=>`${resident(c)} (${c.age<16?'ребёнок · ':''}голод ${Math.round(c.hunger||0)}%)`).join(', ')}.</p>`:''}<p>${esc(h.need<=1e-7?'Семья уже поужинала':h.food+1e-7>=h.need?'Домашней еды хватает на оставшийся ужин':diagnostic?.reason||'')}<br>Дома ${foodAmount(h.food)} · несут домой ${foodAmount(h.inTransit)}<br>${isDinnerTime(state.simTime)?'Осталось съесть в этот ужин':'На ближайший ужин'}: ${foodAmount(h.need)}${h.shortfall>1e-7?` · не хватает дома и в пути ${foodAmount(h.shortfall)}`:''}</p><button data-supply-home="${h.key}">Показать дом и еду</button>${vowHouseButton(diagnostic)}</article>`;}).join(''):'<p class="supply-safe">Семей, которым сейчас нужна помощь, нет.</p>'}</div>${supplyFilter==='risk'?forecastPanel(w.forecast):''}${districtPanel()}<section class="clothing-summary"><h3>Одежда города</h3><p>На складах: ${foodAmount(state.resources.clothing)} · изношенная одежда у ${state.citizens.filter(c=>c.clothing<=25).length} жителей · несут домой: ${state.citizens.reduce((n,c)=>n+(c.clothingLoad||0),0)}.</p><small>Мастер одежды превращает 2 ткани в 1 одеяние. Взрослые забирают замену для себя и детей из доступного местного склада.</small></section>`);
 const waterRequest=$('supply-content').querySelector('[data-water-request-home]');
 if(waterRequest)waterRequest.onclick=()=>showSupplyHome(waterRequest.dataset.waterRequestHome,'water');
 bindSupplyVow($('supply-content'));bindDistrict($('supply-content'));bindFoodPlan($('supply-content'));$('supply-content').querySelectorAll('[data-supply-home]').forEach(el=>el.onclick=()=>showSupplyHome(el.dataset.supplyHome));$('supply-content').querySelectorAll('[data-supply-filter]').forEach(el=>el.onclick=()=>{supplyFilter=el.dataset.supplyFilter;renderSupply();});
}

function depositDetail(x,y){
 const same=inspectedDeposit?.x===x&&inspectedDeposit?.y===y;
 inspected=null;inspectedPerson=null;inspectedDeposit={x,y};
 const panel=$('tile-detail'),view=manualGatheringView(state,x,y);if(!view){inspectedDeposit=null;panel.hidden=true;return;}
 // Keep keyboard focus and an in-progress click stable while the work meter ticks.
 // Selecting another deposit or explicitly executing a command still refreshes.
 if(same&&!panel.hidden&&panel.contains(document.activeElement))return;
 panel.hidden=false;setHTML(panel,manualGatheringHTML(state,view));
 bindManualGathering(panel,{onReedRest:()=>{panel.querySelector('[data-reed-rest]')?.blur();mutate(closeReedBed(state,x,y),'Сбор тростника закрыт на два дня');},onOrder:()=>{panel.querySelector('[data-manual-order]')?.blur();mutate(orderManualGathering(state,x,y),'Поручение принято: свободные жители соберут сырьё и принесут в склад');},onCancel:()=>{panel.querySelector('[data-manual-cancel]')?.blur();mutate(cancelManualGathering(state,x,y),'Сбор остановлен. Уже собранный груз будет доставлен');},onClose:()=>{inspectedDeposit=null;panel.hidden=true;}});
}
function detail(type,placement,b=null){
 inspectedPerson=null;inspectedDeposit=null;const def=buildingPresentation(state,b||{type,level:1});$('tile-detail').hidden=false;
 $('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">${placement?'НОВАЯ ПОСТРОЙКА':b.construction?'ЗАКАЗ ГОРОДА':b.type==='canal'?'ОРОСИТЕЛЬНЫЙ КАНАЛ':`УРОВЕНЬ ${levelOf(b)} / 3`}</span><h3>${def.name}</h3>${!placement?`<p class="building-construction-year">${esc(buildingChronology(b).label)}</p>`:''}${artworkHTML(type)}<p>${def.desc}</p><strong>${esc(yieldSummary(state,b?.construction?.kind==='new'&&!(type==='garden'&&isStrictSumer(state))?{...b,construction:undefined}:b||{type,level:1}))}</strong>${type==='house'&&!placement?'<section id="household-panel"></section>':''}${placement?`<h4>Цена постройки</h4><div id="placement-cost" data-building="${type}">${costs(def,true,type!=='house')}</div><p>${type==='bridge'?'Выбери клетку воды.':'Нажми на свободную клетку.'} Материалы резервируются сразу. Escape — отмена.</p>`:'<div id="building-controls"></div>'}`;
 $('tile-detail').querySelector('.detail-close').onclick=()=>{inspected=null;inspectedPerson=null;inspectedDeposit=null;$('tile-detail').hidden=true;};if(!placement)updateDetail();
}
function updateDetail(){
 if(inspectedDeposit&&!selection&&!$('tile-detail').hidden){depositDetail(inspectedDeposit.x,inspectedDeposit.y);return;}
 if(roadMode&&routeFrom&&routeTo){renderRoadRoute();return;}
 if($('placement-cost')){const type=$('placement-cost').dataset.building;if(BUILDINGS[type])setHTML($('placement-cost'),costs(BUILDINGS[type],true,type!=='house'));}
 if(inspectedPerson!==null&&!selection&&!$('tile-detail').hidden){const c=state.citizens.find(c=>c.id===inspectedPerson);if(c&&!$('tile-detail').contains(document.activeElement))personDetail(c);return;}
 if(!inspected||selection||$('tile-detail').hidden||!$('building-controls'))return;
 const b=entityAt(inspected.x,inspected.y);if(!b){inspected=null;$('tile-detail').hidden=true;return;}
 if(b.type==='road'){updateRoadDetail(b);return;}
 const dateLabel=$('tile-detail').querySelector('.building-construction-year');if(dateLabel)dateLabel.textContent=buildingChronology(b).label;
 // Refresh the live readout without replacing a focused priority selector.
 if(b.construction&&$('inspector-site-live'))setHTML($('inspector-site-live'),siteStatus(b));
 if($('building-controls').contains(document.activeElement)&&(b.construction||document.activeElement.closest('.staff-preparation')||['SELECT','INPUT'].includes(document.activeElement.tagName)))return;
 if(b.type==='house')renderHousehold(b);
 const receiptsOpen=$('building-controls').querySelector('[data-granary-receipts]')?.open;
 const q=b.construction,reason=canUpgrade(state,b),cost=upgradeCost(b),demolitionReason=canDemolish(state,b);
 $('tile-detail').querySelector('.eyebrow').textContent=q?(q.kind==='boat'?'ЛОДОЧНЫЙ ДВОР':q.kind==='repair'?'РЕМОНТ':q.kind==='upgrade'?`УЛУЧШЕНИЕ ДО ${q.target}`:'СТРОЙПЛОЩАДКА'):b.type==='canal'?'ОРОСИТЕЛЬНЫЙ КАНАЛ':`УРОВЕНЬ ${levelOf(b)} / 3`;
 const previewCompleted=q?.kind==='new'&&!(b.type==='garden'&&isStrictSumer(state));
 $('tile-detail').querySelector('strong').textContent=(previewCompleted?'После завершения: ':'')+yieldSummary(state,previewCompleted?{...b,construction:undefined}:b);
 $('building-controls').innerHTML=q?`<div id="inspector-site-live">${siteStatus(b)}</div>${priorityControl(b)}<button class="management-button danger" data-cancel="${b.x},${b.y}">${q.kind==='repair'?'Отменить ремонт':q.kind==='upgrade'?'Отменить улучшение':'Отменить строительство'}</button>`:`<p>${b.type==='house'?'':['market','harbor'].includes(b.type)?`Носильщиков у торговой площадки: ${state.citizens.filter(c=>(c.tradeMarket||c.saleMarket)===buildingKey(b)).length} / ${activeLaborKind(state)==='unload'?UNLOAD_PORTERS:2}.`:stockStores(state).some(store=>buildingKey(store)===buildingKey(b))?'':`Назначено работников: ${state.citizens.filter(c=>c.work===buildingKey(b)).length}.`}</p>${!['canal','levee'].includes(b.type)&&levelOf(b)<3?`<h4>Цена улучшения до ${levelOf(b)+1}</h4>${costs(cost,true,b.type!=='house')}<small>${levelOf(b)===1?'II уровень: сырцовая кладка':'III уровень: обожжённая кладка, новый сырец не нужен'}</small>`:''}<button class="upgrade-button" id="upgrade-building" ${reason?'disabled':''}>${['canal','levee'].includes(b.type)?'Один уровень':levelOf(b)>=3?'Максимальный уровень':`Улучшить до ${levelOf(b)+1}`}</button><small id="upgrade-reason">${esc(reason||'Материалы резервируются сразу.')}</small>`;
 if(!q||q.kind!=='new')$('building-controls').insertAdjacentHTML('afterbegin',votivePanel(b)+guardControl(b)+staffingControl(b)+stockAccountControl(b));
 if(receiptsOpen){const receipts=$('building-controls').querySelector('[data-granary-receipts]');if(receipts)receipts.open=true;}
 if(b.type==='field')$('building-controls').insertAdjacentHTML('afterbegin',`<p>Декоративная посадка: ${esc(CROP_NAMES[fieldCropKind(b)])}; урожай учитывается как общая еда. Семена привозят земледельцы со склада. Снопы обмолачивают на току у поля; только потом несут еду в амбар.</p><button data-open-food-plan>Прогноз еды и семена</button>`);
 if(!q||q.kind!=='new')$('building-controls').insertAdjacentHTML('afterbegin',productionReadout(state,b)+buildingProductionHistoryHTML(state,b)+buildingInventoryHTML(buildingInventory(state,b),{house:b.type==='house',production:!!Object.keys(BUILDINGS[b.type]?.output||{}).length}));
 if(b.type==='field'&&!q&&soilCareEnabled(state)){
  const key=buildingKey(b),water=fieldWater(state,b),year=fieldRestYear(state,b);
  const rest=b.soil?.restYear===year,salt=Math.round((b.soil?.salt||0)*100),next=Math.round(nextFieldSalt(state,b,water)*100);
  const diagnosis=salt>25?'Соль снижает урожай':next>25?'После лета возможны потери урожая':'Поле пока даёт полный урожай';
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>Почва</h4><p>Засоление ${salt}% · ${diagnosis}. ${water.drained?'Дренаж отводит воду.':'Для дренажа нужен соседний отвод, связанный с водоёмом.'}</p><button id="field-rest" type="button">${rest?'Отменить отдых':'Оставить поле под паром'} · год ${year}</button></section>`);
  $('field-rest').onclick=()=>{ $('field-rest').blur();mutate(setFieldRest(state,key,!rest),rest?'Отдых поля отменён':'Запланирован отдых поля'); };
 }
 if(['clay','quarry'].includes(b.type)&&isStrictSumer(state)){
  const stone=b.type==='quarry',remaining=stone?stoneRemaining(state,b.x,b.y):clayRemaining(state,b.x,b.y);
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>${stone?'Месторождение камня':'Залежь глины'}</h4><p>Остаток ${rounded(remaining)} / ${stone?STONE_CAPACITY:CLAY_CAPACITY}${remaining<=1e-8?' · залежь исчерпана':''}.</p><small>Для дальнейшей добычи нужна другая залежь. Сырьё также можно купить у прибывших торговцев.</small></section>`);
 }
 if(b.type==='reed'&&(!q||q.kind==='upgrade')&&isStrictSumer(state)){
  const controls=$('building-controls');
  controls.insertAdjacentHTML('afterbegin',reedBedHTML(reedStatus(state,b.x,b.y),REED_CAPACITY));
  const button=controls.querySelector('[data-reed-rest]');
  if(button)button.onclick=()=>{button.blur();mutate(closeReedBed(state,b.x,b.y),'Сбор тростника закрыт на два дня');};
 }
 if(b.type==='logging'&&(!q||q.kind==='upgrade')&&isStrictSumer(state)){
  const forest=forestFor(state,b.x,b.y),status=forest&&forestStock(state,forest);
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>Лесное угодье</h4>${status?`<p>Роща ${esc(forest)} · остаток ${rounded(status.stock)} / ${FOREST_CAPACITY}${status.resting?` · отдых ещё ${Math.ceil(status.seconds)} с`:''}.</p><button type="button" id="forest-rest" ${status.resting||status.stock>=FOREST_CAPACITY?'disabled':''}>Закрыть рубку на три дня</button>`:'<p>У этого двора нет доступной рощи.</p>'}<small>Соседние дворы делят запас. После трёх игровых суток отдыха восстановится до ${FOREST_RECOVERY} ед. Древесину можно купить у торговцев.</small></section>`);
  if($('forest-rest'))$('forest-rest').onclick=()=>{$('forest-rest').blur();mutate(closeForestForRest(state,b),'Рубка закрыта на три дня');};
 }
 if(b.type==='fishing'&&(!q||q.kind==='upgrade')&&isStrictSumer(state)){
  const origin=networkFor(state).ports.find(p=>p.building===b),grounds=fisheryOptions(state,origin);
  const rows=grounds.map(g=>{
   const label=g.key.startsWith('river:')?`Речной участок №${Number(g.key.slice(6))+1}`:`Озеро · ${g.key.slice(5)}`;
   return `<p>${esc(label)} · запас ${rounded(g.stock)} / 48${g.resting?` · отдых ещё ${Math.ceil(g.seconds)} с`:''}</p><button type="button" data-fishery-rest="${esc(g.key)}" ${g.resting||g.stock>=48?'disabled':''}>Закрыть лов на сутки</button>`;
  }).join('');
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>Рыбные угодья</h4>${rows||'<p>Из двора нет подхода к воде.</p>'}<small>Запас общий для всех дворов у участка. За сутки отдыха восстановится до 18 ед. Другие участки остаются открыты.</small></section>`);
  $('building-controls').querySelectorAll('[data-fishery-rest]').forEach(el=>el.onclick=()=>{el.blur();mutate(closeFishingGround(state,b,el.dataset.fisheryRest),'Лов закрыт на сутки');});
 }
 if(b.type==='canal'&&!q&&canalMaintenanceEnabled(state)){
  const worker=state.citizens.find(c=>c.work===buildingKey(b));
  const silt=Math.round((b.silt||0)*100);
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>Состояние русла</h4><p>Ил ${silt}% · пропускная способность ${canalShares(b)} из 3 долей</p>${b.canalCleaning?`<small>${worker?`Работник · ${resident(worker)}`:'Наряд ждёт свободного взрослого и доступной дороги'}</small>`:`<button id="clean-canal" type="button" ${silt?'':'disabled'}>Заказать расчистку</button>`}</section>`);
  const outlet=irrigationFor(state).outlets.has(buildingKey(b));
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><p>${b.drain?(outlet?'Дренаж соединён с водоёмом':'Дренаж ждёт выхода к водоёму'):'Канал подаёт воду полям. Отвод дренажа работает отдельно.'}</p><button id="canal-drain" type="button">${b.drain?'Вернуть канал к поливу':'Использовать как дренаж'}</button></section>`);
  $('canal-drain').onclick=()=>{ $('canal-drain').blur();mutate(setCanalDrain(state,buildingKey(b),!b.drain),b.drain?'Канал возвращён к поливу':'Участок отведён под дренаж'); };
  const clean=$('clean-canal');
  if(clean)clean.onclick=()=>{clean.blur();mutate(queueCanalCleaning(state,buildingKey(b)),'Назначена расчистка канала');};
 }
 if(b.type==='tailor'&&(!q||q.kind==='upgrade')){$('building-controls').insertAdjacentHTML('afterbegin','<button id="inspire-tailor">Вдохновить мастера одежды</button>');$('inspire-tailor').onclick=()=>showManagement('residents');}
 if(['shrine','ziggurat'].includes(b.type)&&(!q||q.kind==='upgrade')){const students=state.citizens.filter(c=>c.school===buildingKey(b));$('building-controls').insertAdjacentHTML('afterbegin',`<div class="market-readout"><b>Обучение лекарей · ${students.length}</b><p>${students.map(c=>`${resident(c)} · ${Math.floor(c.medicine.study/STUDY_SECONDS*100)}% · ${c.phase==='studying'?'учится':'в пути'}`).join('<br>')||'Ученики приходят после успешного вдохновения профессией «Лекарь».'}</p></div>`);}
 if(b.type==='waterpoint'&&(!q||q.kind==='upgrade'))$('building-controls').insertAdjacentHTML('afterbegin',`<div class="market-readout"><b>Вода кварталу</b><p>Водоносы набирают воду у берега и несут в дома, кирпичные, гончарные и пивоваренные дворы.</p><small>Нужны жители с профессией «Водонос». Вода хранится у получателей; общий склад её не хранит.</small></div>`);
 if(b.type==='musicHouse'&&!q){const p=musicPerformance(state,b);$('building-controls').insertAdjacentHTML('afterbegin',`<div class="music-hint">${p.playing?`Играет ${resident(p.musician)}`:'Музыка молчит: назначь взрослого, вдохнови музыкантом и дождись его на месте днём.'}<br>Тихий звук слышен рядом с двором, если включён звук игры. Каменные лепестки — художественный инструмент.</div>`);}
 if(b.type==='healer'&&(!q||q.kind==='upgrade')){const doctors=state.citizens.filter(c=>c.work===buildingKey(b)),doctor=doctors[0],patients=state.citizens.filter(c=>c.clinic===buildingKey(b));$('building-controls').insertAdjacentHTML('afterbegin',`<div class="market-readout"><b>${!doctors.length?'Нужен обученный лекарь: вдохнови жителя и дождись учёбы в храме':!isWorkday(state.simTime)?'Ночь · лекарь отдыхает':!doctors.some(c=>c.phase==='working')?'Лекарь идёт на работу':availableFood(state)<=0||state.resources.reed<=0?'Лечение приостановлено: нужна еда и тростник':'Лекарь принимает'}</b>${doctor?`<p>${resident(doctor)} · лекарь уровня ${medicalLevel(doctor)}/5</p>${medicalReadout(doctor)}`:''}<p>Пациенты: ${patients.length} / ${1+levelOf(b)}<br>${patients.map(c=>`${resident(c)} · ${Math.round(c.health)}% → ${c.careGoal||85}% · ${c.phase==='treatment'?'лечится':'в пути'}`).join('<br>')||'Нет пациентов'}</p><small>На 10 здоровья: ${Number((.4*healingCost(doctor||{})).toFixed(2))} еды + ${Number((.2*healingCost(doctor||{})).toFixed(2))} тростника. Мастерство ускоряет лечение, экономит припасы и повышает предел здоровья. Уровень растёт каждый год с практикой, до пятого.</small><button id="inspire-healer">Вдохновить лекаря</button></div>`);$('inspire-healer').onclick=()=>showManagement('residents');}
 if(['market','harbor'].includes(b.type)&&(!q||q.kind==='upgrade')){$('building-controls').insertAdjacentHTML('afterbegin',`<div class="market-readout"><b>${esc(state.trade.caravan?.market===buildingKey(b)?marketStatus(state)||'Торговля открыта · товары разгружены':b.type==='harbor'?'Пристань ждёт следующую грузовую лодку':'Рынок ждёт следующий караван')}</b>${deliveryOverview(buildingKey(b))}<button class="market-open-trade" id="market-open-trade">Открыть торговлю</button></div>`);$('market-open-trade').onclick=showTrade;bindSaleCancellations($('building-controls'));}
 if(!q||q.kind!=='new')$('building-controls').insertAdjacentHTML('beforeend',`<button class="management-button danger" id="demolish-building" ${demolitionReason?'disabled':''}>Снести здание</button>${demolitionReason?`<small class="blocked-reason">${esc(demolitionReason)}</small>`:''}`);
 if((!q||q.kind==='upgrade')&&stockStores(state).some(store=>buildingKey(store)===buildingKey(b))){$('building-controls').insertAdjacentHTML('afterbegin',storePolicy(b));bindStorePolicy($('building-controls'));}
 if(b.type==='harbor'&&q?.kind!=='new'){
  $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel"><h4>Обслуживание лодок</h4><p data-harbor-capacity>Глубина причала · уровень ${levelOf(b)}. Вместимость нового речного рейса · ×${harborCargoMultiplier(state,b)} для дерева и камня.</p><p>${b.boatWear?'Износ · разгрузка занимает до 8 секунд симуляции.':'Готово к рейсу · разгрузка занимает 4 секунды симуляции.'}</p>${b.boatWear&&!q?`${costs(boatRepairCost)}<button type="button" id="repair-harbor-boat">Заказать обслуживание</button>`:''}</section>`);
  if(isStrictSumer(state)){
   $('building-controls').insertAdjacentHTML('afterbegin',`<section class="staffing-panel" data-harbor-tender><h4>Перегрузочная лодка</h4><p>${b.boatTender?'Лодка готова. В маловодье следующий рейс может привезти больше груза.':q?.kind==='boat'?'Жители собирают лодку.':'В маловодье увеличивает вместимость следующего рейса на один уровень, до ×3.'}</p>${!q&&!b.boatTender?`${costs(boatTenderCost)}<button type="button" id="build-harbor-tender">Заказать лодку</button>`:''}</section>`);
   if($('build-harbor-tender'))$('build-harbor-tender').onclick=()=>mutate(buildHarborTender(state,b),'Постройка лодки заказана');
  }
  if($('repair-harbor-boat'))$('repair-harbor-boat').onclick=()=>mutate(repairHarborBoat(state,b),'Обслуживание лодок заказано');
 }
 if(!q&&b.floodDamage)$('building-controls').insertAdjacentHTML('afterbegin',floodRepairControl(b));bindManagement($('building-controls'));bindFloodRepair(b);if($('upgrade-building'))$('upgrade-building').onclick=()=>{if(mutate(upgrade(state,b.x,b.y),'Заказ на улучшение создан'))detail(b.type,false,b);};if($('demolish-building'))$('demolish-building').onclick=()=>confirmRemoval(b,true);
}
function wellbeingReadout(c){return `<div class="wellbeing-readout"><span>Голод <b>${Math.round(c.hunger||0)}%</b></span><span>Здоровье <b>${Math.round(c.health??100)}%</b></span><span>Настроение <b>${Math.round(c.mood??75)}%</b></span><span>Вера <b>${Math.round(c.faith??60)}%</b></span><span>Работоспособность <b>${Math.round(workRate(c,c.siteDuty||state.buildings.find(b=>buildingKey(b)===c.work)?.type||c.role)*100)}%</b></span><span class="${c.clothing<=25?'clothing-poor':''}">Одежда <b>${Math.ceil(c.clothing??100)}%</b> · ${clothingStatus(c)}</span></div><small class="clothing-help">Одежда служит около 3 лет. При остатке ≤25% взрослые несут замену со склада себе и детям. Ветхая одежда ухудшает настроение и здоровье, сильнее зимой и в дождь.</small>`;}
function vowMemoryHTML(id){
 const history=state.supplyVows?.history||[];
 for(let i=history.length-1;i>=0;i--){
  const vow=history[i];
  if(vow.outcome!=='fulfilled'&&vow.outcome!=='partial')continue;
  const t=vow.targets.find(t=>t.delivery&&(t.delivery.witness===id||t.delivery.recipient===id));
  if(t)return `<small>Обет снабжения · двор ${esc(t.home)} · доставил ${resident(t.delivery.witness)} · ${vowOutcomes[vow.outcome]}</small>`;
 }
 return '';
}
function medicalMemoryHTML(p){
 if(!p)return '';
 return [p.medicalRecovery?`Вышел из тяжёлого состояния после лечения у ${resident(p.medicalRecovery.id)}`:'',p.medicalAid?`Помог выйти из тяжёлого состояния: ${resident(p.medicalAid.id)}`:''].filter(Boolean).map(line=>`<small>${line}</small>`).join('');
}
function confirmWaterProjectPlacement({x,y}){
 const {organizerId,requesterId}=waterProjectDraft,offer=waterProjectProposal(state,organizerId,requesterId,x,y);
 if(!offer.ok){toast(offer.reason);return;}
 const organizer=state.citizens.find(c=>c.id===organizerId);
 openDialog('water-project',`<h2>Водозабор для двора</h2><p>${esc(organizer.name)} возглавит стройку на участке ${x}, ${y}. Материалы зарезервируют на доступных складах. После стройки назначь водоноса.</p>${costs(offer.cost,false)}<button id="approve-water-project">Начать стройку</button> <button id="cancel-water-project">Выбрать другое место</button>`);
 $('cancel-water-project').onclick=closeDialog;
 $('approve-water-project').onclick=()=>{
  const result=approveWaterProject(state,organizerId,requesterId,x,y);
  closeDialog();
  if(!result.ok){toast(result.reason);return;}
  choose('waterpoint');save();update();toast('Жители начали проект водозабора');checkDialogs();
 };
}
function waterProjectHousehold(b){
 if(!isStrictSumer(state))return '';
 const projects=state.buildings.filter(site=>{
  const p=site.humanWaterProject;
  return p?.home===buildingKey(b)&&(p.homeId===undefined||p.homeId===b.waterEntityId);
 });
 const activeIds=new Set(projects.map(site=>site.waterEntityId));
 const archive=(state.causalFacts?.water||[]).filter(f=>f.homeId===b.waterEntityId&&!activeIds.has(f.stationId)).reverse().map(f=>
  `<p data-water-delivery-memory><b>Первая доставка из прежнего водозабора · ${esc(f.station)}</b><br>${resident(f.courierId)} · ${foodAmount(f.amount)} воды</p>`).join('');
 const status=archive+projects.map(site=>{
  const p=site.humanWaterProject,organizer=state.citizens.find(c=>c.id===p.organizerId);
  return `<p><b>Водозабор · ${site.x}, ${site.y}</b><br>${organizer?`Организатор · ${esc(organizer.name)}<br>`:''}${p.delivery?`Первая доставка во двор · ${foodAmount(p.delivery.amount)} воды`:site.construction?'Идёт строительство':'Построен · ожидается первая доставка'}</p>`;
 }).join('');
 const request=householdWaterRequest(state,b);
 if(!request)return status;
 const card=status+waterRequestCard(request);
 if(state.buildings.some(site=>site.humanWaterProject&&site.construction?.kind==='new'))return card+'<p>Другой двор уже строит водозабор.</p>';
 const organizers=state.citizens.filter(c=>!waterProjectOrganizerReason(state,c));
 if(!organizers.length)return card+'<p>Для водозабора нужен свободный взрослый строитель с запасом воды дома.</p>';
 return card+`<label>Организатор водозабора <select data-water-organizer>${organizers.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select></label> <button data-water-project>Выбрать место</button>`;
}
function showHouseholdInitiative(b){
 const offer=householdInitiative(state,b);
 if(!offer.ok){toast(offer.reason);return;}
 const names=offer.members.map(id=>state.citizens.find(c=>c.id===id)?.name).filter(Boolean);
 renderer.focusOn(offer.x,offer.y);
 openDialog('household-initiative',`<h2>Семья предлагает построить малый двор</h2><p>${esc(names.join(', '))} хотят жить отдельно. Они нашли место рядом с домом · ${offer.x}, ${offer.y}.</p>${costs(offer.cost,false)}<p>Четыре места после стройки. Согласие стоит 0 веры. Семья переедет, когда сможет закончить текущие дела.</p><button id="approve-household-initiative">Согласовать стройку</button> <button id="cancel-household-initiative">Отложить</button>`);
 $('cancel-household-initiative').onclick=closeDialog;
 $('approve-household-initiative').onclick=()=>{
  const result=approveHouseholdInitiative(state,b,offer);
  closeDialog();
  if(mutate(result,'Семья начала стройку малого двора'))renderHousehold(b);
 };
}
function householdInitiativePanel(b,h){
 if(!isStrictSumer(state))return '';
 const related=state.buildings.filter(site=>site.householdInitiative?.source===buildingKey(b)||site===b&&site.householdInitiative);
 return related.map(site=>`<p><b>Малый двор · ${site.x}, ${site.y}</b><br>${site.construction?.kind==='new'?'Идёт стройка':site.householdInitiative.settled?'Семья переехала':'Дом готов · семья ещё не переехала'}${site.householdInitiative.autonomous?' · семья начала сама':''}</p>`).join('')+
  (h.residents.some(c=>c.partner!==null)?'<button data-household-initiative>Предложение нового двора</button>':'');
}
function eveningGamePanel(b){
 const game=b.eveningGame;
 if(!game)return '';
 const text={waiting:'Сосед идёт в гости',playing:'Играют за доской',finished:'Закончили партию · обоим +2 к настроению',interrupted:'Отложили партию из-за срочного дела'};
 return `<section class="house-food" data-evening-game><b>${game.guestHome?'Игра с соседями':'Вечерняя игра'} · день ${Math.floor(game.startedAt/60)+1}</b><p>${game.players.map(id=>resident(id)).join(' и ')}<br>${text[game.status]}</p></section>`;
}
function renderHousehold(b){const panel=$('household-panel');if(!panel)return;const h=household(state,b),diagnostic=householdTab==='food'?supplyOverview(state).houses.find(h=>h.key===buildingKey(b)):null,adult=h.residents.filter(c=>c.age>=16);
 const row=c=>`<article class="house-person"><b>${resident(c)}</b><span>${rounded(c.age)} лет · ${c.age<16?'ребёнок':c.age>=55?'пожилой':'взрослый'}${['home','resting'].includes(c.phase)&&(c.diningUntil||0)>state.simTime?' · ужинает':''}</span><small>Голод ${Math.round(c.hunger||0)}% · здоровье ${Math.round(c.health??100)}% · настроение ${Math.round(c.mood??75)}% · вера ${Math.round(c.faith??60)}%</small><small>${c.parents?.length?`Родители: ${c.parents.map(id=>`${resident(id)}${state.citizens.some(p=>p.id===id)?'':state.lifeAnalytics?.people.some(p=>p.id===id&&p.diedTick!==null)?' †':' · запись не сохранилась'}`).join(', ')}`:c.partner!==null?`Супруг(а): ${resident(c.partner)}`:'Основатель / переселенец'}</small></article>`;
 const memorials=householdTab==='family'?familyMemorialsAt(state,b):[];
 const memoryText=memorials.length?`<section class="house-food"><b>Память дома</b><ul>${memorials.map(p=>`<li>${resident(p.id)}${state.citizens.some(c=>c.memorialMove?.id===p.id)?' · памятный предмет в пути':''} · год ${Math.floor(p.diedTick/4)+1} · ${esc(LIFE_CAUSE_NAMES[p.cause])}${p.memorial.skills.map(skill=>` · ${skill.kind==='builder'?'Строитель':'Лекарь'} · ур. ${skill.level}`).join('')}${medicalMemoryHTML(p)}${vowMemoryHTML(p.id)}</li>`).join('')}</ul></section>`:'';
 const care=b.familyCare,helper=care&&h.residents.find(c=>c.id===care.helper),patient=care&&h.residents.find(c=>c.id===care.target);
 const careText=isStrictSumer(state)?`<section class="house-food"><b>Семейный уход</b>${helper&&patient&&care.day===Math.floor(state.simTime/60)?`<p>${resident(helper)} → ${resident(patient)} · ${care.done?'помощь оказана':'помощь начата'}</p>`:''}<small>С 18:00 до ужина родственники помогают дома больному, пожилому или малышу. На уход нужно 0,25 воды и запас еды на ужин.</small></section>`:'';
 const w=waterSummary(state,b);
 const content=householdTab==='water'?`<div class="house-food"><b>Вода дома: ${foodAmount(w.stock)} / ${foodAmount(w.capacity)}</b><p>В пути: ${foodAmount(w.inTransit)} · принесено: ${foodAmount(w.delivered)}<br>Потребность за день: ${foodAmount(w.demand)} · страдают от жажды: ${w.thirsty}</p><small>Водонос снабжает квартал; при задержке взрослые сами идут к доступному берегу. Вода не заменяет полив полей.</small>${waterProjectHousehold(b)}</div>`:householdTab==='family'?`<p class="house-occupancy">Живут ${h.residents.length} / ${h.capacity} · свободно ${h.free}</p><p class="house-gathering">Дома ${h.atHome} / ${h.residents.length}${h.dining?` · ужинают ${h.dining}`:''}${h.hungry?` · недоедают ${h.hungry}`:''}<br>Семейный ужин с 20:00, после возвращения домой.</p>${careText}${memoryText}${householdInitiativePanel(b,h)}${eveningGamePanel(b)}${h.residents.length?`${adult.length?`<h4>Взрослые и родители · ${adult.length}</h4>${adult.map(row).join('')}`:''}${h.children.length?`<h4>Дети · ${h.children.length}</h4>${h.children.map(row).join('')}`:''}`:'<p>Дом пока пуст. Здесь может поселиться новая семья.</p>'}`:`<div class="house-food"><p>${esc(diagnostic?.reason||'')}</p><b>${rounded(h.food)} еды в доме</b><p>Принесено со склада за всё время: ${rounded(h.delivered)}<br>Несут домой: ${rounded(h.inTransit)}<br>Нужно на ужин: ${rounded(h.demand*4/3)}${h.demand?` · запас на ${rounded(h.food/(h.demand*4/3))} ужина`:''}<br>${isDinnerTime(state.simTime)?'Этот':'Прошлый'} ужин: съедено ${rounded(h.residents.reduce((n,c)=>n+(c.mealEaten||0),0))}<br>Дома ${h.atHome} / ${h.residents.length} · недоедают ${h.hungry}</p><small>В 20:00 семья ест только домашние продукты. Еду со склада нужно принести: запас на складе не заменяет ужин. Дети получают половину взрослой порции. Вверху показаны общие запасы, без еды в домах.</small></div>`;
 const selectedOrganizer=panel.querySelector('[data-water-organizer]')?.value;
 if(setHTML(panel,`<div class="house-tabs" role="tablist" aria-label="Дом"><button role="tab" data-house-tab="family" aria-selected="${householdTab==='family'}">Семья · ${h.residents.length}</button><button role="tab" data-house-tab="food" aria-selected="${householdTab==='food'}">Еда · ${rounded(h.food)}</button><button role="tab" data-house-tab="water" aria-selected="${householdTab==='water'}">Вода · ${rounded(w.stock)}</button></div><div role="tabpanel">${content}</div>`)){
 panel.querySelectorAll('[data-house-tab]').forEach(el=>el.onclick=()=>{householdTab=el.dataset.houseTab;renderHousehold(b);});
 const initiative=panel.querySelector('[data-household-initiative]');
 if(initiative)initiative.onclick=()=>showHouseholdInitiative(b);
 const organizer=panel.querySelector('[data-water-organizer]');
 if(organizer){
  if([...organizer.options].some(option=>option.value===selectedOrganizer))organizer.value=selectedOrganizer;
  panel.querySelector('[data-water-project]').onclick=()=>{
   const request=householdWaterRequest(state,b);
   if(!request){toast('Условия изменились. Проверь запас воды во дворе');return;}
   if(selection==='waterpoint')choose('waterpoint');
   choose('waterpoint');
   if(selection!=='waterpoint')return;
   waterProjectDraft={requesterId:request.requesterId,organizerId:Number(organizer.value)};
   $('map-hint').textContent='Водозабор для двора · выбери место у воды · Escape — отмена';
  };
 }
 }
}
function personDetail(c){
 inspectedDeposit=null;
 inspected=null;inspectedPerson=c.id;$('tile-detail').hidden=false;const home=state.buildings.find(b=>buildingKey(b)===c.home),work=[c.workplace,c.saleJob&&c.saleMarket,c.tradeJob&&c.tradeMarket,c.site,c.work].filter(Boolean).map(key=>state.buildings.find(b=>buildingKey(b)===key)).find(Boolean);
 const workLabel=work&&buildingKey(work)===c.workplace?buildingPresentation(state,work).name:c.saleJob?'Погрузка продажи в караван':c.tradeJob?'Покупки с рынка':work&&buildingKey(work)===c.site?'Стройка · '+buildingPresentation(state,work).name:work?buildingPresentation(state,work).name:c.manualGathering?'Ручной сбор на залежи':'пока не назначена';
 const workLink=work?`<a class="person-work-link" href="#tile-detail" data-inspect="${work.x},${work.y}">${esc(workLabel)} ↗</a>`:esc(workLabel);
 $('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">ЖИТЕЛЬ ГОРОДА</span><h3>${resident(c)}</h3>${citizenEpithetHTML(state,c)}${personalMemoryHTML(state,c.id,resident)}${medicalMemoryHTML(state.lifeAnalytics?.people.find(p=>p.id===c.id))}${vowMemoryHTML(c.id)}${c.builderSkill?`<p>Мастерство строителя · ${['','I','II','III'][builderLevel(c)]} · проектов ${c.builderSkill.projects}${c.builderSkill.practice?` · практика с наставником ${(c.builderSkill.practice/PRACTICE_PER_PROJECT).toLocaleString('ru-RU',{maximumFractionDigits:2})} экв. проекта`:''}</p>`:''}<p>${familyDetails(c)}<br>${['home','resting'].includes(c.phase)&&(c.diningUntil||0)>state.simTime?'Ужинает с семьёй':c.age>=3&&c.age<16&&c.phase==='home'&&isWorkday(state.simTime)?'Играет у дома':phases[c.phase]||'Ожидает назначение'}${c.phase==='festival'?' · готовит праздник общины':''}${c.saleJob?' · продажа в караван':c.tradeJob?' · покупка с рынка':''}${c.siteDuty?` · ${roles[c.siteDuty]||'стройка'}`:''}<br>Дом: ${home?`${home.x}, ${home.y}`:'—'}<br>Работа: ${workLink}</p>${wellbeingReadout(c)}<small>Прошлый ужин: ${Math.round((c.lastMealQuality??1)*100)}% порции · отдано богу ${rounded(c.prayerTotal||0)} веры.</small><strong>Груз: ${resourceText(c.waterTrip?.load>0?{water:c.waterTrip.load}:c.craftMaterial&&c.craftAmount>0?{[c.craftMaterial]:c.craftAmount}:c.seedFood>0?{food:c.seedFood}:c.clothingLoad>0?{clothing:c.clothingLoad}:c.craftCloth>0?{cloth:c.craftCloth}:c.craftWool>0?{wool:c.craftWool}:c.pantryTrip?{food:c.pantryFood||0}:Object.keys(c.cargo||{}).length?c.cargo:c.buildCargo||{})}</strong>${c.pantryTrip&&Object.values(c.cargo||{}).some(n=>n>0)?'<small>Рабочий груз отложен дома и сохранён до возвращения к доставке.</small>':''}${roleControl(c)}${relicStartHTML(state,c)}<button id="person-life">Семья и родословная</button><p class="role-help">Строитель возводит стены, носильщик доставляет материалы и покупки с рынка. Производство — работа в мастерских и полях. Авто заполняет свободные задачи. При нехватке материалов строитель ждёт доставку; ночью жители идут домой.</p>`;
 $('tile-detail').querySelector('.detail-close').onclick=()=>{inspectedPerson=null;inspectedDeposit=null;$('tile-detail').hidden=true;};bindManagement($('tile-detail'));if($('person-life'))$('person-life').onclick=()=>showLifeAnalytics(c.id);
}
function confirmRemoval(b,demolition){
 const back=['construction','residents'].includes(modalKind)?modalKind:null,refund=demolition?demolitionRefund(b):cancellationRefund(b);
 openDialog('confirmation',`<span class="eyebrow">${demolition?'СНОС ЗДАНИЯ':'ОТМЕНА ЗАКАЗА'}</span><h2>${demolition?'Снести':'Отменить'}: ${entityName(b)}?</h2><p>Клетка ${b.x}, ${b.y}. ${demolition?'Готовое здание будет удалено. Возврат — половина вложенных материалов; вера и престиж не возвращаются.':b.construction.kind==='upgrade'?'Здание сохранит прежний уровень. Потраченный труд исчезнет.':'Клетка освободится. Потраченный труд исчезнет.'}</p><h3>${demolition?'Возврат за готовую часть':'Полный возврат цены'}</h3>${costs(refund,false)}${demolition&&b.construction?`<h3>Отдельно: отмена улучшения</h3>${costs(cancellationRefund(b),false)}`:''}<p>Материалы сразу вернутся в общие запасы, включая доставленные и находящиеся в пути. Это игровая условность; повторно они не начисляются.</p><div class="dialog-actions"><button class="primary" id="confirm-removal">${demolition?'Снести здание':'Отменить заказ'}</button><button class="secondary" id="keep-building">Оставить</button></div>`);
 $('keep-building').onclick=()=>{closeDialog();if(back)showManagement(back);};$('confirm-removal').onclick=()=>{const result=demolition?demolish(state,b.x,b.y):cancelConstruction(state,b.x,b.y);if(!result.ok){toast(result.reason);return;}closeDialog();mutate(result,demolition?'Здание снесено. Ресурсы возвращены.':'Заказ отменён. Ресурсы возвращены.');if(back)showManagement(back);else{const current=buildingAt(state,b.x,b.y);if(current)detail(current.type,false,current);else{inspected=null;$('tile-detail').hidden=true;}}};
}
const tradeQuantities=new Map();
const caravanPhases={waitingMarket:'Ждёт готового рынка',arriving:'Идёт к рынку',unloading:'Разгружает товары',trading:'Торговля открыта',departing:'Возвращается в путь',blocked:'Ожидает свободную дорогу'};
function salesOverview(port){const orders=(state.trade.sales||[]).filter(q=>q.unitPrice>0&&(!port||q.market===port)),active=orders.filter(q=>q.loaded+q.cancelled<q.amount),summary=salesSummary({trade:{sales:orders}});return `<h4 class="market-flow-title">Продажи · серебро после погрузки</h4><div class="market-flow sale-flow"><span>На складе в резерве <b>${rounded(summary.queued)}</b></span><span>Несут купцам <b>${rounded(summary.inTransit)}</b></span><span>Погружено <b>${rounded(summary.loaded)}</b></span></div><small class="sale-pending">Ожидается серебра: ${summary.pendingSilver}</small>${active.length?`<div class="market-orders">${active.slice(-8).map(q=>`<div>${resourceIcon(q.resource)}<span>${label(q.resource)} · ${q.loaded} / ${q.amount-q.cancelled} у купцов<small>${q.remaining} ждёт на складе · ${q.amount-q.remaining-q.loaded-q.cancelled} несут жители</small></span>${q.remaining?`<button data-cancel-sale="${q.id}">Отменить остаток</button>`:''}</div>`).join('')}</div>`:''}`;}
function bindSaleCancellations(root){for(const button of root.querySelectorAll('[data-cancel-sale]'))button.onclick=()=>{const result=cancelSale(state,Number(button.dataset.cancelSale));if(mutate(result,'Неотправленный товар возвращён в запас. Взятые грузы закончат доставку.')){if(modalKind==='trade')renderTrade();else updateDetail();}};}
function deliveryOverview(port){
 const orders=(state.trade.deliveries||[]).filter(q=>!port||q.market===port),active=orders.filter(o=>o.delivered<o.amount),summary=port?{queued:orders.reduce((n,q)=>n+q.remaining,0),inTransit:orders.reduce((n,q)=>n+q.amount-q.remaining-q.delivered,0),delivered:orders.reduce((n,q)=>n+q.delivered,0)}:logisticsSummary(state);
 return `<h4 class="market-flow-title">Покупки · доставка на склад</h4><div class="market-flow"><span>На торговом дворе <b>${rounded(summary.queued||0)}</b></span><span>В пути <b>${rounded(summary.inTransit||0)}</b></span><span>Доставлено <b>${rounded(summary.delivered||0)}</b></span></div>${active.length&&!state.citizens.some(c=>['auto','carrier'].includes(c.role||'auto'))?'<p class="market-carrier-note">Покупки ждут носильщиков. Вдохнови жителя на роль «Носильщик» или «Авто».</p>':''}${active.length?`<div class="market-orders">${active.slice(-8).map(o=>`<div>${resourceIcon(o.resource)}<span>${label(o.resource)} · ${rounded(o.delivered)} / ${o.amount} на складе<small>${rounded(o.remaining)} на торговом дворе · ${rounded(o.amount-o.remaining-o.delivered)} несут жители</small></span></div>`).join('')}</div>`:''}${salesOverview(port)}`;
}

function donkeyFodderHTML(){
 const offer=donkeyFodderOffer(state);
 if(!offer)return '';
 const {order,ration,wood,stone}=offer;
 const progress=order?`<p>Доставлено ${rounded(order.loaded)} / ${ration} · в резерве ${rounded(order.remaining)} · несут ${rounded(ration-order.loaded-order.cancelled-order.remaining)}${order.cancelled?` · возвращено ${rounded(order.cancelled)}`:''}.</p>`:'';
 return `<section class="management-row" data-donkey-fodder><h3>Корм для вьючных ослов</h3><p>Носильщики доставят ${ration} зерна из свободного запаса. После полной доставки купцы предложат ещё ${wood} дерева и ${stone} камня по обычной цене.</p>${progress}${order?order.remaining>0?`<button type="button" data-cancel-sale="${order.id}">Снять резерв корма</button>`:'' :`<button type="button" data-feed-donkeys ${offer.reason?'disabled':''}>Отправить корм</button>${offer.reason?`<small> ${esc(offer.reason)}</small>`:''}`}</section>`;
}

function tradeContractHTML(){
 const offer=tradeContractOffer(state),last=state.tradeContracts?.at(-1);
 if(!offer&&!last)return '';
 const deadline=tick=>`год ${1+Math.floor(tick/4)}, начало сезона «${SEASONS[tick%4]}»`;
 const status={active:'Действует',fulfilled:'Выполнен',breached:'Срок сорван'};
 const sale=last&&state.trade.sales.find(q=>q.id===last.saleId);
 const delivery=last&&state.trade.deliveries.find(q=>q.id===last.deliveryId);
 const previous=last&&sale?`<p><b>${status[last.status]}</b> · ${esc(last.partner)} · срок — ${deadline(last.deadline)}. Доверие ${tradePartnerTrust(state,last.partner)}.<br>
  Ткань у купцов ${sale.loaded} / ${sale.amount} · в резерве ${sale.remaining} · в пути ${sale.amount-sale.loaded-sale.cancelled-sale.remaining}.
  ${last.status==='breached'&&last.deliveryId===null?'Расчёт камнем после прибытия грузов в пути.':''}
  ${delivery?`На складе города ${rounded(delivery.delivered)} / ${delivery.amount} · ${label(delivery.resource)}.`:''}</p>`:'';
 const next=offer&&(!last||last.visit!==state.trade.visits)?`<p>${esc(offer.partner)} · доверие ${offer.trust} · 4 ткани за ${offer.wood} дерева до срока (${deadline(offer.deadline)}).
  При срыве купцы отдадут 2 камня за каждую принятую ткань, оставшуюся на складе ткань освободят.</p>
  <button data-accept-trade-contract ${offer.reason?'disabled':''}>Подписать договор</button>${offer.reason?`<small> ${esc(offer.reason)}</small>`:''}`:'';
 return `<section class="management-row"><h3>Договор с купцами</h3>${previous}${last?.seal?sealedContractHTML(last):tradeSealReady(state,last)?'<small>Обмен завершён. Писец при амбаре может поставить печать.</small>':''}${next}</section>`;
}

function externalGuestHTML(){
 const g=state.externalGuest,offer=externalMasterOffer(state);
 if(!g&&!offer)return '';
 if(g){
  const learner=state.citizens.find(c=>c.id===g.learner);
  const phase={arriving:'Идёт к дому ученика',staying:g.fed?'Передаёт навык при встрече':'Ждёт ученика дома и воду',
   returning:'Возвращается к торговому двору',departed:'Покинул город'}[g.phase];
  const outcome=g.outcome==='taught'?'Ученик получил практику строителя.':g.outcome==='interrupted'?'Занятие не состоялось.':'';
  return `<section class="management-row"><h3>Приглашённый мастер · ${esc(g.name)}</h3>
   <p>${esc(g.partner)} · ${phase}. ${outcome}<br>Ученик: ${learner?resident(learner):'больше не живёт в городе'} · дом ${g.home}.
   ${g.fed?'Паёк принят.':g.phase==='arriving'||g.phase==='staying'?'В резерве 3 еды, в доме нужно 2 воды.':''}</p></section>`;
 }
 return `<section class="management-row"><h3>Приглашённый мастер · ${esc(offer.name)}</h3>
  <p>Мастер прибыл с купцами. Встретится с местным строителем I уровня у него дома. Для визита нужны ${offer.food} еды и ${offer.water} воды.
  ${offer.learner!==undefined?`Ученик: ${resident(offer.learner)}.`:''}</p>
  <button data-invite-external-master ${offer.reason?'disabled':''}>Пригласить мастера</button>${offer.reason?`<small> ${esc(offer.reason)}</small>`:''}</section>`;
}

function visitorPanel(kind,title){
 const visit=state.externalVisits?.[kind],offer=visitorOffer(state,kind);
 if(!visit&&!offer)return '';
 if(visit){
  const status=visit.phase==='arriving'?'В пути':visit.phase==='returning'?'Возвращается к купцам':'Покинул город';
  const outcome=visit.outcome==='interrupted'?' Визит прерван, припасы возвращены.':
   visit.outcome==='accepted'?(kind==='pilgrim'?` Сосуд №${visit.offeringId} принят в храм.`:' Ответный дар — одна ткань.'):'';
  return `<section class="management-row"><h3>${title} · ${esc(visit.name)}</h3><p>${esc(visit.partner)} · ${status}.${outcome}</p></section>`;
 }
 const detail=kind==='pilgrim'?'Несёт свой сосуд в храм.':'Возьмёт одну ткань на складе и увезёт купцам.';
 return `<section class="management-row"><h3>${title} · ${esc(offer.name)}</h3><p>${detail} Паёк — ${offer.food} еды.</p>
  <button data-invite-visitor="${kind}" ${offer.reason?'disabled':''}>Принять ${kind==='pilgrim'?'паломника':'посланника'}</button>
  ${offer.reason?`<small>${esc(offer.reason)}</small>`:''}</section>`;
}

function showTrade(){
 openDialog('trade',`<button class="management-close" id="close-trade" aria-label="Вернуться в город">×</button><span class="eyebrow">РЕЧНЫЕ И КАРАВАННЫЕ ПУТИ</span><h2>Торговля</h2><div id="trade-content"></div>`);$('close-trade').onclick=closeDialog;renderTrade();
}
function renderTrade(){
 if(modalKind!=='trade'||!$('trade-content'))return;
 const t=state.trade,c=t.caravan,hasMarket=state.buildings.some(b=>['market','harbor'].includes(b.type)&&b.construction?.kind!=='new');
 $('trade-content').innerHTML=`<div class="trade-wallet"><span>Серебро города <b id="trade-silver">${t.silver}</b></span>${c?`<span>Кошелёк купцов <b>${c.silver}</b></span>`:''}</div><div class="market-status"><b>${esc(marketStatus(state)||'Торговля открыта · товары разгружены')}</b>${c?`<span>${c.transport==='river'?({arriving:'По реке к пристани',unloading:'Швартовка и разгрузка',trading:'Лодка у причала',departing:'Обратный рейс',blocked:'Ждёт снабжения',waitingMarket:'Ждёт пристани'})[c.phase]:caravanPhases[c.phase]||'Караван в пути'}</span>`:''}</div>${c?.transport==='river'?`<p data-river-capacity>Вместимость этого рейса · ×${c.riverCapacity??3} для дерева и камня.</p>`:''}${tradeContractHTML()}${donkeyFodderHTML()}${externalGuestHTML()}${visitorPanel('pilgrim','Паломник')}${visitorPanel('envoy','Посланник')}${deliveryOverview()}${!hasMarket?`<div class="market-needed"><p>Купцам нужен рынок или речная пристань с дорогой к складу и домам. Купленные товары жители отнесут с рынка на доступный склад.</p><button class="primary" id="place-market">Построить рынок</button></div>`:''}${!c?`<div class="trade-empty"><span>♧</span><h3>Купцы ещё в пути</h3><p>Следующий прибудет: год ${1+Math.floor(t.nextArrival/4)}, ${SEASONS[t.nextArrival%4].toLowerCase()}. При доступной пристани лодки чередуются с караванами. Без рынка купцы приходят только по реке. Пристани нужны склад, дом и дорога; при озере она не работает.</p></div>`:`<p class="trade-visit"><b>${esc(c.name)}</b> · отъезд: год ${1+Math.floor(c.departAt/4)}, ${SEASONS[c.departAt%4].toLowerCase()}<br>Цены — за единицу. Покупки ждут на торговом дворе: носильщики отнесут их на склад. Продажи резервируются; серебро поступает после доставки и погрузки. В окне торговли время на паузе.</p><div class="trade-list">${MATERIALS.map(k=>{const amount=tradeQuantities.get(k)||10;return `<article class="trade-row" data-trade-row="${k}"><div class="trade-resource">${resourceIcon(k)}<div><h3>${label(k)}</h3><small>У тебя: ${rounded(state.resources[k])} / ${storage(state)} · у купцов: ${c.stock[k]}</small></div></div><div class="trade-prices">Купить: ${c.prices[k].buy} · продать: ${c.prices[k].sell} серебра / ед.</div><div class="trade-actions"><label>Количество <input type="number" data-trade-quantity="${k}" aria-label="Количество: ${label(k)}" min="1" max="1000000" step="1" value="${amount}" inputmode="numeric"></label><button data-trade="buy" data-resource="${k}"></button><button data-trade="sell" data-resource="${k}"></button></div><small class="trade-reason" data-trade-reason="${k}"></small></article>`;}).join('')}</div><p class="trade-help">Запасы и серебро купцов ограничены. На обычной воде лодки привозят втрое больше дерева и камня. В маловодье объём зависит от глубины пристани. Вера и престиж не продаются. Покупка и обратная продажа обходятся в убыток.</p>`}`;
 bindSaleCancellations($('trade-content'));
 const feed=$('trade-content').querySelector('[data-feed-donkeys]');
 if(feed)feed.onclick=()=>{if(mutate(feedDonkeyCaravan(state),'Корм зарезервирован. Носильщики доставят его ослам.'))renderTrade();};
 const sign=$('trade-content').querySelector('[data-accept-trade-contract]');
 if(sign)sign.onclick=()=>{if(mutate(acceptTradeContract(state),'Договор подписан. Ткань зарезервирована.'))renderTrade();};
 const invite=$('trade-content').querySelector('[data-invite-external-master]');
 if(invite)invite.onclick=()=>{if(mutate(inviteExternalMaster(state),'Мастер приглашён. Паёк зарезервирован.'))renderTrade();};
 for(const button of $('trade-content').querySelectorAll('[data-invite-visitor]'))button.onclick=()=>{
  if(mutate(inviteVisitor(state,button.dataset.inviteVisitor),'Гость принят. Припасы зарезервированы.'))renderTrade();
 };
 if($('place-market'))$('place-market').onclick=()=>{closeDialog();choose('market');};
 if(!c)return;
 for(const input of $('trade-content').querySelectorAll('[data-trade-quantity]'))input.oninput=()=>{tradeQuantities.set(input.dataset.tradeQuantity,Number(input.value));updateTradeRow(input.dataset.tradeQuantity);};
 for(const button of $('trade-content').querySelectorAll('[data-trade]'))button.onclick=()=>{const k=button.dataset.resource,amount=Number($('trade-content').querySelector(`[data-trade-quantity="${k}"]`).value),result=trade(state,k,button.dataset.trade,amount);if(mutate(result,`${button.dataset.trade==='buy'?'Куплено — ожидает носильщиков на рынке':'Продажа принята — серебро после погрузки'}: ${amount} ${RESOURCE_NAMES[k]}`))renderTrade();};
 for(const k of MATERIALS)updateTradeRow(k);
}
function updateTradeRow(k){
 const row=$('trade-content').querySelector(`[data-trade-row="${k}"]`),amount=Number(row.querySelector('input').value),c=state.trade.caravan;
 for(const side of ['buy','sell']){const b=row.querySelector(`[data-trade="${side}"]`),reason=tradeReason(state,k,side,amount);b.disabled=!!reason;b.title=reason||`${side==='buy'?'Купить':'Продать'} ${amount} ${RESOURCE_NAMES[k]}`;b.textContent=`${side==='buy'?'Купить':'Продать'} · ${Number.isSafeInteger(amount)&&amount>0?amount*c.prices[k][side]:'—'} серебра`;}
 const buyReason=tradeReason(state,k,'buy',amount),sellReason=tradeReason(state,k,'sell',amount);row.querySelector('.trade-reason').textContent=[buyReason&&`Покупка: ${buyReason}`,sellReason&&`Продажа: ${sellReason}`].filter(Boolean).join(' · ');
}
function showFestival(){openDialog('festival',`<button class="management-close" id="close-festival" aria-label="Вернуться в город">×</button><span class="eyebrow">ОБЩИННЫЕ ПРАЗДНИКИ</span><h2 id="festival-title">Ночь огней</h2><img class="intro-art festival-art" src="${CITY_ART.evening}" alt="Иллюстрация общинного праздника"><div id="festival-content"></div>`);$('close-festival').onclick=closeDialog;renderFestival();}
function renderFestival(){
 if(modalKind!=='festival'||!$('festival-content'))return;
 const f=festivalSummary(state,{paused}),first=f.occasion==='firstBeer',cost=f.cost||{food:12,beer:6,prestige:15},venue=f.venueLabel||(first?'У пивоварни':'У храма');
 $('festival-title').textContent=f.title||(first?'Первая кружка пива':'Ночь огней');
 setHTML($('festival-content'),`<p>${esc(f.label)}</p><p class="festival-progress" role="status">${esc(f.progress.text)}</p><div class="festival-cost">${['prestige','food','beer'].filter(k=>cost[k]>0).map(k=>`<span>${resourceIcon(k)}${rounded(cost[k])} ${label(k)}</span>`).join('')}</div><p>${first?'Первую настоящую партию отмечают один раз. Один напиток становится угощением; жители сами придут к пивоварне.': 'Жители принесут угощение к храму. После ужина сытые взрослые соберутся во дворе; настроение +8, личная вера +4 у пришедших. Семена и еда на один полный ужин остаются в запасе.'}</p>${f.active?`<p>${esc(venue)}: ${['food','beer'].filter(k=>cost[k]>0).map(k=>`${rounded(f.delivered[k]||0)} / ${cost[k]} ${label(k)}`).join(' · ')}<br>Гостей: ${f.participants}</p>`:''}${f.warning?`<p class="warning-note">${esc(f.warning)}</p>`:''}<button class="primary" id="festival-order" ${f.active||f.reason?'disabled':''}>Подготовить Ночь огней</button>${f.active?`<button class="primary" id="festival-progress-toggle">${paused?'Продолжить подготовку / пир':'Приостановить участников'}</button><button class="secondary" id="festival-watch">Смотреть на карте</button><button class="secondary" id="festival-cancel">Закончить / отменить</button><button class="secondary" id="festival-skip-season">Закончить и перейти к следующему сезону</button>`:''}<small class="festival-reason">${esc(f.active?'Припасы доставляются автоматически и при открытом окне. Во время самого пира календарь стоит; люди продолжают праздник. До начала пира отмена возвращает неиспользованные припасы.':f.reason||'Материалы зарезервируются в местных складах; носильщики принесут их по дорогам.')}</small><small class="festival-reason">Песня звучит во время самого пира, когда включён звук. <button class="city-tools-link" data-open-song-encyclopedia>Тексты и значения песен</button></small>`);
 $('festival-order').onclick=()=>{const r=orderFestival(state);if(mutate(r,r.warning||'Жители готовят Ночь огней')){paused=false;save();renderFestival();}};if($('festival-progress-toggle'))$('festival-progress-toggle').onclick=()=>{paused=!paused;save();renderFestival();};if($('festival-watch'))$('festival-watch').onclick=()=>{const view=festivalView(state),p=view?.court||view;closeDialog();if(p)renderer.focusOn(p.x,p.y);};if($('festival-skip-season'))$('festival-skip-season').onclick=jumpSeason;if($('festival-cancel'))$('festival-cancel').onclick=()=>{if(mutate(cancelFestival(state),'Праздник завершён, неиспользованные припасы возвращены'))renderFestival();};$('festival-content').querySelector('[data-open-song-encyclopedia]').onclick=showEncyclopedia;
}
async function showEncyclopedia(){
 if(relicControlActive(state)){toast('Сначала заверши путь избранного');return;}
 openDialog('encyclopedia','<button class="management-close" id="close-encyclopedia" aria-label="Вернуться в город">×</button><div id="encyclopedia-root"><span class="eyebrow">ГЛИНЯНЫЕ ТАБЛИЧКИ</span><h2>Энциклопедия</h2><p role="status">Открываем песенные таблички…</p></div>');$('close-encyclopedia').onclick=closeDialog;
 const request=encyclopediaRequest,root=$('encyclopedia-root');
 try{const {renderSongEncyclopedia}=await import('./ui-encyclopedia.js');if(request!==encyclopediaRequest||modalKind!=='encyclopedia')return;const controller=await renderSongEncyclopedia(root,{dataUrl:new URL('./assets/encyclopedia/songs.json?v=ceremony-speed-lights-20261028-1',import.meta.url),onPreviewChange:value=>cityAudio.setPreviewing(value)});if(request!==encyclopediaRequest||modalKind!=='encyclopedia'){controller.destroy();return;}encyclopediaUI=controller;}
 catch{if(request!==encyclopediaRequest||modalKind!=='encyclopedia')return;root.innerHTML='<h2>Энциклопедия</h2><p>Не удалось загрузить песенные таблички.</p><button id="encyclopedia-retry">Попробовать снова</button>';$('encyclopedia-retry').onclick=showEncyclopedia;}
}
function showLifeAnalytics(selectedId){
 openDialog('life',`<button class="management-close" id="close-life" aria-label="Вернуться в город">×</button><div id="life-analytics-root"></div>`);$('close-life').onclick=closeDialog;refreshLifeAnalytics(selectedId);
}
function refreshLifeAnalytics(selectedId){
 const root=$('life-analytics-root');if(modalKind!=='life'||!root)return;
 renderLifeAnalytics(root,state,{supplyReport:supplyOverview(state),...(selectedId!==undefined?{selectedId}:{}),onFocus:key=>{const b=state.buildings.find(v=>buildingKey(v)===key);if(!b)return;closeDialog();renderer.focusOn(b.x,b.y);inspected={x:b.x,y:b.y};detail(b.type,false,b);}});
}
function showCityOverview(tab='districts'){
 openDialog('citytools',`<button class="management-close" id="close-citytools" aria-label="Вернуться в город">×</button><div id="city-tools-root"></div>`);$('close-citytools').onclick=closeDialog;refreshCityOverview(tab);
}
function refreshCityOverview(tab){
 const root=$('city-tools-root');if(modalKind!=='citytools'||!root||root.contains(document.activeElement)&&['SELECT','INPUT'].includes(document.activeElement.tagName))return;
 renderCityTools(root,state,{...(tab?{tab}:{}),audioStatus:cityAudio.status,onAutoHousing:enabled=>mutate(setAutonomousHousing(state,enabled),enabled?'Самостоятельная стройка разрешена':'Самостоятельная стройка выключена'),mapUpgrade:testMapUpgrade,onTestAction:handleTestAction,onHarvest:()=>mutate(callHarvestWorkers(state),'Объявлен призыв на жатву'),onUnload:()=>mutate(callUnloadWorkers(state),'Объявлен призыв на разгрузку'),onRepair:()=>mutate(callRepairWorkers(state),'Объявлен призыв на расчистку каналов'),onRole:(id,role)=>mutate(setCitizenRole(state,id,role),'Работа жителя изменена; взятый груз будет доставлен'),onInspire:(id,profession)=>{const result=inspireCitizen(state,id,profession);mutate(result,result.success?'Житель обрёл новое призвание':'Вдохновение пока не пришло · потрачена 1 вера');},onAssign:(id,key)=>mutate(assignWorkplace(state,id,key),'Житель закреплён за зданием'),onRelease:id=>mutate(assignWorkplace(state,id,''),'Житель вернулся к автоматическому распределению'),onFocus:key=>{const road=state.roads.find(r=>r.id===key);if(road){closeDialog();renderer.focusOn(road.x,road.y);roadDetail(road);return;}const [x,y]=key.split(',').map(Number),b=buildingAt(state,x,y);if(!b)return;closeDialog();renderer.focusOn(x,y);inspected={x,y};detail(b.type,false,b);},onCitizen:id=>{const c=state.citizens.find(c=>c.id===id);if(!c)return;closeDialog();renderer.focusOn(c.x,c.y);personDetail(c);}});
}
function handleTestAction(action,data){
 if(action==='cat-scene'||action==='earth-scene'){
  const kind=action==='cat-scene'?'cat':'fertility',result=triggerTestMiracleScene(state,kind);if(!result.ok){toast(result.reason);return;}
  closeDialog();paused=false;syncCeremonySpeed();const p=state.miracleCelebration.center;renderer.focusOn(p.x,p.y);renderer.addEffect(kind,p);save();update();return;
 }
 if(action==='map-upgrade'){const reason=testToolsReason(state);if(reason){toast(reason);return;}testMapUpgrade=!testMapUpgrade;selection=null;clearRoadRoute();roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');document.body.classList.remove('is-building');$('map-hint').textContent=testMapUpgrade?'Тест: выбери здание для мгновенного улучшения · Esc — выйти':'Выбери здание или жителя';document.body.classList.toggle('test-map-upgrade',testMapUpgrade);if(testMapUpgrade){closeDialog();toast('Тест: кликай здания для мгновенного улучшения. Esc — закончить.');}return;}
 const result=action==='resources'?grantTestResources(state,data.resource||'all'):action==='event'?triggerTestEvent(state,data.event):action==='upgrade'?instantTestUpgrade(state,data.building):action==='kill'?killTestCitizens(state,data.citizen===''?[]:[Number(data.citizen)]):action==='kill-many'?killTestCitizens(state,Number(data.count)):{ok:false,reason:'Нет такого действия'};
 if(!mutate(result,action==='resources'?'Тест: ресурсы добавлены':action==='upgrade'?'Тест: здание улучшено':action==='event'?'Тестовое событие вызвано':'Начались настоящие похороны'))return;
 if(action==='event'){closeDialog();checkDialogs();}else if(action==='kill'||action==='kill-many'){closeDialog();paused=false;const p=state.funeral?.gather;if(p)renderer.focusOn(p.x,p.y);save();update();}
}
function showManagement(kind){openDialog(kind,`<button class="management-close" id="close-management" aria-label="Вернуться в город">×</button><span class="eyebrow">УПРАВЛЕНИЕ ГОРОДОМ</span><h2>${kind==='construction'?'Стройки':'Жители'}</h2><p>${kind==='construction'?'Высокий приоритет обслуживается первым. Уже взятые грузы заканчивают прежнюю доставку.':'Выбери профессию и вдохнови жителя за 1 веру. Обычные профессии: 40% для взрослых и 70% для детей. Лекарь: 20% и 40%, затем обучение в храме; призвание даёт +20% к выбранной работе. Дети трудятся с 16 лет; вера тратится при любом исходе. С грузом он сначала закончит доставку.'}</p><div id="management-list"></div>`);$('close-management').onclick=closeDialog;renderManagement();}
function renderManagement(){
 if(!['construction','residents'].includes(modalKind)||!$('management-list')||$('management-list').contains(document.activeElement))return;
 $('management-list').innerHTML=modalKind==='construction'?(orderedSites(state).map(b=>`<article class="management-row"><h3>${entityName(b)} <small>${b.x}, ${b.y} · ${b.construction.kind==='boat'?'перегрузочная лодка':b.construction.kind==='repair'?'ремонт':b.construction.kind==='upgrade'?`улучшение до ${b.construction.target}`:'новая постройка'}</small></h3>${siteStatus(b)}${priorityControl(b)}<div class="row-actions"><button data-inspect="${b.x},${b.y}">На карте</button><button class="danger" data-cancel="${b.x},${b.y}">Отменить заказ</button></div></article>`).join('')||'<p class="empty-state">Все работы завершены. Новые заказы появятся здесь.</p>'):`<p class="role-help">Дети: ${state.citizens.filter(c=>c.age<16).length} · взрослые: ${state.citizens.filter(c=>c.age>=16&&c.age<55).length} · пожилые: ${state.citizens.filter(c=>c.age>=55).length}<br>1 год города = 2 года возраста · труд с 16 лет · семье нужны свободные кровати; для рождения город должен иметь еду на 2 сезона.</p>`+state.citizens.map(c=>`<article class="management-row resident-row"><div><h3>${resident(c)}</h3><p>${familyDetails(c)}<br>Голод ${Math.round(c.hunger||0)}% · здоровье ${Math.round(c.health??100)}%<br>Настроение ${Math.round(c.mood??75)}% · вера ${Math.round(c.faith??60)}% · труд ${Math.round(workRate(c,c.siteDuty||state.buildings.find(b=>buildingKey(b)===c.work)?.type||c.role)*100)}%<br><span class="${c.clothing<=25?'clothing-poor':''}">Одежда ${Math.ceil(c.clothing??100)}% · ${clothingStatus(c)}</span><br>Дом: ${esc(c.home||'—')} · ${['home','resting'].includes(c.phase)&&(c.diningUntil||0)>state.simTime?'Ужинает с семьёй':c.age>=3&&c.age<16&&c.phase==='home'&&isWorkday(state.simTime)?'Играет у дома':phases[c.phase]||'Ожидает назначение'}${c.phase==='festival'?' · готовит праздник общины':''}${c.saleJob?' · продажа в караван':c.tradeJob?' · покупка с рынка':''}${c.siteDuty?` · ${roles[c.siteDuty]}`:''}</p></div>${roleControl(c)}</article>`).join('');bindManagement($('management-list'));
}
function updatePlacementControls(){const active=!!selection;$('placement-tools').hidden=!active;$('rotate-building').disabled=!active||renderer.mode!=='3d'||!canRotateBuilding(selection);$('rotate-building').title=renderer.mode==='3d'?'Повернуть здание · R / Shift+R':'Поворот здания доступен в 3D';$('placement-angle').textContent=`${placementRotation*90}°`;renderer.placementRotation=placementRotation;}
function rotatePlacement(direction=1){if(!selection||renderer.mode!=='3d')return;placementRotation=nextRotation(selection,placementRotation,direction);updatePlacementControls();}
function choose(type){
 waterProjectDraft=null;
 inspectedDeposit=null;
 if(relicControlActive(state)){toast('Сначала верни реликвию в храм');return;}
 testMapUpgrade=false;document.body.classList.remove('test-map-upgrade');
 const knowledge=buildingKnowledgeReason(state,type);if(knowledge){toast(knowledge);return;}
 if(selection!==type)placementRotation=0;
 showBuildGroup(groupFor(type).id);
 inspected=null;clearRoadRoute();roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');selection=selection===type?null:type;document.body.classList.toggle('is-building',!!selection);
 for(const card of document.querySelectorAll('.building-card')){card.classList.toggle('selected',card.dataset.type===selection);card.setAttribute('aria-pressed',String(card.dataset.type===selection));}
 $('map-hint').textContent=selection?`${buildingDefinition(state,selection).name} · ${selection==='bridge'?'выбери воду':selection==='field'?'земля у реки или рядом с наполненным каналом':selection==='canal'?'соединяй соседние клетки от реки':'выбери свободную клетку'} · Escape — отмена`:'Перетаскивание — карта · колесо — масштаб · клик — выбор';
 $('tile-detail').hidden=true;updatePlacementControls();
}
function buildBenefit(type){
 const b=BUILDINGS[type];if(type==='musicHouse')return '1 вдохновлённый музыкант · тихая музыка · престиж';if(type==='ishtarGate')return 'Площадка 3 × 3 · открывает синий дар: Покров Инанны';if(type==='pottery')return 'Глина + вода + топливо → керамика · сушка и обжиг';if(type==='brewery')return 'Еда + вода + сосуд → пиво · семена защищены';if(type==='harbor')return 'Главная река · лодки с лесом и камнем · 2 носильщика';if(type==='kiln')return '4 сырца + 3 тростника → 4 обожжённых · нужны работники';if(type==='brickyard')return 'Глина + тростник + вода → 4 сырца · солнечная сушка';if(type==='waterpoint')return 'Водоносам нужен берег · вода кварталу';if(type==='tailor')return '2 ткани → 1 одежда · нужен мастер';if(type==='sheepfold')return '4 овцы · сбор → 2 шерсти / рейс';if(type==='weaver')return '3 шерсти → 1 ткань · товар караванам';if(type==='field')return state.cropCalendar===AUTUMN_CROPS?'Осень: посев · зима: полив · весна: жатва':'Весна: посев · лето: полив · осень: жатва';if(type==='canal')return 'Вода соседним полям · путь от реки';if(type==='levee')return 'Береговой вал · защита от весеннего разлива';if(type==='healer')return 'Лечение · нужен обученный лекарь · 2 места';if(type==='market')return 'Приём караванов · 2 носильщика';if(type==='house')return '+8 мест для жителей';if(type==='ziggurat')return 'Площадка 2 × 2 · великий храм · вера и престиж';if(type==='depot')return 'Местная еда · 2 носильщика · 60 / материал';if(type==='granary')return '+150 / материал · местный склад';if(type==='bridge')return 'Путь и доставка на другой берег';
 if(type==='garden'&&isStrictSumer(state))return 'Первый урожай через год · полный через три';
 return `${resourceText(b.output)} / рейс${type==='garden'?' · +4 счастья':''}`;
}
const buildSections=new Map();
$('buildings').setAttribute('aria-label','Группы построек');
for(const g of BUILDING_GROUPS){const section=document.createElement('details');section.className='building-accordion';section.dataset.buildGroup=g.id;section.open=g.id==='life';section.innerHTML=`<summary><span>${g.name}</span><small>${g.types.length}</small></summary><div class="accordion-buildings"></div>`;buildSections.set(g.id,section);$('buildings').append(section);}
function showBuildGroup(id){const section=buildSections.get(id);if(section)section.open=true;urukUI?.selectBuildGroup(id);}
for(const [i,[type]]of Object.entries(Object.entries(BUILDINGS))){
 const b=buildingDefinition(state,type);
 const el=document.createElement('button');el.className='building-card';el.dataset.type=type;el.title=`Поставить: ${b.name}`;el.setAttribute('aria-pressed','false');
 el.innerHTML=`<span class="building-icon">${uiIcon(type)}</span><span class="build-copy"><strong>${b.name}</strong><span class="build-effect">${buildBenefit(type)}</span><span class="catalog-cost" data-cost="${type}">${costs(b)}</span></span><span class="build-hotkey">${Number(i)<9?Number(i)+1:''}</span>`;
 const choice=document.createElement('div');choice.className='building-choice';const info=document.createElement('button');info.className='building-info';info.type='button';info.textContent='?';info.setAttribute('aria-label',`О здании: ${b.name}`);info.setAttribute('aria-controls','tile-detail');info.title=`Описание: ${b.name}`;info.onclick=()=>{showBuildGroup(groupFor(type).id);detail(type,true);};el.onclick=()=>choose(type);choice.append(el,info);buildSections.get(groupFor(type).id).querySelector('.accordion-buildings').append(choice);
}
function makeMiracleCard(id,m){
 const details=document.createElement('details');details.className='miracle-disclosure'+(m.unlockBuilding||m.unlockQuest?' is-sacred':'');details.dataset.miracle=id;
 details.innerHTML=`<summary class="miracle-card" aria-label="${m.name} · описание и применение"><span class="miracle-symbol">${uiIcon(id)}</span><span><strong>${m.name}</strong><small class="miracle-summary-status"></small></span></summary><section class="miracle-explanation" aria-label="${m.name}"><button class="miracle-close" aria-label="Закрыть описание способности">×</button><h3>${m.name}</h3><p>${m.desc}</p><div class="miracle-facts"><span>${m.cost} веры</span><span>${DOMAIN_NAMES[m.domain]}</span><span>Отдых: ${m.cooldown} сез.</span></div><p class="miracle-unavailable" hidden></p><button class="miracle-cast" id="miracle-${id}">Применить · ${m.cost} веры</button></section>`;
 details.addEventListener('toggle',()=>{if(details.open)for(const other of $('miracles').querySelectorAll('details'))if(other!==details)other.open=false;});
 details.addEventListener('keydown',e=>{if(e.key==='Escape'){e.stopPropagation();details.open=false;details.querySelector('summary').focus();}});
 details.querySelector('.miracle-close').onclick=()=>{details.open=false;};
 const el=details.querySelector('.miracle-cast');
 el.onclick=()=>{const result=miracle(state,id,lastMiracleTarget);if(result.ok){details.open=false;renderer.addEffect(id,state.miracleCelebration?.center||lastMiracleTarget);toast(`${m.name} · ${state.name}`);save();update();checkDialogs();}else toast(result.reason);};$('miracles').append(details);return el;
}
for(const [id,m]of Object.entries(MIRACLES))if(shouldShowMiracle(state,id))makeMiracleCard(id,m);
function update(){
 urukUI?.refresh(state);
 godhoodUI.refresh();modeBadge.textContent=gameModeLabel(state);
 const soundEnabled=!!cityAudio.enabled;$('toggle-sound').textContent=soundEnabled?'Звук включён':'Звук выключен';$('toggle-sound').setAttribute('aria-pressed',String(soundEnabled));
 for(const card of document.querySelectorAll('.building-card')){const reason=buildingKnowledgeReason(state,card.dataset.type);card.disabled=!!reason;card.classList.toggle('knowledge-locked',!!reason);card.title=reason||`Поставить: ${buildingDefinition(state,card.dataset.type).name}`;updateBuildingCardName(card,state);}
 for(const id of ['lay-roads','open-roads']){const reason=buildingKnowledgeReason(state,'road');$(id).disabled=!!reason;$(id).title=reason||'Проложить или улучшить путь';}
 $('test-resources').disabled=false;$('test-resources').title='Открыть вкладку тестирования: события, ресурсы, улучшения и похороны';
 document.body.classList.toggle('relic-control-active',relicControlActive(state));for(const el of document.querySelectorAll('.build-panel,#miracles,.time-controls [data-speed],#next-season,#day-cycle,#open-photo'))el.inert=relicControlActive(state);relicUI.refresh();
 renderFoodWarnings();
 const r=state.resources,stats=workforceStats(state),marketPorters=state.citizens.filter(c=>c.tradeJob||c.saleJob).length,quarterPorters=state.citizens.filter(c=>c.districtJob).length,res=Object.fromEntries(Object.entries(RESOURCE_NAMES).map(([k,n])=>[k,['',n.toUpperCase()]]));
 const balance=seasonBalance(state);
 setHTML($('resources'),RESOURCE_GROUPS.map(group=>`<section class="resource-frame resource-frame-${group.id}" aria-label="${group.name}"><span class="resource-group-label">${group.name} <small>≈ за сезон</small></span><div class="resource-group-items">${group.keys.map(k=>{const name=RESOURCE_NAMES[k].toUpperCase(),v=balance[k],delta=Math.abs(v.net)<.05?'0':`${v.net>0?'+':'−'}${Math.abs(v.net).toFixed(1).replace('.0','')}`,tip=`${name}: ${rounded(r[k])}. Прогноз на текущий сезон: поступления ≈${v.income.toFixed(1)}, расход ≈${v.outgo.toFixed(1)}, баланс ${delta}. Учитывает работников, путь до склада, местное сырьё, питание, посев и износ одежды. Торговля, стройки и чудеса не включены; фактические рейсы могут отличаться.`;return `<div class="resource" data-resource="${k}" title="${tip}"><span class="resource-icon">${resourceIcon(k)}</span><div><span class="resource-value"><strong class="${MATERIALS.includes(k)&&r[k]>storage(state)?'overflow':''}">${Math.floor(r[k])}</strong><em class="season-delta ${v.net>.05?'surplus':v.net<-.05?'deficit':'balanced'}" aria-label="Прогноз ${label(k)}: ${delta} за сезон">${delta}</em></span><small>${k==='brick'?'СЫРЕЦ':k==='firedBrick'?'ОБОЖЖЁННЫЙ':name}${k==='food'?` · семена ${foodAmount(seedReserve(state))}`:''}</small></div></div>`;}).join('')}</div></section>`).join(''));
 $('population').title=`Дети: ${state.citizens.filter(c=>c.age<16).length} · взрослые: ${state.citizens.filter(c=>c.age>=16&&c.age<55).length} · пожилые: ${state.citizens.filter(c=>c.age>=55).length}`;$('population').textContent=`${state.population} / ${state.capacity}`;$('happiness').textContent=`☀ ${Math.round(state.happiness)}%`;$('happiness').style.color=state.happiness<40?'#aa654a':'';
 const efficiency=workers(state);const funeralLabels={gathering:'Жители собираются',procession:'Процессия с факелами',collecting:'Возвращаются за умершими',farewell:'Прощание с умершими',receding:'Процессия отходит',jackals:'Шакалы уносят погребальные свёртки',returning:'Жители возвращаются домой'};$('mourning-notice').hidden=!state.funeral;if(state.funeral)$('mourning-notice').textContent=`${funeralLabels[state.funeral.stage]} · погибло ${state.funeral.deceased.length}. Календарь и хозяйство стоят до окончания церемонии.`;const ground=!state.buildings.some(b=>b.type==='granary'&&(!b.construction||b.construction.kind==='upgrade'));$('ground-storage-note').hidden=!ground;$('ground-storage-note').textContent=state.buildings.some(b=>b.starterHut)?'Запасы и припасы хранятся внутри домов':'Без амбара · запасы на земле у разгрузки';$('workers').textContent=`${stats.employed+stats.builders+(stats.carriers??0)+(stats.manualGatherers??0)+marketPorters+quarterPorters} / ${state.population}`;$('labor-meter').style.width=`${efficiency*100}%`;
 $('labor-note').textContent=state.funeral&&state.funeral.scope!=='family'?'Траурная процессия. Назначения и все грузы сохранены; работа продолжится после возвращения.':stats.disconnected?`Нет пути к ${stats.disconnected} рабочим зданиям. Нужен мост или склад на этом берегу.`:`Строители: ${stats.builders} · носильщики: ${stats.carriers??0} · площадки: ${stats.sites} · рынок: ${marketPorters} · склады: ${quarterPorters}. Собирают: ${stats.working} · несут груз: ${stats.carrying}. Ресурсы поступают только после доставки.`;
 $('date').title='1 год города = 2 года возраста. Дети работают с 16 лет.';const calendar=calendarAt(state);$('date').textContent=`Год ${state.year} · ${SEASONS[state.season]} · ${calendar.monthName}`;$('season-icon').textContent=['❀','☀','❧','❄'][state.season];
 setHTML($('season-track'),monthTrackHTML(state));if(!seasonJumping)monthNotice.update(state);
 $('god-name').textContent=state.name;$('god-rating').textContent=`Слава ${state.divinity.rating} · вдохновлено ${state.divinity.inspirationSuccesses} · вера людей ${Math.round(beliefMultiplier(state)*60)}%`;setHTML($('god-description'),MOURNING_NAMES.includes(state.name)?'Город помнит тех, кого потерял.<br>Люди называют бога по судьбе своих близких.':Object.values(state.divinity.domains).some(v=>v>0)?'Твоё имя рождается из деяний.<br>Деяния остаются в памяти людей.':'Люди строят город.<br>Ты выбираешь, каким богом стать.');
 $('god-level').textContent=count(state,'ziggurat')?'III · БОГ ВЕЛИКОГО ГОРОДА':state.population>=24?'II · ПОКРОВИТЕЛЬ ГОРОДА':'I · ДУХ ПОСЕЛЕНИЯ';$('pantheon').textContent=`Заслуженные имена · ${state.divinity.names.length}`;
 const weather=weatherAt(state);$('weather').textContent=state.drought?`☀ Засуха · ${state.drought} сез.`:state.rain?`☂ Благодатный дождь · ${state.rain} сез.`:({sunny:'☀ Ясно',cloudy:'☁ Облачно',rain:'☂ Дождь',wind:'≋ Ветер'}[weather.type]);$('weather').classList.toggle('drought',!!state.drought);

 const signature=`${state.news.length}|${state.news[0]?.title}|${state.tick}`;
 if(signature!==newsSignature){newsSignature=signature;const linkedText=residentTextRenderer(state);$('news').innerHTML=state.news.map(n=>`<article class="news-item ${['good','bad','miracle','year','build','info'].includes(n.kind)?n.kind:'info'}"><small>ГОД ${n.year} · ${SEASONS[n.season].toUpperCase()}</small><h3>${linkedText(n.title)}</h3><p>${linkedText(n.text.replace('Приведи кошку или назначь сторожа.','Назначь сторожа: жители пока защищают запасы своими силами.'))}</p></article>`).join('');}
 const g=goals(state);setHTML($('goals'),g.map(v=>`<div class="goal ${v.done?'done':''}"><span>${v.done?'✓':'○'}</span>${v.label}</div>`).join(''));$('goal-number').textContent=`${g.filter(v=>v.done).length} / 5`;
 for(const [id,m]of Object.entries(MIRACLES)){
  if(!shouldShowMiracle(state,id)){const old=$(`miracle-${id}`);if(old)old.closest('details').hidden=true;continue;}const el=$(`miracle-${id}`)||makeMiracleCard(id,m),price=miraclePrice(state,id);const reason=relicControlActive(state)?'Ты ведёшь избранного':miracleKnowledgeReason(state,id)||miracleLockReason(state,id)||((state.miracleCelebration||['cat','fertility'].includes(id))?miracleCelebrationReason(state):'')|| (state.funeral?'Город провожает умерших':state.lost?'Поселение покинуто':state.event?'Реши событие':state.cooldowns[id]?`Через ${state.cooldowns[id]} сез.`:r.faith<price?`Нужно ${price} веры`:id==='cat'&&catReason(state)?catReason(state):id==='abundance'&&r.food>=storage(state)?'Амбары полны':'');
  updateMiracleCard(el.closest('details'),state,id,reason);
 }
 $('season-countdown').textContent=`Месяц ${calendar.number} / 12 · день ${calendar.day}${ceremonyActive(state)?' · время церемонии':paused?' · пауза':''}`;
 $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить время':'Приостановить время');$('pause').classList.toggle('active',paused);$('next-season').disabled=seasonJumping||!!seasonJumpReason(state);$('next-season').title=seasonJumpReason(state)||(state.festival||state.miracleCelebration?'Закончить праздник и перейти к следующему сезону':'Перейти к следующему сезону');
 const clock=lightingAt(state.simTime);
 $('day-cycle').textContent=`${clock.night>.5?'☾':'☀'} ${clock.label} · ${clockText(state.simTime)}\n${calendar.monthName} · день ${calendar.day}`;
 $('day-cycle').setAttribute('aria-label',`${clock.label} ${clockText(state.simTime)}. ${calendar.monthName}, день ${calendar.day}. Дождаться ${isWorkday(state.simTime)?'ужина':'утра'}. Время и хозяйство действительно продвинутся.`);$('day-cycle').disabled=state.lost&&!state.funeral||!!state.event||ceremonyActive(state);
 $('street-life').textContent=state.funeral?'Все жители провожают умерших · работы и доставки приостановлены':`Строят ${stats.builders} · доставляют на стройки ${stats.carriers??0} · с рынка ${marketPorters} · между складами ${quarterPorters} · на работе ${stats.working} · с грузом ${stats.carrying} · дома ${stats.atHome}`;
 setHTML($('delivery-log'),state.lastDelivery?`${resident(state.lastDelivery.citizen)} ${state.lastDelivery.source==='market'?'доставил покупку':'доставил'}: ${esc(resourceText(state.lastDelivery.cargo))}`:'Ресурсы поступают, когда груз доходит до склада');
 $('city').parentElement.classList.toggle('is-night',clock.night>.45);updateDetail();renderManagement();renderSupply();refreshCityOverview();refreshLifeAnalytics();renderFestival();for(const el of document.querySelectorAll('[data-cost]'))setHTML(el,costs(BUILDINGS[el.dataset.cost]));$('open-construction').textContent=`Стройки · ${orderedSites(state).length}`;$('open-trade').textContent=state.trade.caravan?`● Торговля · ${state.trade.silver}`:`Торговля · ${state.trade.silver}`;$('open-trade').classList.toggle('caravan-here',state.trade.caravan?.phase==='trading');$('open-trade').title=marketStatus(state);
}
function openDialog(kind,html){if(switchingCity)citySwitchRevision++;savesUI?.destroy();savesUI=null;encyclopediaUI?.destroy();encyclopediaUI=null;encyclopediaRequest++;modalKind=kind;dialog.dataset.kind=kind;$('dialog-content').innerHTML=`<div class="dialog-inner">${html}</div>`;if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('dialog-content').scrollTop=0;last=performance.now();}
function closeDialog(){if(switchingCity)citySwitchRevision++;savesUI?.destroy();savesUI=null;encyclopediaUI?.destroy();encyclopediaUI=null;encyclopediaRequest++;dialog.close();modalKind=null;delete dialog.dataset.kind;delete dialog.dataset.replace;last=performance.now();}
function intro(){
 openDialog('help',`<img class="intro-art" src="${CITY_ART.day}" alt="Художественный образ шумерского города"><span class="eyebrow">НОВЫЙ ВАВИЛОН · ЖИВОЙ ГОРОД</span><span class="dialog-emblem">✺</span><h2>У каждого города есть жизнь.</h2><p class="mode-intro">${gameMode(state)==='awakening'?'Пробуждение: подай первый знак у источника или выбери доставку воды соседям. Дождись поступка жителя. Первой веры хватит, чтобы вдохновить его строителем. Два завершённых проекта откроют мастерство II уровня, пять — III.':gameMode(state)==='mature'?'Взрослый бог: все здания и обычные способности открыты. Синие дары требуют завершённого монумента или доставленной реликвии. Для чудес нужна вера, для строительства — материалы и работа людей.':'Прежняя история: правила и запасы этого города сохранены.'}</p><p>Теперь жители действительно работают: выходят из дома, собирают материалы и несут их на склад. Дом лекаря принимает заболевших за еду и тростник. Лекарей нужно отдельно вдохновить и обучить в храме; каждый год с практикой они повышают мастерство, до 5 уровня. Призвание ускоряет свою работу на 20%; дети легче вдохновляются, но трудятся только с 16 лет. Ночью они возвращаются домой и с 20:00 ужинают из домашнего запаса. Голод, здоровье, настроение и вера индивидуальны: самочувствие меняет темп труда, вера жителей усиливает храмовые подношения и даёт ежедневные молитвы. Семьи растят детей: они начинают работать с 16 лет, стареют и оставляют следующее поколение. Один год города равен двум годам возраста. Семье нужны свободные кровати; для рождения в городе нужен достаточный запас еды. При смерти от старости близкие проводят небольшой обряд; календарь и хозяйство ждут завершения церемонии. При длительном голоде жители умирают: город прерывает работу и провожает умерших к границе долины.</p><p>Вода хранится в домах: семьи приносят её с берега. Построй береговой водозабор и вдохнови водоносов, чтобы они снабжали квартал. Кирпичный двор получает 4 глины, 1 тростник и 2 воды, формует 4 сырца и сушит на воздухе. Сырец нужен для крупных улучшений и зиккурата; Печь превращает 4 сырца и 3 тростника-топлива в 4 обожжённых кирпича: обжиг 20 с, остывание 8 с. Обожжённый кирпич нужен для III уровня крупных зданий и зиккурата.</p><p>Гончары доставляют глину, воду и топливо, формуют сосуды, сушат и обжигают их. Пивоварне нужны еда, вода и керамическая тара. За престиж можно подготовить общинный праздник: жители сами принесут угощение и соберутся вечером. Обзор города помогает найти проблемы кварталов; фоторежим сохраняет кадр без хода времени.</p><p>Шерстяные ткани производили в Шумере в III тысячелетии до н. э. В игре прядение объединено с ткачеством: овчарня → шерсть → мастерская → ткань для торговли.</p><div class="instructions"><b>01.</b> Заложи двор или поле: строители принесут материалы и возведут здание.<br><b>02.</b> Ячмень: весной нужны работники для посева, летом — канал с водой, осенью — сбор до зимней порчи. В карточке здания закрепи до двух работников; в карточке жителя можно вернуть «Авто». Вне полевых работ закреплённые земледельцы остаются на своих местах. Рыбалка, сады и охота дают еду круглый год.<br><b>03.</b> Храм — первый универсальный склад. Амбары хранят все материалы.<br><b>04.</b> Улучшения до III уровня тоже требуют доставки и работы. Ночью строители отдыхают.<br><b>05.</b> Поставь мост на воду и осваивай другой берег.<br><b>06.</b> Развивай дороги; вдохновляй жителей. Добывай глину и тростник на отмеченных местах, дерево в лесах, камень в карьерах. Рыбалка и охота дают общую еду. Построй рынок: караваны придут к нему по дорогам и разгрузят товары. Купленные материалы жители отнесут на склад.</div><p>Цель — зиккурат, 30 жителей и десятый год. Год — 12 месяцев и 4 сезона. Месяц длится три полных игровых дня. На 1× сутки занимают около 8 минут, месяц — около 24 минут; темп можно ускорить. Кнопка «Следующий сезон» перематывает календарь за одни прожитые сутки и сохраняет час. У ячменя конечный годовой урожай; другие производственные числа указаны за рейс работника.</p><div class="dialog-actions"><button class="primary" id="start-game">${loaded||state.tick?'Вернуться в город':'Да будет город'}</button></div><p class="keyboard-note">1–9 — постройки · пробел — пауза · Escape — отмена<br>Перетаскивание — карта · колесо — масштаб · ◫ — вся долина</p>`);
 const introTitle=$('dialog-content').querySelector('h2');introTitle.tabIndex=-1;introTitle.focus({preventScroll:true});dialog.scrollTop=0;
 $('start-game').onclick=()=>{closeDialog();paused=false;save();update();checkDialogs();};
}
function checkDialogs(){
 if(relicControlActive(state))return;
 if(dialog.open||state.funeral&&!state.event)return;
 if(state.lost||state.won&&!state.continued){
  openDialog('end',`<span class="eyebrow">${state.lost?'ИСТОРИЯ ОСТАЛАСЬ В ГЛИНЕ':'ТВОЯ ПЕРВАЯ ЛЕГЕНДА'}</span><span class="dialog-emblem">${state.lost?'☾':'▲'}</span><h2>${state.lost?'В долине погасли огни.':'Город коснулся неба.'}</h2><p>${state.lost?'Люди покинули город. У новой истории может быть другое начало.':`Долина знает тебя как «${esc(state.name)}». Через руки твоих жителей прошло ${state.deliveries} доставок.`}</p><div class="dialog-stats"><div><strong>${state.year}</strong><small>ГОД ИСТОРИИ</small></div><div><strong>${state.population}</strong><small>ЖИТЕЛЕЙ</small></div><div><strong>${state.miracleCount}</strong><small>ЧУДЕС</small></div></div><div class="dialog-actions">${state.lost?'':'<button class="primary" id="continue-game">Продолжить историю</button>'}<button class="secondary" id="end-new">Новая долина</button></div>`);
  if($('continue-game'))$('continue-game').onclick=()=>{state.continued=true;closeDialog();save();update();checkDialogs();};$('end-new').onclick=askReset;return;
 }
 if(state.event){
  const ev=state.event,definition=cityEventDefinition(ev.id),reason=eventReason(state),festival=ev.id==='festival';
  const description=festival?'Жители доставят угощение к храму и соберутся после вечернего ужина.':ev.text;
  const eventCost=festival?`<div class="event-costs" role="group" aria-label="Цена праздника">${[['prestige','престижа'],['food','еды'],['beer','пива']].map(([kind,name])=>`<span>${resourceIcon(kind)}<span><b>${FESTIVAL_COST[kind]}</b> ${name}</span></span>`).join('')}</div>`:'';
  openDialog('event',`${ev.id==='festival'?`<img class="intro-art festival-art" src="${CITY_ART.evening}" alt="Иллюстрация праздника общины">`:''}<span class="eyebrow">ГОД ${state.year} · РЕШЕНИЕ ПОКРОВИТЕЛЯ</span><span class="dialog-emblem">${ev.id==='caravan'?'⛵':ev.id==='refugees'?'⌂':'✺'}</span><h2>${esc(ev.title)}</h2><p>${esc(description)}</p>${eventCost}${reason?`<p class="warning-note">${reason}</p>`:''}<div class="dialog-actions"><button class="primary" id="event-accept" ${reason?'disabled':''}>${esc(definition?.acceptLabel||'Принять решение')}</button><button class="secondary" id="event-skip">${esc(definition?.skipLabel||'Отказаться')}</button></div><p class="keyboard-note">Время на паузе. Ресурсы сверху остаются видны.</p>`);
  for(const choice of ['accept','skip'])$(`event-${choice}`).onclick=()=>{const result=resolveEvent(state,choice);if(result.ok){closeDialog();if(choice==='accept'&&ev.id==='festival'){paused=false;showFestival();}save();update();checkDialogs();}else toast(result.reason);};
 }
}
function pantheon(){
 openDialog('pantheon',`<span class="eyebrow">ИМЕНА РОЖДАЮТСЯ ИЗ ДЕЯНИЙ</span><span class="dialog-emblem">✺</span><h2>${esc(state.name)}</h2><p>Чудеса и успешное вдохновение развивают божественные имена. Чудо даёт +2 славы; успешное вдохновение — +3 славы и ремесленное деяние, отказ — −1 славы (не ниже нуля). Близкие по силе домены могут дать смешанное имя. Потери дают скорбные и смертельные имена; большие потери от голода — жестокие.</p><div class="domain-list">${Object.entries(DIVINE_NAMES).map(([domain,names])=>`<section><h3>${DOMAIN_NAMES[domain]} <small>${state.divinity.domains[domain]} деяний</small></h3>${names.map(name=>`<span class="divine-name ${state.divinity.names.includes(name)?'earned':''}">${state.divinity.names.includes(name)?'✓':'○'} ${name}</span>`).join('')}</section>`).join('')}</div>${state.divinity.names.some(n=>!Object.values(DIVINE_NAMES).flat().includes(n))?`<p>Особые имена: ${state.divinity.names.filter(n=>!Object.values(DIVINE_NAMES).flat().includes(n)).map(esc).join(' · ')}</p>`:''}<div class="dialog-actions"><button class="primary" id="close-pantheon">Вернуться в город</button></div>`);$('close-pantheon').onclick=closeDialog;
}
function resetCityPresentation(){
 waterProjectDraft=null;lastMiracleTarget=null;desiredRoles.clear();storeMinimumDraft.clear();tradeQuantities.clear();Object.assign(transferDraft,{source:'',target:'',resource:'food',amount:10});householdTab='family';supplyFilter='all';routeTarget=2;clearRoadRoute();roadMode=false;renderer.setRoadMode(false);selection=null;inspected=null;inspectedPerson=null;inspectedDeposit=null;testMapUpgrade=false;document.body.classList.remove('test-map-upgrade');paused=true;setSpeed(1);closeDialog();$('tile-detail').hidden=true;document.body.classList.remove('is-building');for(const el of document.querySelectorAll('.building-card')){el.classList.remove('selected');el.setAttribute('aria-pressed','false');}placementRotation=0;updatePlacementControls();renderer.state=state;renderer.resetPresentation?.();renderer.effects=[];renderer.ambient=0;renderer.lightMode='auto';renderer.home();shownEvent=null;shownFeast=null;shownMiracle=null;lastBeerStatus=state.firstBeerFeast?.status;newsSignature='';ceremonySpeed(state,1);last=performance.now();
}
async function archiveCurrentCity(){
 if(!loaded)return;
 const current=state;
 await saveLibrary.create(encode(current),`Архив · год ${current.year} · ${SEASONS[current.season]}`,{kind:'archive'});
}
async function replaceCity(next,{fresh=false}={}){
 if(switchingCity)throw Error('Дождись завершения загрузки города.');
 switchingCity=true;paused=true;const revision=++citySwitchRevision;
 try{await archiveCurrentCity();if(revision!==citySwitchRevision)throw Error('Загрузка отменена. Текущий город остался открытым.');state=useThreeDayCalendar(next);loaded=true;legacyRaw=null;resetCityPresentation();save();update();if(fresh)intro();else{toast('Город загружен. Предыдущая история лежит в архиве. Нажми ▶, чтобы продолжить.');checkDialogs();}}
 finally{switchingCity=false;}
}
async function newGame(mode){
 if(switchingCity)return;
 const buttons=[...document.querySelectorAll('[data-new-mode]')];for(const button of buttons)button.disabled=true;
 try{let seed=globalThis.crypto?.getRandomValues(new Uint32Array(1))[0]??(Date.now()>>>0);if(seed===state.world?.seed)seed=(seed+1)>>>0;await replaceCity(createNewCity({mode,seed}),{fresh:true});}
 catch(error){toast(`Новая игра не начата: ${error.message}`);for(const button of buttons)button.disabled=false;}
}
function showSaves(){
 if(relicControlActive(state)){toast('Сначала заверши путь избранного');return;}
 paused=true;save();openDialog('saves','<div id="saves-root"></div>');
 savesUI=createSaveLibraryUI({root:$('saves-root'),library:saveLibrary,getState:()=>state,encode,onClose:()=>{closeDialog();update();},onNew:askReset,onLoad:next=>replaceCity(next)});update();
}
function chooseNewMode(replace=false){paused=true;openDialog('mode',modeChooserHTML({replace}));dialog.dataset.replace=String(replace);document.querySelectorAll('[data-new-mode]').forEach(button=>button.onclick=()=>newGame(button.dataset.newMode));if($('cancel-mode'))$('cancel-mode').onclick=()=>{closeDialog();checkDialogs();};}
function askReset(){chooseNewMode(true);}
$('building-count').textContent=Object.keys(BUILDINGS).length;
$('open-supply').onclick=showSupply;
renderer.onRoadGround=drawRoadPoint;
$('lay-roads').onclick=()=>{const enable=!renderer.roadDrawMode;clearRoadRoute();if(selection)choose(selection);roadMode=enable;renderer.setRoadMode(enable);renderer.roadDrawMode=enable;$('lay-roads').setAttribute('aria-pressed',String(enable));$('open-roads').setAttribute('aria-pressed','false');$('map-hint').textContent=enable?'Выбери начало дороги · затем конец · Escape — выйти':'Выбери здание или жителя';};
$('open-roads').onclick=()=>{const enable=!roadMode||renderer.roadDrawMode;clearRoadRoute();if(selection)choose(selection);roadMode=enable;renderer.setRoadMode(roadMode);$('open-roads').setAttribute('aria-pressed',String(roadMode));$('map-hint').textContent=roadMode?'Дороги: выбери участок · стрелки и Enter — с клавиатуры · Escape — выйти':'Выбери здание или жителя';};
renderer.onRoadSelect=road=>{if(dialog.open)return;if(routeFrom&&roadMode){routeTo=road.id;inspected=null;renderRoadRoute();}else roadDetail(road);};
$('open-trade').onclick=showTrade;
$('test-resources').textContent='Тестирование';$('test-resources').onclick=()=>showCityOverview('testing');

function showRelicIntro(){const views=relicQuestViews(state);openDialog('relicIntro',`<button class="management-close" id="close-relic" aria-label="Вернуться в город">×</button><span class="eyebrow">ВОЛЯ БОГА</span><h2>Две реликвии долины</h2><p>Одна лежит на дне оазиса, другая — на суше. Их знаки видишь только ты. За 250 веры веди свободного взрослого мышью, найди предмет и отнеси в готовое святилище или зиккурат. Избранный умеет плыть в оазисе. До возвращения город живёт сам на 1×.</p><div class="relic-actions">${views.map(v=>`<button data-relic-locate="${v.id}">${v.title}${v.phase==='completed'?' · в храме':''}</button>`).join('')}</div><div class="relic-candidate-grid">${state.citizens.filter(c=>c.age>=16&&c.age<55).map(c=>`<article><h3>${resident(c)}</h3>${relicStartHTML(state,c)}</article>`).join('')}</div>`);$('close-relic').onclick=closeDialog;document.querySelectorAll('[data-relic-locate]').forEach(b=>b.onclick=()=>{const v=views.find(v=>v.id===b.dataset.relicLocate);closeDialog();renderer.focusOn(v.searchPoint.x,v.searchPoint.y);});}
const relicButton=document.createElement('button');relicButton.id='open-relic';relicButton.textContent='Реликвии долины';$('open-festival').after(relicButton);relicButton.onclick=showRelicIntro;
$('open-life').onclick=()=>showLifeAnalytics();$('open-construction').onclick=()=>showManagement('construction');$('open-residents').onclick=()=>showCityOverview('citizens');$('open-city-tools').onclick=()=>showCityOverview();$('open-photo').onclick=()=>photo.enter();$('open-festival').onclick=showFestival;$('toggle-sound').onclick=async()=>{const enabled=await cityAudio.toggle();$('toggle-sound').textContent=enabled?'Звук включён':'Звук выключен';$('toggle-sound').setAttribute('aria-pressed',String(enabled));};
$('rotate-building').onclick=()=>rotatePlacement();
$('open-encyclopedia').onclick=showEncyclopedia;$('open-song-library').onclick=showEncyclopedia;
$('open-saves').onclick=showSaves;$('open-save-library').onclick=showSaves;$('reset').onclick=askReset;$('help').onclick=intro;$('pantheon').onclick=pantheon;
$('pause').onclick=()=>{if(state.lost&&!state.funeral)return;paused=!paused;save();update();};
for(const el of document.querySelectorAll('[data-speed]'))el.onclick=()=>setSpeed(Number(el.dataset.speed));setSpeed(speed);
async function jumpSeason(){
 if(seasonJumping)return;const reason=seasonJumpReason(state);if(reason){toast(reason);return;}
 const before=encode(state);seasonJumping=true;document.body.classList.add('season-jumping');seasonVeil.hidden=false;seasonVeil.textContent='Смена сезона';$('city').parentNode.setAttribute('aria-busy','true');
 try{
  if(modalKind==='festival')closeDialog();
  await new Promise(resolve=>requestAnimationFrame(resolve));seasonVeil.classList.add('visible');
  await new Promise(resolve=>setTimeout(resolve,180));
  const result=await runSeasonJump(state,{onProgress:p=>{seasonVeil.textContent=`Смена сезона · ${Math.round(p*100)}%`;}});
  renderer.resetPresentation?.();if(!result.ok)toast(result.reason);
 }catch(error){console.error('Season transition:',error);state=decode(before)||state;renderer.resetPresentation?.();toast('Переход остановлен. Город восстановлен до перемотки.');}
 finally{
  seasonVeil.classList.remove('visible');await new Promise(resolve=>setTimeout(resolve,260));seasonVeil.hidden=true;seasonJumping=false;document.body.classList.remove('season-jumping');$('city').parentNode.removeAttribute('aria-busy');last=performance.now();save();update();checkDialogs();
 }
}
$('next-season').setAttribute('aria-label','Следующий сезон');$('next-season').onclick=jumpSeason;
$('day-cycle').onclick=()=>{const clock=lightingAt(state.simTime),target=isWorkday(state.simTime)?20.25:6,seconds=((target-clock.hour+24)%24)*DAY_SECONDS/24+.05;advanceTime(state,seconds);renderer.lightMode='auto';save();update();checkDialogs();};
$('zoom-in').onclick=()=>renderer.zoomBy?renderer.zoomBy(.2):renderer.zoom=Math.min(3,renderer.zoom+.2);$('zoom-out').onclick=()=>renderer.zoomBy?renderer.zoomBy(-.2):renderer.zoom=Math.max(.3,renderer.zoom-.2);$('home').onclick=()=>renderer.home();$('overview').onclick=()=>renderer.overview();
dialog.addEventListener('cancel',e=>{e.preventDefault();if(modalKind==='mode'&&dialog.dataset.replace==='true'){closeDialog();return;}if(['help','reset','pantheon','construction','residents','confirmation','water-project','household-initiative','trade','citytools','festival','life','relicIntro','encyclopedia','saves'].includes(modalKind)){closeDialog();checkDialogs();}});
document.addEventListener('keydown',e=>{if(seasonJumping){e.preventDefault();return;}if(relicControlActive(state)){if(e.code==='Space'&&!['INPUT','SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();paused=!paused;save();update();}return;}if(photo.active||dialog.open||['INPUT','TEXTAREA','SELECT','SUMMARY'].includes(e.target.tagName))return;if(e.code==='KeyR'&&selection){e.preventDefault();rotatePlacement(e.shiftKey?-1:1);return;}if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();paused=!paused;save();update();}if(e.key==='Escape'){if(testMapUpgrade){testMapUpgrade=false;document.body.classList.remove('test-map-upgrade');toast('Тестовое улучшение закончено');return;}if(roadMode){clearRoadRoute();$('tile-detail').hidden=true;roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');}if(selection)choose(selection);else{inspected=null;$('tile-detail').hidden=true;}}if(/^[1-9]$/.test(e.key))choose(Object.keys(BUILDINGS)[Number(e.key)-1]);});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&loaded)save();});
let shownEvent=null,shownFeast=null,shownMiracle=null,lastBeerStatus=state.firstBeerFeast?.status;
const ceremonyNotice=document.createElement('button');ceremonyNotice.className='ceremony-notice';ceremonyNotice.hidden=true;$('city').parentNode.append(ceremonyNotice);ceremonyNotice.onclick=()=>{if(state.miracleCelebration){const p=state.miracleCelebration.center;renderer.focusOn(p.x,p.y);}else if(state.festival)showFestival();else if(state.funeral?.gather)renderer.focusOn(state.funeral.gather.x,state.funeral.gather.y);};
function ceremonyPresentation(){
 const miracleScene=state.miracleCelebration;if(miracleScene&&shownMiracle!==miracleScene){shownMiracle=miracleScene;renderer.focusOn(miracleScene.center.x,miracleScene.center.y);toast(miracleScene.kind==='cat'?(miracleScene.duration===8?'Кошка идёт к новому хранилищу.':'Неожиданный гость: жители встречают кошку!'):'Дыхание земли: жители собираются у чудесного сада!');}if(!miracleScene)shownMiracle=null;
 if(state.event!==shownEvent){shownEvent=state.event;if(shownEvent)renderer.addEffect(cityEventDefinition(shownEvent.id)?.effectId||'blessing');}
 const q=state.festival;if(q?.stage==='celebrating'&&q!==shownFeast){shownFeast=q;const view=festivalView(state),p=view?.court||view;if(p){renderer.addEffect('festival',{x:p.x,y:p.y});renderer.focusOn(p.x,p.y);}toast(q.occasion==='firstBeer'?'Первая партия пива выпущена! Начался пир у пивоварни.':'Ночь огней началась: жители пируют и танцуют.');}
 if(!q)shownFeast=null;
 if(lastBeerStatus!==state.firstBeerFeast?.status){lastBeerStatus=state.firstBeerFeast?.status;if(lastBeerStatus==='pending')toast('Первая партия пива выпущена! Жители готовят малый пир у пивоварни.');}
 const text=festivalBlessingFrame(festivalView(state))?'Ночь огней · Бог услышал их':ceremonyLabel(state);ceremonyNotice.hidden=!text;ceremonyNotice.textContent=`${text} · ${speed}× · ${paused?'Ⅱ участники на паузе':'участники продолжают церемонию'}`;
}
function frame(now){
 const dt=Math.min(250,Math.max(0,now-last));last=now;syncCeremonySpeed();
 const windowBlocks=dialog.open&&modalKind!=='festival'&&!ceremonyActive(state),presentationPaused=seasonJumping||document.hidden||photo.active||paused||windowBlocks||!!state.event;
 if(!presentationPaused&&(!state.lost||state.funeral)){const oldTick=state.tick;advanceTime(state,ceremonyActive(state)?dt/1000*speed:simulationSeconds(dt/1000,relicControlActive(state)?1:speed));if(state.tick!==oldTick||state.event||state.lost||state.won&&!state.continued){save();update();checkDialogs();}if(now-lastSave>3000){save();lastSave=now;}}
 syncCeremonySpeed();ceremonyPresentation();if(!seasonJumping&&now-lastUI>350){update();lastUI=now;}
 renderer.inspected=inspected;renderer.focusCitizenId=inspectedPerson;cityAudio.tick(state,presentationPaused,cityAudioListener(renderer));renderer.draw(state,photo.active?null:selection,now,{paused:presentationPaused,speed:relicControlActive(state)?1:speed});if(renderer.ctx)drawRelic2D(renderer,state);requestAnimationFrame(frame);
}
urukUI=createUrukInterface({getState:()=>state,onResize:()=>renderer.resize()});
update();requestAnimationFrame(frame);
if(!loaded)chooseNewMode();else{toast(legacyRaw?'Город обновлён: дворы, ремёсла, обзор кварталов и фоторежим. Прежние запасы, семьи, грузы и оплаченные стройки сохранены.':'Город и грузы восстановлены. Нажми ▶, когда будешь готов.');checkDialogs();}
if(corrupt)setTimeout(()=>toast('Сохранение повреждено или несовместимо. Начата новая история.'),500);
if(!storageOK){$('save-status').textContent='○ Без сохранения';setTimeout(()=>toast('Хранилище браузера недоступно. Прогресс сохранится только до закрытия вкладки.'),1000);}
