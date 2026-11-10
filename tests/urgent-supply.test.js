import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,build,buildingAt,createGame,decode,encode} from '../engine.js';
import {buildingKey} from '../definitions.js';
import {generateStreets} from '../city-life.js';
import {strictScenario} from '../scenario-profiles.js';

test('a hungry worker takes a real food trip and the trip survives a save',()=>{
 const s=createGame({start:'established',scenario:strictScenario(),seed:137});
 const worker=s.citizens.find(c=>c.age>=16);
 const field=s.buildings.find(b=>b.type==='field');
 const port=generateStreets(s.buildings,s).ports.find(p=>p.building===field);
 const home=s.buildings.find(b=>buildingKey(b)===worker.home);
 Object.assign(home,{pantry:0,water:10});
 Object.assign(worker,{role:'production',workplace:buildingKey(field),work:buildingKey(field),phase:'working',hunger:90,x:port.x,y:port.y,route:[],routeIndex:0,cargo:{}});
 advanceTime(s,.1);
 assert.equal(worker.phase,'toPantrySupply');
 assert.equal(home.pantry,0);
 const saved=decode(encode(s));
 assert.ok(saved);
 advanceTime(saved,30);
 assert.ok(saved.buildings.find(b=>buildingKey(b)===worker.home).pantry>0);
 assert.ok(decode(encode(saved)));
});

test('new sheep pens occupy four tiles and old pens still occupy one',()=>{
 const s=createGame({start:'established',scenario:strictScenario(),seed:137});
 assert.ok(build(s,'sheepfold',2,2).ok);
 const saved=decode(encode(s));
 assert.ok(saved);
 const pen=buildingAt(saved,2,2);
 assert.equal(pen.footprint,2);
 assert.equal(buildingAt(saved,3,3),pen);
 delete pen.footprint;
 const legacy=decode(encode(saved));
 assert.ok(legacy);
 assert.equal(buildingAt(legacy,3,3),undefined);
});
