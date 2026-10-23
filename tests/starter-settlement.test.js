import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,encode,decode,build,upgrade,advanceTime} from '../engine.js';
import {capacityOf,MATERIALS,buildingKey} from '../definitions.js';import {isDryPoint} from '../world.js';
import {demolish,demolitionRefund} from '../management.js';import {putStock,validateInventory} from '../inventory.js';
const run=(s,seconds,step=.1)=>{for(let t=0;t<seconds;t+=step){if(s.event)s.event=null;advanceTime(s,step);}};
test('default public start is five separate dry founding homes with twelve stable residents and exact stock totals',()=>{
 const s=createGame();assert.equal(s.buildings.length,5);assert.equal(s.citizens.length,12);assert.equal(s.capacity,20);
 for(const h of s.buildings){assert.equal(h.type,'house');assert.equal(h.starterHut,true);assert.equal(capacityOf(h),4);assert.ok(isDryPoint(s,h.x,h.y));assert.ok(s.citizens.some(c=>c.home===buildingKey(h)));}
 for(let i=0;i<5;i++)for(let j=i+1;j<5;j++)assert.ok(Math.hypot(s.buildings[i].x-s.buildings[j].x,s.buildings[i].y-s.buildings[j].y)>=3);
 for(const [k,n]of Object.entries({food:100,clay:90,reed:45,wood:20}))assert.equal(s.resources[k],n);
 for(const k of MATERIALS)assert.equal(s.buildings.reduce((n,h)=>n+h.stock[k],0),s.resources[k]);assert.ok(validateInventory(s));assert.deepEqual(decode(encode(s)),s);
});
test('founding houses physically supply shrine construction and preserve goods in transit through reload',()=>{
 const s=createGame();assert.ok(build(s,'shrine',8,8).ok);const b=s.buildings.at(-1),allocations=Object.keys(b.construction.sources);assert.ok(allocations.length>1);assert.ok(allocations.every(k=>s.buildings.some(h=>h.type==='house'&&buildingKey(h)===k)));assert.equal(b.construction.work,0);
 let carried=false;for(let i=0;i<1600&&b.construction;i++){advanceTime(s,.1);if(s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0))){carried=true;const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(restored.citizens.map(c=>[c.id,c.buildCargo]),s.citizens.map(c=>[c.id,c.buildCargo]));}}
 assert.ok(carried);assert.equal(b.construction,undefined);assert.ok(decode(encode(s)));
});
test('stocked founding hut demolition automatically conserves supplies and refund and preserves residents',()=>{
 const s=createGame(),h=s.buildings[0],before=structuredClone(s.resources),ids=s.citizens.map(c=>c.id),refund=demolitionRefund(h);const result=demolish(s,h.x,h.y);assert.ok(result.ok);assert.equal(s.buildings.length,4);for(const k of MATERIALS)assert.equal(s.resources[k],before[k]+(refund[k]||0));assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.ok(s.citizens.every(c=>c.home!==buildingKey(h)));assert.ok(decode(encode(s)));
});
test('rejected founding hut demolition never moves stock or residents when remaining beds or stock room are insufficient',()=>{
 for(const reason of ['beds','stock']){const s=createGame(),h=s.buildings[0];if(reason==='beds')s.buildings=s.buildings.slice(0,3);else for(const b of s.buildings.slice(1))for(const k of MATERIALS)b.stock[k]=200;
 // Reconcile test fixture before taking the mutation boundary snapshot.
 for(const k of MATERIALS)s.resources[k]=s.buildings.reduce((n,b)=>n+b.stock[k],0);
 const before=structuredClone(s);assert.equal(demolish(s,h.x,h.y).ok,false);assert.deepEqual(s,before);}
});
test('founding hut upgrades through actual material delivery to the normal level II capacity',()=>{
 const s=createGame(),h=s.buildings[0];putStock(s,buildingKey(h),'brick',30,{overflow:true});assert.ok(upgrade(s,h.x,h.y).ok);assert.equal(capacityOf(h),4);run(s,220);assert.equal(h.level,2);assert.equal(h.construction,undefined);assert.equal(capacityOf(h),12);assert.ok(decode(encode(s)));
});
test('version 26 migration adds ecology without replacing layout, identities, cargo, reservations or events',()=>{
 const s=createGame({start:'established'});assert.ok(build(s,'house',10,9).ok);for(let i=0;i<400&&!s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0));i++)advanceTime(s,.1);s.event={id:'refugees',title:'Сохранённое событие',text:'Не заменять'};
 const raw=JSON.parse(encode(s));raw.version=26;delete raw.ecology;const restored=decode(JSON.stringify(raw));assert.ok(restored);const expected=structuredClone(raw),actual=structuredClone(restored);delete expected.version;delete actual.version;delete actual.ecology;assert.deepEqual(actual,expected);assert.deepEqual(decode(encode(restored)),restored);
});
test('malformed founding home flags are rejected on load',()=>{
 for(const flag of [false,0,'true',{}]){const s=createGame();s.buildings[0].starterHut=flag;assert.equal(decode(encode(s)),null);}const s=createGame({start:'established'});s.buildings.find(b=>b.type==='field').starterHut=true;assert.equal(decode(encode(s)),null);
});
test('founding demolition splits large supplies across reachable stores without losing stock',()=>{
 const s=createGame(),h=s.buildings[0];putStock(s,buildingKey(h),'clay',332,{overflow:true});const before=structuredClone(s.resources),original=new Map(s.buildings.map(b=>[buildingKey(b),b.stock.clay])),refund=demolitionRefund(h);assert.ok(demolish(s,h.x,h.y).ok);assert.ok(s.buildings.filter(b=>b.stock.clay>(original.get(buildingKey(b))||0)).length>=2);for(const k of MATERIALS)assert.equal(s.resources[k],before[k]+(refund[k]||0));assert.ok(s.buildings.every(b=>b.stock.clay<=200));assert.ok(decode(encode(s)));
});
test('reserved source and disconnected founding hut reject demolition without moving any materials',()=>{
 for(const kind of ['reserved','disconnected']){const s=createGame(),h=s.buildings[0];if(kind==='reserved')assert.ok(build(s,'shrine',8,8).ok);else{const old=buildingKey(h);h.x=23;for(const c of s.citizens)if(c.home===old){c.home=buildingKey(h);c.x=h.x;c.y=h.y;}}
 const before=structuredClone(s);assert.equal(demolish(s,h.x,h.y).ok,false);assert.deepEqual(s,before);}
});

test('initial map camera centres the spread founding homes without affecting established cities',async()=>{const{foundingCameraTarget}=await import('../starter-settlement.js');const s=createGame(),before=JSON.stringify(s),v=foundingCameraTarget(s);assert.ok(v.radius>=55);assert.equal(v.x,7);assert.equal(v.y,8.8);assert.equal(foundingCameraTarget(createGame({start:'established'})),null);assert.equal(JSON.stringify(s),before);});
