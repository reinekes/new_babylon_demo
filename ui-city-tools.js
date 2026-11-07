import {residentLinkHTML} from './ui-resident-links.js';
import {inannaMeetingReason} from './miracle-celebration.js';
import {INANNA_GUARD_DAYS} from './inanna-discovery.js';
import {miracleLockReason} from './sacred-unlocks.js';
import {LAND_STORIES_REQUIRED,landMemoryStories,landSearchReason} from './land-memory.js';
import {DEPTH_HOMES_REQUIRED,depthSearchReason} from './depth-supply.js';
import {starForecastView} from './star-forecast.js';
import {STAR_NIGHTS_REQUIRED} from './star-observations.js';
import {arrivalHospitalityView,arrivalHousing,arrivalWelcomeHouse} from './arrival-hospitality.js';
import {shapingProjectView} from './shaping-projects.js';
import {revelationAdviceView} from './revelation-advice.js';
import {revelationEvidenceView} from './revelation-evidence.js';
import {sunlightDedications} from './votive-offerings.js';
import {abundanceReserveReady,ABUNDANCE_HOMES} from './abundance-discovery.js';
import {WIND_DELIVERY_GOAL,WIND_DESTINATION_GOAL,windKnowledgeReason} from './wind-delivery.js';
import {creatorMaterialsView} from './creator-materials.js';
import {richCatchMapReason} from './rich-catch.js';
import {richCatchView} from './fish-provenance.js';
import {fieldGrainView} from './field-grain.js';
import {peaceDiscoveryView} from './peace-discovery.js';
import {blessingDiscoveryView} from './blessing-discovery.js';
import {usesCatDiscovery,isStrictSumer} from './scenario-profiles.js';
import {floodPhase,floodFootprint,floodedRoads,floodStorageRisk,JAR_FOOD_CAPACITY} from './river-flood.js';
import {fireForecast} from './fire-forecast.js';
import {lowWaterForecast} from './irrigation.js';
import {needsCanalCleaning} from './canal-maintenance.js';
import {activeLaborKind,harvestCallActive,harvestDemand,harvestCandidates,unloadDemand,UNLOAD_PORTERS} from './city-labor.js';
import {professionOptionsHTML} from './ui-professions.js';
import {buildingDefinition} from './building-presentation.js';
import {renderTestTools} from './ui-test-tools.js';
import {PROFESSION_NAMES,PROFESSION_IDS,professionRole,professionMatchesTask,staffingCandidates} from './professions.js';
import {cityDiagnostics,filterCitizens,CITY_ROLE_NAMES} from './city-diagnostics.js';
import {BUILDINGS,buildingKey} from './definitions.js';
import {displayName} from './citizen-epithets.js';
import {citizenEpithetHTML} from './ui-citizen-epithets.js';
import {setHTML} from './ui-render.js';
import {ROLES} from './education.js';
import {inspirationReason,inspirationSuccessChance} from './management.js';
import {uiIcon} from './ui-icons.js';
import {resourceIcon} from './resource-icons.js';
import {buildingInventoryHTML} from './ui-building-inventory.js';
import {buildingProductionHistoryHTML} from './ui-building-production.js';
import {citizenProfessionName,selectedProfession} from './ui-professions.js';
import {buildingChronology,compareBuildingsNewest} from './building-chronology.js';

