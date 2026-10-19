import {cityDiagnostics,filterCitizens,CITY_ROLE_NAMES} from './city-diagnostics.js';
import {citizenName} from './definitions.js';
import {setHTML} from './ui-render.js';

const controllers=new WeakMap(),PAGE_SIZE=24;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=n=>new Intl.NumberFormat('ru',{maximumFractionDigits:1}).format(n||0);
const focus=(key,text,extra='')=>key?`<button type="button" class="city-tools-link ${extra}" data-city-focus="${escape(key)}">${escape(text)}</button>`:`<span>${escape(text)}</span>`;
const tag=(text,warn=false)=>`<span class="city-tools-tag${warn?' is-warning':''}">${escape(text)}</span>`;
function select(name,label,value,options){return `<label class="city-tools-field"><span>${label}</span><select data-city-filter="${name}" aria-label="${label}">${options.map(([id,text])=>`<option value="${escape(id)}"${value===id?' selected':''}>${escape(text)}</option>`).join('')}</select></label>`;}
const empty=text=>`<p class="city-tools-empty">${escape(text)}</p>`;
function neighborhoodsHTML(model){
 return `<p class="city-tools-note">Дома сгруппированы у ближайшего склада на доступном берегу. Еда в доме, на складе и в пути показана раздельно.</p><div class="city-tools-list">${model.neighborhoods.map(n=>`<article class="city-tools-row"><div class="city-tools-row-head">${focus(n.focus,n.label)}${tag(`${n.population} жителей`)}</div><div class="city-tools-metrics"><span>Склад <b>${number(n.food)}</b> еды</span><span>Дома <b>${number(n.homeFood)}</b></span><span>В пути <b>${number(n.foodInTransit)}</b></span><span>Вода <b>${number(n.water)}</b> / ${number(n.waterDemand)} в день</span><span>Работают <b>${n.workers}</b> · с грузом <b>${n.cargo}</b></span></div>${n.reasons.length?`<div class="city-tools-reasons">${n.reasons.map(r=>focus(r.target,r.label,'is-warning')).join('')}</div>`:tag(n.population?'Дома обеспечены':'Склад без соседних семей')}${n.troubled?`<button type="button" class="city-tools-households" data-city-homes="${escape(n.key)}">Проблемные дома · ${n.troubled} →</button>`:''}</article>`).join('')||empty('Построй первый дом и склад.')}</div>`;
}
function citizensHTML(s,model,filter,page){
 const people=filterCitizens(s,filter),pages=Math.max(1,Math.ceil(people.length/PAGE_SIZE)),current=Math.min(page,pages-1),roles=[...new Set(['auto','production','carrier','builder','healer','tailor','watercarrier',...(s.citizens||[]).map(c=>c.role||'auto')])];
 return `<div class="city-tools-filters">${select('role','Профессия',filter.role||'all',[['all','Все профессии'],...roles.map(r=>[r,CITY_ROLE_NAMES[r]||r])])}${select('age','Возраст',filter.age||'all',[['all','Все возрасты'],['adult','Взрослые · 16+'],['child','Дети · до 16']])}${select('trouble','Состояние',filter.trouble||'all',[['all','Все жители'],['hunger','Недоедание'],['health','Здоровье ниже 60%'],['family','Семье нужна помощь']])}</div>${filter.home?`<div class="city-tools-note">Дом ${escape(filter.home)} <button type="button" class="city-tools-link" data-city-clear-home>Все дома</button></div>`:''}<div class="city-tools-count">Найдено: ${people.length} · ${current*PAGE_SIZE+Number(people.length>0)}–${Math.min((current+1)*PAGE_SIZE,people.length)}</div><div class="city-tools-list">${people.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE).map(c=>`<article class="city-tools-row city-tools-person"><div><button type="button" class="city-tools-name" data-city-citizen="${c.id}">${escape(citizenName(c.id))}</button><span class="city-tools-person-info">${escape(CITY_ROLE_NAMES[c.role||'auto']||c.role)} · ${Math.floor(c.age??20)} лет</span><div class="city-tools-metrics"><span class="${c.hunger>=30?'is-warning':''}">Голод ${number(c.hunger)}%</span><span class="${c.health<60?'is-warning':''}">Здоровье ${number(c.health??100)}%</span></div></div><div class="city-tools-person-actions">${focus(c.home,'Дом')}${focus(c.workplace||c.work||c.site||c.guardPost,c.site?'Стройка':'Работа')}</div></article>`).join('')||empty('По этим фильтрам жителей нет.')}</div>${pages>1?`<nav class="city-tools-pagination" aria-label="Страницы жителей"><button type="button" data-city-page="${current-1}"${current===0?' disabled':''}>← Назад</button><span>${current+1} / ${pages}</span><button type="button" data-city-page="${current+1}"${current===pages-1?' disabled':''}>Дальше →</button></nav>`:''}`;
}
function workshopsHTML(model){return `<p class="city-tools-note">Причина показана по текущему назначению и местным запасам. Ночью люди отдыхают; сушка и обжиг продолжаются.</p><div class="city-tools-list">${model.workshops.map(w=>`<article class="city-tools-row"><div class="city-tools-row-head">${focus(w.key,w.name)}${tag(w.reason.code==='construction'?`строителей: ${w.builders.length} · носильщиков: ${w.carriers.length}`:`${w.workers.length} работников`)}</div><div class="city-tools-production ${w.status==='attention'?'is-warning':''}">${focus(w.reason.target,w.reason.label)}<span>${escape(w.reason.detail)}</span></div></article>`).join('')||empty('Пока нет рабочих построек.')}</div>`;}
function homesHTML(model,group){const keys=new Set(model.neighborhoods.find(n=>n.key===group)?.homeKeys||[]);return `<button type="button" class="city-tools-link" data-city-tab="districts">← Все кварталы</button><div class="city-tools-list">${model.homes.filter(h=>keys.has(h.key)&&h.reasons.length).map(h=>`<article class="city-tools-row"><div class="city-tools-row-head">${focus(h.key,`Дом · ${h.x}, ${h.y}`)}<button type="button" class="city-tools-link" data-city-home="${escape(h.key)}">Жители · ${h.population}</button></div><div class="city-tools-metrics"><span>Еда ${number(h.food)} / ${number(h.demand)} на ужин</span><span>Вода ${number(h.water)} / ${number(h.waterDemand)} в день</span></div><div class="city-tools-reasons">${h.reasons.map(r=>tag(r.label,true)).join('')}</div></article>`).join('')||empty('Сейчас все семьи этого квартала обеспечены.')}</div>`;}

