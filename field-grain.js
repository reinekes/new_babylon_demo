import {buildingKey,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';

const EPS=1e-8;
const LIMIT=32;

export const newEarthDiscovery=()=>({version:1,nextFieldId:1,receipts:[]});

export function recordFieldGrain(s,field,farmer,amount,prefix){
 const q=s.earthDiscovery;
 if(!q||field.grainEvidence||amount<=EPS)return;
 const previous=q.receipts.find(r=>r.fieldId===field.grainFieldId);
 const inspired=farmer.calling==='farmer';
 if(previous&&(!inspired||previous.inspired))return;
 field.grainFieldId??=q.nextFieldId++;
 field.grainEvidence={fieldId:field.grainFieldId,farmerId:farmer.id,inspired,prefix,amount};
}

// Earlier food must leave the buffer or cargo before the tagged portion.
function takeEvidence(mark,n){
 const prefix=Math.min(mark.prefix,n);
 const amount=Math.min(mark.amount,n-prefix);
 mark.prefix-=prefix;mark.amount-=amount;
 return {...mark,prefix,amount};
}

export function pickupFieldGrain(field,courier,n,before){
 const mark=field?.grainEvidence;
 if(!mark||n<=EPS)return;
 if(mark.prefix+mark.amount>before+EPS){delete field.grainEvidence;return;}
 const part=takeEvidence(mark,n);
 if(mark.amount<=EPS)delete field.grainEvidence;
 if(part.amount>EPS)courier.fieldGrain=part;
}

export function acceptFieldGrain(s,courier,n,qualifies){
 const mark=courier.fieldGrain;
 if(!mark||n<=EPS)return;
 const part=takeEvidence(mark,n);
 if(mark.amount<=EPS)delete courier.fieldGrain;
 if(part.amount<=EPS||!qualifies)return;
 const q=s.earthDiscovery,field=s.buildings.find(b=>b.grainFieldId===mark.fieldId&&isOperational(b));
 if(!q||!field)return;
 const key=buildingKey(field),previous=q.receipts.findIndex(r=>r.field===key);
 if(previous>=0){
  const prior=q.receipts[previous];
  if(prior.fieldId===mark.fieldId&&(prior.inspired||!mark.inspired))return;
  q.receipts.splice(previous,1);
 }
 q.receipts.push({fieldId:mark.fieldId,field:key,farmerId:mark.farmerId,inspired:mark.inspired,amount:part.amount,time:s.simTime});
 if(q.receipts.length>LIMIT)q.receipts.shift();
}

export function validateFieldGrain(s){
 const q=s.earthDiscovery,fields=s.buildings.filter(b=>b.grainFieldId!==undefined||b.grainEvidence!==undefined);
 const carrying=s.citizens.filter(c=>c.fieldGrain!==undefined);
 if(q===undefined)return fields.length===0&&carrying.length===0;
 const integer=(v,min,max=Infinity)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
 if(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==3||
  !integer(q.nextFieldId,1)||!Array.isArray(q.receipts)||q.receipts.length>LIMIT)return false;
 const fieldId=v=>integer(v,1,q.nextFieldId-1),farmerId=v=>integer(v,0,s.demography.nextId-1);
 const live=new Map();
 function validMark(mark,physical){
  return mark&&Object.keys(mark).length===5&&fieldId(mark.fieldId)&&farmerId(mark.farmerId)&&typeof mark.inspired==='boolean'&&
   Number.isFinite(mark.amount)&&mark.amount>EPS&&Number.isFinite(mark.prefix)&&mark.prefix>=0&&mark.prefix+mark.amount<=physical+EPS;
 }
 for(const field of fields){
  const id=field.grainFieldId,m=field.grainEvidence;
  if(field.type!=='field'||!fieldId(id)||live.has(id)||m!==undefined&&(!validMark(m,field.workshopStock?.output?.food||0)||m.fieldId!==id))return false;
  live.set(id,buildingKey(field));
 }
 const jobs=new Map((s.district?.jobs||[]).map(job=>[job.id,job]));
 for(const c of carrying){
  const m=c.fieldGrain,job=jobs.get(c.districtJob);
  if(!validMark(m,c.cargo?.food||0)||job?.resource!=='food'||live.get(m.fieldId)!==job.source)return false;
 }
 const keys=new Set(),ids=new Set();
 let previousTime=0;
 for(const row of q.receipts){
  if(!row||Object.keys(row).length!==6||!fieldId(row.fieldId)||!farmerId(row.farmerId)||typeof row.inspired!=='boolean'||
   typeof row.field!=='string'||!/^\d+,\d+$/.test(row.field)||keys.has(row.field)||ids.has(row.fieldId)||
   live.has(row.fieldId)&&live.get(row.fieldId)!==row.field||!Number.isFinite(row.amount)||row.amount<=EPS||row.amount>12||
   !Number.isFinite(row.time)||row.time<previousTime||row.time>s.simTime)return false;
  keys.add(row.field);ids.add(row.fieldId);previousTime=row.time;
 }
 return true;
}
