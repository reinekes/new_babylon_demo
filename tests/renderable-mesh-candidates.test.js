import test from 'node:test';import assert from 'node:assert/strict';import {createRenderableMeshCandidates} from '../game3d/renderable-mesh-candidates.js';
const mesh=(extra={})=>({isBlocked:false,isEnabled:()=>true,isVisible:true,visibility:1,layerMask:1,...extra});
test('hidden rigs, disabled props and shadow-only proxies never incur main-pass material readiness checks',()=>{
 const visible=mesh(),hidden=mesh({isVisible:false}),disabled=mesh({isEnabled:()=>false}),proxy=mesh({layerMask:0}),blocked=mesh({isBlocked:true});const scene={meshes:[visible,hidden,disabled,proxy,blocked],activeCamera:{layerMask:1}},read=createRenderableMeshCandidates(scene);
 assert.deepEqual(read().data,[visible]);assert.equal(scene.meshes.length,5);
 hidden.isVisible=true;disabled.isEnabled=()=>true;assert.deepEqual(read().data,[visible,hidden,disabled]);
});
test('candidate storage is reused while additions, camera layers and intersection actions stay live',()=>{
 const a=mesh(),b=mesh({layerMask:2}),intersect=mesh({isVisible:false,actionManager:{}}),scene={meshes:[a,b,intersect],activeCamera:{layerMask:1}},read=createRenderableMeshCandidates(scene),buffer=read();
 assert.deepEqual(buffer.data,[a,intersect]);scene.activeCamera.layerMask=2;assert.equal(read(),buffer);assert.deepEqual(buffer.data,[b,intersect]);scene.meshes.push(mesh({layerMask:2}));assert.equal(read().length,3);
});
test('offscreen meshes skip readiness but actions, billboards, forced-active and skip-frustum remain valid',()=>{
 let matrices=0;const off=mesh({computeWorldMatrix:()=>matrices++,isInFrustum:()=>false}),inside=mesh({isInFrustum:()=>true}),forced=mesh({alwaysSelectAsActiveMesh:true,isInFrustum:()=>false}),billboard=mesh({billboardMode:1,isInFrustum:()=>false}),action=mesh({actionManager:{},isInFrustum:()=>false});
 const scene={meshes:[off,inside,forced,billboard,action],activeCamera:{layerMask:1},frustumPlanes:[{}]},read=createRenderableMeshCandidates(scene);
 assert.deepEqual(read().data,[inside,forced,billboard,action]);assert.equal(matrices,1);
 scene.skipFrustumClipping=true;assert.equal(read().length,5);
});
test('whole offscreen fish/person hierarchies are rejected once, without visiting every part matrix',()=>{
 let roots=0,parts=0;const owner={metadata:{animalKind:'fish'},getAbsolutePosition(){roots++;return {x:100,y:0,z:0}}};
 const part=()=>mesh({parent:owner,computeWorldMatrix(){parts++},isInFrustum:()=>false}),scene={meshes:[part(),part(),part()],activeCamera:{layerMask:1},frustumPlanes:[{dotCoordinate:p=>10-p.x}]};
 const read=createRenderableMeshCandidates(scene);assert.equal(read().length,0);assert.equal(roots,1);assert.equal(parts,0);
 owner.getAbsolutePosition=()=>({x:0,y:0,z:0});scene.meshes.forEach(m=>m.isInFrustum=()=>true);assert.equal(read().length,3);
});
test('subpixel parts disappear only from rendering and return on zoom; visible silhouettes remain',()=>{
 const eye={x:0,y:0,z:0},camera={layerMask:1,position:eye,fov:.8},part=(radius,z)=>mesh({getBoundingInfo:()=>({boundingSphere:{centerWorld:{x:0,y:0,z},radiusWorld:radius}})}),fine=part(.01,700),body=part(1,700),scene={meshes:[fine,body],activeCamera:camera,getEngine:()=>({getRenderHeight:()=>720})},read=createRenderableMeshCandidates(scene);
 assert.deepEqual(read().data,[body]);eye.z=695;assert.deepEqual(read().data,[fine,body]);assert.equal(scene.meshes.length,2);
});
test('frustum and screen-size checks share one world-matrix update per candidate',()=>{
 let matrices=0;const part=mesh({computeWorldMatrix(){matrices++;},isInFrustum:()=>true,getBoundingInfo:()=>({boundingSphere:{centerWorld:{x:0,y:0,z:100},radiusWorld:1}})});
 const scene={meshes:[part],activeCamera:{layerMask:1,position:{x:0,y:0,z:0},fov:.8},frustumPlanes:[{}],getEngine:()=>({getRenderHeight:()=>720})};
 assert.deepEqual(createRenderableMeshCandidates(scene)().data,[part]);assert.equal(matrices,1);
});
test('conservatively subpixel fish details skip world transforms and return near the camera',()=>{
 const root={metadata:{animalKind:'fish',fishModelRadius:.04},getAbsolutePosition:()=>({x:0,y:0,z:100})},centerWorld={x:0,y:0,z:100};
 let computed=0;
 const part=mesh({parent:root,computeWorldMatrix:()=>computed++,isInFrustum:()=>true,getBoundingInfo:()=>({boundingSphere:{centerWorld,radiusWorld:.03}})});
 const view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],camera={layerMask:1,position:{x:0,y:0,z:0},fov:.8,getViewMatrix:()=>({m:view})};
 const scene={meshes:[part],activeCamera:camera,frustumPlanes:[{dotCoordinate:()=>10}],getEngine:()=>({getRenderHeight:()=>720})};
 const read=createRenderableMeshCandidates(scene);
 assert.equal(read().length,0);assert.equal(computed,0);
 view[14]=-98;assert.deepEqual(read().data,[part]);assert.equal(computed,1);
});
test('frozen building part culling is reused until camera or world matrix changes',()=>{
 let tests=0;
 const view=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],transform=[...view],world={updateFlag:1};
 const camera={layerMask:1,position:{x:0,y:0,z:0},fov:.8,getViewMatrix:()=>({m:view})};
 let visible=true;
 const part=mesh({metadata:{tile:{x:0,y:0}},isWorldMatrixFrozen:true,geometry:{},getWorldMatrix:()=>world,isInFrustum:()=>{tests++;return visible;}});
 const scene={meshes:[part],activeCamera:camera,frustumPlanes:[{}],getTransformMatrix:()=>({m:transform}),getEngine:()=>({getRenderHeight:()=>720})};
 const read=createRenderableMeshCandidates(scene);
 assert.deepEqual(read().data,[part]);assert.deepEqual(read().data,[part]);assert.equal(tests,1);
 visible=false;transform[14]=3;assert.equal(read().length,0);assert.equal(tests,2);
 visible=true;world.updateFlag++;assert.deepEqual(read().data,[part]);assert.equal(tests,3);
 part.geometry={};assert.deepEqual(read().data,[part]);assert.equal(tests,4);
 part.isVisible=false;assert.equal(read().length,0);assert.equal(tests,4);
});
