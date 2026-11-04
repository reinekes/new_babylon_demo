import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,build,resolveEvent,miracle,encode,decode} from '../engine.js';
import {beginFirstSign} from '../godhood.js';
import {inspireCitizen} from '../management.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
test('new founders can earn their first cat through a legal lake fishery and actual accepted catches',()=>{
 let s=createGame({mode:'awakening',seed:137,scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 const until=(pred,seconds)=>{const end=s.simTime+seconds;while(!pred()&&s.simTime<end&&!s.lost){if(s.event)resolveEvent(s,'skip');advanceTime(s,.1);}return pred();};
 assert.equal(s.resources.faith,0);const sign=beginFirstSign(s);assert.equal(sign.ok,true);assert.ok(until(()=>s.godhood.stage==='recognized',60));assert.equal(s.resources.faith,1);assert.equal(inspireCitizen(s,sign.citizenId,'builder').success,true);
 assert.equal(build(s,'fishing',16,7).ok,true);assert.equal(build(s,'granary',11,7).ok,true);
 assert.ok(until(()=>Object.values(s.catFishing.lessons).some(n=>n===3),400),'three genuine fishing operations must be fully admitted by stock');assert.ok(s.delivered.food>=15);assert.equal(s.pests.cats.length,0);
 assert.ok(until(()=>s.resources.faith>=1,600),'the town must earn the existing one-faith inspiration price without a test grant');
 const id=Number(Object.entries(s.catFishing.lessons).find(([,n])=>n===3)[0]);assert.equal(inspireCitizen(s,id,'fisher').success,true);s=decode(encode(s));assert.ok(s);assert.ok(until(()=>s.catDiscovery.phase==='opened',120));assert.equal(s.pests.cats.length,0);assert.equal(s.catDiscovery.trial,'ready');
 const faith=s.resources.faith;assert.equal(miracle(s,'cat').ok,true);assert.equal(s.resources.faith,faith);assert.equal(s.pests.cats.length,1);assert.equal(s.catDiscovery.trial,'spent');assert.ok(decode(encode(s)));
});
