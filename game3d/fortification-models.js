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
  if(!wallModels||p.w===p.d){solid(p);return;}
  const turn=p.d>p.w,length=turn?p.d:p.w,width=turn?p.w:p.d;
  for(const source of wallModels)fit(source,'uruk-city-wall',[p.x,-.045,p.z],[length,2.17,width],turn);
  // A thin solid mortar joint covers the uneven scan ends. It shares the
  // canonical tile edge and keeps straight runs, bends and T junctions sealed.
  for(const end of [-1,1]){
   const cap=.13,offset=end*(length-cap+.012)/2;
   solid({...p,x:p.x+(turn?0:offset),z:p.z+(turn?offset:0),w:turn?width:cap,d:turn?cap:width});
  }
 }
 if(b.type==='cityGate'){
  for(const p of fortificationLayout(b,state))if(!p.gateBody)span(p);
  for(const source of models)fit(source,'uruk-city-gate',[3,-.04,3],[6,3.25,3.12],true);
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
