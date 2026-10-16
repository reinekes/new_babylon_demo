import {upgradeRoad,roadUpgradeCost} from './roads.js';
import {weatherAt} from './environment.js';
import {setPriority,inspireCitizen,cancelConstruction,demolish,cancellationRefund,demolitionRefund,canDemolish} from './management.js';
import {resourceIcon} from './resource-icons.js';
import {constructionProgress,orderedSites} from './construction.js';
import {createGame,BUILDINGS,MIRACLES,SEASONS,build,advanceTime,advanceSeason,miracle,resolveEvent,eventReason,encode,decode,terrain,count,storage,workers,goals,upgrade,upgradeCost,canUpgrade,buildingAt,yieldSummary} from './engine.js';
import {Renderer} from './renderer.js';
import {workforceStats,visibleCitizens,isWorkday} from './workforce.js';
import {RESOURCE_NAMES,MATERIALS,buildingKey,levelOf} from './definitions.js';
import {DIVINE_NAMES,DOMAIN_NAMES} from './divinity.js';
import {DAY_SECONDS,lightingAt} from './city-life.js';

const $=id=>document.getElementById(id),key='new-babylon-v1';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rounded=n=>Number(n.toFixed(n<10?1:0));
const resourceText=cargo=>Object.entries(cargo).filter(([,v])=>v>.001).map(([k,v])=>`${rounded(v)} ${RESOURCE_NAMES[k]}`).join(' · ')||'пусто';
const citizenName=id=>['Амал','Нин-Ая','Илду','Энлил','Шуба','Тари','Ишме','Нанна','Лугаль','Сила','Уту','Белет'][id%12]+(id>=12?` ${Math.floor(id/12)+1}`:'');
let inspectedPerson=null,roadMode=false;
const desiredRoles=new Map();
const entityAt=(x,y)=>state.buildings.find(b=>b.x===x&&b.y===y)||(state.roads||[]).find(b=>b.x===x&&b.y===y);
const entityName=b=>b.type==='road'?'Участок дороги':BUILDINGS[b.type].name;
let state=createGame(),loaded=false,storageOK=true,corrupt=false,legacyRaw=null;
try{const raw=localStorage.getItem(key);if(raw){const saved=decode(raw);if(saved){state=saved;loaded=true;if(JSON.parse(raw).version<3)legacyRaw=raw;}else corrupt=true;}}catch{storageOK=false;}
let paused=true,speed=1,last=performance.now(),selection=null,inspected=null,toastTimer,modalKind=null,lastUI=0,lastSave=0,newsSignature='';
const dialog=$('dialog');
const renderer=new Renderer($('city'),tile=>{
 if(dialog.open)return;
 if(selection){const result=build(state,selection,tile.x,tile.y);if(result.ok){toast(`${BUILDINGS[selection].name}: стройплощадка заложена`);save();update();checkDialogs();}else toast(result.reason);return;}
 const b=buildingAt(state,tile.x,tile.y);
 if(b){inspected={x:b.x,y:b.y};detail(b.type,false,b);return;}
 const person=visibleCitizens(state).find(c=>Math.abs(c.x-tile.x)+Math.abs(c.y-tile.y)<1);
 if(person){personDetail(person);return;}
 inspected=null;$('tile-detail').hidden=true;
 toast(terrain(tile.x,tile.y,state)==='water'?'Вода: рыбачить можно с сухого берега. Мост строится только через реку.':terrain(tile.x,tile.y,state)==='fertile'?'Плодородная земля — здесь можно посадить ячмень.':'Сухая земля — подходит для домов, мастерских и храмов.');
});
function toast(text){$('toast').textContent=text;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3500);}
function save(){
 try{if(legacyRaw){localStorage.setItem('new-babylon-backup-before-valley',legacyRaw);legacyRaw=null;}localStorage.setItem(key,encode(state));storageOK=true;$('save-status').textContent='●  Сохранено';$('save-status').title='Город, жители и грузы сохранены в этом браузере';}
 catch{if(storageOK)toast('Браузер не разрешает сохранение. Игра продолжится до закрытия вкладки.');storageOK=false;$('save-status').textContent='○  Без сохранения';}
}
const roles={auto:'Авто',builder:'Строитель',carrier:'Носильщик',production:'Производство'};
const phases={home:'Дома',toWork:'Идёт на работу',working:'Собирает ресурс',toStore:'Несёт груз на склад',returnWork:'Возвращается к работе',toHome:'Возвращается домой',blocked:'Нет доступного пути',toSupply:'Идёт за материалами',toSite:'Идёт на стройку',constructing:'Возводит здание',waiting:'Ждёт материалы',unloading:'Ждёт свободного места на складе'};
const label=k=>RESOURCE_NAMES[k][0].toUpperCase()+RESOURCE_NAMES[k].slice(1);
function costs(cost,available=true){return `<div class="cost-list">${Object.entries(cost).filter(([k,v])=>RESOURCE_NAMES[k]&&v>0).map(([k,v])=>`<span class="cost-row ${available&&state.resources[k]<v?'shortage':''}">${resourceIcon(k)}<span>${label(k)} — <b>${rounded(v)}</b>${k==='prestige'?' <em>требование, не расходуется</em>':''}${available?`<small>есть ${rounded(state.resources[k])}${state.resources[k]<v?` · не хватает ${rounded(v-state.resources[k])}`:''}</small>`:''}</span></span>`).join('')||'<small>Нет возврата ресурсов</small>'}</div>`;}
function priorityControl(b){return `<label class="control-label">Приоритет <select data-priority="${b.x},${b.y}" aria-label="Приоритет: ${entityName(b)}, ${b.x}, ${b.y}">${[[2,'Высокий'],[1,'Обычный'],[0,'Низкий']].map(([v,n])=>`<option value="${v}" ${(b.construction.priority??1)===v?'selected':''}>${n}</option>`).join('')}</select></label>`;}
function roleControl(c){const role=desiredRoles.get(c.id)||c.pendingRole||c.role||'auto',same=role===(c.role||'auto')||role===c.pendingRole,reason=state.lost?'Поселение покинуто':state.event?'Сначала реши событие':state.resources.faith<1?'Нужна 1 вера':same?'Выбери другую профессию':'';return `<div class="inspiration-controls"><label class="control-label">Кем вдохновить <select data-role="${c.id}" aria-label="Желаемая профессия: ${citizenName(c.id)}">${Object.entries(roles).map(([v,n])=>`<option value="${v}" ${role===v?'selected':''}>${n}</option>`).join('')}</select></label><button class="inspire-button" data-inspire="${c.id}" ${reason?'disabled':''} title="${reason||'40% успеха. Вера расходуется и при неудаче.'}">Вдохновить · 1 вера</button><small>Шанс 40% · сейчас: ${roles[c.role||'auto']}${c.pendingRole?` · ${roles[c.pendingRole]} после доставки`:''}</small></div>`;}

