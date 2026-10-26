import {displayName} from './citizen-epithets.js';
import {residentLinkHTML} from './ui-resident-links.js';
import {BUILDINGS,buildingKey} from './definitions.js';
import {PROFESSION_NAMES,professionRole,professionMatchesTask,staffingCandidates} from './professions.js';
export const selectedProfession=(c,desired)=>desired||c.calling||c.futureRole||c.pendingRole||c.role||'auto';
export function citizenProfessionName(c){return PROFESSION_NAMES[c.calling]&&professionRole(c.calling)===c.role?PROFESSION_NAMES[c.calling]:PROFESSION_NAMES[c.role||'auto']||'Авто';}
export function renderStaffing(s,b){
 if(!Object.keys(BUILDINGS[b.type].output).length&&!['healer','depot','waterpoint'].includes(b.type))return '';
 const key=buildingKey(b),fixed=s.citizens.filter(c=>c.workplace===key),current=s.citizens.filter(c=>c.work===key),limit=['healer','musicHouse'].includes(b.type)?1:2;
 return `<section class="staffing-panel"><h4>Работники · ${fixed.length}/${limit} закреплено</h4><small>Сейчас: ${current.map(c=>`${residentLinkHTML(s,c)} · ${citizenProfessionName(c)}`).join(', ')||'никого'}</small>${fixed.map(c=>`<p>${residentLinkHTML(s,c)} · ${citizenProfessionName(c)} <button data-release-worker="${c.id}">Освободить</button></p>`).join('')}<label class="control-label">Закрепить за зданием <select data-pin-building="${key}" aria-label="Закрепить работника: ${BUILDINGS[b.type].name}" ${fixed.length>=limit?'disabled':''}><option value="">Выбрать жителя</option>${staffingCandidates(s.citizens,b).map(c=>`<option value="${c.id}">${displayName(s,c).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · ${citizenProfessionName(c)}${professionMatchesTask(c,b.type)?' · призвание +20%':''}${c.workplace?' · сменит место':''}</option>`).join('')}</select></label><small>Сначала показаны жители с подходящим призванием. Остальные доступные работники остаются в списке. Закрепление места не даёт призвание.</small></section>`;
}
