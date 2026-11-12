import {riverLength,riverLocal,riverPoint,signedRiverDistance,onBridge} from '../world.js';
import {TILE} from '../district3d/terrain.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {renderedShoreDistance} from './shore-profile.js';
import {WATER_HEIGHT} from './water.js';

const TAU=2*Math.PI;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{const t=clamp(x);return t*t*(3-2*t);};
const mix=(a,b,t)=>a+(b-a)*t;
const samples=96;

// Follow a curved strip of shoreline. Validate the entire loop before using it.
export function mallardRoute(state,isClear){
 const home=state.buildings.find(b=>b.type==='house')??{x:8,y:8};
 const center=Math.max(3,Math.min(riverLength(state)-4,riverLocal(home.x,home.y,state).along));
 const preferred=Math.sign(signedRiverDistance(home.x,home.y,state))||1;
 for(const side of [preferred,-preferred])for(const shift of [0,3,-3,6,-6,9,-9,12,-12]){
  const along=center+shift;
  if(along<2||along>riverLength(state)-3)continue;
  const route=[];
  let time=0,distance=0;
  for(let i=0;i<=samples;i++){
   const angle=i/samples*TAU,p=riverPoint(along+1.05*Math.sin(angle),state,side*(1.19+.44*Math.cos(angle)));
   if(!isClear(p)||onBridge(state.buildings,p.x,p.y,state))break;
   const y=visualSurfaceElevation(p.x,p.y,state);
   const depth=renderedShoreDistance(p.x,p.y,state)<0?Math.max(0,WATER_HEIGHT-y):0;
   const floating=smooth((depth-.035)/.16);
   const prev=route.at(-1);
   if(prev){
    const segment=TILE*Math.hypot(p.x-prev.x,p.y-prev.z);
    distance+=segment;
    time+=segment/mix(.48,.66,floating);
   }
   route.push({x:p.x,z:p.y,y,depth,time,distance});
  }
  if(route.length===samples+1){
   const middle=riverPoint(along,state,side*1.19),water=riverPoint(along,state);
   return {route,time,distance,focus:{x:middle.x,z:middle.y,angle:Math.atan2(water.y-middle.y,water.x-middle.x)}};
  }
 }
 return null;
}

export function mallardPose(plan,clock){
 const t=((clock%plan.time)+plan.time)%plan.time;
 const {route}=plan;
 let low=0,high=samples;
 while(high-low>1){const mid=(low+high)>>1;if(route[mid].time<=t)low=mid;else high=mid;}
 const a=route[low],b=route[high],f=(t-a.time)/(b.time-a.time);
 const prev=route[(low+samples-1)%samples],next=route[(high+1)%samples];
 const depth=mix(a.depth,b.depth,f),floating=smooth((depth-.035)/.16);
 const distance=mix(a.distance,b.distance,f);
 const gait=distance/plan.distance*Math.round(plan.distance/.32);
 const paddle=distance/plan.distance*Math.round(plan.distance/.39);
 const bob=mix(.011*Math.sin(gait*TAU*2)**2,.008*Math.sin(paddle*TAU*2),floating);
 return {
  x:mix(a.x,b.x,f)*TILE,z:mix(a.z,b.z,f)*TILE,
  y:mix(mix(a.y,b.y,f),WATER_HEIGHT-.18,floating)+bob,
  yaw:Math.atan2(mix(b.x-prev.x,next.x-a.x,f),mix(b.z-prev.z,next.z-a.z,f)),
  pitch:mix(.035*Math.sin(gait*TAU*2),.025*Math.sin(paddle*TAU*2),floating),
  roll:mix(.075*Math.sin(gait*TAU),.028*Math.sin(paddle*TAU),floating),
  floating,gait,paddle,phase:depth>.195?'swimming':depth>.012?'wading':'walking'
 };
}

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
 return joints[species].map(leg=>leg.map(name=>{
  const node=nodes.get(name);
  if(!node?.rotationQuaternion)return null;
  const axis=B.Vector3.TransformNormal(B.Axis.X,node.computeWorldMatrix(true).clone().invert()).normalize();
  return {node,axis,rest:node.rotationQuaternion.clone(),rotation:B.Quaternion.Identity()};
 }));
}

export function poseMallardRig(B,rig,p){
 for(let side=0;side<rig.length;side++){
  const gait=(p.gait+side*.5)%1,paddle=(p.paddle+side*.5)%1;
  const swing=clamp((gait-.58)/.42),lift=Math.sin(swing*Math.PI);
  const stride=gait<.58?mix(-.43,.43,gait/.58):mix(.43,-.43,smooth(swing));
  const recovery=clamp((paddle-.46)/.54),fold=Math.sin(recovery*Math.PI);
  const stroke=paddle<.46?mix(-.46,.58,paddle/.46):mix(.58,-.46,smooth(recovery));
  const walk=[stride,-.58*lift,.35*lift-.35*stride,.21*lift];
  const swim=[.18+stroke,-.22-.58*fold,.1+.45*fold,-.3*fold];
  for(const [index,joint] of rig[side].entries()){
   if(!joint)continue;
   B.Quaternion.RotationAxisToRef(joint.axis,mix(walk[index],swim[index],p.floating),joint.rotation);
   joint.rest.multiplyToRef(joint.rotation,joint.node.rotationQuaternion);
  }
 }
}
