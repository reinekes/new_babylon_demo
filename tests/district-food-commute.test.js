import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceFrame,encode,decode} from '../engine.js';
import {useOneDayCalendar} from '../calendar.js';
import {setCitizenRole} from '../management.js';
import {initializeBuildingInventory,putProductionOutput} from '../building-inventory.js';
import {requestTransfer} from '../district-logistics.js';
import {appendGrain} from '../grain-origin.js';
import {workHourAt} from '../work-schedule.js';

test('one nearby porter continues a distant grain pickup overnight and delivers the original lot after reloading',()=>{
 const s=useOneDayCalendar(createGame({start:'established'}));
 const source={type:'field',x:10,y:17,level:1};
 const warehouse=s.buildings.find(b=>b.type==='shrine');
 s.buildings.push(source);
 for(const home of s.buildings.filter(b=>b.type==='house'))home.pantry=home.pantryDelivered=18;
 initializeBuildingInventory(s);
 assert.ok(putProductionOutput(s,source,{food:5}));
 const grain=[{field:'10,17',amount:5,end:5}];
 appendGrain(source,'grainOutput',grain,0);
 const adults=s.citizens.filter(c=>c.age>=16);
 const porter=adults.find(c=>c.home==='9,9'),farther=adults.find(c=>c.home==='8,8');
 for(const c of adults)assert.ok(setCitizenRole(s,c.id,c===porter||c===farther?'carrier':'builder').ok);
 const {ok,id}=requestTransfer(s,'10,17','9,8','food',5);
 assert.ok(ok);

 const hasArrived=(city,c)=>c.phase==='toDistrictSupply'&&c.routeIndex===c.route.length&&c.route.length>0&&workHourAt(city.simTime)<6;
 let waited=false;
 for(let step=0;step<150&&s.simTime<60;step++){
  advanceFrame(s,.1,25);
  assert.notEqual(farther.districtJob,id,'one porter can carry the entire lot');
  if(hasArrived(s,porter)){waited=true;break;}
 }
 assert.ok(waited,'porter reaches the distant yard after closing and waits at its door');
 assert.equal(porter.districtJob,id);
 assert.equal(porter.cargo.food||0,0);
 assert.equal(source.workshopStock.output.food,5);
 const saved=decode(encode(s));assert.ok(saved);
 const restored=saved.citizens.find(c=>c.id===porter.id);
 assert.deepEqual(restored.route,porter.route);
 assert.equal(restored.routeIndex,porter.routeIndex);

 const ownedJob=city=>city.district.jobs.find(q=>q.id===id);
 let loaded=false;
 for(let step=0;step<150&&ownedJob(saved).delivered<5;step++){
  advanceFrame(saved,.1,25);
  if(restored.cargo.food===5){loaded=true;assert.deepEqual(restored.grainCargo,grain);}
 }
 assert.ok(loaded);
 assert.equal(ownedJob(saved).delivered,5);
 assert.equal(ownedJob(saved).remaining,0);
 assert.equal(ownedJob(saved).cancelled,0);
 const stock=saved.buildings.find(b=>b.x===warehouse.x&&b.y===warehouse.y).grainStock;
 assert.deepEqual(stock?.map(({field,amount})=>({field,amount})),[{field:'10,17',amount:5}]);
 assert.equal(saved.buildings.find(b=>b.x===source.x&&b.y===source.y).workshopStock.output.food,0);
 assert.ok(decode(encode(saved)));
});
