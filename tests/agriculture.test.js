import {projectLegacy} from './inventory-test-helpers.js';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {cropFor,workField,advanceCrops,changeCropSeason} from '../agriculture.js';
import {assignWorkplace} from '../management.js';
import {syncCitizens} from '../workforce.js';
const field=s=>s.buildings.find(b=>b.type==='field');
test('barley needs actual spring labour; summer grows only seeded area with canal water',()=>{
 const s=createGame(),b=field(s),crop=cropFor(s,b);assert.equal(crop.sown,0);s.season=1;advanceCrops(s,45);assert.equal(crop.growth,0);
 s.season=0;crop.seedStock=4;workField(s,b,12);assert.equal(crop.sown,1);s.season=1;advanceCrops(s,45);assert.equal(crop.growth,0);
 s.buildings.push({type:'canal',x:12,y:7,level:1});advanceCrops(s,45);assert.equal(crop.growth,1);
});
test('harvest is finite, goes into worker cargo only in autumn, and uncollected barley spoils',()=>{
 const s=createGame(),b=field(s),crop=cropFor(s,b);crop.sown=1;crop.growth=1;s.season=2;changeCropSeason(s,1);
 const before=s.resources.food;assert.equal(workField(s,b,4),0);assert.equal(crop.sheaves,7);assert.equal(workField(s,b,4),7);assert.equal(s.resources.food,before);const left=crop.remaining;
 s.season=3;changeCropSeason(s,2);assert.equal(crop.remaining,0);assert.equal(crop.spoiled,left);assert.equal(workField(s,b,4),0);
});
test('workers can be pinned to a building; children cannot; pin survives saving and construction competition',()=>{
 const s=createGame(),b=field(s),c=s.citizens.find(c=>c.age>=16);assert.ok(assignWorkplace(s,c.id,`${b.x},${b.y}`).ok);syncCitizens(s);assert.equal(c.work,`${b.x},${b.y}`);
 assert.equal(assignWorkplace(s,s.citizens.find(c=>c.age<16).id,`${b.x},${b.y}`).ok,false);const saved=decode(encode(s));assert.ok(saved);assert.equal(saved.citizens.find(v=>v.id===c.id).workplace,c.workplace);
});
test('legacy migration retains people, carried goods and pantry; crop state survives deterministic reload',()=>{
 const s=createGame();s.version=11;for(const b of s.buildings)delete b.crop;const people=structuredClone(s.citizens),resources={...s.resources};const loaded=decode(encode(s));assert.ok(loaded);assert.equal(loaded.version,20);assert.deepEqual(loaded.citizens,people);assert.deepEqual(loaded.resources,resources);assert.ok(field(loaded).crop);
 const next=decode(encode(loaded));assert.deepEqual(next,loaded);
});
test('cats and mice inhabit storage yards, move and rest without entering water or buildings',async()=>{
 const {miracle}=await import('../engine.js');const {advancePests}=await import('../pests.js');const {animalsFor}=await import('../fauna.js'),{isDryPoint}=await import('../world.js');const s=createGame(),actions=new Set(),positions=new Set();miracle(s,'cat');
 for(let t=0;t<60;t+=.5){s.simTime=t;advancePests(s,.5);for(const a of animalsFor(s).filter(a=>['cat','mouse'].includes(a.kind))){assert.ok(isDryPoint(s,a.x,a.y));assert.ok(!s.buildings.some(b=>Math.abs(b.x-a.x)<.48&&Math.abs(b.y-a.y)<.48));actions.add(a.behavior);positions.add(`${a.id}:${a.x.toFixed(2)}`);}}
 assert.ok(actions.has('sleeping'));assert.ok(actions.has('hunting'));assert.ok(positions.size>20);
});
test('actual residents sow, harvest once and deliver finite autumn crop to storage',async()=>{
 const {build}=await import('../engine.js');const s=createGame(),b=field(s);assert.ok(build(s,'canal',12,7).ok);assignWorkplace(s,0,'12,8');assignWorkplace(s,1,'12,8');
 const run=n=>{for(let i=0;i<n*10;i++){s.event=null;advanceTime(s,.1);}};run(44);assert.equal(b.crop.sown,1);assert.equal(s.delivered.food,0);run(46);assert.equal(s.season,2);assert.ok(b.crop.remaining>0);const total=b.crop.total;
 run(40);assert.ok(s.delivered.food>0);assert.ok(b.crop.harvested<=total);assert.ok(decode(encode(s)));const carried=s.citizens.reduce((n,c)=>n+(c.cargo.food||0),0);assert.ok(Math.abs(b.crop.harvested-s.delivered.food-carried-b.crop.sheaves)<1e-6);
 const copy=decode(encode(s));run(6);for(let i=0;i<60;i++){copy.event=null;advanceTime(copy,.1);}assert.deepEqual(copy,s);
});
test('an empty workforce never seeds a field; unharvested crop spoils on winter boundary',()=>{
 const s=createGame(),b=field(s);for(const c of s.citizens)if(c.age>=16)c.role='builder';syncCitizens(s);
 for(let i=0;i<450;i++){s.event=null;advanceTime(s,.1);}assert.equal(b.crop.sown,0);
 b.crop.sown=1;b.crop.seedUsed=4;b.crop.growth=1;s.season=2;s.tick=2;s.simTime=90;s.seasonElapsed=0;changeCropSeason(s,1);const total=b.crop.total;advanceTime(s,45);assert.equal(b.crop.remaining,0);assert.equal(b.crop.spoiled,total);assert.equal(s.delivered.food,0);assert.ok(decode(encode(s)));
});
test('pins wait for carried cargo, survive clinic trips and cannot exceed building capacity',async()=>{
 const {build}=await import('../engine.js');const s=createGame(),b=field(s);s.buildings.push({type:'fishing',x:11,y:10,level:1});syncCitizens(s);
 const c=s.citizens.find(c=>c.work==='7,7');c.phase='toStore';c.cargo={clay:3};const previous=c.work;assert.ok(assignWorkplace(s,c.id,'11,10').ok);assert.equal(c.work,previous);assert.deepEqual(c.cargo,{clay:3});
 assert.ok(decode(encode(s)));for(let i=0;i<200;i++){s.event=null;advanceTime(s,.1);}assert.equal(c.work,'11,10');assert.ok((s.delivered.clay||0)>=3);
 const adults=s.citizens.filter(v=>v.age>=16&&v.id!==c.id);assignWorkplace(s,adults[0].id,'12,8');assignWorkplace(s,adults[1].id,'12,8');assert.equal(assignWorkplace(s,adults[2].id,'12,8').ok,false);
 assert.ok(build(s,'house',10,9).ok);syncCitizens(s);assert.equal(c.site,null);assert.equal(c.work,'11,10');assert.ok(decode(encode(s)));
});
test('actual v11 autumn city retains in-flight loads and home food, grants transitional harvest only once',async()=>{
 const {readFileSync}=await import('node:fs');const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v11-autumn.json',import.meta.url))),s=decode(JSON.stringify(old));assert.ok(s);assert.equal(old.version,11);assert.equal(s.season,2);assert.ok(old.citizens.some(c=>Object.values(c.cargo).some(n=>n>0)));
 assert.deepEqual(Object.fromEntries(Object.keys(old.resources).map(k=>[k,s.resources[k]])),old.resources);assert.deepEqual(s.citizens.map((c,i)=>Object.fromEntries(Object.keys(old.citizens[i]).map(k=>[k,c[k]]))),old.citizens);assert.deepEqual(projectLegacy(s.buildings,old.buildings),old.buildings);assert.ok(field(s).crop.remaining>0);
 const total=field(s).crop.remaining;workField(s,field(s),4);assert.equal(field(s).crop.remaining,total-7);const copy=decode(encode(s));assert.deepEqual(copy,s);
 for(let i=0;i<1600&&s.year===1;i++){s.event=null;advanceTime(s,.1);}assert.equal(s.year,2);assert.equal(field(s).crop.sown,0);assert.equal(field(s).crop.legacyYear,undefined);assert.ok(decode(encode(s)));
});
test('automatic sowers move to other jobs immediately even when advancing a long time step',()=>{
 const s=createGame();s.buildings=s.buildings.filter(b=>['house','field'].includes(b.type));for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;}syncCitizens(s);advanceTime(s,20);assert.equal(field(s).crop.sown,1);assert.ok(s.citizens.every(c=>c.work!=='12,8'));
});
