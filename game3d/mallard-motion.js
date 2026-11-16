import {riverLength,riverLocal,riverPoint,signedRiverDistance,onBridge} from '../world.js';
import {TILE} from '../district3d/terrain.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {renderedShoreDistance} from './shore-profile.js';
import {WATER_HEIGHT} from './water.js';

const TAU=2*Math.PI;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const samples=160;
const stopKinds={feeding:{duration:2.8,delay:1.2},scanning:{duration:2.3,delay:1.05}};

// Walk to a second mudflat along the bank, cross the shallows at either end,
// and swim back along the same bend past two feeding patches.
export function mallardRoute(state,isClear){
 const home=state.buildings.find(b=>b.type==='house')??{x:8,y:8};
 const length=riverLength(state),center=riverLocal(home.x,home.y,state).along;
 const preferred=Math.sign(signedRiverDistance(home.x,home.y,state))||1;
 for(const reach of [4.8,3.7,2.8,1.7,1.05])for(const side of [preferred,-preferred])for(const shift of [0,3,-3,6,-6,9,-9,12,-12]){
  const along=Math.max(reach+1.55,Math.min(length-reach-2.55,center+shift));
  const route=[];
  let time=0,distance=0;
  for(let i=0;i<=samples;i++){
   const angle=i/samples*TAU,cross=1.13+.62*Math.cos(angle)+.060*Math.sin(angle*3)+.023*Math.sin(angle*5+.9);
   const p=riverPoint(along+reach*Math.sin(angle),state,side*cross);
   if(!isClear(p)||onBridge(state.buildings,p.x,p.y,state))break;
   const y=visualSurfaceElevation(p.x,p.y,state);
   const depth=renderedShoreDistance(p.x,p.y,state)<0?Math.max(0,WATER_HEIGHT-y):0;
   const floating=smooth((depth-.035)/.16);
   const prev=route.at(-1);
   if(prev){
    const segment=TILE*Math.hypot(p.x-prev.x,p.y-prev.z);
    distance+=segment;
    time+=segment/mix(.52,.77,floating);
   }
   route.push({x:p.x,z:p.y,y,depth,time,distance});
  }
  if(route.length===samples+1){
   const feed=(point,index)=>point.depth>.19&&point.depth<.44&&
    route.slice(index,index+5).filter(next=>next.time<point.time+1.85).every(next=>next.depth>.15);
   const stops=[
    ['scanning',route.find((p,i)=>i>samples*.11&&p.y>-.025)],
    ['feeding',route.find((p,i)=>i>samples*.18&&i<samples*.37&&feed(p,i))],
    ['feeding',route.find((p,i)=>i>samples*.65&&i<samples*.86&&feed(p,i))],
    ['scanning',route.find((p,i)=>i>samples*.79&&p.y>-.025)]
   ].filter(([,p])=>p).map(([kind,p])=>({kind,time:p.time,...stopKinds[kind]}));
   const middle=stops.find(p=>p.kind==='feeding'),station=middle?route.find(p=>p.time===middle.time):route[Math.floor(samples*.25)];
   const water=riverPoint(riverLocal(station.x,station.z,state).along,state);
   return {route,time,distance,stops,cycle:time+stops.reduce((total,stop)=>total+stop.delay,0),focus:{x:station.x,z:station.z,angle:Math.atan2(water.y-station.z,water.x-station.x)}};
  }
 }
 return null;
}

