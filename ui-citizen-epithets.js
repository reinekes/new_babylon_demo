import {epithetInfo} from './citizen-epithets.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const seasons=['весна','лето','осень','зима'];
export function citizenEpithetHTML(s,c){
 const info=epithetInfo(s,c);if(!info.label)return '';
 return `<aside class="citizen-epithet"><p><b>${escape(info.label)}</b> · ${escape(info.reason)}</p>${info.history.length?`<details><summary>История прозвищ · ${info.history.length}</summary><ol>${[...info.history].reverse().map(row=>`<li><b>${escape(row.label)}</b><small>Год ${row.year} · ${seasons[row.season]}</small><span>${escape(row.reason)}</span></li>`).join('')}</ol></details>`:''}</aside>`;
}
