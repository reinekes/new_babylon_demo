import {DAY_SECONDS} from './city-life.js';
import {buildingKey} from './definitions.js';
import {homeMealFood} from './households.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {supplyOverview} from './supply.js';
import {affectResidents} from './wellbeing.js';

const EPS=1e-7;
const COST=2;
const INITIAL_TERM=2*DAY_SECONDS;
const outcomes=['fulfilled','partial','broken','renegotiated'];
export const VOW_FAILURE_TEXT={
 moved:'Получатели больше не живут по этому адресу',
 route:'Путь к складу закрыт',
 inTransit:'Еда ещё в пути',
 noFood:'На доступных складах нет еды',
 short:'Двор не получил запас на два ужина',
 noDelivery:'К сроку не было подтверждённой доставки',
};

export function acceptSupplyVow(s,keys){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 if(!isStrictSumer(s)||s.supplyVows?.active)return {ok:false,reason:'Нельзя принять новый обет в этом городе'};
 if(!Array.isArray(keys)||keys.length<1||keys.length>3||new Set(keys).size!==keys.length)return {ok:false,reason:'Выбери от одного до трёх дворов'};
 if(s.resources.faith<COST)return {ok:false,reason:'Нужно 2 силы веры'};
 const houses=new Map(supplyOverview(s).houses.map(h=>[h.key,h]));
 const selected=keys.map(key=>houses.get(key));
 if(selected.some(h=>!h?.residents.length||!h.reachable||h.food+EPS>=2*h.demand))return {ok:false,reason:'Выбранному двору нужен запас и доступный путь к складу'};
 const targets=selected.map(h=>({home:h.key,residents:h.residents.map(c=>c.id),initial:h.food,required:2*h.demand,delivery:null}));
 s.supplyVows??={active:null,history:[]};
 s.supplyVows.active={id:s.supplyVows.history.length+1,start:s.simTime,deadline:s.simTime+INITIAL_TERM,previous:null,targets};
 s.resources.faith-=COST;
 return {ok:true};
}

function close(s,outcome){
 const book=s.supplyVows,vow=book.active;
 book.history.push({...vow,outcome,ended:s.simTime});
 book.active=null;
 for(const target of vow.targets){
  const faith=outcome==='renegotiated'?-1:outcome==='fulfilled'?3:target.delivery?0:-2;
  if(faith)affectResidents(s,{faith},target.residents);
 }
}

export function extendSupplyVow(s){
 const reason=cityCommandReason(s);
 if(reason)return {ok:false,reason};
 advanceSupplyVow(s);
 const vow=s.supplyVows?.active;
 if(!vow||vow.previous!==null)return {ok:false,reason:'Этот обет нельзя продлить'};
 close(s,'renegotiated');
 s.supplyVows.active={...vow,id:vow.id+1,start:s.simTime,deadline:vow.deadline+DAY_SECONDS,previous:vow.id,targets:structuredClone(vow.targets)};
 return {ok:true};
}

export function advanceSupplyVow(s){
 const vow=s.supplyVows?.active;
 if(!vow||s.simTime<vow.deadline)return;
 const houses=new Map(supplyOverview(s).houses.map(h=>[h.key,h]));
 for(const target of vow.targets){
  if(target.delivery)continue;
  const home=houses.get(target.home);
  if(!home?.residents.some(c=>target.residents.includes(c.id)))target.failure='moved';
  else if(!home.reachable)target.failure='route';
  else if(home.inTransit>EPS)target.failure='inTransit';
  else if(home.food+EPS>=target.required)target.failure='noDelivery';
  else if(home.localFood<=EPS)target.failure='noFood';
  else target.failure='short';
 }
 close(s,vow.targets.some(t=>t.delivery)?'partial':'broken');
}

