import {festivalBlessingFrame,festivalBlessingParticle,FESTIVAL_BLESSING_COUNT} from '../festival-blessing.js';
import {surfaceElevation,TILE} from '../district3d/terrain.js';

// All tiny six-armed stars and their soft halos share one draw and one unlit
// material. No texture download, particle meshes, shadows or point lights.
export function createFestivalBlessing(B,scene){
 let mesh=null,material=null,positions=null,colors=null,disposed=false,lastKey=null;
 const vertices=[],indices=[],particle={};
 for(let plane=0;plane<2;plane++){
  for(const halo of [false,true]){
   const base=vertices.length,sides=halo?8:12;
   vertices.push({a:0,r:0,plane,alpha:halo?.13:1});
   for(let i=0;i<sides;i++)vertices.push({a:i*Math.PI*2/sides,r:halo?2.8:i%2?.22:1,plane,alpha:halo?0:.9});
   for(let i=0;i<sides;i++)indices.push(base,base+1+i,base+1+(i+1)%sides);
  }
 }
 function create(){
  mesh=new B.Mesh('festival-blessing-light-snow',scene);mesh.isPickable=false;mesh.receiveShadows=false;mesh.hasVertexAlpha=true;mesh.useVertexColors=true;mesh.metadata={festivalBlessing:true};
  material=new B.StandardMaterial('festival-blessing-cream-gold',scene);material.disableLighting=true;material.emissiveColor=new B.Color3(1,.93,.69);material.diffuseColor=B.Color3.White();material.specularColor=B.Color3.Black();material.backFaceCulling=false;material.disableDepthWrite=true;material.alphaMode=B.Engine.ALPHA_ADD;material.transparencyMode=B.Material.MATERIAL_ALPHABLEND;mesh.material=material;
  const count=vertices.length*FESTIVAL_BLESSING_COUNT;
  positions=new Float32Array(count*3);colors=new Float32Array(count*4);
  const allIndices=[];for(let i=0;i<FESTIVAL_BLESSING_COUNT;i++)for(const index of indices)allIndices.push(i*vertices.length+index);
  const data=new B.VertexData();data.positions=positions;data.colors=colors;data.indices=allIndices;data.applyToMesh(mesh,true);
 }
 function update(view,state){
  if(disposed)return;
  const frame=festivalBlessingFrame(view);
  if(!frame){mesh?.setEnabled(false);lastKey=null;return;}
  if(!mesh)create();mesh.setEnabled(true);
  const elevation=surfaceElevation(frame.x,frame.y,state),key=`${frame.x}:${frame.y}:${frame.time}:${elevation}`;
  if(key===lastKey)return;lastKey=key;
  mesh.position.set(frame.x*TILE,elevation,frame.y*TILE);
  let p=0,c=0;
  for(let i=0;i<FESTIVAL_BLESSING_COUNT;i++){
   festivalBlessingParticle(frame,i,particle);
   const x=(particle.x-frame.x)*TILE,z=(particle.y-frame.y)*TILE;
   for(const vertex of vertices){
    const a=vertex.a+particle.rotation,u=Math.cos(a)*vertex.r*particle.size,v=Math.sin(a)*vertex.r*particle.size;
    positions[p++]=x+(vertex.plane?0:u);positions[p++]=particle.height+v;positions[p++]=z+(vertex.plane?u:0);
    colors[c++]=1;colors[c++]=.96;colors[c++]=.78;colors[c++]=particle.alpha*vertex.alpha;
   }
  }
  mesh.updateVerticesData(B.VertexBuffer.PositionKind,positions,true);mesh.updateVerticesData(B.VertexBuffer.ColorKind,colors);
 }
 return {update,get mesh(){return mesh;},dispose(){if(disposed)return;disposed=true;mesh?.dispose();material?.dispose();mesh=null;material=null;positions=null;colors=null;}};
}
