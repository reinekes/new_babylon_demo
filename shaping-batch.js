import {buildingKey,isOperational} from './definitions.js';
import {putStock,stockStores,storeCapacity} from './inventory.js';
import {occupiesCell} from './footprints.js';
import {floodFootprint,floodPhase} from './river-flood.js';
import {isDryPoint,worldHeight,worldWidth} from './world.js';

export const SHAPING_MATERIALS=Object.freeze({clay:60,reed:40});
const YARDS=new Set(['brickyard','pottery','kiln']);
const COMPLETED_BATCH_LIMIT=32;
const active=batch=>Object.entries(SHAPING_MATERIALS).some(([key,total])=>batch.delivered[key]<total-1e-8);
export const findShapingBatch=(s,id)=>s.shapingBatches?.rows.find(row=>row.id===id);

export function shapingBatchQuote(s,point,{connected=()=>false}={}){
 const yard=point&&s.buildings.find(b=>occupiesCell(b,point.x,point.y)&&YARDS.has(b.type)&&isOperational(b));
 if(!yard)return {ok:false,reason:'Выбери готовый кирпичный или гончарный двор либо печь'};
 const flood=floodPhase(s);
 if(!isDryPoint(s,yard.x,yard.y)||flood==='active'&&floodFootprint(s,s.riverFlood).has(buildingKey(yard)))
  return {ok:false,reason:'Для партии нужен сухой двор'};
 if(s.shapingBatches?.rows.some(batch=>batch.x===yard.x&&batch.y===yard.y&&active(batch)))
  return {ok:false,reason:'В этом месте ещё лежит прежняя партия'};
 const destinations=stockStores(s).filter(b=>b!==yard&&connected(buildingKey(yard),buildingKey(b)));
 if(!Object.keys(SHAPING_MATERIALS).every(k=>destinations.some(b=>(b.stock?.[k]||0)<storeCapacity(b))))
  return {ok:false,reason:'Нужен путь к складам со свободным местом для глины и тростника'};
 return {ok:true,yard};
}

function trimCompletedBatches(s,ledger){
 if(ledger.rows.length<=COMPLETED_BATCH_LIMIT)return;
 const referenced=new Set(s.buildings.map(b=>b.shapingBatchId));
 for(const job of s.district?.jobs||[])referenced.add(job.shapingBatch);
 const unreferenced=ledger.rows.filter(batch=>!active(batch)&&!referenced.has(batch.id));
 if(unreferenced.length<=COMPLETED_BATCH_LIMIT)return;
 const removed=new Set(unreferenced.slice(0,-COMPLETED_BATCH_LIMIT));
 ledger.rows=ledger.rows.filter(batch=>!removed.has(batch));
}

export function createShapingBatch(s,point,options){
 const quote=shapingBatchQuote(s,point,options);
 if(!quote.ok)return quote;
 const {yard}=quote,ledger=s.shapingBatches??={nextId:1,rows:[]};
 const batch={id:ledger.nextId++,x:yard.x,y:yard.y,grounded:false,remaining:{...SHAPING_MATERIALS},delivered:{clay:0,reed:0}};
 ledger.rows.push(batch);
 yard.shapingBatchId=batch.id;
 trimCompletedBatches(s,ledger);
 return {ok:true,batch};
}

export function groundShapingBatch(s,yard){
 const batch=findShapingBatch(s,yard.shapingBatchId);
 if(!batch)return;
 batch.grounded=true;
 delete yard.shapingBatchId;
}

export function loadShapingBatch(s,c,id,resource,limit){
 const batch=findShapingBatch(s,id);
 if(!batch||!Object.hasOwn(SHAPING_MATERIALS,resource)||c.shapingLoad||
  Object.values(c.cargo||{}).some(n=>n>0)||!Number.isFinite(limit)||limit<=0)return 0;
 const amount=Math.min(batch.remaining[resource],limit,12);
 if(amount<=0)return 0;
 batch.remaining[resource]-=amount;
 c.shapingLoad={batchId:id,resource,amount};
 c.cargo={[resource]:amount};
 return amount;
}

function consumeLoad(c,amount){
 const load=c.shapingLoad;
 load.amount-=amount;
 if(load.amount>1e-8)c.cargo[load.resource]=load.amount;
 else{
  delete c.cargo[load.resource];
  delete c.shapingLoad;
 }
}

export function deliverShapingLoad(s,c,store){
 const load=c.shapingLoad,batch=findShapingBatch(s,load?.batchId);
 if(!batch)return 0;
 const amount=putStock(s,store,load.resource,load.amount);
 batch.delivered[load.resource]+=amount;
 consumeLoad(c,amount);
 return amount;
}

export function returnShapingLoad(s,c){
 const load=c.shapingLoad,batch=findShapingBatch(s,load?.batchId);
 if(!batch)return false;
 batch.remaining[load.resource]+=load.amount;
 consumeLoad(c,load.amount);
 return true;
}

export function validateShapingBatches(s){
 const q=s.shapingBatches;
 if(q===undefined)return s.buildings.every(b=>b.shapingBatchId===undefined)&&s.citizens.every(c=>c.shapingLoad===undefined);
 if(!s.shapingProjects||!q||Object.keys(q).length!==2||!Number.isSafeInteger(q.nextId)||q.nextId<1||
  !Array.isArray(q.rows)||q.rows.length>=q.nextId)return false;
 const attached=new Map();
 for(const b of s.buildings){
  if(b.shapingBatchId===undefined)continue;
  if(attached.has(b.shapingBatchId)||!YARDS.has(b.type)||!isOperational(b))return false;
  attached.set(b.shapingBatchId,b);
 }
 const seen=new Set(),cells=new Set(),inTransit=new Map();
 for(const c of s.citizens){
  const load=c.shapingLoad;
  if(load===undefined)continue;
  if(!load||Object.keys(load).length!==3||!findShapingBatch(s,load.batchId)||!Object.hasOwn(SHAPING_MATERIALS,load.resource)||
   !Number.isFinite(load.amount)||load.amount<=0||load.amount>12||c.cargo?.[load.resource]!==load.amount) return false;
  const key=load.batchId+':'+load.resource;
  inTransit.set(key,(inTransit.get(key)||0)+load.amount);
 }
 for(const row of q.rows){
  if(!row||Object.keys(row).length!==6||!Number.isSafeInteger(row.id)||row.id<1||row.id>=q.nextId||seen.has(row.id)||
   !Number.isInteger(row.x)||row.x<0||row.x>=worldWidth(s)||!Number.isInteger(row.y)||row.y<0||row.y>=worldHeight(s)||
   typeof row.grounded!=='boolean'||!row.remaining||!row.delivered||Object.keys(row.remaining).length!==2||Object.keys(row.delivered).length!==2||
   !Object.entries(SHAPING_MATERIALS).every(([k,max])=>[row.remaining[k],row.delivered[k]].every(n=>Number.isFinite(n)&&n>=0&&n<=max)&&
    Math.abs(row.remaining[k]+row.delivered[k]+(inTransit.get(row.id+':'+k)||0)-max)<1e-7))return false;
  const yard=attached.get(row.id),key=buildingKey({x:row.x,y:row.y});
  if(row.grounded?yard:active(row)&&!yard||yard&&(yard.x!==row.x||yard.y!==row.y))return false;
  if(active(row)){if(cells.has(key))return false;cells.add(key);}
  seen.add(row.id);
 }
 return [...attached.keys()].every(id=>seen.has(id));
}
