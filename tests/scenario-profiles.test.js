import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createGame,decode,encode,VERSION} from '../engine.js';
import {legacyScenario,strictScenario,validateScenario,isStrictSumer} from '../scenario-profiles.js';

test('scenario axes are independent of spiritual mode and starting layout',()=>{
 for(const mode of ['awakening','mature'])for(const start of ['beehives','established']){
  const s=createGame({mode,start,scenario:strictScenario()});
  assert.deepEqual(s.scenario,{version:1,history:'sumer-iii-v1',miracles:'classic-v1'});
  assert.equal(isStrictSumer(s),true);assert.equal(s.godhood.mode,mode);
  assert.deepEqual(decode(encode(s)),s);
 }
 assert.deepEqual(createGame().scenario,legacyScenario());
});

test('v29 migration keeps classic rules for both modes and exact city data',()=>{
 for(const mode of ['awakening','mature']){
  const s=createGame({mode,start:'established'}),before=JSON.parse(encode(s));
  before.version=29;delete before.scenario;
  const loaded=decode(JSON.stringify(before));assert.ok(loaded);
  assert.equal(loaded.version,VERSION);assert.deepEqual(loaded.scenario,legacyScenario());
  const {version,scenario,...actual}=loaded;const {version:oldVersion,...expected}=before;
  assert.deepEqual(actual,expected);
  assert.deepEqual(decode(encode(loaded)),loaded);
 }
});

test('all archived legacy save versions enroll in legacy even if a profile is injected',()=>{
 for(const file of readdirSync(new URL('./fixtures/',import.meta.url)).filter(x=>/^legacy-.*\.json$/.test(x))){
  const raw=JSON.parse(readFileSync(new URL('./fixtures/'+file,import.meta.url),'utf8'));
  assert.ok(raw.version<30,file);raw.scenario=strictScenario();
  const s=decode(JSON.stringify(raw));assert.ok(s,file);assert.deepEqual(s.scenario,legacyScenario(),file);
 }
});

test('current saves reject missing, future, malformed and unsupported rules',()=>{
 const s=createGame();
 for(const scenario of [undefined,null,[],{},'legacy-v1',{...legacyScenario(),version:2},{...legacyScenario(),history:'future'},{...legacyScenario(),miracles:'future-c99-v1'}]){
  assert.equal(validateScenario(scenario),false);assert.equal(decode(JSON.stringify({...s,scenario})),null);
 }
 for(const version of [0,1.5,'29',32])assert.equal(decode(JSON.stringify({...s,version})),null);
 assert.throws(()=>createGame({scenario:{history:'future'}}),/scenario/i);
});

test('creation clones profile objects so caller mutation cannot change existing city',()=>{
 const profile=strictScenario(),s=createGame({scenario:profile});profile.history='legacy-v1';
 assert.equal(isStrictSumer(s),true);assert.notEqual(s.scenario,profile);
 assert.equal(isStrictSumer({}),false);assert.equal(validateScenario(legacyScenario()),true);
});
