import {BUILDINGS} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';

const REQUIRED={clay:30,reed:20};
const EPS=1e-8;
export const newCreatorMaterials=()=>({version:1,clay:0,reed:0});

export function markCreatorCargo(s,c,resource,amount,stocked=false){
 const q=s.creatorMaterials;
 if(!q||!Object.hasOwn(REQUIRED,resource)||amount<=EPS)return;
 c.creatorCargo={resource,amount,...stocked?{stocked:true}:{}};
}

export function acceptCreatorCargo(s,c,resource,accepted){
 const mark=c.creatorCargo,q=s.creatorMaterials;
 if(!q||mark?.resource!==resource||accepted<=EPS)return 0;
 const amount=Math.min(mark.amount,accepted);
 mark.amount-=amount;
 if(!mark.stocked)q[resource]=Math.min(REQUIRED[resource],q[resource]+amount);
 if(mark.amount<=EPS)delete c.creatorCargo;
 return amount;
}

export function addCreatorStock(holder,resource,amount){
 if(!holder||amount<=EPS)return;
 const origin=holder.creatorStock??={};
 origin[resource]=(origin[resource]||0)+amount;
}

// Tagged units are selected first among interchangeable units of one material.
export function takeCreatorStock(holder,resource,amount){
 const origin=holder.creatorStock;
 const tagged=origin?.[resource]||0;
 if(tagged<=EPS||amount<=EPS)return 0;
 const taken=Math.min(tagged,amount);
 if(tagged-taken<=EPS)delete origin[resource];
 else origin[resource]-=taken;
 if(!Object.keys(origin).length)delete holder.creatorStock;
 return taken;
}

export function recordCreatorConstruction(b,q){
 if(!q.creatorAllocations)return;
 const materials={};
 for(const row of Object.values(q.creatorAllocations)){
  for(const [resource,amount] of Object.entries(row))materials[resource]=(materials[resource]||0)+amount;
 }
 b.creatorBuilt=materials;
}

export function creatorMaterialsView(s){
 const q=s.creatorMaterials;
 return q?{clay:q.clay,reed:q.reed,required:REQUIRED}:null;
}

export function validateCreatorMaterials(s){
 const q=s.creatorMaterials;
 if(q!==undefined&&(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==3||
  Object.entries(REQUIRED).some(([resource,max])=>!Number.isFinite(q[resource])||q[resource]<0||q[resource]>max)))return false;
 const matches=(marks,physical)=>!!q&&marks&&typeof marks==='object'&&!Array.isArray(marks)&&
  Object.keys(marks).length>0&&Object.entries(marks).every(([resource,n])=>Object.hasOwn(REQUIRED,resource)&&
   Number.isFinite(n)&&n>EPS&&n<=(physical?.[resource]||0)+EPS);
 if(!s.buildings.every(b=>(b.creatorStock===undefined||matches(b.creatorStock,b.stock))&&
  (b.creatorBuilt===undefined||b.construction?.kind!=='new'&&matches(b.creatorBuilt,BUILDINGS[b.type]))&&
  (b.construction?.creatorAllocations===undefined||b.construction.kind==='new'&&
   b.construction.creatorAllocations&&Object.keys(b.construction.creatorAllocations).length>0&&
   Object.entries(b.construction.creatorAllocations).every(([key,marks])=>matches(marks,b.construction.allocations?.[key])))))return false;
 return s.citizens.every(c=>{
  const mark=c.creatorCargo;
  return mark===undefined||!!q&&mark&&Object.keys(mark).length===(mark.stocked===true?3:2)&&Object.hasOwn(REQUIRED,mark.resource)&&
   Number.isFinite(mark.amount)&&mark.amount>EPS&&mark.amount<=(c.cargo?.[mark.resource]||0)+EPS&&
   !c.tradeJob&&!c.saleJob;
 });
}
