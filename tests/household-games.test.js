import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
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

test('two fed neighbors walk to a shared game and the guest walks home after a save',()=>{
 let {s,b}=evening();
 const other=s.buildings.find(h=>h.type==='house'&&h!==b);
 const host=s.citizens.find(c=>c.home===buildingKey(b)&&c.age>=16);
 const guest=s.citizens.find(c=>c.home===buildingKey(other)&&c.age>=16);
 for(const c of s.citizens)Object.assign(c,{mealDay:0,mealEaten:0,hunger:70});
 for(const c of [host,guest])Object.assign(c,{phase:'home',mealEaten:mealRation(c),diningUntil:0,hunger:0,thirst:0});
 b.pantry=0;other.pantry=0;s.resources.food=0;
 for(let i=0;i<20&&!s.buildings.some(h=>h.eveningGame?.guestHome);i++)advanceTime(s,.1);
 const meeting=s.buildings.find(h=>h.eveningGame?.guestHome);
 assert.ok(meeting);
 const game=meeting.eveningGame;
 assert.equal(game.status,'waiting');
 const visitor=s.citizens.find(c=>c.id===game.players[1]);
 assert.equal(visitor.phase,'toEveningGame');
 const saved=encode(s);s=decode(saved);assert.ok(s);assert.equal(encode(s),saved);
 for(let i=0;i<180;i++)advanceTime(s,.1);
 const restored=s.buildings.find(h=>h.eveningGame?.guestHome).eveningGame;
 assert.equal(restored.status,'finished');
 assert.equal(s.citizens.find(c=>c.id===visitor.id).home,game.guestHome);
 assert.equal(s.citizens.find(c=>c.id===visitor.id).phase,'home');
});

test('a resolved water dispute gives the same people priority for a visit after moving apart',async()=>{
 const {CAT_DISCOVERY_RULES}=await import('../scenario-profiles.js');
 const {householdDisputeMemory,newArrivalHospitality}=await import('../arrival-hospitality.js');
 const {housingOf}=await import('../definitions.js');
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.arrivalHospitality=newArrivalHospitality();
 s.simTime=s.seasonElapsed=34;
 const [early,host]=s.citizens.filter(c=>c.home==='8,8'&&c.age>=16);
 const guest=s.citizens.find(c=>c.home==='9,9'&&c.age>=16);
 const newHome={type:'house',x:8,y:9,level:1,water:0,waterDelivered:0};
 s.buildings.push(newHome);s.capacity=housingOf(s);
 Object.assign(host,{home:'8,9',x:8.5,y:9.5});
 for(const c of s.citizens)Object.assign(c,{mealDay:0,mealEaten:0,hunger:70});
 for(const c of [early,host,guest])Object.assign(c,{phase:'home',mealEaten:mealRation(c),diningUntil:0,hunger:0,thirst:0});
 s.resources.food=0;
 s.arrivalHospitality.welcomes=[{home:'8,8',host:host.id,members:[guest.id],at:18,custom:'libation',dispute:{choice:'queue',guest:guest.id,at:24}}];
 assert.equal(householdDisputeMemory(s,[host])?.dispute.guest,guest.id);
 assert.equal(householdDisputeMemory(s,[early]),null);
 const control=structuredClone(s);control.arrivalHospitality.welcomes[0].dispute.choice='pause';
 for(let i=0;i<20&&!control.buildings.some(h=>h.eveningGame?.guestHome);i++)advanceTime(control,.1);
 assert.deepEqual(control.buildings.find(h=>h.eveningGame?.guestHome).eveningGame.players,[early.id,host.id]);
 for(let i=0;i<20&&!s.buildings.some(h=>h.eveningGame?.guestHome);i++)advanceTime(s,.1);
 const meeting=s.buildings.find(h=>h.eveningGame?.guestHome);
 assert.ok(meeting);
 assert.deepEqual(meeting.eveningGame.players,[host.id,guest.id]);
 assert.equal(buildingKey(meeting),host.home);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
});
