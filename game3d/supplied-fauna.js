import {loadModel} from './asset-loading.js';
import {WATER_HEIGHT} from './water.js';
import {surfaceElevation} from '../district3d/terrain.js';

const models={
 'common-quail':{file:'supplied-common-quail.glb',height:.20,yaw:0},
 'savigny-tree-frog':{file:'supplied-frog-jump.glb',height:.07,yaw:0,clip:'metarig|jumpInPlace'},
 'white-pelican':{file:'supplied-pelican-wasis.glb',height:1.42,yaw:0,waterline:.56}
};

const fishModels={
 'yellowfin-goby':{file:'supplied-yellowfin-goby.glb',length:.32,yaw:0},
 'oriental-goby':{file:'supplied-oriental-goby.glb',length:.48,yaw:0}
};
export const fishPreviewEnabled=search=>new URLSearchParams(search).get('fish-preview')==='1';
const modelKey=pose=>pose.kind==='fish'?fishVariant(pose):pose.kind;
function fishVariant(pose){
 const index=Number(pose.id.split(':').at(-1));
 return index%2?'oriental-goby':'yellowfin-goby';
}

export async function createSuppliedFauna(B,scene,meshes,{fishPreview=false}={}){
 const sources=new Map();
 const actors=new Map();
 await Promise.all(Object.entries(fishPreview?{...models,...fishModels}:models).map(async ([kind,model])=>{
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
 const supports=pose=>sources.has(modelKey(pose))&&(pose.kind!=='white-pelican'||pose.behavior==='swimming');
 function create(pose){
  const key=modelKey(pose),model=models[key]||fishModels[key];
  const fish=pose.kind==='fish';
  const root=new B.TransformNode('supplied-'+pose.id,scene);
  if(fish)root.metadata={animalKind:pose.kind,animalId:pose.id,fishModel:key};
  const pivot=new B.TransformNode(root.name+'-pivot',scene);
  pivot.parent=root;
  const copy=sources.get(key).instantiateModelsToScene(undefined,false,{doNotInstantiate:!!model.clip});
  for(const node of copy.rootNodes)node.parent=pivot;
  const {min,max}=pivot.getHierarchyBoundingVectors(true);
  const scale=fish?model.length/Math.max(max.x-min.x,max.z-min.z):model.height/(max.y-min.y);
  pivot.scaling.setAll(scale);
  pivot.position.set(-(min.x+max.x)*scale/2,fish?-(min.y+max.y)*scale/2:-min.y*scale-(model.waterline||0),-(min.z+max.z)*scale/2);
  const owned=pivot.getChildMeshes();
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
  return {root,copy,owned,animation,frame:null,lastX:pose.x,lastY:pose.y,yaw:0};
 }
 function update(state,poses,fish=[]){
  for(const actor of actors.values())actor.visible=false;
  for(const pose of fishPreview?[...poses,...fish]:poses){
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
    if(Math.hypot(dx,dz)>1e-6){
     const yaw=Math.atan2(dx,dz),delta=yaw-actor.yaw;
     actor.yaw+=Math.atan2(Math.sin(delta),Math.cos(delta))*.35;
    }
    actor.lastX=pose.x;
    actor.lastY=pose.y;
    const phase=(state.simTime||0)*5+pose.id.length;
    const depth=Math.min(WATER_HEIGHT-.32,(pose.waterLevel??WATER_HEIGHT)-(pose.swimDepth??.28));
    actor.root.position.set(pose.x*6,depth+Math.sin(phase*.4)*.018,pose.y*6);
    actor.root.rotation.set(0,actor.yaw+fishModels[modelKey(pose)].yaw+Math.sin(phase)*.09,Math.sin(phase*.75)*.035);
    continue;
   }
   const terrain=pose.kind==='savigny-tree-frog'||pose.elevation===undefined;
   const elevation=terrain?surfaceElevation(pose.x,pose.y,state):pose.elevation;
   actor.root.position.set(pose.x*6,elevation+(pose.kind==='savigny-tree-frog'?.018:0),pose.y*6);
   actor.root.rotation.y=(pose.yaw||0)+models[pose.kind].yaw;
   actor.root.rotation.x=pose.kind==='white-pelican'?Math.sin((state.simTime||0)*1.7)*.028:0;
   if(actor.animation&&actor.frame!==pose.hopProgress){
    const {from,to}=actor.animation;
    actor.animation.goToFrame(from+(to-from)*pose.hopProgress);
    actor.frame=pose.hopProgress;
   }
  }
  for(const actor of actors.values())if(!actor.visible)actor.root.setEnabled(false);
 }
 function dispose(){
  for(const actor of actors.values()){
   for(const mesh of actor.owned){
    const index=meshes.indexOf(mesh);
    if(index!==-1)meshes.splice(index,1);
   }
   actor.copy.dispose();
   actor.root.dispose();
  }
  for(const asset of sources.values())asset.dispose();
  actors.clear();
  sources.clear();
 }
 return {supports,update,dispose,rootFor:selection=>actors.get(selection.animalId)?.root};
}
