import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {invalidateAssignments,syncCitizens} from '../workforce.js';
import {syncInventory} from '../inventory.js';
import {requestTransfer} from '../district-logistics.js';
import {readFileSync} from 'node:fs';
import {projectLegacy} from './inventory-test-helpers.js';
import {advanceWellbeing,mealRation} from '../wellbeing.js';

test('a porter returning home with an uncollected district job can still fetch and eat dinner',()=>{
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'depot',x:10,y:9,level:1});s.citizens=[s.citizens[0]];s.population=1;
 const c=s.citizens[0];Object.assign(c,{role:'carrier',phase:'home',work:null,site:null,home:'8,8',x:7.5,y:8.5,cargo:{}});
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=0;b.pantryDelivered=0;b.water=100;b.waterDelivered=100;}
 s.simTime=31;s.seasonElapsed=31;syncInventory(s);requestTransfer(s,'9,8','10,9','wood',6);c.districtJob=s.district.jobs[0].id;c.store='9,8';invalidateAssignments(s);syncCitizens(s);
 let carriedFood=false;for(let i=0;i<220;i++){s.event=null;advanceTime(s,.1);carriedFood ||= c.pantryFood>0;}
 assert.ok(carriedFood,'an empty transport assignment must not lock the sole family shopper overnight');assert.ok(c.mealEaten>.75);assert.ok(s.resources.food>50);
});

test('actual v27 fixture migrates empty new containers while preserving every citizen and owned load',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v27-local-stock.json',import.meta.url))),s=decode(JSON.stringify(old));assert.ok(s);assert.equal(s.version,28);assert.deepEqual(s.citizens,old.citizens);
 for(const [k,n]of Object.entries(old.resources))assert.equal(s.resources[k],n);
 for(let i=0;i<old.buildings.length;i++)for(const [k,value]of Object.entries(old.buildings[i]))assert.deepEqual(projectLegacy(s.buildings[i][k],value),value,k);
 assert.ok(s.buildings.filter(b=>b.workshopStock).every(b=>Object.values(b.workshopStock.output).every(n=>n===0)));assert.ok(s.buildings.filter(b=>b.type==='house').every(b=>Object.values(b.householdStock).every(n=>n===0)));assert.ok(decode(encode(s)));
});

test('delivered home milk is really consumed for dinner and cannot create a city food credit',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],b=s.buildings.find(b=>`${b.x},${b.y}`===c.home);s.citizens=[c];s.population=1;s.simTime=30;Object.assign(c,{phase:'home',cargo:{},mealDay:-1,mealEaten:0,hunger:100});b.pantry=0;b.householdStock.milk=mealRation(c)*2;const food=s.resources.food;
 for(let i=0;i<30;i++){advanceWellbeing(s,.1);s.simTime+=.1;}
 assert.ok(c.mealEaten>mealRation(c)-1e-7);assert.ok(b.householdStock.milk<1e-7);assert.equal(b.pantry,0);assert.equal(s.resources.food,food);assert.ok(c.hunger<100);
});

test('exporting finished production never counts it a second time in seasonal history',async()=>{
 const {initializeBuildingInventory,putProductionOutput}=await import('../building-inventory.js');const {productionHistory}=await import('../building-production-history.js');const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'weaver',x:10,y:8,level:1,weaving:{wool:0}});s.citizens=s.citizens.slice(0,2);s.population=2;
 for(const c of s.citizens)Object.assign(c,{role:'carrier',phase:'home',work:null,cargo:{}});for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}
 initializeBuildingInventory(s);const b=s.buildings.at(-1);assert.ok(putProductionOutput(s,b,{cloth:2}));for(let i=0;i<200&&s.resources.cloth<2;i++){s.event=null;advanceTime(s,.1);}assert.equal(s.resources.cloth,2);assert.equal(productionHistory(s,b).reduce((n,row)=>n+(row.resources.cloth||0),0),2);
});

test('a full output shed pauses production before consuming its next real raw batch',async()=>{
 const {initializeBuildingInventory}=await import('../building-inventory.js');const {assignWorkplace}=await import('../management.js');const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'weaver',x:10,y:8,level:1,weaving:{wool:3}});s.citizens=[s.citizens[0]];s.population=1;const c=s.citizens[0];c.role='production';initializeBuildingInventory(s);const b=s.buildings.at(-1);b.workshopStock.output.cloth=24;assignWorkplace(s,c.id,'10,8');Object.assign(c,{phase:'working',x:9.5,y:8.5,workElapsed:0});s.buildings[0].pantry=100;s.buildings[0].pantryDelivered=100;s.buildings[0].water=100;
 advanceTime(s,1);assert.equal(b.weaving.wool,3);assert.equal(b.workshopStock.output.cloth,24);assert.equal(c.workElapsed,0);
});

test('a porter delivers clothing into the home reserve rather than the city warehouse',()=>{
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.citizens=[s.citizens[0]];s.population=1;const c=s.citizens[0],home=s.buildings.find(b=>`${b.x},${b.y}`===c.home);c.role='carrier';home.pantry=100;home.pantryDelivered=100;home.water=100;s.resources.clothing=2;syncInventory(s);assert.ok(requestTransfer(s,'9,8',c.home,'clothing',1,{automatic:true,targetKind:'input'}).ok);let inHands=false;
 for(let i=0;i<160&&home.householdStock.clothing<1;i++){s.event=null;advanceTime(s,.1);inHands ||= c.cargo.clothing>0;}
 assert.ok(inHands);assert.equal(home.householdStock.clothing,1);assert.equal(s.resources.clothing,1);assert.ok(decode(encode(s)));
});

