import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {advanceTime,encode,resolveEvent} from '../engine.js';
import {parseSaveFile} from '../save-library.js';
import {simulationSeconds} from '../calendar.js';
import {beginFirstSign,namelessEndingReason,recordNamelessEnding} from '../godhood.js';
import {cityCommandReason} from '../city-command-lock.js';

function importPlaytestSave(name){
 const path=new URL(`../docs/playtest/${name}.json`,import.meta.url);
 const raw=readFileSync(path,'utf8');
 const {state}=parseSaveFile(raw);
 assert.ok(state);
 assert.equal(encode(state),raw);
 return state;
}

function runAt4xUntil(state,done){
 for(let i=0;i<1000&&!done();i++){
  if(state.event)assert.ok(resolveEvent(state,'skip').ok);
  advanceTime(state,simulationSeconds(.25,4));
 }
 assert.ok(done(),'playtest checkpoint was not reached');
}

test('the published family playtest save reaches adulthood with the same identity and parents',()=>{
 const city=importPlaytestSave('family-before-adulthood');
 const child=city.citizens.find(c=>c.id===11);
 assert.ok(child&&child.age<16);
 const parents=[...child.parents];
 assert.equal(parents.length,2);
 const grown=()=>city.citizens.find(c=>c.id===11);
 runAt4xUntil(city,()=>grown()?.age>=16);
 assert.deepEqual(grown().parents,parents);
 const raw=encode(city);
 assert.equal(encode(parseSaveFile(raw).state),raw);
});

test('the published witness playtest save leaves a living city with two voluntary choices',()=>{
 const city=importPlaytestSave('before-last-witness');
 assert.equal(city.godhood.witnessId,0);
 assert.ok(city.citizens.some(c=>c.id===0));
 runAt4xUntil(city,()=>!namelessEndingReason(city));
 assert.equal(city.godhood.stage,'unseen');
 assert.equal(city.lost,false);
 assert.ok(!city.citizens.some(c=>c.id===0));
 const raw=encode(city);
 const restore=parseSaveFile(raw).state;
 assert.ok(beginFirstSign(restore).ok);
 runAt4xUntil(restore,()=>restore.godhood.stage==='recognized');
 assert.notEqual(restore.godhood.witnessId,0);
 const observe=parseSaveFile(raw).state;
 assert.ok(recordNamelessEnding(observe).ok);
 assert.match(cityCommandReason(observe),/наблюдение/);
 assert.deepEqual(observe.citizens.map(c=>c.id),city.citizens.map(c=>c.id));
 const observedAt=observe.simTime;
 runAt4xUntil(observe,()=>observe.simTime>observedAt);
 const ending=encode(observe);
 assert.equal(encode(parseSaveFile(ending).state),ending);
});
