import {advanceCalendar} from './helpers/calendar-time.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import * as planning from '../food-planning.js';
import {mealRation,mealCycle} from '../wellbeing.js';
const read=s=>planning.foodWarnings(s);
function supplied(s){for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=30;b.pantryDelivered=30;}return s;}
test('healthy supplied city has no warnings; diagnostics never change save or news',()=>{const s=supplied(createGame({start:'established'})),before=encode(s);assert.deepEqual(read(s).alerts,[]);read(s);assert.equal(encode(s),before);assert.ok(decode(encode(s)));});
test('forecast deficit warns before hunger, and clears when food is replenished',()=>{const s=supplied(createGame({start:'established'}));s.resources.food=4;for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=1;const w=read(s);assert.equal(w.hungry,0);assert.ok(w.alerts.some(a=>a.id==='food'));s.resources.food=200;assert.ok(!read(s).alerts.some(a=>a.id==='food'));});
test('seeds distinguish physical shortage from unprotected stock and ignore seeds already on fields or carried',()=>{const s=supplied(createGame({start:'established'}));s.resources.food=2;assert.equal(read(s).seeds.missing,2);assert.ok(read(s).alerts.some(a=>a.id==='seeds'));s.resources.food=100;s.foodPlan.protectSeeds=false;assert.equal(read(s).seeds.missing,0);assert.ok(read(s).alerts.some(a=>a.id==='seeds'));const b=s.buildings.find(b=>b.type==='field');b.crop.seedStock=4;assert.ok(!read(s).alerts.some(a=>a.id==='seeds'));b.crop.seedStock=0;s.citizens[0].seedFood=4;assert.ok(!read(s).alerts.some(a=>a.id==='seeds'));});
test('hungry family identified despite full city stores; empty houses excluded and child hunger visible',()=>{const s=supplied(createGame({start:'established'}));s.resources.food=200;const c=s.citizens.find(c=>c.age<16)||s.citizens[0];c.age=8;c.hunger=80;const w=read(s),h=w.houses.find(h=>h.key===c.home);assert.equal(w.hungry,1);assert.equal(h.hungryChildren,1);assert.ok(h.hungryResidents.some(p=>p.id===c.id));assert.equal(w.alerts.find(a=>a.id==='families').severity,'danger');assert.ok(w.houses.every(h=>h.residents.length));});
test('evening warns for an undelivered meal, but carried food covers risk and a finished dinner does not trigger it',()=>{const s=supplied(createGame({start:'established'})),home=s.buildings.find(b=>b.type==='house');s.simTime=27;home.pantry=0;let h=read(s).houses.find(h=>h.key===`${home.x},${home.y}`);assert.ok(h.atRisk);const c=s.citizens.find(c=>c.home===h.key);c.pantryTrip=true;c.pantryFood=h.need;h=read(s).houses.find(h=>h.key===c.home);assert.equal(h.atRisk,false);assert.ok(h.awaitingDelivery);delete c.pantryTrip;delete c.pantryFood;s.simTime=35;for(const p of s.citizens){p.mealDay=mealCycle(s.simTime);p.mealEaten=mealRation(p);}h=read(s).houses.find(h=>h.key===c.home);assert.equal(h.need,0);assert.equal(h.atRisk,false);});
test('minor missed meal is reported before hunger reaches thirty; fed recovery clears stale missed-meal warning',()=>{const s=supplied(createGame({start:'established'})),c=s.citizens[0];c.hunger=20;c.missedMeals=1;c.lastMealQuality=.8;assert.ok(read(s).hungry>0);s.simTime=35;c.mealDay=mealCycle(s.simTime);c.mealEaten=mealRation(c);assert.equal(read(s).hungry,0);});
test('blocked carrier cannot hide an evening family shortage',()=>{const s=supplied(createGame({start:'established'})),home=s.buildings.find(b=>b.type==='house');home.pantry=0;s.simTime=27;const c=s.citizens.find(c=>c.home===`${home.x},${home.y}`);c.pantryTrip=true;c.pantryFood=6;c.phase='blocked';const h=read(s).houses.find(h=>h.key===c.home);assert.ok(h.atRisk);assert.ok(h.blockedDelivery);assert.equal(h.awaitingDelivery,false);});

