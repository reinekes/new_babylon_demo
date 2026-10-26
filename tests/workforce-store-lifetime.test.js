import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,advanceTime} from '../engine.js';
import {MATERIALS,buildingKey,housingOf} from '../definitions.js';
import {stockStores,syncInventory,putStock,takeStock,validateInventory} from '../inventory.js';
import {syncCitizens,recoverCitizenCargo} from '../workforce.js';
import {advanceGenerations} from '../demography.js';
import {initializeBuildingInventory} from '../building-inventory.js';
import {syncDistrictJobs} from '../district-logistics.js';

test('recovery cannot discard clothing after a cached founding household stops being a warehouse',()=>{
 const s=createGame();s.buildings.push({type:'depot',x:8,y:9,level:1,stockMinimum:{food:0}});syncInventory(s);syncCitizens(s);
 const c=s.citizens[0],home=s.buildings.find(b=>buildingKey(b)===c.home);
 putStock(s,'8,9','clothing',1);const load=takeStock(s,'8,9','clothing',1);
 Object.assign(c,{store:'8,9',clothingTarget:c.id,clothingLoad:load,clothing:20,phase:'toClothesHome',work:null,site:null,cargo:{},route:[],routeIndex:0});
 // Consuming the last supplies changes storage membership without changing roads
 // or buildings. The household remains a real home but is no longer a warehouse.
 for(const k of MATERIALS)takeStock(s,buildingKey(home),k,1e9);syncInventory(s);
 assert.ok(!stockStores(s).includes(home));assert.ok(decode(encode(s)),'the in-transit save is valid');
 const expected=s.resources.clothing+c.clothingLoad;recoverCitizenCargo(s,c.id);
 assert.equal(s.resources.clothing+(c.clothingLoad||0),expected,'a stale cached holder cannot swallow the load');
 assert.ok(decode(encode(s)));
});

test('death on a disconnected bank preserves owned goods when no current warehouse is reachable',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'house',x:20,y:8,level:1});s.capacity=housingOf(s);syncInventory(s);syncCitizens(s);
 const c=s.citizens[0],load=takeStock(s,'9,8','wood',1);
 Object.assign(c,{age:85,home:'20,8',x:20.5,y:8.5,store:'9,8',phase:'blocked',work:null,site:null,cargo:{wood:load},route:[],routeIndex:0});
 assert.ok(decode(encode(s)),'a stranded cargo owner is a valid save');const expected=s.resources.wood+load;
 const report=advanceGenerations(s,id=>recoverCitizenCargo(s,id));
 assert.ok(report.deceased.some(person=>person.id===c.id));assert.ok(!s.citizens.some(person=>person.id===c.id));
 assert.equal(s.resources.wood,expected,'removing a deceased owner must first recover every owned unit');
 assert.equal(stockStores(s).reduce((total,b)=>total+(b.stock.wood||0),0),expected,'the recovered goods have a physical holder');
});

test('a recovered isolated-yard carrier remains reloadable and the temporary holder expires only when empty',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'logging',x:28,y:15,level:1});initializeBuildingInventory(s);syncInventory(s);syncCitizens(s);
 const c=s.citizens[0],yard=s.buildings.at(-1);
 s.district.jobs=[{id:1,source:'28,15',target:'9,8',resource:'wood',amount:1,remaining:0,delivered:0,cancelled:0,automatic:true}];s.district.nextId=2;
 Object.assign(c,{role:'carrier',x:28.5,y:15.5,store:'9,8',phase:'toDistrictStore',districtJob:1,work:null,site:null,cargo:{wood:1},route:[],routeIndex:0});
 assert.ok(decode(encode(s)),'the bridge-stranded shipment is valid');const before=s.resources.wood;
 assert.equal(recoverCitizenCargo(s,c.id),true);assert.equal(s.district.jobs[0].cancelled,1);assert.equal(s.resources.wood,before+1);
 assert.equal(yard.stock?.wood,1,'recovery stays on the reachable bank');assert.ok(decode(encode(s)),'surviving carrier and temporary holder can reload');
 assert.equal(takeStock(s,'28,15','wood',1),1);syncInventory(s);
 assert.equal(yard.stock,undefined);assert.equal(yard.recoveryOnly,undefined);assert.ok(decode(encode(s)));
});

