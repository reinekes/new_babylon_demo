import {loadModel} from './asset-loading.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {buildingKey,isOperational} from '../definitions.js';
import {flockAdults,flockSize} from '../textiles.js';
import {sheepfoldGateSide,sheepfoldLayout,sheepfoldWorldPoint} from '../sheepfold-layout.js';
import {DAY_SECONDS,lightingAt} from '../city-life.js';
import {dairyHerd} from './dairy-herd.js';

const MODELS={
 pig:{files:['test-pig-trellis.glb','ambient-yard-pig.glb'],strides:[.34,.54],height:.64,space:.22},
 goat:{files:['test-goat-trellis.glb','goat-downloaded.glb'],strides:[.40,.30],height:.96,space:.22},
 bull:{files:['test-bull-trellis.glb','ambient-bull.glb'],strides:[.62,1.23],height:1.43,space:.32,pen:'cowshed'},
 sheep:{files:['ambient-sheep-kenchoo.glb'],strides:[.19],height:.83,space:.21,pen:'sheepfold'},
};
const PACE=.105;
const MAX_HERD=7;

function trackPoint(track,distance){
 const {x,y,cos,sin,half,radius,length}=track;
 const straight=2*half,bend=Math.PI*radius;
 const d=((distance%length)+length)%length;
 let u,v,du,dv;
 if(d<straight){
  u=-half+d;v=-radius;du=1;dv=0;
 }else if(d>=straight+bend&&d<2*straight+bend){
  u=half-(d-straight-bend);v=radius;du=-1;dv=0;
 }else{
  const far=d<straight+bend;
  const angle=(d-(far?straight:2*straight+bend))/radius+(far?0:Math.PI);
  u=(far?half:-half)+radius*Math.sin(angle);v=-radius*Math.cos(angle);
  du=Math.cos(angle);dv=Math.sin(angle);
 }
 return {x:x+u*cos-v*sin,y:y+u*sin+v*cos,yaw:Math.atan2(du*cos-dv*sin,du*sin+dv*cos)};
}

function trackClear(state,track,dry,clear){
 const samples=Math.ceil(track.length/.24);
 let last=trackPoint(track,0);
 if(!dry(state,last.x,last.y,.42))return false;
 for(let step=1;step<=samples;step++){
  const next=trackPoint(track,track.length*step/samples);
  if(!dry(state,next.x,next.y,.42)||!clear(state,last,next))return false;
  last=next;
 }
 return true;
}

