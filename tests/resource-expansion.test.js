import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {createGame,decode,encode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {initializeGeneratedWorld,isShore,signedRiverDistance,terrain} from '../world.js';
import {clayRemaining,takeClay} from '../mineral-stock.js';
import {reedStatus,takeReeds,restReeds,advanceReedBeds,REED_RECOVERY} from '../reed-stock.js';
import {DAY_SECONDS} from '../city-life.js';

test('new valleys have additional dry clay and shore reeds on both banks',()=>{
 for(const seed of [0,11,137,4488]){
  const s=createNewCity({mode:'mature',seed});
  assert.equal(s.world.resourceVersion,2);
  assert.deepEqual(createNewCity({mode:'mature',seed}).world,s.world);
  const points=new Set(s.world.deposits.map(d=>`${d.x},${d.y}`));
  assert.equal(points.size,s.world.deposits.length);
  for(const side of [-1,1])for(const kind of ['clay','reed']){
   const sources=s.world.deposits.filter(d=>d.kind===kind&&Math.sign(signedRiverDistance(d.x,d.y,s))===side);
   assert.ok(sources.length>=6,`${seed} ${side} ${kind}: ${sources.length}`);
   assert.ok(sources.every(d=>terrain(d.x,d.y,s)!=='water'&&(kind!=='reed'||isShore(s,d.x,d.y))));
  }
 }
});

test('older big valleys are supplemented once and retain exact routes, cargo and depleted stock',()=>{
 const s=createGame({start:'established',seed:137,scenario:strictScenario()});
 s.world=initializeGeneratedWorld({buildings:s.buildings},137);
 assert.equal(s.world.resourceVersion,1);
 const site=s.world.deposits.find(d=>d.kind==='clay');
 takeClay(s,site.x,site.y,1000);
 const data=JSON.parse(encode(s)),loaded=decode(JSON.stringify(data));
 assert.ok(loaded);
 assert.equal(loaded.world.resourceVersion,2);
 assert.ok(loaded.world.deposits.length>data.world.deposits.length);
 assert.deepEqual(loaded.world.deposits.slice(0,data.world.deposits.length),data.world.deposits);
 for(const key of ['citizens','roads','resources','buildings'])assert.deepEqual(loaded[key],data[key]);
 assert.equal(clayRemaining(loaded,site.x,site.y),0);
 assert.equal(takeClay(loaded,site.x,site.y,1),0);
 const raw=encode(loaded);assert.equal(encode(decode(raw)),raw);
});

test('new reed sites run dry under extraction and recover only after resting',()=>{
 const s=createNewCity({mode:'mature',seed:137}),site=s.world.deposits.filter(d=>d.kind==='reed').at(-1);
 assert.equal(takeReeds(s,site.x,site.y,1000),120);
 assert.equal(takeReeds(s,site.x,site.y,1),0);
 assert.ok(restReeds(s,site.x,site.y));
 assert.equal(takeReeds(s,site.x,site.y,1),0);
 s.simTime+=DAY_SECONDS*2;advanceReedBeds(s);
 assert.equal(reedStatus(s,site.x,site.y).stock,REED_RECOVERY);
});
