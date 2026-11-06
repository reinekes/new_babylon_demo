import {isOperational} from './definitions.js';
import {richCatchView} from './fish-provenance.js';
import {isShore,worldWidth,worldHeight} from './world.js';

const CHARGES=6, BONUS=.5;
const shoresByWorld=new WeakMap();

export function richCatchTarget(s,target){
 return target&&s.buildings.find(b=>b.type==='fishing'&&b.x===target.x&&b.y===target.y&&isOperational(b)&&!b.floodDamage);
}

export function richCatchMapReason(s){
 const {world}=s;
 const cached=world&&shoresByWorld.get(world);
 if(cached&&cached.river===world.river&&cached.lakes===world.lakes)return cached.reason;
 let reason='На этой карте нет берега для рыбалки. История недоступна.';
 const width=worldWidth(s),height=worldHeight(s);
 search: for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  if(isShore(s,x,y)){reason='';break search;}
 }
 if(world)shoresByWorld.set(world,{river:world.river,lakes:world.lakes,reason});
 return reason;
}

export function richCatchKnowledgeReason(s){
 const progress=richCatchView(s);
 if(!progress)return 'Дар доступен в новом «Пробуждении»';
 const mapReason=richCatchMapReason(s);
 if(mapReason)return mapReason;
 if(!progress.qualified)return 'Нужно 10 уловов одного вдохновлённого рыбака и доставка рыбы в два жилых двора';
 return '';
}

export function richCatchCharges(s,b){
 const active=b?.richCatch;
 return active&&active.tick===s.tick?active.charges:0;
}

export function foodYieldMultiplier(s,b,{includeRichCatch=true}={}){
 const fertility=s.buffs?.fertility&&(!s.richCatchEvidence||b.type==='field'||b.type==='garden')?1.6:1;
 return includeRichCatch&&richCatchCharges(s,b)>0?fertility*(1+BONUS):fertility;
}

export function startRichCatch(s,b){
 b.richCatch={tick:s.tick,charges:CHARGES};
}

export function useRichCatch(s,b,amount){
 if(amount<=1e-8||!richCatchCharges(s,b))return;
 if(--b.richCatch.charges===0)delete b.richCatch;
}

export function richCatchBonus(s,b,trips){
 return Math.min(trips,richCatchCharges(s,b))*BONUS;
}

export function expireRichCatch(s){
 for(const b of s.buildings)if(b.richCatch&&b.richCatch.tick!==s.tick)delete b.richCatch;
}

export function validateRichCatch(s){
 const active=s.buildings.filter(b=>b.richCatch!==undefined);
 if(!active.length)return true;
 const [b]=active,q=b.richCatch;
 return active.length===1&&richCatchView(s)?.qualified&&s.cooldowns.richCatch===2&&b.type==='fishing'&&
  !!q&&Object.keys(q).length===2&&q.tick===s.tick&&Number.isInteger(q.charges)&&q.charges>=1&&q.charges<=CHARGES;
}
