import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,upgrade,advanceTime,decode,encode,river} from '../engine.js';
import {networkFor} from '../workforce.js';
const run=(s,n)=>{for(let i=0;i<n*10;i++){if(s.event)s.event=null;advanceTime(s,.1);}};
test('new house reserves price but provides no beds before delivered materials and labour',()=>{
 const s=createGame(),before=s.resources.clay;assert.ok(build(s,'house',10,9).ok);const b=s.buildings.at(-1);
 assert.ok(b.construction);assert.equal(s.capacity,16);assert.equal(s.resources.clay,before-12);
 run(s,1);assert.equal(b.construction.work,0);assert.equal(s.capacity,16);
 let delivered=false;for(let i=0;i<240&&b.construction;i++){run(s,1);if(b.construction){delivered ||= b.construction.delivered.clay>0;assert.ok(b.construction.work===0||b.construction.delivered.clay===12&&b.construction.delivered.reed===8);}}
 assert.ok(delivered);assert.equal(b.construction,undefined);assert.equal(s.capacity,24);
});
test('upgrades retain old capacity and residents until completion, reject duplicate orders',()=>{
 const s=createGame(),homes=s.citizens.map(c=>c.home);s.resources.brick=100;assert.ok(upgrade(s,8,8).ok);const b=s.buildings[0];assert.equal(b.level,1);assert.equal(s.capacity,16);assert.equal(upgrade(s,8,8).ok,false);
 run(s,180);assert.equal(b.level,2);assert.equal(b.construction,undefined);assert.equal(s.capacity,20);assert.deepEqual(s.citizens.slice(0,12).map(c=>c.home),homes);
});
test('construction cargo and work survive saving with deterministic continuation',()=>{
 const s=createGame();build(s,'house',10,9);let found=false;
 for(let i=0;i<250;i++){run(s,.1);if(s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0))){found=true;break;}}
 assert.ok(found);const loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded,s);run(s,100);run(loaded,100);assert.deepEqual(loaded,s);
});
test('unreachable sites wait and new bridge opens only after actual construction',()=>{
 const s=createGame();s.resources.clay=500;s.resources.reed=500;build(s,'house',20,8);const house=s.buildings.at(-1);run(s,70);assert.ok(house.construction);assert.equal(house.construction.work,0);
 build(s,'bridge',Math.round(river(8)),8);const bridge=s.buildings.at(-1);const comps=()=>new Set(networkFor(s).ports.map(p=>networkFor(s).components.get(p.key))).size;
 assert.ok(comps()>1);run(s,300);assert.equal(bridge.construction,undefined);assert.equal(house.construction,undefined);assert.equal(comps(),1);
});
test('builders stop labour at night and return home',()=>{
 const s=createGame();build(s,'house',10,9);run(s,43);assert.ok(s.citizens.every(c=>['home','resting'].includes(c.phase)));const work=s.buildings.at(-1).construction?.work;run(s,5);assert.equal(s.buildings.at(-1).construction?.work,work);
});
test('saving during labour preserves stages; malformed and duplicated material balances are rejected',()=>{
 const s=createGame();build(s,'house',10,9);const b=s.buildings.at(-1);
 for(let i=0;i<1500&&(!b.construction||b.construction.work===0);i++)run(s,.1);
 assert.ok(b.construction.work>0);const loaded=decode(encode(s));assert.ok(loaded);run(s,80);run(loaded,80);assert.deepEqual(loaded,s);
 const bad=structuredClone(loaded);bad.resources.brick=100;upgrade(bad,8,8);bad.buildings[0].construction.delivered.clay=1;assert.equal(decode(encode(bad)),null);
 bad.buildings[0].construction.delivered.clay=0;bad.buildings[0].construction.work=1;assert.equal(decode(encode(bad)),null);
});
test('a new workshop produces nothing before construction; builders conserve reservations when population falls',()=>{
 const s=createGame();s.resources.clay=500;s.resources.reed=500;build(s,'reed',11,12);const b=s.buildings.at(-1);const delivered=s.delivered.reed;
 run(s,1);assert.equal(s.delivered.reed,delivered);assert.ok(b.construction);
 const loaded=decode(encode(s));assert.ok(loaded);
 // Population loss can remove a builder carrying a reservation; it returns to the order.
 const t=createGame();t.buildings=t.buildings.filter(b=>b.type==='house'||b.type==='shrine');t.citizens=[];t.population=12;t.resources.food=0;build(t,'house',10,9);
 run(t,100);assert.ok(decode(encode(t)));
});
test('save is valid on the exact frame construction completes, including newly unemployed builders',()=>{
 const s=createGame();build(s,'house',10,9);const b=s.buildings.at(-1);
 for(let i=0;i<1800&&b.construction;i++)advanceTime(s,.1);
 assert.equal(b.construction,undefined);assert.ok(decode(encode(s)));assert.ok(s.citizens.every(c=>c.phase!=='constructing'||c.site));
});
test('bridge construction can be supplied entirely from the eastern bank',()=>{
 const s=createGame();s.buildings=[{type:'house',x:20,y:8,level:1},{type:'shrine',x:21,y:8,level:1}];s.population=8;s.capacity=8;s.citizens=[];s.resources.clay=500;s.resources.reed=500;
 build(s,'bridge',Math.round(river(8)),8);const b=s.buildings.at(-1);run(s,1);assert.ok(s.citizens.some(c=>c.sitePort?.endsWith(':1')));run(s,300);assert.equal(b.construction,undefined);assert.ok(decode(encode(s)));
});
test('a finished bridge remains passable throughout its upgrade',()=>{
 const s=createGame();s.resources.clay=500;s.resources.reed=500;build(s,'bridge',Math.round(river(8)),8);run(s,240);s.event=null;const b=s.buildings.at(-1);assert.equal(b.construction,undefined);
 const components=()=>new Set(networkFor(s).ports.map(p=>networkFor(s).components.get(p.key))).size;assert.equal(components(),1);assert.ok(upgrade(s,b.x,b.y).ok);assert.equal(b.level,1);assert.equal(components(),1);run(s,300);assert.equal(b.level,2);assert.equal(components(),1);
});
