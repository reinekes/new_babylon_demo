import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,resolveEvent,encode} from '../engine.js';
import {orderFestival,festivalView} from '../festival.js';
import {funeralView} from '../funerals.js';
import {killTestCitizens,triggerTestEvent,TEST_EVENTS} from '../test-tools.js';
import {eventMusicTheme} from '../city-audio.js';
import {testingCity,brewingCity,clockOf,reloadCity,advanceUntil} from './helpers/testing-ceremonies.js';

test('assigned brewers complete real production, announce it, dance and finish on a frozen calendar across saves',()=>{
 let s=brewingCity();assert.equal(s.firstBeerFeast.status,'unbrewed');assert.equal(s.festival,null);
 const stages=new Set(),onStage=(state,stage)=>{stages.add(stage);assert.ok(reloadCity(state),stage);};
 assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating',{onStage}));
 assert.ok(s.simTime>8,'workers must perform the brewing time instead of starting a synthetic party');
 assert.ok([...stages].some(stage=>stage.startsWith('pending:')));assert.ok([...stages].some(stage=>stage.includes(':supplying:')));
 assert.equal(s.news.filter(n=>n.title==='Первая партия пива выпущена').length,1);assert.ok(festivalView(s).dancing.length);
 assert.equal(eventMusicTheme(s),'firstBeer');const clock=clockOf(s),needs=s.citizens.map(c=>[c.hunger,c.thirst]);
 advanceTime(s,3);assert.deepEqual(clockOf(s),clock);assert.deepEqual(s.citizens.map(c=>[c.hunger,c.thirst]),needs);
 s=reloadCity(s);assert.ok(s);assert.ok(advanceUntil(s,state=>!state.festival,{onStage}));assert.deepEqual(clockOf(s),clock);
 assert.equal(s.firstBeerFeast.status,'done');assert.ok(reloadCity(s));advanceTime(s,.1);assert.ok(s.simTime>clock.simTime);
});

test('Night of Lights physically delivers its reservation, waits for a real dinner and finishes without a calendar jump',()=>{
 let s=testingCity();assert.ok(orderFestival(s).ok);const stages=new Set();let loaded=false;
 assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating',{onStage(state,stage){stages.add(stage);assert.ok(reloadCity(state),stage);}}));
 // The route is independently observed in a second fresh order, not inferred from the delivered totals.
 const hauling=testingCity();orderFestival(hauling);assert.ok(advanceUntil(hauling,state=>{loaded=state.festival.actors.some(a=>a.load>0);return loaded;}));assert.ok(loaded);
 assert.deepEqual(s.festival.delivered,{food:12,beer:6});assert.ok(s.simTime>=32.5);assert.ok(stages.has('unbrewed:waiting:'));
 assert.ok(festivalView(s).dancing.length);assert.equal(eventMusicTheme(s),'nightLights');const clock=clockOf(s);advanceTime(s,2);assert.deepEqual(clockOf(s),clock);
 s=reloadCity(s);assert.ok(s);assert.ok(advanceUntil(s,state=>!state.festival));assert.deepEqual(clockOf(s),clock);assert.ok(reloadCity(s));
});

test('five selected real residents produce five matching biers and a complete frozen funeral with valid stages',()=>{
 const s=testingCity(),ids=s.citizens.slice(0,5).map(c=>c.id),before=s.citizens.length;assert.ok(killTestCitizens(s,ids).ok);
 assert.equal(s.citizens.length,before-5);assert.deepEqual(funeralView(s).biers.map(b=>b.deceasedId),ids);const clock=clockOf(s),stages=new Set();
 assert.ok(advanceUntil(s,state=>!state.funeral,{onStage(state,stage){stages.add(stage);assert.ok(reloadCity(state),stage);assert.deepEqual(clockOf(state),clock);}}));
 assert.ok([...stages].some(stage=>stage.endsWith(':procession')));assert.ok([...stages].some(stage=>stage.endsWith(':jackals')));assert.deepEqual(clockOf(s),clock);assert.ok(reloadCity(s));
});

test('all eight testing events pause decisions and accept or skip through real engine handlers',()=>{
 for(const definition of TEST_EVENTS)for(const choice of ['accept','skip']){
  const s=testingCity();assert.ok(triggerTestEvent(s,definition.id).ok);assert.equal(eventMusicTheme(s),definition.music);assert.ok(reloadCity(s));
  const clock=clockOf(s),raw=encode(s);assert.equal(advanceTime(s,2),0);assert.deepEqual(clockOf(s),clock);assert.equal(encode(s),raw);
  assert.ok(resolveEvent(s,choice).ok,`${definition.id}/${choice}`);assert.equal(s.event,null);assert.ok(reloadCity(s),`${definition.id}/${choice}`);
 }
});
