import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';import {RESOURCE_NAMES,MATERIALS} from '../definitions.js';import {stockStores,validateInventory} from '../inventory.js';import {grantTestResources} from '../test-tools.js';
test('explicit testing grant adds1000 of every displayed resource to real stocks without modifying loads or identity',()=>{
 const s=createGame({start:'established'});s.citizens[0].phase='toStore';s.citizens[0].cargo={food:2};const before=structuredClone(s),result=grantTestResources(s);assert.equal(result.ok,true);
 for(const k of Object.keys(RESOURCE_NAMES))assert.equal(s.resources[k],before.resources[k]+1000,k);assert.deepEqual(s.citizens,before.citizens);assert.deepEqual(s.gathering,before.gathering);assert.deepEqual(s.trade,before.trade);assert.ok(validateInventory(s));assert.ok(decode(encode(s)));
 for(const k of MATERIALS)assert.equal(stockStores(s).reduce((n,b)=>n+b.stock[k],0),s.resources[k]);grantTestResources(s);for(const k of Object.keys(RESOURCE_NAMES))assert.equal(s.resources[k],before.resources[k]+2000,k);
});
test('testing grant safely caps finite save limits and refuses a city without a stock location',()=>{
 const s=createGame({start:'established'});s.resources.faith=1e9-1;grantTestResources(s);assert.equal(s.resources.faith,1e9);assert.ok(decode(encode(s)));const bare={buildings:[],resources:{faith:5}};assert.equal(grantTestResources(bare).ok,false);assert.deepEqual(bare,{buildings:[],resources:{faith:5}});
});
