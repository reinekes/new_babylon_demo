import {advanceCalendar} from './helpers/calendar-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarAt,createFrameClock,monthTrackHTML,simulationSeconds,secondsToNextMonth,useOneDayCalendar} from '../calendar.js';
import {createNewCity} from '../new-game.js';
import {putStock,stockStores} from '../inventory.js';
import {createGame,advanceFrame,advanceTime,encode,decode} from '../engine.js';
import {DAY_SECONDS,lightingAt} from '../city-life.js';
test('a legacy three-day city still round-trips with its original month length',()=>{
 let s=createGame({start:'established'});s.calendarDaysPerMonth=3;const start=s.simTime;
 for(const [day,month,displayDay]of [[1,0,2],[2,0,3],[3,1,1]]){
  advanceCalendar(s,DAY_SECONDS);assert.ok(Math.abs(s.simTime-start-day*DAY_SECONDS)<1e-7);
  const c=calendarAt(s);assert.equal(c.month,month);assert.equal(c.day,displayDay);assert.equal(s.tick,0);
  const saved=encode(s);s=decode(saved);assert.ok(s);assert.equal(encode(s),saved);
 }
});
test('twelve months preserve all four seasonal and annual boundaries',()=>{
 const s=createGame({start:'established'});for(let month=0;month<12;month++){const c=calendarAt(s);assert.equal(c.month,month);assert.equal(c.season,Math.floor(month/3));s.event=null;advanceCalendar(s,secondsToNextMonth(s));}assert.equal(s.year,2);assert.equal(s.season,0);assert.equal(calendarAt(s).month,0);
});
test('one city day takes 100 real seconds at 1× and all other speeds are proportional',()=>{
 for(const speed of [1,2,4,10,25])assert.equal(simulationSeconds(.25,speed),DAY_SECONDS*speed/400);
 assert.equal(simulationSeconds(99,1),.15);assert.equal(simulationSeconds(-1,1),0);
});

test('short visible stalls are repaid in bounded frames and discarded when the clock is reset',()=>{
 const clock=createFrameClock(),frames=[1.1,...Array(20).fill(.02)];
 let elapsed=0;
 for(const frame of frames){
  const step=clock.next(frame);
  assert.ok(step>=0&&step<=.25);
  elapsed+=step;
 }
 assert.ok(Math.abs(elapsed-1.5)<1e-8);
 assert.equal(clock.next(60),.25);
 clock.reset();
 assert.equal(clock.next(.02),.02);
});
test('25× advances the live city exactly 2.5 times as far as the legacy 10× mode',()=>{
 const saved=encode(createGame({start:'established'}));
 const elapsed=speed=>{
  const state=decode(saved),start=state.simTime;
  for(const dt of [.0625,.125,.25])advanceFrame(state,dt,speed);
  return state.simTime-start;
 };
 const legacy=elapsed(10);
 assert.ok(Math.abs(legacy-.4375*6)<1e-9);
 assert.ok(Math.abs(elapsed(25)-legacy*2.5)<1e-9);
});

test('opening an older city changes future month length without changing its clock, month progress or cargo',()=>{
 for(const days of [undefined,3]){
  const original=createGame({start:'established'});
  if(days!==undefined)original.calendarDaysPerMonth=days;
  advanceTime(original,37.5);
  const raw=encode(original),s=decode(raw),before=calendarAt(s);
  useOneDayCalendar(s);
  const after=calendarAt(s);
  assert.deepEqual(after,{...before,day:1});
  const expected=JSON.parse(raw);expected.calendarDaysPerMonth=1;
  assert.deepEqual(JSON.parse(encode(s)),expected);
  const remaining=(1-before.progress)*DAY_SECONDS;
  assert.ok(Math.abs(secondsToNextMonth(s)-remaining)<1e-7);
  advanceCalendar(s,remaining);
  assert.equal(calendarAt(s).number,before.number+1);
  assert.equal(encode(decode(encode(s))),encode(s));
 }
});

test('a year of continuous frames has twelve sunrises and twelve months at every live speed',()=>{
 for(const [speed,yearSeconds] of [[1,1200],[2,600],[4,300],[25,48]]){
  const s=useOneDayCalendar(createNewCity({mode:'awakening',seed:137,centeredStart:true}));
  const store=stockStores(s)[0],key=store.x+','+store.y;
  let previous=lightingAt(s.simTime).label,sunrises=0,suppliedMonth=0;
  for(let frame=1;frame<=yearSeconds*4;frame++){
   const month=calendarAt(s).number;
   if(suppliedMonth!==month){putStock(s,key,'food',200);suppliedMonth=month;}
   advanceFrame(s,.25,speed);
   const label=lightingAt(s.simTime).label;
   if(previous==='Ночь'&&label==='Рассвет')sunrises++;
   previous=label;
   const fraction=frame/(yearSeconds*4),months=Math.floor(fraction*12+1e-8);
   assert.equal(calendarAt(s).month,months%12);
   assert.equal(s.tick,Math.floor(months/3));
  }
  assert.equal(s.year,2);assert.equal(sunrises,12);
  assert.ok(Math.abs(s.simTime-12*DAY_SECONDS)<1e-6);
  assert.ok(decode(encode(s)));
 }
});
test('calendar is derived without migrating identities, cargo, crops or saved elapsed time',()=>{
 const s=createGame({start:'established'});advanceTime(s,19);const raw=encode(s),copy=decode(raw);assert.ok(copy);const before=encode(copy);const c=calendarAt(copy);assert.equal(c.month,1);assert.equal(c.day,9);assert.equal(secondsToNextMonth(copy),11);assert.equal((monthTrackHTML(copy).match(/data-month=/g)||[]).length,12);assert.equal((monthTrackHTML(copy).match(/aria-current="date"/g)||[]).length,1);assert.equal(encode(copy),before);
});

test('Nippur month names identify the current month and label all twelve calendar positions',()=>{
 const s=createGame({start:'established'}),names=[];
 for(let month=0;month<12;month++){
  s.season=Math.floor(month/3);s.seasonElapsed=(month%3)*15;
  const c=calendarAt(s);assert.ok(c.monthName);names.push(c.monthName);
  assert.ok(monthTrackHTML(s).includes(c.monthName));
 }
 assert.equal(new Set(names).size,12);assert.equal(names[0],'Бара-заг-гар');assert.equal(names[3],'Шу-нумун');assert.equal(names[6],'Ду-ку');
});

test('displayed clock tolerates simulation rounding at a minute boundary',async()=>{
 const {clockText}=await import('../calendar.js');assert.equal(clockText(60-1e-11),'08:00');assert.equal(clockText(17.5),'15:00');assert.equal(clockText(40),'00:00');
});
