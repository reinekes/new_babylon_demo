import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {DAY_SECONDS} from '../city-life.js';
import {advanceWorkers} from '../workforce.js';
import {assignWorkplace,setCitizenRole} from '../management.js';
import {isWorkplaceOpen,residentDepartureHour,residentReturnHour,workplaceHours} from '../work-schedule.js';

const seconds=hour=>(hour-8+24)%24*DAY_SECONDS/24;

test('workplace hours vary by activity and residents start at different stable times',()=>{
 const hours=['fishing','field','pottery','market','musicHouse'].map(type=>workplaceHours(type));
 assert.equal(new Set(hours.map(v=>v.open)).size,hours.length);
 assert.ok(hours[0].open<hours[2].open&&hours[0].close<hours[2].close);
 assert.equal(isWorkplaceOpen('pottery',seconds(hours[2].open-.1)),false);
 assert.equal(isWorkplaceOpen('pottery',seconds(hours[2].open)),true);
 assert.equal(isWorkplaceOpen('pottery',seconds(hours[2].close)),false);
 const starts=Array.from({length:8},(_,id)=>residentDepartureHour('field',id));
 assert.ok(new Set(starts).size>=5);
 assert.ok(new Set(starts.map((_,id)=>residentReturnHour('field',id))).size>=5);
 assert.deepEqual(starts,Array.from({length:8},(_,id)=>residentDepartureHour('field',id)));
});

test('assigned workers leave real homes at different times and head home before dusk when the field closes',()=>{
 const state=createGame({start:'established',seed:137});
 const field=state.buildings.find(b=>b.type==='field'),key=`${field.x},${field.y}`;
 const workers=state.citizens.filter(c=>c.age>=16).slice(0,2);
 const ids=workers.map(c=>c.id);
 for(const c of workers){
  assert.ok(setCitizenRole(state,c.id,'production').ok);
  assert.ok(assignWorkplace(state,c.id,key).ok);
 }
 for(const b of state.buildings.filter(b=>b.type==='house')){b.pantry=50;b.water=20;}
 const observed=()=>state.citizens.filter(c=>ids.includes(c.id));
 const first=workplaceHours('field').open,start=seconds(first-.15);
 state.simTime=start;
 for(const c of observed())Object.assign(c,{phase:'home',route:[],routeIndex:0,work:key});
 const departures=new Map();
 for(let i=0;i<25;i++){
  advanceWorkers(state,.1);
  for(const c of observed())if(['toWork','working'].includes(c.phase)&&!departures.has(c.id))departures.set(c.id,state.simTime);
 }
 assert.equal(departures.size,2);
 assert.notEqual(...departures.values());
 state.simTime=seconds(workplaceHours('field').close)+.01;
 for(const c of observed())Object.assign(c,{x:field.x,y:field.y,phase:'working',route:[],routeIndex:0,work:key,cargo:{}});
 advanceWorkers(state,.1);
 assert.ok(observed().every(c=>['toHome','home'].includes(c.phase)));
});
