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
 mesh.metadata={harvestFurniture:b.type};mesh.receiveShadows=true;mesh.isPickable=false;return [mesh];
}
export function fishingLift(progress){
 const p=Math.min(1,Math.max(0,progress||0));
 if(p<.20)return {cast:Math.sin(p/.20*Math.PI*.5),catch:0,phase:'cast'};
 if(p<.72)return {cast:1,catch:0,phase:'wait'};
 const t=(p-.72)/.28;return {cast:1-t,catch:t,phase:'lift'};
}

export function fishingHands(activity,time){
 if(activity.task==='take-rod')return {right:[.07,.78,.46],left:[-.19,.86,.33]};
 const lift=fishingLift(activity.progress),beat=Math.sin(time*2.5)*.03;
 return {right:[.14,1.07+lift.catch*.23+beat,.42],left:[-.09,1.00+lift.catch*.09,.36]};
}
export function updateFishingTackle(B,a,waterHeight){
 const task=a.c.activity,root=a.root,rod=a.tool,tipNode=a.rodTip;
 if(!task||!tipNode)return;
 const atRack=task.task==='take-rod'&&task.progress<.55,walking=task.stage==='approach';
 const grip=a.hands.r;
 if(atRack){
  rod.parent=root;
  const inverse=root.computeWorldMatrix(true).clone().invert(),p=task.target;
  rod.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(p.x*6,root.position.y+.77,p.y*6),inverse));
  rod.rotationQuaternion=B.Quaternion.FromEulerAngles(0,0,Math.PI*.49);
 }else if(rod.parent!==grip){
  rod.parent=grip;rod.position.set(0,.045,0);rod.rotationQuaternion=B.Quaternion.Identity();
 }
 rod.computeWorldMatrix(true);tipNode.computeWorldMatrix(true);
 const fishing=task.kind==='fishing'&&task.task!=='take-rod'&&!walking;
 a.fishingLine.setEnabled(fishing);a.caughtFish.setEnabled(false);
 if(!fishing||!task.target)return;
 const lift=fishingLift(task.progress),tip=tipNode.getAbsolutePosition();
 const water=new B.Vector3(task.target.x*6,waterHeight+.012,task.target.y*6);
 const near=tip.add(new B.Vector3(0,-.34,0)),end=B.Vector3.Lerp(near,water,lift.cast);
 if(lift.catch>0){
  a.caughtFish.setEnabled(true);
  a.caughtFish.position.copyFrom(B.Vector3.TransformCoordinates(end,root.computeWorldMatrix(true).clone().invert()));
  a.caughtFish.rotation.z=.15*Math.sin(a.time*10);
 }
 B.MeshBuilder.CreateLines('fishing-line',{points:[tip,end],instance:a.fishingLine},root.getScene());
 Object.assign(a.fishingLine.metadata,{waterContact:lift.phase==='wait',catchLift:lift.catch,phase:lift.phase});
}
