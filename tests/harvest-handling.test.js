import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,advanceTime,advanceFrame,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {invalidateAssignments,syncCitizens} from '../workforce.js';
import {actorWorkActivity} from '../labor-life.js';
import {stockStores} from '../inventory.js';
import {animalsFor} from '../fauna.js';
import {startRichCatch} from '../rich-catch.js';
import {fishingLift} from '../game3d/harvest-gear.js';
import {useOneDayCalendar} from '../calendar.js';
import {setFishRackEnabled} from '../fish-drying.js';

function settlement(type,x,y){
 const s=createGame({start:'established',scenario:strictScenario(),seed:137});
 const store=stockStores(s)[0];
 for(const k of Object.keys(store.stock)){
  const added=Math.max(0,(k==='food'?30:200)-store.stock[k]);store.stock[k]+=added;s.resources[k]+=added;
 }
 assert.ok(build(s,type,x,y,0,{instant:true}).ok);
 const [worker,carrier]=s.citizens.filter(c=>c.age>=16);
 Object.assign(worker,{workplace:x+','+y,role:'production',calling:type==='hunting'?'hunter':'fisher'});carrier.role='carrier';
 invalidateAssignments(s);syncCitizens(s);
 return {s,worker:worker.id,site:worker.workplace};
}

for(const [kind,x,y,stages] of [
 ['fishing',5,13,['take-rod','cast','wait','lift','load','output','porter']],
 ['hunting',10,9,['lift-game','haul-game','dress-game','output','porter']]
])test(kind+' carries one harvest through the workshop and a real store, including reloads',()=>{
 const setup=settlement(kind,x,y),seen=new Set();let s=setup.s,shipment=null,prey=null,load=0;
 for(let i=0;i<650;i++){
  s.event=null;advanceTime(s,.1);
  const c=s.citizens.find(p=>p.id===setup.worker),b=s.buildings.find(b=>b.type===kind),a=actorWorkActivity(s,c,[]);
  const output=b.workshopStock?.output?.food||0;let stage=a?.task;
  if(kind==='fishing'&&stage==='fishing'&&['working','strike'].includes(a.stage))stage=fishingLift(a.progress).phase;
  if(c.cargo.food>0&&c.phase==='toWorkshop'){
   if(!load)load=c.cargo.food;
   if(kind==='fishing')stage='load';
  }
  if(kind==='hunting'&&stage==='lift-game'&&!prey){
   prey=a.target.id;assert.equal(c.cargo.food||0,0);assert.ok(animalsFor(s).find(animal=>animal.id===prey)?.dead);
  }
  if(kind==='hunting'&&['haul-game','dress-game'].includes(stage)&&!seen.has(stage)){
   const animal=animalsFor(s).find(animal=>animal.id===prey);
   assert.equal(a.prey,prey);assert.equal(animal.hauler,c.id);assert.ok(c.cargo.hides>0);assert.equal(output,0);
   assert.equal(animal.carcassHeight>0,stage==='dress-game');
  }
  if(output&&!seen.has('output')){
   stage='output';assert.equal(output,load);
   if(kind==='hunting'){assert.ok(b.workshopStock.output.hides>0);assert.equal(animalsFor(s).some(animal=>animal.id===prey),false);}
  }
  if(!shipment)for(const porter of s.citizens){
   const job=porter.phase==='toDistrictStore'&&s.district.jobs.find(j=>j.id===porter.districtJob&&j.source===setup.site&&j.resource==='food');
   if(job){shipment=job.id;stage='porter';assert.notEqual(c.id,porter.id);assert.equal(porter.cargo.food,load);break;}
  }
  if(stages.includes(stage)&&!seen.has(stage)){
   seen.add(stage);const restored=decode(encode(s));assert.ok(restored,'reload '+stage);
   assert.deepEqual(restored.gathering,s.gathering);assert.deepEqual(restored.citizens.map(c=>[c.id,c.cargo]),s.citizens.map(c=>[c.id,c.cargo]));s=restored;
  }
  const job=shipment&&s.district.jobs.find(j=>j.id===shipment);
  if(job?.delivered===load&&load>0){assert.ok(stockStores(s).some(b=>b.x+','+b.y===job.target&&b.stock.food>=load));break;}
 }
 assert.deepEqual([...seen],stages);
 assert.equal(s.district.jobs.find(j=>j.id===shipment)?.delivered,load);assert.ok(load>0);
});

