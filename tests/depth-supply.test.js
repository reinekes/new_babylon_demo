import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {encode,decode} from '../engine.js';

test('depth supply counts only water carried by qualified workers into distinct inhabited houses',async()=>{
 const {recordDepthSupply}=await import('../depth-supply.js');
 const s=createNewCity({mode:'awakening',seed:137});
 const houses=s.buildings.filter(b=>b.type==='house'),c=s.citizens[0];
 recordDepthSupply(s,c,houses[0],2);
 assert.equal(s.depthSupply.homes.length,0);
 c.calling='fisher';
 recordDepthSupply(s,c,houses[0],0);
 recordDepthSupply(s,c,houses[0],2);
 recordDepthSupply(s,c,houses[0],4);
 recordDepthSupply(s,c,houses[1],1);
 recordDepthSupply(s,c,{type:'house',x:0,y:0},2);
 assert.equal(s.depthSupply.homes.length,2);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 const forged=JSON.parse(raw);forged.depthSupply.homes[1]={...forged.depthSupply.homes[0]};
 assert.equal(decode(JSON.stringify(forged)),null);
});

test('only the new oasis search needs the rain milestone and three supplied homes',async()=>{
 const {relicStartReason,startRelicQuest}=await import('../relic-quest.js');
 const {recordDepthSupply}=await import('../depth-supply.js');
 const s=createNewCity({mode:'awakening',seed:137}),c=s.citizens[0];
 s.resources.faith=500;
 const original=s.resources.faith;
 assert.match(startRelicQuest(s,c.id).reason,/Небесный дождь/);
 s.irrigatedHarvest={field:'1,1',farmerId:c.id,time:0};
 assert.match(relicStartReason(s,c.id),/три дома/);
 assert.doesNotMatch(relicStartReason(s,c.id,'land'),/три дома|Небесный дождь/);
 assert.equal(s.resources.faith,original);
 c.calling='watercarrier';
 for(const b of s.buildings.filter(b=>b.type==='house'))recordDepthSupply(s,c,b,2);
 assert.equal(s.depthSupply.homes.length,3);
 const newReason=relicStartReason(s,c.id);
 delete s.depthSupply;
 assert.equal(relicStartReason(s,c.id),newReason);
});

test('delivering the oasis relic opens Depths without a builder rank in the new chapter',async()=>{
 const {miracle}=await import('../engine.js');
 const s=createNewCity({mode:'awakening',seed:137});
 s.resources.faith=100;
 assert.match(miracle(s,'relicAwakening').reason,/артефакт/);
 s.relicQuest.phase='completed';
 assert.equal(miracle(s,'relicAwakening').ok,true);
 assert.equal(s.resources.faith,55);
 assert.equal(s.rain,2);
});

test('Depths fills only the selected operational intake without crediting a home',async()=>{
 const {miracle}=await import('../engine.js');
 const s=createNewCity({mode:'awakening',seed:137});
 const intake={type:'waterpoint',x:1,y:1,level:1,waterReserve:5};
 const other={...intake,x:2};
 s.buildings.push(intake,other);
 s.relicQuest.phase='completed';
 s.resources.faith=100;
 const home=s.buildings.find(b=>b.type==='house'),before=home.water;
 assert.ok(miracle(s,'relicAwakening',intake).ok);
 assert.equal(s.resources.faith,55);
 assert.equal(intake.waterReserve,12);
 assert.equal(other.waterReserve,5);
 assert.equal(home.water,before);
});
