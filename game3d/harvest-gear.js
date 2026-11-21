import {fishMesh,catchBasket,schoolPositions} from './fishing-props.js';
import {waterDepth} from './water.js';
import {footprintSize} from '../footprints.js';
import {harvestApron} from '../harvest-handling.js';

export function harvestFurniture(B,scene,b,materials){
 if(b.construction?.kind==='new'||!['fishing','hunting'].includes(b.type))return [];
 const n=footprintSize(b),center=(n-1)/2,[sx,sz]=b.workCorner||[1,1];
 const layout=harvestApron(center,center,{x:center+sx*n/2,y:center+sz*n/2});
 const pieces=[],yaw=Math.atan2(layout.dx,layout.dy);
 function plank(name,across,height,along,w,h,d,finish){
  const p=B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene);
  p.position.set(layout.middle.x*6+across*layout.dy+along*layout.dx,height,layout.middle.y*6-across*layout.dx+along*layout.dy);
  p.rotation.y=yaw;p.material=finish;pieces.push(p);
 }
 const fishing=b.type==='fishing';
 if(fishing){
  for(const x of [-.64,.64])plank('reed-rod-rack-leg',x,.41,0,.09,.82,.10,materials.wood);
  plank('reed-rod-rack-bar',0,.71,0,1.48,.09,.10,materials.wood);
 }else{
  for(const x of [-.65,.65])for(const z of [-.19,.19])plank('game-dressing-trestle',x,.36,z,.10,.72,.10,materials.wood);
  for(const z of [-.22,0,.22])plank('game-dressing-table',0,.74,z,1.58,.10,.215,materials.wood);
 }
 const mesh=B.Mesh.MergeMeshes(pieces,true,true);mesh.name=fishing?'fishing-rod-rack':'game-dressing-bench';
 mesh.metadata={harvestFurniture:b.type};mesh.receiveShadows=true;mesh.isPickable=false;
 if(!fishing)return [mesh];
 return [mesh,...dryingFurniture(B,scene,layout,materials)];
}
export function fishingLift(progress){
 const p=Math.min(1,Math.max(0,progress||0));
 if(p<.20)return {cast:Math.sin(p/.20*Math.PI*.5),catch:0,phase:'cast'};
 if(p<.72)return {cast:1,catch:0,phase:'wait'};
 const t=(p-.72)/.28;return {cast:1-t,catch:t,phase:'lift'};
}

const clamp=n=>Math.min(1,Math.max(0,n));
const blend=(p,start,end)=>{const u=clamp((p-start)/(end-start));return u*u*(3-2*u);};
export function fishingHands(activity,time){
 if(activity.task==='take-rod')return {right:[.07,.78,.46],left:[-.19,.86,.33]};
 if(activity.task==='hang-fish'){const h=.67+.70*blend(activity.progress,0,.75);return {right:[.06,h,.46],left:[-.12,h-.10,.49]};}
 if(activity.task==='land-fish'){
  const p=activity.progress,pull=blend(p,.18,.56),lower=blend(p,.64,.95);
  return {right:[.17,1.07+pull*.25-lower*.10,.46-pull*.15],left:[-.10-.24*lower,1.02+.14*pull-.63*lower,.44+.08*pull]};
 }
 const lift=fishingLift(activity.progress),beat=Math.sin(time*2.5)*.018;
 return {right:[.14,1.04+lift.catch*.08+beat,.42],left:[-.09,1.02+lift.catch*.04,.36]};
}

