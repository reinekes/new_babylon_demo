import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {AUTUMN_CROPS} from '../crop-calendar.js';
import {foodForecast,foodWarnings,seedReserve} from '../food-planning.js';
import {foodAvailability,putStock} from '../inventory.js';
import {assignWorkplace} from '../management.js';
import {strictScenario} from '../scenario-profiles.js';
import {seasonBalance} from '../season-balance.js';
import {syncCitizens} from '../workforce.js';

test('warehouse availability and food forecast protect the same grain during autumn sowing',()=>{
 const s=createGame({start:'established'});
 s.cropCalendar=AUTUMN_CROPS;s.season=2;s.buildings.find(b=>b.type==='field').crop.sown=1;
 assert.equal(seedReserve(s),0);
 assert.equal(foodAvailability(s,{reconcile:false}).get('9,8'),100);
});

test('food forecast separates accessible stock from isolated food, cargo and workshop output',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0];
 s.buildings.push({type:'granary',x:21,y:8,level:1});
 putStock(s,'21,8','food',40);
 s.buildings.find(b=>b.type==='field').workshopStock.output.food=21;
 c.cargo={food:7};
 const forecast=foodForecast(s);
 assert.equal(forecast.accessible,96);
 assert.equal(forecast.isolated,40);
 assert.equal(forecast.inTransit,7);
 assert.equal(forecast.workshop,21);
 assert.equal(forecast.ready,96);
});

test('dinner counts covered households independently from supplies and blocked cargo',()=>{
 const s=createGame({start:'established'}),home=s.buildings.find(b=>b.type==='house');
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=30;
 home.pantry=0;
 const c=s.citizens.find(c=>c.home===`${home.x},${home.y}`);
 c.pantryTrip=true;c.pantryFood=20;c.phase='toPantryHome';
 let {dinner}=foodWarnings(s);
 assert.deepEqual([dinner.total,dinner.covered,dinner.inTransit,dinner.short],[2,1,1,0]);
 c.phase='blocked';({dinner}=foodWarnings(s));
 assert.deepEqual([dinner.total,dinner.covered,dinner.inTransit,dinner.short],[2,1,0,1]);
});

test('fishing potential shares the remaining stock across yards and ignores exhausted grounds',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 s.buildings.push({type:'fishing',x:11,y:9,level:2},{type:'fishing',x:11,y:10,level:2});
 syncCitizens(s);
 assert.ok(assignWorkplace(s,0,'11,9').ok);
 assert.ok(assignWorkplace(s,1,'11,10').ok);
 s.fisheries={'river:2':{stock:9},'river:3':{stock:0}};
 assert.ok(Math.abs(seasonBalance(s).food.income-9)<1e-7);
 s.fisheries['river:2'].stock=0;
 assert.equal(seasonBalance(s).food.income,0);
});

test('dinner separates missing deliveries from a citywide shortage and counts people at their shelter',async()=>{
 const {dinnerFoodBalance}=await import('../food-planning.js');
 const s=createGame({start:'established'});
 const homes=s.buildings.filter(b=>b.type==='house');
 const keys=homes.map(b=>b.x+','+b.y);
 for(const c of s.citizens)if(c.home===keys[0])c.floodShelter=keys[1];
 for(const b of homes)b.pantry=0;
 s.resources.food=s.resources.milk=0;
 const homesToday=foodWarnings(s).houses;
 assert.equal(homesToday.length,1);
 assert.equal(homesToday[0].key,keys[1]);
 const meal=homesToday[0].need;
 const yard=s.buildings.find(b=>b.type==='field');
 yard.workshopStock.output.food=meal;
 assert.deepEqual(dinnerFoodBalance(s,homesToday),{missingAtHomes:meal,missingInCity:0});
 yard.workshopStock.output.food=0;
 assert.equal(dinnerFoodBalance(s,homesToday).missingInCity,meal);
});
