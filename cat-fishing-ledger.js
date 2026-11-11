import {recordRevelationFact} from './revelation-evidence.js';
import {buildingKey} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';
export {usesCatDiscovery} from './scenario-profiles.js';
const eps=1e-7;
export function initializeCatFishing(s){if(usesCatDiscovery(s))s.catFishing??={version:1,candidateId:null,completed:0,lessons:{},nextCatchId:1,nextSiteId:1,pending:[],flows:{}};}
const cargo=c=>'cargo:'+c.id,output=b=>'output:'+b.catFishingSiteId;
const amount=n=>Number.isFinite(n)&&n>eps;
const sum=rows=>rows.reduce((n,r)=>n+r.amount,0);
function compact(rows){const out=[];for(const row of rows){if(!amount(row.amount))continue;const last=out.at(-1);if(last?.id===row.id)last.amount+=row.amount;else out.push({...row});}return out;}
function writeFlow(q,key,rows){const next=compact(rows);if(next.some(r=>r.id))q.flows[key]=next;else delete q.flows[key];}
function removeReceipts(q,ids){if(!ids.size)return;q.pending=q.pending.filter(r=>!ids.has(r.id));for(const [key,rows]of Object.entries(q.flows))writeFlow(q,key,rows.map(r=>ids.has(r.id)?{id:0,amount:r.amount}:r));}
function queue(q,key,before){
 let rows=q.flows[key]||[];const held=sum(rows);
 // Evidence is never permitted to outrun physical food. Lost evidence is not
 // replaced by a guess and does not edit the actual food or its owner.
 if(held>before+eps){removeReceipts(q,new Set(rows.filter(r=>r.id).map(r=>r.id)));rows=[];}
 const extra=Math.max(0,before-sum(rows));return compact([...rows,...amount(extra)?[{id:0,amount:extra}]:[]]);
}
function take(q,key,n,before){
 const rows=queue(q,key,before),taken=[];let left=Math.min(n,before);
 while(left>eps&&rows.length){const row=rows[0],part=Math.min(left,row.amount);taken.push({id:row.id,amount:part});row.amount-=part;left-=part;if(row.amount<=eps)rows.shift();}
 writeFlow(q,key,rows);return compact(taken);
}
function move(q,from,to,n,beforeFrom,beforeTo){const pieces=take(q,from,n,beforeFrom);writeFlow(q,to,[...queue(q,to,beforeTo),...pieces]);}
function refreshCandidate(q,s){
 const people=new Set(s.citizens.map(c=>c.id));
 for(const id of Object.keys(q.lessons))if(!people.has(Number(id)))delete q.lessons[id];
 if(!people.has(q.candidateId))q.candidateId=null;
 let best=q.candidateId,count=q.lessons[best]||0;for(const [id,n]of Object.entries(q.lessons))if(n>count){best=Number(id);count=n;}
 if(best===null)best=q.pending.find(r=>people.has(r.producerId))?.producerId??null;
 q.candidateId=best;q.completed=count;
}
export function reconcileCatFishing(s){
 if(!usesCatDiscovery(s)||!s.catFishing)return;const q=s.catFishing,people=new Set(s.citizens.map(c=>c.id));
 removeReceipts(q,new Set(q.pending.filter(r=>!people.has(r.producerId)).map(r=>r.id)));refreshCandidate(q,s);
}
function finish(q,s){const complete=q.pending.filter(r=>r.accepted>=r.total-eps);for(const r of complete)q.lessons[r.producerId]=Math.min(3,(q.lessons[r.producerId]||0)+1);removeReceipts(q,new Set(complete.map(r=>r.id)));refreshCandidate(q,s);}

// Called only at real fishing production. IDs are independent of coordinates and
// building.id, which still controls existing work/appearance identities.
export function recordFishingCatch(s,b,c,n,{inBuffer=false,before=0}={}){
 if(!usesCatDiscovery(s)||b?.type!=='fishing'||!s.buildings.includes(b)||c?.age<16||c?.work!==buildingKey(b)||!amount(n))return null;
 recordRevelationFact(s,'food',c,b);
 initializeCatFishing(s);const q=s.catFishing;
 reconcileCatFishing(s);
 if(q.pending.length>=3||(q.lessons[c.id]||0)+q.pending.filter(r=>r.producerId===c.id).length>=3)return null;
 q.candidateId??=c.id;
 b.catFishingSiteId??=q.nextSiteId++;
 const row={id:q.nextCatchId++,producerId:c.id,siteId:b.catFishingSiteId,total:n,accepted:0};q.pending.push(row);
 const key=inBuffer?output(b):cargo(c),existing=inBuffer?before:Math.max(0,(c.cargo?.food||0)-n);
 writeFlow(q,key,[...queue(q,key,existing),{id:row.id,amount:n}]);return row.id;
}
export function moveFishingCargoToOutput(s,b,c,n,beforeOutput,beforeCargo){
 if(!usesCatDiscovery(s)||!s.catFishing||!amount(n))return;
 if(!b?.catFishingSiteId){discardFishingCargo(s,c);return;}
 move(s.catFishing,cargo(c),output(b),n,beforeCargo,beforeOutput);
}
export function pickupFishingOutput(s,b,c,n,beforeOutput){
 if(!usesCatDiscovery(s)||!s.catFishing||!b?.catFishingSiteId||!amount(n))return;
 move(s.catFishing,output(b),cargo(c),n,beforeOutput,0);
}
export function acceptFishingCargo(s,c,n,beforeCargo,{qualifies=false}={}){
 if(!usesCatDiscovery(s)||!s.catFishing||!amount(n))return;
 const q=s.catFishing,pieces=take(q,cargo(c),n,beforeCargo),invalid=new Set();
 for(const piece of pieces){if(!piece.id)continue;const row=q.pending.find(r=>r.id===piece.id);if(!row)continue;if(qualifies)row.accepted+=piece.amount;else invalid.add(row.id);}
 removeReceipts(q,invalid);finish(q,s);
}
export function dryFishingOutput(s,b,n,beforeOutput){
 if(!s.catFishing||!b.catFishingSiteId)return;
 const q=s.catFishing,parts=take(q,output(b),n,beforeOutput);
 removeReceipts(q,new Set(parts.filter(r=>r.id).map(r=>r.id)));
}
export function discardFishingCargo(s,c){if(usesCatDiscovery(s)&&s.catFishing)discard(s.catFishing,cargo(c));}
export function discardFishingOutput(s,b){if(usesCatDiscovery(s)&&s.catFishing&&b?.catFishingSiteId)discard(s.catFishing,output(b));}
function discard(q,key){removeReceipts(q,new Set((q.flows[key]||[]).filter(r=>r.id).map(r=>r.id)));delete q.flows[key];}

