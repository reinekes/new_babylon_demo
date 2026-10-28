import test from 'node:test';
import assert from 'node:assert/strict';
import * as clock from '../ceremony-time.js';
import {advanceTime,encode,decode} from '../engine.js';
import {orderFestival,festivalView} from '../festival.js';
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
 advanceTime(s,.25*sync(s,4));assert.ok(Math.abs(festivalView(s).elapsed-elapsed-1)<1e-6);
 assert.deepEqual(clockOf(s),before);assert.deepEqual(s.citizens.map(c=>[c.id,c.cargo,c.buildCargo]),cargo);assert.ok(decode(encode(s)));
});
