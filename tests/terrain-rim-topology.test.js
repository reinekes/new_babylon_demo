import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {WIDTH,HEIGHT} from '../world.js';
import {alluvialSceneryGeometry,TILE} from '../district3d/terrain.js';

function boundaryEdges(geometry){
 const edges=new Map();
 for(let i=0;i<geometry.indices.length;i+=3){
  const triangle=geometry.indices.slice(i,i+3);
  for(let n=0;n<3;n++){
   const pair=[triangle[n],triangle[(n+1)%3]].sort((a,b)=>a-b),key=pair.join(',');
   const edge=edges.get(key);
   if(edge)edge.count++;
   else edges.set(key,{pair,count:1});
  }
 }
 return [...edges.values()].filter(edge=>edge.count===1).map(({pair})=>pair.map(index=>geometry.positions.slice(index*3,index*3+3)));
}

for(const seed of [undefined,1,42,0xffffffff])test(`distant terrain strips share every corner seam segment (seed ${seed??'legacy'})`,()=>{
 const state=createGame({seed}),edges=boundaryEdges(alluvialSceneryGeometry(state));
 for(const y of [-.5,HEIGHT-.5])for(const side of ['left','right']){
  const rim=edges.filter(edge=>edge.every(p=>p[2]===y*TILE&&(side==='left'?p[0]<=-.5*TILE:p[0]>=(WIDTH-.5)*TILE)));
  const segments=new Map();
  for(const edge of rim){
   // Coordinates include height: matching X/Z alone would miss an actual crack.
   const key=edge.map(p=>p.join(',')).sort().join('|');
   segments.set(key,(segments.get(key)||0)+1);
  }
  assert.ok(segments.size>=5,`${side} scenery must retain its intermediate dune samples`);
  for(const [segment,count]of segments)assert.equal(count,2,`open ${side} scenery seam at row ${y}: ${segment}`);
 }
});
