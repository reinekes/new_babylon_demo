import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {miracle} from '../engine.js';
import {createOrder} from '../construction.js';

test('Stars reports real conditions, removes resolved targets, and expires at the next season',async()=>{
 const {starForecastView}=await import('../star-forecast.js');
 const s=createNewCity({mode:'awakening',seed:1});
 const home=s.buildings.find(b=>b.type==='house'),h=s.citizens.find(c=>c.home===`${home.x},${home.y}`);
 for(const b of s.buildings)if(b.type==='house')b.pantry=b.pantryDelivered=100;
 home.pantry=0;
 const site={type:'house',x:3,y:3,level:1,construction:createOrder({clay:10})};
 s.buildings.push(site);
 s.revelationEvidence.opening={time:0};s.godhood.stage='recognized';
 s.starObservations.nights=[{},{},{}];s.starObservations.harvest={};
 s.resources.faith=100;
 const prestige=s.resources.prestige;
 assert.ok(miracle(s,'stars').ok);
 assert.equal(s.resources.prestige,prestige+18);
 const results=starForecastView(s);
 assert.deepEqual(results.map(row=>row.kind),['food','construction']);
 assert.equal(results[0].key,h.home);
 assert.match(results[1].reason,/материал/);
 home.pantry=100;
 assert.deepEqual(starForecastView(s).map(row=>row.kind),['construction']);
 s.tick++;
 assert.deepEqual(starForecastView(s),[]);
});

test('a growing field without canal water is forecast, then rain resolves the risk',async()=>{
 const {recordStarForecast,starForecastView}=await import('../star-forecast.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.season=3;
 const field={type:'field',x:8,y:9,level:1,crop:{sown:1,growth:.2}};
 s.buildings.push(field);
 recordStarForecast(s);
 assert.ok(starForecastView(s).some(row=>row.kind==='water'&&row.key==='8,9'));
 s.rain=1;
 assert.ok(!starForecastView(s).some(row=>row.kind==='water'));
});

test('a demolished building retires its forecast and old address records do not attach to new orders',async()=>{
 const {build}=await import('../engine.js');
 const {demolish}=await import('../management.js');
 const {buildingKey}=await import('../definitions.js');
 const {recordStarForecast,starForecastView}=await import('../star-forecast.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.godhood.mode='mature';
 const home=s.buildings.filter(b=>b.type==='house').at(-1);
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=b.pantryDelivered=100;
 home.pantry=0;
 recordStarForecast(s);
 assert.deepEqual(starForecastView(s).map(row=>row.key),[buildingKey(home)]);
 const legacy=structuredClone(s.starObservations.forecast);
 const result=demolish(s,home.x,home.y);
 assert.ok(result.ok,result.reason);
 assert.deepEqual(s.starObservations.forecast.targets,[]);
 s.starObservations.forecast=legacy;
 const built=build(s,'house',home.x,home.y);
 assert.ok(built.ok,built.reason);
 assert.deepEqual(s.starObservations.forecast.targets,[]);
 assert.deepEqual(starForecastView(s),[]);
});

test('a repeated improvement does not inherit its cancelled order forecast or erase the food warning',async()=>{
 const {upgrade}=await import('../engine.js');
 const {cancelConstruction}=await import('../management.js');
 const {recordStarForecast,starForecastView}=await import('../star-forecast.js');
 const s=createNewCity({mode:'awakening',seed:1});
 s.godhood.mode='mature';s.resources.brick=100;
 const home=s.buildings.find(b=>b.type==='house'),{x,y}=home;
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=b.pantryDelivered=100;
 home.pantry=0;
 const first=upgrade(s,x,y);assert.ok(first.ok,first.reason);
 const order=home.construction.order;
 recordStarForecast(s);
 const legacy=structuredClone(s.starObservations.forecast);
 assert.deepEqual(starForecastView(s).map(r=>r.kind),['food','construction']);
 assert.ok(cancelConstruction(s,x,y).ok);
 assert.deepEqual(s.starObservations.forecast.targets.map(r=>r.kind),['food']);
 s.starObservations.forecast=legacy;
 delete s.nextConstructionOrder; // An old save could reuse the cancelled number.
 const second=upgrade(s,x,y);assert.ok(second.ok,second.reason);
 assert.equal(home.construction.order,order);
 assert.deepEqual(starForecastView(s).map(r=>r.kind),['food']);
});
