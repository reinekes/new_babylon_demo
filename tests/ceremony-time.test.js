import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {startFuneral} from '../funerals.js';
import {calendarAt} from '../calendar.js';
import {advanceCalendar} from './helpers/calendar-time.js';
const dead=[{id:1000,name:'Покойный',x:8,y:8}];
test('funeral advances participants while calendar, needs, resources and production remain frozen',()=>{
 const s=createGame({start:'established'});startFuneral(s,dead);
 const clock=[s.simTime,s.seasonElapsed,s.year,s.season,s.tick],calendar=calendarAt(s),resources={...s.resources},hunger=s.citizens.map(c=>c.hunger),positions=s.citizens.map(c=>[c.x,c.y]);
 advanceTime(s,2);
 assert.deepEqual([s.simTime,s.seasonElapsed,s.year,s.season,s.tick],clock);
 assert.deepEqual(calendarAt(s),calendar);assert.deepEqual(s.resources,resources);assert.deepEqual(s.citizens.map(c=>c.hunger),hunger);
 assert.notDeepEqual(s.citizens.map(c=>[c.x,c.y]),positions);assert.ok(s.funeral.timer>0);assert.ok(decode(encode(s)));
});
test('family funeral also freezes calendar and ends without leaving the game stuck',()=>{
 const s=createGame({start:'established'});startFuneral(s,dead,{family:true});const clock=s.simTime;
 advanceTime(s,5);assert.equal(s.simTime,clock);assert.ok(s.funeral);assert.ok(decode(encode(s)));
 for(let n=0;n<500&&s.funeral;n++)advanceTime(s,.5);
 assert.equal(s.funeral,null);const before=s.simTime;advanceTime(s,.1);assert.ok(s.simTime>before);
});
test('ceremonies never advance through pending decisions or invalid time',()=>{
 const s=createGame({start:'established'});startFuneral(s,dead);s.event={id:'caravan',title:'Гость',text:'Гость'};const raw=encode(s);assert.equal(advanceTime(s,2),0);assert.equal(encode(s),raw);s.event=null;const before=encode(s);advanceTime(s,0);assert.equal(encode(s),before);
});
test('a seasonal event never blocks a new family funeral',async()=>{
 const {grantTestResources}=await import('../test-tools.js');const s=createGame({start:'established'});grantTestResources(s);
 for(let i=0;i<5;i++){s.event=null;advanceCalendar(s,45-s.seasonElapsed);}assert.equal(s.tick,5);
 s.citizens[0].age=85;s.event=null;advanceCalendar(s,45-s.seasonElapsed);assert.ok(s.funeral);assert.equal(s.event,null);assert.ok(decode(encode(s)));
 const before=s.funeral.timer;advanceTime(s,1);assert.ok(s.funeral.timer>before||s.funeral.stage!=='gathering');
});
