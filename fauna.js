import {footprintSize} from './footprints.js';
import {sheepfoldGateSide,sheepfoldLayout,sheepfoldWorldPoint} from './sheepfold-layout.js';
import {ecologyCount} from './ecology.js';
import {flockSize,flockAdults} from './textiles.js';
import {pestActors} from './pests.js';
import {safeLoop,loopMotion} from './local-motion.js';
import {worldWidth,worldHeight,terrain,isShore,isDryPoint,riverPoint,riverLength} from './world.js';
import {DAY_SECONDS,lightingAt,seed} from './city-life.js';
import {floodFootprint,floodPhase,floodProtectionRevision} from './river-flood.js';
const habitats=new WeakMap(),flockRoutes=new WeakMap();
const FLOCK_SPEED=.28,FLOCK_STOP=3.5,PASTURE_BEGIN=6.5,PASTURE_END=17.5;
const FLOCK_DURATION=(PASTURE_END-PASTURE_BEGIN)*DAY_SECONDS/24;
function flockMotion(plan,index,hour){
 const route=plan.positions[index],time=(hour-plan.start)*DAY_SECONDS/24;
 if(time<0||time>=plan.duration||route.length<2)return {...route[0],walking:false,heading:1};
 return loopMotion(route,time,FLOCK_SPEED,FLOCK_STOP);
}
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
 const riverFish=ecologyCount(s,'fish',36),length=riverLength(s),reach=Math.min(1.45,(length-2)/2);
 for(let i=0;i<riverFish;i++){
  const phase=time*.13+i*2.399963;
  const center=1+reach+(length-2-2*reach)*(i+.5)/riverFish;
  const riverAt=angle=>riverPoint(center+Math.sin(angle)*reach,s,Math.cos(angle)*.24);
  const point=riverAt(phase),ahead=riverAt(phase+.001);
  result.push({id:`fish:river:${i}`,kind:'fish',...point,yaw:Math.atan2(ahead.x-point.x,ahead.y-point.y),
   behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 let fishCount=0;for(const lake of (s.ecology&&!s.ecology.legacyFauna?[]:s.world?.lakes||[]))for(const cell of lake.cells)for(let i=0;i<2&&fishCount<80;i++,fishCount++){
  const phase=time*.5+seed(cell.x+i,cell.y)*23;
  result.push({id:`fish:${lake.id}:${cell.x},${cell.y}:${i}`,kind:'fish',x:cell.x+Math.sin(phase)*.24,y:cell.y+Math.cos(phase*.93)*.24,yaw:Math.atan2(Math.cos(phase),-.93*Math.sin(phase*.93)),behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 return result;
}
function flockPlan(s,b,size){
 const nearby=s.buildings.filter(site=>site!==b&&Math.hypot(site.x-b.x,site.y-b.y)<8);
 const flood=floodPhase(s)==='active'?s.riverFlood:null;
 const signature=JSON.stringify([size,b.rotation,footprintSize(b),s.world?.river,s.world?.lakes,
  flood&&[flood.along,flood.bank,floodProtectionRevision(s)],nearby.map(site=>[site.x,site.y,footprintSize(site)])]);
 const cached=flockRoutes.get(b);
 if(cached?.signature===signature)return cached;
 const {center,halfWidth,gateHalfWidth,spacing}=sheepfoldLayout(b);
 const side=sheepfoldGateSide(b,s),angle=((b.rotation||0)+side)*Math.PI/2,c=Math.cos(angle),sin=Math.sin(angle);
 const world=(x,z)=>sheepfoldWorldPoint(b,side,x,z);
 const origin=world(0,0);
 const large=center!==0,columns=Math.min(3,Math.ceil(Math.sqrt(size))),rows=Math.ceil(size/columns);
 const slots=Array.from({length:size},(_,i)=>{
  const x=(i%columns-(columns-1)/2)*spacing;
  const z=(Math.floor(i/columns)-(rows-1)/2)*Math.min(gateHalfWidth-.32,large?2.04:1.24);
  return {x:(x*c+z*sin)/6,y:(-x*sin+z*c)/6};
 });
 const outside=world(halfWidth+(columns-1)/2*spacing+.52,0);
 const inPen=p=>Math.max(Math.abs(p.x-origin.x),Math.abs(p.y-origin.y))<(halfWidth+.24)/6;
 const flooded=flood?floodFootprint(s,flood):null;
 const free=p=>isDryPoint(s,p.x,p.y)&&!flooded?.has(`${Math.round(p.x)},${Math.round(p.y)}`)&&!nearby.some(site=>
  p.x>site.x-.54&&p.x<site.x+footprintSize(site)-.46&&
  p.y>site.y-.54&&p.y<site.y+footprintSize(site)-.46);

 const clear=(a,z,awayFromFence)=>{
  const steps=Math.ceil(Math.hypot(z.x-a.x,z.y-a.y)*12);
  for(let i=0;i<=steps;i++){
   const f=steps?i/steps:0;
   const point={x:a.x+(z.x-a.x)*f,y:a.y+(z.y-a.y)*f};
   if(!free(point)||awayFromFence&&inPen(point))return false;
  }
  return true;
 };
 const shift=(point,slot)=>({x:point.x+slot.x,y:point.y+slot.y,flockStage:point.flockStage,pause:point.pause});
 const clearForFlock=(from,to,awayFromFence=true)=>slots.every(slot=>clear(shift(from,slot),shift(to,slot),awayFromFence));
 const candidates=[];
 if(clearForFlock(origin,outside,false)){
  for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
   if(Math.hypot(dx,dy)<1.5||Math.hypot(dx,dy)>6)continue;
   const point={x:b.x+dx,y:b.y+dy};
   if(free(point)&&clearForFlock(outside,point))candidates.push(point);
  }
 }
 candidates.sort((a,z)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(z.x-origin.x,z.y-origin.y));
 const pen={...origin,flockStage:'pen',pause:false},gate={...outside,pause:false};
 const duration=route=>route.slice(1).reduce((seconds,to,i)=>{
  const from=route[i];
  return seconds+Math.hypot(to.x-from.x,to.y-from.y)/FLOCK_SPEED+(to.pause===false?0:FLOCK_STOP);
 },0);
 const field=candidates.find(p=>terrain(p.x,p.y,s)==='fertile'&&slots.every(slot=>{
  const q=shift(p,slot);
  return terrain(Math.round(q.x),Math.round(q.y),s)==='fertile';
 })&&duration([pen,gate,p,gate,pen])<=FLOCK_DURATION);
 const pasture=field&&{...field,flockStage:'pasture'};
 const watering=field&&candidates.find(p=>isShore(s,p.x,p.y)&&Math.hypot(p.x-field.x,p.y-field.y)>.6&&
  clearForFlock(field,p)&&duration([pen,gate,pasture,p,field,gate,pen])<=FLOCK_DURATION);
 const route=field?[pen,gate,pasture,...(watering?[{...watering,flockStage:'water'},{...field,pause:false}]:[]),gate,pen]:[pen];
 const length=duration(route);
 const positions=slots.map(slot=>route.map(p=>shift(p,slot)));
 const start=PASTURE_BEGIN+seed(b.x,b.y)*Math.min(1,(FLOCK_DURATION-length)*24/DAY_SECONDS);
 const yaws=slots.map((_,index)=>seed(b.x+index*31,b.y+79)*Math.PI*2);
 const plan={signature,positions,yaws,start,duration:length};flockRoutes.set(b,plan);return plan;
}

export function flockLeader(s,b){
 if(!b||b.type!=='sheepfold'||b.construction?.kind==='new'||!flockSize(b))return null;
 const plan=flockPlan(s,b,flockSize(b)),hour=lightingAt(s.simTime||0).hour;
 if(hour<plan.start||hour>=plan.start+plan.duration*24/DAY_SECONDS)return null;
 return flockMotion(plan,0,hour-1.1*24/DAY_SECONDS);
}

export function animalsFor(s){
 const time=s.simTime||0,result=[],kills=s.gathering?.kills||[],jobs=s.gathering?.jobs||[];
 for(const actor of naturalAnimalsFor(s)){
  const kill=kills.find(k=>k.id===actor.id&&time<k.respawnAt);
  if(kill){if(time-kill.time<8)result.push({...actor,x:kill.x,y:kill.y,behavior:'dead',dead:true,walking:false,deathProgress:Math.min(1,Math.max(0,(time-kill.time)/.5))});continue;}
  const hunt=jobs.find(j=>j.kind==='hunting'&&j.stage!=='return'&&j.target?.id===actor.id);
  result.push(hunt?{...actor,x:hunt.target.x,y:hunt.target.y,behavior:'looking',walking:false}:actor);
 }
 const hour=lightingAt(time).hour;
 for(const b of s.buildings){if(b.type!=='sheepfold'||b.construction?.kind==='new')continue;
  const size=flockSize(b),plan=flockPlan(s,b,size);
  for(let i=0;i<size;i++){
   const phase=time+seed(b.x,b.y)*8-i*.39;
   const motion=flockMotion(plan,i,hour);
   const behavior=motion.walking?'walking':motion.flockStage==='water'?'drinking':motion.flockStage==='pasture'?'grazing':'resting';
   result.push({id:`sheep-${b.x}-${b.y}-${i}`,kind:'sheep',young:i>=flockAdults(b),...motion,step:phase*5,behavior,yaw:!motion.walking?plan.yaws[i]+Math.sin(phase*.24)*.24:undefined,headTurn:Math.sin(phase*.8)*.5});
  }
 }
 return [...result,...pestActors(s)];
}