const controllers=new WeakMap(),PAGE_SIZE=24;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>new Intl.NumberFormat('ru',{maximumFractionDigits:1}).format(n||0);
const focus=(key,text,extra='')=>key?`<button type="button" class="city-tools-link ${extra}" data-city-focus="${escape(key)}">${escape(text)}</button>`:`<span>${escape(text)}</span>`;
const tag=(text,warn=false)=>`<span class="city-tools-tag${warn?' is-warning':''}">${escape(text)}</span>`;
function select(name,label,value,options){return `<label class="city-tools-field"><span>${label}</span><select data-city-filter="${name}" aria-label="${label}">${options.map(([id,text])=>`<option value="${escape(id)}"${value===id?' selected':''}>${escape(text)}</option>`).join('')}</select></label>`;}
const empty=text=>`<p class="city-tools-empty">${escape(text)}</p>`;
function neighborhoodsHTML(model){
 const housing=model.neighborhoods.filter(n=>n.homeKeys.length),stores=model.neighborhoods.filter(n=>!n.homeKeys.length);
 const cards=items=>items.map(n=>`<article class="city-tools-row"${!n.homeKeys.length?` data-city-store-group="${escape(n.key)}"`:''}><div class="city-tools-row-head">${focus(n.focus,n.label)}${tag(n.homeKeys.length?`${n.population} жителей · ${n.homeKeys.length} домов`:'Склад')}</div><div class="city-tools-metrics"><span>Склад <b>${number(n.food)}</b> еды</span>${n.homeKeys.length?`<span>Дома <b>${number(n.homeFood)}</b></span><span>В пути <b>${number(n.foodInTransit)}</b></span><span>Вода <b>${number(n.water)}</b> / ${number(n.waterDemand)}</span><span>Работают <b>${n.workers}</b> · с грузом <b>${n.cargo}</b></span>`:''}</div>${n.reasons.length?`<div class="city-tools-reasons">${n.reasons.map(r=>focus(r.target,r.label,'is-warning')).join('')}</div>`:tag(n.homeKeys.length?'Дома обеспечены':'Без соседних семей')}${n.troubled?`<button type="button" class="city-tools-households" data-city-homes="${escape(n.key)}">Проблемные дома · ${n.troubled} →</button>`:''}</article>`).join('');
 return `<p class="city-tools-note">Жильё сгруппировано у ближайшего доступного склада. Домашние припасы и грузы не прибавлены к складу.</p><section class="city-tools-category" data-city-district-section="housing"><h3>Жилые кварталы <small>${housing.length}</small></h3><div class="city-tools-list city-tools-card-grid">${cards(housing)||empty('Пока нет жилых домов.')}</div></section><section class="city-tools-category" data-city-district-section="stores"><h3>Другие здания с запасами <small>${stores.length}</small></h3><div class="city-tools-list city-tools-card-grid">${cards(stores)||empty('Все склады обслуживают жилые кварталы.')}</div></section>`;
}
function optionsHTML(options,value){return options.map(([id,text])=>`<option value="${escape(id)}"${value===id?' selected':''}>${escape(text)}</option>`).join('');}
function personControls(s,c,desired){
 const profession=selectedProfession(c,desired),inspiration=PROFESSION_IDS.includes(profession)&&profession!=='auto'?profession:'builder',reason=inspirationReason(s,c.id,inspiration),adult=(c.age??20)>=16,chance=Math.round(inspirationSuccessChance(s,c,inspiration)*100);
 return `<div class="city-tools-person-controls"><label class="city-tools-field"><span>Профессия</span><select data-city-role="${c.id}" aria-label="Профессия: ${escape(displayName(s,c))}"${adult?'':' disabled'}>${optionsHTML(ROLES.map(id=>[id,PROFESSION_NAMES[id]]),c.pendingRole||c.role||'auto')}</select></label><div class="city-tools-inspiration"><label class="city-tools-field"><span>Вдохновение</span><select data-city-inspiration="${c.id}" aria-label="Вдохновение: ${escape(displayName(s,c))}">${professionOptionsHTML(inspiration,{ids:PROFESSION_IDS.filter(id=>id!=='auto')})}</select></label><button type="button" class="city-tools-inspire" data-city-inspire="${c.id}"${reason?' disabled':''} title="${escape(reason||`${chance}% успеха; 1 вера расходуется при любом исходе`)}">${resourceIcon('faith')}Вдохновить · 1 вера</button><small>Шанс ${chance}%${reason?` · ${escape(reason)}`:''}</small></div></div>${c.pendingRole?`<small class="city-tools-pending">${escape(PROFESSION_NAMES[c.pendingRole]||c.pendingRole)} — после доставки груза</small>`:''}${!adult?'<small class="city-tools-pending">Работа с 16 лет. Вдохновение сохранится до взросления.</small>':''}`;
}
export function sortedCityCitizens(s,filter={}){
 const mode=filter.sort||'name',name=c=>displayName(s,c);
 return filterCitizens(s,filter).sort((a,b)=>{
  const diff=mode==='age'?(b.age??20)-(a.age??20):mode==='health'?(a.health??100)-(b.health??100):mode==='hunger'?(b.hunger||0)-(a.hunger||0):mode==='profession'?citizenProfessionName(a).localeCompare(citizenProfessionName(b),'ru'):0;
  return diff||name(a).localeCompare(name(b),'ru')||a.id-b.id;
 });
}
function citizensHTML(s,model,filter,page,desiredInspirations,expandedCitizens){
 const people=sortedCityCitizens(s,filter),pages=Math.max(1,Math.ceil(people.length/PAGE_SIZE)),current=Math.min(page,pages-1),roles=[...new Set(['auto','production','carrier','builder','healer','tailor','watercarrier',...(s.citizens||[]).map(c=>professionRole(c.calling)===c.role?c.calling:c.role||'auto')])];
 return `<div class="city-tools-filters">${select('role','Профессия',filter.role||'all',[['all','Все профессии'],...roles.map(r=>[r,CITY_ROLE_NAMES[r]||r])])}${select('age','Возраст',filter.age||'all',[['all','Все возрасты'],['adult','Взрослые · 16+'],['child','Дети · до 16']])}${select('trouble','Состояние',filter.trouble||'all',[['all','Все жители'],['hunger','Недоедание'],['health','Здоровье ниже 60%'],['family','Семье нужна помощь']])}${select('sort','Порядок',filter.sort||'name',[['name','По имени'],['age','Старшие сначала'],['health','Сначала нужна помощь'],['hunger','Сначала голодные'],['profession','По профессии']])}</div>${filter.home?`<div class="city-tools-note">Дом ${escape(filter.home)} <button type="button" class="city-tools-link" data-city-clear-home>Все дома</button></div>`:''}<div class="city-tools-count">Найдено: ${people.length} · ${current*PAGE_SIZE+Number(people.length>0)}–${Math.min((current+1)*PAGE_SIZE,people.length)}</div><div class="city-tools-list city-tools-card-grid">${people.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE).map(c=>`<article class="city-tools-row city-tools-person"><div class="city-tools-person-heading"><div><button type="button" class="city-tools-name" data-city-citizen="${c.id}">${escape(displayName(s,c))}</button><span class="city-tools-person-info">${Math.floor(c.age??20)} лет · ${escape(citizenProfessionName(c))}</span></div><div class="city-tools-person-actions">${focus(c.home,'Дом')}${focus(c.workplace||c.work||c.site||c.guardPost,c.site?'Стройка':'Работа')}</div></div><div class="city-tools-metrics city-tools-person-vitals"><span class="${c.health<60?'is-warning':''}">Здоровье <b>${number(c.health??100)}%</b></span><span class="${c.hunger>=30?'is-warning':''}">Голод <b>${number(c.hunger)}%</b></span></div><details class="city-tools-person-more" data-city-person-disclosure="${c.id}"${expandedCitizens.has(c.id)?' open':''}><summary>Настроить и подробнее</summary>${personControls(s,c,desiredInspirations.get(c.id))}${citizenEpithetHTML(s,c)}</details></article>`).join('')||empty('По этим фильтрам жителей нет.')}</div>${pages>1?`<nav class="city-tools-pagination" aria-label="Страницы жителей"><button type="button" data-city-page="${current-1}"${current===0?' disabled':''}>← Назад</button><span>${current+1} / ${pages}</span><button type="button" data-city-page="${current+1}"${current===pages-1?' disabled':''}>Дальше →</button></nav>`:''}`;
}
function staffingHTML(s,w){
 if(!w.staffing)return '';
 const b=s.buildings.find(b=>`${b.x},${b.y}`===w.key||b.id===w.key),staff=w.staffing,candidates=staffingCandidates(s.citizens||[],b),fixed=new Set(w.fixed);
 return `<div class="city-tools-staffing"><div class="city-tools-staffing-label"><b>${escape(staff.label)} · ${staff.count}/${staff.capacity}</b><small>По призванию: ${staff.matching}/${staff.capacity}</small></div>${w.assigned.length?`<ul class="city-tools-workers">${w.assigned.map(id=>{const c=s.citizens.find(c=>c.id===id);return `<li><button type="button" class="city-tools-link" data-city-citizen="${id}">${escape(displayName(s,id))}</button><span>${escape(citizenProfessionName(c))}${professionMatchesTask(c,w.type)?' · +20%':''}</span>${fixed.has(id)?`<button type="button" class="city-tools-release" data-city-release="${id}" aria-label="Освободить: ${escape(displayName(s,id))}">Освободить</button>`:'<small>авто</small>'}</li>`;}).join('')}</ul>`:''}<label class="city-tools-field city-tools-assign"><span>Быстро назначить</span><select data-city-assign="${escape(w.key)}" aria-label="Назначить работника: ${escape(w.name)}"${w.fixed.length>=staff.capacity||!candidates.length?' disabled':''}><option value="">${w.fixed.length>=staff.capacity?'Постоянные места заняты':candidates.length?'Выбрать жителя':'Нет подходящего взрослого'}</option>${candidates.map(c=>`<option value="${c.id}">${escape(displayName(s,c))} · ${escape(citizenProfessionName(c))}${professionMatchesTask(c,w.type)?' · призвание +20%':''}${c.workplace?' · сменит место':''}</option>`).join('')}</select></label></div>`;
}
function workshopCard(s,w,b,expanded){
 const date=buildingChronology(b),slots=w.staffing?`${w.staffing.count}/${w.staffing.capacity} мест`:`${w.builders.length} строит.`,color=w.staffing?.state||'construction';
 return `<article class="city-tools-row city-tools-workshop" data-city-building="${escape(w.key)}" data-staffing="${color}"><details data-city-disclosure="${escape(w.key)}"${expanded.has(w.key)?' open':''}><summary class="city-tools-building-summary"><span class="city-tools-building-name">${uiIcon(w.type)}<span>${escape(w.name)}</span></span><span class="city-tools-building-year">${escape(date.label)}</span><span class="city-tools-building-level">Ур. ${b?.level||1}</span><span class="city-tools-building-slots" aria-label="${escape(w.staffing?.label||'Строительство')}: ${escape(slots)}"><i aria-hidden="true"></i>${escape(slots)}</span></summary><div class="city-tools-building-body"><div class="city-tools-row-head">${focus(w.key,'Показать на карте')}${tag(`Клетка ${w.x}, ${w.y}`)}</div><div class="city-tools-production ${w.status==='attention'?'is-warning':''}">${focus(w.reason.target,w.reason.label)}<span>${escape(w.reason.detail)}</span></div>${w.reason.code==='construction'?`<p class="city-tools-note">Строителей: ${w.builders.length} · носильщиков: ${w.carriers.length}. Год будет записан после завершения.</p>`:''}${staffingHTML(s,w)}${buildingInventoryHTML(w.inventory,{production:!!Object.keys(BUILDINGS[w.type]?.output||{}).filter(k=>!['faith','prestige'].includes(k)).length})}${buildingProductionHistoryHTML(s,b)}</div></details></article>`;
}
export const CITY_WORK_CATEGORIES=[
 {id:'food',name:'Пища',types:['field','garden','fishing','hunting','cowshed']},
 {id:'materials',name:'Сырьё',types:['clay','reed','logging','quarry','sheepfold']},
 {id:'production',name:'Производство',types:['pottery','brewery','kiln','brickyard','weaver','tailor']},
 {id:'services',name:'Снабжение и услуги',types:['waterpoint','depot','granary','market','healer','musicHouse','house','bridge','canal','levee','harbor']},
 {id:'sacred',name:'Культ',types:['shrine','ziggurat','ishtarGate']}
];
function harvestCallHTML(s){
 const {fields,ripe,sheaves,slots,keys}=harvestDemand(s);
 const active=harvestCallActive(s),spent=s.cityLabor?.year===s.year;
 if(!fields.length&&!active&&!(spent&&s.cityLabor.kind==='harvest'))return '';
 const assigned=s.citizens.filter(c=>keys.has(c.workplace||c.work)).length;
 const buildings=new Map(s.buildings.map(b=>[b.id||`${b.x},${b.y}`,b]));
 const candidates=harvestCandidates(s.citizens,buildings).length;
 const status=active?'Призыв действует':spent?'Призыв использован в этом году':'Призыв на жатву';
 return `<article class="city-tools-row"><h3>${status}</h3><p>На полях ${number(ripe)} урожая и ${number(sheaves)} снопов. Занято ${assigned} из ${slots} мест. Возможных помощников ${candidates}, распределение зависит от дороги.</p><small>Призыв общий с разгрузкой и действует до суток. Взятые грузы и назначения сохраняются. В каждой семье остаётся взрослый для снабжения, а водоносы и работники пищевых промыслов остаются на своих местах.</small><button type="button" data-city-harvest ${spent||!fields.length?'disabled':''}>Собрать руки на жатву</button></article>`;
}
function unloadCallHTML(s){
 const {queued,ports}=unloadDemand(s),active=activeLaborKind(s)==='unload',spent=s.cityLabor?.year===s.year;
 if(!queued&&!active&&!(spent&&s.cityLabor.kind==='unload'))return '';
 const assigned=s.citizens.filter(c=>c.tradeJob&&(ports.has(c.tradeMarket)||active)).length;
 const title=active?'Приоритет разгрузки действует':spent?'Городской призыв использован в этом году':'Призыв на разгрузку';
 return `<article class="city-tools-row"><h3>${title}</h3><p>К доставке ${number(queued)} купленных товаров. Носильщиков с поручением ${assigned}.</p><small>До ${UNLOAD_PORTERS} носильщиков на рынок или пристань. Призыв общий с жатвой и действует до суток. Начатые доставки, снабжение семей и закреплённые места сохраняются.</small><button type="button" data-city-unload ${spent||!queued?'disabled':''}>Собрать носильщиков на разгрузку</button></article>`;
}
function repairCallHTML(s){
 const canals=s.buildings.filter(b=>b.type==='canal'&&b.silt>0);
 const jobs=canals.filter(needsCanalCleaning);
 const active=activeLaborKind(s)==='repair',spent=s.cityLabor?.year===s.year;
 if(!canals.length&&!active)return '';
 const links=canals.filter(b=>b.silt>=.5||b.canalCleaning).slice(0,8).map(b=>focus(buildingKey(b),`Канал · ${b.x}, ${b.y} · ил ${Math.round(b.silt*100)}%`)).join('');
 return `<article class="city-tools-row"><h3>${active?'Приоритет расчистки действует':'Расчистка каналов'}</h3><p>Участков в очереди · ${jobs.length}</p>${links}<small>Наряды заказываются в карточках каналов. Призыв общий с жатвой и разгрузкой.</small><button type="button" data-city-repair ${spent||!jobs.length?'disabled':''}>Собрать людей на расчистку</button></article>`;
}
function floodHTML(s){
 const phase=floodPhase(s);
 if(!phase)return '';
 const footprint=floodFootprint(s,s.riverFlood),roads=floodedRoads(s,footprint);
 const withLevees=floodFootprint(s,s.riverFlood,{withDrainage:false}).size;
 const exposed=floodFootprint(s,s.riverFlood,{withDrainage:false,withLevees:false}).size;
 const relieved=withLevees-footprint.size,protectedCells=exposed-withLevees;
 const evacuees=s.citizens.filter(c=>c.floodShelter),walking=evacuees.filter(c=>c.routeIndex<c.route.length).length;
 const storage=phase==='warning'?floodStorageRisk(s,footprint):[];
 const storageWarning=storage.length?`<p>При разливе отсыреет четверть еды без тары. Один местный сосуд укроет до ${JAR_FOOD_CAPACITY} ед. еды и треснет после разлива. В разделе «Склады и перевозки» можно подвезти сосуды или вывезти еду.</p><ul>${storage.map(({building,key,loss,jars,covered})=>`<li>${focus(key,`${buildingDefinition(s,building.type).name} · ${building.x}, ${building.y}`)} · Под угрозой ${number(loss)} ед. еды${jars?` · В таре ${number(covered)} ед. · Сосудов под списание: ${jars}`:''}</li>`).join('')}</ul>`:'';
 const coordinates=roads.slice(0,8).map(r=>`(${r.a.x}, ${r.a.y}) → (${r.b.x}, ${r.b.y})`).join(' · ');
 return `<article class="city-tools-row"><h3>${phase==='active'?'Река вышла из берегов':'Прогноз весеннего разлива'}</h3><p>Затронутых дорожных участков: ${roads.length}. Защищённые клетки: вал — ${protectedCells}, отвод — ${relieved}.</p><small>Для отвода нужна непрерывная цепочка чистых дренажных каналов с выходом в воду за пределами разлива.</small>${phase==='active'?`<p>Идут в укрытие: ${walking}. В укрытии: ${evacuees.length-walking}.</p>`: ''}${storageWarning}${coordinates?`<small>${coordinates}</small>`:''}</article>`;
}
function floodRepairsHTML(s){
 const damaged=[...s.buildings,...s.roads||[]].filter(b=>b.floodDamage);
 if(!damaged.length)return '';
 return `<article class="city-tools-row"><h3>Повреждения после разлива</h3><ul>${damaged.map(b=>`<li>${focus(buildingKey(b),`${b.type==='road'?'Дорога':'Дом'} · ${b.x}, ${b.y}`)} · ${b.construction?.kind==='repair'?'Ремонт заказан':'Нужен ремонт'}</li>`).join('')}</ul></article>`;
}
function lowWaterHTML(s){
 const forecast=lowWaterForecast(s);
 if(!forecast)return '';
 const links=forecast.fields.slice(0,8).map(b=>focus(buildingKey(b),`Поле · ${b.x}, ${b.y}`)).join('');
 const timing=forecast.active?'Сейчас каждый речной водозабор даёт до одной доли воды.':'Летом каждый речной водозабор даст до одной доли воды.';
 return `<article class="city-tools-row"><h3>${forecast.active?'Маловодье':'Прогноз маловодья'}</h3><p>${timing} Полей без канального полива при нынешней сети: ${forecast.fields.length}.</p>${links}<small>Подведи отдельную ветку от реки или соедини сеть с озером. Озёрные водозаборы сохраняют обычный поток.</small></article>`;
}
function fireForecastHTML(s){
 const forecast=fireForecast(s);
 if(!forecast)return '';
 const {dry,wind,sites,banked}=forecast;
 const labels={low:'Низкий риск',watch:'Под наблюдением',high:'Высокий риск'};
 const stopped=banked.map(({key,repair})=>`<li>${focus(key,`Печь · ${key}`)} · ${repair?'Печь требует ремонта.':'Обжиг остановлен.'} <button type="button" data-city-resume-kiln="${escape(key)}">Разрешить обжиг</button></li>`).join('');
 const evacuees=s.citizens.filter(c=>c.fireShelter);
 const sheltered=evacuees.filter(c=>!c.fireShelter.returning&&c.route.length&&c.routeIndex===c.route.length).length;
 const rows=sites.map(site=>`<li>${focus(site.key,`Печь · ${site.key}`)} · <b>${site.fire?`Очаг у печи · до повреждения ${Math.ceil(site.remaining)} игр. сек.`:labels[site.level]}</b><br>${site.homes.length?`Жилые дворы рядом · ${site.homes.map(key=>focus(key,key)+(site.fire&&!s.citizens.some(c=>c.home===key&&c.fireShelter)?` <button type="button" data-city-fire-evacuate="${escape(key)}" data-kiln="${escape(site.key)}">Укрыть семью</button>`:'' )).join(' ')}. Доступная вода сверх суточной потребности · ${number(site.reserve)}.`:'Рядом нет жилых дворов.'} <button type="button" data-city-bank-kiln="${escape(site.key)}">Остановить обжиг</button> ${site.fire?`<button type="button" data-city-extinguish-kiln="${escape(site.key)}"${site.canExtinguish?'':' disabled'}>Отправить воду к печи</button>${site.inTransit>0?` <small>Несут к печи · ${number(site.inTransit)} воды.</small>`:''}`:''}</li>`).join('');
 return `<article class="city-tools-row" data-fire-forecast><h3>Риск пожара у печей</h3><p>${dry?'Сухо':'Без сухости'} · ${wind?'ветрено':'без сильного ветра'}. ${sites.length?'Оценка при текущем обжиге.':'Сейчас печи не горят.'}</p>${evacuees.length?`<p>В укрытии · ${sheltered} чел. Идут или ждут прохода · ${evacuees.length-sheltered} чел.</p>`:''}${rows||stopped?`<ul>${rows}${stopped}</ul>`:''}<small>Оставляй проход между печью и двором. Вода для тушения считается сверх запаса на питьё. Остановка сохраняет сырец. Для нового обжига нужен свежий тростник.</small></article>`;
}
function workshopsHTML(s,model,expanded){
 const buildings=new Map(s.buildings.map(b=>[b.id||`${b.x},${b.y}`,b])),groups=new Map();
 for(const w of model.workshops){if(!groups.has(w.type))groups.set(w.type,[]);groups.get(w.type).push(w);}
 const categories=CITY_WORK_CATEGORIES.map(c=>({...c,types:[...c.types]})),unknown=[...groups.keys()].filter(t=>!categories.some(c=>c.types.includes(t)));categories.find(c=>c.id==='services').types.push(...unknown);
 return `${floodHTML(s)}${floodRepairsHTML(s)}${lowWaterHTML(s)}${harvestCallHTML(s)}${unloadCallHTML(s)}${repairCallHTML(s)}<p class="city-tools-note">Здания сгруппированы по делу; одинаковые рядом, новые первыми. Раскрой строку для назначения, запасов и выпуска.</p><div class="city-tools-staffing-legend"><span data-staffing="empty">Нет людей</span><span data-staffing="partial">Не хватает</span><span data-staffing="full">Места заняты</span><span data-staffing="matched">По призванию</span></div>${categories.map(c=>{const count=c.types.reduce((n,t)=>n+(groups.get(t)?.length||0),0);return `<section class="city-tools-category" data-city-work-category="${c.id}"><h3>${c.name} <small>${count}</small></h3><div class="city-tools-workshop-groups city-tools-card-grid">${c.types.filter(t=>groups.has(t)).map(type=>`<section class="city-tools-workshop-group" aria-label="${escape(buildingDefinition(s,type)?.name||type)}" data-city-building-group="${escape(type)}">${groups.get(type).sort((a,b)=>compareBuildingsNewest(buildings.get(a.key),buildings.get(b.key))).map(w=>workshopCard(s,w,buildings.get(w.key),expanded)).join('')}</section>`).join('')||empty('Пока нет зданий этой группы.')}</div></section>`;}).join('')}`;
}
function homesHTML(model,group){const keys=new Set(model.neighborhoods.find(n=>n.key===group)?.homeKeys||[]);return `<button type="button" class="city-tools-link" data-city-tab="districts">← Все кварталы</button><div class="city-tools-list city-tools-card-grid">${model.homes.filter(h=>keys.has(h.key)&&h.reasons.length).map(h=>`<article class="city-tools-row"><div class="city-tools-row-head"><div class="city-tools-building-name">${uiIcon('house')}${focus(h.key,`Дом · ${h.x}, ${h.y}`)}</div><button type="button" class="city-tools-link" data-city-home="${escape(h.key)}">Жители · ${h.population}</button></div><div class="city-tools-metrics"><span>Еда ${number(h.food)} / ${number(h.demand)} на ужин</span><span>Вода ${number(h.water)} / ${number(h.waterDemand)} в день</span></div><div class="city-tools-reasons">${h.reasons.map(r=>tag(r.label,true)).join('')}</div>${buildingInventoryHTML(h.inventory,{house:true})}</article>`).join('')||empty('Сейчас все семьи этого квартала обеспечены.')}</div>`;}

