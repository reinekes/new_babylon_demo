import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,advanceTime,encode,decode} from '../engine.js';
for(const [type,x,y,outputs] of [['fishing',11,11,['food']],['hunting',5,15,['food','hides']],['logging',6,10,['wood']],['quarry',5,6,['stone']]]){
 test(`${type} finishes through delivery and returns every product to universal storage`,()=>{
  const s=createGame(),old=structuredClone(s.delivered);assert.ok(build(s,type,x,y).ok);
  const b=s.buildings.at(-1);assert.ok(b.construction);assert.ok(!s.citizens.some(c=>c.work===`${x},${y}`));
  for(let i=0;i<450;i++){s.event=null;advanceTime(s,1);if(i%30===0)assert.ok(decode(encode(s)),`save at ${i}s`);}
  assert.equal(b.construction,undefined);assert.equal(s.citizens.filter(c=>c.work===`${x},${y}`).length,2);
  for(const k of outputs)assert.ok(s.delivered[k]>old[k],`${k} delivered`);
  assert.equal(s.resources.fish,undefined);assert.equal(s.resources.meat,undefined);assert.ok(decode(encode(s)));
 });
}
test('a full warehouse waits with a serializable load and resumes without loss',()=>{
 const s=createGame();s.resources.clay=200;advanceTime(s,30);
 const c=s.citizens.find(c=>c.phase==='unloading'&&c.cargo.clay>0);assert.ok(c);const cargo=c.cargo.clay;
 const restored=decode(encode(s));assert.ok(restored);const person=restored.citizens.find(p=>p.id===c.id);assert.equal(person.cargo.clay,cargo);
 restored.resources.clay=200-cargo;advanceTime(restored,.1);assert.equal(restored.resources.clay,200);assert.equal(person.cargo.clay,undefined);
});
