import {loadModel} from './asset-loading.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {buildingKey,isOperational} from '../definitions.js';
import {flockAdults,flockSize} from '../textiles.js';
import {sheepfoldGateSide,sheepfoldLayout,sheepfoldWorldPoint} from '../sheepfold-layout.js';
import {DAY_SECONDS,lightingAt,seed} from '../city-life.js';
import {dairyHerd} from './dairy-herd.js';
import {GOAT_MODELS} from './goats.js';

const MODELS={
 pig:{files:['pasture-pig.glb'],strides:[.34],fallback:{file:'alluvial-pig.glb',stride:.33},height:.64,space:.22},
 goat:{files:[GOAT_MODELS.pasture.file],strides:[GOAT_MODELS.pasture.stride],fallback:{file:'test-goat-trellis.glb',stride:.40},height:.96,space:.22},
 bull:{files:['pasture-bull.glb'],strides:[.62],fallback:{file:'alluvial-bull.glb',stride:.69},height:1.43,space:.32,pen:'cowshed'},
 sheep:{files:['pasture-ram.glb'],strides:[.31],fallback:{file:'alluvial-ram.glb',stride:.38},height:.83,space:.21,pen:'sheepfold'},
};
const PACE=.105;
const MAX_HERD=7;

function zoneClear(state,zone,dry,clear){
 if(!dry(state,zone.x,zone.y,.4))return false;
 for(let i=0;i<12;i++){
  const angle=i*Math.PI/6;
  const edge={x:zone.x+Math.cos(angle)*zone.radius,y:zone.y+Math.sin(angle)*zone.radius};
  if(!dry(state,edge.x,edge.y,.4)||!clear(state,zone,edge))return false;
 }
 return true;
}

function findZone(state,occupied,herd,dry,clear){
 const home=state.buildings.find(b=>b.type==='cityGate')||state.buildings.find(b=>b.type==='house');
 if(!home)return null;
 const radius=herd.spec.space*3.6;
 for(let ring=0;ring<25;ring++)for(let i=0;i<16;i++){
  const angle=(i+herd.index*3)*Math.PI/8,distance=2.3+ring*.54;
  const x=home.x+distance*Math.cos(angle),y=home.y+distance*Math.sin(angle);
  if(occupied.some(p=>Math.hypot(x-p.x,y-p.y)<radius+(p.radius??.6)+.75))continue;
  const zone={x,y,radius};
  if(zoneClear(state,zone,dry,clear))return zone;
 }
 return null;
}

function randomPoint(herd,member){
 const attempt=member.attempt++;
 const angle=seed(herd.seed,member.index*149+attempt*11+herd.index*1729)*2*Math.PI;
 const radius=Math.sqrt(seed(herd.seed,member.index*173+attempt*7+herd.index*1949))*herd.zone.radius;
 return {x:herd.zone.x+Math.cos(angle)*radius,y:herd.zone.y+Math.sin(angle)*radius,yaw:angle};
}