function housingPolicyHTML(s){
 if(!isStrictSumer(s))return '';
 const enabled=s.householdBuildingPolicy?.enabled===true;
 return `<section class="management-row"><h3>Настройки города</h3><label><input type="checkbox" data-city-auto-housing ${enabled?'checked':''}> Разрешить семьям самостоятельно строить малые дворы</label><p>Проверка раз в игровые сутки, одна такая стройка за раз. Семье нужны свободный участок, проход, 12 глины и 8 тростника на доступных складах. Выключение сохраняет начатые заказы.</p></section>`;
}

function blessingProgressHTML(s){
 const progress=blessingDiscoveryView(s);
 if(!progress)return '';
 const details=progress.qualified?'Условия выполнены. Дворы запомнили помощь соседей.':
  `Снабжённые дворы · ${progress.homes} из ${progress.homesRequired} · Подтверждённая помощь · ${progress.aid} из ${progress.aidRequired}.`;
 return `<section class="management-row" data-blessing-progress><h3>История «Благословение»</h3><p>${details}</p></section>`;
}

function peaceProgressHTML(s){
 const progress=peaceDiscoveryView(s);
 if(!progress)return '';
 const details=progress.qualified?'Условия выполнены.':
  `Получили уход · ${progress.care} из ${progress.careRequired} · Спокойные общие трапезы · ${progress.meals} из ${progress.mealsRequired}.`;
 return `<section class="management-row" data-peace-progress><h3>История «Тишина сердец»</h3><p>${details}</p></section>`;
}

