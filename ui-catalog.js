import {FAMILY_BLESSING_DESCRIPTION,blessingSupportsFamilies} from './blessing-discovery.js';
import {ABUNDANCE_LIMIT} from './abundance-gift.js';
import {miraclePrice} from './miracle-discovery.js';
import {previousMiracleCastNumber} from './miracle-history.js';
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

export const CRAFT_GROUPS=[
 {id:'clay',name:'Глина и кирпич',types:['pottery','brickyard','kiln']},
 {id:'textiles',name:'Ткань и тростник',types:['sheepfold','weaver','tailor','linenYard','basketry','matYard']},
 {id:'materials',name:'Дерево и металл',types:['joineryYard','coppersmith']},
 {id:'food',name:'Еда и напитки',types:['bakery','brewery','dairyStore']}
];
export const craftGroupFor=type=>CRAFT_GROUPS.find(group=>group.types.includes(type));

export function bindCraftTabs(section){
 const {ownerDocument:document}=section,list=section.querySelector('[data-craft-tabs]'),tabs=[];
 list.setAttribute('role','tablist');list.setAttribute('aria-label','Виды ремёсел');
 for(const group of CRAFT_GROUPS){
  const panel=section.querySelector(`[data-craft-group="${group.id}"]`);
  if(!panel)continue;
  panel.hidden=true;
  if(!panel.children.length)continue;
  panel.id=`craft-panel-${group.id}`;panel.setAttribute('role','tabpanel');
  const button=document.createElement('button');button.type='button';button.id=`craft-tab-${group.id}`;
  button.textContent=group.name;button.setAttribute('role','tab');button.setAttribute('aria-controls',panel.id);
  panel.setAttribute('aria-labelledby',button.id);list.append(button);
  const tab={group,panel,button};tabs.push(tab);
  button.onclick=()=>activate(tab);
  button.onkeydown=event=>{
   const index=tabs.indexOf(tab),offset={ArrowLeft:-1,ArrowRight:1,ArrowUp:-2,ArrowDown:2}[event.key];
   const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):offset&&tabs[(index+tabs.length+offset)%tabs.length];
   if(next){event.preventDefault();activate(next);next.button.focus();}
  };
 }
 list.hidden=tabs.length<2;
 function activate(active){
  for(const tab of tabs){
   const selected=tab===active;
   tab.button.setAttribute('aria-selected',String(selected));tab.button.tabIndex=selected?0:-1;
   tab.panel.hidden=!selected;
  }
 }
 activate(tabs[0]);
 return {show(type){const tab=tabs.find(t=>t.group.types.includes(type));if(tab)activate(tab);}};
}

export const BUILDING_GROUPS=[
 {id:'life',name:'Жители',types:['house','healer','musicHouse']},
 {id:'food',name:'Пища',types:['field','garden','fishing','hunting','cowshed']},
 {id:'materials',name:'Сырьё',types:['clay','reed','logging','quarry']},
 {id:'craft',name:'Ремёсла',types:CRAFT_GROUPS.flatMap(group=>group.types)},
 {id:'supply',name:'Снабжение',types:['waterpoint','granary','depot','market']},
 {id:'sacred',name:'Храмы',types:['shrine','ziggurat','ishtarGate']},
 {id:'routes',name:'Пути, вода и укрепления',types:['canal','levee','bridge','harbor','cityWall','cityGate','watchHouse']}
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
 const desc=id==='bless'&&blessingSupportsFamilies(s)?FAMILY_BLESSING_DESCRIPTION:id==='stars'&&s.starObservations?'+18 престижа. До трёх прогнозов по хозяйству в обзоре города до смены сезона.':id==='peace'&&s.peaceDiscovery?'Поддерживает жителей выбранного квартала и поднимает им настроение.':id==='healing'&&s.arrivalHospitality?'Приглашает путников. Жители войдут в город после прибытия в подготовленный дом.':id==='shaping'&&s.shapingProjects?'Создаёт штабель из 60 глины и 40 тростника у выбранного ремесленного двора. Носильщики доставят материалы на склады.':id==='revelation'&&s.revelationEvidence?'Совет о следующем шаге выбранной ветви и +12 престижа.':id==='fertility'&&s.richCatchEvidence?'Урожай полей и садов ×1,6 на три сезона. В выбранном месте расцветает волшебный сад.':id==='abundance'&&s.abundanceGift?'До 45 еды в выбранное хранилище. Укажи его на карте перед применением.':m.desc;
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
  if(paid?.fishing)entries.push(`Рыбацкий двор · ${paid.fishing.x}, ${paid.fishing.y}. Выдано усиленных уловов: ${paid.fishing.charges}`);
  const depth=paid?.depth;
  if(depth)entries.push(depth.kind==='rain'?'Дождь':`Дождь и ${depth.kind==='canal'?'подпор канала':'пополнение водозабора'} · ${depth.x}, ${depth.y}`);
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
  const preview=details.querySelector('[data-arrival-preview]');
  if(preview){
   preview.hidden=!arrival;
   let text='';
   if(arrival){
    const extra=arrival.water-arrival.beds;
    text=`Принимающий двор · ${arrival.homeRef.x}, ${arrival.homeRef.y}. Резерв: еда ${arrival.food}, вода ${arrival.water}${extra>0?` (из них ${extra} на возлияние)`:''}.`;
   }
   if(preview.textContent!==text)preview.textContent=text;
  }
 }
 el.dataset.castNumber=previousMiracleCastNumber(s,id);
 el.dataset.castPrice=price;
 el.disabled=!!reason;el.textContent=`${arrival?`Позвать ${arrival.beds} чел.`:id==='cat'?'Призвать':first?'Первый призыв':'Применить'} · ${price} веры`;
 el.title=`${m.name} · ${price} веры. ${desc} Домен: ${DOMAIN_NAMES[m.domain]}. ${reason}`;el.setAttribute('aria-label',`Применить: ${el.title}`);
 details.hidden=false;details.classList.toggle('knowledge-locked',!!miracleKnowledgeReason(s,id));
 details.classList.toggle('miracle-ready',!reason);
 details.querySelector('.miracle-facts span').textContent=`${price} веры${first?' · первый дар':''}`;
 const status=details.querySelector('.miracle-summary-status'),statusText=reason||(first?'Доступно · первый дар':`Доступно · ${price} веры`);
 if(status.textContent!==statusText)status.textContent=statusText;
 let advisory='';
 if(id==='inspiration'&&s.creatorMaterials&&!reason){
  const yards=new Set(s.buildings.filter(b=>['clay','reed'].includes(b.type)&&isOperational(b)).map(buildingKey));
  const handOrders=s.manualGathering?.orders.some(q=>q.active&&['clay','reed'].includes(q.resource));
  if(!handOrders&&!s.citizens.some(c=>yards.has(c.work)))advisory='Назначь работников в добывающие дворы или дай поручение на ручной сбор глины и тростника.';
 }
 const note=details.querySelector('.miracle-unavailable');note.hidden=!(reason||advisory);note.textContent=reason||advisory;
}
