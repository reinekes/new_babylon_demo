import test from 'node:test';
import assert from 'node:assert/strict';
import {clayRemaining,takeClay,validateClayPits} from '../clay-stock.js';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {orderManualGathering,workManualGathering} from "../manual-gathering.js";

test('clay is bounded per saved deposit and never regenerates with time',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const [a,b]=s.world.deposits.filter(p=>p.kind==='clay');
 const full=clayRemaining(s,a.x,a.y);
 assert.ok(full>0);
 assert.equal(takeClay(s,a.x,a.y,full-1),full-1);
 assert.equal(takeClay(s,a.x,a.y,5),1);
 assert.equal(takeClay(s,a.x,a.y,5),0);
 assert.equal(clayRemaining(s,b.x,b.y),full);
 s.simTime=100000;
 assert.equal(clayRemaining(s,a.x,a.y),0);
 assert.ok(validateClayPits(s));
 assert.equal(validateClayPits({...s,clayPits:{'0,0':0}}),false);
});

test('a clay pit survives a save without modifying supplies or existing jobs',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const a=s.world.deposits.find(p=>p.kind==='clay');
 takeClay(s,a.x,a.y,2);
 const raw=encode(s),saved=decode(raw);
 assert.ok(saved);
 assert.equal(encode(saved),raw);
 assert.equal(clayRemaining(saved,a.x,a.y),clayRemaining(s,a.x,a.y));
});

test('a real clay worker takes only the last partial basket, and the exhausted pit persists',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const pit=s.buildings.find(b=>b.type==='clay');
 takeClay(s,pit.x,pit.y,clayRemaining(s,pit.x,pit.y)-.5);
 for(let i=0;i<450&&clayRemaining(s,pit.x,pit.y)>0;i++)advanceTime(s,.1);
 assert.equal(clayRemaining(s,pit.x,pit.y),0);
 assert.equal(pit.workshopStock.output.clay,.5);
 const saved=decode(encode(s));
 assert.ok(saved);
 assert.equal(clayRemaining(saved,pit.x,pit.y),0);
});

test('manual work picks up only the remaining clay and cannot repeat on an exhausted deposit',()=>{
 const s=createGame({mode:'mature',scenario:strictScenario()});
 const pit=s.world.deposits.find(p=>p.kind==='clay'&&!s.buildings.some(b=>b.x===p.x&&b.y===p.y));
 takeClay(s,pit.x,pit.y,clayRemaining(s,pit.x,pit.y)-.25);
 assert.ok(orderManualGathering(s,pit.x,pit.y).ok);
 const c=s.citizens.find(p=>p.age>=16);
 const stand={x:pit.x-.5,y:pit.y-.5};
 Object.assign(c,stand,{cargo:{},phase:'manualGathering',manualGathering:{key:`${pit.x},${pit.y}`,stand,progress:17}});
 assert.ok(workManualGathering(s,c,1));
 assert.deepEqual(c.cargo,{clay:.25});
 assert.equal(clayRemaining(s,pit.x,pit.y),0);
 assert.equal(orderManualGathering(s,pit.x,pit.y).ok,false);
});
