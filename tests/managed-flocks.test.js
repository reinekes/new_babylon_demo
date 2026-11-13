import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime,advanceSeason} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {startManagedFlock,settleManagedFlocks,advanceTextiles,flockSize} from '../textiles.js';
import {animalsFor} from '../fauna.js';
import {putStock} from '../inventory.js';

test('managed sheep consume one ration, mature and breed within pen capacity, and lose young first',()=>{
 const b={type:'sheepfold',x:10,y:9,level:2};
 const s={buildings:[b],season:0};
 startManagedFlock(b);
 b.flock.reed=2;settleManagedFlocks(s);
 assert.deepEqual(b.flock,{adults:4,lambs:1,reed:0,shortage:0,fleece:4,pasture:0});
 assert.equal(flockSize(b),5);
 s.season=1;settleManagedFlocks(s);
 advanceTextiles(s,30);assert.equal(b.flock.fleece,4);
 s.season=2;settleManagedFlocks(s);
 assert.equal(b.flock.lambs,0);assert.equal(b.flock.adults,4);assert.equal(flockSize(b),4);
 s.season=3;b.flock.reed=2;settleManagedFlocks(s);
 assert.equal(b.flock.shortage,0);
 advanceTextiles(s,30);assert.ok(b.flock.fleece>4);
});

test('porters supply the managed fold, the calendar consumes feed and visuals reflect saved animals',()=>{
 let s=createGame({start:'established',scenario:strictScenario()});
 const managed={type:'sheepfold',x:10,y:9,level:1},old={type:'sheepfold',x:11,y:9,level:1,flock:{fleece:4}};
 startManagedFlock(managed);s.buildings.push(managed,old);
 for(const b of s.buildings)if(b.type==='house')Object.assign(b,{pantry:40,pantryDelivered:40});
 const visual=()=>animalsFor(s).filter(a=>a.id.startsWith('sheep-10-9-'));
 assert.equal(visual().length,4);assert.equal(visual().filter(a=>a.young).length,1);
 assert.ok(putStock(s,'9,8','reed',15)>0);
 for(let i=0;i<90&&managed.flock.reed<2;i++)advanceTime(s,.25);
 assert.equal(managed.flock.reed,2);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 advanceSeason(s);
 assert.equal(s.buildings.find(b=>b.x===10&&b.y===9).flock.adults,4);
 assert.equal(s.buildings.find(b=>b.x===10&&b.y===9).flock.pasture,1);
 assert.equal(visual().length,4);assert.equal(visual().some(a=>a.young),false);
 assert.deepEqual(Object.keys(s.buildings.find(b=>b.x===11&&b.y===9).flock),['fleece']);
 assert.ok(decode(encode(s)));
});

test('one flock leaves the pen, grazes and returns with the same identities',async()=>{
 const {createGame}=await import('../engine.js');
 const {isDryPoint}=await import('../world.js');
 const city=createGame({start:'established'});
 city.buildings.push({type:'sheepfold',x:9,y:15,level:1});
 let ids;
 const visits=[];
 for(let step=0;step<300;step++){
  city.simTime=step*.4;
  const flock=animalsFor(city).filter(a=>a.id.startsWith('sheep-9-15-'));
  ids??=flock.map(a=>a.id);
  assert.deepEqual(flock.map(a=>a.id),ids);
  assert.ok(flock.every(a=>isDryPoint(city,a.x,a.y)));
  for(const [index,sheep] of flock.entries()){
   for(const other of flock.slice(index+1))assert.ok(Math.hypot(sheep.x-other.x,sheep.y-other.y)>=.19);
  }
  const phase=flock[0].behavior;
  if(phase!=='walking'&&visits.at(-1)!==phase)visits.push(phase);
 }
 const firstPasture=visits.indexOf('grazing');
 assert.ok(firstPasture>=0&&visits.indexOf('resting',firstPasture+1)>firstPasture);
});

test('flocks cross only the shared opening on all four orientations and both saved footprints',async()=>{
 const {sheepfoldGateSide,sheepfoldLayout}=await import('../sheepfold-layout.js');
 const city=createGame({start:'established',seed:137});
 for(const footprint of [1,2])for(const rotation of [0,1,2,3]){
  const building={type:'sheepfold',x:13,y:7,footprint,level:3,rotation};
  city.buildings=[building];
  const {halfWidth,gateHalfWidth}=sheepfoldLayout(building);
  const center=(footprint-1)*.5,angle=(rotation+sheepfoldGateSide(building,city))*Math.PI/2;
  let crossed=0,previous=new Map();
  for(let step=0;step<=700;step++){
   city.simTime=step*.2;
   const flock=animalsFor(city).filter(a=>a.kind==='sheep');
   for(const animal of flock){
    const dx=(animal.x-building.x-center)*6,dz=(animal.y-building.y-center)*6;
    const x=dx*Math.cos(angle)-dz*Math.sin(angle),z=dx*Math.sin(angle)+dz*Math.cos(angle);
    const inside=Math.max(Math.abs(x),Math.abs(z))<=halfWidth;
    const from=previous.get(animal.id);
    if(from&&from.inside!==inside){
     assert.ok(x>halfWidth-.35&&from.x>halfWidth-.35);
     assert.ok(Math.abs(z)<gateHalfWidth-.15&&Math.abs(from.z)<gateHalfWidth-.15);
     crossed++;
    }
    previous.set(animal.id,{inside,x,z});
   }
  }
  assert.ok(crossed>=8,`footprint=${footprint}, rotation=${rotation}`);
 }
});

test('sheep stay in their pen through the day when there is no reachable fertile pasture',()=>{
 const city=createGame({start:'established',seed:137});
 city.buildings=[{type:'sheepfold',x:3,y:3,level:1}];
 for(let step=0;step<=300;step++){
  city.simTime=step*.2;
  const flock=animalsFor(city).filter(animal=>animal.kind==='sheep');
  assert.equal(flock.length,4);
  assert.ok(flock.every(a=>Math.abs(a.x-3)<.42&&Math.abs(a.y-3)<.42&&!a.walking),`outside at ${city.simTime}`);
 }
});

test('sheep use suitable pasture by day and are back inside before dusk',()=>{
 const city=createGame({start:'established'});
 const b={type:'sheepfold',x:9,y:15,level:1};
 city.buildings.push(b);
 const modes=new Set();
 for(let step=0;step<=300;step++){
  city.simTime=step*.2;
  const hour=(8+city.simTime*.4)%24;
  const flock=animalsFor(city).filter(a=>a.kind==='sheep');
  for(const animal of flock){
   if(hour<6.5||hour>=17.5)assert.ok(Math.abs(animal.x-b.x)<.42&&Math.abs(animal.y-b.y)<.42,`outside at ${hour}`);
   if(animal.behavior==='grazing')modes.add('grazing');
  }
 }
 assert.ok(modes.has('grazing'));
});
