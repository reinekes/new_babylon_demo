import test from 'node:test';
import assert from 'node:assert/strict';
import {fisheryKey,fisheryStock,takeFish,restFishery,validateFisheries} from '../fishery-stock.js';
import {strictScenario} from '../scenario-profiles.js';
import {createGame,encode,decode} from "../engine.js";
import {stampBuildingCompletion} from "../building-chronology.js";
import {networkFor,syncCitizens} from "../workforce.js";
import {fisheryOptions} from "../labor-life.js";
import {closeFishingGround} from "../management.js";

test('both banks share a finite catch, and an explicit rest restores part of the shoal after a full day',()=>{
 const s={scenario:strictScenario(),simTime:0};
 const west=fisheryKey(s,{x:12,y:8}),east=fisheryKey(s,{x:16,y:9});
 assert.equal(west,east);
 assert.notEqual(west,fisheryKey(s,{x:12,y:14}));
 assert.equal(takeFish(s,west,45),45);
 assert.equal(takeFish(s,east,8),3);
 assert.equal(takeFish(s,east,8),0);
 s.simTime=120;
 assert.equal(fisheryStock(s,east).stock,0);
 assert.equal(restFishery(s,west),true);
 assert.equal(restFishery(s,west),false);
 s.simTime=179.99;
 assert.equal(takeFish(s,east,8),0);
 s.simTime=180;
 assert.equal(fisheryStock(s,east).stock,18);
 assert.equal(takeFish(s,east,8),8);
 assert.equal(fisheryStock(s,west).stock,10);
 assert.ok(validateFisheries(s));
});

test('lake stock is separate and a save without fishery records keeps its first full shoal',()=>{
 const s={scenario:strictScenario(),simTime:0,world:{lakes:[{id:'lake-0',cells:[{x:7,y:7}]}]}};
 const lake=fisheryKey(s,{x:7,y:7}),river=fisheryKey(s,{x:12,y:7});
 assert.notEqual(lake,river);
 assert.equal(fisheryStock(s,lake).stock,48);
 assert.equal(s.fisheries,undefined);
 assert.ok(validateFisheries(s));
 takeFish(s,lake,10);
 assert.equal(fisheryStock(s,river).stock,48);
 assert.equal(restFishery(s,'river:999'),false);
 assert.equal(validateFisheries({...s,fisheries:{'river:999':{stock:5}}}),false);
});

test('a working fishing yard lists reachable grounds and can save and reload its closure',()=>{
 const s=createGame({mode:'mature',seed:137,scenario:strictScenario()});
 const b={type:'fishing',x:16,y:7,level:1};
 s.buildings.push(b);stampBuildingCompletion(s,b);
 syncCitizens(s);
 const port=networkFor(s).ports.find(p=>p.building===b);
 const ground=fisheryOptions(s,port).find(g=>g.key.startsWith('lake:'));
 assert.ok(ground);
 assert.equal(takeFish(s,ground.key,45),45);
 assert.equal(closeFishingGround(s,b,ground.key).ok,true);
 assert.equal(closeFishingGround(s,b,ground.key).ok,false);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 assert.deepEqual(fisheryStock(restored,ground.key),{stock:3,resting:true,seconds:60});
});