test('confirmed first bite holds the real fisher for eight viewing seconds on 1× and 4×',()=>{
 const {s,worker}=settlement('fishing',5,13),b=s.buildings.find(b=>b.type==='fishing');
 startRichCatch(s,b);
 let fisher=s.citizens.find(c=>c.id===worker);
 for(let i=0;i<1000&&!fisher.fishingLanding;i++){s.event=null;advanceTime(s,.08);fisher=s.citizens.find(c=>c.id===worker);}
 assert.ok(fisher.fishingLanding?.firstBlessed);assert.equal(b.richCatch.charges,5);
 assert.equal(fisher.cargo.food,7.5);
 for(const speed of [1,4]){
  const state=structuredClone(s),c=state.citizens.find(person=>person.id===worker),yard=state.buildings.find(b=>b.type==='fishing');
  const elapsed=c.fishingLanding.elapsed,start={x:c.x,y:c.y};
  for(let i=0;i<30;i++)advanceFrame(state,.1,speed);
  assert.ok(Math.abs(c.fishingLanding.elapsed-elapsed-3)<1e-6);
  assert.equal(actorWorkActivity(state,c,[]).task,'land-fish');assert.deepEqual({x:c.x,y:c.y},start);
  for(let i=0;i<55;i++)advanceFrame(state,.1,speed);
  assert.equal(c.fishingLanding,undefined);assert.equal(yard.richCatch.charges,5);
 }
});

test('landing and hanging a catch consume equal work time at 1× and 25× in the one-day calendar',()=>{
 const {s,worker}=settlement('fishing',5,13),yard=s.buildings.find(b=>b.type==='fishing');
 useOneDayCalendar(s);
 assert.ok(setFishRackEnabled(s,yard,true).ok);
 startRichCatch(s,yard);
 const fisherIn=state=>state.citizens.find(c=>c.id===worker);
 const fishUntil=predicate=>{
  for(let i=0;i<2600&&!predicate(fisherIn(s));i++)advanceTime(s,.1);
  assert.ok(predicate(fisherIn(s)));
 };
 const compareHeldPose=(task,steps,isHeld)=>{
  const normal=structuredClone(s),fast=structuredClone(s);
  const start={x:fisherIn(s).x,y:fisherIn(s).y};
  for(let i=0;i<steps;i++){
   advanceFrame(normal,.125,1);
   advanceFrame(fast,.125/25,25);
  }
  const a=fisherIn(normal),b=fisherIn(fast),normalPose=actorWorkActivity(normal,a,[]),fastPose=actorWorkActivity(fast,b,[]);
  assert.ok(Math.abs(normal.simTime-fast.simTime)<1e-7);
  assert.equal(normalPose.task,task);
  assert.equal(fastPose.task,task);
  assert.ok(Math.abs(normalPose.progress-fastPose.progress)<1e-7);
  assert.deepEqual({x:a.x,y:a.y},start);
  assert.deepEqual({x:b.x,y:b.y},start);
  for(let i=0;i<100&&isHeld(a);i++){
   advanceFrame(normal,.125,1);
   advanceFrame(fast,.125/25,25);
   assert.equal(isHeld(b),isHeld(a));
  }
  assert.equal(isHeld(a),false);
  assert.deepEqual(a.cargo,b.cargo);
 };

 fishUntil(c=>!!c.fishingLanding?.firstBlessed);
 compareHeldPose('land-fish',24,c=>!!c.fishingLanding);
 fishUntil(c=>c.hangingFishElapsed!==undefined);
 compareHeldPose('hang-fish',6,c=>c.hangingFishElapsed!==undefined);
});
