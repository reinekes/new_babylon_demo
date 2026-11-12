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

test('one flock leaves the pen, grazes, drinks on dry land and returns with the same identities',async()=>{
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
  const phase=flock[0].behavior;
  if(phase!=='walking'&&visits.at(-1)!==phase)visits.push(phase);
 }
 const firstPasture=visits.indexOf('grazing');
 const water=visits.indexOf('drinking',firstPasture+1);
 assert.ok(firstPasture>=0&&water>firstPasture&&visits.indexOf('resting',water+1)>water);
});