function findTrack(state,occupied,offset,dry,clear){
 const home=state.buildings.find(b=>b.type==='cityGate')||state.buildings.find(b=>b.type==='house');
 if(!home)return null;
 for(let ring=0;ring<20;ring++)for(let i=0;i<16;i++){
  const angle=(i+offset*3)*Math.PI/8,r=2.3+ring*.54;
  const x=home.x+r*Math.cos(angle),y=home.y+r*Math.sin(angle);
  if(occupied.some(p=>Math.hypot(x-p.x,y-p.y)<2.7))continue;
  if(!dry(state,x,y,.5))continue;
  const half=.83,radius=.48,length=4*half+2*Math.PI*radius;
  const heading=angle+Math.PI/2;
  const track={x,y,half,radius,length,cos:Math.cos(heading),sin:Math.sin(heading)};
  if(trackClear(state,track,dry,clear))return track;
 }
 return null;
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
  const files=[...new Set(herds.flatMap(herd=>herd.spec.files))];
  await Promise.all(files.map(async file=>{
   try{
    const source=shared.get(file)||await loadModel(B,scene,'assets/art-courtyard/models/',file,scene,undefined,'.glb');
    if(disposed&&!shared.has(file))source.dispose();
    else assets.set(file,source);
   }catch(error){console.warn('Livestock model unavailable:',file,error);}
  }));
  ready=true;
 };
 void loadAnimals();

 function makeMember(herd,index){
  const {spec,kind}=herd;
  const variant=index%spec.files.length;
  const source=assets.get(spec.files[variant])||spec.files.map(file=>assets.get(file)).find(Boolean);
  if(!source)return null;
  const name=`livestock-${kind}-${index}`;
  const root=new B.TransformNode(name,scene),display=new B.TransformNode(name+'-model',scene);
  const copy=source.instantiateModelsToScene(node=>name+'-'+node,false,{doNotInstantiate:true});
  for(const node of copy.rootNodes)node.parent=display;
  const {min,max}=display.getHierarchyBoundingVectors(true);
  const scale=spec.height*(.92+index%4*.04)/(max.y-min.y);
  display.scaling.setAll(scale);
  display.position.set(-(min.x+max.x)*scale/2,-min.y*scale,-(min.z+max.z)*scale/2);
  display.parent=root;
  root.metadata={herdAnimal:true,herdSpecies:kind,herdVariant:variant};
  root.setEnabled(false);
  const owned=root.getChildMeshes();
  for(const mesh of owned){mesh.isPickable=false;mesh.receiveShadows=true;meshes.push(mesh);}
  const walk=copy.animationGroups.find(group=>/(?:Walk|Animation)$/i.test(group.name));
  const idle=copy.animationGroups.find(group=>/Idle$/i.test(group.name));
  const member={root,owned,copy,walk,idle,stride:spec.strides[variant],phase:index*.31,point:null};
  const targets=walk?.targetedAnimations||[];
  member.trunk=targets.find(({target,animation})=>target.name.endsWith('-body')&&animation.targetProperty==='position')?.target;
  member.trunkRest=member.trunk?.position.clone();
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
   if(member.trunk)member.trunk.position.copyFrom(member.trunkRest);
   for(const {target,rotation} of member.rest)target.rotationQuaternion.copyFrom(rotation);
  }
 }

 function assign(herd,state){
  const candidates=pens.filter(b=>isOperational(b)&&b.type===herd.spec.pen&&herd.handled.get(penKey(b))!==(b.built?.order??0));
  const leader=herd.members[0].point;
  if(!leader)return null;
  for(const building of candidates.sort((a,b)=>Math.hypot(a.x-leader.x,a.y-leader.y)-Math.hypot(b.x-leader.x,b.y-leader.y))){
   const targets=penTargets(state,building,herd.kind);
   if(!targets.length||targets.length>herd.members.length)continue;
   const {outside,inside}=penEntrance(state,building);
   const approaches=targets.map((_,i)=>{
    const start=herd.members[i].point;
    const external=start&&approach(state,start,outside,clear);
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
    if(!herd.track||!trackClear(state,herd.track,dry,clear))herd.track=findTrack(state,[...otherHerd,...herds.filter(other=>other!==herd&&other.track).map(other=>other.track)],herd.index,dry,clear);
    herd.nextSearch=clock;
   }
  }
  claimed.clear();
  for(const [id,point] of settledSheep)if(state.simTime>=point.release)settledSheep.delete(id);
  for(const herd of herds){
   if(!herd.track&&!herd.transfer){for(const member of herd.members)member.root.setEnabled(false);continue;}
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
     for(const member of herd.members){member.root.setEnabled(false);member.point=null;}
    }
    continue;
   }
   if(!herd.track||clock-(herd.departedAt??-Infinity)<8)continue;
   const travel=herd.track.length/PACE;
   const time=clock+herd.index*3;
   const cycle=travel+1.25;
   const moving=time%cycle<travel;
   const leadDistance=Math.min(time%cycle,travel)*PACE+herd.track.half;
   for(let i=0;i<herd.members.length;i++){
    const member=herd.members[i];
    if(i>=(herd.spec.pen?MAX_HERD:5)){member.root.setEnabled(false);continue;}
    const distance=leadDistance-i*herd.spec.space;
    delete member.root.metadata.herdDestination;
    member.root.scaling.setAll(1);
    pose(member,trackPoint(herd.track,distance),state,elapsed,moving);
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