export function recordVowDelivery(s,house,courier,amount){
 const vow=s.supplyVows?.active;
 if(!vow||house?.type!=='house'||amount<=EPS||s.simTime>=vow.deadline)return;
 const target=vow.targets.find(t=>t.home===buildingKey(house)&&!t.delivery);
 if(!target||homeMealFood(house)+EPS<target.required)return;
 const recipient=s.citizens.find(c=>c.home===target.home&&target.residents.includes(c.id));
 if(!recipient)return;
 target.delivery={witness:courier.id,recipient:recipient.id,time:s.simTime};
 if(vow.targets.every(t=>t.delivery))close(s,'fulfilled');
}

export function validateSupplyVows(s){
 const book=s.supplyVows;
 if(book===undefined)return true;
 if(!isStrictSumer(s)||!book||!Array.isArray(book.history))return false;
 const ids=new Set(s.lifeAnalytics.people.map(p=>p.id));
 const validTime=n=>Number.isFinite(n)&&n>=0;
 const validRow=(vow,index)=>{
  if(!vow||vow.id!==index+1||!validTime(vow.start)||vow.start>s.simTime||
   !validTime(vow.deadline)||vow.deadline<=vow.start||
   !(vow.previous===null||vow.previous===index&&book.history[index-1]?.outcome==='renegotiated')||
   !Array.isArray(vow.targets)||!vow.targets.length||vow.targets.length>3)return false;
  const homes=new Set();
  for(const t of vow.targets){
   if(!t||typeof t.home!=='string'||!/^\d+,\d+$/.test(t.home)||homes.has(t.home)||
    !Array.isArray(t.residents)||!t.residents.length||new Set(t.residents).size!==t.residents.length||t.residents.some(id=>!ids.has(id))||
    !validTime(t.initial)||!validTime(t.required)||t.initial>=t.required)return false;
   homes.add(t.home);
   const expired=vow.outcome==='partial'||vow.outcome==='broken';
   if(expired&&t.delivery===null?!Object.hasOwn(VOW_FAILURE_TEXT,t.failure):t.failure!==undefined)return false;
   const d=t.delivery;
   if(d!==null&&(!d||!ids.has(d.witness)||!t.residents.includes(d.recipient)||!validTime(d.time)||d.time>s.simTime||d.time>=vow.deadline||
    d.time<(vow.previous===null?vow.start:book.history[index-1].start)))return false;
  }
  return true;
 };
 if(!book.history.every((v,index)=>{
  if(!validRow(v,index)||!outcomes.includes(v.outcome)||!validTime(v.ended)||v.ended<v.start||v.ended>s.simTime)return false;
  const delivered=v.targets.filter(t=>t.delivery).length;
  if(v.targets.some(t=>t.delivery?.time>v.ended))return false;
  switch(v.outcome){
   case 'fulfilled': return v.ended<v.deadline&&delivered===v.targets.length;
   case 'partial': return v.ended>=v.deadline&&delivered>0&&delivered<v.targets.length;
   case 'broken': return v.ended>=v.deadline&&delivered===0;
   case 'renegotiated': return v.ended<v.deadline&&v.previous===null&&delivered<v.targets.length;
  }
 }))return false;
 const active=book.active;
 if(active!==null&&(!validRow(active,book.history.length)||active.outcome!==undefined||active.ended!==undefined||active.deadline<=s.simTime||active.targets.every(t=>t.delivery)))return false;
 const rows=active?[...book.history,active]:book.history;
 return rows.every((v,index)=>{
  if(v.outcome==='renegotiated'&&rows[index+1]?.previous!==v.id)return false;
  if(v.previous===null)return v.deadline===v.start+INITIAL_TERM;
  const original=rows[index-1];
  return v.start===original.ended&&v.deadline===original.deadline+DAY_SECONDS&&v.targets.length===original.targets.length&&v.targets.every((target,i)=>{
   const prior=original.targets[i];
   return target.home===prior.home&&target.initial===prior.initial&&target.required===prior.required&&
    target.residents.length===prior.residents.length&&target.residents.every((id,j)=>id===prior.residents[j])&&
    (prior.delivery?target.delivery?.witness===prior.delivery.witness&&target.delivery.recipient===prior.delivery.recipient&&target.delivery.time===prior.delivery.time:
     !target.delivery||target.delivery.time>=v.start);
  });
 });
}
