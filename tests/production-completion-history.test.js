import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {initializeArtisans,advanceArtisans,workArtisan} from '../artisan.js';
import {initializeBricks,advanceBricks} from '../bricks.js';
import {initializeKilns,advanceKilns} from '../kilns.js';
import {initializeBuildingInventory,collectReadyOutputs,takeBuildingOutput} from '../building-inventory.js';
import {productionHistory,annualProductionHistory} from '../building-production-history.js';
import {weatherAt} from '../environment.js';
import {syncCitizens} from '../workforce.js';

for(const [type,resource,batch,prepare,complete] of [
 ['pottery','pottery',2,b=>Object.assign(b.artisan,{stage:'cooling',elapsed:5.9}),s=>advanceArtisans(s,.2)],
 ['brickyard','brick',4,b=>Object.assign(b.brickmaking,{wet:4,drying:29.9}),s=>advanceBricks(s,1)],
 ['kiln','firedBrick',4,b=>Object.assign(b.firing,{hot:4,time:27.9}),s=>advanceKilns(s,.2)],
 ['brewery','beer',3,b=>Object.assign(b.artisan,{stage:'brewing',elapsed:14.9,vesselUses:3}),(s,b)=>workArtisan(b,.2,s)],
])test(`${type}: a finished batch belongs to its actual completion season even when the output shed is full`,()=>{
 const s=createGame({start:'established'});s.buildings.push({type,x:10,y:9,level:1});initializeArtisans(s);initializeBricks(s);initializeKilns(s);syncCitizens(s);initializeBuildingInventory(s);const b=s.buildings.at(-1);
 // Find clear weather without changing the simulation date or creating a
 // synthetic production credit. Drying is the only weather dependent case.
 if(type==='brickyard')for(let seed=1;seed<1000;seed++){s.world.seed=seed;if(weatherAt(s).type==='sunny')break;}
 b.workshopStock.output[resource]=24;prepare(b);complete(s,b);collectReadyOutputs(s);
 assert.equal(productionHistory(s,b).at(-1).resources[resource],batch,'credit the finished batch while it still waits in its ready buffer');assert.equal(b.workshopStock.output[resource],24);assert.equal(b.productionAnnual.rows.at(-1).resources[resource],batch);
 const ready=b.artisan||b.brickmaking||b.firing;assert.equal(ready.ready,batch);assert.ok(decode(encode(s)));
 s.season=1;s.tick=1;s.simTime=45;s.seasonElapsed=0;s.trade.nextArrival=5;assert.equal(takeBuildingOutput(b,resource,batch),batch);collectReadyOutputs(s);assert.equal(ready.ready,0);assert.equal(b.workshopStock.output[resource],24);
 const rows=productionHistory(s,b);assert.equal(rows.find(row=>row.year===1&&row.season===0).resources[resource],batch);assert.equal(rows.at(-1).resources[resource]||0,0);assert.equal(rows.reduce((n,row)=>n+(row.resources[resource]||0),0),batch);assert.equal(annualProductionHistory({year:2,season:0},b).at(-1).resources[resource],batch,'a later transfer must not credit annual output twice');assert.ok(decode(encode(s)));
});

test('an old ready batch with unknown history is not given a fabricated completion season on transfer',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'kiln',x:10,y:9,level:1});initializeKilns(s);syncCitizens(s);const b=s.buildings.at(-1);b.firing.ready=4;assert.equal(b.productionHistory,undefined);const restored=decode(encode(s));assert.ok(restored);const kiln=restored.buildings.at(-1);collectReadyOutputs(restored);assert.equal(kiln.workshopStock.output.firedBrick,4);assert.equal(kiln.productionHistory,undefined);assert.equal(kiln.productionAnnual,undefined);assert.ok(productionHistory(restored,kiln).every(row=>!row.known));
});
