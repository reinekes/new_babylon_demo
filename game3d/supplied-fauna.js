import {loadModel} from './asset-loading.js';
import {WATER_HEIGHT} from './water.js';
import {surfaceElevation} from '../district3d/terrain.js';

const models={
 mouse:{file:'supplied-realistic-rat.glb',height:.085,yaw:0},
 'common-quail':{file:'supplied-common-quail.glb',height:.20,yaw:0},
 'savigny-tree-frog':{file:'supplied-frog-jump.glb',height:.07,yaw:0,clip:'metarig|jumpInPlace'},
 'white-pelican':{file:'supplied-pelican-wasis.glb',height:1.42,yaw:Math.PI/2,waterline:.42}
};

const fishModels={
 'yellowfin-goby':{file:'supplied-yellowfin-goby.glb',length:.32,yaw:Math.PI/2},
 'oriental-goby':{file:'supplied-oriental-goby.glb',length:.48,yaw:Math.PI/2}
};
function fishVariant(pose){
 const index=Number(pose.id.split(':').at(-1));
 return index%2?'oriental-goby':'yellowfin-goby';
}

export async function createSuppliedFauna(B,scene,meshes){
 const sources=new Map();
 const actors=new Map();
 await Promise.all(Object.entries({...models,...fishModels}).map(async ([kind,model])=>{
  try {
   const asset=await loadModel(B,scene,'assets/art-courtyard/models/',model.file,scene,undefined,'.glb');
   if(model.clip&&!asset.animationGroups.some(group=>group.name===model.clip)){
    asset.dispose();
    throw new Error('Missing '+model.clip);
   }
   sources.set(kind,asset);
  } catch(error) {
   console.warn('Shore model unavailable:',model.file,error);
  }
 }));
 const modelKey=pose=>{
  if(pose.kind!=='fish')return pose.kind==='pestCatch'?'mouse':pose.kind;
  const preferred=fishVariant(pose);
  return sources.has(preferred)?preferred:Object.keys(fishModels).find(key=>sources.has(key));
 };
 const supports=pose=>sources.has(modelKey(pose))&&(pose.kind!=='white-pelican'||pose.behavior==='swimming');
 function create(pose){
  const key=modelKey(pose),model=models[key]||fishModels[key];
  const fish=pose.kind==='fish';
  const root=new B.TransformNode('supplied-'+pose.id,scene);
  if(fish||pose.kind==='mouse'||pose.kind==='pestCatch')root.metadata={animalKind:pose.kind,animalId:pose.id,...fish?{fishModel:key}:{}};
  const pivot=new B.TransformNode(root.name+'-pivot',scene);
  pivot.parent=root;
  const copy=sources.get(key).instantiateModelsToScene(undefined,false,{doNotInstantiate:!!model.clip||pose.kind==='white-pelican'});
  for(const node of copy.rootNodes)node.parent=pivot;
  const {min,max}=pivot.getHierarchyBoundingVectors(true);
  const scale=fish?model.length/Math.max(max.x-min.x,max.z-min.z):model.height/(max.y-min.y);
  pivot.scaling.setAll(scale);
  pivot.position.set(-(min.x+max.x)*scale/2,fish?-(min.y+max.y)*scale/2:-min.y*scale-(model.waterline||0),-(min.z+max.z)*scale/2);
  const owned=pivot.getChildMeshes();
  if(fish){
   // The source is static and instanced. A full sphere bounds every rolled
   // or yawed pose and is used before submitting any of its dense triangles.
   const radius=Math.hypot(max.x-min.x,max.y-min.y,max.z-min.z)*scale*.5;
   root.metadata.fishModelRadius=radius;
  }
  const materials=new Map();
  const pelican=pose.kind==='white-pelican';
  if(pelican){
   // The scan has standing legs baked into its mesh. Clip their underwater
   // part on this actor only, so the transparent river never shows them.
   const surface=new B.Plane(0,-1,0,WATER_HEIGHT-.028);
   for(const mesh of owned){
    const material=mesh.material;
    if(!material)continue;
    if(!materials.has(material)){
     const copy=material.clone('pelican-waterline');
     copy.clipPlane=surface;
     materials.set(material,copy);
    }
    mesh.material=materials.get(material);
   }
  }
  const wake=pelican?B.MeshBuilder.CreateLineSystem('pelican-wake',{
   lines:[-1,1].map(side=>[[.16,-.19],[.31,-.42],[.55,-.82],[.83,-1.23]].map(([x,z])=>new B.Vector3(side*x,0,z))),
   colors:[-1,1].map(()=>[0,.65,.42,0].map(alpha=>new B.Color4(.81,.86,.78,alpha))),
   useVertexAlpha:true
  },scene):null;
  if(wake){wake.isPickable=false;wake.setEnabled(false);}
  for(const mesh of owned){
   mesh.isPickable=fish;
   meshes.push(mesh);
  }
  const animation=model.clip&&copy.animationGroups.find(group=>group.name.endsWith(model.clip));
  for(const group of copy.animationGroups)group.stop();
  if(animation){
   animation.start(false,1,animation.from,animation.to,false);
   animation.pause();
  }
  return {root,copy,owned,materials,wake,animation,frame:null,lastX:pose.x,lastY:pose.y,yaw:0};
 }
 function update(state,poses,fish=[]){
  for(const actor of actors.values())actor.visible=false;
  for(const pose of [...poses,...fish]){
   if(!supports(pose))continue;
   let actor=actors.get(pose.id);
   if(!actor){
    actor=create(pose);
    actors.set(pose.id,actor);
   }
   actor.visible=true;
   actor.root.setEnabled(true);
   if(pose.kind==='fish'){
    const dx=pose.x-actor.lastX,dz=pose.y-actor.lastY;
    if(Number.isFinite(pose.yaw))actor.yaw=pose.yaw;
    else if(Math.hypot(dx,dz)>1e-6){
     const yaw=Math.atan2(dx,dz),delta=yaw-actor.yaw;
     actor.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*.35;
    }
    actor.lastX=pose.x;
    actor.lastY=pose.y;
    const phase=(state.simTime||0)*5+pose.id.length;
    const depth=Math.min(WATER_HEIGHT-.32,(pose.waterLevel??WATER_HEIGHT)-(pose.swimDepth??.28));
    actor.root.position.set(pose.x*6,depth+Math.sin(phase*.4)*.018,pose.y*6);
    actor.root.rotation.set(0,actor.yaw+fishModels[actor.root.metadata.fishModel].yaw+Math.sin(phase)*.09,Math.sin(phase*.75)*.035);
    continue;
   }
   const terrain=pose.kind==='savigny-tree-frog'||pose.elevation===undefined;
   const elevation=terrain?surfaceElevation(pose.x,pose.y,state):pose.elevation;
   actor.root.position.set(pose.x*6,elevation+(pose.kind==='savigny-tree-frog'?.018:0),pose.y*6);
   const rodent=pose.kind==='mouse'||pose.kind==='pestCatch';
   const yaw=rodent?Math.atan2((pose.faceX??pose.x)-pose.x,(pose.faceY??pose.y)-pose.y):pose.yaw||0;
   actor.root.rotation.y=yaw+models[modelKey(pose)].yaw;
   if(rodent){
    const catchProgress=pose.kind==='pestCatch'?Math.min(1,pose.progress/.26):0;
    actor.root.rotation.z=catchProgress*1.5;
    actor.root.position.y+=pose.kind==='mouse'?Math.abs(Math.sin(pose.step||0))*.012:.025*Math.sin(catchProgress*Math.PI);
    actor.root.scaling.setAll(1-.62*catchProgress);
   }
   if(pose.kind==='white-pelican'){
    const scoop=pose.scoop||0,stroke=pose.stroke??1,phase=state.simTime||0;
    actor.root.position.y=WATER_HEIGHT+.012+Math.sin(phase*2.1)*.018-.045*scoop;
    actor.root.rotation.x=Math.sin(phase*1.4)*.018;
    actor.root.rotation.z=scoop*.40+Math.sin(phase*1.7)*.022;
    actor.wake.setEnabled(stroke>.12);
    actor.wake.position.set(actor.root.position.x,WATER_HEIGHT+.027,actor.root.position.z);
    actor.wake.rotation.y=pose.yaw||0;
    actor.wake.scaling.set(.65+.35*stroke,1,.55+.45*stroke);
   }
   if(actor.animation&&actor.frame!==pose.hopProgress){
    const {from,to}=actor.animation;
    actor.animation.goToFrame(from+(to-from)*pose.hopProgress);
    actor.frame=pose.hopProgress;
   }
  }
  for(const actor of actors.values())if(!actor.visible){actor.root.setEnabled(false);actor.wake?.setEnabled(false);}
 }
 function dispose(){
  for(const actor of actors.values()){
   for(const mesh of actor.owned){
    const index=meshes.indexOf(mesh);
    if(index!==-1)meshes.splice(index,1);
   }
   actor.copy.dispose();
   actor.wake?.dispose();
   for(const material of actor.materials.values())material.dispose(false,false);
   actor.root.dispose();
  }
  for(const asset of sources.values())asset.dispose();
  actors.clear();
  sources.clear();
 }
 return {supports,update,dispose,rootFor:selection=>actors.get(selection.animalId)?.root};
}
