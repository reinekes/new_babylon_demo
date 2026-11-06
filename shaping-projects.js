import {BUILDINGS,isOperational} from './definitions.js';
import {usesCatDiscovery} from './scenario-profiles.js';
import {worldHeight,worldWidth} from './world.js';

const REQUIRED=5;
const PUBLIC=new Set(['waterpoint','depot','granary','shrine','ziggurat','musicHouse']);
export const newShapingProjects=()=>({version:1,nextId:1,used:[]});

export function recordShapingProject(s,b,workers){
 const q=s.shapingProjects;
 if(!q||b.shapingProject||b.construction?.kind!=='new'||!BUILDINGS[b.type]||b.type==='road'||!workers.length)return;
 b.shapingProject={id:q.nextId++,builders:[...new Set(workers.map(c=>c.id))]};
}

export function recordShapingUse(s,b){
 const q=s.shapingProjects,project=b?.shapingProject;
 if(!q||!project||!isOperational(b)||q.used.some(row=>row.id===project.id))return;
 q.used.push({...project,type:b.type,x:b.x,y:b.y,time:s.simTime});
}

export function shapingProjectView(s,masterId){
 const q=s.shapingProjects;
 if(!q)return null;
 const builders=new Map();
 for(const row of q.used)for(const id of row.builders){
  if(masterId!==undefined&&masterId!==id)continue;
  const entry=builders.get(id)||{masterId:id,count:0,brickyard:false,publicService:false};
  entry.count++;
  entry.brickyard||=row.type==='brickyard';
  entry.publicService||=PUBLIC.has(row.type);
  builders.set(id,entry);
 }
 const score=v=>Math.min(REQUIRED,v.count)+Number(v.brickyard)+Number(v.publicService);
 const ready=v=>v.count>=REQUIRED&&v.brickyard&&v.publicService;
 const best=[...builders.values()].sort((a,b)=>Number(ready(b))-Number(ready(a))||score(b)-score(a)||b.count-a.count||a.masterId-b.masterId)[0];
 return {masterId:null,count:0,brickyard:false,publicService:false,...best,required:REQUIRED,qualified:!!best&&ready(best)};
}

export function validateShapingProjects(s){
 const q=s.shapingProjects;
 if(q===undefined)return s.buildings.every(b=>b.shapingProject===undefined);
 if(!usesCatDiscovery(s)||!s.creatorMaterials||!q||Object.keys(q).length!==3||q.version!==1||
  !Number.isSafeInteger(q.nextId)||q.nextId<1||!Array.isArray(q.used)||q.used.length>=q.nextId)return false;
 const project=p=>p&&Number.isSafeInteger(p.id)&&p.id>=1&&p.id<q.nextId&&Array.isArray(p.builders)&&
  p.builders.length>0&&p.builders.length<=2&&new Set(p.builders).size===p.builders.length&&
  p.builders.every(id=>Number.isSafeInteger(id)&&id>=0&&id<s.demography.nextId);
 const used=new Map();
 let time=0;
 for(const row of q.used){
  if(!project(row)||Object.keys(row).length!==6||used.has(row.id)||!Object.hasOwn(BUILDINGS,row.type)||row.type==='road'||
   !Number.isInteger(row.x)||row.x<0||row.x>=worldWidth(s)||!Number.isInteger(row.y)||row.y<0||row.y>=worldHeight(s)||
   !Number.isFinite(row.time)||row.time<time||row.time>s.simTime)return false;
  used.set(row.id,row);time=row.time;
 }
 const live=new Set();
 return s.buildings.every(b=>{
  const p=b.shapingProject;
  if(p===undefined)return true;
  if(!project(p)||Object.keys(p).length!==2||live.has(p.id)||b.construction?.kind==='new')return false;
  live.add(p.id);
  const row=used.get(p.id);
  return !row||row.type===b.type&&row.x===b.x&&row.y===b.y&&
   row.builders.length===p.builders.length&&row.builders.every((id,i)=>id===p.builders[i]);
 });
}
