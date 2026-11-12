import {advanceCalendar} from './helpers/calendar-time.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {calendarAt,monthTrackHTML,simulationSeconds,secondsToNextMonth} from '../calendar.js';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {DAY_SECONDS} from '../city-life.js';
test('a live month lasts three complete work days, including a mid-month save and reload',()=>{
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
test('1x takes eight real minutes per day while 2x/4x remain proportional',()=>{
 assert.equal(simulationSeconds(.2,1),.025);assert.equal(simulationSeconds(.2,2),.05);assert.equal(simulationSeconds(.2,4),.1);assert.equal(simulationSeconds(.2,10),.25);assert.equal(simulationSeconds(99,1),.03125);assert.equal(simulationSeconds(-1,1),0);
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
