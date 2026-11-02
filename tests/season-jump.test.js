import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {seasonJumpReason,advanceToNextSeason} from '../season-jump.js';
import {orderFestival,skipFestival,advanceFestival,validateFestival} from '../festival.js';
import {startMiracleCelebration} from '../miracle-celebration.js';
import {startFuneral} from '../funerals.js';
import {validateInventory} from '../inventory.js';
import {networkFor} from '../workforce.js';
import {workArtisan} from '../artisan.js';
import {collectReadyOutputs} from '../building-inventory.js';
import {eventMusicTheme} from '../city-audio.js';
import {testingCity,brewingCity,advanceUntil} from './helpers/testing-ceremonies.js';

function feast(){
 const s=testingCity();
 assert.equal(orderFestival(s).ok,true);
 assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));
 return s;
}
const clone=s=>decode(encode(s));

test('the season button crosses one actual season from the middle of a month',()=>{
 const s=testingCity();advanceTime(s,17);
 const before=s.tick,targetTime=(before+1)*45;
 assert.equal(seasonJumpReason(s),'');
 const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.equal(s.tick,before+1);
 assert.ok(Math.abs(s.simTime-targetTime)<1e-6);assert.equal(s.seasonElapsed,0);
 assert.equal(s.festival,null);assert.equal(s.miracleCelebration??null,null);
 assert.ok(clone(s));
});

test('an automatic cat scene starting inside a season jump does not consume the calendar interval',()=>{
 const s=testingCity();s.pests.totalLoss=3;
 const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.ok(result.skipped.includes('cat'));
 assert.equal(s.tick,1);assert.equal(s.simTime,45);assert.equal(s.seasonElapsed,0);
 assert.equal(s.miracleCelebration,null);assert.equal(s.pests.cats.length,1);assert.ok(clone(s));
});

test('an unfinished feast refunds its exact reservations once and immediately sends only its actors home',()=>{
 const s=testingCity(),before=structuredClone(s.resources);
 assert.equal(orderFestival(s).ok,true);
 assert.ok(advanceUntil(s,state=>state.festival?.actors.some(a=>a.load>0)));
 const actors=s.festival.actors.map(a=>a.id),outsiders=s.citizens.filter(c=>!actors.includes(c.id)).map(c=>structuredClone(c));
 // Reload a real in-transit load before exercising the cancellation ledger.
 const restored=clone(s);assert.ok(restored);
 const booked=structuredClone(restored.festival.allocations),reserved={food:0,beer:0};
 for(const goods of Object.values(booked))for(const key of ['food','beer'])reserved[key]+=goods[key]||0;
 const current=structuredClone(restored.resources),clock=[restored.simTime,restored.tick,restored.seasonElapsed];
 const result=skipFestival(restored);
 assert.equal(result.ok,true);assert.equal(result.refunded,true);assert.equal(restored.festival,null);
 for(const key of ['food','beer'])assert.ok(Math.abs(restored.resources[key]-current[key]-reserved[key])<1e-7);
 assert.equal(restored.resources.prestige,current.prestige+15);
 assert.deepEqual([restored.simTime,restored.tick,restored.seasonElapsed],clock);
 for(const id of actors){const c=restored.citizens.find(c=>c.id===id),home=networkFor(restored).ports.find(p=>`${p.building.x},${p.building.y}`===c.home);assert.equal(c.phase,'home');assert.deepEqual([c.x,c.y],[home.x,home.y]);assert.deepEqual(c.route,[]);}
 assert.deepEqual(restored.citizens.filter(c=>!actors.includes(c.id)),outsiders);
 const after=encode(restored);assert.equal(skipFestival(restored).ok,false);assert.equal(encode(restored),after);
 assert.ok(validateInventory(restored));assert.ok(validateFestival(restored));assert.ok(clone(restored));
 assert.equal(before.prestige,restored.resources.prestige);
});

test('skipping a consumed feast neither refunds its meal nor repeats any attendance reward',()=>{
 const s=feast(),q=s.festival;
 const resources=structuredClone(s.resources),people=s.citizens.map(c=>[c.id,c.mood,c.faith,c.cargo,c.buildCargo]),clock=[s.simTime,s.tick,s.seasonElapsed];
 assert.equal(eventMusicTheme(s),'nightLights');assert.ok(q.rewarded.length>0);
 assert.equal(skipFestival(s).refunded,false);
 assert.deepEqual(s.resources,resources);assert.deepEqual(s.citizens.map(c=>[c.id,c.mood,c.faith,c.cargo,c.buildCargo]),people);
 assert.deepEqual([s.simTime,s.tick,s.seasonElapsed],clock);assert.notEqual(eventMusicTheme(s),'nightLights');
 assert.ok(s.citizens.every(c=>c.phase!=='festival'));assert.ok(clone(s));
});

