import {miraclePrice} from './miracle-discovery.js';
import {miracleKnowledgeReason} from './godhood.js';
import {DOMAIN_NAMES} from './divinity.js';
import {buildingDefinition} from './building-presentation.js';
import {MIRACLES} from './definitions.js';
import {sacredMiracleUnlocked} from './sacred-unlocks.js';

// Ordinary powers remain in the catalogue while unavailable. Only earned blue
// gifts appear after their building or relic has actually unlocked them.
export function shouldShowMiracle(s,id){
 const m=MIRACLES[id];return !!m&&(!(m.unlockBuilding||m.unlockQuest)||sacredMiracleUnlocked(s,id));
}

export const BUILDING_GROUPS=[
 {id:'life',name:'Жители',types:['house','healer','musicHouse']},
 {id:'food',name:'Пища',types:['field','garden','fishing','hunting','cowshed']},
 {id:'materials',name:'Сырьё',types:['clay','reed','logging','quarry']},
 {id:'craft',name:'Ремёсла',types:['pottery','brewery','kiln','brickyard','sheepfold','weaver','tailor']},
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
export function updateMiracleCard(details,s,id,reason=''){
 const m=MIRACLES[id],price=miraclePrice(s,id),el=details.querySelector('.miracle-cast'),first=id==='cat'&&price===0;
 el.disabled=!!reason;el.textContent=`${id==='cat'?'Призвать':'Применить'} · ${price} веры`;
 el.title=`${m.name} · ${price} веры. ${m.desc} Домен: ${DOMAIN_NAMES[m.domain]}. ${reason}`;el.setAttribute('aria-label',`Применить: ${el.title}`);
 details.hidden=false;details.classList.toggle('knowledge-locked',!!miracleKnowledgeReason(s,id));
 details.querySelector('.miracle-facts span').textContent=`${price} веры${first?' · первый дар':''}`;
 details.querySelector('.miracle-summary-status').textContent=reason||`${price} веры · ${first?'первый дар':DOMAIN_NAMES[m.domain]}`;
 const note=details.querySelector('.miracle-unavailable');note.hidden=!reason;note.textContent=reason;
}
