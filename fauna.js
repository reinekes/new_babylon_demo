import {insideFootprint,footprintSize} from './footprints.js';
import {ecologyCount} from './ecology.js';
import {flockSize,flockAdults} from './textiles.js';
import {pestActors} from './pests.js';
import {safeLoop,loopMotion} from './local-motion.js';
import {worldWidth,worldHeight,terrain,isShore,isDryPoint,riverPoint,riverLength} from './world.js';
import {seed} from './city-life.js';
const habitats=new WeakMap(),flockRoutes=new WeakMap();
function habitatsFor(s){
 const worldSeed=s.world?.seed||73129;
 const signature=JSON.stringify([worldSeed,worldWidth(s),worldHeight(s),s.world?.river,s.buildings.map(b=>[b.type,b.x,b.y]),s.world?.deposits,s.world?.lakes,s.ecology?.populations]);
 const cached=habitats.get(s);if(cached?.signature===signature)return cached.places;
 const places=[];
 const free=(x,y)=>isDryPoint(s,x,y)&&!['water','void'].includes(terrain(x,y,s))&&!s.buildings.some(b=>b.x===x&&b.y===y);
 const candidates=[];for(let y=1;y<worldHeight(s)-1;y++)for(let x=1;x<worldWidth(s)-1;x++)if(free(x,y))candidates.push({x,y});
 const wildlife=s.world?.deposits?.filter(d=>d.kind==='wildlife')||[],homes=s.buildings.filter(b=>b.type==='house');
 for(const [kind,count,predicate]of [['goat',7,p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<5)],['gazelle',12,p=>homes.every(h=>Math.hypot(h.x-p.x,h.y-p.y)>3.5)&&wildlife.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<4)],['bird',12,p=>isShore(s,p.x,p.y)],['jackal',4,p=>homes.every(h=>Math.hypot(h.x-p.x,h.y-p.y)>5)&&(p.x<5||p.x>worldWidth(s)-6||p.y<5||p.y>worldHeight(s)-6)]]){
  const choices=candidates.filter(predicate).sort((a,b)=>seed(a.x+worldSeed,a.y+(['cat','mouse'].includes(kind)?3:kind.length)*13)-seed(b.x+worldSeed,b.y+(['cat','mouse'].includes(kind)?3:kind.length)*13));
  if(kind==='jackal'){
   const count=ecologyCount(s,kind,s.ecology&&!s.ecology.legacyFauna?2:4);
   for(const center of choices){
    const route=safeLoop(s,center,1.2,true);
    if(route.length<3||route.some(p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<4)))continue;
    for(let i=0;i<count;i++)places.push({id:`jackal-${i}`,kind,...center,route,packIndex:i});
    break;
   }
   continue;
  }
  for(let i=0;i<Math.min(ecologyCount(s,kind,s.ecology&&!s.ecology.legacyFauna?2:count),choices.length);i++){const pick=choices.find(p=>!places.some(a=>a.kind===kind&&Math.hypot(a.x-p.x,a.y-p.y)<2.2))||choices[i];places.push({id:`${kind}-${i}`,kind,...pick,route:safeLoop(s,pick,kind==='bird'?.4:.7,true).map(p=>({...p,atWater:isShore(s,Math.round(p.x),Math.round(p.y))}))});}
 }
 habitats.set(s,{signature,places});return places;
}
export function naturalAnimalsFor(s){
 const time=s.simTime||0,result=[];
 for(const {id,kind,route,packIndex,...p} of habitatsFor(s)){const phase=time+seed(p.x,p.y)*17;
  if(packIndex!==undefined){
   const motion=loopMotion(route,phase-packIndex*1.25,.37,0);
   result.push({id,kind,...motion,behavior:'walking',growth:1-(packIndex%4)*.055});
   continue;
  }
  const motion=loopMotion(route,phase,kind==='bird'?.65:.32,kind==='jackal'?2:3.5);const idle=Math.floor(phase/2.8)%4,behavior=motion.walking?'walking':motion.atWater&&idle===0?'drinking':idle===1?'looking':idle===2?'resting':kind==='bird'?'perched':'grazing';result.push({id,kind,...motion,step:phase*5,behavior,headTurn:Math.sin(phase*.9)*.5});}
 // River coordinates follow the actual continuous river instead of cutting across bends.
 for(let i=0;i<ecologyCount(s,'fish',36);i++){
  const phase=time*.075+i*2.399963,along=(riverLength(s)-1)/2+Math.sin(phase)*(riverLength(s)-2)/2;
  result.push({id:`fish:river:${i}`,kind:'fish',...riverPoint(along,s,Math.sin(phase*2.1+i)*.24),behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 let fishCount=0;for(const lake of (s.ecology&&!s.ecology.legacyFauna?[]:s.world?.lakes||[]))for(const cell of lake.cells)for(let i=0;i<2&&fishCount<80;i++,fishCount++){
  const phase=time*.5+seed(cell.x+i,cell.y)*23;
  result.push({id:`fish:${lake.id}:${cell.x},${cell.y}:${i}`,kind:'fish',x:cell.x+Math.sin(phase)*.24,y:cell.y+Math.cos(phase*.93)*.24,behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 return result;
}
function flockPlan(s,b,size){
 const nearby=s.buildings.filter(site=>site!==b&&Math.hypot(site.x-b.x,site.y-b.y)<8);
 const signature=JSON.stringify([size,b.rotation,footprintSize(b),s.world?.river,s.world?.lakes,nearby.map(site=>[site.x,site.y,footprintSize(site)])]);
 const cached=flockRoutes.get(b);
 if(cached?.signature===signature)return cached;
 const n=footprintSize(b),center={x:b.x+(n-1)/2,y:b.y+(n-1)/2};
 const free=p=>isDryPoint(s,p.x,p.y)&&!nearby.some(site=>insideFootprint(site,p.x,p.y));
 const clear=(a,z)=>{
  const steps=Math.ceil(Math.hypot(z.x-a.x,z.y-a.y)*12);
  for(let i=0;i<=steps;i++){
   const f=steps?i/steps:0;
   if(!free({x:a.x+(z.x-a.x)*f,y:a.y+(z.y-a.y)*f}))return false;
  }
  return true;
 };
 const candidates=[];
 for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
  if(Math.hypot(dx,dy)<1.5||Math.hypot(dx,dy)>6)continue;
  const point={x:b.x+dx,y:b.y+dy};
  if(free(point)&&clear(center,point))candidates.push(point);
 }
 candidates.sort((a,z)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(z.x-center.x,z.y-center.y));
 const grass=candidates.find(p=>terrain(p.x,p.y,s)==='fertile')||candidates[0];
 const shore=grass&&candidates.find(p=>isShore(s,p.x,p.y)&&Math.hypot(p.x-grass.x,p.y-grass.y)>.6&&clear(grass,p));
 const positions=Array.from({length:size},(_,i)=>{
  const dx=(i%4-1.5)*.16,dy=(Math.floor(i/4)-.5)*.16;
  const shift=p=>({x:p.x+dx,y:p.y+dy,flockStage:p.flockStage});
  const start=shift({...center,flockStage:'pen'});
  const pen=free(start)?start:{...center,flockStage:'pen'};
  if(!grass)return [pen];
  const pasture=shift({...grass,flockStage:'pasture'});
  if(!clear(pen,pasture))return [pen];
  const water=shore&&shift({...shore,flockStage:'water'});
  return water&&clear(pasture,water)&&clear(water,pen)?[pen,pasture,water,pen]:[pen,pasture,pen];
 });
 const plan={signature,positions};flockRoutes.set(b,plan);return plan;
}

export function flockLeader(s,b){
 if(!b||b.type!=='sheepfold'||b.construction?.kind==='new'||!flockSize(b))return null;
 const route=flockPlan(s,b,flockSize(b)).positions[0];
 if(route.length<2)return null;
 return loopMotion(route,(s.simTime||0)+seed(b.x,b.y)*8-1.1,.22,3.8);
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
  const size=flockSize(b),plan=flockPlan(s,b,size);
  for(let i=0;i<size;i++){
   const phase=time+seed(b.x,b.y)*8-i*.18;
   const motion=loopMotion(plan.positions[i],phase,.22,3.8);
   const behavior=motion.walking?'walking':motion.flockStage==='water'?'drinking':motion.flockStage==='pasture'?'grazing':'resting';
   result.push({id:`sheep-${b.x}-${b.y}-${i}`,kind:'sheep',young:i>=flockAdults(b),...motion,step:phase*5,behavior,headTurn:Math.sin(phase*.8)*.5});
  }
 }
 return [...result,...pestActors(s)];
}
