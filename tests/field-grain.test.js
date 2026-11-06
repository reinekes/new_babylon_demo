import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {recordFieldGrain,pickupFieldGrain,acceptFieldGrain} from '../field-grain.js';

test('only accepted human grain counts, after the ordinary prefix in the same load',()=>{
 const s=createNewCity({mode:'awakening',seed:137});
 const [farmer,courier]=s.citizens;
 farmer.calling='farmer';
 const field={type:'field',x:12,y:8,workshopStock:{output:{food:10}}};
 s.buildings.push(field);
 recordFieldGrain(s,field,farmer,4,5);
 pickupFieldGrain(field,courier,7,10);
 assert.equal(courier.fieldGrain.amount,2);
 acceptFieldGrain(s,courier,5,true);
 assert.equal(s.earthDiscovery.receipts.length,0);
 acceptFieldGrain(s,courier,1,true);
 assert.deepEqual(s.earthDiscovery.receipts,[{fieldId:field.grainFieldId,field:'12,8',farmerId:farmer.id,inspired:true,amount:1,time:0}]);
 acceptFieldGrain(s,courier,1,true);
 assert.equal(s.earthDiscovery.receipts.length,1);
});

test('fertility can increase the physical sheaves but only the base portion is human evidence',async()=>{
 const {changeCropSeason,workField}=await import('../agriculture.js');
 const s=createNewCity({mode:'awakening',seed:137}),farmer=s.citizens[0];
 const field={type:'field',x:12,y:8,level:1,crop:{sown:1,growth:1,remaining:0,total:0,harvested:0,spoiled:0,seedStock:0,seedUsed:4,sheaves:0,threshed:0}};
 s.buildings.push(field);
 s.buffs.fertility=1;
 changeCropSeason(s,3);
 s.buffs.fertility=0;
 workField(s,field,4,farmer);
 assert.equal(field.crop.sheaves,7);
 assert.equal(field.crop.humanSheaves,7/1.6);
 assert.equal(workField(s,field,4,farmer),7);
 assert.equal(field.crop.humanSheaves,0);
});

test('rebuilding on the same tile replaces its evidence and cannot add another field',()=>{
 const s=createNewCity({mode:'awakening',seed:137}),[farmer,courier]=s.citizens;
 function deliver(field){
  recordFieldGrain(s,field,farmer,2,0);
  pickupFieldGrain(field,courier,2,2);
  acceptFieldGrain(s,courier,2,true);
 }
 const field={type:'field',x:12,y:8},replacement={...field};
 s.buildings.push(field);deliver(field);
 s.buildings.pop();s.buildings.push(replacement);deliver(replacement);
 assert.notEqual(replacement.grainFieldId,field.grainFieldId);
 assert.equal(s.earthDiscovery.receipts.length,1);
 assert.equal(s.earthDiscovery.receipts[0].fieldId,replacement.grainFieldId);
});

test('the milestone needs three currently operational fields and an inspired grain receipt',async()=>{
 const {advanceFieldGrain,fieldGrainView}=await import('../field-grain.js');
 const {decode,encode}=await import('../engine.js');
 const {cityToolsHTML}=await import('../ui-city-tools.js');
 const {stampBuildingCompletion}=await import('../building-chronology.js');
 const {initializeBuildingInventory}=await import('../building-inventory.js');
 const {initializeCrops}=await import('../agriculture.js');
 const {syncCitizens}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:137}),[farmer,courier]=s.citizens;
 const sites=[[9,7],[10,7],[11,7]].map(([x,y])=>({type:'field',x,y,level:1}));
 for(const site of sites){s.buildings.push(site);stampBuildingCompletion(s,site);}
 initializeBuildingInventory(s);initializeCrops(s);syncCitizens(s);
 function deliver(field){
  recordFieldGrain(s,field,farmer,2,0);
  pickupFieldGrain(field,courier,2,2);
  acceptFieldGrain(s,courier,2,true);
 }
 for(const field of sites)deliver(field);
 assert.equal(advanceFieldGrain(s),false);
 assert.equal(fieldGrainView(s).fields,3);
 farmer.calling='farmer';
 deliver(sites[0]);
 const missing=s.buildings.pop();
 assert.equal(fieldGrainView(s).fields,2);
 assert.equal(advanceFieldGrain(s),false);
 const replacement={...missing};delete replacement.grainFieldId;
 s.buildings.push(replacement);
 assert.match(cityToolsHTML(s),/Поля со складской приёмкой · 2 из 3/);
 deliver(replacement);
 assert.equal(advanceFieldGrain(s),true);
 assert.equal(advanceFieldGrain(s),false);
 assert.equal(s.earthDiscovery.qualifiedAt,0);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 assert.match(cityToolsHTML(loaded),/Условия выполнены/);
 delete loaded.earthDiscovery.qualifiedAt;
 const prior=encode(loaded),old=decode(prior);
 assert.ok(old);
 assert.equal(encode(old),prior);
 assert.equal(advanceFieldGrain(old),true);
});
