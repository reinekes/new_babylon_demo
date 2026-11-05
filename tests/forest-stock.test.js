import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {forestFor,forestStock,takeWood,restForest} from '../forest-stock.js';
import {stampBuildingCompletion} from "../building-chronology.js";
import {syncCitizens} from "../workforce.js";
import {closeForestForRest} from "../management.js";

test('two lumber yards share the nearest grove, which needs three days of explicit rest',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const grove=s.world.deposits.find(d=>d.kind==='forest');
 const first=forestFor(s,grove.x,grove.y),second=forestFor(s,grove.x+1,grove.y);
 assert.equal(first,second);
 const total=forestStock(s,first).stock;
 assert.equal(takeWood(s,first,total-1),total-1);
 assert.equal(takeWood(s,second,4),1);
 assert.equal(takeWood(s,second,4),0);
 assert.equal(restForest(s,first),true);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);assert.equal(encode(loaded),raw);
 loaded.simTime=179.99;
 assert.equal(takeWood(loaded,first,4),0);
 loaded.simTime=180;
 assert.equal(forestStock(loaded,first).stock,24);
 assert.equal(takeWood(loaded,second,4),4);
 assert.equal(forestStock(loaded,first).stock,20);
});

test('actual logging spends the last partial load, and the yard can close the shared grove',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const site=s.world.deposits.find(d=>d.kind==='forest'&&d.x<12);
 const yard={type:'logging',x:site.x,y:site.y,level:1};
 s.buildings.push(yard);stampBuildingCompletion(s,yard);syncCitizens(s);
 const key=forestFor(s,yard.x,yard.y);
 takeWood(s,key,forestStock(s,key).stock-.5);
 for(let i=0;i<450&&forestStock(s,key).stock>0;i++)advanceTime(s,.1);
 assert.equal(forestStock(s,key).stock,0);
 assert.equal(s.citizens.reduce((n,c)=>n+(c.cargo?.wood||0),0)+(yard.workshopStock?.output?.wood||0)+s.resources.wood,20.5);
 assert.ok(closeForestForRest(s,yard).ok);
 const raw=encode(s),saved=decode(raw);
 assert.ok(saved);assert.equal(encode(saved),raw);
 assert.equal(forestStock(saved,key).resting,true);
});
