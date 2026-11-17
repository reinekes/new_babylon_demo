import {footprintSize} from '../footprints.js';
import {fortificationLayout} from '../fortification-layout.js';

export function createImportedFortification(B,scene,b,state,clay,models,wallModels=models){
 const parts=[],joints=[];
 function solid(p){
  const mesh=B.MeshBuilder.CreateBox('fortification-joint',{width:p.w,height:p.h,depth:p.d},scene);
  mesh.position.set(p.x,p.bottom+p.h/2,p.z);
  mesh.material=clay;
  joints.push(mesh);
 }
 function finish(){
  if(joints.length)parts.push(joints.length===1?joints[0]:B.Mesh.MergeMeshes(joints,true,true));
  return parts;
 }
 function fit(source,name,position,size,turn=false){
  const {minimum:min,maximum:max}=source.getBoundingInfo().boundingBox;
  const mesh=source.clone(name,null,true);
  mesh.overrideMaterialSideOrientation=source.overrideMaterialSideOrientation;
  mesh.scaling.set(size[0]/(max.x-min.x),size[1]/(max.y-min.y),size[2]/(max.z-min.z));
  mesh.position.set(...position);
  mesh.rotation.y=turn?Math.PI/2:0;
  parts.push(mesh);
 }
 function span(p){
  if(!wallModels){solid(p);return;}
  const turn=p.d>p.w,length=turn?p.d:p.w,width=turn?p.w:p.d;
  // Slight overlap at shared ends avoids gaps from world-space rounding.
  for(const source of wallModels)fit(source,'uruk-city-wall',[p.x,p.bottom,p.z],[length+.014,p.h,width],turn);
 }
 if(b.type==='cityGate'){
  const size=footprintSize(b),center=(size-1)*3;
  for(const p of fortificationLayout(b,state))if(!p.gateBody)span(p);
  for(const source of models)fit(source,'uruk-city-gate',[center,-.04,center],size===2?[6,3.25,3.12]:[4.4,3.25,2.76],true);
  return finish();
 }
 const layout=fortificationLayout(b,state);
 // A straight tile is one continuous textured length, not a row of patches.
 const alongX=layout.every(p=>p.z===0),alongZ=layout.every(p=>p.x===0);
 let spans=layout;
 if(layout.length>1&&(alongX||alongZ)){
  const axis=alongX?'x':'z',extent=alongX?'w':'d';
  const lo=Math.min(...layout.map(p=>p[axis]-p[extent]/2)),hi=Math.max(...layout.map(p=>p[axis]+p[extent]/2));
  spans=[{...layout[0],[axis]:(lo+hi)/2,[extent]:hi-lo}];
 }
 for(const p of spans)span(p);
 return finish();
}

export function createGateTorches(B,scene,b,materials){
 const large=footprintSize(b)===2,center=large?3:0;
 const facade=center+(large?1.52:1.34),offset=large?2.16:1.58;
 const parts=[];
 for(const side of [-1,1]){
  const z=center+side*offset;
  const bracket=B.MeshBuilder.CreateBox('gate-torch-bracket',{width:.28,height:.12,depth:.14},scene);
  bracket.position.set(facade+.04,1.81,z);
  bracket.material=materials.wood;
  const handle=B.MeshBuilder.CreateCylinder('gate-torch-handle',{height:.30,diameter:.065,tessellation:8},scene);
  handle.position.set(facade+.16,1.86,z);
  handle.rotation.z=-.24;
  handle.material=materials.wood;
  const head=B.MeshBuilder.CreateCylinder('gate-torch-wrap',{height:.13,diameterTop:.16,diameterBottom:.105,tessellation:10},scene);
  head.position.set(facade+.20,2.05,z);
  head.material=materials.reed;
  const wick=B.MeshBuilder.CreateCylinder('gate-wick-'+side,{height:.04,diameter:.10,tessellation:10},scene);
  wick.position.set(facade+.20,2.13,z);
  wick.material=materials.shade;
  parts.push(bracket,handle,head,wick);
 }
 return parts;
}
