import {carcassPosition,harvestApron} from './harvest-handling.js';
import {footprintSize} from './footprints.js';
import {sheepfoldGateSide,sheepfoldLayout,sheepfoldWorldPoint} from './sheepfold-layout.js';
import {motionRateFor,motionTimeFor} from './calendar.js';
import {ecologyCount} from './ecology.js';
import {flockSize,flockAdults} from './textiles.js';
import {pestActors} from './pests.js';
import {safeLoop,loopMotion} from './local-motion.js';
import {worldWidth,worldHeight,terrain,isShore,isDryPoint,riverPoint,riverLength,riverLocal} from './world.js';
import {DAY_SECONDS,lightingAt,seed} from './city-life.js';
import {navigationSegmentClear,obstacleIndex} from './navigation.js';
import {watchOnDuty,watchOnShift} from './watch-house.js';
import {floodFootprint,floodPhase,floodProtectionRevision} from './river-flood.js';
// These decorative actors already run on frame time; only a small pacing adjustment is needed.
export const ambientTravelRateFor=s=>motionRateFor(s)===1?1:.85;
const habitats=new WeakMap(),flockRoutes=new WeakMap();
const FLOCK_SPEED=.28,FLOCK_STOP=3.5,PASTURE_BEGIN=6.5,PASTURE_END=17.5;
const FLOCK_DURATION=(PASTURE_END-PASTURE_BEGIN)*DAY_SECONDS/24;
function timedFlockRoute(route,speed,delay,stop){
 const legs=[];
 let time=0;
 const add=(a,b,length,walking)=>{
  if(length<=1e-8)return;
  const dx=b.x-a.x,dy=b.y-a.y;
  legs.push({a,b,start:time,end:time+length,walking,yaw:Math.atan2(dx,dy),heading:dx-dy>=0?1:-1});
  time+=length;
 };
 add(route[0],route[0],delay,false);
 for(const [i,b] of route.slice(1).entries()){
  const a=route[i];
  add(a,b,Math.hypot(b.x-a.x,b.y-a.y)/speed,true);
  if(b.pause!==false)add(b,b,stop(b),false);
 }
 return {home:route[0],legs,duration:time};
}
function flockPosition(path,time){
 const leg=path.legs.find(leg=>time>=leg.start&&time<leg.end);
 if(!leg)return {...path.home,walking:false,heading:1};
 const {a,b,walking,heading,yaw}=leg;
 if(!walking)return {...b,walking:false,heading};
 const t=(time-leg.start)/(leg.end-leg.start);
 return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,walking:true,heading,yaw};
}
function flockMotion(plan,index,hour){
 return flockPosition(plan.paths[index],(hour-plan.start)*DAY_SECONDS/24);
}
function flockSpacing(paths){
 const changes=[...new Set(paths.flatMap(path=>path.legs.flatMap(({start,end})=>[start,end])))].sort((a,b)=>a-b);
 let previous=paths.map(path=>flockPosition(path,0));
 for(const time of changes){
  const next=paths.map(path=>flockPosition(path,time));
  for(let i=0;i<paths.length;i++)for(let j=i+1;j<paths.length;j++){
   const x=previous[i].x-previous[j].x,y=previous[i].y-previous[j].y;
   const dx=next[i].x-next[j].x-x,dy=next[i].y-next[j].y-y;
   const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/(dx*dx+dy*dy||1)));
   if(Math.hypot(x+dx*t,y+dy*t)<.19-1e-7)return false;
  }
  previous=next;
 }
 return true;
}
function habitatsFor(s){
 const worldSeed=s.world?.seed||73129;
 const signature=JSON.stringify([worldSeed,worldWidth(s),worldHeight(s),s.world?.river,s.buildings.map(b=>[b.type,b.x,b.y,b.footprint,b.rotation,b.construction?.kind]),s.world?.deposits,s.world?.lakes,Object.values(s.ecology?.populations||{}).map(p=>p.count)]);
 const cached=habitats.get(s);if(cached?.signature===signature)return cached.places;
 const places=[];
 const free=(x,y)=>isDryPoint(s,x,y)&&!['water','void'].includes(terrain(x,y,s))&&!s.buildings.some(b=>b.x===x&&b.y===y);
 const candidates=[];for(let y=1;y<worldHeight(s)-1;y++)for(let x=1;x<worldWidth(s)-1;x++)if(free(x,y))candidates.push({x,y});
 const wildlife=s.world?.deposits?.filter(d=>d.kind==='wildlife')||[],homes=s.buildings.filter(b=>b.type==='house');
 for(const [kind,count,predicate]of [['goat',7,p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<5)],['gazelle',12,p=>homes.every(h=>Math.hypot(h.x-p.x,h.y-p.y)>3.5)&&wildlife.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<4)],['bird',12,p=>isShore(s,p.x,p.y)],['jackal',4,p=>homes.every(h=>Math.hypot(h.x-p.x,h.y-p.y)>5)&&(p.x<5||p.x>worldWidth(s)-6||p.y<5||p.y>worldHeight(s)-6)]]){
  const choices=candidates.filter(predicate).sort((a,b)=>seed(a.x+worldSeed,a.y+(['cat','mouse'].includes(kind)?3:kind.length)*13)-seed(b.x+worldSeed,b.y+(['cat','mouse'].includes(kind)?3:kind.length)*13));
  if(kind==='jackal'){
   const count=ecologyCount(s,kind,s.ecology&&!s.ecology.legacyFauna?2:4);
   const obstacles=obstacleIndex(s.buildings);
   for(const center of choices){
    const route=safeLoop(s,center,1.2,true);
    if(route.length<3||route.some(p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<4)))continue;
    const packRoute=jackalPackRoute(s,center,homes,obstacles);
    const visibleCount=packRoute?Math.max(count,5):count;
    for(let i=0;i<visibleCount;i++){
     places.push({id:i<count?`jackal-${i}`:`jackal-pack-${i}`,kind,...center,route,packRoute,packIndex:i,decorative:i>=count});
    }
    break;
   }
   continue;
  }
  for(let i=0;i<Math.min(ecologyCount(s,kind,s.ecology&&!s.ecology.legacyFauna?2:count),choices.length);i++){const pick=choices.find(p=>!places.some(a=>a.kind===kind&&Math.hypot(a.x-p.x,a.y-p.y)<2.2))||choices[i];places.push({id:`${kind}-${i}`,kind,...pick,route:safeLoop(s,pick,kind==='bird'?.4:.7,true).map(p=>({...p,atWater:isShore(s,Math.round(p.x),Math.round(p.y))}))});}
 }
 planGoatHerd(s,places);
 if(s.ecology&&!s.ecology.legacyFauna)planGazelleGroup(s,places,wildlife,homes);
 habitats.set(s,{signature,places});return places;
}
function planGazelleGroup(s,places,wildlife,homes){
 const gazelles=places.filter(a=>a.kind==='gazelle');
 if(gazelles.length>=5||!gazelles.length)return;
 const obstacles=obstacleIndex(s.buildings),count=5-gazelles.length;
 const nearestHome=p=>Math.min(...homes.map(h=>Math.hypot(h.x-p.x,h.y-p.y)));
 const leads=gazelles.toSorted((a,b)=>nearestHome(a)-nearestHome(b));
 for(const lead of leads){
  const companions=[],angle=seed(lead.x,lead.y)*Math.PI*2;
  for(const radius of [1.45,1.78,2.1,2.5])for(let i=0;i<16&&companions.length<count;i++){
   const theta=angle+i*2.39996+radius*.51,p={x:lead.x+Math.cos(theta)*radius,y:lead.y+Math.sin(theta)*radius};
   if(companions.some(q=>Math.hypot(p.x-q.x,p.y-q.y)<1.02)||gazelles.some(q=>q.route.some(w=>Math.hypot(p.x-w.x,p.y-w.y)<.89)))continue;
   const route=[p,...[.4,2.25,4.36].map(a=>({x:p.x+Math.cos(theta+a)*.33,y:p.y+Math.sin(theta+a)*.33})),p];
   if(!route.every((q,j)=>nearestHome(q)>3.4&&wildlife.some(w=>Math.hypot(q.x-w.x,q.y-w.y)<4.55)&&
    navigationSegmentClear(s,route[Math.max(0,j-1)],q,obstacles)))continue;
   companions.push({...p,route});
  }
  if(companions.length<count)continue;
  for(const [i,p] of companions.entries())places.push({id:`gazelle-group-${i}`,kind:'gazelle',...p,herdIndex:i,decorative:true});
  return;
 }
}
function jackalPackRoute(s,center,homes,obstacles){
 const ring=[[-1.15,-.58],[-.58,-1.15],[.58,-1.15],[1.15,-.58],[1.15,.58],[.58,1.15],[-.58,1.15],[-1.15,.58],[-1.15,-.58]];
 for(const [dx,dy] of [[0,0],[1,0],[0,1],[-1,0],[0,-1]]){
  const route=ring.map(([x,y])=>({x:center.x+dx+x,y:center.y+dy+y}));
  if(route.every((p,i)=>terrain(Math.round(p.x),Math.round(p.y),s)!=='water'&&homes.every(h=>Math.hypot(h.x-p.x,h.y-p.y)>4)&&
   (!i||navigationSegmentClear(s,route[i-1],p,obstacles))))return route;
 }
 return null;
}
function planGoatHerd(s,places){
 const goats=places.filter(a=>a.kind==='goat');
 if(goats.length>=5||!goats.length)return;
 const occupied=new Set(s.buildings.flatMap(b=>Array.from({length:footprintSize(b)**2},(_,i)=>
  `${b.x+i%footprintSize(b)},${b.y+Math.floor(i/footprintSize(b))}`)));
 const free=(x,y)=>isDryPoint(s,x,y)&&terrain(Math.round(x),Math.round(y),s)!=='water'&&!occupied.has(`${Math.round(x)},${Math.round(y)}`);
 const count=6-goats.length,patchRadius=.27;
 for(const lead of goats){
  const rotation=seed(lead.x,lead.y)*Math.PI*2,patches=[];
  const accepts=p=>free(p.x,p.y)&&[0,1,2,3,4,5,6,7].every(i=>{
   const angle=i*Math.PI/4;
   return free(p.x+Math.cos(angle)*patchRadius,p.y+Math.sin(angle)*patchRadius);
  })&&goats.every(g=>g===lead||g.route.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>.77));
  if(!accepts(lead))continue;
  for(const radius of [.93,1.27,1.61,1.86])for(let i=0;i<16&&patches.length<count;i++){
   const angle=rotation+i*2.39996+radius*.44,p={x:lead.x+Math.cos(angle)*radius,y:lead.y+Math.sin(angle)*radius};
   if(patches.every(q=>Math.hypot(p.x-q.x,p.y-q.y)>.87)&&accepts(p))patches.push(p);
  }
  if(patches.length<count)continue;
  const grazingRoute=(p,index)=>{
   const angle=rotation+index*2.39996;
   const spot=(n,r,behavior)=>({x:p.x+Math.cos(angle+n)*r,y:p.y+Math.sin(angle+n)*r,behavior});
   return [{...p,behavior:'grazing'},spot(.35,.21,'looking'),spot(2.1,.22,'grazing'),spot(4.32,.25,index%3===1?'resting':'grazing'),{...p,behavior:'grazing'}];
  };
  lead.route=grazingRoute(lead,0);
  for(const [i,p] of patches.entries())places.push({id:`goat-herd-${i}`,kind:'goat',...p,route:grazingRoute(p,i+1),herdIndex:i,decorative:true});
  return;
 }
}
export function naturalAnimalsFor(s,{displayGroups=false}={}){
 const time=motionTimeFor(s),result=[];
 const sentries=watchOnShift('night',s.simTime||0)?(s.citizens||[]).filter(c=>c.guardPost&&watchOnDuty(s,c)):[];
 for(const {id,kind,route,packRoute,packIndex,herdIndex,decorative,...p} of habitatsFor(s)){
  if(decorative&&!displayGroups)continue;
  const phase=time+seed(p.x,p.y)*17+(herdIndex===undefined?0:.17+herdIndex*.095);
  if(packIndex!==undefined){
   const motion=loopMotion(displayGroups&&packRoute||route,phase-packIndex*1.25,.37,0);
   let retreat=null;
   for(const guard of sentries){
    const dx=motion.x-guard.x,dy=motion.y-guard.y,d=Math.hypot(dx,dy);
    if(d>=1.6||d<.001||retreat&&retreat.distance<d)continue;
    const scale=.48*((1.6-d)/1.6)**1.5/d,x=motion.x+dx*scale,y=motion.y+dy*scale;
    if(!isDryPoint(s,x,y)||s.buildings.some(b=>{
     const size=footprintSize(b);return x>b.x-.5&&x<b.x+size-.5&&y>b.y-.5&&y<b.y+size-.5;
    }))continue;
    retreat={x,y,faceX:x+dx,faceY:y+dy,distance:d};
   }
   const position=retreat?{x:retreat.x,y:retreat.y,faceX:retreat.faceX,faceY:retreat.faceY}:null;
   result.push({id,kind,...decorative?{decorative}:{},...motion,...position,behavior:retreat?'retreating':'walking',growth:1-(packIndex%5)*.049});
   continue;
  }
  let speed=kind==='bird'?.65:.32,pause=3.5;
  if(kind==='goat'){
   const index=herdIndex===undefined?Number(id.split('-').at(-1))%4:(herdIndex+2)%6;
   speed=[.16,.19,.13,.22,.105,.15][index];
   pause=[3.4,4.1,2.5,3.2,5.45,4.7][index];
  }
  if(kind==='gazelle'&&decorative){speed=.17+herdIndex*.023;pause=2.6+herdIndex*.63;}
  const motion=loopMotion(route,phase,speed,pause),idle=Math.floor(phase/2.8)%4;
  const behavior=motion.walking?'walking':motion.behavior|| (motion.atWater&&idle===0?'drinking':idle===1?'looking':idle===2?'resting':kind==='bird'?'perched':'grazing');
  result.push({id,kind,...decorative?{decorative,growth:.79+herdIndex*.055}:{},...motion,step:phase*5,behavior,headTurn:Math.sin(phase*.9)*.5});
 }
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
 if(displayGroups&&s.ecology&&!s.ecology.legacyFauna){
  const home=s.buildings.find(b=>b.type==='house')||{x:8,y:8};
  const town=Math.max(5,Math.min(length-6,riverLocal(home.x,home.y,s).along));
  for(const [school,offset] of [0,6,-6].entries()){
   const center=Math.max(2.1,Math.min(length-3.1,town+offset));
   for(let i=0;i<5+school;i++){
    const phase=time*(.164+school*.016)+school*2.42+i*.143;
    const riverAt=angle=>riverPoint(center+1.32*Math.sin(angle),s,((i%3)-1)*.16+.23*Math.cos(angle)+.035*Math.sin(angle+i));
    const point=riverAt(phase),ahead=riverAt(phase+.001);
    result.push({id:`fish:school:${school}:${i}`,kind:'fish',...point,yaw:Math.atan2(ahead.x-point.x,ahead.y-point.y),decorative:true,
     behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.16+(i%4)*.046});
   }
  }
 }
 let fishCount=0;for(const lake of (s.ecology&&!s.ecology.legacyFauna?[]:s.world?.lakes||[]))for(const cell of lake.cells)for(let i=0;i<2&&fishCount<80;i++,fishCount++){
  const phase=time*.5+seed(cell.x+i,cell.y)*23;
  result.push({id:`fish:${lake.id}:${cell.x},${cell.y}:${i}`,kind:'fish',x:cell.x+Math.sin(phase)*.24,y:cell.y+Math.cos(phase*.93)*.24,yaw:Math.atan2(Math.cos(phase),-.93*Math.sin(phase*.93)),behavior:'swimming',walking:true,waterLevel:-.18,swimDepth:.22});
 }
 return result;
}
function flockPlan(s,b,size){
 const rate=motionRateFor(s),walkingSpeed=FLOCK_SPEED*rate;
 const nearby=s.buildings.filter(site=>site!==b&&Math.hypot(site.x-b.x,site.y-b.y)<8);
 const flood=floodPhase(s)==='active'?s.riverFlood:null;
 const signature=JSON.stringify([size,rate,b.rotation,footprintSize(b),s.world?.river,s.world?.lakes,
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
 const gateX=halfWidth+(columns-1)/2*spacing+(rate<1?.32:.52);
 const outside=world(gateX,0);
 // Short days leave less time for a round trip. Bed the flock near the opening
 // and include the grazable strip outside it in the search.
 const bed=rate<1?world(halfWidth-(columns-1)/2*spacing-.26,0):origin;
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
 if(clearForFlock(bed,outside,false)){
  if(rate<1)for(const reach of [.015,.10,.22,.40,.65,1]){
   for(const side of [0,-reach,reach]){
    const p=world(gateX+reach*6,side*6);
    if(free(p)&&clearForFlock(outside,p))candidates.push(p);
   }
  }
  for(let dy=-6;dy<=6;dy++)for(let dx=-6;dx<=6;dx++){
   if(Math.hypot(dx,dy)<1.5||Math.hypot(dx,dy)>6)continue;
   const point={x:b.x+dx,y:b.y+dy};
   if(free(point)&&clearForFlock(outside,point))candidates.push(point);
  }
 }
 candidates.sort((a,z)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(z.x-origin.x,z.y-origin.y));
 const pen={...bed,flockStage:'pen',pause:false},gate={...outside,pause:false};
 const duration=route=>route.slice(1).reduce((seconds,to,i)=>{
  const from=route[i];
  return seconds+Math.hypot(to.x-from.x,to.y-from.y)/walkingSpeed+(to.pause===false?0:FLOCK_STOP);
 },0);
 const fertile=p=>terrain(Math.round(p.x),Math.round(p.y),s)==='fertile'&&slots.every(slot=>{
  const q=shift(p,slot);
  return terrain(Math.round(q.x),Math.round(q.y),s)==='fertile';
 });
 const reachable=p=>duration([pen,gate,p,gate,pen])<=FLOCK_DURATION;
 const field=candidates.find(p=>fertile(p)&&reachable(p));
 // If the pasture is too far for the available daylight, let the sheep
 // exercise at the gate and return without pretending to graze on sand.
 const outing=field||(rate<1&&candidates.some(fertile)&&candidates.find(reachable));
 const pasture=outing&&{...outing,flockStage:field?'pasture':'gate'};
 const watering=field&&candidates.find(p=>isShore(s,Math.round(p.x),Math.round(p.y))&&Math.hypot(p.x-field.x,p.y-field.y)>.6&&
  clearForFlock(field,p)&&duration([pen,gate,pasture,p,field,gate,pen])<=FLOCK_DURATION);
 const route=outing?[pen,gate,pasture,...(watering?[{...watering,flockStage:'water'},{...field,pause:false}]:[]),gate,pen]:[pen];
 const natural=slots.map((_,i)=>{
  const angle=seed(b.x+i*29,b.y+53)*Math.PI*2;
  return {dx:Math.cos(angle),dy:Math.sin(angle),pace:seed(b.x+i*7,b.y+23),delay:seed(b.x+i*19,b.y+17)};
 });
 const buildPaths=variation=>slots.map((slot,i)=>{
  const base=route.map(p=>shift(p,slot)),individual=natural[i];
  const points=base.map((p,j)=>{
   if(!variation||j<2||j>=base.length-2)return p;
   const spread=1+variation*.47,reach=p.flockStage==='water'?.10:.23;
   const q={...p,x:p.x+variation*individual.dx*reach+slot.x*(spread-1),y:p.y+variation*individual.dy*reach+slot.y*(spread-1)};
   const dry=p.flockStage!=='pasture'||terrain(Math.round(q.x),Math.round(q.y),s)==='fertile';
   return dry&&clear(base[j-1],q,true)&&clear(q,base[j+1],true)?q:p;
  });
  if(points.some((p,j)=>j>1&&j<points.length-1&&!clear(points[j-1],p,true)))return null;
  const speed=walkingSpeed*(1+variation*(.035+individual.pace*.105));
  return timedFlockRoute(points,speed,variation*(.25+individual.delay*.73),p=>FLOCK_STOP+variation*(individual.delay-.47)*(p.flockStage==='water'?1.1:2));
 });
 let paths;
 if(outing)for(const variation of [1,.77,.55,.34,.17]){
  const candidate=buildPaths(variation);
  if(candidate.every(p=>p&&p.duration<=FLOCK_DURATION)&&flockSpacing(candidate)){paths=candidate;break;}
 }
 paths??=buildPaths(0);
 const length=Math.max(...paths.map(p=>p.duration));
 const start=PASTURE_BEGIN+seed(b.x,b.y)*Math.min(1,(FLOCK_DURATION-length)*24/DAY_SECONDS);
 const yaws=slots.map((_,index)=>seed(b.x+index*31,b.y+79)*Math.PI*2);
 const plan={signature,paths,yaws,start,duration:length};flockRoutes.set(b,plan);return plan;
}

export function flockLeader(s,b){
 if(!b||b.type!=='sheepfold'||b.construction?.kind==='new'||!flockSize(b))return null;
 const plan=flockPlan(s,b,flockSize(b)),hour=lightingAt(s.simTime||0).hour;
 if(hour<plan.start||hour>=plan.start+plan.duration*24/DAY_SECONDS)return null;
 return flockMotion(plan,0,hour-1.1*24/DAY_SECONDS);
}

export function animalsFor(s){
 const time=s.simTime||0,result=[],kills=s.gathering?.kills||[],jobs=s.gathering?.jobs||[];
 for(const actor of naturalAnimalsFor(s,{displayGroups:true})){
  const kill=kills.find(k=>k.id===actor.id&&(k.hauler!==undefined||time<k.respawnAt));
  if(kill?.taken){
   const carrier=kill.hauler===undefined?null:s.citizens.find(c=>c.id===kill.hauler&&(c.phase==='toWorkshop'||c.phase==='blocked')&&c.cargo?.hides);
   if(carrier){
    let p=carcassPosition(carrier,kill),height=0;
    if(carrier.phase==='toWorkshop'&&carrier.routeIndex>=carrier.route.length){
     const b=s.buildings.find(b=>b.x+','+b.y===carrier.work);
     if(b){const mid=(footprintSize(b)-1)/2,apron=harvestApron(b.x+mid,b.y+mid,carrier,carrier.id);p={...apron.middle,yaw:Math.atan2(apron.dy,-apron.dx)};height=.79;}
    }
    result.push({...actor,...p,behavior:'dead',dead:true,walking:false,deathProgress:1,hauler:carrier.id,carcassHeight:height});
   }
   continue;
  }
  if(kill){if(time-kill.time<8||jobs.some(j=>j.stage==='retrieve'&&j.target.id===kill.id))result.push({...actor,x:kill.x,y:kill.y,behavior:'dead',dead:true,walking:false,deathProgress:Math.min(1,Math.max(0,(time-kill.time)*motionRateFor(s)/.5))});continue;}
  const hunt=jobs.find(j=>j.kind==='hunting'&&j.stage!=='return'&&j.target?.id===actor.id);
  result.push(hunt?{...actor,x:hunt.target.x,y:hunt.target.y,behavior:'looking',walking:false}:actor);
 }
 const hour=lightingAt(time).hour,bodyTime=motionTimeFor(s);
 for(const b of s.buildings){if(b.type!=='sheepfold'||b.construction?.kind==='new')continue;
  const size=flockSize(b),plan=flockPlan(s,b,size);
  for(let i=0;i<size;i++){
   const phase=bodyTime+seed(b.x,b.y)*8-i*.39;
   const motion=flockMotion(plan,i,hour);
   const behavior=motion.walking?'walking':motion.flockStage==='water'?'drinking':motion.flockStage==='pasture'?'grazing':motion.flockStage==='gate'?'looking':'resting';
   result.push({id:`sheep-${b.x}-${b.y}-${i}`,kind:'sheep',young:i>=flockAdults(b),...motion,step:phase*5,behavior,yaw:motion.walking?motion.yaw:plan.yaws[i]+Math.sin(phase*.24)*.24,headTurn:Math.sin(phase*.8)*.5});
  }
 }
 return [...result,...pestActors(s)];
}
