import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,canBuild,decode,encode} from '../engine.js';
import {BUILDINGS,buildingKey} from '../definitions.js';
import {assignWorkplace} from '../management.js';
import {invalidateAssignments,syncCitizens} from '../workforce.js';

// Exercise the real scheduler, work stage, hand-carried load and storage
// deposit independently for every direct producer, including local extraction.
for(const type of ['clay','reed','garden','logging','quarry','hunting','fishing','shrine','ziggurat'])test(`${type}: actual worker completes work, carries its output and credits a delivery`,()=>{
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}
 for(const c of s.citizens)if(c.age>=16)c.role='builder';
 let b=s.buildings.find(b=>b.type===type);
 if(!b){let location;
  if(['garden','logging','quarry'].includes(type))location=s.world.deposits.find(d=>d.kind===({garden:'dates',logging:'forest',quarry:'stone'}[type])&&!canBuild(s,type,d.x,d.y,true));
  else if(type==='hunting')location={x:5,y:15};
  else if(type==='fishing'){for(let y=3;y<14&&!location;y++)for(let x=9;x<17;x++)if(!canBuild(s,type,x,y,true)){location={x,y};break;}}
  else location={x:10,y:9};
  assert.ok(location,`placement for ${type}`);b={type,x:location.x,y:location.y,level:1};s.buildings.push(b);
 }
 const worker=s.citizens[0];worker.role='production';invalidateAssignments(s);syncCitizens(s);assert.ok(assignWorkplace(s,worker.id,buildingKey(b)).ok);
 const output=Object.keys(BUILDINGS[type].output);let worked=false,loaded=false,targetWorked=false;
 for(let i=0;i<1500;i++){
  s.event=null;advanceTime(s,.1);worked ||= worker.phase==='working';loaded ||= output.some(k=>(worker.cargo[k]||0)>0);
  targetWorked ||= type==='logging'?s.gathering.features.some(f=>f.kind==='tree'&&f.health===0):type==='quarry'?s.gathering.features.some(f=>f.kind==='rock'&&f.health<1):type==='hunting'?s.gathering.kills.length>0:type==='fishing'?s.gathering.jobs.some(j=>j.citizen===worker.id&&j.progress>0):true;
  if(i%100===0)assert.ok(decode(encode(s)),`${type} save ${i}`);
  if(output.every(k=>(s.delivered[k]||0)>0))break;
 }
 assert.ok(worked,'must reach work stage');assert.ok(targetWorked,'must actually work its resource target');assert.ok(loaded||type==='shrine','must carry physical output before delivery (shrine already is its store)');for(const k of output)assert.ok(s.delivered[k]>0,`must deposit ${k}`);
});
