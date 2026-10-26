import {PROFESSION_NAMES,PROFESSION_IDS,professionRole,professionMatchesTask,staffingCandidates} from './professions.js';
import {cityDiagnostics,filterCitizens,CITY_ROLE_NAMES} from './city-diagnostics.js';
import {BUILDINGS} from './definitions.js';
import {displayName} from './citizen-epithets.js';
import {citizenEpithetHTML} from './ui-citizen-epithets.js';
import {setHTML} from './ui-render.js';
import {ROLES,inspirationChance} from './education.js';
import {inspirationReason} from './management.js';
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
 return `<p class="city-tools-note">Дома сгруппированы у ближайшего склада на доступном берегу. Еда в доме, на складе и в пути показана раздельно.</p><div class="city-tools-list city-tools-card-grid">${model.neighborhoods.map(n=>`<article class="city-tools-row"><div class="city-tools-row-head">${focus(n.focus,n.label)}${tag(`${n.population} жителей`)}</div><div class="city-tools-metrics"><span>Склад <b>${number(n.food)}</b> еды</span><span>Дома <b>${number(n.homeFood)}</b></span><span>В пути <b>${number(n.foodInTransit)}</b></span><span>Вода <b>${number(n.water)}</b> / ${number(n.waterDemand)} в день</span><span>Работают <b>${n.workers}</b> · с грузом <b>${n.cargo}</b></span></div>${n.reasons.length?`<div class="city-tools-reasons">${n.reasons.map(r=>focus(r.target,r.label,'is-warning')).join('')}</div>`:tag(n.population?'Дома обеспечены':'Склад без соседних семей')}${n.troubled?`<button type="button" class="city-tools-households" data-city-homes="${escape(n.key)}">Проблемные дома · ${n.troubled} →</button>`:''}</article>`).join('')||empty('Построй первый дом и склад.')}</div>`;
}
function optionsHTML(options,value){return options.map(([id,text])=>`<option value="${escape(id)}"${value===id?' selected':''}>${escape(text)}</option>`).join('');}
function personControls(s,c,desired){
 const profession=selectedProfession(c,desired),inspiration=PROFESSION_IDS.includes(profession)&&profession!=='auto'?profession:'builder',reason=inspirationReason(s,c.id,inspiration),adult=(c.age??20)>=16,chance=Math.round(inspirationChance(c,inspiration)*100);
 return `<div class="city-tools-person-controls"><label class="city-tools-field"><span>Профессия</span><select data-city-role="${c.id}" aria-label="Профессия: ${escape(displayName(s,c))}"${adult?'':' disabled'}>${optionsHTML(ROLES.map(id=>[id,PROFESSION_NAMES[id]]),c.pendingRole||c.role||'auto')}</select></label><div class="city-tools-inspiration"><label class="city-tools-field"><span>Вдохновение</span><select data-city-inspiration="${c.id}" aria-label="Вдохновение: ${escape(displayName(s,c))}">${optionsHTML(PROFESSION_IDS.filter(id=>id!=='auto').map(id=>[id,PROFESSION_NAMES[id]]),inspiration)}</select></label><button type="button" class="city-tools-inspire" data-city-inspire="${c.id}"${reason?' disabled':''} title="${escape(reason||`${chance}% успеха; 1 вера расходуется при любом исходе`)}">${resourceIcon('faith')}Вдохновить · 1 вера</button><small>Шанс ${chance}%${reason?` · ${escape(reason)}`:''}</small></div></div>${c.pendingRole?`<small class="city-tools-pending">${escape(PROFESSION_NAMES[c.pendingRole]||c.pendingRole)} — после доставки груза</small>`:''}${!adult?'<small class="city-tools-pending">Работа с 16 лет. Вдохновение сохранится до взросления.</small>':''}`;
}
function citizensHTML(s,model,filter,page,desiredInspirations){
 const people=filterCitizens(s,filter),pages=Math.max(1,Math.ceil(people.length/PAGE_SIZE)),current=Math.min(page,pages-1),roles=[...new Set(['auto','production','carrier','builder','healer','tailor','watercarrier',...(s.citizens||[]).map(c=>professionRole(c.calling)===c.role?c.calling:c.role||'auto')])];
 return `<div class="city-tools-filters">${select('role','Профессия',filter.role||'all',[['all','Все профессии'],...roles.map(r=>[r,CITY_ROLE_NAMES[r]||r])])}${select('age','Возраст',filter.age||'all',[['all','Все возрасты'],['adult','Взрослые · 16+'],['child','Дети · до 16']])}${select('trouble','Состояние',filter.trouble||'all',[['all','Все жители'],['hunger','Недоедание'],['health','Здоровье ниже 60%'],['family','Семье нужна помощь']])}</div>${filter.home?`<div class="city-tools-note">Дом ${escape(filter.home)} <button type="button" class="city-tools-link" data-city-clear-home>Все дома</button></div>`:''}<div class="city-tools-count">Найдено: ${people.length} · ${current*PAGE_SIZE+Number(people.length>0)}–${Math.min((current+1)*PAGE_SIZE,people.length)}</div><div class="city-tools-list city-tools-card-grid">${people.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE).map(c=>`<article class="city-tools-row city-tools-person"><div class="city-tools-person-heading"><div><button type="button" class="city-tools-name" data-city-citizen="${c.id}">${escape(displayName(s,c))}</button><span class="city-tools-person-info">${escape(PROFESSION_NAMES[professionRole(c.calling)===c.role?c.calling:c.role||'auto']||c.role)} · ${Math.floor(c.age??20)} лет${c.calling&&c.calling!=='auto'?` · призвание: ${escape(PROFESSION_NAMES[c.calling]||c.calling)}`:''}</span></div><div class="city-tools-person-actions">${focus(c.home,'Дом')}${focus(c.workplace||c.work||c.site||c.guardPost,c.site?'Стройка':'Работа')}</div></div><div class="city-tools-metrics"><span class="${c.hunger>=30?'is-warning':''}">Голод ${number(c.hunger)}%</span><span class="${c.health<60?'is-warning':''}">Здоровье ${number(c.health??100)}%</span></div>${citizenEpithetHTML(s,c)}${personControls(s,c,desiredInspirations.get(c.id))}</article>`).join('')||empty('По этим фильтрам жителей нет.')}</div>${pages>1?`<nav class="city-tools-pagination" aria-label="Страницы жителей"><button type="button" data-city-page="${current-1}"${current===0?' disabled':''}>← Назад</button><span>${current+1} / ${pages}</span><button type="button" data-city-page="${current+1}"${current===pages-1?' disabled':''}>Дальше →</button></nav>`:''}`;
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
function workshopsHTML(s,model,expanded){
 const buildings=new Map(s.buildings.map(b=>[b.id||`${b.x},${b.y}`,b])),groups=new Map();
 for(const w of model.workshops){if(!groups.has(w.type))groups.set(w.type,[]);groups.get(w.type).push(w);}
 return `<p class="city-tools-note">Одинаковые здания собраны вместе, новые — первыми. Раскрой строку для назначения, запасов и выпуска. Цвет показывает занятые места. Ночью люди отдыхают; сушка и обжиг продолжаются.</p><div class="city-tools-staffing-legend"><span data-staffing="empty">Нет людей</span><span data-staffing="partial">Не хватает</span><span data-staffing="full">Места заняты</span><span data-staffing="matched">По призванию</span></div><div class="city-tools-workshop-groups city-tools-card-grid">${[...groups].map(([type,items])=>`<section class="city-tools-workshop-group" aria-label="${escape(BUILDINGS[type]?.name||type)}" data-city-building-group="${escape(type)}">${items.sort((a,b)=>compareBuildingsNewest(buildings.get(a.key),buildings.get(b.key))).map(w=>workshopCard(s,w,buildings.get(w.key),expanded)).join('')}</section>`).join('')||empty('Пока нет рабочих построек.')}</div>`;
}
function homesHTML(model,group){const keys=new Set(model.neighborhoods.find(n=>n.key===group)?.homeKeys||[]);return `<button type="button" class="city-tools-link" data-city-tab="districts">← Все кварталы</button><div class="city-tools-list city-tools-card-grid">${model.homes.filter(h=>keys.has(h.key)&&h.reasons.length).map(h=>`<article class="city-tools-row"><div class="city-tools-row-head"><div class="city-tools-building-name">${uiIcon('house')}${focus(h.key,`Дом · ${h.x}, ${h.y}`)}</div><button type="button" class="city-tools-link" data-city-home="${escape(h.key)}">Жители · ${h.population}</button></div><div class="city-tools-metrics"><span>Еда ${number(h.food)} / ${number(h.demand)} на ужин</span><span>Вода ${number(h.water)} / ${number(h.waterDemand)} в день</span></div><div class="city-tools-reasons">${h.reasons.map(r=>tag(r.label,true)).join('')}</div>${buildingInventoryHTML(h.inventory,{house:true})}</article>`).join('')||empty('Сейчас все семьи этого квартала обеспечены.')}</div>`;}

/** HTML-only entry point for snapshots/tests. No listeners or simulation changes. */
export function cityToolsHTML(s,{tab='districts',filter={},page=0,group=null,model=cityDiagnostics(s),desiredInspirations=new Map(),expandedBuildings=new Set()}={}){
 const total=model.totals;
 return `<section class="city-tools" aria-label="Обзор города"><header class="city-tools-heading"><div><span class="city-tools-eyebrow">Город в деталях</span><h2>Жизнь кварталов</h2></div><span class="city-tools-clock">${String(Math.floor(model.hour)).padStart(2,'0')}:${String(Math.floor(model.hour%1*60)).padStart(2,'0')} · ${model.isDay?'День':'Ночь'}</span></header><div class="city-tools-summary"><span><b>${total.population}</b> жителей</span><span><b>${total.workers}</b> на службе</span><span><b>${total.carrying}</b> с грузом</span><span class="${total.hungry||total.ill?'is-warning':''}"><b>${total.hungry+total.ill>0?new Set([...filterCitizens(s,{trouble:'hunger'}),...filterCitizens(s,{trouble:'health'})].map(c=>c.id)).size:0}</b> нужна помощь</span></div><nav class="city-tools-tabs" aria-label="Разделы обзора">${[['districts','Кварталы'],['citizens','Жители'],['workshops','Работа']].map(([id,text])=>`<button type="button" data-city-tab="${id}" aria-pressed="${tab===id||tab==='homes'&&id==='districts'}">${text}</button>`).join('')}</nav><div class="city-tools-content">${tab==='citizens'?citizensHTML(s,model,filter,page,desiredInspirations):tab==='workshops'?workshopsHTML(s,model,expandedBuildings):tab==='homes'?homesHTML(model,group):neighborhoodsHTML(model)}</div><footer class="city-tools-legend">Еда склада — без семян · Грузы не прибавлены к запасам · Вода — в домашних сосудах</footer></section>`;
}

/** Mount in an existing panel root. Refresh on the app's throttled UI tick.
 * Navigation and explicit management actions are delegated to optional callbacks.
 * Rendering, filters and desired inspiration choices never change saved state. */
export function renderCityTools(root,s,options={}){
 let ctl=controllers.get(root);
 if(!ctl){
  ctl={s,options,tab:'districts',filter:{role:'all',age:'all',trouble:'all'},page:0,group:null,desiredInspirations:new Map(),expandedBuildings:new Set()};controllers.set(root,ctl);
  ctl.draw=()=>{const active=root.ownerDocument?.activeElement,key=root.contains(active)&&active?.matches?.('summary')?active.parentElement?.dataset.cityDisclosure:undefined;const changed=setHTML(root,cityToolsHTML(ctl.s,{tab:ctl.tab,filter:ctl.filter,page:ctl.page,group:ctl.group,model:ctl.model,desiredInspirations:ctl.desiredInspirations,expandedBuildings:ctl.expandedBuildings}));if(changed&&key!==undefined){const summary=[...(root.querySelectorAll?.('details[data-city-disclosure]')||[])].find(d=>d.dataset.cityDisclosure===key)?.querySelector('summary');summary?.focus({preventScroll:true});}return changed;};
  ctl.refresh=()=>{ctl.model=cityDiagnostics(ctl.s);ctl.draw();};
  root.addEventListener('toggle',event=>{const d=event.target,key=d.dataset?.cityDisclosure;if(key===undefined||!root.contains(d))return;if(d.open)ctl.expandedBuildings.add(key);else ctl.expandedBuildings.delete(key);},true);
  root.addEventListener('change',event=>{
   const field=event.target.closest?.('select');if(!field||!root.contains(field))return;
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
