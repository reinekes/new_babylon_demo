import {buildingKnowledgeReason} from './godhood.js';
import {inspirationPriceLabel} from './professions.js';
import {isOperational,buildingKey} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {preparedFisherInspiration} from './miracle-discovery.js';
import {inspirationReason,inspirationSuccessChance} from './management.js';
import {residentLinkHTML} from './ui-resident-links.js';

export function catDiscoveryHTML(s){
 if(!usesCatDiscovery(s)||!s.catDiscovery)return '';
 const q=s.catDiscovery,initiator=s.citizens.find(c=>c.id===q.initiatorId),origin=initiator?`${residentLinkHTML(s,initiator)} оставил подношение.`:'Подношение рыбака осталось частью истории города.';
 let body;
 if(q.phase==='offering')body=`<p>${origin} У чаши тихо — дождись ночи.</p><button data-cat-focus>Показать чашу</button>`;
 else if(q.phase==='eyes')body=`<p>В темноте возле чаши блеснули два глаза. Дождись рассвета: история ещё продолжается.</p><button data-cat-focus>Показать ночной знак</button>`;
 else if(q.phase==='opened')body=`<p>${q.trial==='ready'?'На глине остались следы лап. Первый призыв не требует веры.':'Кошка пришла по твоему зову. Дар открыт навсегда; следующий призыв стоит 12 веры.'}</p>${q.trial==='ready'?'<button data-cat-cast>Открыть первый призыв · 0 веры</button>':''}<button data-cat-focus>Показать след</button>`;
 else {
  if(s.godhood?.stage!=='recognized')return '';
  const people=s.citizens.filter(c=>c.age>=16),lessons=c=>s.catFishing?.lessons?.[c.id]||0;
  const c=people.find(c=>c.calling==='fisher'&&lessons(c)===3)||people.find(c=>c.id===s.catFishing?.candidateId)||[...people].sort((a,b)=>lessons(b)-lessons(a)||a.id-b.id).find(c=>lessons(c)>0);
  if(!c){
   const fisheries=s.buildings.filter(b=>b.type==='fishing'),ready=fisheries.filter(isOperational),staffed=ready.some(b=>s.citizens.some(person=>person.work===buildingKey(b)||person.workplace===buildingKey(b)));
   const locked=buildingKnowledgeReason(s,'fishing');
   body=!fisheries.length?`<p>Начни с рыбацкой хижины у воды. Рыбак должен добыть три собственных улова, а носильщики — доставить их на склад.</p><button type="button" data-awakening-build="fishing"${locked?' disabled':''}>Построить рыбацкую хижину</button>${locked?`<small>${locked}</small>`:''}`:!ready.length?'<p>Дострой рыбацкую хижину: строителю нужны доставленные материалы и время. Затем рыбаки смогут добывать свои первые уловы.</p>':staffed?'<p>Рыбаки назначены к хижине. Дождись настоящего улова и его приёмки складом: рыба у хижины ещё не засчитана.</p>':'<p>Рыбацкая хижина готова. Проверь производственную работу жителей: нужны три собственных улова и их доставка на склад.</p><button data-awakening-work>Проверить работу хижины</button>';
  }
  else if(lessons(c)<3)body=`<p>${residentLinkHTML(s,c)} · принято уловов ${lessons(c)} из 3. Важно дождаться доставки на склад: рыба у хижины ещё не засчитана.</p>`;
  else if(c.calling!=='fisher'){
   const reason=inspirationReason(s,c.id,'fisher'),guaranteed=preparedFisherInspiration(s,c,'fisher');
   body=`<p>${residentLinkHTML(s,c)} доставил три собственных улова. Теперь предложи ему призвание рыбака.</p><button data-cat-fisher="${c.id}" ${reason?'disabled':''}>Вдохновить рыбаком · ${inspirationPriceLabel(s)}</button><small>${reason|| (guaranteed?'Первое призвание подготовленного рыбака обязательно удастся.':`Шанс принятия: ${Math.round(inspirationSuccessChance(s,c,'fisher')*100)}%. Вера расходуется и при отказе.`)}</small>`;
  }else if(c.role!=='production'||c.pendingRole)body=`<p>${residentLinkHTML(s,c)} уже знает призвание. ${c.pendingRole?'Дождись завершения доставки и смены работы.':'В разделе «Работа» верни ему производственную работу.'}</p><button data-awakening-work>Открыть работу жителей</button>`;
  else body=`<p>${residentLinkHTML(s,c)} готов. Нужны незащищённое хранилище и сухой свободный двор. Для подношения — малая порция еды сверх семян и двух приёмов пищи либо чаша настоящей домашней воды.</p><small>Продолжи время: рыбак оставит подношение, когда всё будет готово.</small>`;
 }
 return `<section class="cat-discovery-guide" aria-label="Дар кошки"><span class="eyebrow">ДАР КОШКИ</span><h3>Тот, кто пришёл без приглашения</h3>${body}</section>`;
}
