import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode,build} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {cancelConstruction,inspireCitizen} from '../management.js';
import {orderManualGathering} from '../manual-gathering.js';
import {reserveStock,refundSources,takeStock} from '../inventory.js';
import {newCreatorMaterials,markCreatorCargo,acceptCreatorCargo,creatorMaterialsView,addCreatorStock} from '../creator-materials.js';

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

test('construction reserves local materials by store and cancellation restores their origin',()=>{
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.creatorMaterials=newCreatorMaterials();
 const store=s.buildings.find(b=>b.type==='shrine');
 addCreatorStock(store,'clay',7);
 const clay=s.resources.clay;
 const creatorAllocations={};
 const materials=reserveStock(s,{clay:10},{creatorAllocations});
 assert.equal(s.resources.clay,clay-10);
 assert.deepEqual(creatorAllocations,{'9,8':{clay:7}});
 assert.equal(store.creatorStock,undefined);
 refundSources(s,materials,creatorAllocations);
 assert.equal(s.resources.clay,clay);
 assert.deepEqual(store.creatorStock,{clay:7});
 const c={cargo:{clay:5}};
 assert.equal(takeStock(s,'9,8','clay',5,{creatorTo:c}),5);
 assert.equal(acceptCreatorCargo(s,c,'clay',5),5);
 assert.equal(s.creatorMaterials.clay,0);
});

test('a real building order survives loading, cancels without losing provenance and records the completed build',()=>{
 let s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}});
 s.creatorMaterials=newCreatorMaterials();
 const builder=s.citizens.find(c=>c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:builder.id,recognitionAt:0,believerIds:[builder.id]});
 s.resources.faith=1;
 assert.ok(inspireCitizen(s,builder.id,'builder').success);
 const point={x:8,y:9},shrine=()=>s.buildings.find(b=>b.type==='shrine'),yard=()=>s.buildings.find(b=>b.x===point.x&&b.y===point.y);
 addCreatorStock(shrine(),'clay',20);
 addCreatorStock(shrine(),'reed',10);
 const order=()=>assert.equal(build(s,'house',point.x,point.y).ok,true);
 order();
 const allocated=yard().construction.creatorAllocations;
 assert.ok(allocated['9,8'].clay>0&&allocated['9,8'].reed>0);
 const raw=encode(s);
 s=decode(raw);
 assert.ok(s);
 assert.equal(encode(s),raw);
 assert.equal(cancelConstruction(s,point.x,point.y).ok,true);
 assert.deepEqual(shrine().creatorStock,{clay:20,reed:10});
 order();
 for(let i=0;i<1800&&yard().construction;i++){s.event=null;advanceTime(s,.4);}
 assert.equal(yard().construction,undefined);
 assert.deepEqual(yard().creatorBuilt,allocated['9,8']);
 assert.equal(encode(decode(encode(s))),encode(s));
});
