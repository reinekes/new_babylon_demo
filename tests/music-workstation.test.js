import test from 'node:test';import assert from 'node:assert/strict';
import {workstationFor,workstationHands,workstationBuilding,workstationWorldPoint} from '../game3d/workstations.js';
import {workplaceActivity,workplaceIndex,WORK_POSES} from '../game3d/work-poses.js';
import {musicCourtyardLayout} from '../game3d/music-courtyard.js';
test('the music pose follows real working eligibility and palms aim at separate stone petals through all rotations',()=>{
 for(const rotation of [0,1,2,3]){const b={type:'musicHouse',x:6,y:10,level:1,rotation},c={id:1,age:30,phase:'working',role:'production',calling:'musician',work:'6,10',workplace:'6,10',x:6.5,y:10.5,cargo:{},buildCargo:{}},s={simTime:4,buildings:[b],citizens:[c]};
  const activity=workplaceActivity(s,c,workplaceIndex(s));assert.equal(activity.kind,'music');assert.equal(activity.stage,'working');assert.ok(WORK_POSES.has('music'));c.activity=activity;
  const contact=workstationFor(activity.target,c,0);assert.ok(contact);assert.equal(contact.kind,'lithophone');const a=musicCourtyardLayout(workstationBuilding(b,s)),seat=workstationWorldPoint(b,[a.x,0,a.z]);assert.ok(Math.hypot(contact.stand.x-seat.x,contact.stand.y-seat.y)<1e-8);
  const h=workstationHands(contact,0);assert.ok(h.strikes);assert.ok(Math.hypot(h.left.x-h.right.x,h.left.y-h.right.y)>.05);for(const side of ['left','right'])assert.ok(h[side].height-h.strikes[side].height>.2);
  c.calling='potter';assert.equal(workplaceActivity(s,c,workplaceIndex(s)).stage,'waiting');
 }
});
test('only an adopted musical calling receives its muted green shoulder wrap',async()=>{const {professionClothing}=await import('../game3d/profession-clothing.js'),c={age:30,calling:'musician',role:'production'};assert.equal(professionClothing(c)?.shape,'sash');c.calling='auto';assert.equal(professionClothing(c),null);});
