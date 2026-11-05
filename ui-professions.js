import {buildingDefinition} from './building-presentation.js';
import {displayName} from './citizen-epithets.js';
import {residentLinkHTML} from './ui-resident-links.js';
import {buildingKey} from './definitions.js';
import {PROFESSION_NAMES,PROFESSION_IDS,professionForBuilding,professionRole,professionMatchesTask,staffingCandidates,canStaffBuilding,workplaceCapacity,hasWorkplace} from './professions.js';
import {inspirationReason,inspirationSuccessChance} from './management.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=[['Основные',['auto','builder','carrier','production']],['Пища и хозяйство',['farmer','gardener','shepherd','dairyman','fisher','hunter','watercarrier']],['Добыча',['lumberjack','clayworker','reedcutter','quarrier']],['Ремёсла',['potter','brewer','weaver','tailor','brickmaker','kilnworker']],['Службы и культура',['healer','musician','priest','scribe']]];
export function professionOptionsHTML(selected,{recommended,ids=PROFESSION_IDS}={}){
 const allowed=new Set(ids),option=id=>`<option value="${id}"${id===selected?' selected':''}>${escape(PROFESSION_NAMES[id])}</option>`,group=(label,items)=>items.length?`<optgroup label="${label}">${items.map(option).join('')}</optgroup>`:'';
 const primary=allowed.has(recommended)?group('Для этой постройки',[recommended]):'';
 return primary+groups.map(([label,items])=>group(label,items.filter(id=>allowed.has(id)&&id!==recommended))).join('');
}
function prepareWorker(s,b,draft,limit,fixed){
 const key=escape(buildingKey(b)),recommended=professionForBuilding(b.type)||'production',adults=s.citizens.filter(c=>(c.age??20)>=16).sort((a,c)=>Number(canStaffBuilding(c,b))-Number(canStaffBuilding(a,b))||a.id-c.id),c=adults.find(c=>c.id===draft.citizenId);
 const profession=PROFESSION_IDS.includes(draft.profession)?draft.profession:recommended,reason=c?inspirationReason(s,c.id,profession):'',chance=c?Math.round(inspirationSuccessChance(s,c,profession)*100):0;
 const assignment=c&&(fixed.includes(c)?'Уже закреплён':fixed.length>=limit?'Все места заняты':canStaffBuilding(c,b)?'':'Сначала нужна подходящая профессия');
 return `<details class="staff-preparation"${(draft.open??Boolean(c))?' open':''}><summary>Выбрать специальность и вдохновить</summary><label class="control-label">Житель <select data-staff-person="${key}"><option value="">Выбрать взрослого</option>${adults.map(p=>`<option value="resident-${p.id}"${c===p?' selected':''}>${escape(displayName(s,p))} · ${escape(citizenProfessionName(p))}</option>`).join('')}</select></label>${c?`<label class="control-label">Специальность <select data-staff-profession="${key}">${professionOptionsHTML(profession,{recommended})}</select></label><button type="button" data-staff-inspire="${key}"${reason?' disabled':''} title="${escape(reason||'Вера расходуется при любом исходе')}">Вдохновить · 1 вера</button><button type="button" data-staff-assign="${key}"${assignment?' disabled':''} title="${escape(assignment||'Закрепить за зданием')}">Закрепить</button><small>Шанс ${chance}%${reason?` · ${escape(reason)}`:''}${assignment?` · ${escape(assignment)}`:''}</small>`:''}</details>`;
}
export const selectedProfession=(c,desired)=>desired||c.calling||c.futureRole||c.pendingRole||c.role||'auto';
export function citizenProfessionName(c){return PROFESSION_NAMES[c.calling]&&professionRole(c.calling)===c.role?PROFESSION_NAMES[c.calling]:PROFESSION_NAMES[c.role||'auto']||'Авто';}
export function renderStaffing(s,b,draft={}){
 if(!hasWorkplace(b.type))return '';
 const key=buildingKey(b),fixed=s.citizens.filter(c=>c.workplace===key),current=s.citizens.filter(c=>c.work===key),limit=workplaceCapacity(b.type);
 return `<section class="staffing-panel"><h4>Работники · ${fixed.length}/${limit} закреплено</h4><small>Сейчас: ${current.map(c=>`${residentLinkHTML(s,c)} · ${citizenProfessionName(c)}`).join(', ')||'никого'}</small>${fixed.map(c=>`<p>${residentLinkHTML(s,c)} · ${citizenProfessionName(c)} <button data-release-worker="${c.id}">Освободить</button></p>`).join('')}<label class="control-label">Закрепить за зданием <select data-pin-building="${key}" aria-label="Закрепить работника: ${buildingDefinition(s,b.type).name}" ${fixed.length>=limit?'disabled':''}><option value="">Выбрать жителя</option>${staffingCandidates(s.citizens,b).map(c=>`<option value="${c.id}">${displayName(s,c).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · ${citizenProfessionName(c)}${professionMatchesTask(c,b.type)?' · призвание +20%':''}${c.workplace?' · сменит место':''}</option>`).join('')}</select></label><small>Сначала показаны жители с подходящим призванием. Остальные доступные работники остаются в списке. Закрепление места не даёт призвание.</small>${prepareWorker(s,b,draft,limit,fixed)}</section>`;
}
