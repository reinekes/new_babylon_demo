import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {syncInventory} from '../inventory.js';
import {orderFestival,advanceFestival,festivalSummary,festivalView,validateFestival,FESTIVAL_SECONDS} from '../festival.js';

function city(){
 const s=createGame({start:'established'});Object.assign(s.resources,{prestige:100,beer:20,food:100});syncInventory(s);
 for(const c of s.citizens){Object.assign(c,{age:25,role:'carrier',work:null,phase:'home',cargo:{},buildCargo:{}});delete c.pantryTrip;delete c.waterTrip;}
 assert.ok(orderFestival(s).ok);return s;
}
function delivered(s){for(let i=0;i<600&&s.festival.stage==='supplying';i++){advanceFestival(s,.1);s.simTime+=.1;}assert.equal(s.festival.stage,'waiting');}
function night(s){s.simTime=32.5;for(const c of s.citizens)Object.assign(c,{phase:'home',mealEaten:.8});}
function celebration(s){delivered(s);night(s);for(let i=0;i<100&&s.festival.stage!=='celebrating';i++){advanceFestival(s,.1);s.simTime+=.1;}assert.equal(s.festival.stage,'celebrating');}
function saved(s){s.tick=Math.floor(s.simTime/45);s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);s.seasonElapsed=s.simTime-s.tick*45;return decode(encode(s));}

test('feast preparation explains automatic reservations, manual pause and actual porter availability',()=>{
 const s=city(),stock=structuredClone(s.resources),initial=festivalSummary(s);
 assert.equal(initial.progress.code,'dispatching');assert.deepEqual(initial.reserved,{food:12,beer:6});assert.deepEqual(initial.inTransit,{food:0,beer:0});
 assert.equal(festivalSummary(s,{paused:true}).progress.code,'paused');
 for(const c of s.citizens)c.role='builder';
 assert.equal(festivalSummary(s).progress.code,'noCarrier');
 for(const c of s.citizens){c.role='carrier';c.phase='toWork';}
 assert.equal(festivalSummary(s).progress.code,'busyCarriers');
 for(const c of s.citizens)c.phase='home';advanceFestival(s,.1);
 assert.equal(festivalSummary(s).progress.code,'collecting');
 for(let i=0;i<100&&!s.festival.actors.some(a=>a.load>0);i++)advanceFestival(s,.1);
 const carrying=festivalSummary(s);assert.equal(carrying.progress.code,'delivering');assert.ok(carrying.inTransit.food>0);
 assert.deepEqual(s.resources,stock,'diagnostics and pickup cannot take a second ordinary stock reservation');
 s.festival.actors[0].route[0].key='missing-road-node';assert.equal(festivalSummary(s).progress.code,'roadBlocked');
});

test('a supplied feast distinguishes the evening wait from unfed guests without claiming empty temple stocks',()=>{
 const s=city();delivered(s);
 assert.equal(festivalSummary(s).progress.code,'evening');assert.deepEqual(festivalSummary(s).reserved,{food:0,beer:0});
 s.simTime=32.5;for(const c of s.citizens){c.phase='home';c.mealEaten=0;}
 assert.equal(festivalSummary(s).progress.code,'meal');
 for(const c of s.citizens)c.mealEaten=.8;assert.equal(festivalSummary(s).progress.code,'gathering');
});

test('a permanently employed adult joins the night feast after dinner without losing the workplace',()=>{
 const s=city();delivered(s);night(s);
 for(const c of s.citizens)c.phase='blocked';
 const priest=s.citizens[0],shrine=s.buildings.find(b=>b.type==='shrine'),workplace=`${shrine.x},${shrine.y}`;
 Object.assign(priest,{phase:'home',role:'production',calling:'priest',workplace});
 for(let i=0;i<100&&s.festival.stage!=='celebrating';i++)advanceFestival(s,.1);
 assert.equal(s.festival.stage,'celebrating');assert.ok(s.festival.actors.some(a=>a.stage==='dancing'));
 assert.equal(priest.workplace,workplace);assert.ok(validateFestival(s));assert.ok(saved(s));
});

test('a ceremony finishes on its own saved clock while the city calendar is frozen',()=>{
 let s=city();celebration(s);const simTime=s.simTime,beer=s.resources.beer,food=s.resources.food;
 for(let i=0;i<30;i++)advanceFestival(s,.1,{ceremony:true});
 assert.equal(s.simTime,simTime);assert.ok(festivalView(s).elapsed>=2.9);assert.ok(validateFestival(s));
 s=saved(s);assert.ok(s,'mid-ceremony clock must survive a save');assert.equal(s.simTime,simTime);
 const elapsed=festivalView(s).elapsed;advanceFestival(s,.1,{ceremony:true});assert.ok(festivalView(s).elapsed>elapsed);
 for(let i=0;i<Math.ceil(FESTIVAL_SECONDS*10)+1&&s.festival;i++)advanceFestival(s,.1,{ceremony:true});
 assert.equal(s.festival,null);assert.equal(s.simTime,simTime);assert.equal(s.resources.beer,beer);assert.equal(s.resources.food,food);
});

test('legacy celebration clocks load, while negative or impossible new clocks reject the save',()=>{
 const s=city();celebration(s);delete s.festival.elapsed;const copy=saved(s);assert.ok(copy);
 advanceFestival(copy,.5,{ceremony:true});assert.ok(festivalView(copy).elapsed>=.5);
 for(const value of [-1,Infinity,FESTIVAL_SECONDS+1]){const bad=structuredClone(s);bad.festival.elapsed=value;assert.equal(validateFestival(bad),false);}
 const pending=city();pending.festival.elapsed=1;assert.equal(validateFestival(pending),false);
});
