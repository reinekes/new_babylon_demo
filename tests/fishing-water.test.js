import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {networkFor,syncCitizens} from '../workforce.js';
import {workGathering} from '../labor-life.js';
import {naturalAnimalsFor,animalsFor} from '../fauna.js';
import {isDryPoint} from '../world.js';
function lake(){const s=createGame({mode:'mature',seed:137}),b={type:'fishing',x:16,y:7,level:1};s.buildings.push(b);syncCitizens(s);const p=networkFor(s).ports.find(p=>p.building===b);assert.ok(p);const people=s.citizens.filter(c=>c.age>=16).slice(0,2);for(const c of people){Object.assign(c,{work:'16,7',phase:'working',workElapsed:0,x:p.x,y:p.y});workGathering(s,c,b,.1,1,p);}return {s,b,people};}
test('a new lake fishery has real water work targets without increasing the paired ambient fish population',()=>{
 const {s}=lake();assert.equal(s.gathering.jobs.length,2);assert.notEqual(s.gathering.jobs[0].target.id,s.gathering.jobs[1].target.id);for(const j of s.gathering.jobs){assert.equal(isDryPoint(s,j.target.x,j.target.y),false);assert.equal(isDryPoint(s,j.stand.x,j.stand.y),true);assert.ok(j.target.id.startsWith('fish:water:'));}assert.equal(naturalAnimalsFor(s).filter(a=>a.kind==='fish').length,2);assert.equal(animalsFor(s).filter(a=>a.kind==='fish').length,2);const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(restored.gathering.jobs,s.gathering.jobs);
});
test('water fishing claims cannot be moved onto land or forged under an unrelated water identity',()=>{
 const {s}=lake();assert.equal(s.gathering.jobs.length,2);assert.ok(decode(encode(s)));for(const change of [j=>j.target.id='fish:water:0:0',j=>j.target.x+=.25,j=>{j.target.x=6;j.target.y=7;j.target.id='fish:water:24:28';},j=>{j.target.x=40;j.target.y=40;j.target.id='fish:water:160:160';}]){const bad=JSON.parse(encode(s));change(bad.gathering.jobs[0]);assert.equal(decode(JSON.stringify(bad)),null);}
});
test('water targets stay bounded and read-only, and refresh when the saved water geometry changes',async()=>{
 const {fishingWaterTargets}=await import('../fishing-water.js');const {s}=lake(),origin={x:15.5,y:7.5},before=encode(s),targets=fishingWaterTargets(s,origin);assert.ok(targets.length>0&&targets.length<=128);assert.deepEqual(fishingWaterTargets(s,origin),targets);assert.equal(encode(s),before);
 const away={x:4,y:5};assert.equal(fishingWaterTargets(s,away).length,0);s.world.lakes.push({id:'water-target-test',cells:[{x:5,y:5}]});assert.ok(fishingWaterTargets(s,away).length>0);
 const old=createGame({start:'established'});assert.deepEqual(fishingWaterTargets(old,origin),[]);
});
