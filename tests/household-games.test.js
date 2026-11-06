import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {advanceWellbeing,mealRation} from '../wellbeing.js';
import {buildingKey} from '../definitions.js';

function evening(){
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 s.simTime=34;s.seasonElapsed=34;
 const b=s.buildings.find(b=>b.type==='house'),members=s.citizens.filter(c=>c.home===buildingKey(b)&&c.age>=16);
 for(const c of members)Object.assign(c,{phase:'home',mealDay:0,mealEaten:mealRation(c),diningUntil:0,mood:75});
 return {s,b,members};
}
test('a real evening game finishes once and resumes from a saved start',()=>{
 let {s,b,members}=evening();
 advanceWellbeing(s,.25);
 assert.equal(b.eveningGame.status,'playing');
 assert.deepEqual(b.eveningGame.players,members.slice(0,2).map(c=>c.id));
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 b=s.buildings.find(b=>b.eveningGame);
 s.simTime+=5;
 advanceWellbeing(s,.25);advanceWellbeing(s,.25);
 assert.equal(b.eveningGame.status,'finished');
 assert.deepEqual(b.eveningGame.players.map(id=>s.citizens.find(c=>c.id===id).mood),[77,77]);
});
test('a courier interrupts the game and the evening gives no bonus or retry',()=>{
 const {s,b,members}=evening();
 advanceWellbeing(s,.25);
 members[0].phase='toStore';members[0].cargo={wood:2};s.simTime++;
 advanceWellbeing(s,.25);
 assert.equal(b.eveningGame.status,'interrupted');
 members[0].phase='home';members[0].cargo={};s.simTime+=5;advanceWellbeing(s,.25);
 assert.equal(b.eveningGame.status,'interrupted');
 assert.equal(members[0].mood,75);
 const crisis=evening();
 for(const c of crisis.members)c.hunger=70;
 advanceWellbeing(crisis.s,.25);
 assert.equal(crisis.b.eveningGame,undefined);
});