function siteStatus(b){const q=b.construction,p=constructionProgress(b),people=state.citizens.filter(c=>c.site===buildingKey(b));return `<div class="site-progress"><span>${p.stage} · ${Math.floor(p.ratio*100)}%</span><progress max="1" value="${p.ratio}" aria-label="Готовность стройки"></progress></div><div class="material-table"><span>Материал</span><span>Нужно</span><span>Доставлено</span><span>В пути</span>${Object.entries(q.required).filter(([,v])=>v>0).map(([k,v])=>`<span class="material-name">${resourceIcon(k)}${label(k)}</span><span>${rounded(v)}</span><span>${rounded(q.delivered[k]||0)}</span><span>${rounded(people.reduce((n,c)=>n+(c.buildCargo?.[k]||0),0))}</span>`).join('')}</div><small class="site-workers">${people.length?people.map(c=>`${citizenName(c.id)} · ${c.siteDuty==='carrier'?'носильщик':'строитель'}`).join(' · '):'Ожидание: нет свободных работников или доступного пути.'}</small>`;}
function mutate(result,message){if(!result.ok){toast(result.reason||'Действие недоступно');return false;}save();update();toast(message);return true;}
function bindManagement(root){
 root.querySelectorAll('[data-priority]').forEach(el=>el.onchange=()=>{const [x,y]=el.dataset.priority.split(',').map(Number);mutate(setPriority(state,x,y,Number(el.value)),'Приоритет стройки изменён');});
 root.querySelectorAll('[data-role]').forEach(el=>el.onchange=()=>{desiredRoles.set(Number(el.dataset.role),el.value);const c=state.citizens.find(c=>c.id===Number(el.dataset.role));el.blur();if(modalKind==='residents')renderManagement();else personDetail(c);});
 root.querySelectorAll('[data-inspire]').forEach(el=>el.onclick=()=>{const c=state.citizens.find(c=>c.id===Number(el.dataset.inspire));const result=inspireCitizen(state,c.id,desiredRoles.get(c.id)||c.pendingRole||c.role||'auto');mutate(result,result.success?`${citizenName(c.id)} вдохновился! Потрачена 1 вера.`:`${citizenName(c.id)} пока не вдохновился. Потрачена 1 вера.`);el.blur();if(modalKind==='residents')renderManagement();else personDetail(c);});
 root.querySelectorAll('[data-inspect]').forEach(el=>el.onclick=()=>{const [x,y]=el.dataset.inspect.split(',').map(Number),b=entityAt(x,y);closeDialog();selection=null;document.body.classList.remove('is-building');for(const card of document.querySelectorAll('.building-card')){card.classList.remove('selected');card.setAttribute('aria-pressed','false');}$('map-hint').textContent='Shift + перетаскивание — двигать карту · клик — здание или житель';inspected={x,y};if(b.type==='road')roadDetail(b);else detail(b.type,false,b);});
 root.querySelectorAll('[data-cancel]').forEach(el=>el.onclick=()=>{const [x,y]=el.dataset.cancel.split(',').map(Number);confirmRemoval(entityAt(x,y),false);});
}

