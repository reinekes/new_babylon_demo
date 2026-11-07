import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {districtPickup,requestTransfer} from '../district-logistics.js';
import {strictScenario} from '../scenario-profiles.js';
import {syncInventory} from '../inventory.js';

test('a working basket increases the assigned porter’s actual load and wears only after pickup',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'depot',x:10,y:9,level:1});
 syncInventory(s);
 const c=s.citizens[0],order=requestTransfer(s,'9,8','10,9','clay',30);
 assert.ok(order.ok);
 c.role='carrier';c.districtJob=s.district.jobs.at(-1).id;
 c.basketCondition=1;
 const before=s.resources.clay;
 assert.equal(districtPickup(s,c),16);
 assert.equal(c.cargo.clay,16);
 assert.equal(s.resources.clay,before-16);
 assert.equal(c.basketCondition,0);
 const other=s.citizens[1];other.role='carrier';other.districtJob=c.districtJob;
 assert.equal(districtPickup(s,other),12);
 assert.equal(other.cargo.clay,12);
 assert.equal(other.basketCondition,undefined);
});

test('a basket keeps its condition when the actual pickup fits in an ordinary load',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'depot',x:10,y:9,level:1});
 syncInventory(s);
 assert.ok(requestTransfer(s,'9,8','10,9','reed',6).ok);
 const c=s.citizens[0];c.role='carrier';c.districtJob=s.district.jobs.at(-1).id;c.basketCondition=1;
 assert.equal(districtPickup(s,c),6);
 assert.equal(c.basketCondition,1);
});

test('a personal basket and its condition survive save and load',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 s.citizens[0].basketCondition=3;
 const restored=decode(encode(s));assert.ok(restored);
 assert.equal(restored.citizens[0].basketCondition,3);
 s.citizens[0].basketCondition=7;
 assert.equal(decode(encode(s)),null);
});

test('a basket from the weaving yard reaches storage and is issued at a real cargo pickup',async()=>{
 const {advanceTime,build}=await import('../engine.js');
 const {finishConstruction,workRequired}=await import('../construction.js');
 const {assignWorkplace}=await import('../management.js');
 const {syncCitizens}=await import('../workforce.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const result=build(s,'basketry',10,9);assert.ok(result.ok,result.reason);
 const b=s.buildings.at(-1);
 b.construction.delivered={...b.construction.required};
 for(const k of Object.keys(b.construction.remaining))b.construction.remaining[k]=0;
 b.construction.work=workRequired(b);assert.ok(finishConstruction(s));
 syncCitizens(s);assert.ok(assignWorkplace(s,0,'10,9').ok);assert.ok(assignWorkplace(s,1,'10,9').ok);
 for(let i=0;i<1600&&!s.resources.basket;i++){s.event=null;advanceTime(s,.1);}
 assert.ok(s.resources.basket>=1);
 assert.ok(b.productionHistory.some(row=>row.resources.basket>=1));
 s.buildings.push({type:'depot',x:11,y:9,level:1});syncInventory(s);
 const c=s.citizens.find(c=>c.age>=16&&!Object.values(c.cargo).some(Boolean)&&c.id>1);
 assert.ok(requestTransfer(s,'9,8','11,9','clay',20).ok);
 c.role='carrier';c.districtJob=s.district.jobs.at(-1).id;
 const before=s.resources.basket;
 assert.equal(districtPickup(s,c),16);
 assert.equal(c.basketCondition,5);
 assert.equal(s.resources.basket,before-1);
});

test('a broken basket is repaired with surplus reed on a large pickup',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'depot',x:10,y:9,level:1});
 syncInventory(s);
 const c=s.citizens[0];c.role='carrier';c.basketCondition=0;
 assert.ok(requestTransfer(s,'9,8','10,9','clay',20).ok);
 c.districtJob=s.district.jobs.at(-1).id;
 const before=s.resources.reed;
 assert.equal(districtPickup(s,c),16);
 assert.equal(c.basketCondition,5);
 assert.equal(s.resources.reed,before-2);
});

test('version 31 adds the basket stock slot without changing an existing resident',()=>{
 const old=createGame({start:'established',scenario:strictScenario()});
 old.version=31;
 for(const r of [old.resources,old.delivered,...old.buildings.map(b=>b.stock)])if(r)delete r.basket;
 const s=decode(encode(old));assert.ok(s);
 assert.equal(s.resources.basket,0);
 assert.deepEqual(s.citizens,old.citizens);
});
