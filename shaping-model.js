import {creatorReady} from './creator-materials.js';
import {buildingKey,isOperational} from './definitions.js';
import {reserveStock} from './inventory.js';
import {shapingProjectView} from './shaping-projects.js';
import {worldHeight,worldWidth} from './world.js';

const CLAY=2,REED=1,WORK=6;
const models=['granary','waterpoint','depot','shrine','house'];
const idle=c=>c.phase==='home'&&c.age>=16&&c.health>0&&c.home&&!c.floodShelter&&!c.waterTrip&&!c.pantryTrip&&
 !c.clinic&&!c.school&&!c.districtJob&&!c.tradeJob&&!c.saleJob&&!c.craftSite&&!c.seedField&&
 !Object.values(c.cargo||{}).some(Boolean)&&!Object.values(c.buildCargo||{}).some(Boolean);

export function shapingModelReason(s){
 if(!s.shapingProjects||s.shapingModel?.completedAt!==undefined)return '';
 if(!creatorReady(s))return 'Сначала открой «Руки творца»';
 if(!shapingProjectView(s).qualified)return 'Нужны пять использованных построек одного мастера, включая кирпичный двор и общественное здание';
 return 'Мастер должен закончить глиняный макет';
}

export function advanceShapingModel(s,dt,{reachable=(from,to)=>from===to,busy}={}){
 if(!s.shapingProjects||s.shapingProjects.used.length<5||s.shapingModel?.completedAt!==undefined||s.funeral||dt<=0)return [];
 let model=s.shapingModel;
 const project=model?null:shapingProjectView(s);
 if(!model&&(!project.qualified||!creatorReady(s)))return [];
 const masterId=model?.masterId??project.masterId,master=s.citizens.find(c=>c.id===masterId);
 const available=c=>idle(c)&&!busy?.has(c.id);
 let workers=master?(available(master)?[master]:[]):[];
 if(!master){
  const homes=new Map();
  for(const c of s.citizens){
   if(!available(c))continue;
   if(homes.has(c.home)){workers=[homes.get(c.home),c];break;}
   homes.set(c.home,c);
  }
 }
 if(!workers.length)return [];
 const home=s.buildings.find(b=>b.type==='house'&&buildingKey(b)===workers[0].home&&isOperational(b));
 if(!home)return [];
 if(!model||!master&&!model.reed){
  const cost={clay:model?0:CLAY,reed:master?0:REED};
  const eligibleStores=new Set(s.buildings.map(buildingKey).filter(key=>reachable(workers[0].home,key)));
  if(!reserveStock(s,cost,{eligibleStores}))return [];
  if(!model){
   const type=models.find(type=>!s.buildings.some(b=>b.type===type))||'house';
   model=s.shapingModel={masterId,type,clay:CLAY,reed:0,work:0};
  }
  if(!master)model.reed=REED;
 }
 model.work=Math.min(WORK,model.work+dt);
 if(model.work>=WORK-1e-8){
  Object.assign(model,{work:WORK,completedAt:s.simTime,x:home.x,y:home.y,workers:workers.map(c=>c.id)});
 }
 return workers.map(c=>c.id);
}

export function validateShapingModel(s){
 const q=s.shapingModel;
 if(q===undefined)return true;
 const id=n=>Number.isSafeInteger(n)&&n>=0&&n<s.demography.nextId;
 if(!s.shapingProjects||!q||!id(q.masterId)||!shapingProjectView(s,q.masterId).qualified||!creatorReady(s)||!models.includes(q.type)||q.clay!==CLAY||![0,REED].includes(q.reed)||
  !Number.isFinite(q.work)||q.work<=0||q.work>WORK)return false;
 if(q.completedAt===undefined)return Object.keys(q).length===5&&q.work<WORK;
 return Object.keys(q).length===9&&q.work===WORK&&Number.isFinite(q.completedAt)&&q.completedAt>=0&&q.completedAt<=s.simTime&&
  Number.isInteger(q.x)&&q.x>=0&&q.x<worldWidth(s)&&Number.isInteger(q.y)&&q.y>=0&&q.y<worldHeight(s)&&
  Array.isArray(q.workers)&&q.workers.length===(q.reed?2:1)&&new Set(q.workers).size===q.workers.length&&
  q.workers.every(id)&&(q.reed?!q.workers.includes(q.masterId):q.workers[0]===q.masterId);
}