test('a stranded load is recovered in a real yard when that bank has no home or warehouse',()=>{
 const s=createGame({start:'established'}),yard={type:'logging',x:28,y:15,level:1};s.buildings.push(yard);initializeBuildingInventory(s);syncInventory(s);syncCitizens(s);
 const c=s.citizens[0],load=takeStock(s,'9,8','wood',1),left=s.buildings.find(b=>b.type==='shrine').stock.wood;yard.workshopStock.output.wood=2;
 Object.assign(c,{age:85,x:28.5,y:15.5,store:'9,8',phase:'blocked',work:'28,15',site:null,cargo:{wood:load},route:[],routeIndex:0});assert.ok(decode(encode(s)));
 advanceGenerations(s,id=>recoverCitizenCargo(s,id));assert.ok(!s.citizens.some(p=>p.id===c.id));assert.equal(yard.recoveryOnly,true);assert.equal(yard.stock.wood,1);assert.equal(yard.workshopStock.output.wood,2);assert.equal(s.buildings.find(b=>b.type==='shrine').stock.wood,left);assert.ok(decode(encode(s)));
 s.buildings.push({type:'depot',x:28,y:13,level:1,stockMinimum:{food:0}});syncInventory(s);syncCitizens(s);s.district.lastScan=-1;syncDistrictJobs(s);
 const q=s.district.jobs.find(q=>q.source==='28,15'&&q.resource==='wood');assert.equal(q.amount,1,'the recovery job owns stock, not the separate two-unit finished output');assert.equal(yard.workshopStock.output.wood,2);assert.ok(decode(encode(s)));
 const invalid=structuredClone(s);invalid.buildings.find(b=>b.type==='logging').recoveryOnly=false;assert.equal(validateInventory(invalid),false);
});

test('an owner with no reachable operational holder is retained when recovery refuses removal',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],load=takeStock(s,'9,8','wood',1);Object.assign(c,{age:85,x:28.5,y:15.5,phase:'blocked',work:null,site:null,cargo:{wood:load},route:[],routeIndex:0});assert.ok(decode(encode(s)));
 const before=encode(s);assert.equal(recoverCitizenCargo(s,c.id),false);assert.equal(encode(s),before);const report=advanceGenerations(s,id=>recoverCitizenCargo(s,id));assert.ok(!report.deceased.some(p=>p.id===c.id));assert.equal(s.citizens.find(p=>p.id===c.id)?.cargo.wood,1);assert.equal(c.age,85);assert.ok(decode(encode(s)));
});

test('seasonal starvation removal honors failed cargo recovery before death statistics',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],load=takeStock(s,'9,8','wood',1);Object.assign(c,{age:30,x:28.5,y:15.5,phase:'blocked',work:null,site:null,cargo:{wood:load},route:[],routeIndex:0,health:0,hunger:100,missedMeals:3});assert.ok(decode(encode(s)));
 advanceTime(s,45);assert.equal(s.deaths,0);assert.equal(s.citizens.find(p=>p.id===c.id)?.cargo.wood,1);assert.ok(!s.funeral);assert.ok(decode(encode(s)));
});

test('population reconciliation cannot pop an owner whose cargo has no reachable holder',()=>{
 const s=createGame({start:'established'}),c=s.citizens.at(-1),load=takeStock(s,'9,8','wood',1);Object.assign(c,{age:30,x:28.5,y:15.5,phase:'blocked',work:null,site:null,cargo:{wood:load},route:[],routeIndex:0});s.population--;
 syncCitizens(s);assert.equal(s.population,12);assert.equal(s.citizens.at(-1).id,c.id);assert.equal(c.cargo.wood,1);assert.ok(decode(encode(s)));
});
