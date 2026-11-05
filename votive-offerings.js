import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {cityCommandReason} from './city-command-lock.js';
import {reserveStock,stockStores} from './inventory.js';
import {connectedStores,initializeDistricts,exportable,createDistrictPass} from './district-logistics.js';
import {invalidateAssignments} from './workforce.js';
import {displayName} from './citizen-epithets.js';

export const isVotiveTemple=b=>['shrine','ziggurat'].includes(b?.type)&&isOperational(b);
export const templeOfferings=(s,key)=>(s.votiveOfferings||[]).filter(q=>q.temple===key);
export function votiveOrder(s,id){if(id===undefined)return;return s.votiveOfferings?.find(v=>v.id===id);}

export function votiveOptions(s,temple){
 const reason=cityCommandReason(s)||(s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':'');
 if(!isStrictSumer(s)||!isVotiveTemple(s.buildings.find(b=>buildingKey(b)===temple)))return {reason:'Нужно готовое святилище или зиккурат Южного Шумера',sources:[],donors:[]};
 const pass=createDistrictPass(s);
 const sources=stockStores(s).filter(b=>{
  const key=buildingKey(b);
  return key!==temple&&connectedStores(s,key,temple,pass)&&exportable(s,key,'pottery',pass)-(pass.queued.get(`${key}:pottery`)||0)>=1;
 });
 const donors=s.citizens.filter(c=>c.age>=16&&connectedStores(s,c.home,temple,pass));
 return {reason:reason||(!sources.length?'Нет свободного сосуда на доступном складе':!donors.length?'Нет взрослого дарителя с дорогой к храму':''),sources,donors};
}

export function orderVotive(s,temple,source,donorId){
 const {reason,sources,donors}=votiveOptions(s,temple);
 if(reason)return {ok:false,reason};
 const donor=donors.find(c=>c.id===donorId);
 if(!donor||!sources.some(b=>buildingKey(b)===source))return {ok:false,reason:'Выбери доступный склад и дарителя'};
 if(!reserveStock(s,{pottery:1},{eligibleStores:new Set([source])}))return {ok:false,reason:'Сосуд уже занят'};
 initializeDistricts(s);
 const id=s.district.nextId++,q={id,source,target:temple,resource:'pottery',amount:1,remaining:1,delivered:0,cancelled:0,automatic:false,targetKind:'votive'};
 s.district.jobs.push(q);
 (s.votiveOfferings??=[]).push({id,donorId,donorName:displayName(s,donor),source,temple,orderedTick:s.tick,receivedTick:null,carrierId:null});
 invalidateAssignments(s);
 return {ok:true,id};
}

export function receiveVotive(s,q,carrier,amount){
 const item=votiveOrder(s,q.id);
 if(!item||item.receivedTick!==null||q.target!==carrier.store||amount!==1||
  !s.buildings.some(b=>buildingKey(b)===q.target&&isVotiveTemple(b)))return 0;
 item.receivedTick=s.tick;item.carrierId=carrier.id;
 s.news.unshift({title:'Именной сосуд принят в храм',text:`${item.donorName} посвятил сосуд №${item.id}. Доставлен со склада ${item.source}.`,kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
 return 1;
}

export const isMemoryKeeper=(c,temple)=>c.age>=16&&c.calling==='priest'&&c.role==='production'&&c.workplace===temple;
export function recordVotiveMemory(s,b,c){
 if(!s.votiveOfferings?.length||!isVotiveTemple(b)||!isMemoryKeeper(c,buildingKey(b)))return;
 const item=s.votiveOfferings.find(v=>v.temple===buildingKey(b)&&v.receivedTick!==null&&!v.memory);
 if(item)item.memory={keeperId:c.id,keeperName:displayName(s,c),tick:s.tick};
}
export function dedicationFeastReason(s,id){
 const item=votiveOrder(s,id);
 if(!item?.memory)return 'Сначала назначенный жрец должен записать имя дарителя';
 if(item.feastTick!==undefined)return 'Угощение в честь этого посвящения уже состоялось';
 return '';
}
export function rememberDedicationFeast(s,id){
 const item=votiveOrder(s,id);
 if(!item?.memory||item.feastTick!==undefined)return;
 item.feastTick=s.tick;
 s.news.unshift({title:'Дарителя вспомнили за храмовым угощением',
  text:`${item.donorName} · сосуд №${item.id} · запись хранителя ${item.memory.keeperName}.`,kind:'good',year:s.year,season:s.season,tick:s.tick});
 s.news=s.news.slice(0,80);
}

export function validateVotiveOfferings(s){
 const items=s.votiveOfferings;
 const jobs=s.district.jobs.filter(q=>q.targetKind==='votive');
 if(items===undefined)return jobs.length===0;
 if(!isStrictSumer(s)||!Array.isArray(items)||items.length!==jobs.length)return false;
 const byId=new Map(jobs.map(q=>[q.id,q])),seen=new Set();
 return items.every(v=>{
  const q=v&&byId.get(v.id);
  if(!q||seen.has(v.id)||!Number.isSafeInteger(v.donorId)||v.donorId<0||v.donorId>=s.demography.nextId||
   typeof v.donorName!=='string'||!v.donorName||v.donorName.length>150||
   v.source!==q.source||v.temple!==q.target||!Number.isSafeInteger(v.orderedTick)||v.orderedTick<0||v.orderedTick>s.tick||
   q.resource!=='pottery'||q.amount!==1||q.automatic||![q.remaining,q.delivered,q.cancelled].every(n=>n===0||n===1))return false;
  if(q.delivered?(!Number.isSafeInteger(v.carrierId)||v.carrierId<0||v.carrierId>=s.demography.nextId):v.carrierId!==null)return false;
  if(q.delivered?v.receivedTick===null||!Number.isSafeInteger(v.receivedTick)||v.receivedTick<v.orderedTick||v.receivedTick>s.tick:v.receivedTick!==null)return false;
  if(v.memory!==undefined){
   const m=v.memory;
   if(!q.delivered||!m||!Number.isSafeInteger(m.keeperId)||m.keeperId<0||m.keeperId>=s.demography.nextId||
    typeof m.keeperName!=='string'||!m.keeperName||m.keeperName.length>150||
    !Number.isSafeInteger(m.tick)||m.tick<v.receivedTick||m.tick>s.tick)return false;
  }
  if(v.feastTick!==undefined&&(!v.memory||!Number.isSafeInteger(v.feastTick)||v.feastTick<v.memory.tick||v.feastTick>s.tick))return false;
  seen.add(v.id);return true;
 });
}
