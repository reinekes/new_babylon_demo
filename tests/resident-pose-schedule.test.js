import test from 'node:test';import assert from 'node:assert/strict';
import {residentPoseInterval,residentPoseSlot} from '../game3d/resident-pose-schedule.js';
test('large and important people retain every-frame poses; distant figures use screen-size cadence',()=>{
 const camera={fov:Math.PI/4,position:{x:0,y:0,z:0}},point={x:0,y:0,z:20};
 assert.equal(residentPoseInterval(camera,point,720,1.7),0);
 assert.equal(residentPoseInterval(camera,{...point,z:100},720,1.7),1/15);
 assert.equal(residentPoseInterval(camera,{...point,z:400},720,1.7),1/10);
 assert.equal(residentPoseInterval(camera,{...point,z:400},720,1.7,true),0);
 assert.equal(residentPoseInterval(null,point,720,1.7),0);
});
test('small-character skeleton sampling uses real seconds, staggered slots and no gameplay state',()=>{
 const before={id:7,x:2,y:3,cargo:{clay:4}},copy=JSON.stringify(before),slots=[];
 for(let f=0;f<60;f++)slots.push(residentPoseSlot(f/60,1/15,before.id));
 assert.ok(new Set(slots).size<=16);assert.notEqual(residentPoseSlot(.04,1/15,1),residentPoseSlot(.04,1/15,9));
 assert.equal(residentPoseSlot(.04,0,1),null);assert.equal(JSON.stringify(before),copy);
});
