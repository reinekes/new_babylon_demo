import {MATERIALS,isOperational,levelOf} from './definitions.js';
const keyOf=b=>`${b.x},${b.y}`;
const empty=()=>Object.fromEntries(MATERIALS.map(k=>[k,0]));
const amount=n=>Number.isFinite(n)&&n>0?n:0;
function referencedStores(s){
 const refs=new Set(),allocation=q=>{for(const map of [q?.sources,q?.allocations])for(const key of Object.keys(map||{}))refs.add(key);};
 for(const b of [...s.buildings||[],...s.roads||[]])if(b.construction)allocation(b.construction);
 allocation(s.festival);
 for(const q of s.trade?.sales||[])if(q.amount>q.loaded+q.cancelled)allocation(q);
 for(const q of s.district?.jobs||[]){const carried=(s.citizens||[]).some(c=>c.districtJob===q.id&&Object.values(c.cargo||{}).some(n=>n>0));if(q.remaining>0||carried){refs.add(q.source);refs.add(q.target);}}
 for(const c of s.citizens||[])if(c.clothingTarget!==undefined||c.craftSite||c.seedField||c.pantryTrip||Object.values(c.cargo||{}).some(n=>n>0))refs.add(c.store);
 return refs;
}
export function stockStores(s){
 const central=[],others=[],ground=[];let home,refs;
 for(const b of s.buildings||[]){
  if(!isOperational(b))continue;
  if(b.type==='shrine')central.push(b);
  else if(b.type==='granary'||b.type==='depot')others.push(b);
  else if(b.type==='house'){home??=b;if(b.stock&&(MATERIALS.some(k=>b.stock[k]>0)||(refs??=referencedStores(s)).has(keyOf(b))))ground.push(b);}
 }
 const stores=central.concat(others);
 if(!stores.length&&home&&!ground.includes(home))ground.unshift(home);
 return stores.concat(ground);
}
export function storeCapacity(b){return b.type==='granary'?150*levelOf(b):b.type==='depot'?60*levelOf(b):200;}
// Aggregate changes are the compatibility boundary for existing economic actions.
// Local transfers always update both sides, so reconciliation never redistributes them.
export function syncInventory(s){
 const stores=stockStores(s),set=new Set(stores);
 for(const b of s.buildings||[])if(!set.has(b)&&b.stock){if(Object.values(b.stock).some(n=>n>0))throw new Error('Cannot abandon stocked building');if(b.type==='house')delete b.stock;}
 const first=!s.inventory;s.inventory??={version:1};
 for(const b of stores){b.stock??=empty();for(const k of MATERIALS)b.stock[k]??=0;}
 for(const k of MATERIALS){
  const target=amount(s.resources[k]),total=stores.reduce((n,b)=>n+b.stock[k],0);
  if(!stores.length){if(target>0)throw new Error('No operational inventory store');continue;}
  if(first){if(total===0)stores[0].stock[k]+=target;else if(target>total)stores[0].stock[k]+=target-total;}
  else if(target>total)stores[0].stock[k]+=target-total;
  else if(target<total){let remaining=total-target;for(const b of stores){const taken=Math.min(b.stock[k],remaining);b.stock[k]-=taken;remaining-=taken;if(remaining<=0)break;}}
  s.resources[k]=first?Math.max(total,target):target;
 }
 return s;
}
function store(s,key){return stockStores(s).find(b=>keyOf(b)===key);}
export function storeStock(s,key,k){syncInventory(s);return MATERIALS.includes(k)?store(s,key)?.stock[k]||0:0;}
export function putStock(s,key,k,n,{overflow=false}={}){
 syncInventory(s);const b=store(s,key);if(!b||!MATERIALS.includes(k))return 0;
 const accepted=Math.min(amount(n),overflow?Infinity:Math.max(0,storeCapacity(b)-b.stock[k]));b.stock[k]+=accepted;s.resources[k]+=accepted;return accepted;
}
export function takeStock(s,key,k,n){
 syncInventory(s);const b=store(s,key);if(!b||!MATERIALS.includes(k))return 0;
 const taken=Math.min(b.stock[k],amount(n));b.stock[k]-=taken;s.resources[k]-=taken;return taken;
}
export function foodAvailability(s){
 syncInventory(s);let target=0;
 if(s.foodPlan?.protectSeeds!==false){for(const b of s.buildings||[])if(b.type==='field'&&isOperational(b))target+=Math.max(0,4-(b.crop?.seedStock||0)-(s.season===0?(b.crop?.sown||0)*4:0));target=Math.min(s.resources.food,Math.max(0,target-(s.citizens||[]).reduce((n,c)=>n+(c.seedFood||0),0)));}
 const result=new Map();for(const b of stockStores(s)){const protectedFood=Math.min(b.stock.food,target);result.set(keyOf(b),Math.max(0,b.stock.food-protectedFood));target-=protectedFood;}return result;
}
export const foodAvailableAt=(s,key)=>foodAvailability(s).get(key)||0;

export function reserveStock(s,cost){
 syncInventory(s);const entries=Object.entries(cost).filter(([k])=>MATERIALS.includes(k)),food=entries.some(([k])=>k==='food')?foodAvailability(s):null;
 if(entries.some(([k,n])=>!Number.isFinite(n)||n<0||n>(k==='food'?[...food.values()].reduce((a,b)=>a+b,0):s.resources[k])))return null;
 const sources={};for(const [k,n] of entries){let left=n;for(const b of stockStores(s)){const taken=Math.min(left,k==='food'?food.get(keyOf(b))||0:b.stock[k]);if(taken>0){(sources[keyOf(b)]??={})[k]=taken;b.stock[k]-=taken;s.resources[k]-=taken;left-=taken;}if(left<=0)break;}}return sources;
}
export function takeReserved(s,sources,key,k,n){const source=sources?.[key];if(!source||!MATERIALS.includes(k))return 0;const taken=Math.min(amount(source[k]),amount(n));source[k]-=taken;return taken;}
export function refundSources(s,sources){
 syncInventory(s);const stores=stockStores(s);for(const [key,materials] of Object.entries(sources||{})){const target=stores.find(b=>keyOf(b)===key)||stores[0];if(!target&&Object.values(materials).some(n=>n>0))throw new Error('No refund store');for(const k of MATERIALS){const n=amount(materials[k]);if(n){target.stock[k]+=n;s.resources[k]+=n;materials[k]=0;}}}
}
export function validateInventory(s){
 if(!s.inventory||s.inventory.version!==1||!s.resources||!Array.isArray(s.buildings))return false;
 const stores=stockStores(s),set=new Set(stores),totals=empty();
 for(const b of s.buildings){
  if(!set.has(b)){if(b.stock!==undefined)return false;continue;}
  if(!b.stock||typeof b.stock!=='object'||Array.isArray(b.stock))return false;
  if(Object.keys(b.stock).some(k=>!MATERIALS.includes(k)))return false;
  for(const k of MATERIALS){const n=b.stock[k];if(!Number.isFinite(n)||n<0||n>1e9)return false;totals[k]+=n;}
 }
 return MATERIALS.every(k=>Number.isFinite(s.resources[k])&&s.resources[k]>=0&&Math.abs(s.resources[k]-totals[k])<=1e-6);
}
