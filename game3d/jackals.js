import {loadModel} from './asset-loading.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
export const JACKAL_MODEL={file:'jackal.glb',stride:.61,muzzle:[0,.4576,.4939]};
export function jackalHeading(c,dx,dz){return Number.isFinite(c.faceX)&&Number.isFinite(c.faceY)?Math.atan2(c.faceX-c.x,c.faceY-c.y):Math.hypot(dx,dz)>.00001?Math.atan2(dx,dz):null;}
// Visuals consume authoritative animals only: no spawn, resource or save mutations.
export async function createJackals(B,scene,shadow,meshes=[],options={}){
 const load=options.loadAsset||(()=>loadModel(B,scene,'assets/art-courtyard/models/',`${JACKAL_MODEL.file}?v=jackal-20261023-1`,scene,undefined,'.glb'));
 const source=await load(JACKAL_MODEL.file),actors=new Map();let disposed=false;
 if(['Idle','Walk','Pull'].some(n=>!source.animationGroups.some(g=>g.name===n))){source.dispose();throw Error('Jackal model missing Idle/Walk/Pull clips');}
 function make(c){
  const prefix=`jackal-${c.id}-`,copy=source.instantiateModelsToScene(n=>prefix+n,false,{doNotInstantiate:true}),root=new B.TransformNode(prefix+'actor',scene),model=new B.TransformNode(prefix+'pose',scene);model.parent=root;for(const n of copy.rootNodes)n.parent=model;
  for(const skeleton of copy.skeletons||[])skeleton.useTextureToStoreBoneMatrices=true;
  root.metadata={animalId:c.id,animalKind:'jackal',gaitPhase:0};const owned=root.getChildMeshes();for(const m of owned){m.metadata={...(m.metadata||{}),animalId:c.id,animalKind:'jackal'};m.receiveShadows=true;meshes.push(m);shadow?.addShadowCaster(m);}
  const groups=new Map();for(const g of copy.animationGroups){g.stop();groups.set(g.name.startsWith(prefix)?g.name.slice(prefix.length):g.name,g);}
  const mouth=root.getDescendants().find(n=>n.name.endsWith('JackalMouthContact'));
  return {root,model,mouth,owned,groups,skeletons:copy.skeletons,lastX:c.x,lastY:c.y,phase:0,clip:null};
 }
 function remove(a){for(const m of a.owned){shadow?.removeShadowCaster(m);const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of a.groups.values())g.dispose();a.root.dispose(false,false);for(const skeleton of a.skeletons||[])skeleton.dispose();}
 function update(state,animals,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));speed=Math.max(0,Number.isFinite(speed)?speed:1);const frozen=paused||!dt||!speed,seen=new Set();
  for(const c of animals){if(c.kind!=='jackal')continue;seen.add(c.id);let a=actors.get(c.id),fresh=!a;if(!a){a=make(c);actors.set(c.id,a);}if(frozen&&!fresh)continue;
   const dx=c.x-a.lastX,dz=c.y-a.lastY,distance=Math.hypot(dx,dz)*6,dead=!!(c.dead||c.behavior==='dead');a.lastX=c.x;a.lastY=c.y;
   a.root.position.set(c.x*6,onBridge(state.buildings||[],c.x,c.y)?.22:surfaceElevation(c.x,c.y,state),c.y*6);
   const yaw=jackalHeading(c,dx,dz);if(yaw!==null&&!dead){const d=Math.atan2(Math.sin(yaw-a.root.rotation.y),Math.cos(yaw-a.root.rotation.y));a.root.rotation.y+=d*(fresh||c.pulling?1:1-Math.exp(-dt*12));}
   const growth=Number.isFinite(c.growth)?Math.max(.3,Math.min(1,c.growth)):1;a.root.scaling.setAll(growth);
   const moving=distance>.00001&&distance<3&&!dead,clip=c.pulling&&!dead?'Pull':moving?'Walk':'Idle',group=a.groups.get(clip);
   if(clip!==a.clip){for(const g of a.groups.values())g.stop();group.start(true,1,group.from,group.to,false);group.pause();a.clip=clip;}
   if(!frozen&&moving)a.phase=((a.phase+(c.pulling?-1:1)*distance/JACKAL_MODEL.stride)%1+1)%1;
   group.goToFrame(group.from+(clip==='Idle'?0:a.phase)*(group.to-group.from));
   const fall=dead?Math.max(0,Math.min(1,c.deathProgress??1)):0;a.model.rotation.z=fall*Math.PI*.5;a.model.position.y=fall*.15;
   Object.assign(a.root.metadata,{gaitPhase:a.phase,clip,dead,pulling:!!c.pulling,bundleId:c.bundleId??null});
  }
  for(const[id,a]of actors)if(!seen.has(id)){remove(a);actors.delete(id);}
 }
 const key=id=>typeof id==='object'?id?.animalId:id;
 function rootFor(id){return actors.get(key(id))?.root;}
 function mouthFor(id){const a=actors.get(key(id));if(!a)return null;a.root.computeWorldMatrix(true);if(a.mouth){a.mouth.computeWorldMatrix(true);return a.mouth.getAbsolutePosition().clone();}return B.Vector3.TransformCoordinates(B.Vector3.FromArray(JACKAL_MODEL.muzzle),a.root.getWorldMatrix());}
 function dispose(){if(disposed)return;disposed=true;for(const a of actors.values())remove(a);actors.clear();source.dispose();}
 return {update,dispose,meshes,rootFor,mouthFor,supports:kind=>!disposed&&kind==='jackal'};
}
