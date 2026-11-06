import {recordShapingUse} from './shaping-projects.js';
import {BUILDINGS,buildingKey,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';

const REQUIRED={clay:30,reed:20};
const EPS=1e-8, REQUIRED_PROJECTS=2;
const PROFESSIONS=['clayworker','reedcutter'];
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

export function recordCreatorUse(s,b){
 recordShapingUse(s,b);
 const q=s.creatorMaterials;
 if(!q||!b?.creatorBuilt||!isOperational(b)||q.projects?.length>=REQUIRED_PROJECTS)return;
 const key=buildingKey(b);
 const projects=q.projects??=[];
 if(!projects.includes(key))projects.push(key);
}

export function advanceCreatorEvidence(s){
 const q=s.creatorMaterials;
 if(!q)return;
 // A city updated after inspiration can still prove its current professions.
 if(q.inspired?.length!==PROFESSIONS.length){
  for(const profession of PROFESSIONS)if(!q.inspired?.includes(profession)&&s.citizens.some(c=>c.calling===profession))recordCreatorInspiration(s,profession);
 }
 const creatorOpen=q.projects?.length>=REQUIRED_PROJECTS;
 if(creatorOpen&&!s.shapingProjects)return;
 const homes=s.buildings.filter(b=>b.type==='house'&&(b.shapingProject||!creatorOpen&&b.creatorBuilt&&!q.projects?.includes(buildingKey(b))));
 if(!homes.length)return;
 const occupied=new Set(s.citizens.map(c=>c.home));
 for(const b of homes)if(occupied.has(buildingKey(b)))recordCreatorUse(s,b);
}

export function recordCreatorInspiration(s,profession){
 const q=s.creatorMaterials;
 if(!q||!PROFESSIONS.includes(profession))return;
 const inspired=q.inspired??=[];
 if(!inspired.includes(profession))inspired.push(profession);
}

export function creatorReady(s){
 const q=s.creatorMaterials;
 return !!q&&q.clay>=REQUIRED.clay&&q.reed>=REQUIRED.reed&&
  q.projects?.length===REQUIRED_PROJECTS&&q.inspired?.length===PROFESSIONS.length;
}

export function creatorMaterialsView(s){
 const q=s.creatorMaterials;
 return q?{clay:q.clay,reed:q.reed,required:REQUIRED,qualified:creatorReady(s),dedication:q.dedication,projects:q.projects?.length||0,projectsRequired:REQUIRED_PROJECTS,inspired:q.inspired?.length||0,inspiredRequired:PROFESSIONS.length}:null;
}

export function validateCreatorMaterials(s){
 const q=s.creatorMaterials;
 const unique=(value,max,test)=>Array.isArray(value)&&value.length>0&&value.length<=max&&new Set(value).size===value.length&&value.every(test);
 if(q!==undefined&&(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==3+Number(q.projects!==undefined)+Number(q.inspired!==undefined)+Number(q.dedication!==undefined)||
  q.dedication!==undefined&&(!creatorReady(s)||typeof q.dedication!=='string'||!/^\d+,\d+$/.test(q.dedication))||
  q.projects!==undefined&&!unique(q.projects,REQUIRED_PROJECTS,key=>typeof key==='string'&&/^\d+,\d+$/.test(key))||
  q.inspired!==undefined&&!unique(q.inspired,PROFESSIONS.length,p=>PROFESSIONS.includes(p))||
  Object.entries(REQUIRED).some(([resource,max])=>!Number.isFinite(q[resource])||q[resource]<0||q[resource]>max)))return false;
 const matches=(marks,physical)=>!!q&&marks&&typeof marks==='object'&&!Array.isArray(marks)&&
  Object.keys(marks).length>0&&Object.entries(marks).every(([resource,n])=>Object.hasOwn(REQUIRED,resource)&&
   Number.isFinite(n)&&n>EPS&&n<=(physical?.[resource]||0)+EPS);
 if(!s.buildings.every(b=>(b.creatorDedication===undefined||b.creatorDedication===true&&b.type==='brickyard'&&isOperational(b)&&q?.dedication===buildingKey(b))&&
  (b.creatorStock===undefined||matches(b.creatorStock,b.stock))&&
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
