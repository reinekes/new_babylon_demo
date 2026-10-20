import {flockSize} from './textiles.js';
import {pestActors} from './pests.js';
import {safeLoop,loopMotion} from './local-motion.js';
import {WIDTH,HEIGHT,terrain,isShore,isDryPoint,river} from './world.js';
import {seed} from './city-life.js';
const habitats=new WeakMap(),flockRoutes=new WeakMap();
function habitatsFor(s){
 const worldSeed=s.world?.seed||73129;
 const signature=JSON.stringify([worldSeed,s.buildings.map(b=>[b.type,b.x,b.y]),s.world?.deposits,s.world?.lakes]);
 const cached=habitats.get(s);if(cached?.signature===signature)return cached.places;
 const places=[];
 const free=(x,y)=>isDryPoint(s,x,y)&&!['water','void'].includes(terrain(x,y,s))&&!s.buildings.some(b=>b.x===x&&b.y===y);
 const candidates=[];for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)if(free(x,y))candidates.push({x,y});
 const wildlife=s.world?.deposits?.filter(d=>d.kind==='wildlife')||[],homes=s.buildings.filter(b=>b.type==='house');
 for(const [kind,count,predicate]of [['goat',7,p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<5)],['gazelle',12,p=>wildlife.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<4)],['bird',12,p=>isShore(s,p.x,p.y)],['jackal',4,p=>p.x<3||p.x>WIDTH-4]]){
  const choices=candidates.filter(predicate).sort((a,b)=>seed(a.x+worldSeed,a.y+(['cat','mouse'].includes(kind)?3:kind.length)*13)-seed(b.x+worldSeed,b.y+(['cat','mouse'].includes(kind)?3:kind.length)*13));
  for(let i=0;i<Math.min(count,choices.length);i++)places.push({id:`${kind}-${i}`,kind,...choices[i],route:safeLoop(s,choices[i],kind==='bird'?.4:.7,true).map(p=>({...p,atWater:isShore(s,Math.round(p.x),Math.round(p.y))}))});
 }
 habitats.set(s,{signature,places});return places;
}
export function naturalAnimalsFor(s){
 const time=s.simTime||0,result=[];
 for(const {id,kind,route,...p} of habitatsFor(s)){const phase=time+seed(p.x,p.y)*17;
  const motion=loopMotion(route,phase,kind==='bird'?.65:.32,kind==='jackal'?2:3.5);const idle=Math.floor(phase/2.8)%4,behavior=motion.walking?'walking':motion.atWater&&idle===0?'drinking':idle===1?'looking':idle===2?'resting':kind==='bird'?'perched':'grazing';result.push({id,kind,...motion,step:phase*5,behavior,headTurn:Math.sin(phase*.9)*.5});}
 // River coordinates follow the actual continuous river instead of cutting across bends.
 for(let i=0;i<36;i++){
  const phase=time*.075+i*2.399963,cy=(HEIGHT-1)/2+Math.sin(phase)*(HEIGHT-2)/2;
  result.push({id:`fish:river:${i}`,kind:'fish',x:river(cy)+Math.sin(phase*2.1+i)*.24,y:cy,behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 let fishCount=0;for(const lake of s.world?.lakes||[])for(const cell of lake.cells)for(let i=0;i<2&&fishCount<80;i++,fishCount++){
  const phase=time*.5+seed(cell.x+i,cell.y)*23;
  result.push({id:`fish:${lake.id}:${cell.x},${cell.y}:${i}`,kind:'fish',x:cell.x+Math.sin(phase)*.24,y:cell.y+Math.cos(phase*.93)*.24,behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 return result;
}
export function animalsFor(s){
 const time=s.simTime||0,result=[],kills=s.gathering?.kills||[],jobs=s.gathering?.jobs||[];
 for(const actor of naturalAnimalsFor(s)){
  const kill=kills.find(k=>k.id===actor.id&&time<k.respawnAt);
  if(kill){if(time-kill.time<8)result.push({...actor,x:kill.x,y:kill.y,behavior:'dead',dead:true,walking:false,deathProgress:Math.min(1,Math.max(0,(time-kill.time)/.5))});continue;}
  const hunt=jobs.find(j=>j.kind==='hunting'&&j.stage!=='return'&&j.target?.id===actor.id);
  result.push(hunt?{...actor,x:hunt.target.x,y:hunt.target.y,behavior:'looking',walking:false}:actor);
 }
 for(const b of s.buildings){if(b.type!=='sheepfold'||b.construction?.kind==='new')continue;
  const size=flockSize(b);let cached=flockRoutes.get(b);if(cached?.size!==size){cached={size,routes:Array.from({length:size},(_,i)=>{const cx=b.x-.24+(i%4)*.16,cy=b.y+.02+Math.floor(i/4)*.22;const route=[{x:cx-.035,y:cy-.035},{x:cx+.035,y:cy-.035},{x:cx+.035,y:cy+.035},{x:cx-.035,y:cy+.035},{x:cx-.035,y:cy-.035}];return route.every(p=>isDryPoint(s,p.x,p.y))?route:[{x:b.x,y:b.y}];})};flockRoutes.set(b,cached);}
  for(let i=0;i<size;i++){const phase=time+seed(b.x+i,b.y)*23,motion=loopMotion(cached.routes[i],phase,.035,2+i%3);result.push({id:`sheep-${b.x}-${b.y}-${i}`,kind:'sheep',...motion,step:phase*5,behavior:motion.walking?'walking':Math.floor(phase/3)%4===0?'resting':Math.floor(phase/3)%4===1?'looking':'grazing',headTurn:Math.sin(phase*.8)*.5});}
 }
 return [...result,...pestActors(s)];
}
