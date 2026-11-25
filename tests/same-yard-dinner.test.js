import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {createGame,decode,encode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {buildingKey} from '../definitions.js';
import {initializeCrops} from '../agriculture.js';
import {requestTransfer,setStoreExports,setStoreMinimum,syncDistrictJobs,validateDistricts} from '../district-logistics.js';
import {foodAvailableAt,putRecoveryStock,stockStores,syncInventory} from '../inventory.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {addGiftFood,giftAmount} from '../abundance-origin.js';
import {appendGrain} from '../grain-origin.js';
import {advanceWellbeing,mealRation} from '../wellbeing.js';

function startDinner(s){
 s.simTime=31;
 s.seasonElapsed=s.simTime/4;
 s.calendarOffset=s.simTime-s.seasonElapsed;
}

test('food on the family courtyard reaches an away resident while protected grain and an outgoing order stay stocked',()=>{
 const s=useOneDayCalendar(createNewCity({mode:'awakening',seed:137}));
 const home=s.buildings[0],key=buildingKey(home);
 const field={type:'field',x:11,y:9,level:1},store={type:'granary',x:10,y:9,level:1};
 s.buildings.push(field,store);
 initializeCrops(s);s.resources.food=0;syncInventory(s);
 const family=s.citizens.filter(c=>c.home===key),dinner=family.reduce((n,c)=>n+mealRation(c),0);
 for(const c of family)c.phase='toWork';
 const seed=4,ordered=5,initial=seed+ordered+dinner;
 assert.equal(putRecoveryStock(s,key,'food',initial),initial);
 appendGrain(home,'grainStock',[{field:buildingKey(field),amount:dinner,end:dinner}],0);
 addGiftFood(home,'giftStock',[dinner],0);
 const order=requestTransfer(s,key,buildingKey(store),'food',ordered);
 assert.ok(order.ok,order.reason);
 assert.equal(home.pantry||0,0);

 startDinner(s);
 syncDistrictJobs(s);

 assert.equal(home.pantry,dinner);
 assert.equal(home.pantryDelivered,dinner);
 assert.equal(s.resources.food,seed+ordered);
 assert.equal(home.stock.food,seed+ordered);
 assert.equal(foodAvailableAt(s,key),ordered);
 assert.equal(s.district.jobs.find(q=>q.id===order.id).remaining,ordered);
 assert.equal(giftAmount(home.giftHome),dinner);
 assert.deepEqual(home.grainPantry,[{field:buildingKey(field),amount:dinner,end:dinner}]);
 assert.equal(home.lastRation,undefined);
 assert.deepEqual(s.richCatchEvidence.homes,[]);
 assert.equal(s.deliveries,0);

 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 advanceWellbeing(loaded,3);
 const dinners=loaded.citizens.filter(c=>c.home===key);
 assert.ok(dinners.every(c=>c.phase==='toWork'&&c.mealEaten>=mealRation(c)-1e-7));
 assert.ok(loaded.buildings[0].pantry<1e-7);
 assert.ok(Math.abs(loaded.buildings[0].grainDinner.fields[0].amount-dinner)<1e-7);
 assert.equal(giftAmount(loaded.buildings[0].giftHome),0);
});

test('a resident already sheltered at an otherwise empty courtyard eats from that supply address',()=>{
 const s=useOneDayCalendar(createNewCity({mode:'mature',seed:137}));
 const [home,host]=s.buildings,key=buildingKey(host);
 for(const c of s.citizens.filter(c=>c.home===key))c.home=buildingKey(s.buildings[2]);
 const guest=s.citizens.find(c=>c.home===buildingKey(home)&&c.age>=16);
 Object.assign(guest,{floodShelter:key,phase:'blocked',route:[],routeIndex:0});
 s.resources.food=0;syncInventory(s);
 assert.equal(putRecoveryStock(s,key,'food',8),8);
 startDinner(s);

 syncDistrictJobs(s);
 assert.equal(host.pantry,mealRation(guest));
 advanceWellbeing(s,3);
 assert.ok(guest.mealEaten>=mealRation(guest)-1e-7);
 assert.ok(host.pantry<1e-7);
});

test('the same scan routes new workshop loads past a now-empty temporary public stockpile',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const homes=s.buildings.filter(b=>b.type==='house');
 s.foodPlan.protectSeeds=false;
 s.resources.food=0;syncInventory(s);
 for(const home of homes){
  const key=buildingKey(home),dinner=s.citizens.filter(c=>c.home===key).reduce((n,c)=>n+mealRation(c),0);
  assert.equal(putRecoveryStock(s,key,'food',dinner),dinner);
 }
 const yard={type:'logging',x:7,y:8,level:1};
 s.buildings.push(yard);initializeBuildingInventory(s);
 assert.ok(putProductionOutput(s,yard,{wood:7}));

 startDinner(s);
 syncDistrictJobs(s);

 assert.deepEqual(stockStores(s).map(buildingKey),['9,8']);
 const wood=s.district.jobs.find(q=>q.source===buildingKey(yard)&&q.resource==='wood');
 assert.equal(wood?.target,'9,8');
 assert.ok(validateDistricts(s));
});

test('an empty courtyard stockpile keeps its player-defined policy and remains saveable',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const homes=s.buildings.filter(b=>b.type==='house');
 s.foodPlan.protectSeeds=false;
 s.resources.food=0;syncInventory(s);
 for(const home of homes){
  const key=buildingKey(home),dinner=s.citizens.filter(c=>c.home===key).reduce((n,c)=>n+mealRation(c),0);
  assert.equal(putRecoveryStock(s,key,'food',dinner),dinner);
 }
 const [minStock,noExport]=homes;
 assert.ok(setStoreMinimum(s,buildingKey(minStock),'clay',2).ok);
 assert.ok(setStoreExports(s,buildingKey(noExport),false).ok);
 assert.ok(decode(encode(s)));

 startDinner(s);
 syncDistrictJobs(s);

 assert.equal(minStock.stock?.food,0);
 assert.equal(noExport.stock?.food,0);
 assert.equal(minStock.stockMinimum.clay,2);
 assert.equal(noExport.noExport,true);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
});
