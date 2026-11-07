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

test('new families spend food only when unreserved beds are available',()=>{
 const s=createGame({start:'established'}),home=s.citizens.at(-1).home;
 const guests=s.citizens.filter(c=>c.home!==home).slice(0,4);
 for(const c of guests)c.floodShelter=home;
 s.event=api.createCityEvent(s,'refugees');
 const before=encode(s);
 assert.match(resolveEvent(s,'accept').reason??'',/Нет свободного жилья/);
 assert.equal(encode(s),before);
 delete guests[0].floodShelter;
 const food=s.resources.food,ids=s.citizens.map(c=>c.id);
 assert.ok(resolveEvent(s,'accept').ok);
 assert.equal(s.population,ids.length+1);
 assert.equal(s.resources.food,food-20);
 assert.deepEqual(s.citizens.slice(0,-1).map(c=>c.id),ids);
 assert.equal(s.citizens.at(-1).home,home);
});

test('new families and automatic grants wait if only flooded housing has room',async()=>{
 const {strictScenario}=await import('../scenario-profiles.js');
 const {floodFootprint}=await import('../river-flood.js');
 const {syncCitizens}=await import('../workforce.js');
 const s=createGame({start:'established',scenario:strictScenario()});
 s.population=s.capacity;syncCitizens(s);
 Object.assign(s,{year:4,season:0,riverFlood:{year:4,along:6,bank:-1}});
 const key=[...floodFootprint(s,s.riverFlood)].find(k=>!s.buildings.some(b=>k===b.x+','+b.y));
 assert.ok(key);
 const [x,y]=key.split(',').map(Number);
 s.buildings.push({type:'house',x,y,level:1});s.capacity+=8;
 s.event=api.createCityEvent(s,'refugees');
 const raw=encode(s),count=s.population,nextId=s.demography.nextId;
 assert.match(resolveEvent(s,'accept').reason??'',/Нет свободного жилья/);
 assert.equal(encode(s),raw);
 s.population++;
 syncCitizens(s);
 assert.equal(s.population,count);
 assert.equal(s.demography.nextId,nextId);
 delete s.riverFlood;
 assert.ok(resolveEvent(s,'accept').ok);
 assert.equal(s.population,count+6);
 assert.ok(s.citizens.slice(-6).every(c=>c.home===key));
});
