import {isOperational} from './definitions.js';
import {RESULT_NAMES,usesResultNames} from './divinity.js';

// The same incisions are shown in the map, the shrine and its inspector.
const marks=[
 {id:'water',name:RESULT_NAMES.water,label:'Вода',lines:[
  [[-.38,.18],[-.18,.30],[0,.18],[.18,.30],[.38,.18]],
  [[-.38,-.16],[-.18,-.04],[0,-.16],[.18,-.04],[.38,-.16]]
 ]},
 {id:'grain',name:RESULT_NAMES.harvest,label:'Колос',lines:[
  [[0,-.36],[0,.35]],
  [[-.25,.25],[0,.08],[.25,.25]],
  [[-.25,.02],[0,-.15],[.25,.02]]
 ]}
];

export function cultSign(s,b){
 if(b.type!=='shrine'||!isOperational(b)||!usesResultNames(s)||s.godhood.stage!=='recognized')return [];
 return marks.filter(mark=>s.divinity.names.includes(mark.name));
}
