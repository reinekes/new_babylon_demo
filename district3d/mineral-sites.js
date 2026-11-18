import {mineralFooting} from './mineral-footing.js';
import {workshopSurfaces} from '../game3d/workshop-surfaces.js';
import {extractionStockFraction} from '../extraction-stock.js';
import {occupiesCell} from '../footprints.js';
import {terrain} from '../world.js';
import {mineralDepositAngle,mineralDepositGeometry,mineralPitGeometry} from '../game3d/mineral-excavation.js';

// The basic city, detailed landscape and district viewer all own this layer
// through their terrain. Only the root height changes when a yard opens.
export function mineralSiteView(B,scene,state,materials,pits,tile,height,colorAt){
 const meshes=[],roots=[],sources=new Map(),sites=new Map(),ladders=[],cut=new Map(pits.map(p=>[p.x+','+p.y,p]));
 for(const p of state.world?.deposits||[]){
  if(!['stone','clay'].includes(p.kind)||terrain(p.x,p.y,state)==='water')continue;
  const key=p.x+','+p.y;if(cut.has(key)||!state.buildings?.some(b=>occupiesCell(b,p.x,p.y)))sites.set(key,p);
 }
 const surface=new B.PBRMaterial('mineral-bedding',scene);surface.metallic=0;surface.roughness=.98;
 const grain=workshopSurfaces(B,scene).textures('earth');
 surface.albedoColor=new B.Color3(.80,.78,.75);surface.albedoTexture=grain.color||null;surface.bumpTexture=grain.normal||null;
 function meshFrom(name,g,mat){
  const mesh=new B.Mesh(name,scene),v=new B.VertexData();Object.assign(v,g);v.normals=[];
  B.VertexData.ComputeNormals(g.positions,g.indices,v.normals);v.applyToMesh(mesh);
  mesh.material=mat;mesh.useVertexColors=true;mesh.receiveShadows=true;mesh.isPickable=false;meshes.push(mesh);return mesh;
 }
 for(const pit of pits){
  const g=mineralPitGeometry(pit),x=pit.x*tile,z=pit.y*tile,base=height(pit.x,pit.y,state);
  // The outer apron uses the same world-space grain and sediment colour as
  // the neighbouring valley triangles, including the shore falloff.
  ladders.push({pit,layout:g.ladder});
  const apron=dataSlice(g,0,40*6),bowl=dataSlice(g,40*6,g.indices.length);
  for(const part of [apron,bowl])for(let i=0;i<part.positions.length;i+=3){
   const u=x+part.positions[i],v=z+part.positions[i+2],rim=part.positions[i+1];
   part.positions[i]=u;part.positions[i+2]=v;
   part.positions[i+1]=base+rim+(height(u/tile,v/tile,state)-base)*Math.max(0,1+rim/pit.depth);
   if(part===apron){
    part.uvs[i/3*2]=(.93*u+.37*v)/3.4;part.uvs[i/3*2+1]=(.93*v-.37*u)/3.4;
    const color=colorAt(u/tile,v/tile,state);for(let k=0;k<4;k++)part.colors[i/3*4+k]=color[k];
   }
  }
  for(const [part,mat,role] of [[apron,materials.soil,'rim'],[bowl,surface,'bowl']]){
   const mesh=meshFrom(`excavated-${pit.kind}-${role}-${pit.x}-${pit.y}`,part,mat);mesh.metadata={mineralCut:{...pit,role}};mesh.freezeWorldMatrix();
  }
 }
 for(const {pit,layout} of ladders){
  // Heavy rails bear on the undisturbed corner. The bottom two rungs descend
  // onto the clear shoulder beside the seam even when the resource is full.
  const x=pit.x*tile,z=pit.y*tile,y=height(pit.x,pit.y,state);
  const anchored=v=>new B.Vector3(x+v[0],y+v[1],z+v[2]);
  const toe=anchored(layout.toe),head=anchored(layout.head),across=B.Vector3.FromArray(layout.across),timber=[];
  const rod=(a,b,r)=>{
   const delta=b.subtract(a),m=B.MeshBuilder.CreateCylinder('pit-ladder-timber',{height:delta.length(),diameter:2*r,tessellation:7},scene);
   m.position=a.add(b).scale(.5);m.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),new B.Quaternion());timber.push(m);
  };
  for(const k of [-1,1])rod(toe.add(across.scale(k)),head.add(across.scale(k)),.047);
  const count=Math.ceil(pit.depth/.31);for(let i=0;i<count;i++){
   const point=B.Vector3.Lerp(toe,head,(i+.56)/(count+.17));rod(point.subtract(across),point.add(across),.033);
  }
  const ladder=B.Mesh.MergeMeshes(timber,true,true);ladder.name=`excavated-${pit.kind}-ladder-${pit.x}-${pit.y}`;
  ladder.material=materials.wood;ladder.metadata={mineralCut:{...pit,role:'ladder'}};ladder.isPickable=false;ladder.receiveShadows=true;ladder.freezeWorldMatrix();meshes.push(ladder);
 }
 for(const [key,p] of sites){
  if(!sources.has(p.kind)){
   const source=meshFrom('native-mineral-source-'+p.kind,mineralDepositGeometry(p.kind),surface);source.setEnabled(false);sources.set(p.kind,source);
  }
  const pit=cut.get(key),mesh=sources.get(p.kind).createInstance(`${pit?'deposit-open':'deposit-natural'}-${p.kind}-${p.x}-${p.y}`);
  mesh.position.set(p.x*tile,height(p.x,p.y,state)-(pit?.depth||0),p.y*tile);mesh.rotation.y=mineralDepositAngle(p);
  mesh.metadata={resourceSite:{kind:p.kind,x:p.x,y:p.y,label:p.kind==='stone'?'Камень':'Глина'},mineralExposure:pit?'excavated':'natural'};
  mesh.isPickable=false;mesh.setEnabled(true);mesh.freezeWorldMatrix();meshes.push(mesh);roots.push({mesh,p,key});
 }
 const footing=mineralFooting(B,pits,meshes,tile);
 function update(s){for(const r of roots){
  const mineral=r.p.kind==='stone'?s.stonePits:s.clayPits,remaining=mineral?.[r.key];
  if(r.initialized&&remaining===r.remaining)continue;r.remaining=remaining;r.initialized=true;
  const scale=Math.cbrt(extractionStockFraction(s,r.p));r.mesh.setEnabled(scale>1e-6);
  r.mesh.unfreezeWorldMatrix();r.mesh.scaling.setAll(scale);r.mesh.freezeWorldMatrix();
  if(cut.has(r.key))footing.changed();
 }}
 update(state);return {meshes,update,heightAt:footing.heightAt,material:surface};
}
function dataSlice(g,start,end){
 const remap=new Map(),part={positions:[],colors:[],uvs:[],indices:[]};
 for(let i=start;i<end;i++){
  const idx=g.indices[i];if(!remap.has(idx)){
   remap.set(idx,part.positions.length/3);
   for(const [k,count] of [['positions',3],['colors',4],['uvs',2]])for(let j=0;j<count;j++)part[k].push(g[k][idx*count+j]);
  }
  part.indices.push(remap.get(idx));
 }
 return part;
}