function earthProgressHTML(s){
 const progress=fieldGrainView(s);
 if(!progress)return '';
 const details=progress.qualified?'Условия выполнены. Три поля дали зерно, чудо открыто.':
  `Поля со складской приёмкой · ${progress.fields} из ${progress.required} · ${progress.inspired?'Работа вдохновлённого земледельца подтверждена':'Нужна доставка зерна от вдохновлённого земледельца'}.`;
 return `<section class="management-row" data-earth-progress><h3>История «Дыхание земли»</h3><p>${details}</p></section>`;
}

function richCatchProgressHTML(s){
 const progress=richCatchView(s);
 if(!progress)return '';
 const {catches,homes,requiredCatches,requiredHomes,qualified}=progress;
 const details=richCatchMapReason(s)||(qualified?'Условия выполнены.':
  `Уловы одного вдохновлённого рыбака · ${catches} из ${requiredCatches} · Жилые дворы с доставленной рыбой · ${homes} из ${requiredHomes}.`);
 const receipts=s.causalFacts?.fishHomes||[];
 const rows=receipts.map(f=>`<li>Двор ${escape(f.home)} · ${Number(f.amount.toFixed(2))} рыбы · получил ${residentLinkHTML(s,f.recipientId)} · доставил ${residentLinkHTML(s,f.courierId)}</li>`);
 return `<section class="management-row" data-rich-catch-progress><h3>История «Богатый улов»</h3><p>${details}</p>${rows.length?`<ul data-fish-home-receipts>${rows.join('')}</ul>`:''}</section>`;
}

