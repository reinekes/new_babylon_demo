import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {buildingKey} from '../definitions.js';
import {strictScenario} from '../scenario-profiles.js';
import {acceptSupplyVow,advanceSupplyVow,extendSupplyVow,householdVowEvidence,recordVowDelivery,vowNameEvidence} from '../supply-vow.js';

function city(){
 const s=createGame({start:'established',scenario:strictScenario()});
 const houses=s.buildings.filter(b=>b.type==='house'&&s.citizens.some(c=>c.home===buildingKey(b)));
 for(const b of houses){b.pantry=0;b.pantryDelivered=0;}
 return {s,houses};
}

test('ordinary pantry trips fulfil a vow after arrival and the result survives loading',()=>{
 let {s,houses}=city();
 const key=buildingKey(houses[0]);
 assert.ok(acceptSupplyVow(s,[key]).ok);
 let carried=false;
 for(let i=0;i<400&&!s.supplyVows.history.length;i++){
  advanceTime(s,.1);
  if(!carried&&s.citizens.some(c=>c.pantryFood>0&&(c.pantryTarget||c.home)===key)){
   carried=true;
   assert.equal(s.supplyVows.active.targets[0].delivery,null);
   const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
  }
 }
 assert.ok(carried);
 const result=s.supplyVows.history.at(-1);
 assert.equal(result.outcome,'fulfilled');
 assert.ok(result.targets[0].delivery.witness);
 const restored=decode(encode(s));
 assert.ok(restored);
 advanceSupplyVow(restored);
 assert.deepEqual(restored.supplyVows.history,s.supplyVows.history);
});

test('only a promised resident still at the address can attest a delivery',()=>{
 const {s,houses}=city(),b=houses[0],key=buildingKey(b);
 assert.ok(acceptSupplyVow(s,[key]).ok);
 const target=s.supplyVows.active.targets[0];
 b.pantry=target.required;
 advanceSupplyVow(s);
 assert.equal(target.delivery,null);
 for(const c of s.citizens.filter(c=>c.home===key))c.home=buildingKey(houses[1]);
 recordVowDelivery(s,b,s.citizens[0],target.required);
 assert.equal(target.delivery,null);
 s.simTime=s.supplyVows.active.deadline;
 advanceSupplyVow(s);
 assert.equal(s.supplyVows.history.at(-1).outcome,'broken');
 assert.equal(s.supplyVows.history.at(-1).targets[0].failure,'moved');
});

test('extension is one public outcome, and preserves evidence for partial fulfilment',()=>{
 const {s,houses}=city(),[a,b]=houses;
 assert.ok(acceptSupplyVow(s,[a,b].map(buildingKey)).ok);
 const target=s.supplyVows.active.targets[0];
 a.pantry=target.required;a.pantryDelivered=a.pantry;
 recordVowDelivery(s,a,s.citizens[0],a.pantry);
 const before=s.supplyVows.active.deadline;
 assert.ok(extendSupplyVow(s).ok);
 assert.equal(s.supplyVows.history[0].outcome,'renegotiated');
 assert.ok(s.supplyVows.active.deadline>before);
 assert.equal(extendSupplyVow(s).ok,false);
 assert.ok(decode(encode(s)));
 s.simTime=s.supplyVows.active.deadline;
 advanceSupplyVow(s);
 assert.equal(s.supplyVows.history[1].outcome,'partial');
 assert.ok(s.supplyVows.history[1].targets[0].delivery);
 assert.equal(vowNameEvidence(s),null);
 const combined=householdVowEvidence(s,s.citizens);
 assert.equal(combined.target.home,buildingKey(b));
 assert.ok(combined.target.failure);
});

test('unreachable recipients and legacy cities cannot spend faith on a vow',()=>{
 const {s,houses}=city(),faith=s.resources.faith;
 assert.equal(acceptSupplyVow(s,['99,99']).ok,false);
 const house=houses[0],oldKey=buildingKey(house);
 house.x=25;
 const key=buildingKey(house);
 for(const c of s.citizens.filter(c=>c.home===oldKey))c.home=key;
 assert.equal(acceptSupplyVow(s,[key]).ok,false);
 assert.equal(s.resources.faith,faith);
 assert.equal(s.supplyVows,undefined);
 const legacy=createGame({start:'established'}),home=legacy.citizens[0].home;
 assert.equal(acceptSupplyVow(legacy,[home]).ok,false);
 assert.ok(decode(encode(legacy)));
});