export function mallardPose(plan,clock){
 let t=((clock%plan.cycle)+plan.cycle)%plan.cycle,progress=0,scanProgress=0;
 for(const stop of plan.stops){
  const p=clamp((t-stop.time)/stop.duration);
  if(p>0&&p<1){if(stop.kind==='feeding')progress=p;else scanProgress=p;}
  t-=stop.delay*smooth(p);
 }
 const scan=Math.sin(TAU*scanProgress)*Math.sin(Math.PI*scanProgress);
 const scanning=scanProgress>0&&scanProgress<1;
 const dip=Math.sin(Math.PI*progress)**2;
 const feeding=progress>0&&progress<1;
 const {route}=plan,last=route.length-1;
 let low=0,high=last;
 while(high-low>1){const mid=(low+high)>>1;if(route[mid].time<=t)low=mid;else high=mid;}
 const a=route[low],b=route[high],f=(t-a.time)/(b.time-a.time);
 const prev=route[(low+last-1)%last],next=route[(high+1)%last];
 const depth=mix(a.depth,b.depth,f),floating=smooth((depth-.035)/.16);
 const distance=mix(a.distance,b.distance,f);
 const gait=distance/plan.distance*Math.round(plan.distance/.32);
 const paddle=distance/plan.distance*Math.round(plan.distance/.39);
 const bob=mix(.011*Math.sin(gait*TAU*2)**2,.008*Math.sin(paddle*TAU*2),floating);
 return {
  x:mix(a.x,b.x,f)*TILE,z:mix(a.z,b.z,f)*TILE,
  y:mix(mix(a.y,b.y,f),WATER_HEIGHT-.18,floating)+bob,
  yaw:Math.atan2(mix(b.x-prev.x,next.x-a.x,f),mix(b.z-prev.z,next.z-a.z,f)),
  pitch:mix(.035*Math.sin(gait*TAU*2),.025*Math.sin(paddle*TAU*2),floating)+.15*dip,
  roll:mix(.075*Math.sin(gait*TAU),.028*Math.sin(paddle*TAU),floating),
  floating,gait,paddle,dip,scan,phase:scanning?'scanning':feeding?'feeding':depth>.195?'swimming':depth>.012?'wading':'walking'
 };
}

const necks={
 mallard:['duck_Neck1_bone_017','duck_Head_bone_020'],
 'mallard-female':['duck Neck','duck Head']
};
const joints={
 mallard:[
  ['duck_l_Femur_bone_010','duck_l_Tibia_bone_011','duck_l_Metatarsus_bone_00','duck_l_Ankle_bone_012'],
  ['duck_r_Femur_bone_04','duck_r_Tibia_bone_05','duck_r_Metatarsus_bone_06','duck_r_Ankle_bone_07']
 ],
 'mallard-female':[
  ['duck L Thigh','duck L Calf','duck L Foot','duck L Toe0'],
  ['duck R Thigh','duck R Calf','duck R Foot','duck R Toe0']
 ]
};

// Convert sagittal pitch into each source rig's bind axes once. The source
// models have different bone orientations but share the same gait timing.
export function createMallardRig(B,root,species,id){
 const nodes=new Map(root.getChildTransformNodes().map(node=>[node.name.slice(id.length+1),node]));
 const joint=(name,canTurn=false)=>{
  const node=nodes.get(name);
  if(!node?.rotationQuaternion)return null;
  const world=node.computeWorldMatrix(true);
  const inverse=world.clone().invert();
  const axis=B.Vector3.TransformNormal(B.Axis.X,inverse).normalize();
  const turnAxis=canTurn?B.Vector3.TransformNormal(B.Axis.Y,inverse).normalize():null;
  return {node,axis,turnAxis,handedness:Math.sign(world.determinant()),rest:node.rotationQuaternion.clone(),rotation:B.Quaternion.Identity()};
 };
 return {legs:joints[species].map(leg=>leg.map(name=>joint(name))),neck:necks[species].map(name=>joint(name,true))};
}

export function poseMallardRig(B,rig,p){
 const rotate=(joint,angle,axis=joint?.axis)=>{
  if(!joint)return;
  B.Quaternion.RotationAxisToRef(axis,angle,joint.rotation);
  joint.rest.multiplyToRef(joint.rotation,joint.node.rotationQuaternion);
 };
 for(const [index,joint] of rig.neck.entries()){
  if(!joint)continue;
  if(p.phase==='scanning')rotate(joint,joint.handedness*p.scan*(index===0?.29:.48),joint.turnAxis);
  else rotate(joint,joint.handedness*p.dip*(index===0?.64:.32));
 }
 for(let side=0;side<rig.legs.length;side++){
  const gait=(p.gait+side*.5)%1,paddle=(p.paddle+side*.5)%1;
  const swing=clamp((gait-.58)/.42),lift=Math.sin(swing*Math.PI);
  const stride=gait<.58?mix(-.43,.43,gait/.58):mix(.43,-.43,smooth(swing));
  const recovery=clamp((paddle-.46)/.54),fold=Math.sin(recovery*Math.PI);
  const stroke=paddle<.46?mix(-.46,.58,paddle/.46):mix(.58,-.46,smooth(recovery));
  const walk=[stride,-.58*lift,.35*lift-.35*stride,.21*lift];
  const swim=[.18+stroke,-.22-.58*fold,.1+.45*fold,-.3*fold];
  for(const [index,joint] of rig.legs[side].entries()){
   rotate(joint,mix(walk[index],swim[index]*(1-.55*p.dip),p.floating));
  }
 }
}
