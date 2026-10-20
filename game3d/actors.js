import {visibleCitizens} from '../workforce.js';
import {animalsFor} from '../fauna.js';
import {funeralView} from '../funerals.js';
import {residentAppearance} from '../resident-appearance.js';
import {residentPose} from '../actor-art.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {createWildlife} from './wildlife.js';

// These helpers read state only. The renderer never advances workers or writes saves.
export function actorViewCitizens(state){
 const visible=new Map(visibleCitizens(state).map(c=>[c.id,c]));
 const funeral=funeralView(state);
 for(const id of funeral?.mourners||[]){
  const c=visible.get(id)||(state.citizens||[]).find(c=>c.id===id);
  if(c)visible.set(id,{...c,phase:'mourning',walking:true,carrying:false,cargo:{},robe:'#c7c9ae',mourningTorch:!!funeral.torches});
 }
 return [...visible.values()];
}
export function residentVisual(c,state){
 const look=residentAppearance(c,state.buildings||[]);
 return {...look,scale:c.age<16?.55+Math.max(0,Math.min(c.age,15))*.022:1,
  inspired:!!((c.calling&&c.calling!=='auto')||(c.futureRole&&c.futureRole!=='auto')||state.buffs?.inspiration&&['clay','reed'].includes(look.work)),
  mood:c.mood??50,role:c.role||look.work||'resident'};
}
export function actorAnimation(c,distance=0){
 if(c.kind==='sheep')return {clip:distance>.00001?'Walk':['grazing','drinking'].includes(c.behavior)?'Graze':'Idle',pose:c.behavior||'idle'};
 const pose=residentPose(c,null,0).kind;
 return {clip:distance>.00001?'Walk_Loop':'Idle_Loop',pose:['carry','unload','play','dance','elder'].includes(pose)?pose:c.phase==='working'||c.phase==='constructing'?'work':'idle'};
}

