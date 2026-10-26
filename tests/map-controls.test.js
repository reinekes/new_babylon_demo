import test from 'node:test';import assert from 'node:assert/strict';import {bindMapControls} from '../game3d/map-controls.js';
function fixture(){const handlers={},clicks=[],camera={alpha:1,beta:1,radius:50,lowerBetaLimit:.18,upperBetaLimit:1.48,target:{x:0,y:0,z:0}};const canvas={addEventListener:(n,f)=>handlers[n]=f,removeEventListener:n=>delete handlers[n],setPointerCapture(){},releasePointerCapture(){}};const off=bindMapControls(canvas,{camera,groundAt:(x,y)=>({x:x/10+camera.target.x,y:0,z:y/10+camera.target.z}),onClick:(x,y)=>clicks.push([x,y]),onHover(){}});const fire=(type,id,x,y,button=0,extra={})=>{let prevented=false;handlers[type]?.({pointerId:id,clientX:x,clientY:y,button,preventDefault(){prevented=true;},...extra});return prevented;};return {camera,clicks,fire,off,handlers};}
test('2D-style dragging pans without rotating or placing buildings',()=>{const f=fixture();f.fire('pointerdown',1,100,100);f.fire('pointermove',1,130,120);f.fire('pointermove',1,140,130);f.fire('pointerup',1,140,130);assert.deepEqual(f.camera.target,{x:-4,y:0,z:-3});assert.equal(f.clicks.length,0);f.fire('pointerdown',1,100,100,2);f.fire('pointermove',1,120,100,2);f.fire('pointerup',1,120,100,2);assert.equal(f.camera.target.x,-6);assert.equal(f.camera.alpha,1);assert.equal(f.camera.beta,1);});
test('short click selects, two-finger zoom never places a building',()=>{const f=fixture();f.fire('pointerdown',1,100,100);f.fire('pointerup',1,101,100);assert.equal(f.clicks.length,1);f.fire('pointerdown',1,100,100);f.fire('pointerdown',2,120,100);f.fire('pointermove',2,140,100);assert.equal(f.camera.radius,25);f.fire('pointerup',2,140,100);f.fire('pointerup',1,100,100);assert.equal(f.clicks.length,1);f.off();assert.equal(Object.keys(f.handlers).length,0);});
test('held middle drag orbits both axes around the same map target without zoom or selection',()=>{
 const f=fixture();assert.equal(f.fire('pointerdown',1,100,100,1),true,'middle press prevents browser autoscroll');
 f.fire('pointermove',1,140,120,1);assert.ok(f.camera.alpha<1);assert.ok(f.camera.beta<1);assert.deepEqual(f.camera.target,{x:0,y:0,z:0});assert.equal(f.camera.radius,50);
 const pose={alpha:f.camera.alpha,beta:f.camera.beta};f.fire('pointerup',1,140,120,1);f.fire('pointermove',1,180,150);assert.equal(f.clicks.length,0);assert.equal(f.camera.alpha,pose.alpha);assert.equal(f.camera.beta,pose.beta);
 assert.equal(f.fire('auxclick',1,140,120,1),true);
});
test('middle orbit stays above ground and reverses immediately after reaching either tilt limit',()=>{
 const f=fixture();f.fire('pointerdown',1,100,100,1);f.fire('pointermove',1,100,10000,1);assert.equal(f.camera.beta,.18);f.fire('pointermove',1,100,9990,1);assert.ok(f.camera.beta>.18);
 f.fire('pointermove',1,100,-10000,1);assert.equal(f.camera.beta,1.48);f.fire('pointermove',1,100,-9990,1);assert.ok(f.camera.beta<1.48);assert.deepEqual(f.camera.target,{x:0,y:0,z:0});
});
test('lost pointer capture cancels orbit, and subsequent left clicks still select normally',()=>{
 const f=fixture();f.fire('pointerdown',1,100,100,1);f.fire('pointermove',1,120,110,1);assert.ok(f.camera.alpha<1);f.fire('lostpointercapture',1,120,110,1);const alpha=f.camera.alpha;f.fire('pointermove',1,150,110,1);assert.equal(f.camera.alpha,alpha);
 f.fire('pointerdown',1,100,100);f.fire('pointerup',1,100,100);assert.equal(f.clicks.length,1);
});
