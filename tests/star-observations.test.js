import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {advanceTime,decode,encode} from '../engine.js';
import {recordRevelationFact,advanceRevelationEvidence} from '../revelation-evidence.js';

test('star observations require a recognized observer beside water and count once per night',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),c=s.citizens[0],g=s.godhood;
 const house=s.buildings.find(b=>`${b.x},${b.y}`===c.home);
 Object.assign(g,{stage:'recognized',witnessId:c.id,believerIds:[c.id]});
 g.signTarget={x:house.x+.5,y:house.y+.5};g.signOrigin={x:c.x,y:c.y};
 for(const kind of ['family','building','food'])recordRevelationFact(s,kind,c,house);
 advanceRevelationEvidence(s);
 assert.ok(s.revelationEvidence.opening);
 c.calling='musician';
 const stepAt=time=>{s.simTime=time;s.event=null;advanceTime(s,.1);};
 stepAt(5);
 assert.equal(s.starObservations.nights.length,0);
 house.water=0;stepAt(36);
 assert.equal(s.starObservations.nights.length,0);
 for(const time of [37,45,97,157]){
  house.water=house.waterDelivered=4;
  c.phase='home';c.x=house.x;c.y=house.y;c.route=[];c.routeIndex=0;
  stepAt(time);
 }
 assert.deepEqual(s.starObservations.nights.map(n=>n.day),[0,1,2]);
 assert.ok(s.starObservations.nights.every(n=>n.observer===c.id));
});

test('an unobserved new city and an older save both round-trip',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),raw=encode(s);
 assert.deepEqual(decode(raw).starObservations,{version:1,nights:[]});
 delete s.starObservations;
 const old=encode(s);
 assert.equal(encode(decode(old)),old);
});

test('the harvest deadline unlocks Stars only with a prepared field and three observations',async()=>{
 const {changeCropSeason}=await import('../agriculture.js');
 const {miracleKnowledgeReason}=await import('../godhood.js');
 const s=createNewCity({mode:'awakening',seed:1});
 const b={type:'field',x:8,y:9,level:1,crop:{sown:1,growth:.5}};
 s.buildings.push(b);
 s.godhood.stage='recognized';
 s.revelationEvidence.opening={time:0};
 s.tick=4;s.year=2;s.season=0;s.simTime=200;
 assert.match(miracleKnowledgeReason(s,'stars'),/наблюдени/);
 s.starObservations.nights=[35,95,155].map((at,day)=>({at,day}));
 changeCropSeason(s,3);
 assert.equal(s.starObservations.harvest,undefined);
 assert.match(miracleKnowledgeReason(s,'stars'),/жатв/);
 b.crop.growth=1;
 changeCropSeason(s,3);
 assert.equal(s.starObservations.harvest.tick,4);
 assert.equal(s.starObservations.harvest.x,8);
 assert.equal(miracleKnowledgeReason(s,'stars'),'');
});
