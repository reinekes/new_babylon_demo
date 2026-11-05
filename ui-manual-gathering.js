import {resourceIcon} from './resource-icons.js';
import {residentLinkHTML} from './ui-resident-links.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={clay:'Глина',reed:'Тростник',stone:'Камень'};
const phases={toManualGathering:'идёт к залежи',manualGathering:'собирает вручную',toStore:'несёт на склад',unloading:'ждёт места на складе',toHome:'возвращается домой',toRest:'несёт груз домой',resting:'отдыхает с грузом'};
const statuses={inactive:'Поручения пока нет',working:'Идёт ручной сбор',carrying:'Собранное несут на склад',walking:'Жители идут к залежи',waiting:'Ждём свободных жителей',blocked:'Сбор сейчас недоступен'};
export function manualGatheringHTML(s,v){
 if(!v)return '';
 const progress=Math.max(0,Math.min(1,v.progress||0));
 return `<button class="detail-close" aria-label="Закрыть описание">×</button><span class="eyebrow">РУЧНОЙ СБОР · БЕЗ ЗДАНИЯ</span><h3 class="manual-resource-title">${resourceIcon(v.resource)} ${names[v.resource]}</h3><p>До ${v.maxWorkers} свободных взрослых собирают сырьё руками. Здание и затраты веры не нужны.</p><strong>${v.batchSize} ед. за ${v.workSeconds} с работы каждого жителя</strong>${Number.isFinite(v.remaining)?`<p>Остаток залежи: ${Number(v.remaining.toFixed(1))} / ${v.capacity}. После исчерпания можно перейти к другой залежи или купить сырьё у торговцев.</p>`: ''}<small>Скорость зависит от состояния жителя; дорога и отдых считаются отдельно. Мастерская добывает значительно быстрее. Семья и назначенная работа важнее этого поручения.</small><section class="manual-gathering-status" aria-live="polite"><b>${esc(v.statusReason||v.waitingReason||statuses[v.status]||statuses.waiting)}</b>${v.status==='working'?`<progress aria-label="Сбор очередной корзины" max="1" value="${progress}"></progress>`:''}${v.workers.length?`<ul>${v.workers.map(c=>`<li>${residentLinkHTML(s,c.id)} <small>${esc(phases[c.phase]||'выполняет поручение')}</small></li>`).join('')}</ul>`:''}</section><button class="upgrade-button" ${v.active?'data-manual-cancel':'data-manual-order'} ${(v.active?v.cancelReason:v.reason)?'disabled':''}>${v.active?'Остановить сбор':'Приказать добывать'}</button>${v.reason?`<p class="blocked-reason">${esc(v.reason)}</p>`:''}<small>Ресурс появится в запасах после доставки в доступный склад или домашний запас сырья. При остановке собранный груз сохраняется.</small>`;
}
export function bindManualGathering(root,{onOrder,onCancel,onClose}={}){
 const close=root.querySelector('.detail-close'),order=root.querySelector('[data-manual-order]'),cancel=root.querySelector('[data-manual-cancel]');
 if(close)close.onclick=()=>onClose?.();if(order)order.onclick=()=>onOrder?.();if(cancel)cancel.onclick=()=>onCancel?.();
}
