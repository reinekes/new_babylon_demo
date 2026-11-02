import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeGeneratedWorld} from '../world.js';
import {organicLakeGeometry,lakeContours,visualSurfaceElevation} from '../game3d/lake-shore.js';

function topology(g){
 const edges=new Map(),key=i=>`${Math.round(g.points[i].x*1e8)},${Math.round(g.points[i].y*1e8)}`;let area=0;
 for(let i=0;i<g.indices.length;i+=3){const tri=g.indices.slice(i,i+3),[a,b,c]=tri.map(j=>g.points[j]),cross=(b.x-a.x)*(c.y-a.y)-(c.x-a.x)*(b.y-a.y);if(Math.abs(cross)<1e-13)continue;area+=Math.abs(cross)/2;
  for(let j=0;j<3;j++){const ends=[key(tri[j]),key(tri[(j+1)%3])].sort();if(ends[0]===ends[1])continue;const edge=ends.join('|');edges.set(edge,(edges.get(edge)||0)+1);}
 }
 return {area,boundary:[...edges].filter(([,count])=>count===1).map(([edge])=>edge).sort()};
}

test('large-world lakes reduce interior geometry while preserving every shoreline segment and basin depth',()=>{
 const s={buildings:[{type:'house',x:6,y:7},{type:'house',x:10,y:11}]};initializeGeneratedWorld(s,0);
 const legacy=structuredClone(s);legacy.world.generationVersion=1;
 const before=JSON.stringify(s),shore=JSON.stringify(lakeContours(s)),baseline=organicLakeGeometry(legacy),g=organicLakeGeometry(s);
 assert.ok(g.indices.length<baseline.indices.length*.9,'deep lake interiors need fewer triangles');
 assert.ok(g.positions.length<baseline.positions.length*.4,'adjacent water triangles should share vertices');
 const a=topology(baseline),b=topology(g);assert.deepEqual(b.boundary,a.boundary,'the existing fine shoreline must remain exact');assert.ok(Math.abs(a.area-b.area)<1e-7,'no cracks, overlap or missing water');
 for(let i=0;i<g.points.length;i+=31){const p=g.points[i];assert.ok(Math.abs(g.depths[i]-Math.max(0,-.18-visualSurfaceElevation(p.x,p.y,s)))<1e-10);}
 assert.equal(JSON.stringify(lakeContours(s)),shore);assert.equal(JSON.stringify(s),before);
 const repeated=organicLakeGeometry(s);assert.deepEqual(repeated,g);
});