function revelationAdviceHTML(s){
 const view=revelationAdviceView(s);
 if(!view)return '';
 const {person,place,label,action,stale}=view;
 return `<p><b>${label}</b> · ${stale?'Совет устарел: работа или условия изменились.':`${escape(displayName(s,person))} · ${escape(buildingDefinition(s,place.type).name)} (${place.x}, ${place.y}). ${action}`}</p>${stale?'':`<button type="button" data-city-citizen="${person.id}">К жителю</button> <button type="button" data-city-focus="${buildingKey(place)}">К месту</button>`}`;
}

function revelationEvidenceHTML(s){
 const view=revelationEvidenceView(s);
 if(!view)return '';
 const labels={family:'Помощь семье',building:'Завершённая стройка',food:'Урожай или улов'};
 const training=view.apprenticeship;
 const name=id=>escape(displayName(s,id)||`житель №${id+1}`);
 const accounts=training?`<h4>Три рассказа об одной стройке · ${training.x}, ${training.y}</h4><ul><li>Мастер ${name(training.citizenId)} рассказал, чему учил.</li><li>Ученик ${name(training.pupils[0])} рассказал о своей работе рядом с мастером.</li><li>Ученик ${name(training.pupils[1])} сохранил собственный рассказ о той же стройке.</li></ul>`:'<p>Другой путь · мастер работает с двумя разными учениками по очереди на одной стройке.</p>';

 return `<section class="management-row" data-revelation-evidence><h3>Свидетельства для «Откровения» · ${view.count} из 3</h3><ul>${view.entries.map(({kind,recorded})=>`<li>${labels[kind]} · ${recorded?'есть свидетельство':'ожидается'}</li>`).join('')}</ul>${view.opening?'<p>Хранитель связал рассказы. Дар открыт.</p>':(view.count===3||training)?'<p>Три истории собраны. Ожидается взрослый хранитель рассказов.</p>':''}${accounts}${revelationAdviceHTML(s)}</section>`;
}

