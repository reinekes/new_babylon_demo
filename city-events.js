import {affectResidents} from './wellbeing.js';
import {availableFood} from './food-planning.js';
import {syncInventory} from './inventory.js';
import {RESOURCE_NAMES,buildingKey,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

// Narrative decisions are game abstractions, distinct from workshop production.
export const CITY_EVENTS=Object.freeze([
 {id:'festival',name:'Ночь огней',title:'Ночь тысячи огней',text:'Подготовь общинный пир: 15 престижа, 12 еды и 6 напитков. Носильщики доставят угощение к храму; сытые взрослые соберутся после ужина.',acceptLabel:'Подготовить праздник',skipLabel:'Сохранить запасы',music:'nightLights',effectId:'blessing'},
 {id:'caravan',name:'Торговые гости',title:'Караван у переправы',text:'Гости предлагают 25 глины и 20 тростника за 35 еды.',acceptLabel:'Обменять еду',skipLabel:'Отказаться от обмена',music:'grown',effectId:'abundance'},
 {id:'refugees',name:'Новые семьи',title:'Люди у городских ворот',text:'Прими до шести жителей за 20 еды — если для них найдётся жильё.',acceptLabel:'Принять людей',skipLabel:'Сохранить запасы',music:'grown',effectId:'newLife'},
 {id:'riverGift',name:'Дар разлива',title:'Река оставила дары',text:'После малой воды на берегу остались тростник и пригодная глина. Собрать их: +24 тростника, +12 глины и +3 престижа.',acceptLabel:'Собрать дары берега',skipLabel:'Оставить берег в покое',cost:{},gain:{reed:24,clay:12,prestige:3},music:'grown',effectId:'rain'},
 {id:'potterVisit',name:'Странствующий гончар',title:'Мастер с соседнего берега',text:'Гончар предлагает шесть новых сосудов в обмен на 12 еды. Обмен принесёт ещё 4 престижа.',acceptLabel:'Обменять 12 еды',skipLabel:'Проводить мастера',cost:{food:12},gain:{pottery:6,prestige:4},music:'nightLights',effectId:'craft'},
 {id:'wellRepair',name:'Забота об источнике',title:'Община чистит водозабор',text:'Выдели 8 еды и 6 тростника для общего дня у воды. Участие поднимет настроение на 4 и здоровье на 3.',acceptLabel:'Поддержать общину',skipLabel:'Отложить сбор',cost:{food:8,reed:6},gain:{},residents:{mood:4,health:3},music:'night',effectId:'rain'},
 {id:'harvestThanks',name:'Благодарность за урожай',title:'Колосья у порога',text:'Семьи предлагают разделить 8 еды и 2 напитка. Настроение +8, личная вера +3, престиж +6.',acceptLabel:'Разделить угощение',skipLabel:'Сберечь припасы',cost:{food:8,beer:2},gain:{prestige:6},residents:{mood:8,faith:3},music:'nightLights',effectId:'abundance'},
 {id:'storyteller',name:'Певец у вечернего огня',title:'История, которую запомнят',text:'Угости гостя 6 едой. Его вечерняя песня поднимет настроение жителей на 5 и принесёт 4 престижа.',acceptLabel:'Угостить певца',skipLabel:'Пожелать доброго пути',cost:{food:6},gain:{prestige:4},residents:{mood:5},music:'nightLights',effectId:'blessing'}
]);
export const cityEventDefinition=id=>CITY_EVENTS.find(e=>e.id===id)||null;
export const createCityEvent=(_s,id)=>{const d=cityEventDefinition(id);return d?{id:d.id,title:d.title,text:d.text}:null;};
export const isAdditionalCityEvent=id=>!!cityEventDefinition(id)?.cost;
export function cityEventReason(s,id=s.event?.id){
 const d=cityEventDefinition(id);if(!d?.cost)return '';
 syncInventory(s);
 for(const [key,amount]of Object.entries(d.cost))if((key==='food'?availableFood(s):s.resources[key]||0)<amount)return `Нужно ${amount} ${RESOURCE_NAMES[key]||key}`;
 return '';
}
export function applyCityEvent(s,id,choice){
 const d=cityEventDefinition(id);if(!d?.cost||!['accept','skip'].includes(choice))return {ok:false,reason:'Нет такого решения'};
 if(choice==='skip')return {ok:true};const reason=cityEventReason(s,id);if(reason)return {ok:false,reason};
 for(const [key,amount]of Object.entries(d.cost))s.resources[key]-=amount;
 for(const [key,amount]of Object.entries(d.gain))s.resources[key]=Math.min(1e9,(s.resources[key]||0)+amount);
 if(d.residents)affectResidents(s,d.residents);
 if(d.residents?.health)for(const person of s.citizens)person.health=Math.min(100,person.health+d.residents.health);
 if(id==='wellRepair'&&fearTension(s)>0){
  const crew=waterThreatQuote(s)?.people;
  if(crew?.length){
   s.fearCrisis.tension=fearTension(s)-1;
   affectResidents(s,{faith:4},crew.map(person=>person.id));
  }
 }
 syncInventory(s);return {ok:true};
}

export const fearTension=s=>s.fearCrisis?.tension??Number(!!s.fearCrisis?.last);
const THREAT_REED=6;
const THREAT_MOOD=12;
const THREAT_FAITH=8;
export function waterThreatQuote(s){
 if(!s.fearCrisis||s.event?.id!=='wellRepair')return null;
 for(const station of s.buildings){
  if(station.type!=='waterpoint'||!isOperational(station)||station.floodDamage)continue;
  const people=s.citizens.filter(c=>c.work===buildingKey(station)&&c.role==='watercarrier'&&c.age>=16&&
   c.health>=60&&!c.clinic&&!c.floodShelter&&!c.fireShelter);
  if(!people.length)continue;
  const reason=s.resources.reed<THREAT_REED?`Нужно ${THREAT_REED} тростника`:'';
  return {station,people,reason,text:`Водозабор ${station.x}, ${station.y} · бригада ${people.length} чел. Цена: ${THREAT_REED} тростника. Здоровье +3, настроение −${THREAT_MOOD}, личная вера −${THREAT_FAITH} у бригады.`};
 }
 return {reason:'У действующих водозаборов нет доступной бригады'};
}

export function applyWaterThreat(s){
 const quote=waterThreatQuote(s);
 if(!quote||quote.reason)return {ok:false,reason:quote?.reason||'Нет такого решения'};
 syncInventory(s);
 s.resources.reed-=THREAT_REED;
 const {station,people}=quote;
 const ids=people.map(c=>c.id);
 affectResidents(s,{mood:-THREAT_MOOD,faith:-THREAT_FAITH},ids);
 for(const person of people)person.health=Math.min(100,person.health+3);
 s.fearCrisis.tension=fearTension(s)+1;
 s.fearCrisis.last={at:s.simTime,x:station.x,y:station.y,people:ids};
 syncInventory(s);
 return {ok:true};
}

export function validateFearCrisis(s){
 const crisis=s.fearCrisis;
 if(crisis===undefined)return true;
 if(!usesCatDiscovery(s)||!crisis||crisis.version!==1||
  Object.keys(crisis).length!==1+Number(crisis.last!==undefined)+Number(crisis.tension!==undefined))return false;
 if(crisis.tension!==undefined&&(!crisis.last||!Number.isSafeInteger(crisis.tension)||crisis.tension<0))return false;
 const last=crisis.last;
 return last===undefined||!!last&&Object.keys(last).length===4&&Number.isFinite(last.at)&&last.at>=0&&last.at<=s.simTime&&
  Number.isInteger(last.x)&&last.x>=0&&last.x<worldWidth(s)&&Number.isInteger(last.y)&&last.y>=0&&last.y<worldHeight(s)&&
  Array.isArray(last.people)&&last.people.length>0&&new Set(last.people).size===last.people.length&&
  last.people.every(id=>Number.isSafeInteger(id)&&id>=0&&id<s.demography.nextId);
}
