import {loadModel} from './asset-loading.js';
import {surfaceElevation} from '../district3d/terrain.js';

const ANIMALS=[
 {kind:'pig',file:'test-pig-trellis.glb',stride:.34,coat:'#937164',mark:'#b98c7b',height:.64,length:1.19,width:.53,head:.31,leg:.29},
 {kind:'goat',file:'test-goat-trellis.glb',stride:.40,coat:'#9c7854',mark:'#d6bc94',height:.96,length:1.04,width:.39,head:.26,leg:.52},
 {kind:'bull',file:'test-bull-trellis.glb',stride:.62,coat:'#5b3c32',mark:'#98664e',height:1.43,length:1.82,width:.74,head:.43,leg:.70}
];

export function createTestLivestock(B,scene,meshes,dry,clear){
 const materials=new Map(),parts=[],containers=[];
 let disposed=false,requested=false;
 function material(color){
  if(!materials.has(color)){
   const mat=new B.PBRMaterial('test-livestock-'+color,scene);
   mat.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
   mat.metallic=0;mat.roughness=.93;materials.set(color,mat);
  }
  return materials.get(color);
 }
 function make(spec,index){
  const {kind,coat,mark,height,length,width,head,leg}=spec;
  const root=new B.TransformNode('test-livestock-'+kind,scene);
  root.metadata={testHerd:true,testSpecies:kind};
  root.setEnabled(false);
  const model=new B.TransformNode('test-livestock-body-'+kind,scene);
  model.parent=root;
  const skull=new B.TransformNode('test-livestock-head-'+kind,scene);
  skull.parent=model;skull.position.set(0,height*.88,length*.48);
  const colorDark='#372826',hornColor='#c2a782';
  const shapes=[];
  function mesh(part,color,parent){
   part.material=material(color);part.parent=parent;shapes.push(part);
   return part;
  }
  function oval(name,color,parent,x,y,z,w,h,d){
   const part=mesh(B.MeshBuilder.CreateSphere(name,{diameter:1,segments:10},scene),color,parent);
   part.position.set(x,y,z);part.scaling.set(w,h,d);
   return part;
  }
  function horn(name,color,parent,points,radius){
   const path=points.map(p=>new B.Vector3(...p));
   return mesh(B.MeshBuilder.CreateTube(name,{path,tessellation:8,cap:B.Mesh.CAP_ALL,
    radiusFunction:i=>radius*(1-i/(path.length-.65))},scene),color,parent);
  }
  oval('flank',coat,model,0,height*.72,0,width,height*.55,length);
  oval('shoulders',coat,model,0,height*.77,length*.25,width*.94,height*.51,length*.56);
  oval('haunch',coat,model,0,height*.73,-length*.29,width*.87,height*.44,length*.44);
  oval('neck',coat,model,0,height*.83,length*.4,width*.63,height*.47,length*.43).rotation.x=.42;
  oval('forehead',coat,skull,0,0,0,head*.76,head*.81,head);
  oval('muzzle',mark,skull,0,-head*.13,head*.46,head*.69,head*.47,head*.55);
  for(const side of [-1,1]){
   oval('eye',colorDark,skull,side*head*.336,head*.068,head*.12,head*.104,head*.093,head*.10);
   oval('nostril',colorDark,skull,side*head*.157,-head*.125,head*.728,head*.098,head*.068,head*.031);
   const ear=oval('ear',coat,skull,side*head*.46,head*.23,-head*.16,head*.53,head*(kind==='pig'?.65:.28),head*.40);
   ear.rotation.z=side*(kind==='pig'?-.36:.20);
   if(kind==='goat')horn('swept horn',hornColor,skull,[[side*.065,.071,-.04],[side*.077,.16,-.08],[side*.090,.23,-.16],[side*.101,.23,-.22]],.035);
   if(kind==='bull')horn('curved horn',hornColor,skull,[[side*.117,.083,-.08],[side*.235,.124,-.103],[side*.352,.161,-.094],[side*.387,.252,-.06]],.065);
  }
  if(kind==='goat')oval('beard',mark,skull,0,-.145,.055,.085,.21,.083);
  if(kind==='bull')oval('dewlap',mark,model,0,height*.57,length*.43,.22,.51,.31);
  const zTail=-length*.47,yTail=height*.82;
  if(kind==='pig'){
   const curl=Array.from({length:15},(_,i)=>[.065*Math.sin(i*.43),yTail-.048+.051*Math.cos(i*.43),zTail-.012*i]);
   horn('curled tail',coat,model,curl,.035);
  }else{
   const drop=kind==='bull'?.52:-.15;
   horn('tail',coat,model,[[0,yTail,zTail],[0,yTail-.05,zTail-.15],[.07,yTail-drop,zTail-.23]],.047);
   if(kind==='bull')oval('tail tuft',colorDark,model,.07,yTail-drop,zTail-.23,.102,.18,.11);
  }
  const legs=[];
  for(const end of [-1,1])for(const side of [-1,1]){
   const pivot=new B.TransformNode('livestock-leg',scene);pivot.parent=model;
   pivot.position.set(side*width*.305,leg,end*length*.30);
   oval('upper leg',coat,pivot,0,-leg*.20,0,width*.25,leg*.77,width*.29);
   oval('shin',coat,pivot,0,-leg*.58,.014,width*.17,leg*.70,width*.19);
   oval('hoof',colorDark,pivot,0,-leg*.89,.037,width*.22,leg*.23,width*.29);
   legs.push({pivot,phase:side*end});
  }
  for(const shape of shapes){shape.isPickable=false;shape.receiveShadows=true;meshes.push(shape);parts.push(shape);}
  return {root,model,skull,legs,index};
 }
 const herd=ANIMALS.map(make);
 function removeMesh(mesh){
  for(const list of [meshes,parts]){
   const index=list.indexOf(mesh);
   if(index>=0)list.splice(index,1);
  }
 }
 function loadAnimals(){
  requested=true;
  for(const actor of herd){
   const {file,kind,height}=ANIMALS[actor.index];
   if(!file)continue;
   loadModel(B,scene,'assets/art-courtyard/models/',file,scene,undefined,'.glb').then(container=>{
    if(disposed){container.dispose();return;}
    containers.push(container);
    const display=new B.TransformNode('trellis-'+kind,scene);
    const copy=container.instantiateModelsToScene(name=>'trellis-'+kind+'-'+name,false,{doNotInstantiate:true});
    for(const root of copy.rootNodes)root.parent=display;
    const {min,max}=display.getHierarchyBoundingVectors(true);
    const scale=height/(max.y-min.y);
    if(!Number.isFinite(scale)||scale<=0){display.dispose();throw Error('Invalid TRELLIS.2 bounds for '+kind);}
    display.scaling.setAll(scale);
    display.position.set(-(min.x+max.x)*scale/2,-min.y*scale,-(min.z+max.z)*scale/2);
    const previous=actor.model.getChildMeshes();
    for(const mesh of previous)removeMesh(mesh);
    actor.model.dispose();
    display.parent=actor.root;
    for(const mesh of display.getChildMeshes()){
     mesh.isPickable=false;mesh.receiveShadows=true;
     if(mesh.material)mesh.material.metallic=0;
     meshes.push(mesh);parts.push(mesh);
    }
    actor.root.metadata.testModel='TRELLIS.2';
    actor.detailed=true;
    actor.walk=copy.animationGroups.find(group=>group.name.endsWith('Walk'));
    if(actor.walk){
     actor.legRotations=actor.walk.targetedAnimations.filter(({animation})=>animation.targetProperty==='rotationQuaternion').map(({target})=>({
      target,rest:target.rotationQuaternion.clone()
     }));
     actor.trunk=actor.walk.targetedAnimations.find(({animation})=>animation.targetProperty==='position')?.target;
     actor.trunkRest=actor.trunk?.position.clone();
     actor.walk.start(true);actor.walk.pause();
    }
    if(site)positionActor(actor);
   }).catch(error=>console.warn('Test livestock model unavailable:',file,error));
  }
 }
 let previousState,previousBuildings,previousCount,site,clock=0;
 // A track has two straight passes joined by tangent semicircles.
 const trackPoint=(track,distance)=>{
  const {x,y,cos,sin,half,radius,length}=track;
  const straight=2*half, bend=Math.PI*radius;
  const d=((distance%length)+length)%length;
  let u,v,du,dv;
  if(d<straight){
   u=-half+d;v=-radius;du=1;dv=0;
  }else if(d>=straight+bend&&d<2*straight+bend){
   u=half-(d-straight-bend);v=radius;du=-1;dv=0;
  }else{
   const far=d<straight+bend;
   const angle=(d-(far?straight:2*straight+bend))/radius+(far?0:Math.PI);
   u=(far?half:-half)+radius*Math.sin(angle);v=-radius*Math.cos(angle);
   du=Math.cos(angle);dv=Math.sin(angle);
  }
  return {x:x+u*cos-v*sin,y:y+u*sin+v*cos,facing:Math.atan2(du*cos-dv*sin,du*sin+dv*cos)};
 };
 function findSite(state,otherHerd){
  const home=state.buildings.find(b=>b.type==='cityGate')||state.buildings.find(b=>b.type==='house');
  if(!home)return null;
  for(const [half,radius] of [[.91,.56],[.72,.46],[.56,.39]]){
   for(let ring=0;ring<17;ring++)for(let i=0;i<16;i++){
    const angle=i*Math.PI/8,r=2.2+ring*.48;
    const x=home.x+r*Math.cos(angle),y=home.y+r*Math.sin(angle);
    if(otherHerd.some(p=>Math.hypot(x-p.x,y-p.y)<half+radius+1.18))continue;
    const length=4*half+2*Math.PI*radius;
    for(const heading of [angle+Math.PI/2,angle]){
     const track={x,y,half,radius,length,cos:Math.cos(heading),sin:Math.sin(heading)};
     const samples=Math.ceil(length/.18);
     let last=trackPoint(track,0),valid=dry(state,last.x,last.y,.38);
     for(let step=1;valid&&step<=samples;step++){
      const next=trackPoint(track,length*step/samples);
      valid=dry(state,next.x,next.y,.38)&&clear(state,last,next);
      last=next;
     }
     if(valid)return track;
    }
   }
  }
  return null;
 }
 function positionActor(actor){
  const {root,model,skull,legs,index}=actor;
  const speed=.095, ramp=.8, rest=1.25;
  const travel=site.length/speed+ramp, period=travel+rest;
  // Slow down to rest on a straight, then pick up the walk on the same heading.
  const time=clock+period*index/3+3;
  const elapsed=time%period;
  const end=Math.max(0,travel-elapsed);
  const distance=speed*(elapsed<ramp?elapsed*elapsed/(2*ramp):
   end<ramp?site.length/speed-end*end/(2*ramp):elapsed-ramp/2);
  const point=trackPoint(site,distance+site.half);
  root.position.set(point.x*6,surfaceElevation(point.x,point.y,previousState),point.y*6);
  root.rotation.y=point.facing;
  const gait=((Math.floor(time/period)*site.length+distance)*6/ANIMALS[index].stride+index*.17)%1;
  const engagement=Math.min(1,elapsed/ramp,end/ramp);
  if(actor.walk){
   actor.walk.goToFrame(actor.walk.from+gait*(actor.walk.to-actor.walk.from));
   if(actor.trunk)B.Vector3.LerpToRef(actor.trunkRest,actor.trunk.position,engagement,actor.trunk.position);
   for(const {target,rest} of actor.legRotations){
    B.Quaternion.SlerpToRef(rest,target.rotationQuaternion,engagement,target.rotationQuaternion);
   }
  }else if(!actor.detailed){
   for(const {pivot,phase} of legs)pivot.rotation.x=phase*.22*Math.sin(gait*2*Math.PI)*engagement;
   model.position.y=.015*(1-Math.cos(gait*4*Math.PI))*engagement;
   skull.rotation.x=.14+.12*Math.sin(time*.88);
  }
 }
 function update(state,dt,paused,speed,otherHerd){
  if(state!==previousState||state.buildings!==previousBuildings||state.buildings.length!==previousCount){
   previousState=state;previousBuildings=state.buildings;previousCount=state.buildings.length;site=findSite(state,otherHerd);
   for(const a of herd)a.root.setEnabled(!!site);
  }else if(paused||!dt||!speed)return;
  if(!site)return;
  if(!requested)loadAnimals();
  if(!paused)clock+=dt*speed;
  for(const actor of herd)positionActor(actor);
 }
 function dispose(){
  disposed=true;
  for(const part of [...parts])removeMesh(part);
  for(const {root,walk} of herd){walk?.dispose();root.dispose();}
  for(const mat of materials.values())mat.dispose();
  for(const container of containers)container.dispose();
 }
 return {update,dispose};
}
