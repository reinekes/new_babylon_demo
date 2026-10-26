import {citizenName,MATERIALS} from './definitions.js';
import {PROFESSION_NAMES,professionRole} from './professions.js';

const jobs={builder:['Строитель','Строительница'],carrier:['Носильщик','Носильщица'],production:['Мастер','Мастерица'],healer:['Лекарь','Лекарка'],tailor:['Мастер Одежды','Мастерица Одежды'],watercarrier:['Водонос','Водоносица'],farmer:['Земледелец','Земледелица'],gardener:['Садовник','Садовница'],lumberjack:['Лесоруб','Лесорубка'],clayworker:['Глинокоп','Глинокопка'],reedcutter:['Тростничник','Тростничница'],quarrier:['Каменотёс','Каменотёска'],potter:['Гончар','Гончарка'],brewer:['Пивовар','Пивоварка'],weaver:['Ткач','Ткачиха'],shepherd:['Пастух','Пастушка'],fisher:['Рыбак','Рыбачка'],hunter:['Охотник','Охотница'],brickmaker:['Формовщик Кирпича','Формовщица Кирпича'],kilnworker:['Обжигальщик','Обжигальщица'],priest:['Жрец','Жрица'],dairyman:['Смотритель Стада','Смотрительница Стада']};
export const EPITHETS=Object.freeze({...Object.fromEntries(Object.entries(jobs).map(([id,names])=>[`job:${id}`,Object.freeze(names)])),stubborn:Object.freeze(['Упрямый','Упрямая']),steadfast:Object.freeze(['Упорный','Упорная']),inspired:Object.freeze(['Вдохновлённый','Вдохновлённая']),storeSupport:Object.freeze(['Опора Склада','Опора Склада']),provider:Object.freeze(['Кормилец','Кормилица']),waterkeeper:Object.freeze(['Хранитель Воды','Хранительница Воды']),reaper:Object.freeze(['Жнец','Жница']),craftmaster:Object.freeze(['Умелец','Умелица']),claymaster:Object.freeze(['Мастер Глины','Мастерица Глины']),healer:Object.freeze(['Целитель','Целительница']),masterhealer:Object.freeze(['Искусный Лекарь','Искусная Лекарка']),parent:Object.freeze(['Отец','Мать']),manyChildren:Object.freeze(['Многодетный','Многодетная']),grandparent:Object.freeze(['Прародитель','Прародительница']),elder:Object.freeze(['Старший','Старшая']),venerable:Object.freeze(['Старейшина','Старейшина']),prayer:Object.freeze(['Молящийся','Молящаяся']),famineSurvivor:Object.freeze(['Переживший голод','Пережившая голод']),recovered:Object.freeze(['Выздоровевший','Выздоровевшая'])});
const HISTORY_LIMIT=8;
const counters=['inspirationFailures','failureStreak','inspirationSuccesses','delivered','foodDelivered','waterDelivered','produced','foodProduced','craftProduced','clayProduced'];
const integer=n=>Number.isSafeInteger(n)&&n>=0;
const finite=n=>Number.isFinite(n)&&n>=0&&n<=1e12;
const amount=n=>finite(n)?n:0;
const adult=c=>(c.age??20)>=16;
const subject=(s,value)=>typeof value==='number'?(s.citizens||[]).find(c=>c.id===value)||(s.lifeAnalytics?.people||[]).find(c=>c.id===value)||{id:value}:value;
const label=(key,c)=>EPITHETS[key]?.[c.sex==='f'?1:0]||'';
const time=s=>({tick:s.tick||0,year:s.year||1,season:s.season||0});
const evidence=c=>c.epithetEvidence??=( {seen:[]} );
function remembered(e,key){e.seen??=[];if(e.seen.includes(key))return false;e.seen.push(key);return true;}
function setEpithet(s,c,key,reason){
 if(!EPITHETS[key]||c.epithet?.key===key)return false;
 const row={key,reason,...time(s)};c.epithet=row;c.epithetHistory=[...(c.epithetHistory||[]),{...row}].slice(-HISTORY_LIMIT);return true;
}
const activeProfession=c=>professionRole(c.calling)===c.role?c.calling:c.role||'auto';

