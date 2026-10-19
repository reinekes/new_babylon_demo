import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {seedReserve,availableFood,foodForecast,setSeedProtection} from '../food-planning.js';
import {cropFor,workField} from '../agriculture.js';
const field=s=>s.buildings.find(b=>b.type==='field');
test('seed reserve is part of food, not a new resource, and crisis release creates no food',()=>{
 const s=createGame();assert.equal(seedReserve(s),4);assert.equal(availableFood(s),96);const before=s.resources.food;assert.ok(setSeedProtection(s,false).ok);assert.equal(seedReserve(s),0);assert.equal(s.resources.food,before);assert.equal(availableFood(s),100);
});
test('sowing requires actual seeds delivered to the field, and consumes exactly four for a full sowing',()=>{
 const s=createGame(),b=field(s),c=cropFor(s,b);workField(s,b,12);assert.equal(c.sown,0);c.seedStock=2;workField(s,b,12);assert.equal(c.sown,.5);assert.equal(c.seedStock,0);c.seedStock=2;workField(s,b,12);assert.equal(c.sown,1);assert.equal(c.seedUsed,4);
});
test('cut sheaves are not edible until a separate threshing action; winter preserves gathered sheaves',()=>{
 const s=createGame(),b=field(s),c=cropFor(s,b);s.season=2;c.total=c.remaining=14;const before=s.resources.food;assert.equal(workField(s,b,4),0);assert.equal(c.sheaves,7);assert.equal(s.resources.food,before);assert.equal(workField(s,b,4),7);assert.equal(c.sheaves,0);assert.equal(c.threshed,7);
});
test('forecast separates ready meals, seed reserve, sheaves and uncertain future crop without double counting',()=>{
 const s=createGame(),c=cropFor(s,field(s));c.sheaves=21;const f=foodForecast(s);assert.equal(f.ready,s.resources.food-seedReserve(s));assert.equal(f.unthreshed,21);assert.equal(f.secondsToHarvest,90);assert.ok(f.demand>0);assert.equal(f.balance,f.ready-f.demand-f.pestRisk);assert.equal(f.cropPotential,0);
});
test('real people carry seeds and save/reload while carrying without losing food',()=>{
 const s=createGame();let carrying=false;for(let i=0;i<300;i++){s.event=null;advanceTime(s,.1);if(s.citizens.some(c=>c.seedFood>0)){carrying=true;const loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded,s);break;}}assert.ok(carrying);for(let i=0;i<200;i++){s.event=null;advanceTime(s,.1);}assert.equal(field(s).crop.sown,1);assert.equal(field(s).crop.seedUsed,4);assert.ok(decode(encode(s)));
});
import {readFileSync} from 'node:fs';
import {changeCropSeason} from '../agriculture.js';
import {demolish,setCitizenRole} from '../management.js';
import {recoverCitizenCargo} from '../workforce.js';
test('genuine v13 migration preserves stocks, people and old crop values without charging seeds',()=>{
 const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v13-autumn.json',import.meta.url),'utf8'));assert.equal(old.version,13);const s=decode(JSON.stringify(old));assert.ok(s);assert.deepEqual(Object.fromEntries(Object.keys(old.resources).map(k=>[k,s.resources[k]])),old.resources);assert.deepEqual(s.citizens.map((c,i)=>Object.fromEntries(Object.keys(old.citizens[i]).map(k=>[k,c[k]]))),old.citizens);for(const b of old.buildings){const migrated=s.buildings.find(q=>q.type===b.type&&q.x===b.x&&q.y===b.y);if(b.crop)for(const k of Object.keys(b.crop))assert.equal(migrated.crop[k],b.crop[k]);}assert.ok(decode(encode(s)));
});
test('winter spoils only uncut grain, and spring preserves gathered sheaves and delivered seeds',()=>{
 const s=createGame(),b=field(s),c=cropFor(s,b);s.season=2;c.total=c.remaining=21;workField(s,b,4);s.season=3;changeCropSeason(s,2);assert.equal(c.spoiled,14);assert.equal(c.sheaves,7);assert.equal(workField(s,b,4),7);c.sheaves=14;c.seedStock=2;s.season=0;s.year++;changeCropSeason(s,3);assert.equal(b.crop.sheaves,14);assert.equal(b.crop.seedStock,2);assert.equal(b.crop.sown,0);
});
function seedTrip(){const s=createGame();for(let i=0;i<300;i++){s.event=null;advanceTime(s,.1);const carrier=s.citizens.find(c=>c.seedFood>0);if(carrier)return {s,carrier};}throw Error('No real seed trip');}
test('death cargo recovery and field demolition refund physical seeds exactly once',()=>{
 {const {s,carrier}=seedTrip(),stock=s.resources.food,bag=carrier.seedFood;assert.ok(recoverCitizenCargo(s,carrier.id));assert.equal(s.resources.food,stock+bag);recoverCitizenCargo(s,carrier.id);assert.equal(s.resources.food,stock+bag);}
 {const {s,carrier}=seedTrip(),stock=s.resources.food,bag=carrier.seedFood,b=field(s);assert.ok(demolish(s,b.x,b.y).ok);assert.equal(s.resources.food,stock+bag);assert.ok(!s.citizens.some(c=>c.seedField));assert.ok(decode(encode(s)));}
});
test('inspiration waits for a seed carrier to deliver before changing profession',()=>{
 const {s,carrier}=seedTrip();assert.ok(setCitizenRole(s,carrier.id,'builder').ok);assert.equal(carrier.pendingRole,'builder');for(let i=0;i<200;i++){s.event=null;advanceTime(s,.1);}assert.equal(carrier.seedField,undefined);assert.equal(carrier.role,'builder');assert.ok(field(s).crop.seedUsed+field(s).crop.seedStock>0);assert.ok(decode(encode(s)));
});
test('forecast excludes sold cargo and seeds in transit, includes pantry delivery, and has no phantom dinners after dinner',()=>{
 const s=createGame(),c=s.citizens[0];c.cargo={food:7};c.saleJob=1;assert.equal(foodForecast(s).inTransit,0);delete c.saleJob;assert.equal(foodForecast(s).inTransit,7);c.cargo={};c.seedFood=4;assert.equal(foodForecast(s).inTransit,0);delete c.seedFood;c.pantryFood=3;assert.equal(foodForecast(s).inTransit,3);s.simTime=40;assert.equal(foodForecast(s).meals,1);
});
test('food forecast reserves losses for growing mice and does not assume a guard will work all night',()=>{
 const s=createGame(),f=foodForecast(s);assert.ok(f.pestRisk>=.036*f.secondsToHarvest-1e-8);s.citizens[0].guardPost=s.pests.sites[0].key;s.citizens[0].work=s.pests.sites[0].key;s.citizens[0].phase='working';assert.equal(foodForecast(s).pestRisk,f.pestRisk);
});
