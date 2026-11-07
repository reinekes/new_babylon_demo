import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeKilns,kilnNeeds,startFiring,advanceKilns,collectFired,validateKilns,KILN_WEAR_LIMIT,repairKiln} from '../kilns.js';
const fixture=()=>{const s={buildings:[{type:'kiln',level:1}]};initializeKilns(s);return s;};
test('fuel and dry bricks must both arrive before a worker can charge the kiln',()=>{const s=fixture(),b=s.buildings[0];assert.deepEqual(kilnNeeds(b),{brick:4,reed:3});b.firing.brick=4;assert.equal(startFiring(b),0);b.firing.reed=3;assert.equal(startFiring(b),4);assert.equal(startFiring(b),0);assert.equal(b.firing.brick,0);assert.equal(b.firing.reed,0);assert.equal(collectFired(b),0);});
test('a charged batch burns then cools, without crediting warehouse stock',()=>{const s=fixture(),b=s.buildings[0];Object.assign(b.firing,{brick:4,reed:3});startFiring(b);s.resources={firedBrick:0};advanceKilns(s,20);assert.equal(b.firing.hot,4);assert.equal(collectFired(b),0);advanceKilns(s,8);assert.equal(b.firing.ready,4);assert.equal(collectFired(b),4);assert.equal(collectFired(b),0);assert.equal(s.resources.firedBrick,0);assert.ok(validateKilns(s));});
test('rain/night do not extinguish loaded fuel and no worker means no automatic ignition',()=>{const s=fixture(),b=s.buildings[0];s.rain=1;s.simTime=40;Object.assign(b.firing,{brick:4,reed:3});advanceKilns(s,100);assert.equal(b.firing.hot,0);startFiring(b);advanceKilns(s,28);assert.equal(b.firing.ready,4);});
test('new construction cannot fire; upgrades preserve current batches; corrupt buffers are rejected',()=>{const s=fixture(),b=s.buildings[0];Object.assign(b.firing,{brick:4,reed:3});b.construction={kind:'new'};assert.equal(startFiring(b),0);b.construction.kind='upgrade';assert.equal(startFiring(b),4);initializeKilns(s);assert.equal(b.firing.hot,4);assert.ok(validateKilns(s));b.firing.ready=4;assert.equal(validateKilns(s),false);});

test('an improved kiln fires faster without increasing yield or duplicating inputs',()=>{const s=fixture(),b=s.buildings[0];b.level=2;Object.assign(b.firing,{brick:4,reed:3});startFiring(b);advanceKilns(s,17.5);assert.equal(collectFired(b),4);assert.equal(b.firing.brick+b.firing.reed,0);});


test('the last firing cools and yields a full batch before wear blocks a new charge',()=>{
 const s=fixture(),b=s.buildings[0];
 b.kilnWear=KILN_WEAR_LIMIT-1;
 Object.assign(b.firing,{brick:4,reed:3});
 assert.equal(startFiring(b),4);
 advanceKilns(s,28);
 assert.equal(b.kilnWear,KILN_WEAR_LIMIT);
 assert.equal(collectFired(b),4);
 assert.deepEqual(kilnNeeds(b),{brick:1,reed:0});
 assert.equal(repairKiln(b),false);
 b.firing.brick=1;
 assert.equal(repairKiln(b),true);
 assert.equal(b.kilnWear,0);
 assert.equal(b.firing.brick,0);
 assert.equal(repairKiln(b),false);
});

test('banking a lit kiln restores the unfired batch but neither spent fuel nor output',async()=>{
 const {setKilnBanked}=await import('../kilns.js');
 const {strictScenario}=await import('../scenario-profiles.js');
 const s=fixture(),b=s.buildings[0];
 s.scenario=strictScenario();
 Object.assign(b.firing,{brick:4,reed:3});
 assert.equal(startFiring(b),4);
 advanceKilns(s,5);
 assert.ok(setKilnBanked(s,b,true).ok);
 assert.deepEqual(b.firing,{brick:4,reed:0,hot:0,time:0,ready:0});
 assert.ok(!setKilnBanked(s,b,true).ok);
 b.firing.reed=3;
 assert.equal(startFiring(b),0);
 advanceKilns(s,60);
 assert.equal(collectFired(b),0);
 assert.ok(validateKilns(s));
 assert.ok(setKilnBanked(s,b,false).ok);
 assert.equal(startFiring(b),4);
 advanceKilns(s,28);
 assert.equal(collectFired(b),4);
 assert.equal(collectFired(b),0);
});

test('a high-risk firing stops at a local fire until neighbors contribute reachable surplus',async()=>{
 const {createGame}=await import('../engine.js');
 const {strictScenario}=await import('../scenario-profiles.js');
 const {weatherAt}=await import('../environment.js');
 const {waterDemand}=await import('../water.js');
 const {extinguishKilnFire}=await import('../fire-forecast.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 const kiln={type:'kiln',x:10,y:9,level:1};
 s.buildings.push(kiln);
 initializeKilns(s);
 Object.assign(kiln.firing,{brick:4,reed:3});
 s.drought=1;
 for(let i=0;i<2000&&weatherAt(s).type!=='wind';i++)s.simTime++;
 assert.equal(weatherAt(s).type,'wind');
 for(const b of s.buildings.filter(b=>b.type==='house'))b.water=0;
 assert.equal(startFiring(kiln),4);
 advanceKilns(s,60);
 assert.equal(kiln.kilnFire,true);
 assert.equal(kiln.firing.ready,0);
 assert.equal(extinguishKilnFire(s,kiln).ok,false);
 const home=s.buildings.find(b=>b.type==='house'&&b.x===9&&b.y===9);
 const daily=s.citizens.filter(c=>c.home==='9,9').reduce((n,c)=>n+waterDemand(c),0);
 home.water=daily+2;
 assert.ok(extinguishKilnFire(s,kiln).ok);
 assert.equal(home.water,daily);
 assert.equal(extinguishKilnFire(s,kiln).ok,false);
 advanceKilns(s,28);
 assert.equal(collectFired(kiln),4);
});

test('a neglected fire stops the batch and requires the normal kiln repair',async()=>{
 const {strictScenario}=await import('../scenario-profiles.js');
 const {IGNITION_CHECK}=await import('../kilns.js');
 const s=fixture(),b=s.buildings[0];
 s.scenario=strictScenario();
 Object.assign(b.firing,{hot:4,time:IGNITION_CHECK});
 b.kilnFire=true;
 advanceKilns(s,45);
 assert.equal(b.kilnFire,true);
 assert.ok(validateKilns(s));
 advanceKilns(s,15);
 assert.equal(b.kilnFire,undefined);
 assert.equal(b.kilnFireElapsed,undefined);
 assert.equal(b.kilnBanked,true);
 assert.equal(b.kilnWear,KILN_WEAR_LIMIT);
 assert.deepEqual(b.firing,{brick:4,reed:0,hot:0,time:0,ready:0});
 assert.equal(collectFired(b),0);
 assert.ok(repairKiln(b));
 assert.equal(b.firing.brick,3);
 assert.equal(startFiring(b),0);
 assert.ok(validateKilns(s));
});
