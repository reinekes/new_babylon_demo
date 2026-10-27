import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,advanceTime,resolveEvent} from '../engine.js';
import {registerLoss} from '../divinity.js';
test('the opening history records the actual faith of the selected mode',()=>{const s=createGame({mode:'awakening'});assert.equal(s.lifeAnalytics.history[0].faith,0);const mature=createGame({mode:'mature'});assert.equal(mature.lifeAnalytics.history[0].faith,60);});
test('an unrecognized presence does not acquire a public divine name from losses',()=>{const s=createGame({mode:'awakening'});s.deaths=7;registerLoss(s,7);assert.equal(s.name,'Незримый дух');assert.deepEqual(s.divinity.names,[]);s.godhood.stage='recognized';registerLoss(s,7);assert.equal(s.name,'Владыка погребальных огней');});
test('real famine and funerals retain the nameless opening until a person recognizes the god',()=>{const s=createGame({mode:'awakening'});for(let i=0;i<23;i++){advanceTime(s,45);if(s.event)resolveEvent(s,'skip');}assert.ok(s.deaths>0);assert.equal(s.godhood.stage,'unseen');assert.equal(s.name,'Незримый дух');assert.deepEqual(s.divinity.names,[]);assert.equal(s.resources.faith,0);});
