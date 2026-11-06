import {usesCatDiscovery} from './scenario-profiles.js';

const REQUIRED={clay:30,reed:20};
const EPS=1e-8;
export const newCreatorMaterials=()=>({version:1,clay:0,reed:0});

export function markCreatorCargo(s,c,resource,amount){
 const q=s.creatorMaterials;
 if(!q||!Object.hasOwn(REQUIRED,resource)||q[resource]>=REQUIRED[resource]||amount<=EPS)return;
 c.creatorCargo={resource,amount};
}

export function acceptCreatorCargo(s,c,resource,accepted){
 const mark=c.creatorCargo,q=s.creatorMaterials;
 if(!q||mark?.resource!==resource||accepted<=EPS)return;
 const amount=Math.min(mark.amount,accepted);
 mark.amount-=amount;
 q[resource]=Math.min(REQUIRED[resource],q[resource]+amount);
 if(mark.amount<=EPS)delete c.creatorCargo;
}

export function creatorMaterialsView(s){
 const q=s.creatorMaterials;
 return q?{clay:q.clay,reed:q.reed,required:REQUIRED}:null;
}

export function validateCreatorMaterials(s){
 const q=s.creatorMaterials;
 if(q!==undefined&&(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==3||
  Object.entries(REQUIRED).some(([resource,max])=>!Number.isFinite(q[resource])||q[resource]<0||q[resource]>max)))return false;
 return s.citizens.every(c=>{
  const mark=c.creatorCargo;
  return mark===undefined||!!q&&mark&&Object.keys(mark).length===2&&Object.hasOwn(REQUIRED,mark.resource)&&
   Number.isFinite(mark.amount)&&mark.amount>EPS&&mark.amount<=(c.cargo?.[mark.resource]||0)+EPS&&
   !c.tradeJob&&!c.saleJob;
 });
}
