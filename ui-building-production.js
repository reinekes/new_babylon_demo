import {BUILDINGS,RESOURCE_NAMES} from './definitions.js';
import {productionHistory} from './building-production-history.js';
import {resourceIcon} from './resource-icons.js';

const seasons=['Весна','Лето','Осень','Зима'];
const number=new Intl.NumberFormat('ru',{maximumFractionDigits:1});
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/** Small shared table for the city work cards and individual building details. */
export function buildingProductionHistoryHTML(s,b){
 const keys=Object.keys(BUILDINGS[b?.type]?.output||{});if(!keys.length)return '';
 const rows=productionHistory(s,b);
 return `<section class="building-production-history" aria-label="Фактическое производство за три сезона"><h4>Последние 3 сезона</h4><p>Фактический выпуск · текущий сезон и два предыдущих</p><div class="building-production-scroll"><table><thead><tr><th scope="col">Сезон</th>${keys.map(key=>`<th scope="col" title="${escape(RESOURCE_NAMES[key]||key)}">${resourceIcon(key)}<span>${escape(RESOURCE_NAMES[key]||key)}</span></th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr${row.current?' class="is-current"':''}><th scope="row">${row.year<1?'До основания':`${seasons[row.season]} · год ${row.year}`}${row.current?'<small>текущий</small>':''}</th>${keys.map(key=>`<td>${row.known?number.format(row.resources[key]||0):'<span class="building-production-unknown" title="Учёт ещё не вёлся">Нет данных</span>'}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
