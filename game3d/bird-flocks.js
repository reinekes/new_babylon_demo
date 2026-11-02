import {worldWidth,worldHeight,riverPoint,riverLocal,riverFlowSign} from '../world.js';

export const BIRD_FLOCK_BUDGETS=Object.freeze({low:4,balanced:8,high:10});
// A display-only plan: the first flock crosses the inhabited part of the valley,
// while a second follows the nearest reach of river. No animals enter the ledger.
export function birdFlockPlan(state,tier='balanced'){
 const count=BIRD_FLOCK_BUDGETS[tier]??BIRD_FLOCK_BUDGETS.balanced,width=worldWidth(state),height=worldHeight(state),buildings=state?.buildings||[],home=buildings.find(b=>b.type==='house')||buildings[0]||{x:width/2,y:height/2},bank=riverPoint(riverLocal(home.x,home.y,state).along,state),split=Math.min(count,5),clamp=(v,n)=>Math.max(5,Math.min(n-6,v));
 const first={x:clamp(home.x+1.2,width)*6,z:clamp(home.y+.8,height)*6,radiusX:26,radiusZ:18,height:18,count:split,direction:1,phase:0},second={x:clamp(bank.x,width)*6,z:clamp(bank.y,height)*6,radiusX:36,radiusZ:24,height:25,count:count-split,direction:riverFlowSign(state),phase:2.4};
 return second.count?[first,second]:[first];
}
export function birdFlockPose(flock,time,index=0){
 const sign=flock.direction<0?-1:1,t=time*.065*sign+flock.phase,dx=-flock.radiusX*Math.sin(t)*sign,dz=flock.radiusZ*Math.cos(t)*sign,yaw=Math.atan2(dx,dz),rank=Math.ceil(index/2),side=index%2?1:-1,back=rank*1.65,lateral=rank*1.35*side,wing=.52*Math.sin(time*6.1+index*.67);
 return {x:flock.x+flock.radiusX*Math.cos(t)-Math.sin(yaw)*back+Math.cos(yaw)*lateral,y:flock.height+Math.sin(t*.7)*1.2+rank*.18,z:flock.z+flock.radiusZ*Math.sin(t)-Math.cos(yaw)*back-Math.sin(yaw)*lateral,yaw,bank:Math.sin(t)*.075*sign,wing};
}
export function createBirdFlocks(B,scene,{tier='balanced',state}={}){
 let quality=BIRD_FLOCK_BUDGETS[tier]?tier:'balanced',lastState=null,lastKey='',plan=[],disposed=false;const meshes=[],birds=[];
 const material=new B.StandardMaterial('valley-bird-earth',scene);material.diffuseColor=new B.Color3(.23,.20,.16);material.specularColor=new B.Color3(.02,.02,.02);material.backFaceCulling=false;
 const body=B.MeshBuilder.CreateSphere('valley-bird-body-source',{diameter:1,segments:6},scene),wing=new B.Mesh('valley-bird-wing-source',scene),data=new B.VertexData();data.positions=[0,0,-.12,.60,0,-.16,.85,0,.04,.34,0,.19,0,0,.14];data.indices=[0,1,3,1,2,3,0,3,4];data.normals=[];B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);data.applyToMesh(wing);
 for(const m of [body,wing]){m.material=material;m.setEnabled(false);m.isPickable=false;meshes.push(m);}
 function removeBirds(){for(const b of birds){for(const m of b.root.getChildMeshes()){const index=meshes.indexOf(m);if(index>=0)meshes.splice(index,1);}b.root.dispose();}birds.length=0;}
 function rebuild(s){const key=JSON.stringify([worldWidth(s),worldHeight(s),s?.world?.seed,quality]);if(lastState===s&&lastKey===key)return;lastState=s;lastKey=key;plan=birdFlockPlan(s,quality);removeBirds();let index=0;for(const flock of plan)for(let member=0;member<flock.count;member++){
  const root=new B.TransformNode(`valley-bird-${index++}`,scene);root.metadata={ambientSpecies:'valley-sky-bird',decorative:true};const torso=body.createInstance(`${root.name}-body`),left=wing.createInstance(`${root.name}-left`),right=wing.createInstance(`${root.name}-right`);
  for(const m of [torso,left,right]){m.setEnabled(true);m.parent=root;m.isPickable=false;meshes.push(m);}torso.scaling.set(.22,.17,.65);left.position.x=-.06;right.position.x=.06;left.scaling.x=-1;birds.push({root,left,right,flock,member});
 }}
 function update(s,time=s?.simTime||0){if(disposed)return;rebuild(s);for(const b of birds){const p=birdFlockPose(b.flock,Number.isFinite(time)?time:0,b.member);b.root.position.set(p.x,p.y,p.z);b.root.rotation.set(0,p.yaw,p.bank);b.left.rotation.z=-p.wing;b.right.rotation.z=p.wing;}}
 function dispose(){if(disposed)return;disposed=true;removeBirds();body.dispose();wing.dispose();material.dispose();meshes.length=0;}
 const view={meshes,update,setQuality(next){if(BIRD_FLOCK_BUDGETS[next])quality=next;},dispose,roots:()=>birds.map(b=>b.root),get plan(){return plan;}};update(state);return view;
}
