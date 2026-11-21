import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode,getCityEvent,eventSecondsLeft,eventAutoPause,setEventAutoPause,resolveEvent,eventReason} from '../engine.js';
import {CITY_EVENTS} from '../city-events.js';
import {grantTestResources,triggerTestEvent} from '../test-tools.js';
import {setSeedProtection} from '../food-planning.js';
import {advanceCalendar} from './helpers/calendar-time.js';
import {testingCity} from './helpers/testing-ceremonies.js';

function city(){return createGame({start:'established'});}
test('old city offers still block until the player opts in, and toggling or loading preserves the remaining day',()=>{
 let s=city();
 assert.equal(eventAutoPause(s),true);
 assert.equal(triggerTestEvent(s,'riverGift').ok,true);
 assert.equal(advanceTime(s,8),0);
 const old=encode(s);
 assert.equal(encode(decode(old)),old);
 assert.equal(setEventAutoPause(s,false).ok,true);
 assert.equal(s.event,null);assert.equal(eventSecondsLeft(s),60);
 assert.equal(setSeedProtection(s,false).ok,true);
 const original=getCityEvent(s);
 advanceTime(s,17.5);
 assert.equal(eventSecondsLeft(s),42.5);
 setEventAutoPause(s,true);
 assert.equal(getCityEvent(s),original);assert.equal(advanceTime(s,12),0);
 s=decode(encode(s));assert.ok(s);assert.equal(eventAutoPause(s),true);
 setEventAutoPause(s,false);assert.equal(eventSecondsLeft(s),42.5);
 s=decode(encode(s));assert.equal(eventSecondsLeft(s),42.5);
 advanceTime(s,42.49);assert.ok(getCityEvent(s));
 advanceTime(s,.01);assert.equal(getCityEvent(s),null);
 assert.equal(resolveEvent(s,'accept',original).ok,false);assert.equal(eventSecondsLeft(s),null);
});
test('an ignored offer expires exactly once with the same economy, work and cargo as a city without an offer',()=>{
 const s=city();setEventAutoPause(s,false);const control=decode(encode(s));assert.ok(control);
 const original=s.citizens.map(c=>[c.x,c.y]);
 triggerTestEvent(s,'riverGift');
 for(const n of [15.031,14.969,15,16.45,.55]){advanceTime(s,n);advanceTime(control,n);}
 assert.ok(s.simTime>=62-1e-6);assert.notDeepEqual(s.citizens.map(c=>[c.x,c.y]),original);
 assert.equal(getCityEvent(s),null);assert.equal(s.news.filter(n=>n.title.endsWith('срок истёк')).length,1);
 s.news=s.news.filter(n=>!n.title.endsWith('срок истёк'));
 assert.equal(encode(s),encode(control));
});
test('all eight offers can be accepted once, retain failed choices, and reject clicks left over from an earlier offer',()=>{
 for(const def of CITY_EVENTS){
  const s=testingCity();setEventAutoPause(s,false);assert.equal(triggerTestEvent(s,def.id).ok,true);
  const prior=getCityEvent(s);assert.equal(resolveEvent(s,'skip',prior).ok,true);
  assert.equal(triggerTestEvent(s,def.id).ok,true);const current=getCityEvent(s);
  const raw=encode(s);assert.equal(resolveEvent(s,'accept',prior).ok,false);assert.equal(encode(s),raw);
  assert.equal(eventReason(s),'',def.id);
  assert.equal(resolveEvent(s,'accept',current).ok,true,def.id);
  assert.equal(getCityEvent(s),null);
  assert.equal(resolveEvent(s,'accept',current).ok,false);
  assert.ok(decode(encode(s)),def.id);
 }
 const s=city();setEventAutoPause(s,false);triggerTestEvent(s,'potterVisit');s.resources.food=0;
 const offer=getCityEvent(s),raw=encode(s);assert.equal(resolveEvent(s,'accept',offer).ok,false);assert.equal(getCityEvent(s),offer);assert.equal(encode(s),raw);
});
test('seasonal offers are born unpaused, retain a full day at the boundary, and let a season jump finish',()=>{
 const s=city();grantTestResources(s);setEventAutoPause(s,false);
 advanceCalendar(s,179.9);
 assert.ok(Math.abs(s.simTime-179.9)<1e-6);
 advanceTime(s,.35);
 assert.equal(getCityEvent(s)?.id,'festival');assert.equal(s.event,null);
 assert.ok(Math.abs(eventSecondsLeft(s)-59.75)<1e-6);assert.ok(decode(encode(s)));
});
test('save validation rejects overlapping windows and invalid deadlines and leaves valid old cities byte-equivalent',()=>{
 const s=city();setEventAutoPause(s,false);triggerTestEvent(s,'harvestThanks');
 for(const edit of [v=>v.autoPauseEvents=1,v=>v.event=v.eventOffer,v=>delete v.autoPauseEvents,v=>v.eventOffer.expiresAt=61,v=>v.eventOffer.expiresAt=-1,v=>v.eventOffer.expiresAt='tomorrow',v=>v.eventOffer.id='forged']){
  const bad=JSON.parse(encode(s));edit(bad);assert.equal(decode(JSON.stringify(bad)),null);
 }
 const expired=JSON.parse(encode(s));expired.eventOffer.expiresAt=0;
 const restored=decode(JSON.stringify(expired));assert.ok(restored);assert.equal(getCityEvent(restored),null);
});
