import {loadModel} from './asset-loading.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
export const IMPORTED_FAUNA_MODELS={catWalk:{file:'cat-walk.glb',kind:'cat',clips:['Walk','Idle'],stride:.38},catSit:{file:'cat-sitting.glb',kind:'cat',clips:['Sit'],stride:.38},gazelle:{file:'gazelle-downloaded.glb',kind:'gazelle',clips:['Walk','Idle','Rest'],stride:.84}};
export function importedFaunaAction(animal,distance=0){if(animal.dead||animal.behavior==='dead')return 'Rest';if(animal.kind==='cat'&&['petting','petted','resting','sitting'].includes(animal.behavior))return 'Sit';return distance>.00001&&distance<3?'Walk':animal.kind==='cat'?'Sit':'Idle';}
// The two cat sources have unrelated rigs; their coats use a matched charcoal profile: switch independent skins
// with a short visibility fade; never attempt to retarget one skeleton to the other.
export async function createImportedFauna(B,scene,meshes=[],options={}){
 const sources=new Map(),actors=new Map(),warn=options.warn||console.warn,load=options.loadAsset||(file=>loadModel(B,scene,'assets/art-courtyard/models/',`${file}?v=city-creatures-20261022-1`,scene,undefined,'.glb'));
 const results=await Promise.allSettled(Object.entries(IMPORTED_FAUNA_MODELS).map(async([key,config])=>{const asset=await load(config.file);if(config.clips.some(name=>!asset.animationGroups.some(g=>g.name===name))){asset.dispose();throw Error(`Missing imported fauna clips: ${key}`);}return {key,asset};}));
 for(const r of results)if(r.status==='fulfilled')sources.set(r.value.key,r.value.asset);else warn('Imported fauna model unavailable; procedural fallback remains available.',r.reason);
 let disposed=false;
 const supports=kind=>!disposed&&(kind==='cat'?(sources.has('catWalk')||sources.has('catSit')):kind==='gazelle'&&sources.has('gazelle'));
 function variant(a,key){
  if(a.variants.has(key))return a.variants.get(key);
  const prefix=`fauna-${a.id}-${key}-`,copy=sources.get(key).instantiateModelsToScene(n=>`${prefix}${n}`,false,{doNotInstantiate:true}),root=new B.TransformNode(`${prefix}model`,scene);root.parent=a.model;for(const n of copy.rootNodes)n.parent=root;
  const groups=new Map();for(const g of copy.animationGroups){g.stop();groups.set(g.name.startsWith(prefix)?g.name.slice(prefix.length):g.name,g);}
  const owned=root.getChildMeshes();for(const m of owned){m.receiveShadows=true;m.isPickable=true;m.metadata={...(m.metadata||{}),animalId:a.id,animalKind:a.kind};meshes.push(m);}
  const nodes=[...new Set([...groups.values()].flatMap(g=>g.targetedAnimations.map(a=>a.target)).filter(n=>n?.position&&n?.rotation))];
  const v={root,groups,owned,nodes,skeletons:copy.skeletons,clip:null,clock:0,weight:0,transition:null,transitionTime:0};a.variants.set(key,v);return v;
 }
 function make(c){const root=new B.TransformNode(`fauna-${c.id}`,scene),model=new B.TransformNode(`fauna-${c.id}-pose`,scene);model.parent=root;root.metadata={animalId:c.id,animalKind:c.kind,gaitPhase:0};return {id:c.id,kind:c.kind,root,model,variants:new Map(),lastX:c.x,lastY:c.y,yaw:null,phase:0,key:null};}
 function sample(v,clip,phase,dt,speed,frozen){
  if(!v.groups.has(clip))clip=v.groups.has('Sit')?'Sit':v.groups.has('Idle')?'Idle':'Walk';const g=v.groups.get(clip);
  if(v.clip!==clip){v.transition=v.clip?v.nodes.map(n=>({node:n,p:n.position.clone(),q:n.rotationQuaternion?.clone(),r:n.rotation.clone(),s:n.scaling.clone()})):null;v.transitionTime=0;for(const old of v.groups.values())old.stop();g.start(true,1,g.from,g.to,false);g.pause();v.clip=clip;v.clock=0;}
  if(!frozen&&clip!=='Walk')v.clock+=dt*speed;
  const duration=Math.max(.01,(g.to-g.from)/(g.targetedAnimations[0]?.animation.framePerSecond||30));g.goToFrame(g.from+(clip==='Walk'?phase:frozen?0:(v.clock/duration)%1)*(g.to-g.from));
  if(v.transition&&!frozen){v.transitionTime+=dt*speed;const blend=Math.min(1,v.transitionTime/.3),t=blend*blend*(3-2*blend);for(const from of v.transition){const n=from.node;n.position.copyFrom(B.Vector3.Lerp(from.p,n.position,t));n.scaling.copyFrom(B.Vector3.Lerp(from.s,n.scaling,t));if(n.rotationQuaternion&&from.q)B.Quaternion.SlerpToRef(from.q,n.rotationQuaternion,t,n.rotationQuaternion);else n.rotation.copyFrom(B.Vector3.Lerp(from.r,n.rotation,t));}if(blend===1)v.transition=null;}return clip;
 }
 function remove(a){for(const v of a.variants.values()){for(const m of v.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of v.groups.values())g.dispose();for(const s of v.skeletons||[])s.dispose();}a.root.dispose();}
 function update(state,animals,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));speed=Math.max(0,Number.isFinite(speed)?speed:1);paused=paused||!dt||!speed;const seen=new Set();
  for(const c of animals){if(!supports(c.kind))continue;seen.add(c.id);let a=actors.get(c.id),fresh=!a;if(!a){a=make(c);actors.set(c.id,a);}if(paused&&!fresh)continue;
   const dx=c.x-a.lastX,dz=c.y-a.lastY,distance=Math.hypot(dx,dz)*6,dead=!!(c.dead||c.behavior==='dead');a.lastX=c.x;a.lastY=c.y;a.root.position.set(c.x*6,onBridge(state.buildings,c.x,c.y)?.22:surfaceElevation(c.x,c.y,state),c.y*6);
   let action=importedFaunaAction(c,paused?0:distance),key=c.kind==='gazelle'?'gazelle':action==='Walk'?'catWalk':'catSit';if(!sources.has(key))key=sources.has('catWalk')?'catWalk':'catSit';
   const v=variant(a,key),changed=a.key!==key;for(const other of a.variants.values())other.root.setEnabled(true);if(changed){if(fresh)v.weight=1;a.key=key;}
   if(distance>.00001&&distance<3&&!paused&&!dead)a.yaw=Math.atan2(dx,dz);if(a.yaw!==null&&!dead){const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(fresh?1:1-Math.exp(-dt*10));}
   if(action==='Walk'&&!paused&&!dead)a.phase=(a.phase+distance/IMPORTED_FAUNA_MODELS[key].stride)%1;
   action=sample(v,action,a.phase,dt,speed,paused||dead);
   for(const [variantKey,other]of a.variants){const target=variantKey===key?1:0;if(!paused)other.weight+=Math.sign(target-other.weight)*Math.min(Math.abs(target-other.weight),dt*speed/.35);for(const m of other.owned){m.visibility=other.weight;m.isPickable=other.weight>=.5;}other.root.setEnabled(other.weight>0);}
   const fall=dead?Math.max(0,Math.min(1,c.deathProgress??1)):0;a.model.rotation.z=fall*Math.PI*.5;a.model.position.y=fall*(c.kind==='cat'?.12:.30);a.model.position.x=fall*(c.kind==='cat'?.12:.3);
   Object.assign(a.root.metadata,{gaitPhase:a.phase,clip:action,faunaVariant:key,dead});
  }
  for(const[id,a]of actors)if(!seen.has(id)){remove(a);actors.delete(id);}
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of actors.values())remove(a);actors.clear();for(const source of sources.values())source.dispose();sources.clear();}
 return {update,rootFor:selection=>actors.get(selection?.animalId)?.root,dispose,supports};
}
