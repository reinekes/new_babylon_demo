import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {reedStatus,takeReeds,restReeds,advanceReedBeds} from '../reed-stock.js';

test('trimming a reed bed lowers its stock and a closed wet bed regrows after two days',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const site=s.world.deposits.find(d=>d.kind==='reed');
 const initial=reedStatus(s,site.x,site.y).stock;
 assert.equal(takeReeds(s,site.x,site.y,initial-1),initial-1);
 assert.equal(takeReeds(s,site.x,site.y,6),1);
 assert.equal(takeReeds(s,site.x,site.y,6),0);
 assert.ok(restReeds(s,site.x,site.y));
 const raw=encode(s),saved=decode(raw);
 assert.ok(saved);assert.equal(encode(saved),raw);
 saved.simTime=119.9;advanceReedBeds(saved);
 assert.equal(reedStatus(saved,site.x,site.y).stock,0);
 saved.simTime=120;advanceReedBeds(saved);
 assert.equal(reedStatus(saved,site.x,site.y).stock,24);
});

test('a connected drain interrupts recovery and reopening water does not complete the cancelled rest',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const site={x:12,y:6,kind:'reed'};
 s.world.deposits.push(site);
 takeReeds(s,site.x,site.y,6);
 assert.ok(restReeds(s,site.x,site.y));
 const drain={type:'canal',x:13,y:6,level:1,drain:true};
 s.buildings.push(drain);s.simTime=60;
 advanceReedBeds(s);
 assert.ok(reedStatus(s,site.x,site.y).drained);
 assert.equal(reedStatus(s,site.x,site.y).resting,false);
 assert.equal(restReeds(s,site.x,site.y),false);
 s.buildings.pop();s.simTime=121;advanceReedBeds(s);
 assert.equal(reedStatus(s,site.x,site.y).stock,114);
 assert.ok(restReeds(s,site.x,site.y));
});
