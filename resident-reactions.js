import {buildingKey} from './definitions.js';

const kinds=new Set(['aid','guardedAid','threat','thirst','drank']);
const dayOf=s=>Math.floor(s.simTime/60);

export function rememberResidentReaction(s,c,kind,place,change=0){
 const day=dayOf(s),old=c.reactions||[];
 c.reactions=[{day,kind,place,change},...old.filter(r=>r.kind!==kind||r.day!==day)].slice(0,6);
}

export function civicTrustAdjustment(s,c){
 const recent=c.reactions?.find(r=>dayOf(s)-r.day<=3&&['aid','guardedAid','threat'].includes(r.kind));
 return recent?.kind==='aid'?5:recent?.kind==='threat'?-5:recent?.kind==='guardedAid'?recent.change:0;
}

export function recordCivicAidReaction(s,job,before){
 const incident=s.civicOrder?.case;
 if(incident?.aid!==job.id||before>=job.amount-1e-7||job.delivered<job.amount-1e-7)return;
 const recipient=s.citizens.find(c=>c.id===incident.person);
 const store=s.buildings.find(b=>buildingKey(b)===job.source);
 const keeper=s.citizens.find(c=>c.id!==recipient?.id&&c.work===job.source&&(c.guardPost===job.source||c.calling==='scribe'));
 const react=(person,kind,place,change)=>{
  if(!person)return;
  const mood=person.mood;
  person.mood=Math.max(0,Math.min(100,mood+change));
  rememberResidentReaction(s,person,kind,place,person.mood-mood);
 };
 react(recipient,'aid',incident.home,4);
 react(keeper,'guardedAid',job.source,(store?.stock?.food||0)<8?-3:1);
}

export const RESIDENT_REACTION_LABELS={
 aid:'Получил помощь',guardedAid:'Выдача зерна со склада',threat:'Подчинился угрозе',
 thirst:'Жажда стала сильной',drank:'Жажда ослабла'
};

export function validateResidentReactions(s){
 return s.citizens.every(c=>c.reactions===undefined||Array.isArray(c.reactions)&&c.reactions.length<=6&&
  c.reactions.every(r=>r&&kinds.has(r.kind)&&Number.isSafeInteger(r.day)&&r.day>=0&&r.day<=dayOf(s)&&
   (r.place===null||typeof r.place==='string'&&/^\d+,\d+$/.test(r.place))&&Number.isFinite(r.change)&&Math.abs(r.change)<=100));
}