export function createFishingProps(B,scene,a,materials,meshes,reducedMotion=false){
 a.stillFishing=reducedMotion;
 a.aimingCane=false;a.caneBend=null;a.canePath=Array.from({length:8},()=>B.Vector3.Zero());a.lineVertices=new Float32Array(9);
 const v=(x,y,z)=>new B.Vector3(x,y,z),path=Array.from({length:8},(_,i)=>v(0,.20*i,.11*i));
 a.cane=B.MeshBuilder.CreateTube('fishing-rod',{path,radiusFunction:i=>.026-i*.0027,tessellation:7,updatable:true},scene);
 a.cane.parent=a.tool;a.cane.material=materials.reed;meshes.push(a.cane);
 a.fishingLine=B.MeshBuilder.CreateLines('fishing-line',{points:[v(0,0,0),v(0,-.5,0),v(0,-1,0)],updatable:true},scene);
 a.fishingLine.isPickable=false;a.fishingLine.color=B.Color3.FromHexString('#c5b295');a.fishingLine.metadata={citizenId:a.root.metadata.citizenId};meshes.push(a.fishingLine);
 a.fishingProps=new B.TransformNode('fishing-at-bank',scene);a.fishingProps.parent=a.root;
 a.caughtFish=fishMesh(B,scene,'fish-on-line',materials.fish);a.caughtFish.parent=a.fishingProps;meshes.push(a.caughtFish);a.caughtFish.setEnabled(false);
 a.catchBasket=catchBasket(B,scene,materials.wicker);a.catchBasket.parent=a.fishingProps;a.catchBasket.position.set(-.36,.018,.53);meshes.push(a.catchBasket);a.catchBasket.setEnabled(false);
 const arcs=[0,1].map(r=>Array.from({length:23},(_,i)=>{
  const angle=i*Math.PI*.081+.65*r;return v(Math.cos(angle)*(.44+.17*r),0,Math.sin(angle)*(.40+.17*r));
 }));
 a.hookRipple=B.MeshBuilder.CreateLineSystem('bite-at-water',{lines:arcs},scene);
 a.hookRipple.parent=a.fishingProps;a.hookRipple.color=B.Color3.FromHexString('#bdcec1');a.hookRipple.isPickable=false;a.hookRipple.setEnabled(false);meshes.push(a.hookRipple);
 a.drops=B.MeshBuilder.CreateLineSystem('drops-over-catch-basket',{lines:[-.045,.022,.072].map((x,i)=>[v(x,i*.094,0),v(x,i*.094-.052,0)])},scene);
 a.drops.parent=a.fishingProps;a.drops.color=B.Color3.FromHexString('#b9c6bb');a.drops.isPickable=false;a.drops.setEnabled(false);meshes.push(a.drops);
 a.schoolFactory=()=>{
  const group=new B.TransformNode('rich-catch-school',scene);group.parent=a.fishingProps;
  a.flankReflections=new Map();
  a.schoolFish=Array.from({length:13},(_,i)=>{
   const fish=i?a.schoolFishSource.createInstance('school-fish-'+i):fishMesh(B,scene,'school-fish-0',materials.school);
   if(!i)a.schoolFishSource=fish;
   fish.parent=group;fish.isPickable=false;
   const length=.56+((i*17)%11)*.047;fish.scaling.set(length*1.12,length*.64,length*.80);
   if([2,5,6,8,10,11].includes(i)){
    const glint=B.MeshBuilder.CreateLines('wet-silver-flank',{points:[v(-.152,.024,-.044),v(-.06,.032,-.064),v(.05,.035,-.064),v(.122,.027,-.055)]},scene);
    glint.color=B.Color3.FromHexString('#d3d8c7');glint.isPickable=false;glint.parent=fish;a.flankReflections.set(i,glint);
   }
   return fish;
  });return group;
 };
}

function dryingFurniture(B,scene,layout,m){
 const meshes=[],frame=[],yaw=Math.atan2(layout.dx,layout.dy);
 // On the work apron, behind the low rack from which fishers take their poles.
 const point=(across,along,h)=>new B.Vector3(layout.middle.x*6+layout.dy*across+layout.dx*along,h,layout.middle.y*6-layout.dx*across+layout.dy*along);
 const pole=(name,a,b,r,mat)=>{
  const line=b.subtract(a),p=B.MeshBuilder.CreateCylinder(name,{diameter:r*2,height:line.length(),tessellation:7},scene);
  p.position.copyFrom(a.add(b).scale(.5));p.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,line.normalize(),new B.Quaternion());p.material=mat;frame.push(p);
 };
 for(const side of [-1,1]){
  for(const along of [.39,.98])pole('drying-frame-leg',point(side*.98,along,0),point(side*1.02,.69,1.48),.045,m.wood);
  pole('drying-frame-lashing',point(side*1.02,.69,1.36),point(side*1.02,.69,1.46),.071,m.reed);
 }
 pole('drying-frame-rail',point(-1.13,.69,1.4),point(1.13,.69,1.4),.047,m.wood);
 const wet=[];
 for(let i=0;i<7;i++){
  const across=(i-3)*.28,center=point(across,.69,1.11-(i%2)*.046);
  const fish=fishMesh(B,scene,'drying-fish',m.linen||m.reed);fish.position.copyFrom(center);fish.rotation.set(0,yaw+i*.15,Math.PI*.49);wet.push(fish);
  pole('drying-frame-cord',point(across,.69,1.38),point(across,.69,center.y+.19),.012,m.reed);
 }
 function merge(parts,name,role){const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,true);mesh.name=name;mesh.metadata={fishRackPart:role};mesh.isPickable=false;meshes.push(mesh);}
 merge(frame,'drying-frame','frame');merge(wet,'fish-hanging-on-rack','hanging');
 const basket=catchBasket(B,scene,m.reed);basket.position.copyFrom(point(.46,.16,.02));basket.scaling.setAll(1.32);basket.rotation.y=yaw;
 const cured=[basket];
 for(let i=0;i<4;i++){
  const fish=fishMesh(B,scene,'dried-fish',m.wood);fish.position.copyFrom(point(.46+(i%2)*.09,.05+i*.07,.47));fish.rotation.set(0,yaw+.26*i,.05);cured.push(fish);
 }
 merge(cured,'basket-of-dried-fish','ready');return meshes;
}

