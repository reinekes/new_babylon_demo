import {RELIC_FAITH_COST,relicQuestView,relicQuestViews,relicStartReason,startRelicQuest,orderRelicMove,searchRelic,deliverRelic,cancelRelicQuest,relicControlActive} from './relic-quest.js';
import {displayName} from './citizen-epithets.js';
import {setHTML} from './ui-render.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const stage={controlled:'Веди избранного к реликвии',searching:'Избранный ищет древний знак…',rejoicing:'Артефакт найден! Праздник на безопасном берегу',carrying:'Отнеси реликвию в храм',celebrating:'Община встречает реликвию у храма',returning:'Избранный возвращается к берегу'};
export function relicHUDHTML(s,{paused=false}={}){
 const v=relicQuestView(s);if(!v?.active)return '';
 const c=s.citizens.find(c=>c.id===v.actorId),distance=c?Math.ceil(Math.hypot(c.x-v.searchPoint.x,c.y-v.searchPoint.y)):0;
 return `<div class="relic-hud-heading"><span>Воля бога · город живёт сам на 1×</span><b>${esc(displayName(s,v.actorId))}</b></div><p>${stage[v.phase]} · ${esc(v.title)}</p>${v.phase==='controlled'?`<small>${v.id==='oasis'?'Нажимай на сушу или воду этого оазиса: избранный умеет плыть. Войди прямо к золотому знаку на дне.':'Нажимай на сушу и подведи избранного к золотой печати.'} Сияние видишь только ты. До реликвии: ≈${distance} клет.</small><div class="relic-actions"><button type="button" data-relic-action="focus-oasis">${v.id==='oasis'?'Показать оазис':'Показать печать'}</button><button type="button" data-relic-action="focus-person">Найти избранного</button><button type="button" data-relic-action="search"${v.canSearch?'':' disabled'}>Искать артефакт</button></div>`:''}${v.phase==='returning'?'<small>Человек физически выходит из воды. Городские команды вернутся, когда он достигнет берега.</small>':''}${v.phase==='carrying'?`<small>Нажми на готовое святилище или зиккурат на карте, либо выбери храм ниже.</small><div class="relic-actions">${v.temples.map(t=>`<button type="button" data-relic-temple="${esc(t.key)}">${t.type==='shrine'?'Святилище':'Зиккурат'} · ${t.x}, ${t.y}</button>`).join('')}</div>`:''}<div class="relic-actions"><button type="button" data-relic-action="pause">${paused?'Продолжить путь':'Пауза'}</button>${v.canCancel?'<button type="button" data-relic-action="cancel">Прервать поиск</button>':''}</div><small>${v.phase==='returning'?'Потраченная вера не возвращается.':v.canCancel?'Потраченная вера не возвращается.':'Найденный артефакт нужно доставить в храм.'} Городские команды закрыты до возвращения.</small>`;
}
export function relicStartHTML(s,c,{id}={}){
 const views=relicQuestViews(s).filter(v=>!id||v.id===id);if(!views.length)return '';
 return `<section class="relic-start"><h4>Поиск реликвий</h4><p>Веди человека мышью. До возвращения реликвии в храм ты управляешь только им.</p>${views.map(v=>{const reason=relicStartReason(s,c.id,v.id);return `<div class="relic-start-target" data-relic-choice="${esc(v.id)}"><b>${esc(v.title)} · ${v.id==='oasis'?'на дне оазиса':'на суше'}</b><small>${v.phase==='completed'?'Хранится в храме.':`Новое имя: ${esc(v.divineName)}.`}</small><button type="button" data-start-relic="${c.id}" data-relic-quest="${esc(v.id)}"${reason?' disabled':''}>${v.phase==='completed'?'Реликвия уже найдена':`Взять под управление · ${RELIC_FAITH_COST} веры`}</button><small>${esc(reason||'Цена списывается сразу; отмена до находки без возврата веры.')}</small></div>`;}).join('')}</section>`;
}
/** All inputs are deliberate UI commands; this controller never advances time. */
export function createRelicControls({root,getState,renderer,onChange,onStart,onPause,getPaused=()=>false,onMessage}){
 const hud=document.createElement('section');hud.className='relic-hud';hud.setAttribute('aria-label','Управление избранным');hud.hidden=true;root.append(hud);
 const act=(result,text)=>{if(result.ok)onChange?.(text);else onMessage?.(result.reason);refresh();return result;};
 const start=(id,questId='oasis')=>{const result=startRelicQuest(getState(),id,questId);if(result.ok)onStart?.();return act(result,questId==='land'?'Ты ведёшь избранного. Нажимай на сушу, чтобы дойти до печати.':'Ты ведёшь избранного. Нажимай на сушу или воду отмеченного оазиса.');};
 const refresh=()=>{const s=getState();hud.hidden=!relicControlActive(s);setHTML(hud,relicHUDHTML(s,{paused:getPaused()}));};
 const click=event=>{const button=event.target.closest?.('button');if(!button||button.disabled)return;
  if(button.dataset.startRelic!==undefined){start(Number(button.dataset.startRelic),button.dataset.relicQuest);return;}
  if(button.dataset.relicTemple!==undefined){act(deliverRelic(getState(),button.dataset.relicTemple),'Реликвия отправляется в храм');return;}
  const action=button.dataset.relicAction;if(!action)return;const s=getState(),v=relicQuestView(s),c=s.citizens.find(c=>c.id===v?.actorId);
  if(action==='focus-oasis'&&v)renderer.focusOn(v.searchPoint.x,v.searchPoint.y);
  if(action==='focus-person'&&c)renderer.focusOn(c.x,c.y);
  if(action==='pause')onPause?.();
  if(action==='search')act(searchRelic(s),'Человек ищет реликвию');
  if(action==='cancel'){const result=cancelRelicQuest(s);act(result,result.pending?'Избранный возвращается на сушу':'Поиск отложен');}refresh();
 };
 document.addEventListener('click',click);
 return {start,refresh,move:point=>act(orderRelicMove(getState(),point),'Путь указан'),deliver:key=>act(deliverRelic(getState(),key),'Реликвия отправляется в храм'),dispose(){document.removeEventListener('click',click);hud.remove();}};
}
