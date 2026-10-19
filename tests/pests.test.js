import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,miracle,encode,decode} from '../engine.js';
import {advancePests,pestReport,pestActors} from '../pests.js';
import {assignGuard} from '../management.js';
test('mice consume only warehouse food and record exact losses; cats do not exist before a miracle',()=>{
 const s=createGame(),before=s.resources.food,homes=s.buildings.filter(b=>b.type==='house').map(b=>b.pantry),cargo=structuredClone(s.citizens.map(c=>c.cargo));
 assert.equal(pestActors(s).filter(a=>a.kind==='cat').length,0);advancePests(s,10);assert.ok(s.resources.food<before);assert.ok(Math.abs(before-s.resources.food-s.pests.totalLoss)<1e-7);assert.deepEqual(s.buildings.filter(b=>b.type==='house').map(b=>b.pantry),homes);assert.deepEqual(s.citizens.map(c=>c.cargo),cargo);
});
test('god brings the first cat, visible catches reduce mice and loss compared with no protection',()=>{
 const s=createGame(),bare=createGame();assert.ok(miracle(s,'cat').ok);assert.equal(s.pests.cats.length,1);assert.ok(pestActors(s).some(a=>a.kind==='cat'));for(let i=0;i<400;i++){advancePests(s,.1);advancePests(bare,.1);}assert.ok(s.pests.sites[0].caught>0);assert.ok(s.pests.totalLoss<bare.pests.totalLoss);assert.ok(pestReport(s,'9,8').includes('Кошка'));
 assert.deepEqual(decode(encode(s)),s);
});
test('an assigned adult actually walks to guard; at home gives no protection and cannot be taken to construction',()=>{
 const s=createGame();assert.ok(assignGuard(s,6,'9,8').ok);assert.equal(assignGuard(s,7,'9,8').ok,false);assert.equal(assignGuard(s,10,'9,8').ok,false);const c=s.citizens.find(c=>c.id===6);assert.equal(c.guardPost,'9,8');assert.equal(c.work,'9,8');assert.notEqual(c.phase,'working');
 for(let i=0;i<200;i++){s.event=null;advanceTime(s,.1);}assert.ok(s.pests.sites[0].scared>0);assert.equal(c.site,null);assert.equal(c.guardPost,'9,8');assert.ok(decode(encode(s)));
});
test('old saves add no cats and lose no food; malformed pest stocks are rejected',()=>{
 const s=createGame();s.version=12;delete s.pests;delete s.cooldowns.cat;const before={...s.resources},people=structuredClone(s.citizens),loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded.resources,before);assert.deepEqual(loaded.citizens,people);assert.equal(loaded.pests.cats.length,0);
 loaded.pests.totalLoss=-1;assert.equal(decode(encode(loaded)),null);
});
test('the visible chase converges before the target vanishes and reload keeps catches deterministic',()=>{
 const s=createGame();miracle(s,'cat');for(let i=0;i<99;i++)advancePests(s,.1);const actors=pestActors(s),cat=actors.find(a=>a.kind==='cat'),mouse=actors.find(a=>a.kind==='mouse');assert.ok(Math.hypot(cat.x-mouse.x,cat.y-mouse.y)<.03);
 const copy=decode(encode(s));assert.ok(copy);advancePests(s,.2);advancePests(copy,.2);assert.equal(pestActors(s).filter(a=>a.kind==='mouse').length,0);assert.ok(pestActors(s).some(a=>a.kind==='pestCatch'));assert.deepEqual(copy,s);
});
test('guarding does not create temple offerings, preserves old cargo, and stops providing protection at night',async()=>{
 const {syncCitizens}=await import('../workforce.js');const s=createGame(),bare=createGame();for(const city of [s,bare])for(const b of city.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;}
 assignGuard(s,6,'9,8');advanceTime(s,20);advanceTime(bare,20);assert.equal(s.delivered.faith,bare.delivered.faith);assert.ok(s.pests.totalLoss<bare.pests.totalLoss);
 const c=s.citizens.find(c=>c.work==='7,7');c.phase='toStore';c.cargo={clay:3};const before=s.delivered.clay;assignGuard(s,6,'');assert.ok(assignGuard(s,c.id,'9,8').ok);assert.equal(c.work,'7,7');assert.deepEqual(c.cargo,{clay:3});assert.ok(decode(encode(s)));advanceTime(s,10);assert.ok(s.delivered.clay>=before+3);
 advanceTime(s,20);assert.equal(c.phase,'home');const loss=s.pests.totalLoss,scared=s.pests.sites[0].scared;advanceTime(s,3);assert.equal(s.pests.sites[0].scared,scared);assert.ok(s.pests.totalLoss>loss);
});
test('demolishing a guarded store clears its post, retains the cat as a stray and keeps saves valid',async()=>{
 const {syncCitizens}=await import('../workforce.js'),{demolish}=await import('../management.js'),{isDryPoint}=await import('../world.js');const s=createGame();s.buildings.push({type:'granary',x:10,y:9,level:1});syncCitizens(s);miracle(s,'cat');assignGuard(s,6,'9,8');assert.ok(demolish(s,9,8).ok);assert.equal(s.citizens[6].guardPost,undefined);assert.ok(decode(encode(s)));const cat=pestActors(s).find(a=>a.kind==='cat');assert.ok(cat);assert.ok(isDryPoint(s,cat.x,cat.y));assert.ok(!s.buildings.some(b=>Math.abs(b.x-cat.x)<.48&&Math.abs(b.y-cat.y)<.48));
});
test('bad duplicate guards and cats are rejected; old towns do not get free cats',()=>{
 const s=createGame();assignGuard(s,6,'9,8');s.citizens[7].guardPost='9,8';assert.equal(decode(encode(s)),null);delete s.citizens[7].guardPost;miracle(s,'cat');s.pests.cats.push({...s.pests.cats[0],id:s.pests.nextCat++});assert.equal(decode(encode(s)),null);
});
test('with three mice the one chased is the one removed, while the two others remain visible',()=>{
 const s=createGame();s.pests.sites[0].mice=3;miracle(s,'cat');for(let i=0;i<99;i++)advancePests(s,.1);const actors=pestActors(s),cat=actors.find(a=>a.kind==='cat'),target=actors.find(a=>a.id==='mouse:9,8:2');assert.ok(Math.hypot(cat.x-target.x,cat.y-target.y)<.03);advancePests(s,.2);const after=pestActors(s);assert.equal(after.some(a=>a.id===target.id),false);assert.ok(after.some(a=>a.id==='mouse:9,8:0'));assert.ok(after.some(a=>a.id==='mouse:9,8:1'));
});
test('real v12 harvest city migrates without changing crops, pinned jobs, family food or resources',async()=>{
 const {readFileSync}=await import('node:fs');const old=JSON.parse(readFileSync(new URL('./fixtures/legacy-v12-harvest.json',import.meta.url)));assert.equal(old.version,12);const s=decode(JSON.stringify(old));assert.ok(s);assert.equal(s.version,14);assert.deepEqual(s.citizens,old.citizens);assert.deepEqual(s.resources,old.resources);assert.deepEqual(s.buildings.map((b,i)=>({...b,crop:Object.fromEntries(Object.keys(old.buildings[i].crop||{}).map(k=>[k,b.crop[k]]))})).map((b,i)=>old.buildings[i].crop?b:(({crop,...v})=>v)(b)),old.buildings);assert.equal(s.pests.cats.length,0);assert.equal(s.pests.totalLoss,0);assert.deepEqual(decode(encode(s)),s);
});