function segmentDistance(point,from,to){
 const dx=to.x-from.x,dy=to.y-from.y;
 const along=Math.max(0,Math.min(1,((point.x-from.x)*dx+(point.y-from.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(point.x-from.x-dx*along,point.y-from.y-dy*along);
}

const closeToGroup=(herd,member,point)=>herd.members.some(other=>other!==member&&other.point&&
 Math.hypot(other.point.x-point.x,other.point.y-point.y)<herd.spec.space*2.9);

function clearOfGroup(herd,member,from,to){
 return herd.members.every(other=>other===member||!other.point||
  segmentDistance(other.point,from,to)>=herd.spec.space*.92);
}

function approach(state,from,to,clear){
 if(clear(state,from,to))return [from,to];
 if(Math.hypot(from.x-to.x,from.y-to.y)>14)return null;
 const center={x:(from.x+to.x)/2,y:(from.y+to.y)/2};
 for(const distance of [1,2,4,6])for(let i=0;i<8;i++){
  const angle=i*Math.PI/4;
  const via={x:center.x+Math.cos(angle)*distance,y:center.y+Math.sin(angle)*distance};
  if(clear(state,from,via)&&clear(state,via,to))return [from,via,to];
 }
 // Search backwards from the gate so each accepted step has a dry approach.
 const queue=[{...to,column:0,row:0,parent:null}],visited=new Set(['0,0']);
 for(let index=0;index<queue.length&&index<520;index++){
  const point=queue[index];
  if(Math.hypot(point.x-from.x,point.y-from.y)<1.7&&clear(state,from,point)){
   const route=[from];
   for(let next=point;next;next=next.parent)route.push(next);
   return route;
  }
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const column=point.column+dx,row=point.row+dy,key=`${column},${row}`;
   if(visited.has(key))continue;
   const next={x:to.x+column*.56,y:to.y+row*.56,column,row,parent:point};
   if(!clear(state,point,next))continue;
   visited.add(key);
   queue.push(next);
  }
 }
 return null;
}

function timedPath(points){
 let length=0;
 const segments=[];
 for(let i=1;i<points.length;i++){
  const from=points[i-1],to=points[i],distance=Math.hypot(to.x-from.x,to.y-from.y);
  if(distance<1e-6)continue;
  length+=distance;
  segments.push({from,to,length,distance,yaw:Math.atan2(to.x-from.x,to.y-from.y)});
 }
 return {segments,length};
}

function pathPoint(path,distance){
 const segment=path.segments.find(part=>distance<part.length)||path.segments.at(-1);
 const t=Math.max(0,Math.min(1,1-(segment.length-distance)/segment.distance));
 return {x:segment.from.x+(segment.to.x-segment.from.x)*t,y:segment.from.y+(segment.to.y-segment.from.y)*t,yaw:segment.yaw};
}

const penKey=building=>building.type+':'+buildingKey(building);

function penTargets(state,building,kind){
 if(kind==='bull')return dairyHerd(state).filter(animal=>animal.building===building).slice(0,MAX_HERD).map(animal=>({...animal.anchor,id:animal.id,young:animal.calf}));
 const {halfWidth,spacing}=sheepfoldLayout(building),side=sheepfoldGateSide(building,state);
 return Array.from({length:Math.min(MAX_HERD,flockSize(building))},(_,i)=>({
  ...sheepfoldWorldPoint(building,side,Math.min(halfWidth-.45,spacing)*(i%3-1),Math.min(halfWidth-.45,spacing)*(Math.floor(i/3)-1)),
  id:`sheep-${building.x}-${building.y}-${i}`,young:i>=flockAdults(building),
 }));
}

function penEntrance(state,building){
 const {halfWidth}=sheepfoldLayout(building);
 const side=building.type==='sheepfold'?sheepfoldGateSide(building,state):0;
 return {
  outside:sheepfoldWorldPoint(building,side,halfWidth+2.3,0),
  inside:sheepfoldWorldPoint(building,side,halfWidth-.65,0),
 };
}

export function createTestLivestock(B,scene,meshes,dry,clear,shared=new Map()){
 const herds=Object.entries(MODELS).map(([kind,spec],index)=>({kind,spec,index,members:[],handled:new Map()}));
 const assets=new Map(),claimed=new Set(),settledSheep=new Map();
 let disposed=false,ready=false,clock=0,buildings,count,world,pens=[];
 const loadAnimals=async()=>{
  async function loadFile(file){
   try{
    const source=shared.has(file)?await shared.get(file):
     await loadModel(B,scene,'assets/art-courtyard/models/',file,scene,undefined,'.glb');
    if(!source)return;
    if(disposed){if(!shared.has(file))source.dispose();}
    else assets.set(file,source);
   }catch(error){console.warn('Livestock model unavailable:',file,error);}
  }
  await Promise.all(herds.map(async({spec})=>{
   await Promise.all(spec.files.map(loadFile));
   if(!disposed&&spec.fallback&&!spec.files.some(file=>assets.has(file)))await loadFile(spec.fallback.file);
  }));
  ready=true;
 };
 void loadAnimals();

 function makeMember(herd,index){
  const {spec,kind}=herd;
  const preferred=index%spec.files.length;
  const variant=assets.has(spec.files[preferred])?preferred:spec.files.findIndex(file=>assets.has(file));
  const file=spec.files[variant]||spec.fallback?.file;
  if(!assets.has(file))return null;
  const source=assets.get(file);
  const name=`livestock-${kind}-${index}`;
  const root=new B.TransformNode(name,scene),display=new B.TransformNode(name+'-model',scene);
  const copy=source.instantiateModelsToScene(node=>name+'-'+node,false,{doNotInstantiate:true});
  for(const node of copy.rootNodes)node.parent=display;
  const {min,max}=display.getHierarchyBoundingVectors(true);
  const scale=spec.height*(.92+index%4*.04)/(max.y-min.y);
  display.scaling.setAll(scale);
  display.position.set(-(min.x+max.x)*scale/2,-min.y*scale,-(min.z+max.z)*scale/2);
  display.parent=root;
  root.metadata={herdAnimal:true,herdSpecies:kind,herdVariant:variant,herdModel:file};
  root.setEnabled(false);
  const owned=root.getChildMeshes();
  for(const mesh of owned){mesh.isPickable=false;mesh.receiveShadows=true;meshes.push(mesh);}
  const walk=copy.animationGroups.find(group=>/-Walk$/i.test(group.name))||copy.animationGroups.find(group=>/-Animation$/i.test(group.name));
  const idle=copy.animationGroups.find(group=>/Idle$/i.test(group.name));
  const baseStride=spec.strides[variant]??spec.fallback.stride;
  const stride=file===GOAT_MODELS.pasture.file?baseStride*scale:baseStride;
  const member={root,owned,copy,walk,idle,stride,phase:index*.31,point:null,index,attempt:0,waitUntil:0};
  const targets=walk?.targetedAnimations||[];
  member.restPositions=targets.filter(({target,animation})=>target.position&&animation.targetProperty==='position')
   .map(({target})=>({target,position:target.position.clone()}));
  member.rest=targets.filter(({target,animation})=>target.rotationQuaternion&&animation.targetProperty==='rotationQuaternion')
   .map(({target})=>({target,rotation:target.rotationQuaternion.clone()}));
  return member;
 }

 function pose(member,point,state,dt,walking){
  const {root}=member;
  const last=member.point;
  root.setEnabled(true);
  root.position.set(point.x*6,surfaceElevation(point.x,point.y,state),point.y*6);
  if(!last)root.rotation.y=point.yaw;
  else if(walking&&dt){
   const delta=point.yaw-root.rotation.y;
   root.rotation.y+=Math.atan2(Math.sin(delta),Math.cos(delta))*Math.min(1,dt*7);
   const distance=Math.hypot(point.x-last.x,point.y-last.y)*6;
   if(distance<1.5)member.phase+=distance/member.stride;
  }
  member.point=point;
  const clip=walking?member.walk:(member.idle||member.walk);
  if(!clip)return;
  const clipChanged=clip!==member.clip;
  if(clipChanged){
   member.clip?.stop();
   clip.start(true);
   clip.pause();
   member.clip=clip;
  }
  if(!dt&&last&&!clipChanged)return;
  const phase=clip===member.walk?member.phase:clock*.26+member.phase;
  clip.goToFrame(clip.from+(phase%1)*(clip.to-clip.from));
  if(!walking&&!member.idle){
   for(const {target,position} of member.restPositions)target.position.copyFrom(position);
   for(const {target,rotation} of member.rest)target.rotationQuaternion.copyFrom(rotation);
  }
 }

 function assign(herd,state){
  const candidates=pens.filter(b=>isOperational(b)&&b.type===herd.spec.pen&&herd.handled.get(penKey(b))!==(b.built?.order??0));
  const leader=herd.members[0].point;
  if(!leader)return null;
  const otherZones=herds.filter(other=>other!==herd&&other.zone).map(other=>other.zone);
  const clearApproach=(world,from,to)=>otherZones.every(zone=>
   segmentDistance(zone,from,to)>zone.radius+.18)&&clear(world,from,to);
  for(const building of candidates.sort((a,b)=>Math.hypot(a.x-leader.x,a.y-leader.y)-Math.hypot(b.x-leader.x,b.y-leader.y))){
   const targets=penTargets(state,building,herd.kind).slice(0,herd.size);
   if(!targets.length||targets.length>herd.members.length)continue;
   const {outside,inside}=penEntrance(state,building);
   const approaches=targets.map((_,i)=>{
    const start=herd.members[i].point;
    const external=start&&approach(state,start,outside,clearApproach);
    return external&&timedPath(external);
   });
   if(approaches.every(Boolean)){
    const gateTime=Math.max(...approaches.map(path=>path.length))/PACE;
    const paths=approaches.map((path,i)=>{
     const entry=timedPath([outside,inside,targets[i]]);
     return {
      length:path.length+entry.length,
      segments:[...path.segments,...entry.segments.map(segment=>({...segment,length:segment.length+path.length}))],
      delay:gateTime+i*herd.spec.space/PACE-path.length/PACE,
     };
    });
    return {building,targets,paths,start:clock};
   }
  }
  return null;
 }

 function roam(herd,member,state,elapsed){
  if(!member.point){
   for(let i=0;i<48;i++){
    const point=randomPoint(herd,member);
    if(!clearOfGroup(herd,member,point,point)||!clear(state,herd.zone,point))continue;
    if(herd.members.some(other=>other.point)&&!closeToGroup(herd,member,point))continue;
    pose(member,point,state,0,false);
    member.waitUntil=clock+seed(herd.seed,member.index+herd.index*19+503)*2.9;
    break;
   }
   return;
  }
  if(!elapsed)return;
  const from=member.point;
  if(!member.goal&&clock>=member.waitUntil){
   for(let i=0;i<16;i++){
    const goal=randomPoint(herd,member);
    const distance=Math.hypot(goal.x-from.x,goal.y-from.y);
    if(distance<herd.spec.space*.7||distance>herd.zone.radius*.85)continue;
    if(!clearOfGroup(herd,member,from,goal)||!clear(state,from,goal))continue;
    if(!closeToGroup(herd,member,goal))continue;
    const direction=Math.atan2(goal.x-from.x,goal.y-from.y)-member.root.rotation.y;
    if(i<12&&Math.cos(direction)<.15)continue;
    member.goal=goal;
    break;
   }
   if(!member.goal)member.waitUntil=clock+.55+seed(herd.seed,member.attempt)*1.1;
  }
  if(member.goal){
   const dx=member.goal.x-from.x,dy=member.goal.y-from.y;
   const distance=Math.hypot(dx,dy);
   const yaw=Math.atan2(dx,dy);
   const difference=yaw-member.root.rotation.y;
   const turn=Math.atan2(Math.sin(difference),Math.cos(difference));
   if(Math.abs(turn)>.37){
    member.root.rotation.y+=Math.sign(turn)*Math.min(Math.abs(turn),elapsed*1.8);
    pose(member,from,state,elapsed,false);
    return;
   }
   const pace=PACE*(.70+seed(herd.seed,member.index+herd.index*23+671)*.45);
   const step=Math.min(distance,pace*elapsed);
   const next={x:from.x+dx*step/distance,y:from.y+dy*step/distance,yaw};
   if(clearOfGroup(herd,member,from,next)&&closeToGroup(herd,member,next)){
    pose(member,next,state,elapsed,true);
    if(step<distance)return;
   }
   member.goal=null;
   member.waitUntil=clock+.8+seed(herd.seed,member.attempt+member.index*13)*3.1;
  }
  pose(member,member.point,state,elapsed,false);
 }

 function update(state,dt,paused,speed,otherHerd=[]){
  if(!ready||disposed)return;
  const elapsed=paused?0:Math.min(.1,Math.max(0,dt))*speed;
  clock+=elapsed;
  const changed=buildings!==state.buildings||count!==state.buildings.length||world!==state.world;
  if(changed){
   buildings=state.buildings;count=buildings.length;world=state.world;
   pens=buildings.filter(b=>b.type==='sheepfold'||b.type==='cowshed');
   for(const herd of herds){
    if(herd.transfer&&!pens.some(b=>penKey(b)===penKey(herd.transfer.building)))herd.transfer=null;
    for(const key of herd.handled.keys())if(!pens.some(b=>penKey(b)===key))herd.handled.delete(key);
    const worldSeed=state.world?.seed??0;
    if(herd.seed!==worldSeed){
     herd.seed=worldSeed;
     herd.size=4+Math.floor(seed(worldSeed,herd.index+51)*4);
     herd.zone=null;
    }
    if(!herd.zone||!zoneClear(state,herd.zone,dry,clear)){
     const occupied=[...otherHerd,...herds.filter(other=>other!==herd&&other.zone).map(other=>other.zone)];
     herd.zone=findZone(state,occupied,herd,dry,clear);
     for(const member of herd.members){member.point=null;member.goal=null;}
    }
    herd.nextSearch=clock;
   }
  }
  claimed.clear();
  for(const [id,point] of settledSheep)if(state.simTime>=point.release)settledSheep.delete(id);
  for(const herd of herds){
   if(!herd.zone&&!herd.transfer){for(const member of herd.members)member.root.setEnabled(false);continue;}
   if(!herd.members.length){
    for(let i=0;i<MAX_HERD;i++){
     const member=makeMember(herd,i);
     if(member)herd.members.push(member);
    }
   }
   if(!herd.members.length)continue;
   let transfer=herd.transfer;
   if(!paused&&!transfer&&herd.spec.pen&&clock>=herd.nextSearch){
    herd.nextSearch=clock+6;
    transfer=herd.transfer=assign(herd,state);
   }
   if(transfer){
    let arrived=true;
    for(let i=0;i<herd.members.length;i++){
     const member=herd.members[i],path=transfer.paths[i];
     if(!path){member.root.setEnabled(false);continue;}
     const distance=Math.max(0,(clock-transfer.start-path.delay)*PACE);
     arrived&&=distance>=path.length;
     claimed.add(transfer.targets[i].id);
     member.root.metadata.herdDestination=transfer.building.type;
     member.root.scaling.setAll(transfer.targets[i].young?.68:1);
     pose(member,pathPoint(path,distance),state,elapsed,distance>0&&distance<path.length);
    }
    if(arrived){
     herd.handled.set(penKey(transfer.building),transfer.building.built?.order??0);
     herd.transfer=null;
     herd.departedAt=clock;
     if(herd.kind==='sheep'){
      const hour=lightingAt(state.simTime).hour;
      const release=state.simTime+(24-hour)*DAY_SECONDS/24;
      for(const [i,target] of transfer.targets.entries()){
       settledSheep.set(target.id,{...target,yaw:pathPoint(transfer.paths[i],transfer.paths[i].length).yaw,release});
      }
     }
     for(const member of herd.members){member.root.setEnabled(false);member.point=null;member.goal=null;}
    }
    continue;
   }
   if(!herd.zone||clock-(herd.departedAt??-Infinity)<8)continue;
   for(const member of herd.members){
    if(member.index>=herd.size){member.root.setEnabled(false);continue;}
    delete member.root.metadata.herdDestination;
    member.root.scaling.setAll(1);
    roam(herd,member,state,elapsed);
   }

  }
 }
 function dispose(){
  disposed=true;
  for(const herd of herds)for(const member of herd.members){
   for(const mesh of member.owned){const index=meshes.indexOf(mesh);if(index>=0)meshes.splice(index,1);}
   for(const group of member.copy.animationGroups)group.dispose();
   member.root.dispose();
   for(const skeleton of member.copy.skeletons)skeleton.dispose();
  }
  for(const [file,asset] of assets)if(!shared.has(file))asset.dispose();
 }
 return {update,dispose,claims:id=>claimed.has(id),hasPigs:()=>herds[0].members.some(member=>member.root.isEnabled()),sheepPose:animal=>{
  const point=settledSheep.get(animal.id);
  return point?{...animal,x:point.x,y:point.y,yaw:point.yaw,walking:false,behavior:'resting'}:animal;
 }};
}
