import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {createGame,decode,encode} from '../engine.js';
import {strictScenario,legacyScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';

test('new Awakening selects C01 while mature towns retain classic miracles in strict Sumer',()=>{
 for(const mode of ['awakening','mature']){const s=createNewCity({mode,seed:137});assert.deepEqual(s.scenario,{version:1,history:'sumer-iii-v1',miracles:mode==='awakening'?CAT_DISCOVERY_RULES:'classic-v1'});assert.equal(s.catDiscovery?.phase,mode==='awakening'?'learning':undefined);assert.equal(s.catDiscovery?.trial,mode==='awakening'?'locked':undefined);assert.equal(s.godhood.mode,mode);assert.equal(s.resources.faith,mode==='awakening'?0:1000);assert.equal(s.buildings.length,5);assert.ok(s.buildings.every(b=>b.starterHut));assert.deepEqual(decode(encode(s)),s);assert.doesNotMatch(s.news[0].text,/ульев/);}
});
test('new town creation never enrolls old cities or changes the low-level fixture default',()=>{
 const old=createGame({mode:'awakening',seed:137}),raw=encode(old),fresh=createNewCity({mode:'awakening',seed:138});assert.deepEqual(old.scenario,legacyScenario());assert.equal(encode(old),raw);assert.deepEqual(decode(raw).scenario,legacyScenario());assert.notEqual(old.world.seed,fresh.world.seed);
});

test('the mode chooser placeholder and an existing strict classic town do not silently enroll in C01',()=>{
 const placeholder=createNewCity({seed:137});assert.deepEqual(placeholder.scenario,strictScenario());assert.equal(placeholder.catDiscovery,undefined);
 const old=createGame({mode:'awakening',seed:137,scenario:strictScenario()}),raw=encode(old);createNewCity({mode:'awakening',seed:138});const loaded=decode(raw);assert.ok(loaded);assert.deepEqual(loaded.scenario,strictScenario());assert.equal(loaded.catDiscovery,undefined);assert.equal(loaded.catFishing,undefined);assert.equal(encode(old),raw);
});
