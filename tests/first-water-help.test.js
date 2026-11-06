import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {beginFirstSign,beginFirstWaterHelp,firstWaterHelpChoices} from '../godhood.js';
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
   const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
   loaded=true;
  }
 }
 assert.ok(loaded);
 assert.equal(s.godhood.stage,'recognized');
 assert.equal(s.godhood.witnessId,choice.helperId);
 assert.equal(s.resources.faith,1);
 assert.ok(home().waterDelivered>delivered);
 assert.equal(s.godhood.firstWaterHelp.recipientId,choice.recipientId);
 assert.ok(decode(encode(s)));
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
 assert.equal(s.resources.faith,0);
 assert.ok(decode(encode(s)));
 assert.ok(beginFirstSign(s).ok);
});
