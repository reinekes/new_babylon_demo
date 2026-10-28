import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,resolveEvent,encode,decode,advanceSeason} from '../engine.js';
import {grantTestResources} from '../test-tools.js';
const api=await import('../city-events.js').catch(()=>({}));
test('event catalogue exposes three existing and five new playable decisions with music and effects',()=>{
 assert.ok(Array.isArray(api.CITY_EVENTS));assert.equal(api.CITY_EVENTS.length,8);assert.equal(new Set(api.CITY_EVENTS.map(e=>e.id)).size,8);
 for(const d of api.CITY_EVENTS){assert.ok(d.title&&d.text&&d.music&&d.effectId);assert.deepEqual(Object.keys(api.createCityEvent({},d.id)).sort(),['id','text','title']);}
});
test('every new event accepts, skips, saves and cannot grant twice',()=>{
 assert.equal(typeof api.createCityEvent,'function');
 for(const def of api.CITY_EVENTS.filter(d=>!['festival','caravan','refugees'].includes(d.id))){for(const choice of ['accept','skip']){const s=createGame({start:'established'});grantTestResources(s);s.event=api.createCityEvent(s,def.id);assert.ok(decode(encode(s)));assert.equal(resolveEvent(s,choice).ok,true,def.id);assert.equal(s.event,null);assert.ok(decode(encode(s)),def.id);const raw=encode(s);assert.equal(resolveEvent(s,choice).ok,false);assert.equal(encode(s),raw);}}
});
test('new events reject unaffordable choices without mutation',()=>{
 assert.equal(typeof api.createCityEvent,'function');const s=createGame({start:'established'});s.event=api.createCityEvent(s,'potterVisit');s.resources.food=0;const raw=encode(s);assert.equal(resolveEvent(s,'accept').ok,false);assert.equal(encode(s),raw);
});
