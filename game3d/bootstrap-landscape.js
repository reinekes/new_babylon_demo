import {createDistrictTerrain,TILE} from '../district3d/terrain.js';
import {canalNetworkGeometry} from './canal-network.js';
import {irrigationFor,CARDINAL} from '../irrigation.js';
import {constructionProgress} from '../construction.js';
import {terrain} from '../world.js';

export function createBootstrapLandscape(B,scene,state,materials){
 const base=createDistrictTerrain(B,scene,state,materials),originals=new Map(),owned=[];
 let channelMeshes=[],signature='',disposed=false;
 const water=base.meshes.find(m=>m.name==='living-river').material;
 const bank=(name,color)=>{const m=materials.soil.clone(name);m.albedoColor=new B.Color3(...color);m.roughness=1;m.metallic=0;owned.push(m);return m;};
 const wet=bank('bootstrap-wet-channel-mud',[.42,.37,.28]),dry=bank('bootstrap-dry-channel-bank',[1,.91,.76]);
 const clamp=v=>Math.max(0,Math.min(1,v));
 function carve(arms){
  // Cut the display mesh only; retain the original for demolition and topology changes.
  if(!originals.size)for(const m of base.meshes)if(['alluvial-valley','soft-riparian-grass'].includes(m.name))originals.set(m,{positions:m.getVerticesData(B.VertexBuffer.PositionKind).slice(),colors:m.getVerticesData(B.VertexBuffer.ColorKind)?.slice()});
  for(const [m,original]of originals){const positions=original.positions.slice(),colors=original.colors?.slice();
   for(let i=0;i<positions.length;i+=3)for(const arm of arms){const dx=arm.b.x-arm.a.x,dy=arm.b.y-arm.a.y,x=positions[i]/TILE,y=positions[i+2]/TILE,t=clamp(((x-arm.a.x)*dx+(y-arm.a.y)*dy)/(dx*dx+dy*dy||1)),distance=Math.hypot(x-arm.a.x-dx*t,y-arm.a.y-dy*t)*TILE;if(distance>1.85)continue;
    const weight=1-clamp((distance-.85)/1),cut=arm.startHeight+(arm.endHeight-arm.startHeight)*t-.2;positions[i+1]=Math.min(positions[i+1],original.positions[i+1]*(1-weight)+cut*weight);if(colors&&m.name==='soft-riparian-grass')colors[i/3*4+3]*=1-Math.min(1,weight*2);
   }
   m.setVerticesData(B.VertexBuffer.PositionKind,positions,true);if(colors)m.setVerticesData(B.VertexBuffer.ColorKind,colors,true);const normals=[];B.VertexData.ComputeNormals(positions,m.getIndices(),normals);m.setVerticesData(B.VertexBuffer.NormalKind,normals,true);m.refreshBoundingInfo();
  }
 }
 function surface(name,g,material,arms){
  if(!g.indices.length)return null;const mesh=new B.Mesh(`bootstrap-canal-${name}`,scene),data=new B.VertexData();
  // The generator caches its result for the detailed layer too; winding is local.
  data.positions=g.positions.slice();data.indices=g.indices.slice();data.colors=g.colors.slice();data.uvs=g.uvs.slice();data.normals=[];B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);
  if(data.normals.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0){for(let i=0;i<data.indices.length;i+=3)[data.indices[i+1],data.indices[i+2]]=[data.indices[i+2],data.indices[i+1]];B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);}
  data.applyToMesh(mesh);mesh.material=material;mesh.useVertexColors=true;mesh.isPickable=false;mesh.receiveShadows=name!=='water';mesh.metadata={canalArms:arms,canalArm:arms[0]};mesh.freezeWorldMatrix();return mesh;
 }
 function update(s,time){
  if(disposed)return;base.update(s,time);const network=irrigationFor(s),canals=s.buildings.filter(b=>b.type==='canal').map(b=>{const key=`${b.x},${b.y}`;return {x:b.x,y:b.y,wet:network.wet.has(key),progress:b.construction?constructionProgress(b).ratio:1,arms:network.arms.get(key)||CARDINAL.filter(([dx,dy])=>s.buildings.some(v=>v.type==='canal'&&v.x===b.x+dx&&v.y===b.y+dy)||terrain(b.x+dx,b.y+dy,s)==='water')};});
  const next=JSON.stringify([canals,s.world?.lakes,s.buildings.map(b=>[b.x,b.y])]);if(next===signature)return;signature=next;
  const g=canalNetworkGeometry(s,canals),replacement=[surface('wet-bed',g.wetBed,wet,g.arms),surface('dry-bed',g.dryBed,dry,g.arms),surface('water',g.water,water,g.arms)].filter(Boolean);if(g.arms.length||channelMeshes.length)carve(g.arms);for(const m of channelMeshes)m.dispose();channelMeshes=replacement;
 }
 update(state,state.simTime);
 return {get meshes(){return [...base.meshes,...channelMeshes];},update,light(n){if(!disposed)base.light(n);},dispose(){if(disposed)return;disposed=true;for(const m of channelMeshes)m.dispose();channelMeshes=[];originals.clear();base.dispose();for(const m of owned)m.dispose(false,false);}};
}
