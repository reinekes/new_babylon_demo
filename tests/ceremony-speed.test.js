import test from 'node:test';
import assert from 'node:assert/strict';
import * as clock from '../ceremony-time.js';
import {BASE_TIME_RATE,simulationRate} from '../calendar.js';
import {advanceFrame,advanceTime,encode,decode,miracle} from '../engine.js';
import {orderFestival,festivalView,FESTIVAL_SECONDS} from '../festival.js';
import {advanceMiracleCelebration} from '../miracle-celebration.js';
import {startFuneral,advanceFuneral,funeralView} from '../funerals.js';
import {testingCity,advanceUntil,clockOf} from './helpers/testing-ceremonies.js';

function controller(){assert.equal(typeof clock.createCeremonySpeedControl,'function','ceremonies need a one-time speed reset');return clock.createCeremonySpeedControl();}

test('a funeral resets 4x once while manual acceleration survives its stages and pause',()=>{
 const sync=controller(),s={funeral:null,festival:null};
 assert.equal(sync(s,4),4);
 s.funeral={stage:'gathering'};assert.equal(sync(s,4),1);
 assert.equal(sync(s,2),2);assert.equal(sync(s,4),4);
 s.funeral.stage='procession';assert.equal(sync(s,4),4);
 assert.equal(sync(s,4),4,'an unchanged paused ceremony must not reset the selected speed');
 s.funeral=null;assert.equal(sync(s,4),4,'finishing must not restore an earlier speed');
 s.funeral={stage:'gathering'};assert.equal(sync(s,4),1,'each later funeral starts at 1x');
});

test('a feast resets on actual celebration, then a new funeral resets the manual choice again',()=>{
 const sync=controller(),s={festival:{stage:'supplying'},funeral:null};
 assert.equal(sync(s,4),4);s.festival.stage='waiting';assert.equal(sync(s,4),4);
 s.festival.stage='celebrating';assert.equal(sync(s,4),1);
 assert.equal(sync(s,4),4);assert.equal(sync(s,2),2);
 s.funeral={stage:'gathering'};assert.equal(sync(s,4),1);
});

test('a restored active ceremony starts at 1x without changing saved state',()=>{
 for(const s of [{funeral:{stage:'farewell'}},{festival:{stage:'celebrating'}}]){
  const before=JSON.stringify(s),sync=controller();assert.equal(sync(s,4),1);assert.equal(sync(s,4),4);assert.equal(JSON.stringify(s),before);
 }
});

test('manual feast acceleration advances ceremony time while the calendar and cargo stay frozen',()=>{
 const sync=controller(),s=testingCity();assert.ok(orderFestival(s).ok);
 assert.equal(sync(s,4),4);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));
 assert.equal(sync(s,4),1);
 const before=clockOf(s),elapsed=festivalView(s).elapsed,cargo=s.citizens.map(c=>[c.id,c.cargo,c.buildCargo]);
 const legacy=decode(encode(s));advanceFrame(legacy,.125,10);
 advanceFrame(s,.125,sync(s,25));
 assert.ok(Math.abs(festivalView(legacy).elapsed-elapsed-1.25)<1e-6);
 assert.ok(Math.abs(festivalView(s).elapsed-elapsed-3.125)<1e-6);
 assert.deepEqual(clockOf(s),before);assert.deepEqual(s.citizens.map(c=>[c.id,c.cargo,c.buildCargo]),cargo);assert.ok(decode(encode(s)));
});

test('a funeral resets 25× once, then respects the same manual speed as the city',()=>{
 const s=testingCity(),sync=controller();
 assert.equal(sync(s,25),25);
 startFuneral(s,[{id:1000,name:'Покойный',x:8,y:8}]);
 assert.equal(sync(s,25),1);
 const before=clockOf(s),legacy=decode(encode(s));
 advanceFrame(legacy,.0625,10);
 advanceFrame(s,.0625,sync(s,25));
 assert.ok(legacy.funeral.timer>0);
 assert.ok(Math.abs(s.funeral.timer-legacy.funeral.timer*2.5)<1e-6);
 assert.deepEqual(clockOf(s),before);
});