function lineContact(a,target,height,B){
 const c=a.c,last=a.lineContact;
 if(last&&last.x===target.x&&last.z===target.y&&Math.hypot(last.fromX-c.x,last.fromY-c.y)<.04)return last.point;
 const dx=target.x-c.x,dy=target.y-c.y,d=Math.hypot(dx,dy);
 const steps=Math.max(1,Math.ceil(d*18));let fraction=1;
 for(let i=1;i<=steps;i++){const t=i/steps;
  if(t*d>.33&&waterDepth(c.x+t*dx,c.y+t*dy,a.state)>.10){fraction=t;break;}
 }
 const point=new B.Vector3((c.x+dx*fraction)*6,height+.025,(c.y+dy*fraction)*6);
 a.lineContact={x:target.x,z:target.y,fromX:c.x,fromY:c.y,point};
 return point;
}

export function updateFishingTackle(B,a,waterHeight){
 const task=a.c.activity,root=a.root,rod=a.tool;
 if(!task||!a.cane)return;
 if(task.task==='hang-fish'){
  a.hookRipple.setEnabled(false);a.drops.setEnabled(false);a.cane.setEnabled(false);a.catchBasket.setEnabled(false);a.fishingLine.setEnabled(false);a.school?.setEnabled(false);
  a.caughtFish.setEnabled(task.progress<.88);
  const hand=a.hands.r.computeWorldMatrix(true).getTranslation();hand.y-=.16;
  a.caughtFish.position.copyFrom(B.Vector3.TransformCoordinates(hand,root.computeWorldMatrix(true).clone().invert()));
  a.caughtFish.rotation.set(0,0,Math.PI/2);return;
 }
 a.cane.setEnabled(true);
 const atRack=task.task==='take-rod'&&task.progress<.55,walking=task.stage==='approach',grip=a.hands.r;
 if(atRack){
  rod.parent=root;
  const inverse=root.computeWorldMatrix(true).clone().invert(),p=task.target;
  rod.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(p.x*6,root.position.y+.77,p.y*6),inverse));
  rod.rotationQuaternion=B.Quaternion.FromEulerAngles(0,0,Math.PI*.49);
 }else if(rod.parent!==grip){
  rod.parent=grip;rod.position.set(0,.045,0);rod.rotationQuaternion=B.Quaternion.Identity();
 }
 const fishing=task.kind==='fishing'&&task.task!=='take-rod'&&!walking,landing=task.task==='land-fish';
 a.fishingLine.setEnabled(fishing);a.catchBasket.setEnabled(fishing);
 const p=landing?task.progress:0,schooling=landing&&task.firstBlessed&&p<.43;
 a.caughtFish.setEnabled(landing&&p>.29);
 const ripple=landing&&p<.72,dripping=landing&&p>.70&&p<.96&&!a.stillFishing;
 a.hookRipple.setEnabled(ripple);a.drops.setEnabled(dripping);
 if(schooling&&!a.school)a.school=a.schoolFactory();
 a.school?.setEnabled(schooling);
 if(!fishing||!task.target){
  if(a.aimingCane){a.aimingCane=false;a.cane.setPreTransformMatrix(B.Matrix.IdentityReadOnly);a.caneBend=null;const path=Array.from({length:8},(_,i)=>new B.Vector3(0,.20*i,.11*i));
   B.MeshBuilder.CreateTube('fishing-rod',{path,radiusFunction:i=>.026-i*.0027,instance:a.cane},root.getScene());}
  return;
 }
 const water=lineContact(a,task.target,waterHeight,B),base=rod.computeWorldMatrix(true).getTranslation(),inverse=root.computeWorldMatrix(true).clone().invert();
 const forward=water.subtract(base);forward.y=0;forward.normalize();
 const pull=landing?blend(p,.23,.58):0,lower=landing?blend(p,.66,.94):0,cast=fishingLift(task.progress);
 const arc=landing?Math.sin(Math.PI*blend(p,.21,.75))*.66:0;
 // Translate and aim the rest shape from the real palm. Only the brief
 // interval under load needs a new tube surface; a waiting fisher can hold
 // exactly this shape for hundreds of frames.
 const reach=1.82-pull*.81+lower*.17,rise=.93+pull*.72,droop=.27+arc;
 // Express the aimed shaft in the animated palm's axes. It stays a child
 // of the grip even on mirrored GLB skeletons with nonuniform bone scales.
 const aim=B.Matrix.FromValues(forward.z,0,-forward.x,0,0,1,0,0,forward.x,0,forward.z,0,base.x,base.y,base.z,1);
 a.cane.setPreTransformMatrix(aim.multiply(rod.getWorldMatrix().clone().invert()));a.aimingCane=true;
 if(!a.caneBend||a.caneBend.reach!==reach||a.caneBend.rise!==rise||a.caneBend.droop!==droop){
  for(let i=0;i<8;i++){const t=i/7;a.canePath[i].set(0,t*rise-t*t*droop,t*reach);}
  B.MeshBuilder.CreateTube('fishing-rod',{path:a.canePath,radiusFunction:i=>.026-i*.0027,instance:a.cane},root.getScene());
  a.caneBend={reach,rise,droop};
 }
 const tip=base.add(forward.scale(reach));tip.y+=rise-droop;
 const left=landing?a.hands.l.computeWorldMatrix(true).getTranslation():null;
 const end=landing?B.Vector3.Lerp(water,left,pull):B.Vector3.Lerp(tip,water,cast.phase==='cast'?cast.cast:1);
 if(landing&&p>.29){
  const basket=a.catchBasket.computeWorldMatrix(true).getTranslation();basket.y+=.28*root.scaling.y;
  const release=blend(p,.87,.97),fish=B.Vector3.Lerp(end,basket,release);
  a.caughtFish.position.copyFrom(B.Vector3.TransformCoordinates(fish,inverse));
  a.caughtFish.rotation.set(0,.22,Math.PI*(.49-.47*lower)+.14*Math.sin(p*31)*(1-lower));
 }
 if(landing&&p>.65){end.copyFrom(left);end.y+=.13;end.z+=.06;}
 const sag=B.Vector3.Lerp(tip,end,.55);sag.y-=landing?.028:.09;
 tip.toArray(a.lineVertices,0);sag.toArray(a.lineVertices,3);end.toArray(a.lineVertices,6);
 a.fishingLine.updateVerticesData(B.VertexBuffer.PositionKind,a.lineVertices,true);
 Object.assign(a.fishingLine.metadata,{waterPoint:{x:water.x/6,y:water.z/6},waterContact:landing?p<.29:cast.phase!=='cast',catchLift:pull,phase:landing?p<.29?'bite':p<.65?'lift':'basket':cast.phase,blessed:!!task.blessed});
 if(ripple){
  a.hookRipple.position.copyFrom(B.Vector3.TransformCoordinates(water,inverse));
  const wave=a.stillFishing?.55:p; a.hookRipple.scaling.setAll(.26+wave*(task.blessed?1.65:1.16));a.hookRipple.alpha=.68*(1-wave/.85);
 }
 if(dripping){
  const falling=(p*15)%1;a.drops.position.copyFrom(a.caughtFish.position);
  a.drops.position.y-=.19+falling*.28;a.drops.alpha=.70*(1-falling);
 }
 if(schooling){
  a.school.position.copyFrom(B.Vector3.TransformCoordinates(water,inverse));a.school.rotation.y=Math.atan2(forward.x,forward.z)-root.rotation.y;
  const time=a.stillFishing?.19:p;
  schoolPositions(time,(i,x,y,z,heading,roll)=>{
   const fish=a.schoolFish[i];fish.position.set(x,y,z);fish.rotation.set(roll,heading,.10*Math.sin(i+time*23));
   const flash=a.flankReflections.get(i);
   if(flash){const glint=Math.max(0,1-Math.abs(time-.17-(i%4)*.016)/.081);flash.alpha=glint*.88;flash.setEnabled(glint>.04);}
  });
 }
}
