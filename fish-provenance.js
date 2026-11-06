import {buildingKey,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';

const EPS=1e-8, LIMIT=64, REQUIRED_CATCHES=10, REQUIRED_HOMES=2;
const magnitude=parts=>parts.reduce((sum,part)=>sum+Math.abs(part),0);
export const newRichCatchEvidence=()=>({version:1,homes:[]});

// Positive segments are local catches. Negative segments are unidentified food;
// trailing unidentified food is implicit in the physical amount.
export function appendFish(holder,key,parts,before){
 if(!holder||!parts.some(part=>part>EPS))return;
 let queue=holder[key]||[], tracked=magnitude(queue);
 if(tracked>before+EPS){queue=[];tracked=0;}
 const push=part=>{
  if(Math.abs(part)<=EPS)return;
  const last=queue.length-1;
  if(Math.sign(queue[last])===Math.sign(part))queue[last]+=part;
  else queue.push(part);
 };
 push(tracked-before);
 for(const part of parts)push(part);
 if(queue.length>LIMIT){
  const old=queue.splice(0,queue.length-LIMIT+1);
  if(queue[0]<0)queue[0]-=magnitude(old);
  else queue.unshift(-magnitude(old));
 }
 holder[key]=queue;
}

export function takeFish(holder,key,amount,before){
 const queue=holder?.[key];
 if(!queue||amount<=EPS)return [];
 if(magnitude(queue)>before+EPS){delete holder[key];return [];}
 const taken=[];
 while(amount>EPS&&queue.length){
  const part=queue[0],used=Math.min(amount,Math.abs(part));
  taken.push(Math.sign(part)*used);
  amount-=used;
  if(Math.abs(part)-used<=EPS)queue.shift();
  else queue[0]-=Math.sign(part)*used;
 }
 while(taken.at(-1)<0)taken.pop();
 if(!queue.length)delete holder[key];
 return taken;
}

export function recordInspiredCatch(s,site,fisher,amount,{inspired=fisher.calling==='fisher'}={}){
 const q=s.richCatchEvidence;
 if(!q||q.fisher!==undefined||!inspired||amount<=EPS||site?.type!=='fishing'||fisher.work!==buildingKey(site))return;
 fisher.richCatches=Math.min(REQUIRED_CATCHES,(fisher.richCatches||0)+1);
 if(fisher.richCatches===REQUIRED_CATCHES)q.fisher=fisher.id;
}

export function richCatchView(s){
 const q=s.richCatchEvidence;
 if(!q)return null;
 const qualified=q.fisher!==undefined&&q.homes.length===REQUIRED_HOMES;
 const catches=q.fisher!==undefined?REQUIRED_CATCHES:s.citizens.reduce((best,c)=>Math.max(best,c.richCatches||0),0);
 return {catches,homes:q.homes.length,requiredCatches:REQUIRED_CATCHES,requiredHomes:REQUIRED_HOMES,qualified};
}

export function recordHomeFish(s,home,parts){
 const q=s.richCatchEvidence;
 if(!q||q.homes.length>=REQUIRED_HOMES||home?.type!=='house'||!isOperational(home)||!parts.some(part=>part>EPS))return;
 const key=buildingKey(home);
 if(q.homes.includes(key)||!s.citizens.some(c=>c.home===key))return;
 q.homes.push(key);
}

export function validateFishProvenance(s){
 const q=s.richCatchEvidence;
 if(q!==undefined&&(!usesCatDiscovery(s)||!q||q.version!==1||Object.keys(q).length!==(q.fisher===undefined?2:3)||
  !Array.isArray(q.homes)||q.homes.length>REQUIRED_HOMES||new Set(q.homes).size!==q.homes.length||
  !q.homes.every(key=>typeof key==='string'&&/^\d+,\d+$/.test(key))||
  q.fisher!==undefined&&(!Number.isSafeInteger(q.fisher)||q.fisher<0||
   q.fisher>=s.demography.nextId)))return false;
 function valid(parts,physical){
  return parts===undefined||!!q&&Array.isArray(parts)&&parts.length>0&&parts.length<=LIMIT&&parts.at(-1)>EPS&&
   parts.every((part,i)=>Number.isFinite(part)&&Math.abs(part)>EPS&&(!i||Math.sign(part)!==Math.sign(parts[i-1])))&&
   magnitude(parts)<=(physical||0)+EPS;
 }
 return s.buildings.every(b=>valid(b.fishStock,b.stock?.food)&&valid(b.fishOutput,b.workshopStock?.output?.food))&&
  s.citizens.every(c=>valid(c.fishCargo,c.cargo?.food)&&valid(c.fishPantry,c.pantryFood)&&
  (c.richCatches===undefined||!!q&&Number.isInteger(c.richCatches)&&c.richCatches>=1&&c.richCatches<=REQUIRED_CATCHES)&&
  (c.inspiredFishReturn===undefined||!!q&&typeof c.inspiredFishReturn==='string'&&/^\d+,\d+$/.test(c.inspiredFishReturn)&&!!c.fishCargo));
}