function sunlightDedicationsHTML(s){
 if(!usesCatDiscovery(s))return '';
 return `<section class="management-row" data-sunlight-dedications><h3>История «Золотое сияние»</h3><p>Принятые посвящения от разных домов · ${sunlightDedications(s).length} из 3.</p><p>${s.sunlightFeast?'Общий пир завершён.':s.sunlightMeal?'Трапеза трёх семей состоялась.':'Нужен общий пир или трапеза трёх семей в одном раздаточном дворе.'}</p><p>${s.sunlightService?'Служение жреца подтверждено.':'Ожидается работа вдохновлённого жреца.'}</p></section>`;
}

function abundanceDiscoveryHTML(s){
 const q=s.abundanceDiscovery;
 if(!q)return '';
 const status=q.homes.length===ABUNDANCE_HOMES?'Чудо открыто · 25 веры.':abundanceReserveReady(s)?'Защищённые семена и запас обычной еды на ужин готовы.':'Нужны защищённые семена и запас обычной еды на ужин.';
 return `<section class="management-row" data-abundance-discovery><h3>История «Изобилие»</h3><p>Дома с обычной едой · ${q.homes.length} из ${ABUNDANCE_HOMES}.</p><p>${status}</p>${q.homes.length<ABUNDANCE_HOMES?'<p>Последнюю раздачу завершает вдохновлённый носильщик, земледелец или признанный хранитель склада.</p>':''}</section>`;
}

function windDeliveryHTML(s){
 const q=s.windDelivery;
 if(!q)return '';
 const amount=Number(q.amount.toFixed(2)).toLocaleString('ru-RU');
 return `<section class="management-row" data-wind-delivery><h3>История «Попутный ветер»</h3><p>Принято из мастерских · ${amount} из ${WIND_DELIVERY_GOAL} · Мест назначения · ${q.destinations.length} из ${WIND_DESTINATION_GOAL}.</p><p>Засчитываются первые доставки вдохновлённых носильщиков.</p><p>${q.path?q.path.kind==='road'?'Доставка по улучшенной дороге подтверждена.':'Доставка по мосту подтверждена.':'Ожидается доставка по улучшенной дороге или готовому мосту.'}</p>${windKnowledgeReason(s)?'':'<p>Чудо открыто · 40 веры.</p>'}</section>`;
}

function shapingBatchesHTML(s){
 return (s.shapingBatches?.rows||[]).slice(-8).reverse().map(b=>{
  const transitClay=Math.max(0,60-b.remaining.clay-b.delivered.clay),transitReed=Math.max(0,40-b.remaining.reed-b.delivered.reed);
  return `<div data-shaping-batch="${b.id}"><h4>Партия №${b.id} · ${b.x}, ${b.y}${b.grounded?' · на земле':''}</h4><p>Остаток · ${number(b.remaining.clay)} глины и ${number(b.remaining.reed)} тростника. В пути · ${number(transitClay)} и ${number(transitReed)}. Доставлено · ${number(b.delivered.clay)} из 60 и ${number(b.delivered.reed)} из 40.</p></div>`;
 }).join('');
}

function inannaDiscoveryHTML(s){
 const record=s.inannaDiscovery;
 if(!record)return '';
 const guard=record.chased?'Сторож прогнал мышь.':`Дежурства у запаса · ${record.days.length} из ${INANNA_GUARD_DAYS} разных дней.`;
 const reason=miracleLockReason(s,'inannaProtection');
 const meeting=!inannaMeetingReason(s)?'<button type="button" data-city-inanna-meeting>Собрать встречу у порога</button>':'';
 return `<section class="management-row" data-inanna-discovery><h3>История «Покров Инанны»</h3><p>${guard}</p><p>${escape(reason||'Чудо открыто · 80 веры.')}</p>${meeting}</section>`;
}

function landMemoryHTML(s){
 if(s.landMemoryChapter!==1)return '';
 const labels={building:'Завершённая стройка',food:'Добытая еда',waterStory:'Переданный семейный рассказ о воде',memorial:'Семейная память'};
 const stories=landMemoryStories(s);
 const status=s.landRelicQuest?.phase==='completed'?'Печать земли хранится в храме.':s.landRelicQuest?.attempts?'Поиск Печати уже начинался.':
  landSearchReason(s)||'Истории сохранены. Поиск Печати доступен в карточке свободного жителя.';
 return `<section class="management-row" data-land-memory><h3>История «Память земли»</h3><p>Подтверждённые истории · ${Math.min(stories.length,LAND_STORIES_REQUIRED)} из ${LAND_STORIES_REQUIRED}.</p>${stories.map(row=>`<p>${labels[row.kind]} · ${escape(displayName(s,row.citizenId))}${row.place?` · ${focus(buildingKey(row.place),'Показать место')}`:''}${row.livingIds.length?` · Живые участники: ${row.livingIds.map(id=>escape(displayName(s,id))).join(', ')}`:''}</p>`).join('')}<p>${status}</p></section>`;
}

function depthSupplyHTML(s){
 const record=s.depthSupply;
 if(!record)return '';
 return `<section class="management-row" data-depth-supply><h3>История «Пробуждение глубин»</h3><p>Дома, получившие воду от рыбака или водоноса · ${record.homes.length} из ${DEPTH_HOMES_REQUIRED}.</p><p>${depthSearchReason(s)||'Условия истории выполнены. Поиск доступен в карточке свободного жителя.'}</p></section>`;
}

function starObservationsHTML(s){
 const journal=s.starObservations;
 if(!journal)return '';
 const harvest=journal.harvest?'Поле созрело к началу жатвы.':'Подготовь полностью засеянное поле к началу жатвы.';
 const detail=s.revelationEvidence?.opening?'Наблюдатель приходит к воде во дворе с 22:00 до 04:00.':'Сначала открой «Откровение».';
 const active=journal.forecast?.tick===s.tick,forecasts=active?starForecastView(s):[];
 const reading=active?`<div data-star-forecast><h4>Прогноз до смены сезона</h4>${forecasts.map(row=>`<p><b>${focus(row.key,row.title)}</b> · ${escape(row.reason)} ${escape(row.change)}</p>`).join('')||'<p>Для отмеченных мест сейчас нет риска.</p>'}</div>`:'';
 return `<section class="management-row" data-star-observations><h3>История «Мудрость звёзд»</h3><p>Ночи наблюдений · ${journal.nights.length} из ${STAR_NIGHTS_REQUIRED}.</p><p>${detail}</p><p>${harvest}</p>${reading}</section>`;
}

