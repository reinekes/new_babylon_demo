import {worldWidth,worldHeight,riverPoint,riverLocal,riverFlowSign,riverLength,isDryPoint} from '../world.js';
import {surfaceElevation,TILE} from '../district3d/terrain.js';
import {sceneryClear} from './nature.js';

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
const smooth=t=>t*t*(3-2*t);
const blend=(a,b,t)=>a+(b-a)*t;
const turn=(a,b,t)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;

// Keep the lowest quality tier's flock near the village and give it a dry
// landing area on the nearer riverbank, with a separate spot for each bird.
export function birdLandingSites(state,flock){
 if(!state)return [];
 const home=riverLocal(flock.x/TILE,flock.z/TILE,state);
 const along=Math.max(2,Math.min(riverLength(state)-3,home.along));
 const bank=riverPoint(along,state);
 const side=home.across<riverLocal(bank.x,bank.y,state).across?-1:1;
 for(const distance of [0,2,-2,4,-4,7,-7]){
  for(const offset of [2.15,2.65]){
   const sites=Array.from({length:flock.count},(_,i)=>riverPoint(along+distance+(i-2)*.30,state,side*(offset+i%2*.20)));
   if(sites.every(p=>isDryPoint(state,p.x,p.y)&&sceneryClear(state,p,.22))){
    return sites.map(p=>({x:p.x*TILE,y:surfaceElevation(p.x,p.y,state)+.105,z:p.y*TILE}));
   }
  }
 }
 return [];
}

export function shoreBirdPose(flock,site,time,index){
 const flight=birdFlockPose(flock,time,index);
 const cycle=((time%100)+100)%100;
 if(!site||cycle<34||cycle>=57)return {...flight,fold:0,phase:'flight'};
 const start=birdFlockPose(flock,time-cycle+34,index);
 const yaw=Math.atan2(site.x-start.x,site.z-start.z);
 if(cycle>=42&&cycle<49)return {...site,yaw,bank:0,wing:0,fold:1,phase:'resting'};
 const weight=cycle<42?smooth((cycle-34)/8):1-smooth((cycle-49)/8);
 const phase=cycle<42?'landing':'takeoff';
 // The approach and departure retain the moving flight path. Easing gives
 // the bird zero ground speed at touchdown and keeps the loop continuous.
 const fold=weight**4;
 return {
  x:blend(flight.x,site.x,weight),y:blend(flight.y,site.y,weight),z:blend(flight.z,site.z,weight),
  yaw:turn(flight.yaw,yaw,weight),bank:flight.bank*(1-weight),wing:flight.wing*(1-fold),fold,phase
 };
}

export function createBirdFlocks(B,scene,{tier='balanced',state}={}){
 let quality=BIRD_FLOCK_BUDGETS[tier]?tier:'balanced',lastState=null,lastKey='',lastBuildings=null,lastBuildingCount=-1,landing=[],plan=[],disposed=false;const meshes=[],birds=[];
 const material=new B.StandardMaterial('valley-bird-earth',scene);material.diffuseColor=new B.Color3(.23,.20,.16);material.specularColor=new B.Color3(.02,.02,.02);material.backFaceCulling=false;
 const makeMesh=(name,positions,indices)=>{
  const mesh=new B.Mesh(name,scene),data=new B.VertexData();
  data.positions=positions;data.indices=indices;data.normals=[];data.uvs=new Array(positions.length/3*2).fill(0);
  B.VertexData.ComputeNormals(positions,indices,data.normals);data.applyToMesh(mesh);return mesh;
 };
 const torso=B.MeshBuilder.CreateSphere('valley-bird-torso',{diameter:1,segments:6},scene);
 torso.scaling.set(.22,.17,.55);
 const head=B.MeshBuilder.CreateSphere('valley-bird-head',{diameter:1,segments:5},scene);
 head.scaling.set(.12,.12,.18);head.position.set(0,.035,.25);
 const tail=makeMesh('valley-bird-tail',[-.07,0,-.19,.07,0,-.19,-.13,.015,-.44,0,.025,-.39,.13,.015,-.44],[0,3,1,0,2,3,1,3,4]);
 const body=B.Mesh.MergeMeshes([torso,head,tail],true);
 body.name='valley-bird-body-source';
 const wing=makeMesh('valley-bird-wing-source',[
  0,0,.14, .30,.025,.13, .57,.035,.04, .82,.005,-.16,
  .65,-.015,-.21, .38,-.025,-.16, 0,0,-.15
 ],[0,6,1,1,6,5,1,5,2,2,5,4,2,4,3]);
 for(const m of [body,wing]){m.material=material;m.setEnabled(false);m.isPickable=false;meshes.push(m);}
 function removeBirds(){for(const b of birds){for(const m of b.root.getChildMeshes()){const index=meshes.indexOf(m);if(index>=0)meshes.splice(index,1);}b.root.dispose();}birds.length=0;}
 function rebuild(s){const key=JSON.stringify([worldWidth(s),worldHeight(s),s?.world?.seed,quality]);if(lastState===s&&lastKey===key)return;lastState=s;lastKey=key;lastBuildingCount=-1;plan=birdFlockPlan(s,quality);removeBirds();let index=0;for(const flock of plan)for(let member=0;member<flock.count;member++){
  const root=new B.TransformNode(`valley-bird-${index++}`,scene);root.metadata={ambientSpecies:'valley-sky-bird',decorative:true};const torso=body.createInstance(`${root.name}-body`),left=wing.createInstance(`${root.name}-left`),right=wing.createInstance(`${root.name}-right`);
  for(const m of [torso,left,right]){m.setEnabled(true);m.parent=root;m.isPickable=false;meshes.push(m);}left.position.x=-.06;right.position.x=.06;left.scaling.x=-1;birds.push({root,left,right,flock,member});
 }}
 function update(s,time=s?.simTime||0){
  if(disposed)return;
  rebuild(s);
  if(lastBuildings!==s?.buildings||lastBuildingCount!==(s?.buildings?.length??0)||landing.length!==plan[0].count){
   lastBuildings=s?.buildings;lastBuildingCount=lastBuildings?.length??0;
   landing=birdLandingSites(s,plan[0]);
   if(!landing.length)landing=new Array(plan[0].count);
  }
  for(const b of birds){
   const site=b.flock===plan[0]?landing[b.member]:null;
   const p=shoreBirdPose(b.flock,site,Number.isFinite(time)?time:0,b.member);
   b.root.position.set(p.x,p.y,p.z);b.root.rotation.set(0,p.yaw,p.bank);b.root.metadata.phase=p.phase;
   b.left.rotation.set(0,-p.fold,-p.wing);b.right.rotation.set(0,p.fold,p.wing);
   const span=1-p.fold*.65;b.left.scaling.x=-span;b.right.scaling.x=span;
  }
 }
 function dispose(){if(disposed)return;disposed=true;removeBirds();body.dispose();wing.dispose();material.dispose();meshes.length=0;}
 const view={meshes,update,setQuality(next){if(BIRD_FLOCK_BUDGETS[next])quality=next;},dispose,roots:()=>birds.map(b=>b.root),get plan(){return plan;}};update(state);return view;
}