/** Licensed articulated GLB actors following the real city. No decorative routes. */
export async function createGameActors(B,scene,materials){
 const meshes=[],people=new Map(),sheep=new Map(),ownedMaterials=[];
 let disposed=false,poseTime=0,bier=null;
 const containers=[];
 try{
  // Keep source containers outside the scene: only their independent clones render.
  const loaded=await Promise.allSettled(['resident','sheep'].map(name=>B.SceneLoader.LoadAssetContainerAsync('assets/art-courtyard/models/',`${name}.glb`,scene,undefined,'.glb')));
  for(const r of loaded)if(r.status==='fulfilled')containers.push(r.value);
  const failed=loaded.find(r=>r.status==='rejected');if(failed)throw failed.reason;
 }catch(error){for(const c of containers)c.dispose();throw error;}
 const [residentSource,sheepSource]=containers;
 const wildlife=createWildlife(B,scene,meshes);
 const vec=(x=0,y=0,z=0)=>new B.Vector3(x,y,z);
 function mat(name,color){const m=new B.PBRMaterial(`game-actor-${name}`,scene);m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();m.roughness=.94;ownedMaterials.push(m);return m;}
 const wood=materials.wood||mat('wood','#82603e'),clay=materials.terracotta||mat('clay','#ad7051'),reed=materials.reed||mat('reed','#baa577'),linen=materials.linen||mat('linen','#d6c3a0'),stone=mat('stone','#b7ac92'),dark=mat('dark','#433a2e'),gold=mat('inspiration','#dfb952');
 gold.emissiveColor=B.Color3.FromHexString('#77541c').toLinearSpace();
 function register(root){for(const m of root.getChildMeshes()){m.receiveShadows=true;m.isPickable=true;if(!meshes.includes(m))meshes.push(m);}}
 function prune(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}}
 function box(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 function sphere(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene);mesh.scaling.set(sx,sy,sz);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 function remove(a){prune(a.root);for(const g of a.groups?.values()||[])g.dispose();a.root.dispose();for(const s of a.skeletons||[])s.dispose();for(const m of a.materials||[])m.dispose();}
 function instantiate(source,name,metadata){
  const copy=source.instantiateModelsToScene(n=>`${name}-${n}`,false,{doNotInstantiate:true});
  const root=new B.TransformNode(name,scene),model=new B.TransformNode(`${name}-model`,scene);model.parent=root;root.metadata=metadata;
  for(const n of copy.rootNodes)n.parent=model;
  const groups=new Map();for(const g of copy.animationGroups){g.stop();const key=g.name.startsWith(`${name}-`)?g.name.slice(name.length+1):g.name;groups.set(key,g);}
  // GLBs use metres; ground their authored soles before applying child size.
  model.computeWorldMatrix(true);for(const m of model.getChildMeshes())m.computeWorldMatrix(true);
  const bounds=model.getHierarchyBoundingVectors(true),height=bounds.max.y-bounds.min.y;
  const unit=metadata.citizenId!==undefined&&height>0?1.7/height:1;
  model.scaling.setAll(unit);model.position.y=-bounds.min.y*unit;
  register(root);
  const a={root,model,groups,skeletons:copy.skeletons,materials:[],lastX:null,lastY:null,yaw:null,clip:null,cargoKey:null,pose:'idle',time:0,paused:false};
  // Clone only garments; skin/hair and textures remain shared and are never recolored.
  if(metadata.citizenId!==undefined){
   const cloned=new Map();a.cloth=[];
   for(const m of model.getChildMeshes())if(m.material&&/undyed|wool|cloth/i.test(m.material.name)){
    let cloth=cloned.get(m.material);if(!cloth){cloth=m.material.clone(`citizen-cloth-${metadata.citizenId}-${cloned.size}`);cloned.set(m.material,cloth);a.materials.push(cloth);a.cloth.push(cloth);}m.material=cloth;
   }
   a.load=new B.TransformNode(`${name}-carried`,scene);a.load.parent=root;a.load.position.set(0,1,.37);
   a.details=new B.TransformNode(`${name}-details`,scene);a.details.parent=root;
   a.tool=new B.TransformNode(`${name}-tool`,scene);a.tool.parent=root;a.tool.position.set(.32,.8,.35);
   box(`${name}-tool-handle`,a.tool,wood,0,0,0,.035,.62,.035);box(`${name}-tool-blade`,a.tool,stone,.07,-.27,0,.18,.055,.055);a.tool.setEnabled(false);
   a.inspired=sphere(`${name}-inspired`,root,gold,0,1.85,0,.10,.10,.10);a.inspired.setEnabled(false);
   a.armNodes=[];
   for(const n of model.getChildTransformNodes())if(/(?:upperarm|lowerarm)_[lr]$/.test(n.name))a.armNodes.push({node:n,base:n.rotationQuaternion?.clone()||B.Quaternion.FromEulerVector(n.rotation),last:null});
  }
  return a;
 }
 function cargo(a,c){
  const goods=c.carrying?Object.entries(c.cargo||{}).filter(([,n])=>n>0):[],key=goods.map(([k,n])=>`${k}:${n}`).sort().join('|');
  if(a.cargoKey===key)return;a.cargoKey=key;prune(a.load);for(const m of a.load.getChildMeshes())m.dispose();
  const k=goods[0]?.[0];if(!k)return;
  if(['water','beer','pottery','oil'].includes(k)){sphere('cargo-vessel',a.load,clay,0,0,0,.32,.36,.32);sphere('cargo-neck',a.load,clay,0,.19,0,.14,.12,.14);}
  else if(['wood','reed'].includes(k))for(let i=0;i<4;i++)box('cargo-bundle',a.load,k==='wood'?wood:reed,0,i*.055-.08,0,.58,.045,.065);
  else if(['clay','brick','firedBrick','stone'].includes(k))for(let i=0;i<3;i++)box('cargo-material',a.load,k==='stone'?stone:clay,(i%2-.5)*.15,Math.floor(i/2)*.1,0,.145,.09,.23);
  else sphere('cargo-sack',a.load,['cloth','clothing','wool'].includes(k)?linen:reed,0,0,0,.39,.31,.30);
 }
 function appearance(a,c,state){
  const look=residentVisual(c,state),scale=look.scale;a.root.scaling.setAll(scale);a.look=look;
  for(const m of a.model.getChildMeshes())if(/beard/i.test(m.name))m.isVisible=c.age>=16&&c.sex!=='f';
  const color=c.phase==='mourning'?'#c7c9ae':look.robe;
  for(const m of a.cloth)m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  a.inspired.setEnabled(look.inspired);
  const key=`${look.wear}:${look.craft}:${c.role}:${c.siteDuty}:${c.guarding}`;
  if(a.detailKey!==key){a.detailKey=key;prune(a.details);for(const n of a.details.getChildren())n.dispose();a.torchNode=null;a.torch=false;
   for(let i=0;i<look.patches;i++)box('clothing-patch',a.details,i?linen:dark,(i?.12:-.12),i?.65:.9,.19,.13,.12,.015);
   if(c.role==='builder'||c.siteDuty==='builder'){box('builder-tool-handle',a.details,wood,.24,.79,.04,.035,.24,.035);box('builder-tool-blade',a.details,stone,.24,.65,.04,.10,.11,.025);}
   if(c.role==='carrier'||c.siteDuty==='carrier')box('carrier-sling',a.details,reed,-.23,.87,.04,.17,.19,.12);
   if(c.role==='healer')box('healer-satchel',a.details,reed,.23,.92,.02,.18,.22,.12);
   if(look.craft==='weaver'||look.craft==='tailor')sphere('craft-thread',a.details,linen,-.24,.90,.12,.12,.16,.12);
   if(c.guarding)box('guard-staff',a.details,wood,.35,.83,.04,.035,1.6,.035);
  }
  const torch=!!c.mourningTorch;
  if(a.torch!==torch){a.torch=torch;if(a.torchNode){prune(a.torchNode);a.torchNode.dispose();a.torchNode=null;}if(torch){a.torchNode=new B.TransformNode('mourning-torch',scene);a.torchNode.parent=a.details;box('torch-staff',a.torchNode,wood,.32,1.12,.18,.04,.65,.04);sphere('torch-flame',a.torchNode,gold,.32,1.48,.18,.10,.18,.10);}}
  cargo(a,c);
 }
 function animate(a,c,state,dt,paused,speed){
  const dx=a.lastX===null?0:c.x-a.lastX,dz=a.lastY===null?0:c.y-a.lastY,distance=Math.hypot(dx,dz)*6;
  a.root.position.set(c.x*6,onBridge(state.buildings,c.x,c.y)?.22:surfaceElevation(c.x,c.y,state),c.y*6);
  if(distance>.00001&&!paused){a.yaw=Math.atan2(dx,dz);const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
  else if(a.yaw!==null&&!paused){const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
  a.lastX=c.x;a.lastY=c.y;
  const decision=actorAnimation(c,distance<3?distance:0);
  // Changing UI modes on pause must not restart clips or alter their sampled pose.
  if(!paused||!a.clip){a.pose=decision.pose;a.c=c;if(a.clip!==decision.clip){for(const g of a.groups.values())g.stop();const g=a.groups.get(decision.clip);if(!g)throw Error(`Missing actor animation: ${decision.clip}`);g.start(true,1,g.from,g.to,false);a.clip=decision.clip;}}
  a.paused=paused;
  for(const [name,g]of a.groups)g.speedRatio=paused?0:speed*(name==='Walk_Loop'?(c.playing?1.35:c.age>=55?.7:.9):1);
  if(!paused){a.time=poseTime+(Number(c.id)||0)*.7;if(a.look){const beat=Math.sin(a.time*3.5),work=a.pose==='work';a.model.rotation.x=(c.age>=55?.06:0)+(a.look.mood<25?.045:0)+(work?.08:0);a.model.rotation.z=a.pose==='dance'?beat*.055:0;
   a.tool.setEnabled(work&&!c.carrying&&(c.role==='builder'||c.siteDuty==='builder'||c.phase==='constructing'||['field','garden','reed','wood','stone','clay','pottery','brewery','brickyard'].includes(a.look.work)));
   a.inspired.position.y=1.85+Math.sin(a.time*2.3)*.045;a.inspired.scaling.setAll(1+Math.sin(a.time*2.3)*.10);a.tool.rotation.x=work?beat*.25:0;
   // Play and dance bounce is a presentation pose at the resident's exact route position.
   a.model.position.y=a.footOffset+(a.pose==='play'||a.pose==='dance'?Math.abs(beat)*.04:0);
  }}
 }
 // Animation clips set the skeletal base, then apply small task-specific arm gestures.
 const observer=scene.onAfterAnimationsObservable.add(()=>{
  for(const a of people.values()){
   if(!a.root.isEnabled())continue;
   if(a.paused){for(const arm of a.armNodes)if(arm.last)arm.node.rotationQuaternion=arm.last.clone();continue;}
   const carry=['carry','unload'].includes(a.pose),work=a.pose==='work',play=['play','dance'].includes(a.pose);
   for(const arm of a.armNodes){const n=arm.node;
    // Nodes omitted by a source clip use a stable authored rest transform.
    const animated=a.groups.get(a.clip)?.targetedAnimations.some(t=>t.target===n);
    const base=animated?n.rotationQuaternion:arm.base;
    if(!base)continue;
    const upper=/upperarm/.test(n.name),side=/_l$/.test(n.name)?1:-1;
    const angle=carry?(upper?-.58:-.72):work?(upper?-.35+Math.sin(a.time*3.5+side)*.16:-.45):play?(upper?Math.sin(a.time*3.5+side)*.4:0):0;
    n.rotationQuaternion=angle?base.multiply(B.Quaternion.RotationAxis(B.Axis.X,angle)):base.clone();arm.last=n.rotationQuaternion.clone();
   }
  }
 });
 function funeralProps(state){
  const f=funeralView(state);
  if(f?.coffin){if(!bier){const root=new B.TransformNode('funeral-bier',scene);box('bier-cloth',root,linen,0,.58,0,.7,.22,1.8);for(const x of [-.35,.35])box('bier-pole',root,wood,x,.42,0,.045,.045,2.5);bier={root};}bier.root.position.set(f.coffin.x*6,surfaceElevation(f.coffin.x,f.coffin.y,state),f.coffin.y*6);}
  else if(bier){remove(bier);bier=null;}

 }
 function update(state,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,Number.isFinite(dt)?dt:0));speed=Math.max(0,Number.isFinite(speed)?speed:1);paused=paused||dt===0||speed===0;
  if(!paused)poseTime+=dt*speed;
  const visible=actorViewCitizens(state),seen=new Set();
  for(const c of visible){seen.add(c.id);let a=people.get(c.id);if(!a){a=instantiate(residentSource,`citizen-${c.id}`,{citizenId:c.id});a.footOffset=a.model.position.y;people.set(c.id,a);}a.root.setEnabled(true);appearance(a,c,state);animate(a,c,state,dt,paused,speed);}
  const living=new Set((state.citizens||[]).map(c=>c.id));for(const [id,a]of people)if(!living.has(id)){remove(a);people.delete(id);}else if(!seen.has(id)){a.root.setEnabled(false);for(const g of a.groups.values())g.speedRatio=0;}
  const fauna=animalsFor(state),animals=fauna.filter(c=>c.kind==='sheep'),seenSheep=new Set();for(const c of animals){seenSheep.add(c.id);let a=sheep.get(c.id);if(!a){a=instantiate(sheepSource,c.id,{animalId:c.id,animalKind:'sheep'});sheep.set(c.id,a);}animate(a,c,state,dt,paused,speed);}
  for(const [id,a]of sheep)if(!seenSheep.has(id)){remove(a);sheep.delete(id);}
  wildlife.update(state,[...fauna.filter(c=>c.kind!=='sheep'),...(funeralView(state)?.jackals||[])],dt,{paused,speed});funeralProps(state);
 }
 function dispose(){if(disposed)return;disposed=true;scene.onAfterAnimationsObservable.remove(observer);for(const a of people.values())remove(a);for(const a of sheep.values())remove(a);if(bier)remove(bier);people.clear();sheep.clear();wildlife.dispose();for(const c of containers)c.dispose();for(const m of ownedMaterials)m.dispose();meshes.length=0;}
 return {update,dispose,meshes,rootFor(selection){return selection.citizenId!==undefined?people.get(selection.citizenId)?.root:sheep.get(selection.animalId)?.root||wildlife.rootFor(selection);}};
}