/** Derived labels never overwrite a birth name, registry name, stable ID or cargo. */
export function displayName(s,value){const c=subject(s,value);if(!c)return '';const base=c.birthName||c.baseName||c.name||citizenName(c.id),byname=label(c.epithet?.key,c);return `${base}${byname?` ${byname}`:''}`;}
export function epithetInfo(s,value){const c=subject(s,value)||{};return {label:label(c.epithet?.key,c),reason:c.epithet?.reason||'',history:(c.epithetHistory||[]).map(row=>({...row,label:label(row.key,c)}))};}
export function recordProfessionEpithet(s,c){
 if(!adult(c))return false;const id=activeProfession(c),e=evidence(c);if(e.lastProfession===id)return false;e.lastProfession=id;
 return id!=='auto'&&EPITHETS[`job:${id}`]?setEpithet(s,c,`job:${id}`,`Выбрано занятие: ${PROFESSION_NAMES[id]||id}.`):false;
}
export function recordInspirationOutcome(s,c,success){
 const e=evidence(c),failures=e.failureStreak||0;
 if(success){e.inspirationSuccesses=(e.inspirationSuccesses||0)+1;e.failureStreak=0;if(failures>=3)return setEpithet(s,c,'steadfast',`Принял вдохновение после ${failures} неудачных попыток подряд.`);if(!adult(c))return setEpithet(s,c,'inspired','Принял вдохновение; выбранное занятие начнёт после взросления.');return recordProfessionEpithet(s,c);}
 e.inspirationFailures=(e.inspirationFailures||0)+1;e.failureStreak=failures+1;
 return e.failureStreak>=3?setEpithet(s,c,'stubborn','Не принял как минимум 3 вдохновения подряд.'):false;
}
function milestone(s,c,key,ready,reason){const e=evidence(c);return ready&&remembered(e,key)?setEpithet(s,c,key,reason):false;}
export function recordCitizenDelivery(s,c,goods){
 if(!adult(c))return false;const total=Object.entries(goods||{}).filter(([key,value])=>(MATERIALS.includes(key)||key==='water')&&finite(value)).reduce((n,[,value])=>n+value,0);if(total<=0)return false;
 const e=evidence(c);e.delivered=(e.delivered||0)+total;e.foodDelivered=(e.foodDelivered||0)+amount(goods.food);e.waterDelivered=(e.waterDelivered||0)+amount(goods.water);
 if(milestone(s,c,'provider',e.foodDelivered>=100,'Лично доставил не менее 100 единиц еды.'))return true;
 if(milestone(s,c,'waterkeeper',e.waterDelivered>=50,'Лично доставил не менее 50 единиц воды.'))return true;
 return milestone(s,c,'storeSupport',e.delivered>=100,'Лично доставил не менее 100 единиц грузов.');
}
export function recordCitizenHarvest(s,c,goods){
 if(!adult(c))return false;const valid=Object.entries(goods||{}).filter(([key,value])=>MATERIALS.includes(key)&&finite(value)),total=valid.reduce((n,[,value])=>n+value,0);if(total<=0)return false;
 const e=evidence(c);e.produced=(e.produced||0)+total;e.foodProduced=(e.foodProduced||0)+amount(goods.food);e.craftProduced=(e.craftProduced||0)+valid.filter(([key])=>['cloth','clothing','pottery','beer','brick','firedBrick'].includes(key)).reduce((n,[,value])=>n+value,0);e.clayProduced=(e.clayProduced||0)+valid.filter(([key])=>['clay','pottery','brick','firedBrick'].includes(key)).reduce((n,[,value])=>n+value,0);
 if(milestone(s,c,'reaper',e.foodProduced>=100,'Лично собрал или произвёл не менее 100 единиц еды.'))return true;
 if(milestone(s,c,'claymaster',e.clayProduced>=100,'Лично добыл или обработал не менее 100 единиц глины и изделий из неё.'))return true;
 return milestone(s,c,'craftmaster',e.craftProduced>=50,'Лично изготовил не менее 50 единиц ремесленных изделий.');
}

/** Explicit season hook. Facts are observed now; lost old-save history is never
 * reconstructed. No heroism is inferred from an ID, role or random nickname. */
