import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {createGame,decode,encode} from '../engine.js';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';

test('both new UI modes start strict Sumer with classic miracles until fisherman quest release',()=>{
 for(const mode of ['awakening','mature']){const s=createNewCity({mode,seed:137});assert.deepEqual(s.scenario,strictScenario());assert.equal(s.godhood.mode,mode);assert.equal(s.resources.faith,mode==='awakening'?0:1000);assert.equal(s.buildings.length,5);assert.ok(s.buildings.every(b=>b.starterHut));assert.deepEqual(decode(encode(s)),s);assert.doesNotMatch(s.news[0].text,/ульев/);}
});
test('new town creation never enrolls old cities or changes the low-level fixture default',()=>{
 const old=createGame({mode:'awakening',seed:137}),raw=encode(old),fresh=createNewCity({mode:'awakening',seed:138});assert.deepEqual(old.scenario,legacyScenario());assert.equal(encode(old),raw);assert.deepEqual(decode(raw).scenario,legacyScenario());assert.notEqual(old.world.seed,fresh.world.seed);
});
