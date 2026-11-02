import test from 'node:test';
import assert from 'node:assert/strict';
import {riverPoint,worldWidth,worldHeight,riverLocal} from '../world.js';
import {alluvialTerrainGeometry,alluvialSceneryGeometry,shoreDistance,TILE} from '../district3d/terrain.js';
import {riverRows} from '../district3d/river-profile.js';
import {waterSurfaceGeometry} from '../game3d/water.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
import {worldCell} from '../game3d/renderer.js';

const fixture=(axis,flowSign)=>({buildings:[],world:{width:64,height:64,generationVersion:2,seed:1,river:{axis,flowSign,offset:32,slope:.08,amplitude:1.2,frequency:.12,phase:1},lakes:[]}});
for(const axis of ['x','y'])for(const sign of [-1,1])test(`64x64 visible terrain, shore and river agree (${axis}/${sign})`,()=>{
 const s=fixture(axis,sign),ground=alluvialTerrainGeometry(s),background=alluvialSceneryGeometry(s),water=waterSurfaceGeometry(s).river;
 const xs=ground.positions.filter((_,i)=>i%3===0),zs=ground.positions.filter((_,i)=>i%3===2);
 assert.equal(Math.min(...xs),-.5*TILE);assert.equal(Math.max(...xs),(worldWidth(s)-.5)*TILE);
 assert.equal(Math.min(...zs),-.5*TILE);assert.equal(Math.max(...zs),(worldHeight(s)-.5)*TILE);
 assert.ok(ground.indices.length/3<60000,'larger land must not triple terrain geometry');
 const along=water.points.map(p=>riverLocal(p.x,p.y,s).along);
 assert.equal(Math.min(...along),-36.5);assert.equal(Math.max(...along),99.5,'river continues into scenery beyond new far edge');
 for(const t of [2,20,40,61]){const p=riverPoint(t,s);assert.ok(shoreDistance(p.x,p.y,s)<-1);assert.ok(renderedShoreDistance(p.x,p.y,s)<-1);assert.ok(water.points.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<1e-7));}
 const rim=new Map();for(let i=0;i<ground.positions.length;i+=3){const x=ground.positions[i],z=ground.positions[i+2];if(x===-3||x===381||z===-3||z===381)rim.set(`${x},${z}`,ground.positions[i+1]);}
 const matched=new Set();for(let i=0;i<background.positions.length;i+=3){const key=`${background.positions[i]},${background.positions[i+2]}`;if(rim.has(key)){assert.equal(background.positions[i+1],rim.get(key));matched.add(key);}}
 assert.equal(matched.size,rim.size,'all actual map edges meet the background');
 assert.ok(riverRows(false,s).includes(63.5));
 assert.deepEqual(worldCell({x:60*TILE,z:60*TILE},s),{x:60,y:60});
 assert.equal(worldCell({x:64*TILE,z:60*TILE},s),null);
});
