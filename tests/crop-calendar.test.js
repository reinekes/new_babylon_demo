import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceCrops,changeCropSeason,cropFor,fieldActive,workField,validateCrops,enableAutumnCrops} from '../agriculture.js';
import {strictScenario} from '../scenario-profiles.js';
import {seedTarget,foodForecast} from "../food-planning.js";
import {harvestDemand} from "../city-labor.js";
import {createNewCity} from "../new-game.js";
import {createGame,decode,encode} from "../engine.js";
import {adoptAutumnCrops} from "../management.js";

test('an autumn crop retains its seed accounting into spring and matures exactly once',()=>{
 const field={type:'field',x:10,y:8,level:1};
 const s={scenario:strictScenario(),cropCalendar:'autumn-v1',buildings:[field],year:1,season:2,rain:1,news:[]};
 const c=cropFor(s,field);c.seedStock=4;
 assert.equal(fieldActive(s,field),true);
 workField(s,field,12);
 assert.equal(c.seedUsed,4);
 s.season=3;changeCropSeason(s,2);advanceCrops(s,45);
 assert.equal(c.growth,1);
 s.year=2;s.season=0;changeCropSeason(s,3);
 assert.equal(c.remaining,84);
 assert.equal(c.year,2);
 assert.equal(validateCrops(s),true);
 workField(s,field,5);
 assert.equal(c.remaining,77);
 assert.equal(c.sheaves,7);
 s.season=1;changeCropSeason(s,0);
 assert.equal(c.spoiled,77);
 s.season=2;changeCropSeason(s,1);
 assert.equal(field.crop.sown,0);
 assert.equal(field.crop.sheaves,7);
 assert.equal(field.crop.remaining,0);
});

test('a field pinned to the spring cycle still matures in autumn after the city switches',()=>{
 const field={type:'field',x:10,y:8,level:1};
 const s={scenario:strictScenario(),buildings:[field],year:2,season:1,rain:1,news:[]};
 const c=cropFor(s,field);
 Object.assign(c,{sown:1,seedUsed:4,seedStock:1,sheaves:2});
 assert.equal(enableAutumnCrops(s),true);
 assert.equal(enableAutumnCrops(s),false);
 assert.equal(c.springCycle,true);
 advanceCrops(s,45);
 s.season=2;changeCropSeason(s,1);
 assert.equal(c.remaining,84);
 assert.equal(c.sheaves,2);
 assert.equal(c.seedStock,1);
 s.season=3;changeCropSeason(s,2);
 assert.equal(c.spoiled,84);
 assert.equal(field.crop.springCycle,undefined);
 s.season=0;s.year=3;changeCropSeason(s,3);
 assert.equal(field.crop.remaining,0);
 assert.equal(field.crop.seedStock,1);
 assert.equal(field.crop.sheaves,2);
});

test('mixed fields reserve autumn seed and count only the field ready for the current harvest call',()=>{
 const spring={type:'field',x:10,y:8,level:1,crop:{springCycle:true,remaining:7,seedStock:1}};
 const autumn={type:'field',x:11,y:8,level:1,crop:{sown:.5,seedStock:1}};
 const s={scenario:strictScenario(),cropCalendar:'autumn-v1',buildings:[spring,autumn],citizens:[],year:2,season:2,simTime:270,seasonElapsed:0,resources:{food:20},rain:1};
 assert.equal(seedTarget(s),4);
 assert.deepEqual(harvestDemand(s).fields,[spring]);
 assert.equal(foodForecast(s).cropPotential,42);
 s.season=0;s.year=3;delete spring.crop.springCycle;autumn.crop.remaining=42;
 assert.deepEqual(harvestDemand(s).fields,[spring,autumn]);
});

test('new Southern Sumer cities adopt the autumn cycle while existing saves require a choice',()=>{
 const created=createNewCity({mode:'mature'});
 assert.equal(created.cropCalendar,'autumn-v1');
 assert.equal(decode(encode(created)).cropCalendar,'autumn-v1');
 const old=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const loaded=decode(encode(old));
 assert.equal(loaded.cropCalendar,undefined);
 const field=loaded.buildings.find(b=>b.type==='field');
 field.crop.seedStock=1;workField(loaded,field,1);
 assert.ok(adoptAutumnCrops(loaded).ok);
 assert.equal(field.crop.springCycle,true);
 const raw=encode(loaded);
 assert.equal(encode(decode(raw)),raw);
});
