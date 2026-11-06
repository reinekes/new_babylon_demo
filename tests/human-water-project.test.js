import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode,advanceTime} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {approveWaterProject,waterProjectProposal} from '../human-projects.js';
import {assignWorkplace,setCitizenRole} from '../management.js';
import {buildingKey} from '../definitions.js';

test('a dry household and a ready organizer can approve exactly one real waterpoint order',()=>{
 let s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house'),requester=s.citizens.find(c=>c.home===buildingKey(house));
 const organizer=s.citizens.find(c=>c.age>=16&&c.home!==requester.home);
 const x=12,y=7;
 assert.match(waterProjectProposal(s,organizer.id,requester.id,x,y).reason,/запас воды/);
 house.water=0;
 assert.ok(setCitizenRole(s,organizer.id,'builder').ok);
 organizer.hunger=40;
 const before=encode(s);
 assert.match(approveWaterProject(s,organizer.id,requester.id,x,y).reason,/голод/);
 assert.equal(encode(s),before);
 organizer.hunger=0;
 const clay=s.resources.clay;
 const result=approveWaterProject(s,organizer.id,requester.id,x,y);
 assert.ok(result.ok,result.reason);
 assert.equal(s.resources.clay,clay-12);
 assert.equal(approveWaterProject(s,organizer.id,requester.id,x,y).ok,false);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 let organizerWorked=false;
 for(let i=0;i<500&&s.buildings.find(b=>buildingKey(b)===result.key).construction;i++){
  s.event=null;advanceTime(s,.25);
  organizerWorked||=s.citizens.some(c=>c.id===organizer.id&&c.site===result.key&&c.phase==='constructing');
 }
 assert.ok(organizerWorked);
 const project=s.buildings.find(b=>buildingKey(b)===result.key);
 assert.equal(project.construction,undefined);
 assert.equal(project.humanWaterProject.organizerId,organizer.id);
 assert.equal(project.humanWaterProject.delivery,undefined);
 assert.ok(decode(encode(s)));
 const courier=s.citizens.find(c=>c.id===organizer.id);
 assert.ok(setCitizenRole(s,courier.id,'watercarrier').ok);
 assert.ok(assignWorkplace(s,courier.id,result.key).ok);
 for(let i=0;i<400&&s.citizens.find(c=>c.id===courier.id).phase!=='working';i++){s.event=null;advanceTime(s,.2);}
 s.buildings.find(b=>buildingKey(b)===requester.home).water=0;
 for(let i=0;i<900&&!project.humanWaterProject.delivery;i++){
  s.event=null;advanceTime(s,.2);
 }
 const delivery=project.humanWaterProject.delivery;

 assert.ok(delivery);
 assert.equal(delivery.courierId,courier.id);
 assert.ok(delivery.amount>0);
 assert.deepEqual(s.causalFacts.water.map(f=>[f.stationId,f.homeId,f.courierId,f.amount]),[[project.waterEntityId,project.humanWaterProject.homeId,courier.id,delivery.amount]]);
 const restored=decode(encode(s));assert.ok(restored);
 assert.deepEqual(restored.buildings.find(b=>buildingKey(b)===result.key).humanWaterProject.delivery,delivery);
});
