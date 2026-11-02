import {worldWidth,worldHeight} from '../world.js';
import {TILE} from '../district3d/terrain.js';

// The valley and scenery share analytic normals. Recomputing an entire mesh
// after a local canal/lake edit breaks that lighting seam even far from the edit.
export function deformedTerrainNormals(B,original,positions,indices){
 const changed=new Uint8Array(positions.length/3),affected=new Uint8Array(changed.length);
 let any=false;
 for(let i=0;i<positions.length;i+=3)if(positions[i+1]!==original.positions[i+1]){changed[i/3]=1;any=true;}
 if(!any)return original.normals.slice();
 for(let i=0;i<indices.length;i+=3){const a=indices[i],b=indices[i+1],c=indices[i+2];if(changed[a]||changed[b]||changed[c])affected[a]=affected[b]=affected[c]=1;}
 const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
 for(let i=0;i<affected.length;i++)if(!affected[i])for(let k=0;k<3;k++)normals[i*3+k]=original.normals[i*3+k];
 return normals;
}
// A legal canal can end at the playable boundary. Keep every matching scenery
// vertex on the final edited rim, including its colour and lighting normal.
export function stitchTerrainRim(B,meshes,state){
 const ground=meshes.find(m=>m.name==='alluvial-valley'),background=meshes.find(m=>m.name==='distant-alluvial-plain');
 if(!ground||!background)return;
 const p=ground.getVerticesData(B.VertexBuffer.PositionKind),n=ground.getVerticesData(B.VertexBuffer.NormalKind),c=ground.getVerticesData(B.VertexBuffer.ColorKind),rim=new Map();
 for(let i=0;i<p.length;i+=3)if(p[i]===-.5*TILE||p[i]===(worldWidth(state)-.5)*TILE||p[i+2]===-.5*TILE||p[i+2]===(worldHeight(state)-.5)*TILE)rim.set(`${p[i]},${p[i+2]}`,i);
 const q=background.getVerticesData(B.VertexBuffer.PositionKind).slice(),normals=background.getVerticesData(B.VertexBuffer.NormalKind).slice(),colors=background.getVerticesData(B.VertexBuffer.ColorKind).slice();
 for(let i=0;i<q.length;i+=3){const j=rim.get(`${q[i]},${q[i+2]}`);if(j===undefined)continue;q[i+1]=p[j+1];for(let k=0;k<3;k++)normals[i+k]=n[j+k];for(let k=0;k<4;k++)colors[i/3*4+k]=c[j/3*4+k];}
 background.setVerticesData(B.VertexBuffer.PositionKind,q,true);background.setVerticesData(B.VertexBuffer.NormalKind,normals,true);background.setVerticesData(B.VertexBuffer.ColorKind,colors,true);background.refreshBoundingInfo();
}
