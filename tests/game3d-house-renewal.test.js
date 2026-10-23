import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createHouseArchitecture,houseVisualKind} from '../game3d/house-architecture.js';
import {gameBuildingSignature} from '../game3d/buildings.js';
const sandbox={module:{exports:{}},console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function setup(){const engine=new B.NullEngine(),scene=new B.Scene(engine),m=Object.fromEntries(['plaster','soil','reed','wood','terracotta','grass','shade','trim'].map(n=>[n,new B.PBRMaterial(n,scene)]));return {engine,scene,m,dispose(){scene.dispose();engine.dispose();}};}
test('starter hut applies only at level one, including pending upgrade; signatures cannot share a normal house',()=>{
 const b={type:'house',level:1,x:3,y:4};assert.equal(houseVisualKind({...b,starterHut:true}),'hut');assert.equal(houseVisualKind({...b,starterHut:true,construction:{kind:'upgrade',target:2}}),'hut');assert.equal(houseVisualKind({...b,starterHut:true,level:2}),'courtyard-2');assert.notEqual(gameBuildingSignature(b),gameBuildingSignature({...b,starterHut:true}));
});
test('house renewal supplies three materially different complete volumes inside one tile',()=>{
 const t=setup();try{const results=[];for(const level of [1,2,3]){const meshes=createHouseArchitecture(B,t.scene,{type:'house',level,starterHut:true,x:3,y:4},t.m);assert.ok(meshes.length>=4);const vertices=meshes.reduce((n,m)=>n+m.getTotalVertices(),0);let height=0;for(const m of meshes){m.computeWorldMatrix(true);const bb=m.getBoundingInfo().boundingBox;assert.ok(bb.minimumWorld.x>=-2.8&&bb.maximumWorld.x<=2.8);assert.ok(bb.minimumWorld.z>=-2.8&&bb.maximumWorld.z<=2.8);height=Math.max(height,bb.maximumWorld.y);assert.ok(m.getVerticesData(B.VertexBuffer.NormalKind).every(Number.isFinite));assert.equal(m.overrideMaterialSideOrientation,B.Material.CounterClockWiseSideOrientation);}results.push({vertices,height,names:meshes.flatMap(m=>m.metadata.houseParts)});}assert.ok(results[0].names.includes('beehive-shell'));assert.ok(results[1].names.includes('court-west-wing'));assert.ok(results[2].names.includes('terrace-stair'));assert.ok(results[2].height>results[1].height+.5);assert.notEqual(results[1].vertices,results[2].vertices);assert.ok(results.every(r=>r.vertices<22000));}finally{t.dispose();}
});
test('rounded hut has multiple shrinking shell rings, real open entrance and outward normals',()=>{
 const t=setup();try{const meshes=createHouseArchitecture(B,t.scene,{type:'house',level:1,starterHut:true,x:3,y:4},t.m),shell=meshes.find(m=>m.metadata.houseParts.includes('beehive-shell')),p=shell.getVerticesData(B.VertexBuffer.PositionKind),normals=shell.getVerticesData(B.VertexBuffer.NormalKind),rings=new Set();for(let i=0;i<p.length;i+=3)if(p[i+1]>.1&&p[i+1]<2.9)rings.add(p[i+1].toFixed(2));assert.ok(rings.size>12);let outward=0;for(let i=0;i<p.length;i+=3)if(p[i+1]>.4&&p[i+1]<2){const radial=p[i]*normals[i]+(p[i+2]+.35)*normals[i+2];if(radial>.2)outward++;}assert.ok(outward>100);assert.ok(shell.metadata.openDoor);assert.ok(meshes.some(m=>m.metadata.houseParts.includes('reed-porch')));}finally{t.dispose();}
});
test('ordinary level I has a modest mudbrick courtyard and variants add physical details',()=>{
 const t=setup();try{const shapes=[];for(const x of [0,1,7]){const meshes=createHouseArchitecture(B,t.scene,{type:'house',level:1,x,y:0},t.m),parts=meshes.flatMap(m=>m.metadata.houseParts);assert.ok(parts.includes('modest-back-room'));assert.ok(parts.includes('modest-entrance-shade'));assert.ok(!parts.includes('terrace-upper-room'));shapes.push(meshes.reduce((n,m)=>n+m.getTotalVertices(),0));}assert.ok(new Set(shapes).size>1,'variants change furnishings/geometry, not merely color');}finally{t.dispose();}
});
