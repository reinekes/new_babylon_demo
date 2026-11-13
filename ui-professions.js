import {buildingDefinition} from './building-presentation.js';
import {displayName} from './citizen-epithets.js';
import {residentLinkHTML} from './ui-resident-links.js';
import {buildingKey,guardCapacity,isOperational} from './definitions.js';
import {constructionEntities} from './construction.js';
import {activeLaborKind,UNLOAD_PORTERS} from './city-labor.js';
import {isWorkplaceOpen,workplaceHours} from './work-schedule.js';
import {PROFESSION_NAMES,PROFESSION_IDS,innateProfession,inspirationPriceLabel,professionForBuilding,professionRole,professionMatchesTask,staffingCandidates,canStaffBuilding,workplaceCapacity,hasWorkplace} from './professions.js';
import {builderConsent,inspirationReason,inspirationSuccessChance} from './management.js';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const groups=[['Основные',['auto','builder','carrier','production']],['Пища и хозяйство',['farmer','gardener','shepherd','dairyman','fisher','hunter','watercarrier']],['Добыча',['lumberjack','clayworker','reedcutter','quarrier']],['Ремёсла',['potter','brewer','weaver','tailor','brickmaker','kilnworker']],['Службы и культура',['healer','musician','priest','scribe','lawmaker']]];
export function professionOptionsHTML(selected,{recommended,ids=PROFESSION_IDS,lawmaker=false}={}){
 const allowed=new Set(ids.filter(id=>id!=='lawmaker'||lawmaker)),option=id=>`<option value="${id}"${id===selected?' selected':''}>${escape(PROFESSION_NAMES[id])}</option>`,group=(label,items)=>items.length?`<optgroup label="${label}">${items.map(option).join('')}</optgroup>`:'';
 const primary=allowed.has(recommended)?group('Для этой постройки',[recommended]):'';
 return primary+groups.map(([label,items])=>group(label,items.filter(id=>allowed.has(id)&&id!==recommended))).join('');
}
const workforceGroups=[
 ['Строительство и перевозки',['builder','carrier','watercarrier']],
 ['Пища и скот',['farmer','gardener','shepherd','dairyman','fisher','hunter','baker','cheesemaker']],
 ['Сырьё',['lumberjack','clayworker','reedcutter','quarrier']],
 ['Ремёсла',['potter','brewer','weaver','tailor','brickmaker','kilnworker','basketmaker','matmaker','joiner','coppersmith']],
 ['Службы и культура',['healer','musician','priest','scribe','guard','lawmaker']],
 ['Прочие работы',['production']]
];
const workshopJobs={
 bakery:['baker','Пекарь'],dairyStore:['cheesemaker','Сыродел'],
 basketry:['basketmaker','Плетельщик корзин'],matYard:['matmaker','Мастер циновок'],
 joineryYard:['joiner','Столяр'],coppersmith:['coppersmith','Мастер по меди']
};
const workforceNames={...PROFESSION_NAMES,...Object.fromEntries(Object.values(workshopJobs)),guard:'Стражник'};
export function professionStaffing(s,workshops){
 const totals=new Map(),people=s.citizens||[];
 const add=(id,filled,capacity)=>{
  let row=totals.get(id);
  if(!row){row={name:workforceNames[id],filled:0,capacity:0};totals.set(id,row);}
  row.filled+=filled;
  row.capacity+=capacity;
 };
 for(const w of workshops){
  if(!w.staffing)continue;
  const id=professionForBuilding(w.type)||workshopJobs[w.type]?.[0]||'production';
  add(id,w.staffing.count,w.staffing.capacity);
 }
 const crews=new Map(),guards=new Map(),trade=new Map();
 for(const c of people){
  if(c.site&&(c.siteDuty==='builder'||c.siteDuty==='carrier')){const crew=crews.get(c.site)||{builder:0,carrier:0};crew[c.siteDuty]++;crews.set(c.site,crew);}
  if(c.guardPost)guards.set(c.guardPost,(guards.get(c.guardPost)||0)+1);
  const dock=c.tradeMarket||c.saleMarket;
  if(dock)trade.set(dock,(trade.get(dock)||0)+1);
 }
 for(const site of constructionEntities(s)){
  if(!site.construction)continue;
  const crew=crews.get(buildingKey(site)),carriers=crew?.carrier||0;
  add('builder',crew?.builder||0,2);
  add('carrier',carriers,Object.values(site.construction.remaining||{}).some(n=>n>0)?2:carriers);
 }
 const unload=activeLaborKind(s)==='unload';
 for(const b of s.buildings||[]){
  if(!isOperational(b))continue;
  const key=buildingKey(b),capacity=guardCapacity(b.type);
  if(capacity)add('guard',guards.get(key)||0,capacity);
  if(b.type==='market'||b.type==='harbor')add('carrier',trade.get(key)||0,unload?UNLOAD_PORTERS:2);
 }
 const lawmakers=people.filter(c=>(c.age??20)>=16&&c.calling==='lawmaker').length;
 add('lawmaker',lawmakers,0);
 return workforceGroups.map(([label,ids])=>({label,rows:ids.map(id=>({id,...(totals.get(id)||{name:workforceNames[id],filled:0,capacity:0})}))}));
}
export function professionStaffingHTML(s,workshops){
 const sections=professionStaffing(s,workshops).map(({label,rows})=>`<section><h3>${label}</h3><table aria-label="${label}"><thead><tr><th scope="col">Профессия</th><th scope="col">Назначено / мест</th></tr></thead><tbody>${rows.map(({id,name,filled,capacity})=>`<tr data-profession="${id}"><th scope="row">${escape(name)}</th><td${capacity>filled?' class="has-vacancies"':''}>${filled} / ${id==='lawmaker'?'—':capacity}</td></tr>`).join('')}</tbody></table></section>`).join('');
 return `<div class="profession-overview"><p>Рабочие места по назначению. Строители и носильщики на стройках учитываются по действующим площадкам. У законодателя нет отдельного рабочего места.</p><div class="profession-overview-grid">${sections}</div></div>`;
}
function prepareWorker(s,b,draft,limit,fixed){
 const key=escape(buildingKey(b)),recommended=professionForBuilding(b.type)||'production',adults=s.citizens.filter(c=>(c.age??20)>=16).sort((a,c)=>Number(canStaffBuilding(c,b))-Number(canStaffBuilding(a,b))||a.id-c.id),c=adults.find(c=>c.id===draft.citizenId);
 const profession=PROFESSION_IDS.includes(draft.profession)?draft.profession:recommended,reason=c?inspirationReason(s,c.id,profession):'',chance=c?Math.round(inspirationSuccessChance(s,c,profession)*100):0,consent=c?builderConsent(s,c,profession):null;
 const assignment=c&&(fixed.includes(c)?'Уже закреплён':fixed.length>=limit?'Все места заняты':canStaffBuilding(c,b)?'':'Сначала нужна подходящая профессия');
 return `<details class="staff-preparation"${(draft.open??Boolean(c))?' open':''}><summary>Выбрать специальность и вдохновить</summary><label class="control-label">Житель <select data-staff-person="${key}"><option value="">Выбрать взрослого</option>${adults.map(p=>`<option value="resident-${p.id}"${c===p?' selected':''}>${escape(displayName(s,p))} · ${escape(citizenProfessionName(p))}</option>`).join('')}</select></label>${c?`<label class="control-label">Специальность <select data-staff-profession="${key}">${professionOptionsHTML(profession,{recommended})}</select></label><button type="button" data-staff-inspire="${key}"${reason?' disabled':''} title="${escape(reason||(consent===null?'Вера расходуется при любом исходе':'Житель готов принять призвание'))}">Вдохновить · ${inspirationPriceLabel(s)}</button><button type="button" data-staff-assign="${key}"${assignment?' disabled':''} title="${escape(assignment||'Закрепить за зданием')}">Закрепить</button><small>${consent?'Пока не готов':`Шанс ${chance}%`}${reason?` · ${escape(reason)}`:''}${assignment?` · ${escape(assignment)}`:''}</small>${residentCareerHTML(s,c)}`:''}</details>`;
}
export const selectedProfession=(c,desired,s)=>desired||c.calling||c.futureRole||c.pendingRole||(s?.careerRules?innateProfession(s,c):c.role)||'auto';
export function residentCareerHTML(s,c){
 if(!s.careerRules)return '';
 return `<small class="resident-career">Склонность с рождения · ${PROFESSION_NAMES[innateProfession(s,c)]}${c.selfCalling?`<br>Свой выбор · ${PROFESSION_NAMES[c.calling]}`:''}</small>`;
}
export function citizenProfessionName(c){return PROFESSION_NAMES[c.calling]&&professionRole(c.calling)===c.role?PROFESSION_NAMES[c.calling]:PROFESSION_NAMES[c.role||'auto']||'Авто';}
const hourText=hour=>{
 const minutes=Math.round(hour*60);
 return `${String(Math.floor(minutes/60)).padStart(2,'0')}:${String(minutes%60).padStart(2,'0')}`;
};
export function workplaceScheduleHTML(s,b){
 const buildingSite=b.construction?.kind==='new',type=buildingSite?'construction':b.type;
 const hours=workplaceHours(type);
 if(!hours)return '';
 const open=isWorkplaceOpen(type,s.simTime);
 const label=buildingSite?'Часы стройки':'Рабочие часы';
 const status=open?'Рабочее время':`Вне рабочих часов · начало в ${hourText(hours.open)}`;
 return `<p><b>${label} ${hourText(hours.open)}–${hourText(hours.close)}</b> · ${status}</p>`;
}
export function renderStaffing(s,b,draft={}){
 if(!hasWorkplace(b.type))return '';
 const key=buildingKey(b),fixed=s.citizens.filter(c=>c.workplace===key),current=s.citizens.filter(c=>c.work===key),limit=workplaceCapacity(b.type);
 return `<section class="staffing-panel"><h4>Работники · ${fixed.length}/${limit} закреплено</h4><small>Сейчас: ${current.map(c=>`${residentLinkHTML(s,c)} · ${citizenProfessionName(c)}`).join(', ')||'никого'}</small>${fixed.map(c=>`<p>${residentLinkHTML(s,c)} · ${citizenProfessionName(c)}${c.selfCalling?' · выбрал сам':''} <button data-release-worker="${c.id}">Освободить</button></p>`).join('')}<label class="control-label">Закрепить за зданием <select data-pin-building="${key}" aria-label="Закрепить работника: ${buildingDefinition(s,b.type).name}" ${fixed.length>=limit?'disabled':''}><option value="">Выбрать жителя</option>${staffingCandidates(s.citizens,b).map(c=>`<option value="${c.id}">${displayName(s,c).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))} · ${citizenProfessionName(c)}${professionMatchesTask(c,b.type)?' · призвание +20%':''}${c.workplace?' · сменит место':''}</option>`).join('')}</select></label><small>Сначала показаны жители с подходящим призванием. Остальные доступные работники остаются в списке. Закрепление места не даёт призвание.</small>${prepareWorker(s,b,draft,limit,fixed)}</section>`;
}
