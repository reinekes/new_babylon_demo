import {isMemoryKeeper,isVotiveTemple,sunlightDedications} from './votive-offerings.js';
import {buildingKey} from './definitions.js';

import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

export function recordSunlightFeast(s,q){
 if(!usesCatDiscovery(s)||s.sunlightFeast||!q.consumed||!q.rewarded.length||!(q.delivered.food>0&&q.delivered.beer>0))return;
 s.sunlightFeast={temple:q.temple,at:s.simTime,guests:q.rewarded.length};
}

export function validateSunlightFeast(s){
 const q=s.sunlightFeast;
 if(q===undefined)return true;
 if(!usesCatDiscovery(s)||!q||Object.keys(q).length!==3||
  !Number.isFinite(q.at)||q.at<0||q.at>s.simTime||
  !Number.isSafeInteger(q.guests)||q.guests<1||q.guests>24)return false;
 const cell=typeof q.temple==='string'&&/^(\d+),(\d+)$/.exec(q.temple);
 return !!cell&&Number(cell[1])<worldWidth(s)&&Number(cell[2])<worldHeight(s);
}

export function recordSunlightService(s,b,c){
 if(!usesCatDiscovery(s)||s.sunlightService||c.calling!=='priest'||c.role!=='production'||
  !['shrine','ziggurat'].includes(b.type)||c.workplace!==c.work)return;
 s.sunlightService={temple:c.work,at:s.simTime,priest:c.id};
}

export function validateSunlightService(s){
 const q=s.sunlightService;
 if(q===undefined)return true;
 if(!usesCatDiscovery(s)||!q||Object.keys(q).length!==3||
  !Number.isFinite(q.at)||q.at<0||q.at>s.simTime||
  !Number.isSafeInteger(q.priest)||q.priest<0||q.priest>=s.demography.nextId)return false;
 const cell=typeof q.temple==='string'&&/^(\d+),(\d+)$/.exec(q.temple);
 return !!cell&&Number(cell[1])<worldWidth(s)&&Number(cell[2])<worldHeight(s);
}

const validCell=(s,key)=>{
 const cell=typeof key==='string'&&/^(\d+),(\d+)$/.exec(key);
 return !!cell&&Number(cell[1])<worldWidth(s)&&Number(cell[2])<worldHeight(s);
};

export function recordSunlightMeal(s,depot,diner,day){
 if(!usesCatDiscovery(s)||s.sunlightMeal||!validCell(s,diner.home))return;
 if(depot.sunlightTable?.day!==day)depot.sunlightTable={day,homes:[]};
 const {homes}=depot.sunlightTable;
 if(homes.includes(diner.home))return;
 homes.push(diner.home);
 if(homes.length<3)return;
 s.sunlightMeal={depot:`${depot.x},${depot.y}`,at:s.simTime,homes};
 delete depot.sunlightTable;
}

export function validateSunlightMeal(s,maxDay){
 const homes=(keys,min,max)=>Array.isArray(keys)&&keys.length>=min&&keys.length<=max&&
  new Set(keys).size===keys.length&&keys.every(key=>validCell(s,key));
 const q=s.sunlightMeal,enabled=usesCatDiscovery(s);
 if(s.sunlightChapter!==undefined&&(!enabled||s.sunlightChapter!==1))return false;
 if(q!==undefined&&(!enabled||!q||Object.keys(q).length!==3||!validCell(s,q.depot)||
  !Number.isFinite(q.at)||q.at<0||q.at>s.simTime||!homes(q.homes,3,3)))return false;
 return s.buildings.every(b=>{
  const table=b.sunlightTable;
  return table===undefined||enabled&&b.type==='depot'&&table&&Object.keys(table).length===2&&
   Number.isSafeInteger(table.day)&&table.day>=0&&table.day<=maxDay&&homes(table.homes,1,2);
 });
}

export function sunlightKnowledgeReason(s){
 if(sunlightDedications(s).length<3)return 'Нужны три принятых посвящения от разных домов';
 if(!s.sunlightService||!s.buildings.some(b=>isVotiveTemple(b)&&s.citizens.some(c=>isMemoryKeeper(c,buildingKey(b)))))
  return 'Нужен работающий вдохновлённый жрец в готовом святилище';
 return s.sunlightFeast||s.sunlightMeal?'':'Нужен завершённый пир или трапеза трёх семей в одном раздаточном дворе';
}
