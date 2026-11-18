import {groundHeading} from './ground-turn.js';
import {loadModel} from './asset-loading.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
export const GOAT_MODELS={pasture:{file:'pasture-goat.glb',stride:.410},authored:{file:'goat-authored-lod.glb',stride:.34},downloaded:{file:'goat-downloaded.glb',stride:.30}};
function goatSeed(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
export function goatVariant(id){return goatSeed(id)%2?'authored':'downloaded';}
export function goatAction(c,distance=0){if(c.dead||c.behavior==='dead')return 'Rest';if(c.walking!==false&&distance<3&&(c.walking||distance>.00001))return 'Walk';return ['grazing','drinking'].includes(c.behavior)?'Graze':c.behavior==='resting'?'Rest':'Idle';}
// Asset containers are loaded once; each animal owns its skeleton and clips,
// while material/geometry resources stay shared. No saved fields are added.
export async function createGameGoats(B,scene,meshes=[],options={}){
 const sources=new Map(),actors=new Map(),warn=options.warn||console.warn;
 const load=options.loadAsset||(file=>loadModel(B,scene,'assets/art-courtyard/models/',file,scene,undefined,'.glb'));
 async function loadVariant(variant){
  try{
   const asset=await load(GOAT_MODELS[variant].file);
   const names=new Set(asset.animationGroups.map(group=>group.name));
   const missing=['Idle','Walk','Graze','Rest'].filter(name=>!names.has(name));
   if(missing.length){asset.dispose();throw Error(`${variant}: missing clips ${missing.join(', ')}`);}
   sources.set(variant,asset);
  }catch(error){warn('Goat model unavailable; using another available model.',error);}
 }
 const variants=options.variants||['authored','downloaded'];
 await Promise.all(variants.map(loadVariant));
 if(!sources.size&&options.fallbackVariant&&!variants.includes(options.fallbackVariant))await loadVariant(options.fallbackVariant);
 if(!sources.size)throw Error('No goat model could be loaded');let disposed=false;
 function make(c){const requested=goatVariant(c.id),variant=sources.has(requested)?requested:sources.keys().next().value,source=sources.get(variant),copy=source.instantiateModelsToScene(n=>`goat-${c.id}-${n}`,false,{doNotInstantiate:true});
  const root=new B.TransformNode(`goat-${c.id}`,scene),model=new B.TransformNode(`goat-${c.id}-model`,scene);model.parent=root;root.metadata={...c.decorative?{decorativeId:c.id}:{animalId:c.id},animalKind:'goat',goatVariant:variant,gaitPhase:0};for(const n of copy.rootNodes)n.parent=model;root.scaling.setAll(c.growth||1);
  const identity=goatSeed(c.id),gaitOffset=(identity%997)/997,heading=(Math.imul(identity,2654435761)>>>0)/4294967296*Math.PI*2;
  root.rotation.y=heading;
  const groups=new Map();for(const g of copy.animationGroups){g.stop();const name=g.name.startsWith(`goat-${c.id}-`)?g.name.slice(`goat-${c.id}-`.length):g.name;groups.set(name,g);}
  const owned=root.getChildMeshes();for(const m of owned){m.receiveShadows=true;m.isPickable=!c.decorative;meshes.push(m);}
  const nodes=[...new Set([...groups.values()].flatMap(g=>g.targetedAnimations.map(a=>a.target)).filter(n=>n?.position&&n?.rotation))];
  // The pasture walk is calibrated from hoof travel in the model's native metres.
  const stride=GOAT_MODELS[variant].stride*(variant==='pasture'?root.scaling.y:1);
  return {root,model,owned,nodes,groups,skeletons:copy.skeletons,variant,stride,lastX:c.x,lastY:c.y,phase:gaitOffset,clock:0,idleOffset:gaitOffset,clip:null,transition:null,transitionTime:0};
 }
 function snapshot(a){return a.nodes.map(n=>({node:n,p:n.position.clone(),q:n.rotationQuaternion?.clone(),r:n.rotation.clone(),s:n.scaling.clone()}));}
 function play(a,clip){const g=a.groups.get(clip);if(!g)throw Error(`Missing goat animation: ${a.variant}/${clip}`);a.transition=a.clip?snapshot(a):null;a.transitionTime=0;for(const old of a.groups.values())old.stop();g.start(true,1,g.from,g.to,false);g.pause();a.clip=clip;a.clock=0;return g;}
 function remove(a){for(const m of a.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of a.groups.values())g.dispose();a.root.dispose();for(const skeleton of a.skeletons||[])skeleton.dispose();}
 function update(state,animals,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));speed=Math.max(0,Number.isFinite(speed)?speed:1);paused=paused||!dt||!speed;const seen=new Set();
  for(const c of animals){if(c.kind!=='goat')continue;seen.add(c.id);let a=actors.get(c.id),fresh=!a;if(!a){a=make(c);actors.set(c.id,a);}if(paused&&!fresh)continue;
   const dx=c.x-a.lastX,dz=c.y-a.lastY,distance=Math.hypot(dx,dz)*6;a.lastX=c.x;a.lastY=c.y;a.root.position.set(c.x*6,onBridge(state.buildings,c.x,c.y,state)?.22:surfaceElevation(c.x,c.y,state),c.y*6);
   if(distance>.00001&&distance<3&&!paused&&!c.dead&&c.behavior!=='dead'){
    a.root.rotation.y=groundHeading(a.root.rotation.y,Math.atan2(dx,dz),distance,.32*a.root.scaling.y);
   }
   const dead=!!(c.dead||c.behavior==='dead'),clip=goatAction(c,distance),g=clip!==a.clip?play(a,clip):a.groups.get(clip);
   if(!paused&&!dead){if(clip==='Walk'){if(distance<3)a.phase=(a.phase+distance/a.stride)%1;}else a.clock+=dt*speed;}
   const duration=Math.max(.01,(g.to-g.from)/(g.targetedAnimations[0]?.animation.framePerSecond||30)),phase=dead?0:clip==='Walk'?a.phase:(a.idleOffset+a.clock/duration)%1;g.goToFrame(g.from+phase*(g.to-g.from));
   if(a.transition){a.transitionTime+=paused?0:dt*speed;const blend=Math.min(1,a.transitionTime/(clip==='Rest'||clip==='Graze'?.65:.25)),t=blend*blend*(3-2*blend);for(const from of a.transition){const n=from.node;n.position.copyFrom(B.Vector3.Lerp(from.p,n.position,t));n.scaling.copyFrom(B.Vector3.Lerp(from.s,n.scaling,t));if(n.rotationQuaternion&&from.q)B.Quaternion.SlerpToRef(from.q,n.rotationQuaternion,t,n.rotationQuaternion);else n.rotation.copyFrom(B.Vector3.Lerp(from.r,n.rotation,t));}if(blend===1)a.transition=null;}
   const fall=dead?Math.max(0,Math.min(1,c.deathProgress??1)):0;a.model.rotation.z=fall*Math.PI*.5;a.model.position.y=fall*.235;a.model.position.x=fall*(a.variant==='authored'?.22:.65);
   a.root.metadata.gaitPhase=a.phase;a.root.metadata.clip=clip;a.root.metadata.dead=dead;
  }
  for(const[id,a]of actors)if(!seen.has(id)){remove(a);actors.delete(id);}
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of actors.values())remove(a);actors.clear();for(const source of sources.values())source.dispose();sources.clear();}
 return {update,dispose,sourceForHerd:(variant='downloaded')=>sources.get(variant),rootFor:selection=>actors.get(selection.animalId)?.root};
}
