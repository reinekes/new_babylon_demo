import {RELIC_FAITH_COST,relicQuestView,relicStartReason,startRelicQuest,orderRelicMove,searchRelic,deliverRelic,cancelRelicQuest,relicControlActive} from './relic-quest.js';
import {displayName} from './citizen-epithets.js';
import {setHTML} from './ui-render.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stage={controlled:'Веди избранного к оазису',searching:'Человек ищет на мелководье…',rejoicing:'Артефакт найден! Люди собираются отпраздновать',carrying:'Отнеси реликвию в храм',celebrating:'Община встречает реликвию у храма'};
export function relicHUDHTML(s,{paused=false}={}){
 const v=relicQuestView(s);if(!v?.active)return '';
 const c=s.citizens.find(c=>c.id===v.actorId),distance=c?Math.ceil(Math.hypot(c.x-v.searchPoint.x,c.y-v.searchPoint.y)):0;
 return `<div class="relic-hud-heading"><span>Воля бога · город живёт сам на 1×</span><b>${esc(displayName(s,v.actorId))}</b></div><p>${stage[v.phase]}</p>${v.phase==='controlled'?`<small>Нажимай на сушу, чтобы вести человека. Золотое сияние видишь только ты. До берега: ≈${distance} клет.</small><div class="relic-actions"><button type="button" data-relic-action="focus-oasis">Показать оазис</button><button type="button" data-relic-action="focus-person">Найти избранного</button><button type="button" data-relic-action="search"${v.canSearch?'':' disabled'}>Искать артефакт</button></div>`:''}${v.phase==='carrying'?`<small>Нажми на готовое святилище или зиккурат на карте, либо выбери храм ниже.</small><div class="relic-actions">${v.temples.map(t=>`<button type="button" data-relic-temple="${esc(t.key)}">${t.type==='shrine'?'Святилище':'Зиккурат'} · ${t.x}, ${t.y}</button>`).join('')}</div>`:''}<div class="relic-actions"><button type="button" data-relic-action="pause">${paused?'Продолжить путь':'Пауза'}</button>${v.canCancel?'<button type="button" data-relic-action="cancel">Прервать поиск</button>':''}</div><small>${v.canCancel?'Потраченная вера не возвращается.':'Найденный артефакт нужно доставить в храм.'} Городские команды закрыты до возвращения.</small>`;
}
export function relicStartHTML(s,c){const reason=relicStartReason(s,c.id);return `<section class="relic-start"><h4>Поиск реликвии</h4><p>Вселись в человека и веди его мышью к оазису. Пока он ищет реликвию и несёт её в храм, ты управляешь только им.</p><button type="button" data-start-relic="${c.id}"${reason?' disabled':''}>Взять под управление · ${RELIC_FAITH_COST} веры</button><small>${esc(reason||'Цена списывается сразу; отмена до находки без возврата веры.')}</small></section>`;}
/** All inputs are deliberate UI commands; this controller never advances time. */
export function createRelicControls({root,getState,renderer,onChange,onStart,onPause,getPaused=()=>false,onMessage}){
 const hud=document.createElement('section');hud.className='relic-hud';hud.setAttribute('aria-label','Управление избранным');hud.hidden=true;root.append(hud);
 const act=(result,text)=>{if(result.ok)onChange?.(text);else onMessage?.(result.reason);refresh();return result;};
 const start=id=>{const result=startRelicQuest(getState(),id);if(result.ok)onStart?.();return act(result,'Ты ведёшь избранного. Нажимай на сушу, чтобы идти.');};
 const refresh=()=>{const s=getState();hud.hidden=!relicControlActive(s);setHTML(hud,relicHUDHTML(s,{paused:getPaused()}));};
 const click=event=>{const button=event.target.closest?.('button');if(!button||button.disabled)return;
  if(button.dataset.startRelic!==undefined){start(Number(button.dataset.startRelic));return;}
  if(button.dataset.relicTemple!==undefined){act(deliverRelic(getState(),button.dataset.relicTemple),'Реликвия отправляется в храм');return;}
  const action=button.dataset.relicAction;if(!action)return;const s=getState(),v=relicQuestView(s),c=s.citizens.find(c=>c.id===v?.actorId);
  if(action==='focus-oasis'&&v)renderer.focusOn(v.searchPoint.x,v.searchPoint.y);
  if(action==='focus-person'&&c)renderer.focusOn(c.x,c.y);
  if(action==='pause')onPause?.();
  if(action==='search')act(searchRelic(s),'Человек ищет реликвию');
  if(action==='cancel')act(cancelRelicQuest(s),'Поиск отложен');refresh();
 };
 document.addEventListener('click',click);
 return {start,refresh,move:point=>act(orderRelicMove(getState(),point),'Путь указан'),deliver:key=>act(deliverRelic(getState(),key),'Реликвия отправляется в храм'),dispose(){document.removeEventListener('click',click);hud.remove();}};
}
