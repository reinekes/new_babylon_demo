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
