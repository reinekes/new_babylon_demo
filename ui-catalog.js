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
 {id:'routes',name:'Пути и вода',types:['canal','bridge','harbor']}
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
