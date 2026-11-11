import {buildingKey,citizenName,isOperational} from './definitions.js';
import {cityCommandReason} from './city-command-lock.js';
import {fearTension} from './city-events.js';
import {connectedStores,requestTransfer,transferCarried} from './district-logistics.js';
import {foodAvailability,stockStores,takeStock} from './inventory.js';
import {homeFoodCouriers,homeMealFood,supplyHome} from './households.js';
import {DAY_SECONDS} from './city-life.js';

const measure=2;
const dayOf=s=>Math.floor(s.simTime/DAY_SECONDS+1e-8);
export const civicDayBoundary=s=>s.civicOrder?Math.max(.001,(dayOf(s)+1)*DAY_SECONDS-s.simTime):Infinity;
export const newCivicOrder=()=>({lastDay:-1,law:null,case:null,history:[],years:[]});
const name=c=>c.birthName||citizenName(c.id);
const houseAt=(s,key)=>s.buildings.find(b=>b.type==='house'&&isOperational(b)&&buildingKey(b)===key);
const ready=s=>cityCommandReason(s)||(s.event?'Сначала заверши событие':s.funeral?'Жители прощаются с умершими':s.lost?'Поселение покинуто':'');
function notice(s,title,text,kind='info'){
 s.news.unshift({title,text,kind,year:s.year,season:s.season,tick:s.tick});
 if(s.news.length>80)s.news.length=80;
}
function remember(s,incident,outcome){
 const entry={...incident,outcome,endedDay:dayOf(s),year:s.year};
 s.civicOrder.history.unshift(entry);
 if(s.civicOrder.history.length>40)s.civicOrder.history.length=40;
 s.civicOrder.case=null;
 return entry;
}
function trustedLaw(s,c){
 const law=s.civicOrder.law;
 const author=law&&s.citizens.find(p=>p.id===law.author&&p.calling==='lawmaker');
 return !!author&&c.mood>=25&&c.faith>=30&&fearTension(s)<3;
}
export function civicLawReason(s,id){
 if(!s.civicOrder)return 'Свод доступен в новом «Пробуждении»';
 const blocked=ready(s);if(blocked)return blocked;
 const c=s.citizens.find(p=>p.id===id);
 if(!c||c.age<16||c.calling!=='lawmaker')return 'Сначала вдохнови взрослого законодателем';
 if(s.civicOrder.law?.author===id)return 'Этот законодатель уже опубликовал свод';
 if(s.resources.clay<1)return 'Нужна 1 глина для таблички';
 return '';
}
export function publishCivicLaw(s,id){
 const reason=civicLawReason(s,id);if(reason)return {ok:false,reason};
 const author=s.citizens.find(c=>c.id===id);
 s.resources.clay-=1;
 s.civicOrder.law={author:id,name:name(author),year:s.year,day:dayOf(s)};
 notice(s,'Опубликован свод законов',`${name(author)} записал правила помощи голодным дворам.`,'good');
 return {ok:true};
}
function sources(s,home){
 const free=foodAvailability(s,{reconcile:false});
 return stockStores(s).filter(b=>b.type!=='house'&&(free.get(buildingKey(b))||0)>=measure&&connectedStores(s,buildingKey(b),home));
}
function aidJob(s,incident){return s.district?.jobs.find(q=>q.id===incident.aid);}
export function civicAidPending(s,incident=s.civicOrder?.case){if(!incident)return false;const q=aidJob(s,incident);return !!q&&(q.remaining>1e-7||transferCarried(s,q)>1e-7);}
export function sendCivicAid(s){
 const blocked=ready(s);if(blocked)return {ok:false,reason:blocked};
 const incident=s.civicOrder?.case;
 if(!incident)return {ok:false,reason:'Нет открытой просьбы'};
 if(civicAidPending(s,incident))return {ok:false,reason:'Помощь уже заказана'};
 for(const source of sources(s,incident.home)){
  const result=requestTransfer(s,buildingKey(source),incident.home,'food',measure,{targetKind:'input',automatic:true});
  if(result.ok){
   incident.aid=result.id;
   notice(s,'Заказана помощь двору',`Двор ${incident.home} ждёт доставку зерна.`,'good');
   return result;
  }
 }
 return {ok:false,reason:'Нужен связанный склад со свободным зерном и местом в дворе'};
}
export function reconcileCivicConflict(s){
 const blocked=ready(s);if(blocked)return {ok:false,reason:blocked};
 const incident=s.civicOrder?.case;
 const c=incident&&s.citizens.find(p=>p.id===incident.person);
 if(!c||incident.guard===undefined)return {ok:false,reason:'Нет открытого спора'};
 if(!trustedLaw(s,c)&&!civicAidPending(s,incident))return {ok:false,reason:'Нужен действующий свод, которому доверяют, или подтверждённый заказ помощи'};
 const guard=s.citizens.find(p=>p.id===incident.guard);
 remember(s,incident,'reconciled');
 c.mood=Math.min(100,c.mood+4);
 if(guard)guard.mood=Math.min(100,guard.mood+4);
 notice(s,'Стороны разошлись мирно',`Спор у склада ${incident.source} закрыт.`,'good');
 return {ok:true};
}
export function advanceCivicOrder(s,recordDeath){
 const civic=s.civicOrder,day=dayOf(s);
 if(!civic||civic.lastDay===day||ready(s))return;
 civic.lastDay=day;
 const incident=civic.case;
 if(incident){
  const c=s.citizens.find(p=>p.id===incident.person),home=houseAt(s,incident.home);
  if(!home||!c||supplyHome(c,{arrived:true})!==incident.home){remember(s,incident,'closed');return;}
  if(homeMealFood(home)>=measure||c.hunger<20||aidJob(s,incident)?.delivered>=measure){
   remember(s,incident,'help');
   c.mood=Math.min(100,c.mood+4);
   notice(s,'Двор получил помощь',`Нужда двора ${incident.home} отступила.`,'good');
   return;
  }
  if(day<=incident.day)return;
  if(trustedLaw(s,c)&&sendCivicAid(s).ok)return;
  if(civicAidPending(s,incident))return;
  if(incident.guard!==undefined){
   const guard=s.citizens.find(p=>p.id===incident.guard);
   if(!guard||guard.guardPost!==incident.source||fearTension(s)<3||c.hunger<45){remember(s,incident,'reconciled');return;}
   if(day<=incident.disputeDay)return;
   const repeated=civic.history.some(q=>q.outcome==='assault'&&q.person===c.id&&q.guard===guard.id&&q.endedDay>=day-9);
   const fatal=repeated&&guard.health<=30&&recordDeath?.(guard);
   if(!fatal)guard.health=Math.max(1,guard.health-30);
   guard.mood=Math.max(0,guard.mood-12);c.mood=Math.max(0,c.mood-8);
   remember(s,incident,fatal?'killing':'assault');
   notice(s,fatal?'Гибель у амбара':'Драка у амбара',`${incident.name} и ${incident.guardName} столкнулись у склада ${incident.source}.`,'bad');
   return;
  }
  if(homeFoodCouriers(s,incident.home).some(p=>p.phase!=='blocked'))return;
  if(day-incident.day<(trustedLaw(s,c)?3:2)||c.hunger<45||c.mood>=55)return;
  // Leave reserved seed and specially tracked fish or miracle food in their stores.
  const source=sources(s,incident.home).find(b=>!b.fishStock?.length&&!b.giftStock?.length&&!b.creatorStock?.food);
  if(!source)return;
  const key=buildingKey(source),guard=s.citizens.find(p=>p.age>=16&&p.id!==c.id&&p.guardPost===key&&p.work===key&&p.phase==='working');
  if(guard){
   if(fearTension(s)>=3&&civic.history.some(q=>q.person===c.id&&q.source===key&&['theft','assault'].includes(q.outcome)&&q.endedDay>=day-9)){
    Object.assign(incident,{source:key,guard:guard.id,guardName:name(guard),disputeDay:day});
    notice(s,'Ссора у амбара',`${incident.name} и ${incident.guardName} спорят у склада ${key}. Двор всё ещё без зерна.`,'bad');
   }
   return;
  }
  const amount=takeStock(s,buildingKey(source),'food',measure);
  if(amount<=0)return;
  home.pantry=(home.pantry||0)+amount;
  home.pantryDelivered=(home.pantryDelivered||0)+amount;
  remember(s,{...incident,source:buildingKey(source),amount},'theft');
  notice(s,'Кража зерна',`${incident.name} унёс ${amount} ед. зерна со склада ${buildingKey(source)} во двор ${incident.home}.`,'bad');
  return;
 }
 const subject=s.citizens.find(c=>{
  if(c.age<16||c.hunger<40||c.mood>=60)return false;
  const key=supplyHome(c,{arrived:true}),home=houseAt(s,key);
  return home&&homeMealFood(home)<measure&&!homeFoodCouriers(s,key).some(p=>p.phase!=='blocked');
 });
 if(subject){
  const home=supplyHome(subject,{arrived:true});
  civic.case={person:subject.id,name:name(subject),home,day};
  notice(s,'Двор просит зерно',`${name(subject)} просит доставить еду во двор ${home}.`,'bad');
 }
}
export function finishCivicYear(s,year){
 const civic=s.civicOrder;if(!civic)return null;
 const entries=civic.history.filter(q=>q.year===year);
 const thefts=entries.filter(q=>q.outcome==='theft').length,helped=entries.some(q=>q.outcome==='help');
 const title=entries.some(q=>q.outcome==='killing')?'Год, когда у амбара пролилась кровь':thefts?'Год, когда зерно уносили из амбаров':helped?'Год, когда дворы получили помощь':civic.law?.year===year?'Год первой таблички законов':null;
 if(title&&!civic.years.some(q=>q.year===year)){civic.years.unshift({year,title});if(civic.years.length>40)civic.years.length=40;}
 return title;
}
export function civicCityEpithet(s){
 const history=s.civicOrder?.history||[];
 const count=outcome=>new Set(history.filter(q=>q.outcome===outcome).map(q=>q.home)).size;
 return count('help')>=2&&history[0]?.outcome==='help'?'Город открытых амбаров':count('theft')+count('killing')>=2?'Город запертых амбаров':'';
}
export function validateCivicOrder(s){
 const civic=s.civicOrder;if(civic===undefined)return true;
 const number=(n,max=1e9)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
 const text=(v,max=120)=>typeof v==='string'&&v.length>0&&v.length<=max;
 const key=v=>typeof v==='string'&&/^\d{1,3},\d{1,3}$/.test(v);
 const incident=q=>q&&number(q.person)&&text(q.name)&&key(q.home)&&number(q.day,dayOf(s))&&(q.aid===undefined||number(q.aid))
  &&(q.guard===undefined||number(q.guard)&&q.guard!==q.person&&text(q.guardName)&&key(q.source)&&number(q.disputeDay,dayOf(s))&&q.disputeDay>=q.day);
 return !!civic&&(civic.lastDay===-1||number(civic.lastDay,dayOf(s)))
  &&(civic.law===null||civic.law&&number(civic.law.author)&&text(civic.law.name)&&number(civic.law.year,s.year)&&number(civic.law.day,dayOf(s)))
  &&(civic.case===null||incident(civic.case))
  &&Array.isArray(civic.history)&&civic.history.length<=40&&civic.history.every(q=>incident(q)&&number(q.year,s.year)&&number(q.endedDay,dayOf(s))&&q.endedDay>=q.day
   &&(['help','closed','reconciled'].includes(q.outcome)||['assault','killing'].includes(q.outcome)&&q.guard!==undefined||q.outcome==='theft'&&key(q.source)&&q.amount>0&&q.amount<=measure))
  &&Array.isArray(civic.years)&&civic.years.length<=40&&civic.years.every((q,i)=>q&&number(q.year,s.year-1)&&text(q.title)&&(!i||q.year<civic.years[i-1].year));
}