/** HTML-only entry point for snapshots/tests. No listeners or simulation changes. */
export function cityToolsHTML(s,{tab='districts',filter={},page=0,group=null,model=cityDiagnostics(s)}={}){
 const total=model.totals;
 return `<section class="city-tools" aria-label="Обзор города"><header class="city-tools-heading"><div><span class="city-tools-eyebrow">Город в деталях</span><h2>Жизнь кварталов</h2></div><span class="city-tools-clock">${String(Math.floor(model.hour)).padStart(2,'0')}:${String(Math.floor(model.hour%1*60)).padStart(2,'0')} · ${model.isDay?'День':'Ночь'}</span></header><div class="city-tools-summary"><span><b>${total.population}</b> жителей</span><span><b>${total.workers}</b> на службе</span><span><b>${total.carrying}</b> с грузом</span><span class="${total.hungry||total.ill?'is-warning':''}"><b>${total.hungry+total.ill>0?new Set([...filterCitizens(s,{trouble:'hunger'}),...filterCitizens(s,{trouble:'health'})].map(c=>c.id)).size:0}</b> нужна помощь</span></div><nav class="city-tools-tabs" aria-label="Разделы обзора">${[['districts','Кварталы'],['citizens','Жители'],['workshops','Работа']].map(([id,text])=>`<button type="button" data-city-tab="${id}" aria-pressed="${tab===id||tab==='homes'&&id==='districts'}">${text}</button>`).join('')}</nav><div class="city-tools-content">${tab==='citizens'?citizensHTML(s,model,filter,page):tab==='workshops'?workshopsHTML(model):tab==='homes'?homesHTML(model,group):neighborhoodsHTML(model)}</div><footer class="city-tools-legend">Еда склада — без семян · Грузы не прибавлены к запасам · Вода — в домашних сосудах</footer></section>`;
}

/** Mount in an existing panel root. Refresh on the app's throttled UI tick.
 * onFocus(buildingKey), onCitizen(stableId) are optional callbacks.
 * Callbacks navigate only; this module never changes saved simulation state. */
export function renderCityTools(root,s,options={}){
 let ctl=controllers.get(root);
 if(!ctl){
  ctl={s,options,tab:'districts',filter:{role:'all',age:'all',trouble:'all'},page:0,group:null};controllers.set(root,ctl);
  ctl.draw=()=>setHTML(root,cityToolsHTML(ctl.s,{tab:ctl.tab,filter:ctl.filter,page:ctl.page,group:ctl.group,model:ctl.model}));
  root.addEventListener('change',event=>{const field=event.target.closest?.('[data-city-filter]');if(!field||!root.contains(field))return;ctl.filter={...ctl.filter,[field.dataset.cityFilter]:field.value};ctl.page=0;ctl.draw();});
  root.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||!root.contains(button))return;
   if(button.dataset.cityFocus!==undefined){ctl.options.onFocus?.(button.dataset.cityFocus);return;}
   if(button.dataset.cityCitizen!==undefined){ctl.options.onCitizen?.(Number(button.dataset.cityCitizen));return;}
   if(button.dataset.cityTab!==undefined){ctl.tab=button.dataset.cityTab;ctl.page=0;}
   else if(button.dataset.cityHomes!==undefined){ctl.tab='homes';ctl.group=button.dataset.cityHomes;}
   else if(button.dataset.cityHome!==undefined){ctl.tab='citizens';ctl.filter.home=button.dataset.cityHome;ctl.page=0;}
   else if(button.hasAttribute('data-city-clear-home')){delete ctl.filter.home;ctl.page=0;}
   else if(button.dataset.cityPage!==undefined)ctl.page=Math.max(0,Number(button.dataset.cityPage)||0);
   else return;
   ctl.draw();
  });
 }
 ctl.s=s;ctl.options=options;ctl.model=cityDiagnostics(s);if(options.tab)ctl.tab=options.tab;if(options.filter)ctl.filter={...ctl.filter,...options.filter};ctl.draw();return ctl.model;
}
