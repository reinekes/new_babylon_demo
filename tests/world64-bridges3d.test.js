import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createDistrictBuilding} from '../district3d/buildings.js';
import {createConstructionSite} from '../game3d/construction-sites.js';
import {riverCraftPose} from '../game3d/river-craft.js';
import {bridgeSpanAt,riverPoint} from '../world.js';
import {createOrder} from '../construction.js';
import {BUILDINGS} from '../definitions.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
const valley=axis=>({world:{generationVersion:2,width:64,height:64,river:{axis,flowSign:1,offset:30,slope:.1,amplitude:.5,frequency:.1,phase:0},lakes:[]},buildings:[]});
function projectedBounds(meshes,axis){let acrossMin=Infinity,acrossMax=-Infinity,alongMin=Infinity,alongMax=-Infinity;for(const mesh of meshes){mesh.computeWorldMatrix(true);for(const p of mesh.getBoundingInfo().boundingBox.vectorsWorld){const across=axis==='x'?p.z:p.x,along=axis==='x'?p.x:p.z;acrossMin=Math.min(acrossMin,across);acrossMax=Math.max(acrossMax,across);alongMin=Math.min(alongMin,along);alongMax=Math.max(alongMax,along);}}return {acrossMin,acrossMax,alongMin,alongMax};}
test('finished and unfinished bridges span the same crossing on both map axes',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),wood=new B.StandardMaterial('wood',scene);
 try{for(const axis of ['x','y']){
  const s=valley(axis),p=riverPoint(48,s),b={type:'bridge',x:Math.round(p.x),y:Math.round(p.y),level:1},span=bridgeSpanAt(b,s),before=JSON.stringify(s);
  const finished=createDistrictBuilding(B,scene,b,{wood},s),bounds=projectedBounds(finished.meshes,axis);
  assert.ok(bounds.acrossMin<=span.left*6+.1&&bounds.acrossMax>=span.right*6-.1);
  assert.ok(bounds.alongMin>span.y*6-1.1&&bounds.alongMax<span.y*6+1.1,`${axis} finished bridge follows crossing row`);
  const q=createOrder(BUILDINGS.bridge);Object.assign(q.delivered,q.required);q.work=6;
  const meshes=createConstructionSite(B,scene,{...b,construction:q},{wood},s),root=new B.TransformNode('site',scene);root.position.set(b.x*6,0,b.y*6);for(const mesh of meshes)mesh.parent=root;
  const site=projectedBounds(meshes,axis);assert.ok(site.acrossMin<=span.left*6+.1&&site.acrossMax>=span.right*6-.1);
  assert.ok(site.alongMin>span.y*6-1.1&&site.alongMax<span.y*6+1.1,`${axis} scaffold follows the future deck`);
  assert.equal(JSON.stringify(s),before);finished.dispose();root.dispose();
 }}finally{scene.dispose();engine.dispose();}
});
test('a boat lowers its rig only at the oriented bridge crossing and faces its voyage',()=>{
 for(const axis of ['x','y']){
  const s=valley(axis),p=riverPoint(48,s),b={type:'bridge',x:Math.round(p.x),y:Math.round(p.y),level:1};s.buildings=[b];
  const span=bridgeSpanAt(b,s),boat={transport:'river',...riverPoint(span.y,s),route:[riverPoint(span.y+2,s)],routeIndex:0};
  const pose=riverCraftPose(s,boat);assert.equal(pose.lowered,true);
  const next=boat.route[0];assert.equal(pose.yaw,Math.atan2(next.x-boat.x,next.y-boat.y));
  Object.assign(boat,riverPoint(span.y+3,s));assert.equal(riverCraftPose(s,boat).lowered,false);
  b.construction={kind:'new'};Object.assign(boat,riverPoint(span.y,s));assert.equal(riverCraftPose(s,boat).lowered,false);
 }
});
