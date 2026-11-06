import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {BUILDINGS,buildingKey} from '../definitions.js';
import {householdWaterRequest,cityWaterRequest} from '../human-projects.js';

test('the city surfaces a named dry household and viewing costs nothing',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const house=s.buildings.findLast(b=>b.type==='house');
 assert.equal(cityWaterRequest(s),null);
 house.water=0;
 const raw=encode(s),request=cityWaterRequest(s);
 assert.deepEqual(request,householdWaterRequest(s,house));
 assert.equal(request.home,buildingKey(house));
 assert.equal(request.requesterId,s.citizens.find(c=>c.home===request.home&&c.age>=16).id);
 assert.ok(request.shortage>0);
 assert.equal(request.cost,BUILDINGS.waterpoint);
 assert.equal(encode(s),raw);
 s.buildings.push({type:'waterpoint',x:12,y:7,humanWaterProject:{home:request.home,requesterId:request.requesterId}});
 assert.equal(cityWaterRequest(s),null);
});