test('forged couriers and recipients invalidate saved proof',()=>{
 const {s,houses}=city(),house=houses[0];
 assert.ok(acceptSupplyVow(s,[buildingKey(house)]).ok);
 house.pantry=s.supplyVows.active.targets[0].required;
 house.pantryDelivered=house.pantry;
 recordVowDelivery(s,house,s.citizens[0],house.pantry);
 const raw=encode(s);
 const fake=decode(raw);
 assert.ok(fake);
 fake.supplyVows.history[0].targets[0].delivery.witness=1e9;
 assert.equal(decode(encode(fake)),null);
});

test('a long advance closes the vow at its deadline rather than its final simulation time',()=>{
 const {s,houses}=city(),house=houses[0],key=buildingKey(house);
 assert.ok(acceptSupplyVow(s,[key]).ok);
 const deadline=s.supplyVows.active.deadline;
 // Model a town that reached the final hour without finding a courier.
 s.simTime=deadline-1;
 s.supplyVows.active.targets[0].required=100;
 assert.ok(advanceTime(s,2)>1);
 assert.equal(s.supplyVows.history[0].ended,deadline);
 assert.equal(s.supplyVows.history[0].outcome,'broken');
});

test('vow names distinguish actual fulfilment, repeated households, and repaired trust',()=>{
 const {s,houses}=city(),[a,b]=houses;
 const people=s.citizens.filter(c=>c.home===buildingKey(a));
 const start=house=>{
  house.pantry=0;
  assert.ok(acceptSupplyVow(s,[buildingKey(house)]).ok);
 };
 const deliver=house=>{
  const amount=s.supplyVows.active.targets[0].required;
  house.pantry=amount;house.pantryDelivered+=amount;
  recordVowDelivery(s,house,s.citizens[0],amount);
 };
 start(a);
 assert.equal(vowNameEvidence(s),null);
 assert.equal(householdVowEvidence(s,people),null);
 s.simTime=s.supplyVows.active.deadline;
 advanceSupplyVow(s);
 assert.equal(householdVowEvidence(s,people)?.target.failure,'short');
 assert.equal(vowNameEvidence(s),null);
 start(a);deliver(a);
 assert.ok(householdVowEvidence(s,people)?.target.delivery);
 start(a);deliver(a);
 assert.equal(vowNameEvidence(s),null);
 start(b);deliver(b);
 assert.deepEqual(vowNameEvidence(s)?.map(f=>f.target.home),[buildingKey(a),buildingKey(b)]);
 assert.equal(s.supplyVows.history[0].outcome,'broken');
});

test('a rebuilt courtyard cannot fulfill a vow to the original even with the same residents',()=>{
 let {s,houses}=city();
 const original=houses[0],key=buildingKey(original);
 for(const house of houses.slice(1))house.pantry=house.pantryDelivered=40;
 assert.ok(acceptSupplyVow(s,[key]).ok);
 const replacement={...original,pantry:s.supplyVows.active.targets[0].required};
 replacement.pantryDelivered=replacement.pantry;
 delete replacement.waterEntityId;
 s.buildings[s.buildings.indexOf(original)]=replacement;
 recordVowDelivery(s,replacement,s.citizens.find(c=>c.home===key),replacement.pantry);
 assert.equal(s.supplyVows.active?.targets[0].delivery,null);
 assert.ok(extendSupplyVow(s).ok);
 const raw=encode(s);
 const forged=JSON.parse(raw);
 delete forged.supplyVows.active.targets[0].homeId;
 assert.equal(decode(JSON.stringify(forged)),null);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 for(let i=0;i<800&&s.supplyVows.active;i++){s.event=null;advanceTime(s,.5);}
 assert.equal(s.supplyVows.active,null);
 assert.equal(s.supplyVows.history.at(-1).targets[0].failure,'rebuilt');
 assert.ok(decode(encode(s)));
});

test('old address-based vows round-trip and keep their original delivery rule',()=>{
 const {s,houses}=city(),home=houses[0],key=buildingKey(home);
 assert.ok(acceptSupplyVow(s,[key]).ok);
 const target=s.supplyVows.active.targets[0];
 delete target.homeId;
 delete home.waterEntityId;
 delete s.causalFacts;
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 const house=loaded.buildings.find(b=>buildingKey(b)===key);
 house.pantry=house.pantryDelivered=target.required;
 recordVowDelivery(loaded,house,loaded.citizens.find(c=>c.home===key),house.pantry);
 assert.equal(loaded.supplyVows.history.at(-1).outcome,'fulfilled');
});