export function syncCitizenEpithets(s){
 const people=s.lifeAnalytics?.people||s.citizens||[];
 for(const c of s.citizens||[]){const e=evidence(c);recordProfessionEpithet(s,c);const candidates=[];
  const fact=(key,ready,reason,priority)=>{if(ready&&remembered(e,key))candidates.push({key,reason,priority});};
  if((c.hunger||0)>=90&&(c.health??100)<=40||(c.missedMeals||0)>=3)e.hungerCrisis=true;
  if(c.clinic)e.wasPatient=true;
  fact('famineSurvivor',e.hungerCrisis&&!e.famineRecovered&&(c.hunger||0)<=20&&(c.health??100)>=60&&(c.missedMeals||0)===0,'Пережил наблюдавшийся тяжёлый голод и снова сыт; здоровье восстановилось.',100);
  if(candidates.some(v=>v.key==='famineSurvivor'))e.famineRecovered=true;
  fact('recovered',e.wasPatient&&!c.clinic&&(c.health??0)>=85,'После наблюдавшегося лечения восстановил здоровье до 85% или выше.',55);
  if(adult(c)){
   const children=people.filter(p=>(p.parents||[]).includes(c.id)),grandchildren=people.filter(p=>(p.parents||[]).some(id=>children.some(child=>child.id===id)));
   fact('parent',children.length>0,`В родословной записан родитель ${children.length} ${children.length===1?'ребёнка':'детей'}.`,25);
   fact('manyChildren',children.length>=3,'В родословной записаны как минимум трое детей.',35);
   fact('grandparent',grandchildren.length>0,'В родословной записаны внуки.',45);
   fact('elder',c.age>=55,'Достиг возраста 55 лет.',30);fact('venerable',c.age>=70,'Достиг возраста 70 лет.',50);
   fact('prayer',(c.prayerTotal||0)>=5,'Личные молитвы принесли городу не менее 5 единиц веры.',20);
   fact('healer',(c.medicine?.practice||0)>=30,'Врачебная практика восстановила пациентам не менее 30 единиц здоровья.',70);
   fact('masterhealer',(c.medicine?.level||0)>=3,'Достиг третьего уровня лекарского мастерства.',80);
  }
  const chosen=candidates.sort((a,b)=>b.priority-a.priority)[0];if(chosen)setEpithet(s,c,chosen.key,chosen.reason);
 }
}

function validPerson(s,c){
 const validRow=row=>row&&Object.hasOwn(EPITHETS,row.key)&&typeof row.reason==='string'&&row.reason.length>0&&row.reason.length<=300&&integer(row.tick)&&row.tick<=(s.tick||0)&&Number.isSafeInteger(row.year)&&row.year>=1&&row.year<=(s.year||1)&&Number.isInteger(row.season)&&row.season>=0&&row.season<4&&((row.year-1)*4+row.season)<=((s.year||1)-1)*4+(s.season||0);
 if(c.epithet!==undefined&&!validRow(c.epithet))return false;
 if(c.epithetHistory!==undefined&&(!Array.isArray(c.epithetHistory)||c.epithetHistory.length>HISTORY_LIMIT||c.epithetHistory.some((row,index,rows)=>!validRow(row)||index&&row.tick<rows[index-1].tick)))return false;
 const e=c.epithetEvidence;
 if(e!==undefined){
  if(!e||typeof e!=='object'||Array.isArray(e)||Object.keys(e).some(key=>![...counters,'seen','lastProfession','hungerCrisis','famineRecovered','wasPatient'].includes(key))||counters.some(key=>e[key]!==undefined&&!finite(e[key])))return false;
  if(['inspirationFailures','failureStreak','inspirationSuccesses'].some(key=>e[key]!==undefined&&!integer(e[key]))||(e.failureStreak||0)>(e.inspirationFailures||0))return false;
  if(e.seen!==undefined&&(!Array.isArray(e.seen)||e.seen.length>64||new Set(e.seen).size!==e.seen.length||e.seen.some(key=>!Object.hasOwn(EPITHETS,key))))return false;
  if(e.lastProfession!==undefined&&!Object.hasOwn(PROFESSION_NAMES,e.lastProfession)||['hungerCrisis','famineRecovered','wasPatient'].some(key=>e[key]!==undefined&&typeof e[key]!=='boolean'))return false;
 }
 return true;
}
export function validateCitizenEpithets(s){return [...s.citizens||[],...s.lifeAnalytics?.people||[]].every(c=>validPerson(s,c));}