test('jumping out of a feast ends its scene and reaches the next season without waiting ninety seconds',()=>{
 const s=feast(),tick=s.tick;
 assert.equal(seasonJumpReason(s),'');const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.ok(result.skipped.includes('nightLights'));
 assert.equal(s.tick,tick+1);assert.equal(s.seasonElapsed,0);assert.equal(s.festival,null);
 assert.equal(s.miracleCelebration??null,null);assert.ok(s.citizens.every(c=>c.phase!=='festival'));assert.ok(clone(s));
});

test('a skipped first-beer preparation is explicitly skipped, refunds its real cup and never restarts',()=>{
 const s=brewingCity(),b=s.buildings.find(b=>b.type==='brewery');
 Object.assign(b.artisan,{food:4,water:3,pottery:1});workArtisan(b,15,s);collectReadyOutputs(s);
 advanceFestival(s,.1);assert.equal(s.festival?.occasion,'firstBeer');
 const beer=b.workshopStock.output.beer,people=s.citizens.map(c=>[c.id,c.mood,c.faith]);
 assert.equal(skipFestival(s).refunded,true);assert.equal(s.firstBeerFeast.status,'skipped');
 assert.equal(b.workshopStock.output.beer,beer+1);assert.deepEqual(s.citizens.map(c=>[c.id,c.mood,c.faith]),people);
 advanceFestival(s,.1);assert.equal(s.festival,null);assert.ok(validateFestival(s));assert.ok(clone(s));
 const restored=clone(s);assert.equal(restored.firstBeerFeast.status,'skipped');
 assert.equal(advanceToNextSeason(restored).ok,true);assert.equal(restored.festival,null);
});

test('a pending first-beer occasion is declined by a season jump without consuming a cup or inventing guests',()=>{
 const s=brewingCity(),b=s.buildings.find(b=>b.type==='brewery');
 Object.assign(b.artisan,{food:4,water:3,pottery:1});workArtisan(b,15,s);collectReadyOutputs(s);
 assert.equal(s.festival,null);assert.equal(s.firstBeerFeast.status,'pending');
 const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.equal(s.tick,1);assert.equal(s.seasonElapsed,0);
 assert.equal(s.festival,null);assert.equal(s.firstBeerFeast.status,'skipped');
 assert.ok(result.skipped.includes('firstBeer'));assert.ok(clone(s));
});

test('first brewing and its feast can begin inside the jump, then finish without leaving stale festival actors',()=>{
 const s=brewingCity();assert.equal(s.firstBeerFeast.status,'unbrewed');
 const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.ok(result.skipped.includes('firstBeer'));
 assert.equal(s.tick,1);assert.equal(s.seasonElapsed,0);assert.equal(s.festival,null);
 assert.equal(s.firstBeerFeast.status,'done','a real first cup was served before the rest of its scene was skipped');
 assert.ok(s.citizens.every(c=>c.phase!=='festival'));assert.ok(clone(s));
});

test('winter jumps to next spring exactly once and preserves the new-year decision',()=>{
 const s=testingCity();
 for(let i=0;i<4;i++)assert.equal(advanceToNextSeason(s).ok,true);
 assert.equal(s.tick,4);assert.equal(s.year,2);assert.equal(s.season,0);assert.equal(s.seasonElapsed,0);
 assert.equal(s.event?.id,'festival');assert.match(seasonJumpReason(s),/событи/);assert.ok(clone(s));
});

test('a miracle scene can be skipped while advancing exactly one season and retaining resident identities',()=>{
 const s=testingCity();assert.equal(startMiracleCelebration(s,'fertility'),true);
 const ids=s.citizens.map(c=>c.id),before=s.tick,result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.ok(result.skipped.includes('fertility'));
 assert.equal(s.miracleCelebration,null);assert.equal(s.tick,before+1);assert.deepEqual(s.citizens.map(c=>c.id),ids);
 assert.ok(clone(s));
});

test('pending decisions, funerals and relic possession cannot be silently discarded by the season button',()=>{
 const cases=[
  s=>{s.event={id:'caravan',title:'Гость',text:'Гость'};},
  s=>startFuneral(s,[{id:1000,name:'Покойный',x:8,y:8}]),
  s=>{s.relicQuest.phase='controlled';},
 ];
 for(const prepare of cases){const s=createGame({start:'established'});prepare(s);const before=JSON.stringify(s);assert.ok(seasonJumpReason(s));assert.equal(advanceToNextSeason(s).ok,false);assert.equal(JSON.stringify(s),before);}
});
