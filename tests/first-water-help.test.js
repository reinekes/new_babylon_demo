import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {beginFirstSign,beginFirstWaterHelp,firstWaterHelpChoices} from '../godhood.js';
import {personalMemory} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';
import {recoverWater} from '../water.js';
import {buildingKey} from '../definitions.js';

test('a chosen resident delivers real water before first recognition, through a save in transit',()=>{
 let s=createNewCity({mode:'awakening',seed:137});
 const choice=firstWaterHelpChoices(s)[0];
 assert.ok(choice);
 assert.ok(beginFirstWaterHelp(s,choice.helperId,choice.recipientId).ok);
 assert.equal(beginFirstSign(s).ok,false);
 const home=()=>s.buildings.find(b=>buildingKey(b)===choice.home);
 const delivered=home().waterDelivered;
 let loaded=false;
 for(let i=0;i<1800&&s.godhood.stage!=='recognized';i++){
  advanceTime(s,.1);
  if(!loaded&&s.citizens.find(c=>c.id===choice.helperId).waterTrip?.load>0){
   assert.equal(s.resources.faith,0);
   assert.equal(home().waterDelivered,delivered);
   assert.equal(s.causalFacts?.neighborWater,undefined);
   const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
   loaded=true;
  }
 }
 assert.ok(loaded);
 assert.equal(s.godhood.stage,'recognized');
 assert.equal(s.godhood.witnessId,choice.helperId);
 assert.equal(s.resources.faith,1);
 assert.ok(home().waterDelivered>delivered);
 const [aid]=s.causalFacts.neighborWater;
 const helper=s.citizens.find(c=>c.id===choice.helperId);
 assert.equal(aid.courierId,helper.id);
 assert.equal(aid.origin,helper.home);
 assert.equal(aid.home,choice.home);
 assert.ok(aid.amount>0);
 assert.equal(s.causalFacts.neighborWater.length,1);
 assert.equal(s.godhood.firstWaterHelp.recipientId,choice.recipientId);
 const saved=decode(encode(s));assert.ok(saved);
 const witness=personalMemory(saved,choice.helperId),recipient=personalMemory(saved,choice.recipientId);
 assert.deepEqual(witness.fact,recipient.fact);
 assert.equal(witness.interpretation,'sign');
 assert.equal(recipient.interpretation,'neighbor');
 assert.match(lifeAnalyticsHTML(saved,{tab:'family',selectedId:choice.helperId}),/увидел знак/);
 assert.match(lifeAnalyticsHTML(saved,{tab:'family',selectedId:choice.recipientId}),/запомнил помощь соседа/);
 const legacy=structuredClone(saved);delete legacy.godhood.firstWaterHelp.interpretations;
 const legacyRaw=encode(legacy),loadedLegacy=decode(legacyRaw);
 assert.equal(encode(loadedLegacy),legacyRaw);
 assert.equal(personalMemory(loadedLegacy,choice.recipientId).interpretation,null);
 assert.deepEqual(personalMemory(loadedLegacy,choice.recipientId).fact,witness.fact);
 const corrupt=structuredClone(saved);corrupt.godhood.firstWaterHelp.interpretations.recipient='invented';
 assert.equal(decode(encode(corrupt)),null);
 assert.equal(beginFirstWaterHelp(s,choice.helperId,choice.recipientId).ok,false);
});

test('a canceled trip gives no recognition and restores the original choice',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const choices=firstWaterHelpChoices(s);
 assert.ok(new Set(choices.map(c=>c.helperId)).size>=2);
 assert.ok(new Set(choices.map(c=>c.recipientId)).size>=2);
 const {helperId,recipientId}=choices[0];
 assert.ok(beginFirstWaterHelp(s,helperId,recipientId).ok);
 const c=s.citizens.find(c=>c.id===helperId);
 const invalid=structuredClone(s);delete invalid.citizens.find(p=>p.id===helperId).waterTrip;
 assert.equal(decode(encode(invalid)),null);
 recoverWater(s,c);
 assert.equal(s.godhood.stage,'unseen');
 assert.equal(s.godhood.firstWaterHelp,undefined);
 assert.equal(s.causalFacts?.neighborWater,undefined);
 assert.equal(s.resources.faith,0);
 assert.ok(decode(encode(s)));
 assert.ok(beginFirstSign(s).ok);
});

test('zero faith allows one real response to a water request per cycle and the limit survives reload',async()=>{
 const {answerWaterRequest,smallWaterResponseReason}=await import('../human-projects.js');
 const {mealCycle}=await import('../wellbeing.js');
 let s=createNewCity({mode:'awakening',seed:137});
 const choice=firstWaterHelpChoices(s)[0];
 const b=s.buildings.find(b=>buildingKey(b)===choice.home);
 const witness=s.citizens.find(c=>c.id===choice.recipientId);
 Object.assign(s.godhood,{stage:'recognized',recognitionAt:0,believerIds:[witness.id],witnessId:witness.id});
 b.water=0;
 const result=answerWaterRequest(s,b);
 assert.ok(result.ok,result.reason);
 const helper=s.citizens.find(c=>c.id===result.helperId);
 assert.equal(helper.waterTrip.target,choice.home);
 assert.equal(b.water,0);
 assert.equal(s.resources.faith,0);
 assert.match(smallWaterResponseReason(s),/уже/);
 const raw=encode(s);s=decode(raw);
 assert.ok(s);assert.equal(encode(s),raw);
 assert.match(answerWaterRequest(s,s.buildings.find(b=>buildingKey(b)===choice.home)).reason,/уже/);
 const invalid=structuredClone(s);
 invalid.godhood.smallWaterResponse.cycle++;
 assert.equal(decode(encode(invalid)),null);
 const nextCycle=structuredClone(s);
 nextCycle.simTime+=60;
 assert.equal(smallWaterResponseReason(nextCycle),'');
 s.godhood.lastPrayerCycle=mealCycle(s.simTime);
 assert.match(smallWaterResponseReason(s),/молитв/);
 for(let i=0;i<350&&s.buildings.find(b=>buildingKey(b)===choice.home).water<.5;i++)advanceTime(s,.1);
 assert.ok(s.buildings.find(b=>buildingKey(b)===choice.home).water>=.5);
 assert.equal(s.resources.faith,0);
});