test('all crews cover the same route positions when procession time is accelerated to 25×',()=>{
 const normal=testingCity(),sync=controller();
 startFuneral(normal,[{id:1000,name:'Покойный',x:8,y:8},{id:1001,name:'Покойная',x:8,y:8}]);
 assert.equal(sync(normal,25),1);
 for(let i=0;i<2000&&normal.funeral.stage!=='procession';i++)advanceFuneral(normal,.1);
 assert.equal(normal.funeral.stage,'procession');
 const fast=decode(encode(normal));assert.ok(fast);
 const before=clockOf(normal),old=funeralView(normal).biers;
 for(let i=0;i<25;i++)advanceFrame(normal,.125,1);
 const resumed=controller();assert.equal(resumed(fast,25),1);
 advanceFrame(fast,.125,resumed(fast,25));
 assert.equal(normal.funeral.stage,'procession');assert.equal(fast.funeral.stage,'procession');
 const positions=funeralView(normal).biers;
 for(const [i,bier] of funeralView(fast).biers.entries()){
  assert.ok(Math.hypot(bier.x-positions[i].x,bier.y-positions[i].y)<.005);
  assert.ok(Math.hypot(bier.x-old[i].x,bier.y-old[i].y)>.1);
 }
 assert.deepEqual(clockOf(fast),before);assert.deepEqual(clockOf(normal),before);
});

test('the remainder of a frame after a miracle or feast resumes at city speed',()=>{
 const miracleCity=testingCity();assert.ok(miracle(miracleCity,'cat').ok);
 advanceMiracleCelebration(miracleCity,miracleCity.miracleCelebration.duration-.375);
 const feastCity=testingCity();assert.ok(orderFestival(feastCity).ok);
 assert.ok(advanceUntil(feastCity,state=>state.festival?.stage==='celebrating'));
 advanceTime(feastCity,FESTIVAL_SECONDS-.375-festivalView(feastCity).elapsed);
 for(const city of [miracleCity,feastCity]){
  const start=city.simTime;
  advanceFrame(city,.125,25);
  assert.equal(clock.ceremonyActive(city),false);
  assert.ok(Math.abs(city.simTime-start-(3.125-.375)*BASE_TIME_RATE)<1e-6);
 }
});

test('a feast starting mid-frame uses 1× for the unspent real time',()=>{
 const city=testingCity();assert.ok(orderFestival(city).ok);
 const initial=encode(city);let steps=0;
 while(steps<3000&&city.festival?.stage!=='celebrating'){advanceTime(city,.1);steps++;}
 assert.equal(city.festival?.stage,'celebrating');
 const before=decode(initial);
 for(let i=1;i<steps;i++)advanceTime(before,.1);
 const split=decode(encode(before));
 const firstPart=.1/simulationRate(25);
 advanceFrame(split,firstPart,25);
 assert.equal(split.festival?.stage,'celebrating');
 advanceFrame(split,.25-firstPart,1);
 advanceFrame(before,.25,25);
 assert.equal(before.simTime,split.simTime);
 assert.ok(Math.abs(festivalView(before).elapsed-festivalView(split).elapsed)<1e-6);
});

test('the city resumes at 25× in the same frame that the farewell ends',()=>{
 const city=testingCity();
 for(const c of city.citizens.filter(c=>c.age>=16)){c.cargo={clay:1};c.phase='toStore';}
 startFuneral(city,[{id:1000,name:'Покойный',x:8,y:8}]);
 assert.deepEqual(city.funeral.bearers,[]);
 const start=city.simTime;
 advanceFrame(city,.15625,25);
 assert.equal(city.simTime,start);assert.ok(Math.abs(city.funeral.timer-3.90625)<1e-6);
 advanceFrame(city,.125,25);
 assert.equal(city.funeral,null);
 assert.ok(Math.abs(city.simTime-start-((.15625+.125)*25-5)*BASE_TIME_RATE)<1e-6);
});