// Saved evidence is bounded by three pending catches and current physical owners,
// not the number of past production, transfers or residents ever born.
export function validateCatFishing(s){
 const markers=(s.buildings||[]).filter(b=>b.catFishingSiteId!==undefined);
 if(!usesCatDiscovery(s))return s.catFishing===undefined&&!markers.length;
 const q=s.catFishing,integer=(n,min=0)=>Number.isSafeInteger(n)&&n>=min,plain=o=>o&&typeof o==='object'&&!Array.isArray(o),keys=(o,list)=>Object.keys(o).every(k=>list.includes(k));
 if(!integer(s.demography?.nextId,1)||s.godhood?.mode!=='awakening'||!plain(q)||q.version!==1||!keys(q,['version','candidateId','completed','lessons','nextCatchId','nextSiteId','pending','flows'])||!integer(q.completed)||q.completed>3||!integer(q.nextCatchId,1)||!integer(q.nextSiteId,1)||!Array.isArray(q.pending)||q.pending.length>3||!plain(q.lessons)||!plain(q.flows))return false;
 if(q.candidateId!==null&&(!integer(q.candidateId)||q.candidateId>=s.demography?.nextId)||q.candidateId===null&&(q.completed||q.pending.length||Object.keys(q.flows).length||Object.keys(q.lessons).length))return false;
 const sites=new Map(),people=new Map((s.citizens||[]).map(c=>[c.id,c]));
 for(const b of markers){const id=b.catFishingSiteId;if(b.type!=='fishing'||!integer(id,1)||id>=q.nextSiteId||sites.has(id))return false;sites.set(id,b);}
 if(Object.keys(q.lessons).length>people.size||Object.entries(q.lessons).some(([id,n])=>!(/^(0|[1-9]\d*)$/.test(id))||!people.has(Number(id))||!integer(n,1)||n>3)||q.completed!==(q.lessons[q.candidateId]||0)||q.candidateId!==null&&!people.has(q.candidateId))return false;
 const totals=new Map(),ids=new Set(),byProducer=new Map();
 for(const r of q.pending){if(!plain(r)||!keys(r,['id','producerId','siteId','total','accepted'])||!integer(r.id,1)||r.id>=q.nextCatchId||ids.has(r.id)||!people.has(r.producerId)||!integer(r.siteId,1)||r.siteId>=q.nextSiteId||!amount(r.total)||r.total>1e6||!Number.isFinite(r.accepted)||r.accepted<0||r.accepted>=r.total-eps)return false;ids.add(r.id);totals.set(r.id,0);byProducer.set(r.producerId,(byProducer.get(r.producerId)||0)+1);}
 if([...byProducer].some(([id,n])=>n+(q.lessons[id]||0)>3))return false;
 if(Object.keys(q.flows).length>people.size+sites.size)return false;
 for(const [key,rows]of Object.entries(q.flows)){
  const match=/^(cargo|output):(0|[1-9]\d*)$/.exec(key);if(!match||!Array.isArray(rows)||!rows.length||rows.length>7||!rows.some(r=>r.id))return false;
  const holder=match[1]==='cargo'?people.get(Number(match[2])):sites.get(Number(match[2]));if(!holder)return false;
  const physical=match[1]==='cargo'?holder.cargo?.food||0:holder.workshopStock?.output?.food||0;
  for(const r of rows){if(!plain(r)||!keys(r,['id','amount'])||!integer(r.id)||r.id&&!ids.has(r.id)||!amount(r.amount))return false;if(r.id)totals.set(r.id,totals.get(r.id)+r.amount);}
  if(sum(rows)>physical+1e-6)return false;
 }
 return q.pending.every(r=>Math.abs(totals.get(r.id)-(r.total-r.accepted))<1e-6);
}
