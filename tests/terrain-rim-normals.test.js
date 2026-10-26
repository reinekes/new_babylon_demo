import test from 'node:test';import assert from 'node:assert/strict';
import {alluvialTerrainGeometry,alluvialSceneryGeometry} from '../district3d/terrain.js';
test('shared map rim keeps continuous height, color and lighting normals',()=>{
 const state={buildings:[],world:{lakes:[]}},inside=alluvialTerrainGeometry(state),outside=alluvialSceneryGeometry(state),rim=new Map();
 for(let i=0;i<inside.positions.length;i+=3){const x=inside.positions[i],z=inside.positions[i+2];if(x===-3||x===237||z===-3||z===189)rim.set(`${x},${z}`,{height:inside.positions[i+1],normal:inside.normals.slice(i,i+3),color:inside.colors.slice(i/3*4,i/3*4+4)});}
 let matched=0;for(let i=0;i<outside.positions.length;i+=3){const v=rim.get(`${outside.positions[i]},${outside.positions[i+2]}`);if(v){matched++;assert.equal(outside.positions[i+1],v.height);assert.deepEqual(outside.normals.slice(i,i+3),v.normal);assert.deepEqual(outside.colors.slice(i/3*4,i/3*4+4),v.color);}}
 assert.ok(matched>100);
});
