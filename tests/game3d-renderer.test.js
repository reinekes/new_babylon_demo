import test from 'node:test';
import assert from 'node:assert/strict';
import {worldCell,pickedEntity,roadNear,previewFor,createGameRenderer} from '../game3d/renderer.js';
import {createGame} from '../engine.js';
test('3D world picking agrees with logical tile centers and rejects map exterior',()=>{
 for(let y=0;y<32;y++)for(let x=0;x<40;x++)assert.deepEqual(worldCell({x:x*6,z:y*6}),{x,y});
 assert.equal(worldCell({x:-4,z:0}),null);assert.equal(worldCell({x:240,z:0}),null);assert.equal(worldCell({x:NaN,z:2}),null);
});
test('picking retrieves actual citizen ID through mesh parents and selects only nearby roads',()=>{
 const root={metadata:{citizenId:17}},child={parent:root};assert.deepEqual(pickedEntity(child),{citizenId:17});
 const road={id:'a',a:{x:3,y:4},b:{x:4,y:4}},state={roads:[road]};assert.equal(roadNear(state,{x:3.4,y:4.1}),road);assert.equal(roadNear(state,{x:8,y:8}),null);
});
test('building preview reports actual placement rules and never modifies state',()=>{
 const s=createGame({start:'established'}),before=JSON.stringify(s),at=s.buildings[0];const p=previewFor(s,'house',{x:at.x,y:at.y});assert.equal(p.allowed,false);
 assert.equal(previewFor(s,null,{x:8,y:8}),null);assert.equal(JSON.stringify(s),before);
});
test('unavailable WebGL chooses working Canvas renderer before acquiring any graphics context',async()=>{
 const fake={};let constructed=0;const r=await createGameRenderer(fake,()=>{},{BABYLON:null,legacyFactory:(canvas)=>{constructed++;assert.equal(canvas,fake);return {mode:'2d'};}});assert.equal(r.mode,'2d');assert.equal(constructed,1);
});
test('zoom buttons retain native camera zoom direction after wheel or focus',async()=>{
 const {GameRenderer3D}=await import('../game3d/renderer.js');const r=Object.create(GameRenderer3D.prototype);r.camera={radius:30};assert.equal(r.zoom,104/30);r.zoomBy(.2);assert.ok(r.camera.radius<30);const near=r.camera.radius;r.zoomBy(-.2);assert.ok(r.camera.radius>near);r.camera.radius=9;r.zoomBy(.2);assert.equal(r.camera.radius,8);
});
