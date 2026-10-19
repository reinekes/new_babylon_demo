import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,upgrade,advanceTime,encode,decode} from '../engine.js';
import * as management from '../management.js';
import {syncCitizens,rerouteCitizens} from '../workforce.js';
const run=(s,n)=>{for(let i=0;i<Math.round(n*10);i++){if(s.event)s.event=null;advanceTime(s,.1);}};
const stocked=()=>{const s=createGame();for(const c of s.citizens)c.age=24;s.resources.clay=1000;s.resources.reed=1000;s.resources.faith=1000;return s;};
test('high priority takes scarce free workers and changing it preserves the old carried load',()=>{
 const s=stocked();for(const c of s.citizens)management.setCitizenRole(s,c.id,'production');management.setCitizenRole(s,10,'auto');management.setCitizenRole(s,11,'auto');
 build(s,'house',10,9);build(s,'house',11,9);management.setPriority(s,11,9,2);assert.ok(s.citizens.filter(c=>c.site).every(c=>c.site==='11,9'));
 run(s,1);const carrier=s.citizens.find(c=>Object.values(c.buildCargo||{}).some(n=>n>0));assert.ok(carrier);management.setPriority(s,10,9,2);management.setPriority(s,11,9,0);assert.equal(carrier.site,'11,9');
 run(s,3);assert.ok(s.buildings.find(b=>b.x===11&&b.y===9).construction.delivered.clay>0);assert.ok(s.citizens.some(c=>c.site==='10,9'));assert.ok(decode(encode(s)));
});
test('manual builders only labour, carriers only deliver, role change waits for current cargo',()=>{
 const s=stocked();for(const c of s.citizens)management.setCitizenRole(s,c.id,'production');management.setCitizenRole(s,10,'builder');management.setCitizenRole(s,11,'carrier');build(s,'house',10,9);
 const builder=s.citizens[10],carrier=s.citizens[11];run(s,1);assert.equal(builder.siteDuty,'builder');assert.deepEqual(builder.buildCargo,{});assert.equal(carrier.siteDuty,'carrier');assert.ok(Object.values(carrier.buildCargo).some(n=>n>0));
 management.setCitizenRole(s,11,'builder');assert.equal(carrier.role,'carrier');assert.equal(carrier.pendingRole,'builder');run(s,4);assert.equal(carrier.role,'builder');assert.equal(carrier.pendingRole,undefined);assert.ok(decode(encode(s)));
});
test('cancelling new work refunds exactly once even with materials in flight',()=>{
 const s=stocked(),before=structuredClone(s.resources);build(s,'house',10,9);run(s,1);assert.ok(s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0)));
 const paid=s.resources.clay;assert.ok(management.cancelConstruction(s,10,9).ok);assert.equal(s.resources.clay,paid+12);assert.equal(s.resources.reed,before.reed);assert.ok(s.citizens.every(c=>!Object.values(c.buildCargo||{}).some(n=>n>0)));assert.ok(decode(encode(s)));assert.equal(management.cancelConstruction(s,10,9).ok,false);run(s,2);assert.ok(decode(encode(s)));
});
test('cancelled upgrade preserves old level; new ziggurat refunds prepaid faith',()=>{
 const s=stocked();s.resources.brick=100;upgrade(s,8,8);run(s,2);const before=s.resources.clay;assert.ok(management.cancelConstruction(s,8,8).ok);assert.equal(s.buildings[0].level,1);assert.equal(s.capacity,16);assert.equal(s.resources.clay,before+18);
 s.resources.brick=100;s.resources.prestige=100;build(s,'ziggurat',10,9);const faith=s.resources.faith;management.cancelConstruction(s,10,9);assert.equal(s.resources.faith,faith+80);assert.ok(decode(encode(s)));
});
test('demolition refunds half of completed investments and protects houses and final warehouse',()=>{
 const s=stocked();assert.ok(management.canDemolish(s,s.buildings[0]));assert.ok(management.canDemolish(s,s.buildings.find(b=>b.type==='shrine')));
 const b=s.buildings.find(b=>b.type==='clay');b.level=2;const before=s.resources.clay;assert.ok(management.demolish(s,b.x,b.y).ok);assert.equal(s.resources.clay,before+12);assert.ok(decode(encode(s)));
});
test('demolishing a home moves residents to reachable beds without losing anyone',()=>{
 const s=stocked();build(s,'house',10,9);run(s,90);for(let i=0;i<120&&s.citizens.some(c=>c.waterTrip?.target==='8,8');i++)run(s,.5);s.event=null;const ids=s.citizens.map(c=>c.id);assert.ok(management.demolish(s,8,8).ok);assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.ok(s.citizens.every(c=>c.home!=='8,8'));assert.ok(decode(encode(s)));run(s,3);assert.ok(decode(encode(s)));
});
test('old saves default to automatic roles and ordinary priorities',()=>{
 const s=stocked();build(s,'house',10,9);for(const c of s.citizens){delete c.role;delete c.siteDuty;}delete s.buildings.at(-1).construction.priority;const loaded=decode(encode(s));assert.ok(loaded);syncCitizens(loaded);assert.ok(loaded.citizens.every(c=>(c.role||'auto')==='auto'));assert.ok(decode(encode(loaded)));
});
test('demolition never cuts off the destination of materials already in flight',()=>{
 const s=stocked();s.buildings.push({type:'bridge',x:13,y:9,level:1});syncCitizens(s);build(s,'house',16,9);run(s,1);
 assert.ok(s.citizens.some(c=>Object.values(c.buildCargo||{}).some(n=>n>0)));
 assert.equal(management.demolish(s,13,9).ok,false);assert.ok(decode(encode(s)));run(s,120);assert.ok(decode(encode(s)));
});
test('blocked loaded carriers retain their exact cargo across night and resume after reconnection',()=>{
 const s=stocked();s.buildings.push({type:'bridge',x:13,y:9,level:1});syncCitizens(s);build(s,'house',16,9);run(s,1);const carrier=s.citizens.find(c=>Object.values(c.buildCargo||{}).some(n=>n>0)),cargo=structuredClone(carrier.buildCargo);
 // A legacy/disconnected route must recover even if a graph change bypassed the UI guard.
 s.buildings=s.buildings.filter(b=>b.type!=='bridge');rerouteCitizens(s);assert.equal(carrier.phase,'blocked');assert.equal(carrier.routeIndex,0);assert.ok(decode(encode(s)));run(s,60);assert.deepEqual(carrier.buildCargo,cargo);assert.ok(decode(encode(s)));
 s.buildings.push({type:'bridge',x:13,y:9,level:1});run(s,25);assert.notEqual(carrier.phase,'blocked');assert.ok(decode(encode(s)));
});
test('empty bridges can be removed; occupied bridges and food-overflowing warehouse demolition are blocked',()=>{
 const s=stocked();s.buildings.push({type:'bridge',x:13,y:9,level:1});const before=s.resources.clay;assert.ok(management.demolish(s,13,9).ok);assert.equal(s.resources.clay,before+22);assert.ok(decode(encode(s)));
 s.buildings.push({type:'bridge',x:13,y:9,level:1});s.citizens[0].x=13;s.citizens[0].y=9.5;assert.equal(management.demolish(s,13,9).ok,false);
 const t=stocked();t.buildings.push({type:'granary',x:10,y:9,level:1});t.resources.food=300;assert.equal(management.demolish(t,10,9).ok,false);assert.equal(t.resources.food,300);
});