import {setCitizenRole} from '../management.js';
test('real missed family dinner creates warnings and feeding over following dinners clears them after reload',()=>{
 const s=createGame({start:'established'});s.resources.food=2;for(const c of s.citizens)setCitizenRole(s,c.id,'builder');for(let i=0;i<600;i++){s.event=null;advanceCalendar(s,.1);}assert.ok(read(s).hungry>0);const loaded=decode(encode(s));assert.ok(loaded);assert.equal(read(loaded).hungry,read(s).hungry);loaded.resources.food=200;for(const b of loaded.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;}for(let i=0;i<1200;i++){loaded.event=null;advanceCalendar(loaded,.1);}assert.equal(read(loaded).hungry,0);assert.ok(!read(loaded).alerts.some(a=>a.id==='families'));
});

test('a covered dinner stays distinct from the shortfall if new supplies stop',()=>{
 const s=createGame({start:'established'});
 s.simTime=27;
 s.resources.food=5;
 for(const home of s.buildings.filter(b=>b.type==='house'))home.pantry=8;
 const w=read(s);
 assert.equal(w.dinner.status,'covered');
 const harvest=w.alerts.find(a=>a.id==='food');
 assert.match(harvest.text,/без новых поставок/i);
 assert.equal(harvest.severity,'warning');
});

test('a single evening shortage opens the affected home even with plentiful warehouse food',()=>{
 const s=supplied(createGame({start:'established'}));
 s.simTime=27;
 s.resources.food=200;
 const home=s.buildings.find(b=>b.type==='house');
 home.pantry=0;
 const w=read(s);
 assert.equal(w.dinner.status,'risk');
 assert.equal(w.dinner.houseCount,1);
 assert.equal(w.alerts.find(a=>a.id==='families').homeKey,`${home.x},${home.y}`);
 assert.ok(!w.alerts.some(a=>a.id==='food'));
});

test('household dinner reports full, partial and missed portions separately from the next reserve',async()=>{
 const {householdDinner,advanceWellbeing}=await import('../wellbeing.js');
 const residents=[{age:30},{age:8}].map(c=>({...c,hunger:0,health:100,mood:75,faith:60,mealDay:0,mealEvaluated:-1,missedMeals:0,prayerTotal:0}));
 const s={simTime:55,citizens:residents,buildings:[],resources:{faith:0}};
 for(const [portion,percent] of [[1,100],[.9375,94],[0,0]]){
  for(const c of residents){c.mealEvaluated=-1;c.mealEaten=mealRation(c)*portion;}
  advanceWellbeing(s,.1);
  const report=householdDinner(s.simTime,residents,.6);
  assert.equal(report.lastPercent,percent);
  assert.equal(report.reserve,.6);
  assert.ok(Math.abs(report.need-1.2)<1e-7);
 }
 assert.equal(householdDinner(0,residents,0).lastPercent,null);
});

test('map warning distinguishes a slight shortfall, a missed dinner and a mixture',()=>{
 const s=supplied(createGame({start:'established'}));
 s.simTime=55;
 const [a,b]=s.citizens;
 const warning=()=>read(s).alerts.find(alert=>alert.id==='families');
 assert.equal(warning(),undefined);
 Object.assign(a,{mealDay:0,mealEvaluated:0,lastMealQuality:.9375,missedMeals:1});
 assert.match(warning().title,/небольшой недобор/i);
 assert.equal(warning().homeKey,a.home);
 Object.assign(b,{mealDay:0,mealEvaluated:0,lastMealQuality:0,missedMeals:1,hunger:100});
 assert.match(warning().title,/пропустили ужин/i);
 assert.match(warning().title,/недобор/i);
 assert.equal(warning().severity,'danger');
 a.lastMealQuality=1;a.missedMeals=0;
 assert.match(warning().title,/пропустили ужин/i);
 assert.doesNotMatch(warning().title,/недобор/i);
});

test('a time jump ending at dawn clears the fully fed home from the assistance filter',async()=>{
 const {advanceTime}=await import('../engine.js');
 const s=createGame({start:'established'});
 s.simTime=90.675;
 s.resources.food=0;
 const fedHome=s.buildings.find(b=>b.type==='house'&&b.x===8);
 fedHome.pantry=15;
 fedHome.pantryDelivered=15;
 for(const c of s.citizens){
  c.mealDay=1;
  c.mealEvaluated=0;
  c.mealEaten=0;
  c.missedMeals=1;
  c.lastMealQuality=.9375;
 }
 advanceTime(s,115.05-s.simTime);
 assert.deepEqual(read(s).riskFamilies.map(h=>h.key),['9,9']);
 const fed=s.citizens.filter(c=>c.home==='8,8');
 assert.ok(fed.every(c=>c.mealEvaluated===1&&c.lastMealQuality>=.95));
});
