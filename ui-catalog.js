import {ABUNDANCE_LIMIT} from './abundance-gift.js';
import {miraclePrice} from './miracle-discovery.js';
import {miracleKnowledgeReason} from './godhood.js';
import {DOMAIN_NAMES} from './divinity.js';
import {buildingDefinition} from './building-presentation.js';
import {MIRACLES,buildingKey,isOperational} from './definitions.js';
import {sacredMiracleUnlocked} from './sacred-unlocks.js';

// Ordinary powers remain in the catalogue while unavailable. Only earned blue
// gifts appear after their building or relic has actually unlocked them.
export function shouldShowMiracle(s,id){
 if(id==='richCatch')return !!s.richCatchEvidence;
 const m=MIRACLES[id];return !!m&&(!(m.unlockBuilding||m.unlockQuest)||sacredMiracleUnlocked(s,id));
}

export const BUILDING_GROUPS=[
 {id:'life',name:'Жители',types:['house','healer','musicHouse']},
 {id:'food',name:'Пища',types:['field','garden','fishing','hunting','cowshed']},
 {id:'materials',name:'Сырьё',types:['clay','reed','logging','quarry']},
 {id:'craft',name:'Ремёсла',types:['pottery','brewery','bakery','linenYard','dairyStore','basketry','matYard','coppersmith','joineryYard','kiln','brickyard','sheepfold','weaver','tailor']},
 {id:'supply',name:'Снабжение',types:['waterpoint','granary','depot','market']},
 {id:'sacred',name:'Храмы',types:['shrine','ziggurat','ishtarGate']},
 {id:'routes',name:'Пути и вода',types:['canal','levee','bridge','harbor','cityWall','cityGate']}
];
export const groupFor=type=>BUILDING_GROUPS.find(g=>g.types.includes(type));

// Keep catalogue copy current when loading a city from another historical branch.
export function updateBuildingCardName(card,state){
 const def=buildingDefinition(state,card.dataset.type),strong=card.querySelector('.build-copy strong');
 if(!def||!strong||strong.textContent===def.name)return;
 strong.textContent=def.name;
 const info=card.parentElement?.querySelector('.building-info');
 if(info){info.setAttribute('aria-label',`О здании: ${def.name}`);info.title=`Описание: ${def.name}`;}
}

// Reused cards must update every visible/accessible price when switching saves.
export function updateMiracleCard(details,s,id,reason='',gift=null,arrival=null){
 const m=MIRACLES[id],price=miraclePrice(s,id),el=details.querySelector('.miracle-cast'),first=price===0;
 const desc=id==='stars'&&s.starObservations?'+18 престижа. До трёх прогнозов по хозяйству в обзоре города до смены сезона.':id==='peace'&&s.peaceDiscovery?'Поддерживает жителей выбранного квартала и поднимает им настроение.':id==='healing'&&s.arrivalHospitality?'Приглашает путников. Жители войдут в город после прибытия в подготовленный дом.':id==='shaping'&&s.shapingProjects?'Создаёт штабель из 60 глины и 40 тростника у выбранного ремесленного двора. Носильщики доставят материалы на склады.':id==='revelation'&&s.revelationEvidence?'Совет о следующем шаге выбранной ветви и +12 престижа.':id==='fertility'&&s.richCatchEvidence?'Урожай полей и садов ×1,6 на три сезона. В выбранном месте расцветает волшебный сад.':id==='abundance'&&s.abundanceGift?'До 45 еды в выбранное хранилище. Укажи его на карте перед применением.':m.desc;
 const description=details.querySelector('.miracle-description');if(description)description.textContent=desc;
 const history=details.querySelector('[data-miracle-history]');
 if(history){
  const trial=s.miracleHistory?.trials[id],paid=s.miracleHistory?.paid[id];
  const entries=[];
  if(trial)entries.push('Бесплатная проба использована');
  if(paid)entries.push(`Последнее платное применение · ${paid.faithSpent} веры`);
  const outcome=paid?.population;
  if(outcome?.happiness>0)entries.push(`Довольство +${outcome.happiness.toLocaleString('ru-RU',{maximumFractionDigits:2})}`);
  if(outcome?.newResidents>0)entries.push(`Заселилось: ${outcome.newResidents} чел.`);
  if(outcome?.reserved>0)entries.push(`Места зарезервированы: ${outcome.reserved} чел.`);
  const text=entries.join('. ');
  history.hidden=!text;
  if(history.textContent!==text)history.textContent=text;
 }
 const preview=details.querySelector('.abundance-quote');
 if(preview){
  const show=n=>n.toLocaleString('ru-RU',{maximumFractionDigits:2});
  preview.hidden=!gift?.store;
  const text=gift?.store?`${buildingDefinition(s,gift.store.type).name} · ${gift.store.x}, ${gift.store.y}. Свободно: ${show(gift.room)}. Получишь ${show(gift.amount)} из ${ABUNDANCE_LIMIT} еды.`:'';
  if(preview.textContent!==text)preview.textContent=text;
 }
 if(id==='healing'){
  if(arrival){el.dataset.arrivalCount=arrival.beds;el.dataset.arrivalHome=arrival.home;}
  else{delete el.dataset.arrivalCount;delete el.dataset.arrivalHome;}
 }
 el.disabled=!!reason;el.textContent=`${arrival?`Позвать ${arrival.beds} чел.`:id==='cat'?'Призвать':first?'Первый призыв':'Применить'} · ${price} веры`;
 el.title=`${m.name} · ${price} веры. ${desc} Домен: ${DOMAIN_NAMES[m.domain]}. ${reason}`;el.setAttribute('aria-label',`Применить: ${el.title}`);
 details.hidden=false;details.classList.toggle('knowledge-locked',!!miracleKnowledgeReason(s,id));
 details.querySelector('.miracle-facts span').textContent=`${price} веры${first?' · первый дар':''}`;
 details.querySelector('.miracle-summary-status').textContent=reason||`${price} веры · ${first?'первый дар':DOMAIN_NAMES[m.domain]}`;
 let advisory='';
 if(id==='inspiration'&&s.creatorMaterials&&!reason){
  const yards=new Set(s.buildings.filter(b=>['clay','reed'].includes(b.type)&&isOperational(b)).map(buildingKey));
  const handOrders=s.manualGathering?.orders.some(q=>q.active&&['clay','reed'].includes(q.resource));
  if(!handOrders&&!s.citizens.some(c=>yards.has(c.work)))advisory='Назначь работников в добывающие дворы или дай поручение на ручной сбор глины и тростника.';
 }
 const note=details.querySelector('.miracle-unavailable');note.hidden=!(reason||advisory);note.textContent=reason||advisory;
}
