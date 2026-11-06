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
