import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {orderManualGathering} from '../manual-gathering.js';
import {newCreatorMaterials,markCreatorCargo,acceptCreatorCargo,creatorMaterialsView} from '../creator-materials.js';

test('only tagged locally gathered cargo is credited, once and up to the threshold',()=>{
 const s={creatorMaterials:newCreatorMaterials()},c={cargo:{clay:12}};
 acceptCreatorCargo(s,c,'clay',12);
 assert.equal(creatorMaterialsView(s).clay,0);
 markCreatorCargo(s,c,'clay',12);
 acceptCreatorCargo(s,c,'clay',5);
 assert.equal(creatorMaterialsView(s).clay,5);
 assert.deepEqual(c.creatorCargo,{resource:'clay',amount:7});
 acceptCreatorCargo(s,c,'clay',7);
 acceptCreatorCargo(s,c,'clay',7);
 assert.equal(creatorMaterialsView(s).clay,12);
 markCreatorCargo(s,c,'clay',40);
 acceptCreatorCargo(s,c,'clay',40);
 assert.equal(creatorMaterialsView(s).clay,30);
 assert.equal(c.creatorCargo,undefined);
});

test('a workshop porter and a hand collector both deliver real material across a saved trip',()=>{
 for(const manual of [false,true]){
  let s=manual?createNewCity({mode:'awakening'}):createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
  s.creatorMaterials??=newCreatorMaterials();
  const resource=manual?'reed':'clay';
  for(const c of s.citizens){c.age=30;c.health=100;c.hunger=0;c.thirst=0;c.clothing=100;}
  for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=b.pantryDelivered=30;b.water=b.waterDelivered=12;}
  if(manual){
   const d=s.world.deposits.filter(d=>d.kind==='reed'&&d.x<12&&!s.buildings.some(b=>b.x===d.x&&b.y===d.y))
    .sort((a,b)=>Math.hypot(a.x-7,a.y-8)-Math.hypot(b.x-7,b.y-8))[0];
   assert.ok(orderManualGathering(s,d.x,d.y).ok);
  }else{
   const b=s.buildings.find(b=>b.type==='clay');
   Object.assign(s.citizens[0],{role:'production',calling:'clayworker',workplace:`${b.x},${b.y}`});
  }
  invalidateAssignments(s);syncCitizens(s);
  let loaded=false;
  for(let i=0;i<1800&&!s.creatorMaterials[resource];i++){
   s.event=null;advanceTime(s,.4);
   const carrier=s.citizens.find(c=>c.creatorCargo?.resource===resource);
   if(!loaded&&carrier){
    assert.equal(s.creatorMaterials[resource],0);
    assert.equal(Boolean(carrier.manualGathering),manual);
    assert.equal(Boolean(carrier.districtJob),!manual);
    const raw=encode(s);
    s=decode(raw);
    assert.ok(s);
    assert.equal(encode(s),raw);
    const corrupt=JSON.parse(raw);
    corrupt.citizens.find(c=>c.id===carrier.id).creatorCargo.amount=1000;
    assert.equal(decode(JSON.stringify(corrupt)),null);
    loaded=true;
   }
  }
  assert.ok(loaded,resource);
  assert.ok(s.creatorMaterials[resource]>0,resource);
  assert.equal(encode(decode(encode(s))),encode(s));
 }
});
