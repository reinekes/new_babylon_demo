import {workstationFor,workstationHands,workstationLayout,workstationWorldPoint,workstationBuilding} from '../game3d/workstations.js';
import test from 'node:test';import assert from 'node:assert/strict';
import {dairyHerd,dairyPose} from '../game3d/dairy-herd.js';
test('visible cows and calves follow only real operational dairy records and stable IDs',()=>{
 const s={buildings:[{type:'cowshed',x:3,y:4,level:1,dairy:{cows:3,calves:2}}]},before=JSON.stringify(s),herd=dairyHerd(s);
 assert.equal(herd.length,5);assert.equal(herd.filter(a=>a.calf).length,2);assert.equal(new Set(herd.map(a=>a.id)).size,5);assert.equal(JSON.stringify(s),before);assert.notDeepEqual(dairyPose(herd[1],0),dairyPose(herd[1],4));assert.deepEqual(dairyHerd(JSON.parse(before)),herd);
 s.buildings[0].construction={kind:'new'};assert.equal(dairyHerd(s).length,0);
});

test('milking palms and visible udder share one contact through all rotations',()=>{for(const rotation of [0,1,2,3]){const raw={type:'cowshed',x:3,y:4,rotation,dairy:{cows:3,calves:2}},state={buildings:[raw]},b=workstationBuilding(raw,state),cow=dairyHerd(state)[0],udder={x:cow.anchor.x*6-.34*Math.sin(cow.yaw),z:cow.anchor.y*6-.34*Math.cos(cow.yaw),y:.45};for(const index of [0,1]){const a=workstationLayout(b)[0],stand=workstationWorldPoint(b,[a.x+(index?a.sx*.48:0),0,a.z+(index?0:a.sz*.48)]),c={x:stand.x,y:stand.y,activity:{stage:'working',task:'cowshed'}};const contact=workstationFor(b,c,index);assert.ok(contact);const h=workstationHands(contact,0);for(const hand of [h.left,h.right])assert.ok(Math.hypot(hand.x*6-udder.x,hand.y*6-udder.z,hand.height-udder.y)<.31,'hands touch the udder');}}});
