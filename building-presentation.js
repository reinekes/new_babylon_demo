import {BUILDINGS,levelOf} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

// Presentation only: prices, footprints, inventories and saved type IDs stay shared.
const sumerGate=Object.freeze({...BUILDINGS.ishtarGate,name:'Врата Инанны',desc:'Сырцовые ворота священного двора с деревянной перемычкой. После завершения открывают «Покров Инанны». Игровая стилизация Южного Шумера III тысячелетия до н. э., не точная реконструкция.'});
export function buildingDefinition(state,type){return type==='ishtarGate'&&isStrictSumer(state)?sumerGate:BUILDINGS[type];}
export function buildingPresentation(state,b){
 const def=buildingDefinition(state,b?.type);
 if(b?.type!=='house'||!b.starterHut||levelOf(b)!==1)return def;
 return {...def,name:isStrictSumer(state)?'Первый дом':'Дом-улей',desc:isStrictSumer(state)?'Стартовый сырцовый дом с плоской земляной крышей для четырёх жителей. Припасы хранятся внутри. Можно снести или улучшить в обычный дом II уровня.':'Стартовый сырцовый дом-улей для четырёх жителей. Припасы хранятся внутри. Можно снести или улучшить в обычный дом II уровня; построить новый улей нельзя.'};
}
