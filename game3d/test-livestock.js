import {groundHeading,groundStep} from './ground-turn.js';
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
 bull:{files:['pasture-bull.glb','pasture-cow.glb'],strides:[.62,.56],fallback:{file:'alluvial-bull.glb',stride:.69},height:1.43,space:.32,pen:'cowshed'},
 sheep:{files:['pasture-ram.glb'],strides:[.31],fallback:{file:'alluvial-ram.glb',stride:.38},height:.83,space:.21,pen:'sheepfold'},
};
const COW_COATS=[[.96,.89,.77],[.65,.56,.47],[.86,.65,.47],[1,1,1]];
const PACE=.105;
const MAX_HERD=7;
const CATTLE_CAPACITY=9;
const cattleBull=index=>index===6||index===8;

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

function staysWithGroup(herd,member,from,to){
 if(closeToGroup(herd,member,to))return true;
 // Others may have walked away during a rest. Permit steps that close the gap.
 let before=Infinity,after=Infinity;
 for(const other of herd.members)if(other!==member&&other.point){
  before=Math.min(before,Math.hypot(other.point.x-from.x,other.point.y-from.y));
  after=Math.min(after,Math.hypot(other.point.x-to.x,other.point.y-to.y));
 }
 return before===Infinity||after<before;
}

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

