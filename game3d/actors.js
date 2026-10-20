import {visibleCitizens} from '../workforce.js';
import {animalsFor} from '../fauna.js';
import {funeralView} from '../funerals.js';
import {residentAppearance} from '../resident-appearance.js';
import {residentPose} from '../actor-art.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {actorWorkActivity} from '../labor-life.js';
import {catPettingPairs} from '../pests.js';
import {createWildlife} from './wildlife.js';
import {residentMotion,residentViewPositions} from './resident-motion.js';
export {residentMotion,residentViewPositions} from './resident-motion.js';

// These helpers read state only. The renderer never advances workers or writes saves.
export function actorViewFrame(state){
 const residents=visibleCitizens(state),byId=new Map(residents.map(c=>[c.id,c]));
 // Pair once, using the actual rendered child-play positions and walking flags.
 // A hand must be able to reach the cat; the general neighbourhood test is wider.
 const pettingPairs=catPettingPairs(state,residents).filter(p=>{const c=byId.get(p.citizenId),scale=c.age<16?.55+Math.max(0,Math.min(c.age,15))*.022:1;return Math.hypot(c.x-p.x,c.y-p.y)<=.16*scale;});
 const visible=new Map(residents.map(c=>[c.id,{...c,activity:actorWorkActivity(state,c,pettingPairs)}]));
 const funeral=funeralView(state);
 for(const id of funeral?.mourners||[]){
  const c=visible.get(id)||(state.citizens||[]).find(c=>c.id===id);
  if(c)visible.set(id,{...c,activity:null,phase:'mourning',walking:true,carrying:false,cargo:{},robe:'#c7c9ae',mourningTorch:!!funeral.torches});
 }
 return {citizens:[...visible.values()],pettingPairs};
}
export function actorViewCitizens(state){return actorViewFrame(state).citizens;}
export function residentVisual(c,state){
 const look=residentAppearance(c,state.buildings||[]);
 return {...look,scale:c.age<16?.55+Math.max(0,Math.min(c.age,15))*.022:1,
  inspired:!!((c.calling&&c.calling!=='auto')||(c.futureRole&&c.futureRole!=='auto')||state.buffs?.inspiration&&['clay','reed'].includes(look.work)),
  motion:residentMotion(c.id),mood:c.mood??50,role:c.role||look.work||'resident'};
}
export function actorAnimation(c,distance=0){
 if(c.kind==='sheep')return {clip:distance>.00001?'Walk':['grazing','drinking'].includes(c.behavior)?'Graze':'Idle',pose:c.behavior||'idle'};
 const pose=residentPose(c,null,0).kind;
 return {clip:distance>.00001?'Walk_Loop':'Idle_Loop',pose:c.activity&&!c.carrying?(!c.activity.stage||['working','strike'].includes(c.activity.stage)?c.activity.kind:'idle'):['carry','unload','play','dance','elder'].includes(pose)?pose:c.phase==='working'||c.phase==='constructing'?'work':'idle'};
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
 const wood=materials.wood||mat('wood','#82603e'),clay=materials.terracotta||mat('clay','#ad7051'),reed=materials.reed||mat('reed','#baa577'),linen=materials.linen||mat('linen','#d6c3a0'),fishSkin=mat('fish','#829e91'),copper=mat('copper','#a5754c'),stone=mat('stone','#b7ac92'),dark=mat('dark','#433a2e'),gold=mat('inspiration','#dfb952');
 gold.emissiveColor=B.Color3.FromHexString('#77541c').toLinearSpace();
 function register(root){for(const m of root.getChildMeshes()){m.receiveShadows=true;m.isPickable=true;if(!meshes.includes(m))meshes.push(m);}}
 function prune(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}}
 function box(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateBox(name,{width:sx,height:sy,depth:sz},scene);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 function sphere(name,parent,material,x,y,z,sx,sy,sz){const mesh=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:8},scene);mesh.scaling.set(sx,sy,sz);mesh.parent=parent;mesh.position.set(x,y,z);mesh.material=material;mesh.isPickable=true;mesh.receiveShadows=true;meshes.push(mesh);return mesh;}
 function remove(a){if(a.fishingLine){const i=meshes.indexOf(a.fishingLine);if(i>=0)meshes.splice(i,1);a.fishingLine.dispose();}prune(a.root);for(const g of a.groups?.values()||[])g.dispose();a.root.dispose();for(const s of a.skeletons||[])s.dispose();for(const m of a.materials||[])m.dispose();}
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
   a.tool=new B.TransformNode(`${name}-tool`,scene);a.tool.parent=root;a.tool.setEnabled(false);a.toolKind=null;
   a.inspired=sphere(`${name}-inspired`,root,gold,0,1.85,0,.10,.10,.10);a.inspired.setEnabled(false);
   const nodes=model.getChildTransformNodes();a.hands={};a.arms={};
   for(const side of ['l','r']){a.hands[side]=nodes.find(n=>n.name.endsWith(`-hand_${side}`));a.arms[side]={upper:nodes.find(n=>n.name.endsWith(`-upperarm_${side}`)),lower:nodes.find(n=>n.name.endsWith(`-lowerarm_${side}`))};}
   if(a.hands.r){a.tool.parent=a.hands.r;a.tool.position.set(0,.045,0);}
   a.armNodes=[];
   for(const n of model.getChildTransformNodes())if(/(?:upperarm|lowerarm)_[lr]$/.test(n.name))a.armNodes.push({node:n,base:n.rotationQuaternion?.clone()||B.Quaternion.FromEulerVector(n.rotation),last:null});
  }
  return a;
 }
 // Solve the authored y-axis upper/lower arm bones toward a palm target in world space.
 // This uses the real glTF joints, keeping skin, hands and attached tools connected.
 function poseArm(a,side,local){
  const {upper,lower}=a.arms[side],hand=a.hands[side];if(!upper||!lower||!hand)return;
  a.root.computeWorldMatrix(true);upper.computeWorldMatrix(true);lower.computeWorldMatrix(true);hand.computeWorldMatrix(true);
  const shoulder=upper.getAbsolutePosition(),elbow=lower.getAbsolutePosition(),palm=hand.getAbsolutePosition();
  const l1=B.Vector3.Distance(shoulder,elbow),l2=B.Vector3.Distance(elbow,palm),goal=B.Vector3.TransformCoordinates(local,a.root.getWorldMatrix());
  const ray=goal.subtract(shoulder),length=Math.max(.001,Math.min(ray.length(),l1+l2-.005)),direction=ray.normalize();
  const along=(l1*l1-l2*l2+length*length)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));
  let bend=B.Vector3.TransformNormal(vec(side==='l'?-1:1,-.7,-.35),a.root.getWorldMatrix());bend=bend.subtract(direction.scale(B.Vector3.Dot(bend,direction))).normalize();
  const joint=shoulder.add(direction.scale(along)).add(bend.scale(height));
  const aim=(node,end)=>{node.parent.computeWorldMatrix(true);const origin=node.getAbsolutePosition(),inverse=node.parent.getWorldMatrix().clone().invert();
   const vector=B.Vector3.TransformNormal(end.subtract(origin),inverse).normalize();node.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,vector,new B.Quaternion());node.computeWorldMatrix(true);};
  aim(upper,joint);lower.computeWorldMatrix(true);aim(lower,shoulder.add(direction.scale(length)));
 }
 function aimForward(node,end){
  node.computeWorldMatrix(true);const inverse=node.parent.getWorldMatrix().clone().invert(),origin=node.getAbsolutePosition();
  const z=B.Vector3.TransformNormal(end.subtract(origin),inverse).normalize(),up=B.Vector3.TransformNormal(vec(0,1,0),inverse).normalize(),x=B.Vector3.Cross(up,z).normalize(),y=B.Vector3.Cross(z,x).normalize();
  node.rotationQuaternion=B.Quaternion.FromRotationMatrix(B.Matrix.FromValues(x.x,x.y,x.z,0,y.x,y.y,y.z,0,z.x,z.y,z.z,0,0,0,0,1));node.computeWorldMatrix(true);
 }
 function workerTool(a,kind){
  if(a.toolKind===kind){a.tool.setEnabled(!!kind);return;}
  a.toolKind=kind;const grip=kind==='hunting'?a.hands.l:a.hands.r;if(grip){a.tool.parent=grip;a.tool.position.set(0,.045,0);a.tool.rotationQuaternion=B.Quaternion.Identity();}prune(a.tool);for(const n of a.tool.getChildren())n.dispose();
  if(a.fishingLine){const i=meshes.indexOf(a.fishingLine);if(i>=0)meshes.splice(i,1);a.fishingLine.dispose();a.fishingLine=null;}
  if(a.shotArrow){prune(a.shotArrow);a.shotArrow.dispose();a.shotArrow=null;}
  a.tool.setEnabled(!!kind);if(!kind)return;
  // Every implement shares its grip origin with the GLB palm. No detached tools.
  if(kind==='hunting'){
   const arc=[];for(let i=0;i<=10;i++){const t=i/10*Math.PI;arc.push(vec(Math.sin(t)*.20,Math.cos(t)*.48,0));}
   const bow=B.MeshBuilder.CreateTube('hunter-bow',{path:arc,radius:.017,tessellation:6},scene);bow.parent=a.tool;bow.material=wood;meshes.push(bow);
   const string=B.MeshBuilder.CreateLines('bow-string',{points:[arc[0],vec(0,0,0),arc[10]]},scene);string.parent=a.tool;string.color=B.Color3.FromHexString('#d7c9a6');meshes.push(string);
   a.nockedArrow=[box('hunter-arrow',a.tool,reed,0,0,.29,.015,.015,.75),box('hunter-arrowhead',a.tool,stone,0,0,.67,.04,.015,.07)];
   a.shotArrow=new B.TransformNode('hunter-shot',scene);a.shotArrow.parent=a.root;
   box('hunter-flight-shaft',a.shotArrow,reed,0,0,0,.018,.018,.70);box('hunter-flight-tip',a.shotArrow,stone,0,0,.37,.045,.025,.09);box('hunter-flight-feather',a.shotArrow,linen,0,0,-.28,.09,.018,.11);a.shotArrow.setEnabled(false);
  }else if(kind==='fishing'){
   const rod=box('fishing-rod',a.tool,reed,0,.59,0,.026,1.45,.026);rod.rotation.x=.4;
   a.rodTip=new B.TransformNode('fishing-rod-tip',scene);a.rodTip.parent=rod;a.rodTip.position.y=.725;
   a.fishingLine=B.MeshBuilder.CreateLines('fishing-line',{points:[vec(),vec(0,-1,0)],updatable:true},scene);a.fishingLine.color=B.Color3.FromHexString('#d7c9a6');a.fishingLine.metadata=a.root.metadata;meshes.push(a.fishingLine);
  }else{
   box('worker-tool-handle',a.tool,wood,0,.16,0,.035,kind==='quarry'?.86:.66,.035);
   if(kind==='quarry')box('quarry-pick-head',a.tool,copper,0,.58,0,.40,.045,.055);
   else if(kind==='logging')box('logging-axe-head',a.tool,copper,.10,.46,0,.24,.13,.045);
   else box('builder-tool-blade',a.tool,stone,.065,.46,0,.16,.085,.045);
  }
 }
 function cargo(a,c){
  const goods=c.carrying?Object.entries(c.cargo||{}).filter(([,n])=>n>0):[],key=goods.map(([k,n])=>`${k}:${n}`).sort().join('|')+`:${a.look?.work||''}`;
  if(a.cargoKey===key)return;a.cargoKey=key;prune(a.load);for(const m of a.load.getChildMeshes())m.dispose();
  const k=goods[0]?.[0];if(!k)return;
  if(k==='food'&&a.look.work==='fishing'){
   for(let i=0;i<2;i++){sphere('cargo-fish',a.load,fishSkin,0,i*.10-.04,0,.43,.12,.12);const tail=box('cargo-fish-tail',a.load,fishSkin,.23,i*.10-.04,0,.10,.14,.025);tail.rotation.z=.4; sphere('cargo-fish-eye',a.load,dark,-.16,i*.10-.01,-.055,.02,.02,.02);}
   box('cargo-fish-binding',a.load,reed,0,0,0,.025,.27,.14);
  }else if(k==='food'&&a.look.work==='hunting'){sphere('cargo-game-bundle',a.load,dark,0,0,0,.47,.28,.28);box('cargo-game-binding',a.load,linen,0,0,0,.035,.29,.29);}
  else if(['water','beer','pottery','oil'].includes(k)){sphere('cargo-vessel',a.load,clay,0,0,0,.32,.36,.32);sphere('cargo-neck',a.load,clay,0,.19,0,.14,.12,.14);}
  else if(['wood','reed'].includes(k))for(let i=0;i<4;i++)box('cargo-bundle',a.load,k==='wood'?wood:reed,0,i*.055-.08,0,.58,.045,.065);
  else if(['clay','brick','firedBrick','stone'].includes(k))for(let i=0;i<3;i++)box('cargo-material',a.load,k==='stone'?stone:clay,(i%2-.5)*.15,Math.floor(i/2)*.1,0,.145,.09,.23);
  else sphere('cargo-sack',a.load,['cloth','clothing','wool'].includes(k)?linen:reed,0,0,0,.39,.31,.30);
 }
 function appearance(a,c,state){
  const look=residentVisual(c,state),scale=look.scale,motion=look.motion;a.root.scaling.set(scale*motion.width,scale*motion.height,scale*(.96+motion.width*.04));a.look=look;
  for(const m of a.model.getChildMeshes())if(/beard/i.test(m.name))m.isVisible=c.age>=16&&c.sex!=='f';
  const color=c.phase==='mourning'?'#c7c9ae':look.robe;
  for(const m of a.cloth)m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  a.inspired.setEnabled(look.inspired);
  const key=`${look.wear}:${look.craft}:${c.role}:${c.siteDuty}:${c.guarding}`;
  if(a.detailKey!==key){a.detailKey=key;prune(a.details);for(const n of a.details.getChildren())n.dispose();a.torchNode=null;a.torch=false;
   for(let i=0;i<look.patches;i++)box('clothing-patch',a.details,i?linen:dark,(i?.12:-.12),i?.65:.9,.19,.13,.12,.015);
   if(c.role==='carrier'||c.siteDuty==='carrier')box('carrier-sling',a.details,reed,-.23,.87,.04,.17,.19,.12);
   if(c.role==='healer')box('healer-satchel',a.details,reed,.23,.92,.02,.18,.22,.12);
   if(look.craft==='weaver'||look.craft==='tailor')sphere('craft-thread',a.details,linen,-.24,.90,.12,.12,.16,.12);
   if(c.guarding)box('guard-staff',a.details,wood,.35,.83,.04,.035,1.6,.035);
  }
  const torch=!!c.mourningTorch;
  if(a.torch!==torch){a.torch=torch;if(a.torchNode){prune(a.torchNode);a.torchNode.dispose();a.torchNode=null;}if(torch){a.torchNode=new B.TransformNode('mourning-torch',scene);a.torchNode.parent=a.details;box('torch-staff',a.torchNode,wood,.32,1.12,.18,.04,.65,.04);sphere('torch-flame',a.torchNode,gold,.32,1.48,.18,.10,.18,.10);}}
  cargo(a,c);
 }
 function animate(a,c,state,dt,paused,speed,viewPosition=c){
  const dx=a.lastX===null?0:c.x-a.lastX,dz=a.lastY===null?0:c.y-a.lastY,distance=Math.hypot(dx,dz)*6;
  const offsetX=viewPosition.x-c.x,offsetY=viewPosition.y-c.y;
  if(a.viewOffsetX===undefined||c.activity&&['working','strike'].includes(c.activity.stage)){a.viewOffsetX=offsetX;a.viewOffsetY=offsetY;}else if(!paused){const blend=1-Math.exp(-dt*9);a.viewOffsetX+=(offsetX-a.viewOffsetX)*blend;a.viewOffsetY+=(offsetY-a.viewOffsetY)*blend;}
  const shownX=c.x+a.viewOffsetX,shownY=c.y+a.viewOffsetY;
  a.root.position.set(shownX*6,onBridge(state.buildings,c.x,c.y)?.22:surfaceElevation(shownX,shownY,state),shownY*6);
  if(c.activity?.target&&distance<.001&&!paused&&(!c.activity.stage||['working','strike'].includes(c.activity.stage))){a.yaw=Math.atan2(c.activity.target.x-viewPosition.x,c.activity.target.y-viewPosition.y);}
  if(distance>.00001&&!paused){a.yaw=Math.atan2(dx,dz);const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
  else if(a.yaw!==null&&!paused){const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*(1-Math.exp(-dt*10));}
  a.lastX=c.x;a.lastY=c.y;
  const decision=actorAnimation(c,distance<3?distance:0);
  // Changing UI modes on pause must not restart clips or alter their sampled pose.
  if(!paused||!a.clip){a.pose=decision.pose;a.c=c;if(a.clip!==decision.clip){for(const g of a.groups.values())g.stop();const g=a.groups.get(decision.clip);if(!g)throw Error(`Missing actor animation: ${decision.clip}`);g.start(true,1,g.from,g.to,false);if(a.look&&g.to>g.from)g.goToFrame(g.from+a.look.motion.phase/(Math.PI*2)*(g.to-g.from));a.clip=decision.clip;}}
  a.paused=paused;
  if(a.tool&&(!paused||a.toolKind===null)){const active=['work','logging','quarry','hunting','fishing'].includes(a.pose),builder=c.role==='builder'||c.siteDuty==='builder'||c.phase==='constructing';
   const kind=c.activity?.kind||(builder?'building':['field','garden','reed','wood','stone','clay','pottery','brewery','brickyard'].includes(a.look?.work)?'gathering':null);workerTool(a,!c.carrying&&active?kind:null);}
  for(const [name,g]of a.groups)g.speedRatio=paused?0:speed*(name==='Walk_Loop'?(c.playing?1.35:c.age>=55?.7:.9)*(a.look?.motion.gait||1):1);
  if(!paused){a.time=poseTime*(a.look?.motion.gait||1)+(a.look?.motion.phase||0);if(a.look){const beat=Math.sin(a.time*3.5),work=['work','logging','quarry','hunting','fishing'].includes(a.pose);a.model.rotation.x=(c.age>=55?.06:0)+(a.look.mood<25?.045:0)+(a.pose==='petting'?.60:work?.08:0);a.model.rotation.z=a.pose==='dance'?beat*.055:0;
   a.inspired.position.y=1.85+Math.sin(a.time*2.3)*.045;a.inspired.scaling.setAll(1+Math.sin(a.time*2.3)*.10);
   // Play and dance bounce is a presentation pose at the resident's exact route position.
   a.model.position.y=a.footOffset+(a.pose==='play'||a.pose==='dance'?Math.abs(beat)*.04:distance>.00001?Math.abs(Math.sin(a.time*6))*a.look.motion.stride:0);
  }}
 }
 // Animation clips set the skeletal base, then apply small task-specific arm gestures.
 const observer=scene.onAfterAnimationsObservable.add(()=>{
  for(const a of people.values()){
   if(!a.root.isEnabled())continue;
   if(a.paused&&a.armNodes.some(arm=>arm.last)){for(const arm of a.armNodes)if(arm.last)arm.node.rotationQuaternion=arm.last.clone();continue;}
   const carry=['carry','unload'].includes(a.pose),work=['work','logging','quarry','building','gathering'].includes(a.pose),play=['play','dance'].includes(a.pose);
   for(const arm of a.armNodes){const n=arm.node;
    // Restore authored/clip transforms before the two-bone task solve.
    const animated=a.groups.get(a.clip)?.targetedAnimations.some(t=>t.target===n);
    const base=animated?n.rotationQuaternion:arm.base;
    if(!base)continue;
    const upper=/upperarm/.test(n.name),side=/_l$/.test(n.name)?1:-1;
    const angle=play&&upper?Math.sin(a.time*3.5+side)*.4:0;
    n.rotationQuaternion=angle?base.multiply(B.Quaternion.RotationAxis(B.Axis.X,angle)):base.clone();
   }
   if(carry){
    // Both palms meet the actual load, not a floating object ahead of the torso.
    a.load.position.set(0,1.02,.34);
    poseArm(a,'l',vec(-.21,1.01,.34));poseArm(a,'r',vec(.21,1.01,.34));
   }else if(a.pose==='logging'||a.pose==='quarry'){
    const swing=a.c.activity?.stage==='strike'?0:(Math.sin(a.time*4.5)+1)*.5;
    poseArm(a,'r',vec(.20,.93+swing*.60,.36-swing*.20));
    poseArm(a,'l',vec(-.02,.98+swing*.47,.43-swing*.18));
   }else if(a.pose==='hunting'){
    const pull=(Math.sin(a.time*2.5)+1)*.5;
    poseArm(a,'l',vec(-.11,1.22,.63));poseArm(a,'r',vec(.15,1.15,.22+pull*.25));
   }else if(a.pose==='fishing'){
    const tug=Math.sin(a.time*1.5)*.05;
    poseArm(a,'r',vec(.16,1.05+tug,.39));poseArm(a,'l',vec(-.10,1.08+tug,.38));
   }else if(a.pose==='petting'){
    const target=a.c.activity?.target,pet=target?B.Vector3.TransformCoordinates(vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+.58,target.y*6),a.root.computeWorldMatrix(true).clone().invert()):vec(.15,.44,.65);
    pet.z+=Math.sin(a.time*4)*.07;poseArm(a,'r',pet);poseArm(a,'l',vec(-.24,.79,.30));
   }else if(work){
    poseArm(a,'r',vec(.19,.88+Math.sin(a.time*3.5)*.17,.40));poseArm(a,'l',vec(-.18,.95,.28));
   }
   if(a.tool.isEnabled()&&a.hands.r&&a.hands.l){
    a.hands.r.computeWorldMatrix(true);a.hands.l.computeWorldMatrix(true);
    const direction=['logging','quarry'].includes(a.pose)?a.hands.l.getAbsolutePosition().subtract(a.hands.r.getAbsolutePosition()):B.Vector3.TransformNormal(a.pose==='hunting'?vec(0,1,0):vec(0,.85,.55),a.root.getWorldMatrix());
    const local=B.Vector3.TransformNormal(direction,a.tool.parent.getWorldMatrix().clone().invert()).normalize();
    a.tool.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,local,new B.Quaternion());a.tool.computeWorldMatrix(true);
   }
   if(a.pose==='hunting'&&a.shotArrow&&a.c.activity?.target){
    const target=a.c.activity.target,end=vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+.95,target.y*6);
    // Aim in world space: a hand's authored glTF rotation must not turn the bow away.
    aimForward(a.tool,end);
    const progress=Math.max(0,Math.min(1,((a.c.activity.progress||0)-.88)/.12)),flying=progress>0;
    a.shotArrow.setEnabled(flying);for(const mesh of a.nockedArrow)mesh.setEnabled(!flying);
    if(flying){const start=a.tool.getAbsolutePosition().add(a.tool.getDirection(B.Axis.Z).normalize().scale(.35)),position=B.Vector3.Lerp(start,end,progress);
     position.y+=Math.sin(progress*Math.PI)*.12;
     a.shotArrow.position.copyFrom(B.Vector3.TransformCoordinates(position,a.root.getWorldMatrix().clone().invert()));
     aimForward(a.shotArrow,end.add(vec(0,-.01,0)));
    }
   }
   for(const arm of a.armNodes)arm.last=arm.node.rotationQuaternion?.clone();
   if(a.fishingLine&&a.tool.isEnabled()){
    // A real line descends from the rod tip to the worker's water target.
    const tip=a.rodTip.getAbsolutePosition(),target=a.c.activity?.target;
    const end=target?vec(target.x*6,surfaceElevation(target.x,target.y,a.state)+.02,target.y*6):tip.add(vec(0,-.9,.2));
    B.MeshBuilder.CreateLines('fishing-line',{points:[tip,end],instance:a.fishingLine},scene);
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
  const frame=actorViewFrame(state),visible=frame.citizens,positions=residentViewPositions(state,visible),pettingCats=new Set(frame.pettingPairs.map(p=>p.catId)),seen=new Set();
  for(const c of visible){seen.add(c.id);let a=people.get(c.id);if(!a){a=instantiate(residentSource,`citizen-${c.id}`,{citizenId:c.id});a.footOffset=a.model.position.y;people.set(c.id,a);}a.root.setEnabled(true);appearance(a,c,state);a.state=state;animate(a,c,state,dt,paused,speed,positions.get(c.id));if(a.fishingLine)a.fishingLine.setEnabled(a.tool.isEnabled());}
  const living=new Set((state.citizens||[]).map(c=>c.id));for(const [id,a]of people)if(!living.has(id)){remove(a);people.delete(id);}else if(!seen.has(id)){a.root.setEnabled(false);if(a.fishingLine)a.fishingLine.setEnabled(false);for(const g of a.groups.values())g.speedRatio=0;}
  const fauna=animalsFor(state).map(c=>c.kind==='cat'&&pettingCats.has(c.id)?{...c,behavior:'petting',walking:false}:c),animals=fauna.filter(c=>c.kind==='sheep'),seenSheep=new Set();for(const c of animals){seenSheep.add(c.id);let a=sheep.get(c.id);if(!a){a=instantiate(sheepSource,c.id,{animalId:c.id,animalKind:'sheep'});sheep.set(c.id,a);}animate(a,c,state,dt,paused,speed);}
  for(const [id,a]of sheep)if(!seenSheep.has(id)){remove(a);sheep.delete(id);}
  wildlife.update(state,[...fauna.filter(c=>c.kind!=='sheep'),...(funeralView(state)?.jackals||[])],dt,{paused,speed});funeralProps(state);
 }
 function dispose(){if(disposed)return;disposed=true;scene.onAfterAnimationsObservable.remove(observer);for(const a of people.values())remove(a);for(const a of sheep.values())remove(a);if(bier)remove(bier);people.clear();sheep.clear();wildlife.dispose();for(const c of containers)c.dispose();for(const m of ownedMaterials)m.dispose();meshes.length=0;}
 return {update,dispose,meshes,rootFor(selection){return selection.citizenId!==undefined?people.get(selection.citizenId)?.root:sheep.get(selection.animalId)?.root||wildlife.rootFor(selection);}};
}