function arrivalHospitalityHTML(s){
 const view=arrivalHospitalityView(s);
 if(!view)return '';
 const beds=arrivalHousing(s).reduce((total,row)=>total+row.beds,0);
 const welcome=s.arrivalHospitality.welcomes?.at(-1);
 const house=welcome&&arrivalWelcomeHouse(s,welcome);
 const latest=house?`<p>${focus(welcome.home,`Последнее заселение · ${welcome.members.length} чел.`)}</p>`:welcome?'<p>Дом последнего заселения больше не существует.</p>':'';
 return `<section class="management-row" data-arrival-hospitality><h3>Гостеприимство для «Зова новых жителей»</h3><p>Завершённые гостевые визиты · ${Math.min(view.visits,view.needed)} из ${view.needed}.</p><p>Дома, принявшие семьи с другого берега · ${view.shelters} из ${view.needed}.</p><p>Свободные места в сухих домах · ${beds}.</p>${latest}</section>`;
}

function shapingProjectsHTML(s){
 const view=shapingProjectView(s);
 if(!view)return '';
 const model=s.shapingModel;
 const modelStatus=model?.completedAt!==undefined?`Макет готов · ${escape(buildingDefinition(s,model.type).name)}. Дар открыт.`:
  model?`Макет в работе · ${Math.floor(model.work/6*100)}%. Потрачено 2 глины${model.reed?' и 1 тростник':''}.`:
  'После пяти построек и открытия «Рук творца» мастер возьмёт 2 глины из доступного запаса. Если мастер умер, двое жителей добавят 1 тростник.';
 const master=view.masterId==null?'':` · ${escape(displayName(s,view.masterId)||`житель №${view.masterId+1}`)}`;
 return `<section class="management-row" data-shaping-projects><h3>Постройки для «Повеления глине»</h3><p>${Math.min(view.count,view.required)} из ${view.required} в деле${master}.</p><p>Кирпичный двор · ${view.brickyard?'в деле':'ожидается'}. Общественная постройка · ${view.publicService?'в деле':'ожидается'}.</p><p>${modelStatus}</p>${shapingBatchesHTML(s)}</section>`;
}

function creatorMaterialsHTML(s){
 const progress=creatorMaterialsView(s);
 if(!progress)return '';
 const show=n=>Number(n.toFixed(2)).toLocaleString('ru-RU');
 return `<section class="management-row" data-creator-materials><h3>История «Руки творца»</h3><p>Доставлено местной глины · ${show(progress.clay)} из ${progress.required.clay} · Тростника · ${show(progress.reed)} из ${progress.required.reed}.</p><p>Постройки в деле · ${progress.projects} из ${progress.projectsRequired} · Вдохновлённые специальности · ${progress.inspired} из ${progress.inspiredRequired}.</p>${progress.qualified?'<p>Чудо открыто · 30 веры.</p>':''}${progress.dedication?'<p>Первый кирпич сохранён как посвящение.</p>':progress.qualified?'<p>Один кирпич из следующей высохшей партии останется как посвящение.</p>':''}</section>`;
}

/** HTML-only entry point for snapshots/tests. No listeners or simulation changes. */
export function cityToolsHTML(s,{tab='districts',filter={},page=0,group=null,model=cityDiagnostics(s),desiredInspirations=new Map(),expandedBuildings=new Set(),expandedCitizens=new Set(),testOptions={}}={}){
 const total=model.totals;
 return `<section class="city-tools" aria-label="Обзор города"><header class="city-tools-heading"><div><span class="city-tools-eyebrow">Город в деталях</span><h2>Жизнь кварталов</h2></div><span class="city-tools-clock">${String(Math.floor(model.hour)).padStart(2,'0')}:${String(Math.floor(model.hour%1*60)).padStart(2,'0')} · ${model.isDay?'День':'Ночь'}</span></header><div class="city-tools-summary"><span><b>${total.population}</b> жителей</span><span><b>${total.workers}</b> на службе</span><span><b>${total.carrying}</b> с грузом</span><span class="${total.hungry||total.ill?'is-warning':''}"><b>${total.hungry+total.ill>0?new Set([...filterCitizens(s,{trouble:'hunger'}),...filterCitizens(s,{trouble:'health'})].map(c=>c.id)).size:0}</b> нужна помощь</span></div><nav class="city-tools-tabs" aria-label="Разделы обзора">${[['districts','Кварталы'],['citizens','Жители'],['workshops','Работа'],['testing','Тестирование']].map(([id,text])=>`<button type="button" data-city-tab="${id}" aria-pressed="${tab===id||tab==='homes'&&id==='districts'}">${text}</button>`).join('')}</nav><div class="city-tools-content">${tab==='testing'?renderTestTools(s,testOptions):tab==='citizens'?citizensHTML(s,model,filter,page,desiredInspirations,expandedCitizens):tab==='workshops'?workshopsHTML(s,model,expandedBuildings):tab==='homes'?homesHTML(model,group):fireForecastHTML(s)+blessingProgressHTML(s)+peaceProgressHTML(s)+earthProgressHTML(s)+richCatchProgressHTML(s)+creatorMaterialsHTML(s)+shapingProjectsHTML(s)+arrivalHospitalityHTML(s)+starObservationsHTML(s)+depthSupplyHTML(s)+landMemoryHTML(s)+inannaDiscoveryHTML(s)+windDeliveryHTML(s)+abundanceDiscoveryHTML(s)+sunlightDedicationsHTML(s)+revelationEvidenceHTML(s)+housingPolicyHTML(s)+neighborhoodsHTML(model)}</div><footer class="city-tools-legend">Еда склада — без семян · Грузы не прибавлены к запасам · Вода — в домашних сосудах</footer></section>`;
}

/** Mount in an existing panel root. Refresh on the app's throttled UI tick.
 * Navigation and explicit management actions are delegated to optional callbacks.
 * Rendering, filters and desired inspiration choices never change saved state. */
