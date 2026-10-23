import test from 'node:test';
import assert from 'node:assert/strict';
import {clippedFieldGeometry,fieldWorldPoint,FIELD_SHORE_BUFFER} from '../game3d/field-shore.js';
import {renderedShoreDistance,renderedRiverCenter,RIVER_HALF_WIDTH} from '../game3d/shore-profile.js';
import {waterSurfaceGeometry} from '../game3d/water.js';
import {createGame} from '../engine.js';
const plane=()=>({positions:[-2.675,.065,-2.675,2.675,.065,-2.675,-2.675,.065,2.675,2.675,.065,2.675],normals:Array(4).fill([0,1,0]).flat(),uvs:[0,0,1,0,0,1,1,1],indices:[0,2,1,1,2,3]});
const area=g=>{let a=0;for(let i=0;i<g.indices.length;i+=3){const [p,q,r]=g.indices.slice(i,i+3).map(k=>[g.positions[k*3],g.positions[k*3+2]]);a+=Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))/2;}return a;};
function dryTriangles(g,b,s){
 for(let i=0;i<g.indices.length;i+=3){const tri=g.indices.slice(i,i+3).map(k=>[g.positions[k*3],g.positions[k*3+2]]);
  for(const w of [[1,0,0],[0,1,0],[0,0,1],[1/3,1/3,1/3],[.5,.5,0],[.5,0,.5],[0,.5,.5]]){const x=tri.reduce((n,p,j)=>n+p[0]*w[j],0),z=tri.reduce((n,p,j)=>n+p[1]*w[j],0),p=fieldWorldPoint(b,x,z);assert.ok(renderedShoreDistance(p.x,p.y,s)>=FIELD_SHORE_BUFFER-.0001,'field triangles stop beyond the actual rendered water');}
 }
}
function sampledDryArea(b,s){let count=0;const n=220;for(let y=0;y<n;y++)for(let x=0;x<n;x++){const p=fieldWorldPoint(b,((x+.5)/n-.5)*5.35,((y+.5)/n-.5)*5.35);if(renderedShoreDistance(p.x,p.y,s)>=FIELD_SHORE_BUFFER)count++;}return count/(n*n)*5.35**2;}

test('starting field keeps its dry middle and over half the plot instead of three narrow rows',()=>{
 const s=createGame({start:'established'}),b=s.buildings.find(b=>b.type==='field'),before=JSON.stringify(s),data=plane(),g=clippedFieldGeometry(data,b,s),ratio=area(g)/area(data);
 assert.deepEqual([b.x,b.y],[12,8]);assert.ok(ratio>.5&&ratio<.65,`dry area ratio ${ratio}`);assert.ok(Math.abs(area(g)-sampledDryArea(b,s))<.025,'filled triangles cover all actual dry ground without an extra bank strip');
 const vertices=g.positions.filter((_,i)=>i%3===0);assert.ok(Math.max(...vertices)>.2,'dry centre and middle crop rows remain');assert.ok(Math.min(...vertices)<-2.67);dryTriangles(g,b,s);assert.equal(JSON.stringify(s),before);
});
test('every quarter turn clips in world space while retaining local vertices and crop heights',()=>{
 const s={buildings:[],world:{lakes:[]}},data=plane();for(let rotation=0;rotation<4;rotation++){const b={x:12,y:8,rotation},before=JSON.stringify([data,b,s]),g=clippedFieldGeometry(data,b,s);dryTriangles(g,b,s);assert.ok(Math.abs(area(g)-sampledDryArea(b,s))<.025);assert.equal(JSON.stringify([data,b,s]),before);assert.equal(g.uvs.length,g.positions.length/3*2);assert.ok(g.positions.every(Number.isFinite));}
 const b={x:12,y:8,rotation:1};assert.deepEqual(fieldWorldPoint(b,6,0),{x:12,y:7});
});
test('organic lakes share their rendered contour; inland fields retain exact geometry and indices',()=>{
 const s={buildings:[],world:{lakes:[{id:'lake',cells:[{x:25,y:7},{x:25,y:8},{x:26,y:7},{x:26,y:8}]}]}},data=plane();
 for(let rotation=0;rotation<4;rotation++){const b={x:24,y:7,rotation},g=clippedFieldGeometry(data,b,s);assert.ok(area(g)>area(data)*.90,'a lake only rounds a small edge of the neighbouring field');dryTriangles(g,b,s);assert.ok(Math.abs(area(g)-sampledDryArea(b,s))<.025);}
 for(let rotation=0;rotation<4;rotation++)assert.equal(clippedFieldGeometry(data,{x:3,y:3,rotation},s),data,'completely inland data is shared without subdivision or lost area');
});
test('river clipping profile exactly follows the current water mesh rows',()=>{
 const s={buildings:[],world:{lakes:[]}},g=waterSurfaceGeometry(s).river,columns=25;
 for(let j=0;j<g.points.length/columns-1;j+=11){const a=g.points[j*columns],b=g.points[(j+1)*columns],y=(a.y+b.y)/2,edge=(a.x+b.x)/2;assert.ok(Math.abs(renderedRiverCenter(y)-RIVER_HALF_WIDTH-edge)<1e-10);assert.ok(Math.abs(renderedShoreDistance(edge,y,s))<1e-10);}
});
