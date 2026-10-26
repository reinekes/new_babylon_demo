import {BUILDINGS,RESOURCE_NAMES} from './definitions.js';
import {annualProductionHistory} from './building-production-history.js';
import {resourceIcon} from './resource-icons.js';

const number=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Actual output during the last three finished calendar years. */
export function buildingProductionHistoryHTML(s,b){
 const keys=Object.keys(BUILDINGS[b?.type]?.output||{});if(!keys.length)return '';
 const rows=annualProductionHistory(s,b);
 return `<section class="building-production-history" aria-label="Фактическое производство за три полных года"><h4>Последние 3 полных года</h4><p>Фактический выпуск · завершённые годы</p>${!rows.length?'<p class="building-production-unknown">Первый полный год ещё не завершён</p>':`<div class="building-production-scroll"><table><thead><tr><th scope="col">Год</th>${keys.map(key=>`<th scope="col" title="${escape(RESOURCE_NAMES[key]||key)}">${resourceIcon(key)}<span>${escape(RESOURCE_NAMES[key]||key)}</span></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr><th scope="row">Год ${row.year}${row.known&&!row.complete?'<small title="Учёт начат в течение года; итог за весь год неизвестен">неполный учёт</small>':''}</th>${keys.map(key=>`<td>${row.known?`${number.format(row.resources[key]||0)}${row.complete?'':'<span title="Учёт начат в течение года; это только известная часть выпуска">*</span>'}`:'<span class="building-production-unknown" title="Учёт ещё не вёлся">Нет данных</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`}</section>`;
}
