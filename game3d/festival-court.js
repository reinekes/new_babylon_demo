import {surfaceElevation,TILE} from '../district3d/terrain.js';

// A serving mat and modest hearths belong to the real, supplied festival.
// This layer never advances the ceremony or changes its resource ledger.
export function createFestivalCourt(B,scene,meshes=[]){
 let root=null,disposed=false;
 const owned=[],materials=[],lights=[],flames=[];
 function clear(){
  for(const mesh of owned){const i=meshes.indexOf(mesh);if(i>=0)meshes.splice(i,1);}
  for(const light of lights)light.dispose();
  root?.dispose();for(const material of materials)material.dispose();
  root=null;owned.length=0;materials.length=0;lights.length=0;flames.length=0;
 }
 function create(){
  root=new B.TransformNode('festival-court',scene);root.metadata={festivalCourt:true};
  const material=(name,color,emissive=false)=>{const m=new B.StandardMaterial('feast-'+name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=B.Color3.Black();if(emissive){m.emissiveColor=m.diffuseColor;m.disableLighting=true;}materials.push(m);return m;};
  const reed=material('woven-reed','#bda36d'),edge=material('mat-border','#796245'),clay=material('terracotta','#a96946'),bread=material('flatbread','#c49a55'),dates=material('dates','#6e3621'),dark=material('wood-and-charcoal','#4d392a'),amber=material('flame-amber','#ed7c22',true),core=material('flame-core','#ffe6a4',true);
  const staticGroups=new Map();
  const part=(mesh,mat,kind,x=0,y=0,z=0,animated=false)=>{
   mesh.parent=root;mesh.material=mat;mesh.position.set(x,y,z);mesh.isPickable=false;mesh.receiveShadows=!animated;mesh.metadata={festivalProp:kind};
   if(animated){owned.push(mesh);meshes.push(mesh);}else{const key=kind+':'+mat.name;if(!staticGroups.has(key))staticGroups.set(key,[]);staticGroups.get(key).push(mesh);}return mesh;
  };
  const box=(name,mat,kind,w,h,d,x=0,y=0,z=0)=>part(B.MeshBuilder.CreateBox('feast-'+name,{width:w,height:h,depth:d},scene),mat,kind,x,y,z);
  const cylinder=(name,mat,kind,r,h,x,y,z)=>part(B.MeshBuilder.CreateCylinder('feast-'+name,{diameter:r*2,height:h,tessellation:12},scene),mat,kind,x,y,z);
  box('reed-mat',reed,'mat',3.4,.035,2.3,0,.025,0);
  for(const x of [-1.64,1.64])box('woven-edge',edge,'mat',.08,.012,2.3,x,.05,0);
  for(const z of [-1.10,1.10])box('woven-edge',edge,'mat',3.4,.012,.07,0,.05,z);
  for(let i=0;i<10;i++)box('weave',edge,'mat',3.2,.006,.014,0,.046,-.96+i*.21);
  // Serving dishes carry recognizable flat bread and dark dates.
  for(const [index,x,z]of [[0,-.82,-.45],[1,.25,.44],[2,.87,-.45]]){
   cylinder('serving-tray',clay,'food',.38,.05,x,.09,z);
   if(index!==1)for(let j=0;j<3;j++){
    const a=j*Math.PI*2/3,loaf=cylinder('bread',bread,'food',.16,.045,x+Math.cos(a)*.14,.14,z+Math.sin(a)*.14);loaf.scaling.z=.72;
   }else for(let j=0;j<9;j++){
    const fruit=part(B.MeshBuilder.CreateSphere('feast-date',{diameter:.11,segments:5},scene),dates,'food',x+(j%3-1)*.10,.16+Math.floor(j/6)*.06,z+(Math.floor(j/3)-1)*.085);fruit.scaling.set(.70,.60,1.25);
   }
  }
  const shape=[[.11,0],[.21,.06],[.26,.25],[.24,.42],[.14,.54],[.13,.63],[.105,.63],[.105,.53],[.19,.39],[.21,.24],[.16,.08],[.08,.045]].map(([r,y])=>new B.Vector3(r,y,0));
  for(const [i,x,z]of [[0,-.35,-.63],[1,.77,.55]]){
   const jar=part(B.MeshBuilder.CreateLathe('feast-beer-jar',{shape,tessellation:12,sideOrientation:B.Mesh.DOUBLESIDE},scene),clay,'vessels',x,.06,z);jar.rotation.y=i*.5;
   for(const [dx,dz]of [[-.35,.14],[.32,.16]]){
    const cupShape=[[.08,0],[.12,.13],[.10,.14],[.07,.025]].map(([r,y])=>new B.Vector3(r,y,0));
    part(B.MeshBuilder.CreateLathe('feast-beer-cup',{shape:cupShape,tessellation:10,sideOrientation:B.Mesh.DOUBLESIDE},scene),clay,'vessels',x+dx,.065,z+dz);
   }
  }
  for(let i=0;i<2;i++){
   const x=i===0?-2.03:2.03,z=i===0?-.55:.55;
   cylinder('hearth-bowl',clay,'hearth',.28,.12,x,.09,z);
   for(const a of [-.45,.45]){const log=box('hearth-wood',dark,'hearth',.44,.07,.08,x,.18,z);log.rotation.y=a;}
   const tongues=[];
   for(let j=0;j<3;j++){
    const flame=part(B.MeshBuilder.CreateCylinder('feast-live-flame',{height:j===1?.34:.24,diameterTop:0,diameterBottom:j===1?.13:.09,tessellation:6},scene),j===1?core:amber,'flame',x+(j-1)*.07,.26+(j===1?.05:0),z+(j===1?.025:0),true);
    tongues.push(flame);
   }
   const light=new B.PointLight('feast-hearth-light-'+i,new B.Vector3(x,.56,z),scene);light.parent=root;light.diffuse=B.Color3.FromHexString('#ffb666');light.intensity=.34;light.range=4.3;lights.push(light);flames.push({tongues,light,phase:i*2.7});
  }
  // Static detail is batched by material and purpose; only the small flames move.
  for(const parts of staticGroups.values()){
   const {material,metadata}=parts[0];for(const p of parts)p.computeWorldMatrix(true);
   const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name='festival-'+metadata.festivalProp+'-'+material.name;mesh.parent=root;mesh.material=material;mesh.metadata=metadata;mesh.isPickable=false;mesh.receiveShadows=true;owned.push(mesh);meshes.push(mesh);
  }
 }
 function update(view,state,time=0){
  if(disposed)return;
  const center=view?.court;
  if(!center||!Number.isFinite(center.x)||!Number.isFinite(center.y)||!['waiting','celebrating'].includes(view.stage)){clear();return;}
  if(!root)create();
  root.position.set(center.x*TILE,surfaceElevation(center.x,center.y,state)+.025,center.y*TILE);root.rotation.y=center.yaw||0;
  const t=Number.isFinite(time)?time:0;
  for(const fire of flames){
   const flicker=.94+.09*Math.sin(t*17+fire.phase)+.04*Math.sin(t*29+fire.phase);
   for(let j=0;j<fire.tongues.length;j++){
    const tongue=fire.tongues[j];tongue.scaling.y=flicker+.06*Math.sin(t*13+j);tongue.scaling.x=1+.07*Math.cos(t*19+j);tongue.rotation.z=.13*Math.sin(t*11+j+fire.phase);
   }
   fire.light.intensity=.34*flicker;
  }
 }
 return {update,dispose(){clear();disposed=true;},get root(){return root;}};
}