export function renderCityTools(root,s,options={}){
 let ctl=controllers.get(root);
 if(!ctl){
  ctl={s,options,tab:'districts',filter:{role:'all',age:'all',trouble:'all'},page:0,group:null,desiredInspirations:new Map(),expandedBuildings:new Set(),expandedCitizens:new Set(),testOptions:{}};controllers.set(root,ctl);
  ctl.draw=()=>{const active=root.ownerDocument?.activeElement,inside=active&&root.contains(active),attributes=['data-city-filter','data-city-role','data-city-inspiration','data-city-assign','data-city-citizen'],attribute=inside?attributes.find(k=>active.hasAttribute?.(k)):null,value=attribute?active.getAttribute(attribute):null,summary=inside&&active.matches?.('summary')?{attribute:active.parentElement?.dataset.cityPersonDisclosure!==undefined?'data-city-person-disclosure':'data-city-disclosure',value:active.parentElement?.dataset.cityPersonDisclosure??active.parentElement?.dataset.cityDisclosure}:null;const changed=setHTML(root,cityToolsHTML(ctl.s,{tab:ctl.tab,filter:ctl.filter,page:ctl.page,group:ctl.group,model:ctl.model,desiredInspirations:ctl.desiredInspirations,expandedBuildings:ctl.expandedBuildings,expandedCitizens:ctl.expandedCitizens,testOptions:{...ctl.testOptions,audioStatus:ctl.options.audioStatus,mapUpgrade:ctl.options.mapUpgrade}}));if(changed&&attribute){[...(root.querySelectorAll?.(`[${attribute}]`)||[])].find(e=>e.getAttribute(attribute)===value)?.focus({preventScroll:true});}else if(changed&&summary){[...(root.querySelectorAll?.(`details[${summary.attribute}]`)||[])].find(d=>(d.getAttribute?.(summary.attribute)??d.dataset?.[summary.attribute==='data-city-person-disclosure'?'cityPersonDisclosure':'cityDisclosure'])===summary.value)?.querySelector('summary')?.focus({preventScroll:true});}return changed;};
  ctl.refresh=()=>{ctl.model=cityDiagnostics(ctl.s);ctl.draw();};
  root.addEventListener('toggle',event=>{const d=event.target;if(!root.contains(d))return;const person=d.dataset?.cityPersonDisclosure,key=person===undefined?d.dataset?.cityDisclosure:Number(person),expanded=person===undefined?ctl.expandedBuildings:ctl.expandedCitizens;if(key===undefined)return;if(d.open)expanded.add(key);else expanded.delete(key);},true);
  root.addEventListener('change',event=>{
   const field=event.target.closest?.('select,input');if(!field||!root.contains(field))return;
   if(field.hasAttribute('data-city-auto-housing')){ctl.options.onAutoHousing?.(field.checked);field.blur?.();ctl.refresh();return;}
   const testField=['event','resource','building','citizen','count'].find(k=>field.hasAttribute?.(`data-test-${k}`));if(testField){ctl.testOptions[testField]=testField==='count'?Number(field.value):field.value;return;}
   if(field.dataset.cityFilter!==undefined){ctl.filter={...ctl.filter,[field.dataset.cityFilter]:field.value};ctl.page=0;ctl.draw();return;}
   if(field.dataset.cityInspiration!==undefined){ctl.desiredInspirations.set(Number(field.dataset.cityInspiration),field.value);field.blur?.();ctl.draw();return;}
   field.blur?.();
   if(field.dataset.cityRole!==undefined)ctl.options.onRole?.(Number(field.dataset.cityRole),field.value);
   else if(field.dataset.cityAssign!==undefined&&field.value!=='')ctl.options.onAssign?.(Number(field.value),field.dataset.cityAssign);
   else return;
   ctl.refresh();
  });
  root.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||!root.contains(button))return;
   if(button.dataset.testAction!==undefined){const data={...ctl.testOptions};for(const k of ['event','resource','building','citizen','count']){const input=root.querySelector(`[data-test-${k}]`);if(input)data[k]=k==='count'?Number(input.value):input.value;}ctl.options.onTestAction?.(button.dataset.testAction,data);ctl.refresh();return;}
   if(button.dataset.cityFireEvacuate!==undefined){ctl.options.onFireEvacuate?.(button.dataset.kiln,button.dataset.cityFireEvacuate);ctl.refresh();return;}
   if(button.dataset.cityExtinguishKiln!==undefined){ctl.options.onKilnExtinguish?.(button.dataset.cityExtinguishKiln);ctl.refresh();return;}
   if(button.dataset.cityBankKiln!==undefined||button.dataset.cityResumeKiln!==undefined){ctl.options.onKilnBank?.(button.dataset.cityBankKiln??button.dataset.cityResumeKiln,button.dataset.cityBankKiln!==undefined);ctl.refresh();return;}
   if(button.hasAttribute('data-city-repair')){ctl.options.onRepair?.();ctl.refresh();return;}
   if(button.hasAttribute('data-city-unload')){ctl.options.onUnload?.();ctl.refresh();return;}
   if(button.hasAttribute('data-city-harvest')){ctl.options.onHarvest?.();ctl.refresh();return;}
   if(button.dataset.cityInannaMeeting!==undefined){ctl.options.onInannaMeeting?.();return;}
   if(button.dataset.cityFocus!==undefined){ctl.options.onFocus?.(button.dataset.cityFocus);return;}
   if(button.dataset.cityCitizen!==undefined){ctl.options.onCitizen?.(Number(button.dataset.cityCitizen));return;}
   if(button.dataset.cityInspire!==undefined){const id=Number(button.dataset.cityInspire),c=ctl.s.citizens.find(c=>c.id===id);if(c){const desired=selectedProfession(c,ctl.desiredInspirations.get(id));ctl.options.onInspire?.(id,desired==='auto'?'builder':desired);ctl.refresh();}return;}
   if(button.dataset.cityRelease!==undefined){ctl.options.onRelease?.(Number(button.dataset.cityRelease));ctl.refresh();return;}
   if(button.dataset.cityTab!==undefined){ctl.tab=button.dataset.cityTab;ctl.page=0;}
   else if(button.dataset.cityHomes!==undefined){ctl.tab='homes';ctl.group=button.dataset.cityHomes;}
   else if(button.dataset.cityHome!==undefined){ctl.tab='citizens';ctl.filter.home=button.dataset.cityHome;ctl.page=0;}
   else if(button.hasAttribute('data-city-clear-home')){delete ctl.filter.home;ctl.page=0;}
   else if(button.dataset.cityPage!==undefined)ctl.page=Math.max(0,Number(button.dataset.cityPage)||0);
   else return;
   ctl.draw();
  });
 }
 ctl.s=s;ctl.options=options;ctl.model=cityDiagnostics(s);if(options.tab)ctl.tab=options.tab;if(options.filter)ctl.filter={...ctl.filter,...options.filter};if(options.group!==undefined)ctl.group=options.group;ctl.draw();return ctl.model;
}