function roadDetail(road){inspectedPerson=null;inspected={x:road.x,y:road.y};renderer.selectedRoad=road.id;$('tile-detail').hidden=false;$('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">ДОРОЖНАЯ СЕТЬ</span><h3>Участок дороги</h3><p>Материалы принесут носильщики, покрытие уложат строители. Пока работы идут, участок открыт на прежнем уровне.</p><strong></strong><div id="building-controls"></div>`;$('tile-detail').querySelector('.detail-close').onclick=()=>{inspected=null;$('tile-detail').hidden=true;};updateRoadDetail(road);}
function updateRoadDetail(road){const q=road.construction,level=levelOf(road),price=roadUpgradeCost(road);$('tile-detail').querySelector('strong').textContent=`Уровень ${level} / 3 · скорость +${(level-1)*20}%`;if($('building-controls').contains(document.activeElement))return;$('building-controls').innerHTML=q?`${siteStatus(road)}${priorityControl(road)}<button class="management-button danger" data-cancel="${road.x},${road.y}">Отменить улучшение</button>`:level>=3?'<p>Кирпичная мостовая · максимальный уровень</p>':`<h4>Улучшение до ${level+1} · скорость +${level*20}%</h4>${costs(price)}<button class="upgrade-button" id="upgrade-road">Улучшить участок</button>`;bindManagement($('building-controls'));if($('upgrade-road'))$('upgrade-road').onclick=()=>{const result=upgradeRoad(state,road);if(mutate(result,'Работы на дороге начаты'))roadDetail(road);};}

function detail(type,placement,b=null){
 inspectedPerson=null;const def=BUILDINGS[type];$('tile-detail').hidden=false;
 $('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">${placement?'НОВАЯ ПОСТРОЙКА':b.construction?'ЗАКАЗ ГОРОДА':`УРОВЕНЬ ${levelOf(b)} / 3`}</span><h3>${def.name}</h3><p>${def.desc}</p><strong>${esc(yieldSummary(state,b?.construction?.kind==='new'?{...b,construction:undefined}:b||{type,level:1}))}</strong>${placement?`<h4>Цена постройки</h4><div id="placement-cost">${costs(def)}</div><p>${type==='bridge'?'Выбери клетку воды.':'Нажми на свободную клетку.'} Материалы резервируются сразу. Escape — отмена.</p>`:'<div id="building-controls"></div>'}`;
 $('tile-detail').querySelector('.detail-close').onclick=()=>{inspected=null;inspectedPerson=null;$('tile-detail').hidden=true;};if(!placement)updateDetail();
}
function updateDetail(){
 if(selection&&$('placement-cost'))$('placement-cost').innerHTML=costs(BUILDINGS[selection]);
 if(inspectedPerson!==null&&!selection&&!$('tile-detail').hidden){const c=state.citizens.find(c=>c.id===inspectedPerson);if(c&&!$('tile-detail').contains(document.activeElement))personDetail(c);return;}
 if(!inspected||selection||$('tile-detail').hidden||!$('building-controls'))return;
 const b=entityAt(inspected.x,inspected.y);if(!b){inspected=null;$('tile-detail').hidden=true;return;}
 if(b.type==='road'){updateRoadDetail(b);return;}
 // Refresh the live readout without replacing a focused priority selector.
 if(b.construction&&$('inspector-site-live'))$('inspector-site-live').innerHTML=siteStatus(b);
 if($('building-controls').contains(document.activeElement)&&b.construction)return;
 const q=b.construction,reason=canUpgrade(state,b),cost=upgradeCost(b),demolitionReason=canDemolish(state,b);
 $('tile-detail').querySelector('.eyebrow').textContent=q?(q.kind==='upgrade'?`УЛУЧШЕНИЕ ДО ${q.target}`:'СТРОЙПЛОЩАДКА'):`УРОВЕНЬ ${levelOf(b)} / 3`;
 $('tile-detail').querySelector('strong').textContent=(q?.kind==='new'?'После завершения: ':'')+yieldSummary(state,q?.kind==='new'?{...b,construction:undefined}:b);
 $('building-controls').innerHTML=q?`<div id="inspector-site-live">${siteStatus(b)}</div>${priorityControl(b)}<button class="management-button danger" data-cancel="${b.x},${b.y}">${q.kind==='upgrade'?'Отменить улучшение':'Отменить строительство'}</button>`:`<p>${b.type==='house'?`Живут: ${state.citizens.filter(c=>c.home===buildingKey(b)).length}.`:['granary','shrine'].includes(b.type)?`${MATERIALS.map(k=>`${label(k)}: ${Math.floor(state.resources[k])} / ${storage(state)}${state.resources[k]>storage(state)?' · переполнение':''} · доставлено ${rounded(state.delivered[k]||0)}`).join('<br>')}`:`Назначено работников: ${state.citizens.filter(c=>c.work===buildingKey(b)).length}.`}</p>${levelOf(b)<3?`<h4>Цена улучшения до ${levelOf(b)+1}</h4>${costs(cost)}`:''}<button class="upgrade-button" id="upgrade-building" ${reason?'disabled':''}>${levelOf(b)>=3?'Максимальный уровень':`Улучшить до ${levelOf(b)+1}`}</button><small id="upgrade-reason">${esc(reason||'Материалы резервируются сразу.')}</small>`;
 if(!q||q.kind==='upgrade')$('building-controls').insertAdjacentHTML('beforeend',`<button class="management-button danger" id="demolish-building" ${demolitionReason?'disabled':''}>Снести здание</button>${demolitionReason?`<small class="blocked-reason">${esc(demolitionReason)}</small>`:''}`);
 bindManagement($('building-controls'));if($('upgrade-building'))$('upgrade-building').onclick=()=>{if(mutate(upgrade(state,b.x,b.y),'Заказ на улучшение создан'))detail(b.type,false,b);};if($('demolish-building'))$('demolish-building').onclick=()=>confirmRemoval(b,true);
}
function personDetail(c){
 inspected=null;inspectedPerson=c.id;$('tile-detail').hidden=false;const home=state.buildings.find(b=>buildingKey(b)===c.home),work=state.buildings.find(b=>buildingKey(b)===c.work);
 $('tile-detail').innerHTML=`<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">ЖИТЕЛЬ ГОРОДА</span><h3>${citizenName(c.id)}</h3><p>${phases[c.phase]||'Ожидает назначение'}${c.siteDuty?` · ${roles[c.siteDuty]||'стройка'}`:''}<br>Дом: ${home?`${home.x}, ${home.y}`:'—'}<br>Работа: ${work?BUILDINGS[work.type].name:'пока не назначена'}</p><strong>Груз: ${resourceText(Object.keys(c.cargo||{}).length?c.cargo:c.buildCargo||{})}</strong>${roleControl(c)}<p class="role-help">Строитель возводит стены, носильщик доставляет материалы. Производство — работа в мастерских и полях. Авто заполняет свободные задачи. При нехватке материалов строитель ждёт доставку; ночью жители идут домой.</p>`;
 $('tile-detail').querySelector('.detail-close').onclick=()=>{inspectedPerson=null;$('tile-detail').hidden=true;};bindManagement($('tile-detail'));
}
function confirmRemoval(b,demolition){
 const back=['construction','residents'].includes(modalKind)?modalKind:null,refund=demolition?demolitionRefund(b):cancellationRefund(b);
 openDialog('confirmation',`<span class="eyebrow">${demolition?'СНОС ЗДАНИЯ':'ОТМЕНА ЗАКАЗА'}</span><h2>${demolition?'Снести':'Отменить'}: ${entityName(b)}?</h2><p>Клетка ${b.x}, ${b.y}. ${demolition?'Готовое здание будет удалено. Возврат — половина вложенных материалов; вера и престиж не возвращаются.':b.construction.kind==='upgrade'?'Здание сохранит прежний уровень. Потраченный труд исчезнет.':'Клетка освободится. Потраченный труд исчезнет.'}</p><h3>${demolition?'Возврат за готовую часть':'Полный возврат цены'}</h3>${costs(refund,false)}${demolition&&b.construction?`<h3>Отдельно: отмена улучшения</h3>${costs(cancellationRefund(b),false)}`:''}<p>Материалы сразу вернутся в общие запасы, включая доставленные и находящиеся в пути. Это игровая условность; повторно они не начисляются.</p><div class="dialog-actions"><button class="primary" id="confirm-removal">${demolition?'Снести здание':'Отменить заказ'}</button><button class="secondary" id="keep-building">Оставить</button></div>`);
 $('keep-building').onclick=()=>{closeDialog();if(back)showManagement(back);};$('confirm-removal').onclick=()=>{const result=demolition?demolish(state,b.x,b.y):cancelConstruction(state,b.x,b.y);if(!result.ok){toast(result.reason);return;}closeDialog();mutate(result,demolition?'Здание снесено. Ресурсы возвращены.':'Заказ отменён. Ресурсы возвращены.');if(back)showManagement(back);else{const current=buildingAt(state,b.x,b.y);if(current)detail(current.type,false,current);else{inspected=null;$('tile-detail').hidden=true;}}};
}
function showManagement(kind){openDialog(kind,`<button class="management-close" id="close-management" aria-label="Вернуться в город">×</button><span class="eyebrow">УПРАВЛЕНИЕ ГОРОДОМ</span><h2>${kind==='construction'?'Стройки':'Жители'}</h2><p>${kind==='construction'?'Высокий приоритет обслуживается первым. Уже взятые грузы заканчивают прежнюю доставку.':'Выбери профессию и вдохнови жителя за 1 веру. Шанс — 40%; вера тратится при любом исходе. С грузом он сначала закончит доставку.'}</p><div id="management-list"></div>`);$('close-management').onclick=closeDialog;renderManagement();}
function renderManagement(){
 if(!['construction','residents'].includes(modalKind)||!$('management-list')||$('management-list').contains(document.activeElement))return;
 $('management-list').innerHTML=modalKind==='construction'?(orderedSites(state).map(b=>`<article class="management-row"><h3>${entityName(b)} <small>${b.x}, ${b.y} · ${b.construction.kind==='upgrade'?`улучшение до ${b.construction.target}`:'новая постройка'}</small></h3>${siteStatus(b)}${priorityControl(b)}<div class="row-actions"><button data-inspect="${b.x},${b.y}">На карте</button><button class="danger" data-cancel="${b.x},${b.y}">Отменить заказ</button></div></article>`).join('')||'<p class="empty-state">Все работы завершены. Новые заказы появятся здесь.</p>'):state.citizens.map(c=>`<article class="management-row resident-row"><div><h3>${citizenName(c.id)}</h3><p>Дом: ${esc(c.home||'—')} · ${phases[c.phase]||'Ожидает назначение'}${c.siteDuty?` · ${roles[c.siteDuty]}`:''}</p></div>${roleControl(c)}</article>`).join('');bindManagement($('management-list'));
}
function choose(type){
 inspected=null;roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');selection=selection===type?null:type;document.body.classList.toggle('is-building',!!selection);
 for(const card of document.querySelectorAll('.building-card')){card.classList.toggle('selected',card.dataset.type===selection);card.setAttribute('aria-pressed',String(card.dataset.type===selection));}
 $('map-hint').textContent=selection?`${BUILDINGS[selection].name} · ${selection==='bridge'?'выбери воду':selection==='field'?'выбери зелёную землю':'выбери свободную клетку'} · Escape — отмена`:'Shift + перетаскивание — двигать карту · клик — здание или житель';
 if(selection)detail(selection,true);else $('tile-detail').hidden=true;
}
function buildBenefit(type){
 const b=BUILDINGS[type];if(type==='house')return '+8 мест для жителей';if(type==='granary')return '+150 хранения · склад';if(type==='bridge')return 'Путь и доставка на другой берег';
 return `${resourceText(b.output)} / рейс${type==='garden'?' · +4 счастья':''}`;
}
for(const [i,[type,b]]of Object.entries(Object.entries(BUILDINGS))){
 const el=document.createElement('button');el.className='building-card';el.dataset.type=type;el.title=`${b.name}. ${b.desc}`;el.setAttribute('aria-pressed','false');
 el.innerHTML=`<span class="building-icon">${b.icon}</span><span class="build-copy"><strong>${b.name}</strong><span class="build-effect">${buildBenefit(type)}</span><span class="catalog-cost" data-cost="${type}">${costs(b)}</span></span><span class="build-hotkey">${Number(i)<9?Number(i)+1:''}</span>`;
 el.onclick=()=>choose(type);$('buildings').append(el);
}
for(const [id,m]of Object.entries(MIRACLES)){
 const el=document.createElement('button');el.className='miracle-card';el.id=`miracle-${id}`;
 el.innerHTML=`<span class="miracle-symbol">${m.icon}</span><span><strong>${m.name}</strong><span class="miracle-description">${m.desc}</span><small></small></span>`;
 el.onclick=()=>{const result=miracle(state,id);if(result.ok){renderer.addEffect(id);toast(`${m.name} · ${state.name}`);save();update();checkDialogs();}else toast(result.reason);};$('miracles').append(el);
}
function update(){
 const r=state.resources,stats=workforceStats(state),res=Object.fromEntries(Object.entries(RESOURCE_NAMES).map(([k,n])=>[k,['',n.toUpperCase()]]));
 $('resources').innerHTML=Object.entries(res).map(([k,[icon,name]])=>`<div class="resource" title="${name}: ${rounded(r[k])}${MATERIALS.includes(k)?` / ${storage(state)}`:''}. Доставлено работниками: ${rounded(state.delivered[k]||0)}"><span class="resource-icon">${resourceIcon(k)}</span><div><strong class="${MATERIALS.includes(k)&&r[k]>storage(state)?'overflow':''}">${Math.floor(r[k])}</strong><small>${name}</small></div></div>`).join('');
 $('population').textContent=`${state.population} / ${state.capacity}`;$('happiness').textContent=`☀ ${Math.round(state.happiness)}%`;$('happiness').style.color=state.happiness<40?'#aa654a':'';
 const efficiency=workers(state);$('workers').textContent=`${stats.employed+stats.builders+(stats.carriers??0)} / ${state.population}`;$('labor-meter').style.width=`${efficiency*100}%`;
 $('labor-note').textContent=stats.disconnected?`Нет пути к ${stats.disconnected} рабочим зданиям. Нужен мост или склад на этом берегу.`:`Строители: ${stats.builders} · носильщики: ${stats.carriers??0} · площадки: ${stats.sites}. Собирают: ${stats.working} · несут груз: ${stats.carrying}. Ресурсы поступают только после доставки.`;
 $('date').textContent=`Год ${state.year} · ${SEASONS[state.season]}`;$('season-icon').textContent=['❀','☀','❧','❄'][state.season];
 $('season-track').innerHTML=SEASONS.map((v,i)=>`<i class="${i===state.season?'current':''}" title="${v}"></i>`).join('');
 $('god-name').textContent=state.name;$('god-description').innerHTML=Object.values(state.divinity.domains).some(v=>v>0)?'Твоё имя рождается из чудес.<br>Деяния остаются в памяти людей.':'Люди строят город.<br>Ты выбираешь, каким богом стать.';
 $('god-level').textContent=count(state,'ziggurat')?'III · БОГ ВЕЛИКОГО ГОРОДА':state.population>=24?'II · ПОКРОВИТЕЛЬ ГОРОДА':'I · ДУХ ПОСЕЛЕНИЯ';$('pantheon').textContent=`Заслуженные имена · ${state.divinity.names.length}`;
 const weather=weatherAt(state);$('weather').textContent=state.drought?`☀ Засуха · ${state.drought} сез.`:state.rain?`☂ Благодатный дождь · ${state.rain} сез.`:({sunny:'☀ Ясно',cloudy:'☁ Облачно',rain:'☂ Дождь',wind:'≋ Ветер'}[weather.type]);$('weather').classList.toggle('drought',!!state.drought);

 const signature=`${state.news.length}|${state.news[0]?.title}|${state.tick}`;
 if(signature!==newsSignature){newsSignature=signature;$('news').innerHTML=state.news.map(n=>`<article class="news-item ${['good','bad','miracle','year','build','info'].includes(n.kind)?n.kind:'info'}"><small>ГОД ${n.year} · ${SEASONS[n.season].toUpperCase()}</small><h3>${esc(n.title)}</h3><p>${esc(n.text)}</p></article>`).join('');}
 const g=goals(state);$('goals').innerHTML=g.map(v=>`<div class="goal ${v.done?'done':''}"><span>${v.done?'✓':'○'}</span>${v.label}</div>`).join('');$('goal-number').textContent=`${g.filter(v=>v.done).length} / 5`;
 for(const [id,m]of Object.entries(MIRACLES)){
  const el=$(`miracle-${id}`);const reason=state.lost?'Поселение покинуто':state.event?'Реши событие':state.cooldowns[id]?`Через ${state.cooldowns[id]} сез.`:r.faith<m.cost?`Нужно ${m.cost} веры`:id==='abundance'&&r.food>=storage(state)?'Амбары полны':'';
  el.disabled=!!reason;el.title=`${m.desc} Домен: ${DOMAIN_NAMES[m.domain]}. ${reason}`;el.querySelector('small').textContent=reason||`${m.cost} веры · ${DOMAIN_NAMES[m.domain]}`;
 }
 $('season-countdown').textContent=paused?'Время на паузе':`До сезона: ${Math.max(0,Math.ceil(45-state.seasonElapsed))} с`;
 $('pause').textContent=paused?'▶':'Ⅱ';$('pause').setAttribute('aria-label',paused?'Продолжить время':'Приостановить время');$('pause').classList.toggle('active',paused);$('next-season').disabled=state.lost||!!state.event;
 const clock=lightingAt(state.simTime),minutes=Math.floor(clock.hour*60);
 $('day-cycle').textContent=`${clock.night>.5?'☾':'☀'} ${clock.label} · ${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')} · ${isWorkday(state.simTime)?'до вечера':'до утра'}`;
 $('day-cycle').setAttribute('aria-label',`Дождаться ${isWorkday(state.simTime)?'вечера':'утра'}. Время и хозяйство действительно продвинутся.`);$('day-cycle').disabled=state.lost||!!state.event;
 $('street-life').textContent=`Строят ${stats.builders} · доставляют на стройки ${stats.carriers??0} · на работе ${stats.working} · с грузом ${stats.carrying} · дома ${stats.atHome}`;
 $('delivery-log').textContent=state.lastDelivery?`${citizenName(state.lastDelivery.citizen)} доставил: ${resourceText(state.lastDelivery.cargo)}`:'Ресурсы поступают, когда груз доходит до склада';
 $('city').parentElement.classList.toggle('is-night',clock.night>.45);updateDetail();renderManagement();for(const el of document.querySelectorAll('[data-cost]'))el.innerHTML=costs(BUILDINGS[el.dataset.cost]);$('open-construction').textContent=`Стройки · ${orderedSites(state).length}`;
}
function openDialog(kind,html){modalKind=kind;dialog.dataset.kind=kind;$('dialog-content').innerHTML=`<div class="dialog-inner">${html}</div>`;if(!dialog.open)dialog.showModal();last=performance.now();}
function closeDialog(){dialog.close();modalKind=null;delete dialog.dataset.kind;last=performance.now();}
function intro(){
 openDialog('help',`<span class="eyebrow">НОВЫЙ ВАВИЛОН · ЖИВОЙ ГОРОД</span><span class="dialog-emblem">✺</span><h2>У каждого города есть жизнь.</h2><p>Теперь жители действительно работают: выходят из дома, собирают материалы и несут их на склад. Ночью они возвращаются домой.</p><div class="instructions"><b>01.</b> Заложи двор или поле: строители принесут материалы и возведут здание.<br><b>02.</b> Храм — первый универсальный склад. Амбары хранят все материалы.<br><b>03.</b> Улучшения до III уровня тоже требуют доставки и работы. Ночью строители отдыхают.<br><b>04.</b> Поставь мост на воду и осваивай другой берег.<br><b>05.</b> Развивай дороги; вдохновляй жителей. Добывай глину и тростник на отмеченных местах, дерево в лесах, камень в карьерах. Рыбалка и охота дают общую еду.</div><p>Цель — зиккурат, 30 жителей и десятый год. Сезон — 45 секунд; сутки — 60 секунд. Числа в производстве указаны за один рейс работника.</p><div class="dialog-actions"><button class="primary" id="start-game">${loaded||state.tick?'Вернуться в город':'Да будет город'}</button></div><p class="keyboard-note">1–9 — постройки · пробел — пауза · Escape — отмена<br>Shift + перетаскивание — карта · ◫ — вся долина</p>`);
 $('start-game').onclick=()=>{closeDialog();paused=false;save();update();checkDialogs();};
}
function checkDialogs(){
 if(dialog.open)return;
 if(state.lost||state.won&&!state.continued){
  openDialog('end',`<span class="eyebrow">${state.lost?'ИСТОРИЯ ОСТАЛАСЬ В ГЛИНЕ':'ТВОЯ ПЕРВАЯ ЛЕГЕНДА'}</span><span class="dialog-emblem">${state.lost?'☾':'▲'}</span><h2>${state.lost?'В долине погасли огни.':'Город коснулся неба.'}</h2><p>${state.lost?'Люди покинули город. У новой истории может быть другое начало.':`Долина знает тебя как «${esc(state.name)}». Через руки твоих жителей прошло ${state.deliveries} доставок.`}</p><div class="dialog-stats"><div><strong>${state.year}</strong><small>ГОД ИСТОРИИ</small></div><div><strong>${state.population}</strong><small>ЖИТЕЛЕЙ</small></div><div><strong>${state.miracleCount}</strong><small>ЧУДЕС</small></div></div><div class="dialog-actions">${state.lost?'':'<button class="primary" id="continue-game">Продолжить историю</button>'}<button class="secondary" id="end-new">Новая долина</button></div>`);
  if($('continue-game'))$('continue-game').onclick=()=>{state.continued=true;closeDialog();save();update();checkDialogs();};$('end-new').onclick=askReset;return;
 }
 if(state.event){
  const ev=state.event,reason=eventReason(state);
  openDialog('event',`<span class="eyebrow">ГОД ${state.year} · РЕШЕНИЕ ПОКРОВИТЕЛЯ</span><div class="event-resources">${Object.entries(state.resources).map(([k,v])=>`<span><b>${Math.floor(v)}</b> ${RESOURCE_NAMES[k]}</span>`).join('')}</div><span class="dialog-emblem">${ev.id==='caravan'?'⛵':ev.id==='refugees'?'⌂':'✺'}</span><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>${reason?`<p class="warning-note">${reason}</p>`:''}<div class="dialog-actions"><button class="primary" id="event-accept" ${reason?'disabled':''}>${ev.id==='caravan'?'Обменять еду':ev.id==='refugees'?'Принять людей':'Устроить праздник'}</button><button class="secondary" id="event-skip">Сохранить запасы</button></div><p class="keyboard-note">Время на паузе. Ресурсы сверху остаются видны.</p>`);
  for(const choice of ['accept','skip'])$(`event-${choice}`).onclick=()=>{const result=resolveEvent(state,choice);if(result.ok){closeDialog();save();update();checkDialogs();}else toast(result.reason);};
 }
}
function pantheon(){
 openDialog('pantheon',`<span class="eyebrow">ИМЕНА РОЖДАЮТСЯ ИЗ ДЕЯНИЙ</span><span class="dialog-emblem">✺</span><h2>${esc(state.name)}</h2><p>Чем чаще ты используешь чудеса одного домена, тем сильнее его имена. Близкие по силе домены могут дать смешанное имя.</p><div class="domain-list">${Object.entries(DIVINE_NAMES).map(([domain,names])=>`<section><h3>${DOMAIN_NAMES[domain]} <small>${state.divinity.domains[domain]} чудес</small></h3>${names.map(name=>`<span class="divine-name ${state.divinity.names.includes(name)?'earned':''}">${state.divinity.names.includes(name)?'✓':'○'} ${name}</span>`).join('')}</section>`).join('')}</div>${state.divinity.names.some(n=>!Object.values(DIVINE_NAMES).flat().includes(n))?`<p>Особые имена: ${state.divinity.names.filter(n=>!Object.values(DIVINE_NAMES).flat().includes(n)).map(esc).join(' · ')}</p>`:''}<div class="dialog-actions"><button class="primary" id="close-pantheon">Вернуться в город</button></div>`);$('close-pantheon').onclick=closeDialog;
}
function newGame(){state=createGame();desiredRoles.clear();roadMode=false;renderer.setRoadMode(false);selection=null;inspected=null;paused=true;loaded=false;closeDialog();$('tile-detail').hidden=true;document.body.classList.remove('is-building');for(const el of document.querySelectorAll('.building-card')){el.classList.remove('selected');el.setAttribute('aria-pressed','false');}renderer.effects=[];renderer.ambient=0;renderer.lightMode='auto';renderer.home();save();update();intro();}
function askReset(){openDialog('reset','<span class="dialog-emblem">↻</span><h2>Начать новую историю?</h2><p>Текущий город и его сохранение будут заменены новой долиной. Это действие нельзя отменить.</p><div class="dialog-actions"><button class="primary" id="confirm-reset">Начать заново</button><button class="secondary" id="cancel-reset">Остаться в городе</button></div>');$('confirm-reset').onclick=newGame;$('cancel-reset').onclick=()=>{closeDialog();checkDialogs();};}
$('building-count').textContent=Object.keys(BUILDINGS).length;
$('open-roads').onclick=()=>{if(selection)choose(selection);roadMode=!roadMode;renderer.setRoadMode(roadMode);$('open-roads').setAttribute('aria-pressed',String(roadMode));$('map-hint').textContent=roadMode?'Дороги: выбери участок · стрелки и Enter — с клавиатуры · Escape — выйти':'Выбери здание или жителя';};
renderer.onRoadSelect=road=>{if(dialog.open)return;roadDetail(road);};
$('open-construction').onclick=()=>showManagement('construction');$('open-residents').onclick=()=>showManagement('residents');
$('reset').onclick=askReset;$('help').onclick=intro;$('pantheon').onclick=pantheon;
$('pause').onclick=()=>{if(state.lost)return;paused=!paused;save();update();};
for(const el of document.querySelectorAll('[data-speed]'))el.onclick=()=>{speed=Number(el.dataset.speed);for(const b of document.querySelectorAll('[data-speed]'))b.classList.toggle('active',b===el);};
$('next-season').onclick=()=>{advanceSeason(state);save();update();checkDialogs();};
$('day-cycle').onclick=()=>{const clock=lightingAt(state.simTime),target=isWorkday(state.simTime)?19:6,seconds=((target-clock.hour+24)%24)*DAY_SECONDS/24+.05;advanceTime(state,seconds);renderer.lightMode='auto';save();update();checkDialogs();};
$('zoom-in').onclick=()=>renderer.zoom=Math.min(3,renderer.zoom+.2);$('zoom-out').onclick=()=>renderer.zoom=Math.max(.3,renderer.zoom-.2);$('home').onclick=()=>renderer.home();$('overview').onclick=()=>renderer.overview();
dialog.addEventListener('cancel',e=>{e.preventDefault();if(['help','reset','pantheon','construction','residents','confirmation'].includes(modalKind)){closeDialog();checkDialogs();}});
document.addEventListener('keydown',e=>{if(dialog.open||['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();paused=!paused;save();update();}if(e.key==='Escape'){if(roadMode){roadMode=false;renderer.setRoadMode(false);$('open-roads').setAttribute('aria-pressed','false');}if(selection)choose(selection);else{inspected=null;$('tile-detail').hidden=true;}}if(/^[1-9]$/.test(e.key))choose(Object.keys(BUILDINGS)[Number(e.key)-1]);});
document.addEventListener('visibilitychange',()=>{last=performance.now();if(document.hidden&&loaded)save();});
function frame(now){
 const dt=Math.min(250,Math.max(0,now-last));last=now;
 if(!document.hidden&&!paused&&!dialog.open&&!state.lost){const oldTick=state.tick;advanceTime(state,dt/1000*speed);if(state.tick!==oldTick||state.event||state.lost||state.won&&!state.continued){save();update();checkDialogs();}if(now-lastSave>3000){save();lastSave=now;}}
 if(now-lastUI>350){update();lastUI=now;}
 renderer.draw(state,selection,now);requestAnimationFrame(frame);
}
update();requestAnimationFrame(frame);
if(!loaded)intro();else{toast(legacyRaw?'Город обновлён: новые промыслы, материалы и дороги. Запасы и грузы сохранены. Нажми ▶.':'Город и грузы восстановлены. Нажми ▶, когда будешь готов.');checkDialogs();}
if(corrupt)setTimeout(()=>toast('Сохранение повреждено или несовместимо. Начата новая история.'),500);
if(!storageOK){$('save-status').textContent='○ Без сохранения';setTimeout(()=>toast('Хранилище браузера недоступно. Прогресс сохранится только до закрытия вкладки.'),1000);}
