import {recordBuildingProduction} from './building-production-history.js';
import {initializeDairy,dairyNeeds} from './dairy.js';
import {BUILDINGS,MATERIALS,buildingKey,isOperational,outputMultiplier} from './definitions.js';
import {isArtisan,artisanRecipe,artisanNeeds,artisanOutput,collectArtisan} from './artisan.js';
import {BRICK_RECIPE,brickNeeds,collectBricks} from './bricks.js';
import {KILN_RECIPE,kilnNeeds,collectFired} from './kilns.js';
import {craftBatch} from './textiles.js';
import {ration} from './households.js';
const eps=1e-7,n=value=>Number.isFinite(value)?Math.max(0,value):0;
const sum=(target,k,value)=>{if(value>0)target[k]=(target[k]||0)+value;};
export const isProductionStore=b=>Object.keys(BUILDINGS[b?.type]?.output||{}).some(k=>MATERIALS.includes(k));
export const isBuildingStore=b=>b?.type==='house'||b?.type==='healer'||isProductionStore(b);
export function inputRecipe(b){
 if(isArtisan(b))return artisanRecipe(b);
 if(b?.type==='brickyard')return BRICK_RECIPE;if(b?.type==='kiln')return KILN_RECIPE;
 if(b?.type==='weaver')return {wool:craftBatch(b)};if(b?.type==='tailor')return {cloth:craftBatch(b)};
 if(b?.type==='cowshed')return {reed:3,water:12};
 if(b?.type==='healer')return {food:4,reed:2};return {};
}
export function inputBuffer(b){return isArtisan(b)?b.artisan:b?.type==='brickyard'?b.brickmaking:b?.type==='kiln'?b.firing:b?.type==='weaver'?b.weaving:b?.type==='tailor'?b.tailoring:b?.type==='healer'?b.workshopStock?.input:b?.type==='cowshed'?b.dairy:null;}
export function inputNeeds(b){
 if(b?.type==='cowshed')return dairyNeeds(b);if(isArtisan(b))return artisanNeeds(b);if(b?.type==='brickyard')return brickNeeds(b);if(b?.type==='kiln')return kilnNeeds(b);
 return Object.fromEntries(Object.entries(inputRecipe(b)).map(([k,v])=>[k,Math.max(0,v-n(inputBuffer(b)?.[k]))]));
}
export function initializeBuildingInventory(s){
 initializeDairy(s);
 for(const b of s.buildings||[]){
  if(isProductionStore(b)||b.type==='healer'){b.workshopStock??={output:{}};b.workshopStock.output??={};if(b.type==='healer')b.workshopStock.input??={food:0,reed:0};}
  if(b.type==='house')b.householdStock??={clothing:0,pottery:0,beer:0,milk:0};
 }
}
export function homeStockCapacity(s,b,k){
 const people=(s.citizens||[]).filter(c=>c.home===buildingKey(b));
 if(!people.length)return 0;
 if(k==='food')return people.reduce((a,c)=>a+ration(c)*8/3,0);
 if(k==='water')return people.reduce((a,c)=>a+(c.age<16?.5:1)*3,0);
 return k==='clothing'?Math.min(4,Math.max(1,Math.ceil(people.length/2))):k==='milk'?Math.max(0,people.length*2):['pottery','beer'].includes(k)&&people.length?2:0;
}
export const outputCapacity=b=>24*(b?.level||1);
export function outputRoom(b,k){return Math.max(0,outputCapacity(b)-n(b.workshopStock?.output?.[k]));}
export function putProductionOutput(s,b,goods,{record=true}={}){
 if(!b.workshopStock||Object.entries(goods).some(([k,v])=>!MATERIALS.includes(k)||!Number.isFinite(v)||v<0||outputRoom(b,k)+eps<v))return false;
 for(const [k,v]of Object.entries(goods)){b.workshopStock.output[k]=n(b.workshopStock.output[k])+v;if(record)recordBuildingProduction(s,b,k,v);}return true;
}
// Completion is recorded by the producing stage itself. This is only a local
// transfer, including legacy ready batches whose completion date is unknown.
export function collectReadyOutputs(s){
 initializeBuildingInventory(s);
 for(const b of s.buildings||[]){if(!isOperational(b))continue;let k,ready,collect;
  if(isArtisan(b)){k=artisanOutput(b);ready=b.artisan?.ready;collect=()=>collectArtisan(b);}
  else if(b.type==='brickyard'){k='brick';ready=b.brickmaking?.ready;collect=()=>collectBricks(b);}
  else if(b.type==='kiln'){k='firedBrick';ready=b.firing?.ready;collect=()=>collectFired(b);}
  if(ready>0&&outputRoom(b,k)+eps>=ready)putProductionOutput(s,b,{[k]:collect()},{record:false});
 }
}
export function buildingInputStock(b,k){return b?.type==='house'?k==='food'?n(b.pantry):k==='water'?n(b.water):n(b.householdStock?.[k]):n(inputBuffer(b)?.[k]);}
export function buildingInputRoom(s,b,k){
 if(!isOperational(b))return 0;
 if(b.type==='house')return Math.max(0,homeStockCapacity(s,b,k)-buildingInputStock(b,k));
 return Math.max(0,inputNeeds(b)[k]||0);
}
export function putBuildingInput(s,b,k,amount){
 const actual=Math.min(n(amount),b.type==='house'&&k==='food'?Infinity:buildingInputRoom(s,b,k));if(actual<=0)return 0;
 if(b.type==='house'){if(k==='food'){b.pantry=n(b.pantry)+actual;b.pantryDelivered=n(b.pantryDelivered)+actual;}else if(k==='water'){b.water=n(b.water)+actual;b.waterDelivered=n(b.waterDelivered)+actual;}else b.householdStock[k]=n(b.householdStock[k])+actual;}
 else inputBuffer(b)[k]=n(inputBuffer(b)[k])+actual;return actual;
}
export function takeBuildingOutput(b,k,amount){const actual=Math.min(n(amount),n(b.workshopStock?.output?.[k]));if(actual)b.workshopStock.output[k]-=actual;return actual;}
export function buildingInventory(s,b){
 const input={},output={...b.workshopStock?.output},storage={...b.stock},inProcess={},incoming={},outgoing={},capacities={input:{},output:{},storage:{}};
 if(b.type==='house')for(const k of ['food','water','clothing','pottery','beer','milk']){input[k]=buildingInputStock(b,k);capacities.input[k]=homeStockCapacity(s,b,k);}
 else for(const [k,v]of Object.entries(inputRecipe(b))){input[k]=n(inputBuffer(b)?.[k]);capacities.input[k]=v;}
 for(const [k,v]of Object.entries(BUILDINGS[b.type]?.output||{}))if(MATERIALS.includes(k)){output[k]??=0;capacities.output[k]=outputCapacity(b);}
 if(b.artisan?.ready)sum(output,artisanOutput(b),b.artisan.ready);
 if(b.brickmaking?.ready)sum(output,'brick',b.brickmaking.ready);if(b.firing?.ready)sum(output,'firedBrick',b.firing.ready);
 if(b.brickmaking?.wet)inProcess.brick=b.brickmaking.wet;if(b.firing?.hot)inProcess.firedBrick=b.firing.hot;
 if(b.artisan&&!['idle','ready'].includes(b.artisan.stage))inProcess[artisanOutput(b)]=b.type==='pottery'?2:3;
 if(b.crop){input.food=n(b.crop.seedStock);inProcess.sheaves=n(b.crop.sheaves);inProcess.crop=n(b.crop.remaining);}
 if(b.flock)inProcess.wool=n(b.flock.fleece);
 const key=buildingKey(b);
 // Only paid, uncollected purchases belong to this port. Merchant stock is
 // still the merchant's property and is deliberately absent from this view.
 if(['market','harbor'].includes(b.type))for(const q of s.trade?.deliveries||[]){if(q.market!==key||!MATERIALS.includes(q.resource))continue;sum(storage,q.resource,n(q.remaining));for(const c of s.citizens||[])if(c.tradeJob===q.id)sum(outgoing,q.resource,n(c.cargo?.[q.resource]));}
 for(const c of s.citizens||[]){if(c.pantryTrip&&(c.pantryTarget||c.home)===key)sum(incoming,'food',n(c.pantryFood));if(c.waterTrip?.target===key)sum(incoming,'water',n(c.waterTrip.load));if(c.craftSite===key)sum(incoming,c.craftMaterial||(c.craftCloth!==undefined?'cloth':'wool'),n(c.craftAmount)+n(c.craftCloth)+n(c.craftWool));if(c.seedField===key)sum(incoming,'food',n(c.seedFood));}
 for(const q of s.district?.jobs||[]){const carried=(s.citizens||[]).filter(c=>c.districtJob===q.id).reduce((a,c)=>a+n(c.cargo?.[q.resource]),0);if(q.target===key)sum(incoming,q.resource,n(q.remaining)+carried);if(q.source===key)sum(outgoing,q.resource,n(q.remaining)+carried);}
 return {storage,input,output,inProcess,inTransit:{input:incoming,output:outgoing},capacities};
}
export function validateBuildingInventory(s){
 const validMap=(v,keys,max=1e9)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.entries(v).every(([k,n])=>keys.includes(k)&&Number.isFinite(n)&&n>=0&&n<=max);
 for(const b of s.buildings||[]){
  if(isProductionStore(b)||b.type==='healer'){if(!b.workshopStock||Object.keys(b.workshopStock).some(k=>!['input','output'].includes(k))||!validMap(b.workshopStock.output,Object.keys(BUILDINGS[b.type]?.output||{}).filter(k=>MATERIALS.includes(k)),outputCapacity(b)+eps))return false;if(b.type==='healer'?!validMap(b.workshopStock.input,['food','reed'],4):b.workshopStock.input!==undefined)return false;}
  if(b.type!=='house')for(const [k,capacity]of Object.entries(inputRecipe(b))){if(k==='water')continue;const key=buildingKey(b),incoming=(s.citizens||[]).reduce((n,c)=>n+(c.craftSite===key&&(c.craftMaterial===k||!c.craftMaterial&&(k==='wool'&&c.craftWool!==undefined||k==='cloth'&&c.craftCloth!==undefined))?(c.craftAmount||0)+(c.craftWool||0)+(c.craftCloth||0):0)+((s.district?.jobs||[]).some(q=>q.id===c.districtJob&&q.target===key&&q.resource===k&&q.targetKind==='input')?c.cargo?.[k]||0:0),0);if(n(inputBuffer(b)?.[k])+incoming>capacity+eps||isArtisan(b)&&b.artisan?.stage!=='idle'&&incoming>eps)return false;}
  if(!isProductionStore(b)&&b.type!=='healer'&&b.workshopStock!==undefined)return false;
  if(b.type==='house'){if(!validMap(b.householdStock,['clothing','pottery','beer','milk']))return false;}else if(b.householdStock!==undefined)return false;
 }
 return true;
}
