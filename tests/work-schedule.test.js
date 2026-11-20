import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {DAY_SECONDS} from '../city-life.js';
import {advanceWorkers,visibleCitizens} from '../workforce.js';
import {mealCycle,mealRation} from '../wellbeing.js';
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
 for(const b of state.buildings.filter(b=>b.type==='house')){b.pantry=50;b.pantryDelivered=50;b.water=20;}
 const observed=()=>state.citizens.filter(c=>ids.includes(c.id));
 const start=seconds(4.90);
 state.simTime=start;
 for(const c of state.citizens){c.mealDay=mealCycle(start);c.mealEaten=mealRation(c);}
 for(const c of observed())Object.assign(c,{phase:'home',route:[],routeIndex:0,work:key});
 const departures=new Map();
 for(let i=0;i<110;i++){
  advanceWorkers(state,.1);
  for(const c of observed())if(['toWork','working'].includes(c.phase)&&!departures.has(c.id))departures.set(c.id,state.simTime);
 }
 assert.equal(departures.size,2);
 assert.notEqual(...departures.values());
 for(const id of ids){const expected=seconds(residentDepartureHour('field',id));assert.ok(Math.abs(departures.get(id)-expected)<.21,`${id}: departed ${departures.get(id)}, scheduled ${expected}`);}
 state.simTime=seconds(workplaceHours('field').close)+.01;
 for(const c of observed())Object.assign(c,{x:field.x,y:field.y,phase:'working',route:[],routeIndex:0,work:key,cargo:{}});
 advanceWorkers(state,.1);
 assert.ok(observed().every(c=>['toHome','home'].includes(c.phase)));
});

test('500 identities keep distinct morning starts, leaving five minutes for the last threshold crossing',()=>{
 const times=Array.from({length:500},(_,id)=>residentDepartureHour('field',id));
 assert.equal(new Set(times).size,500);assert.equal(Math.min(...times),5);assert.equal(Math.max(...times),8+55/60);
 for(const hour of [5,6,7,8]){
  const minutes=hour===8?55:60,count=times.filter(t=>t>=hour&&t<hour+1).length;
  assert.ok(Math.abs(count-500*minutes/235)<3);
 }
 assert.deepEqual(times,Array.from({length:500},(_,id)=>residentDepartureHour('pottery',id)));
});

test('children leave at their own door in the morning, return at night and a baby stays indoors',()=>{
 const state=createGame({start:'established',seed:137}),child=state.citizens.find(c=>c.age===6),baby=state.citizens.find(c=>c.age===12);
 baby.age=1;const slot=residentDepartureHour(undefined,child.id);
 for(const [hour,playing] of [[4.99,false],[slot-.001,false],[slot+.001,true],[19,false],[23,false]]){
  state.simTime=seconds(hour);
  const people=visibleCitizens(state),p=people.find(c=>c.id===child.id);
  assert.equal(!!p?.playing,playing);assert.ok(!people.some(c=>c.id===baby.id));
  if(playing)assert.ok(Math.hypot(p.x-child.x,p.y-child.y)<.01,'starts at the household street door');
 }
});

test('an early commuter waits at the real workplace before the morning shift opens',()=>{
 const s=createGame({start:'established',seed:137}),worker=s.citizens[0],pit=s.buildings.find(b=>b.type==='clay'),job=`${pit.x},${pit.y}`;
 setCitizenRole(s,worker.id,'production');assignWorkplace(s,worker.id,job);
 s.simTime=seconds(4.95);
 for(const b of s.buildings.filter(b=>b.type==='house'))Object.assign(b,{pantry:50,pantryDelivered:50,water:20});
 for(const c of s.citizens){c.mealDay=mealCycle(s.simTime);c.mealEaten=mealRation(c);}
 let waited=false,worked=false;
 while(s.simTime<seconds(7.35)){
  advanceWorkers(s,.05);const view=visibleCitizens(s).find(c=>c.id===worker.id);
  if(worker.phase==='toWork'&&worker.route.length&&worker.routeIndex===worker.route.length){
   assert.equal(view.walking,false);assert.equal(worker.workElapsed,0);waited=true;
  }
  if(worker.phase==='working'&&worker.workElapsed>0){assert.ok(isWorkplaceOpen('clay',s.simTime));worked=true;}
 }
 assert.ok(waited&&worked);
});
