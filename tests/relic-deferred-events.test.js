import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {CITY_EVENTS,createCityEvent} from '../city-events.js';
import {startRelicQuest,cancelRelicQuest} from '../relic-quest.js';

function possessed(kind){
 const s=createGame({start:'established'});s.resources.faith=1000;
 for(const c of s.citizens){Object.assign(c,{age:25,role:'builder',work:null,site:null,phase:'home',cargo:{},buildCargo:{}});delete c.pantryTrip;delete c.waterTrip;}
 syncCitizens(s);assert.equal(startRelicQuest(s,s.citizens[0].id,kind).ok,true);return s;
}
for(const kind of ['oasis','land'])test(`${kind} possession defers every city event and preserves the saved actor, cargo and pending decision`,()=>{
 for(const definition of CITY_EVENTS){
  let s=possessed(kind);const key=kind==='land'?'landRelicQuest':'relicQuest',id=s[key].actorId,event=createCityEvent(s,definition.id),ids=s.citizens.map(c=>c.id);s.event=event;
  assert.ok(advanceTime(s,.1)>0);assert.equal(s.event,null);assert.deepEqual(s[key].deferredEvent,event);const pending=JSON.stringify(s[key].deferredEvent),cargo=s.citizens.map(c=>[c.id,c.cargo,c.buildCargo]);
  s=decode(encode(s));assert.ok(s,`${kind}: ${definition.id}`);assert.equal(s[key].actorId,id);assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.deepEqual(s.citizens.map(c=>[c.id,c.cargo,c.buildCargo]),cargo);assert.equal(JSON.stringify(s[key].deferredEvent),pending);
  assert.equal(cancelRelicQuest(s).ok,true);assert.deepEqual(s.event,event);assert.ok(decode(encode(s)));
 }
});
test('deferred city decisions reject unknown IDs, extra payload, wrong types and unbounded prose',()=>{
 const s=possessed('oasis');s.event=createCityEvent(s,'potterVisit');advanceTime(s,.1);
 for(const mutate of [e=>e.id='unknown',e=>e.title=3,e=>e.text=null,e=>e.extra=true,e=>e.title='x'.repeat(201),e=>e.text='x'.repeat(5001)]){const bad=structuredClone(s);mutate(bad.relicQuest.deferredEvent);assert.equal(decode(JSON.stringify(bad)),null);}
});
