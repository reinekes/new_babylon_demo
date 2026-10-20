import test from 'node:test';
import assert from 'node:assert/strict';
import {lakeContours,lakeDistance,lakeBedHeight,organicLakeGeometry,visualSurfaceElevation} from '../game3d/lake-shore.js';
import {waterSurfaceGeometry,WATER_HEIGHT,waterDepth} from '../game3d/water.js';
import {lakebankGeometry,floodplainTufts} from '../game3d/nature.js';
import {terrain} from '../world.js';
const city=()=>({buildings:[],world:{lakes:[{id:'joined-lake',cells:Array.from({length:9},(_,i)=>({x:25+i%3,y:7+Math.floor(i/3)}))}]}});

test('a 3 by 3 saved lake has one rounded outside contour with no interior banks',()=>{
 const s=city(),before=JSON.stringify(s),a=lakeContours(s);assert.equal(a.length,1);assert.equal(lakeContours(s),a);assert.ok(a[0].points.length>50);
 for(const p of [{x:25.5,y:8},{x:26,y:7.5},{x:26.5,y:8.5}]){assert.ok(lakeDistance(p.x,p.y,s)<-.8);assert.ok(visualSurfaceElevation(p.x,p.y,s)<-.9);assert.ok(waterDepth(p.x,p.y,s)>.7);}
 // Both sides of an old cell line remain a single deep basin.
 assert.ok(Math.abs(visualSurfaceElevation(25.49,8,s)-visualSurfaceElevation(25.51,8,s))<.005);
 assert.ok(lakeDistance(24.51,6.51,s)>0,'outer logical corner is dry after rounding');
 const g=waterSurfaceGeometry(s).lakes;assert.ok(g.indices.length>1000);assert.ok(g.depths.some(d=>d>.7));assert.ok(g.depths.some(d=>d<.03));assert.ok(g.positions.filter((_,i)=>i%3===1).every(y=>y===WATER_HEIGHT));
 assert.ok(g.positions.every(Number.isFinite));assert.equal(g.points.length,g.depths.length);assert.equal(JSON.stringify(s),before);assert.equal(terrain(26,8,s),'water');
});
test('soft lake margin and reeds follow only the joined shoreline; separate lakes remain separate',()=>{
 const s=city(),before=JSON.stringify(s),g=lakebankGeometry(s),tufts=floodplainTufts(s);assert.ok(g.indices.length);assert.ok(g.colors.some((v,i)=>i%4===3&&v===0));
 for(let i=0;i<g.positions.length;i+=3){const d=lakeDistance(g.positions[i]/6,g.positions[i+2]/6,s);assert.ok(d>-.04&&d<.22,'no internal cell border strips');}
 assert.ok(tufts.some(p=>p.kind==='reed'&&p.x>24&&p.x<28&&p.y>6&&p.y<10));assert.equal(JSON.stringify(s),before);
 s.world.lakes.push({id:'separate',cells:[{x:30,y:14}]});assert.equal(lakeContours(s).length,2);assert.ok(lakeDistance(30,14,s)<0);assert.ok(organicLakeGeometry(s).indices.length>g.indices.length);
 assert.equal(lakeBedHeight(0),WATER_HEIGHT);assert.ok(lakeBedHeight(-.4)<-.9);assert.equal(lakeBedHeight(.3),0);
});