test('milk in home vessels is included by meal warnings and supply views without writes',async()=>{
 const {foodWarnings,foodForecast}=await import('../food-planning.js'),{supplyOverview}=await import('../supply.js');const s=createGame({start:'established'}),c=s.citizens[0],b=s.buildings.find(b=>`${b.x},${b.y}`===c.home);s.citizens=[c];s.population=1;for(const h of s.buildings.filter(b=>b.type==='house'))h.pantry=0;b.householdStock.milk=2;
 const before=encode(s);assert.equal(foodWarnings(s).houses.find(h=>h.key===c.home).food,1);assert.equal(supplyOverview(s).houses.find(h=>h.key===c.home).food,1);assert.ok(foodForecast(s).ready>=1);assert.equal(encode(s),before);
});

test('milk carried to a home counts once in the meal forecast and survives reload',async()=>{
 const {foodWarnings,foodForecast}=await import('../food-planning.js'),{homeFoodInTransit}=await import('../households.js');const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.citizens=[s.citizens[0]];s.population=1;const c=s.citizens[0],b=s.buildings.find(b=>`${b.x},${b.y}`===c.home);c.role='carrier';b.pantry=100;b.pantryDelivered=100;b.water=100;s.resources.milk=2;syncInventory(s);requestTransfer(s,'9,8',c.home,'milk',2,{automatic:true,targetKind:'input'});
 for(let i=0;i<120&&!c.cargo.milk;i++){s.event=null;advanceTime(s,.1);}assert.equal(c.cargo.milk,2);for(const h of s.buildings.filter(b=>b.type==='house'))h.pantry=0;const before=encode(s),warning=foodWarnings(s).houses.find(h=>h.key===c.home);assert.equal(homeFoodInTransit(s,c.home),1);assert.equal(warning.inTransit,1);assert.equal(foodForecast(s).inTransit,1);assert.equal(encode(s),before);assert.ok(decode(before));
});

test('a fixed new workplace retains its seat while the resident finishes an old owned load',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1});const c=s.citizens[0];Object.assign(c,{work:'7,7',workplace:'6,8',cargo:{clay:2},phase:'toStore',store:'9,8'});invalidateAssignments(s);syncCitizens(s);
 const assigned=s.citizens.filter(c=>c.workplace==='6,8'||c.work==='6,8'&&!c.workplace);assert.ok(assigned.some(p=>p.id===c.id));assert.ok(assigned.length<=2);assert.equal(c.cargo.clay,2);
});

test('demolishing a cowshed refunds its actual delivered fodder exactly once',async()=>{
 const {takeStock}=await import('../inventory.js'),{demolish,demolitionRefund}=await import('../management.js'),{initializeBuildingInventory}=await import('../building-inventory.js');const s=createGame({start:'established'});s.buildings.push({type:'cowshed',x:2,y:2,level:1});syncCitizens(s);initializeBuildingInventory(s);const b=s.buildings.at(-1),fodder=takeStock(s,'9,8','reed',3);b.dairy.reed=fodder;const before=s.resources.reed,refund=demolitionRefund(b).reed||0;
 assert.ok(demolish(s,2,2).ok);assert.equal(s.resources.reed,before+fodder+refund);assert.equal(demolish(s,2,2).ok,false);assert.equal(s.resources.reed,before+fodder+refund);assert.ok(decode(encode(s)));
});

test('building inventory is a readonly view of distinct actual raw and output buffers',async()=>{
 const {buildingInventory,initializeBuildingInventory}=await import('../building-inventory.js');const s=createGame({start:'established'});s.buildings.push({type:'weaver',x:10,y:8,level:1,weaving:{wool:2}});initializeBuildingInventory(s);const b=s.buildings.at(-1);b.workshopStock.output.cloth=1;
 const before=encode(s),view=buildingInventory(s,b);assert.equal(view.input.wool,2);assert.equal(view.output.cloth,1);assert.equal(view.storage.cloth,undefined);assert.equal(encode(s),before);assert.notEqual(view.output,b.workshopStock.output);
});

test('a carrier delivers workshop input and exports completed goods with conservation and reload',async()=>{
 const {initializeBuildingInventory}=await import('../building-inventory.js');const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'weaver',x:10,y:8,level:1,weaving:{wool:0}});
 s.citizens=s.citizens.slice(0,2);s.population=2;for(const c of s.citizens)Object.assign(c,{role:'carrier',phase:'home',work:null,site:null,cargo:{}});for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}
 s.resources.wool=12;syncInventory(s);initializeBuildingInventory(s);const b=s.buildings.at(-1);b.workshopStock.output.cloth=2;const before=s.resources.cloth+2;invalidateAssignments(s);syncCitizens(s);let inputInHands=false,outputInHands=false;
 for(let i=0;i<450;i++){s.event=null;advanceTime(s,.1);inputInHands ||= s.citizens.some(c=>c.districtJob&&c.cargo.wool>0);outputInHands ||= s.citizens.some(c=>c.districtJob&&c.cargo.cloth>0);if(i%20===0)assert.ok(decode(encode(s)),`reload ${i}`);if(b.weaving.wool>=3&&b.workshopStock.output.cloth===0)break;}
 assert.ok(inputInHands);assert.ok(outputInHands);assert.equal(b.weaving.wool,3);assert.equal(s.resources.wool,9);assert.equal(s.resources.cloth,before);assert.equal(b.workshopStock.output.cloth,0);
});
