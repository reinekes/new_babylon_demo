import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {beginFirstWaterHelp,firstWaterHelpChoices} from '../godhood.js';
import {personalMemory} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';

test('a child hears the first water story at dinner and keeps the source after the teller dies',()=>{
 let s=createNewCity({mode:'awakening',seed:137});
 const choice=firstWaterHelpChoices(s)[0],child=s.citizens.find(c=>c.age<16&&c.home===s.citizens.find(p=>p.id===choice.helperId).home);
 assert.ok(child);
 const family=s.citizens.filter(c=>c.home===child.home&&c.age>=16);
 child.parents=family.map(c=>c.id).sort((a,b)=>a-b);
 assert.ok(beginFirstWaterHelp(s,choice.helperId,choice.recipientId).ok);
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=40;b.pantryDelivered=40;}
 for(let i=0;i<1400&&!personalMemory(s,child.id);i++){
  if(s.godhood.stage!=='recognized')assert.equal(personalMemory(s,child.id),null);
  advanceTime(s,.1);
 }
 const heard=personalMemory(s,child.id);
 assert.equal(heard.role,'listener');
 assert.equal(heard.tellerId,choice.helperId);
 assert.deepEqual(heard.fact,personalMemory(s,choice.helperId).fact);
 assert.match(lifeAnalyticsHTML(s,{tab:'family',selectedId:child.id}),/Услышал за семейным ужином/);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 const teller=s.citizens.find(c=>c.id===choice.helperId);teller.age=85;
 for(let i=0;i<200&&!s.lifeAnalytics.people.find(p=>p.id===choice.helperId).diedTick;i++){s.event=null;advanceTime(s,.5);}
 assert.ok(s.lifeAnalytics.people.find(p=>p.id===choice.helperId).diedTick);
 const restored=decode(encode(s));assert.ok(restored);
 assert.deepEqual(personalMemory(restored,child.id),heard);
 const corrupt=structuredClone(restored);
 corrupt.lifeAnalytics.people.find(p=>p.id===child.id).waterStory.tellerId=choice.recipientId;
 assert.equal(decode(encode(corrupt)),null);

 const next=restored.citizens.find(c=>c.id>child.id&&c.age<16);
 const survivingTeller=restored.citizens.find(c=>c.id===child.id);
 const coParent=restored.citizens.find(c=>c.home===survivingTeller.home&&c.id<survivingTeller.id);
 assert.ok(next&&coParent);
 survivingTeller.age=32;
 Object.assign(next,{age:8,parents:[coParent.id,survivingTeller.id],generation:3,home:survivingTeller.home,
  phase:'home',x:survivingTeller.x,y:survivingTeller.y,route:[],routeIndex:0});
 for(let i=0;i<1600&&!personalMemory(restored,next.id);i++){restored.event=null;advanceTime(restored,.1);}
 const secondHand=personalMemory(restored,next.id);
 assert.equal(secondHand.tellerId,child.id);
 assert.deepEqual(secondHand.fact,heard.fact);
 assert.ok(secondHand.heardAt>heard.heardAt);
 const after=decode(encode(restored));assert.ok(after);
 assert.deepEqual(personalMemory(after,next.id),secondHand);
});
