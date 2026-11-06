import {isOperational} from './definitions.js';
import {richCatchView} from './fish-provenance.js';

const CHARGES=6, BONUS=.5;

export function richCatchTarget(s,target){
 return target&&s.buildings.find(b=>b.type==='fishing'&&b.x===target.x&&b.y===target.y&&isOperational(b)&&!b.floodDamage);
}

export function richCatchKnowledgeReason(s){
 const progress=richCatchView(s);
 if(!progress)return 'Дар доступен в новом «Пробуждении»';
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