function routeLength(points){
 let length=0;
 for(let i=1;i<points.length;i++)length+=Math.hypot(points[i].x-points[i-1].x,points[i].y-points[i-1].y);
 return length;
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

export function createTestLivestock(B,scene,meshes,dry,clear,shared=new Map(),clearForSearch=()=>clear){
 const herds=Object.entries(MODELS).map(([kind,spec],index)=>({kind,spec,index,members:[],handled:new Map()}));
 const assets=new Map(),coats=new Map(),claimed=new Set(),settledSheep=new Map();
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
   if(!disposed&&spec.fallback&&!assets.has(spec.files[0]))await loadFile(spec.fallback.file);
  }));
  ready=true;
 };
 void loadAnimals();

 function makeMember(herd,index){
  const {spec,kind}=herd;
  const preferred=kind==='bull'&&!cattleBull(index)?1:0;
  const variant=assets.has(spec.files[preferred])?preferred:assets.has(spec.files[0])?0:-1;
  const file=spec.files[variant]||spec.fallback?.file;
  if(!assets.has(file))return null;
  const source=assets.get(file);
  const name=`livestock-${kind}-${index}`;
  const root=new B.TransformNode(name,scene),display=new B.TransformNode(name+'-model',scene);
  const copy=source.instantiateModelsToScene(node=>name+'-'+node,false,{doNotInstantiate:true});
  for(const node of copy.rootNodes)node.parent=display;
  const {min,max}=display.getHierarchyBoundingVectors(true);
  const height=kind==='bull'&&!cattleBull(index)?1.27:spec.height;
  const scale=height*(.92+index%4*.04)/(max.y-min.y);
  display.scaling.setAll(scale);
  display.position.set(-(min.x+max.x)*scale/2,-min.y*scale,-(min.z+max.z)*scale/2);
  display.parent=root;
  root.metadata={herdAnimal:true,herdSpecies:kind,herdVariant:variant,herdModel:file,...(kind==='bull'?{cattleSex:cattleBull(index)?'bull':'cow'}:{})};
  root.setEnabled(false);
  const owned=root.getChildMeshes();
  if(file==='pasture-cow.glb'){
   const hide=owned.find(m=>m.getTotalVertices()>0&&m.material?.albedoColor&&!m.name.endsWith('Udder and four teats'));
   if(hide){const shade=index%COW_COATS.length;
    if(!coats.has(shade)){const coat=hide.material.clone('pasture-cow-hide-'+shade);coat.albedoColor.copyFromFloats(...COW_COATS[shade]);coats.set(shade,coat);}
    hide.material=coats.get(shade);
   }
  }
  for(const mesh of owned){mesh.isPickable=false;mesh.receiveShadows=true;meshes.push(mesh);}
  const walk=copy.animationGroups.find(group=>/-Walk$/i.test(group.name))||copy.animationGroups.find(group=>/-Animation$/i.test(group.name));
  const idle=copy.animationGroups.find(group=>/Idle$/i.test(group.name));
  const baseStride=spec.strides[variant]??spec.fallback.stride;
  const stride=file===GOAT_MODELS.pasture.file?baseStride*scale:baseStride;
  const member={root,owned,copy,walk,idle,stride,turnRadius:spec.height*.37,phase:index*.31,point:null,index,attempt:0,waitUntil:0};
  const targets=walk?.targetedAnimations||[];
  member.restPositions=targets.filter(({target,animation})=>target.position&&animation.targetProperty==='position')
   .map(({target})=>({target,position:target.position.clone()}));
  member.rest=targets.filter(({target,animation})=>target.rotationQuaternion&&animation.targetProperty==='rotationQuaternion')
   .map(({target})=>({target,rotation:target.rotationQuaternion.clone()}));
  return member;
 }

 function pose(member,point,state,dt,walking,backing=false){
  const {root}=member;
  const last=member.point;
  root.setEnabled(true);
  root.position.set(point.x*6,surfaceElevation(point.x,point.y,state),point.y*6);
  if(!last)root.rotation.y=point.yaw;
  else if(walking&&dt){
   const distance=Math.hypot(point.x-last.x,point.y-last.y)*6;
   if(distance<1.5){
    root.rotation.y=groundHeading(root.rotation.y,point.yaw,distance,member.turnRadius);
    member.phase+=(backing?-distance:distance)/member.stride;
   }
  }
  member.point=point;
  const clip=walking?member.walk:(member.idle||member.walk);
  if(!clip)return;
  root.metadata.clip=walking?'Walk':'Idle';root.metadata.gaitPhase=member.phase;
  const clipChanged=clip!==member.clip;
  if(clipChanged){
   member.clip?.stop();
   clip.start(true);
   clip.pause();
   member.clip=clip;
  }
  if(!dt&&last&&!clipChanged)return;
  const phase=clip===member.walk?member.phase:clock*.26+member.phase;
  const fraction=phase%1;
  clip.goToFrame(clip.from+(fraction<0?fraction+1:fraction)*(clip.to-clip.from));
  if(!walking&&!member.idle){
   for(const {target,position} of member.restPositions)target.position.copyFrom(position);
   for(const {target,rotation} of member.rest)target.rotationQuaternion.copyFrom(rotation);
  }
 }

 function assign(herd,state){
  const candidates=pens.filter(b=>isOperational(b)&&b.type===herd.spec.pen&&herd.handled.get(penKey(b))!==(b.built?.order??0));
  const leader=herd.members[0].point;
  if(!leader||!candidates.length)return null;
  const otherZones=herds.filter(other=>other!==herd&&other.zone).map(other=>other.zone);
  const clearGround=clearForSearch(state);
  const clearApproach=(world,from,to)=>otherZones.every(zone=>
   segmentDistance(zone,from,to)>zone.radius+.18)&&clearGround(world,from,to);
  for(const building of candidates.sort((a,b)=>Math.hypot(a.x-leader.x,a.y-leader.y)-Math.hypot(b.x-leader.x,b.y-leader.y))){
   const approaching=herd.members.filter(m=>m.index<herd.size&&(herd.kind!=='bull'||!cattleBull(m.index)));
   const targets=penTargets(state,building,herd.kind).slice(0,approaching.length);
   if(!targets.length)continue;
   const {outside,inside}=penEntrance(state,building);
   const approaches=[];
   for(let i=0;i<targets.length;i++){
    const start=approaching[i].point;
    const external=start&&approach(state,start,outside,clearApproach);
    if(!external)break; // The group can enter only if every member can reach this gate.
    approaches.push({points:external,length:routeLength(external)});
   }
   if(approaches.length===targets.length){
    const gateTime=Math.max(...approaches.map(path=>path.length))/PACE;
    const paths=approaches.map((path,i)=>({
     points:[...path.points.slice(1),inside,targets[i]],next:0,outsideEndsAt:path.points.length-1,
     delay:gateTime+i*herd.spec.space/PACE-path.length/PACE
    }));
    return {building,targets,paths,members:approaching.slice(0,targets.length),start:clock};
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
  const canMoveTo=point=>clearOfGroup(herd,member,from,point)&&staysWithGroup(herd,member,from,point)&&clear(state,from,point);
  const radius=member.turnRadius/6;
  if(!member.goal&&clock>=member.waitUntil){
   member.backing=false;
   for(let i=0;i<16;i++){
    const goal=randomPoint(herd,member);
    const distance=Math.hypot(goal.x-from.x,goal.y-from.y);
    if(distance<herd.spec.space*.7||distance>herd.zone.radius*.85||!canMoveTo(goal))continue;
    const direction=Math.atan2(goal.x-from.x,goal.y-from.y)-member.root.rotation.y;
    if(i<12&&Math.cos(direction)<.15)continue;
    // A clear straight line to a grazing spot may start with an obstructed turn.
    if(!canMoveTo(groundStep(from,goal,member.root.rotation.y,radius,radius)))continue;
    member.goal=goal;
    break;
   }
   // Back a few hoof-lengths out of a blocked turn. Keep heading and gait
   // consistent with walking backwards until there is space to turn forward.
   if(!member.goal){
    const yaw=member.root.rotation.y+Math.PI,side=member.attempt%2?1:-1;
    for(const angle of [side*.65,-side*.65,0]){
     const goal={x:from.x+Math.sin(yaw+angle)*radius*2.4,y:from.y+Math.cos(yaw+angle)*radius*2.4};
     if(Math.hypot(goal.x-herd.zone.x,goal.y-herd.zone.y)>herd.zone.radius+radius*2.4||!canMoveTo(goal))continue;
     member.goal=goal;member.backing=true;break;
    }
   }
   if(!member.goal)member.waitUntil=clock+.55+seed(herd.seed,member.attempt)*1.1;
  }
  if(member.goal){
   const pace=PACE*(.70+seed(herd.seed,member.index+herd.index*23+671)*.45)*(member.backing?.6:1);
   const offset=member.backing?Math.PI:0;
   const next=groundStep(from,member.goal,member.root.rotation.y+offset,pace*elapsed,radius);
   next.yaw-=offset;
   if(canMoveTo(next)){
    pose(member,next,state,elapsed,true,member.backing);
    if(!next.arrived)return;
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
     herd.size=herd.kind==='bull'?7+Math.floor(seed(worldSeed,53)*3):4+Math.floor(seed(worldSeed,herd.index+51)*4);
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
    for(let i=0;i<(herd.kind==='bull'?CATTLE_CAPACITY:MAX_HERD);i++){
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
    for(const member of herd.members){
     const i=transfer.members.indexOf(member);
     if(i<0){
      if(herd.kind==='bull'&&member.index<herd.size)roam(herd,member,state,elapsed);
      else member.root.setEnabled(false);
      continue;
     }
     const path=transfer.paths[i];
     claimed.add(transfer.targets[i].id);
     member.root.metadata.herdDestination=transfer.building.type;
     member.root.scaling.setAll(transfer.targets[i].young?.68:1);
     if(herd.kind==='bull')for(const mesh of member.owned)if(mesh.name.endsWith('Udder and four teats'))mesh.setEnabled(!transfer.targets[i].young);
     const goal=path.points[path.next];
     if(goal&&elapsed&&clock>transfer.start+path.delay){
      const next=groundStep(member.point,goal,member.root.rotation.y,elapsed*PACE,member.turnRadius/6);
      // The approach was planned as straight segments. Check the bend too,
      // up to the outer gate. Inside the pen the stall is the intended target.
      if(path.next<path.outsideEndsAt&&!clear(state,member.point,next)){
       herd.transfer=null;
       herd.nextSearch=clock+6;
       arrived=false;
       break;
      }
      const walking=next.x!==member.point.x||next.y!==member.point.y;
      pose(member,next,state,elapsed,walking);
      if(next.arrived)path.next++;
     }else if(elapsed)pose(member,member.point,state,elapsed,false);
     if(path.next<path.points.length)arrived=false;
    }
    if(arrived){
     herd.handled.set(penKey(transfer.building),transfer.building.built?.order??0);
     herd.transfer=null;
     herd.departedAt=clock;
     if(herd.kind==='sheep'){
      const hour=lightingAt(state.simTime).hour;
      const release=state.simTime+(24-hour)*DAY_SECONDS/24;
      for(const [i,target] of transfer.targets.entries()){
       settledSheep.set(target.id,{...target,...herd.members[i].point,yaw:herd.members[i].root.rotation.y,release});
      }
     }
     for(const member of herd.members){if(herd.kind==='bull'&&!transfer.members.includes(member))continue;member.root.setEnabled(false);member.point=null;member.goal=null;}
    }
    continue;
   }
   if(!herd.zone)continue;
   for(const member of herd.members){
    if(member.index>=herd.size||!member.point&&clock-(herd.departedAt??-Infinity)<8){member.root.setEnabled(false);continue;}
    if(member.root.metadata.herdDestination&&herd.kind==='bull')for(const mesh of member.owned)if(mesh.name.endsWith('Udder and four teats'))mesh.setEnabled(true);
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
  for(const coat of coats.values())coat.dispose();
  for(const [file,asset] of assets)if(!shared.has(file))asset.dispose();
 }
 return {update,dispose,claims:id=>claimed.has(id),hasPigs:()=>herds[0].members.some(member=>member.root.isEnabled()),sheepPose:animal=>{
  const point=settledSheep.get(animal.id);
  return point?{...animal,x:point.x,y:point.y,yaw:point.yaw,walking:false,behavior:'resting'}:animal;
 }};
}
