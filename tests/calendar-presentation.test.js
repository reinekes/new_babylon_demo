import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createMonthNotice} from '../ui-calendar.js';
import {runSeasonJump} from '../season-jump.js';
import {testingCity} from './helpers/testing-ceremonies.js';
import {encode,decode} from '../engine.js';

test('month notices announce actual changes, stay silent on first load and reset for a different city',()=>{
 const dom=new JSDOM('<main></main>'),tasks=[];
 const notice=createMonthNotice(dom.window.document.querySelector('main'),{schedule:fn=>{tasks.push(fn);return tasks.length;},cancel:()=>{}});
 const s={year:1,season:0,seasonElapsed:0};notice.update(s);assert.equal(notice.element.hidden,true);
 s.seasonElapsed=15;notice.update(s);assert.equal(notice.element.hidden,false);assert.match(notice.element.textContent,/Наступил месяц Гу-си-су/);
 notice.update({...s,season:1});assert.equal(notice.element.hidden,true,'loading a different city does not announce a fake crossing');
 notice.dispose();assert.equal(dom.window.document.querySelector('[role=status]'),null);dom.window.close();
});
test('asynchronous season jumps yield valid intermediate saves and finish the same day hour',async()=>{
 const s=testingCity(),start=s.simTime,tick=s.tick;let yields=0,progress=[];
 const result=await runSeasonJump(s,{yieldFrame:async()=>{yields++;assert.ok(decode(encode(s)));},onProgress:p=>progress.push(p)});
 assert.equal(result.ok,true);assert.ok(yields>1);assert.equal(s.tick,tick+1);assert.ok(Math.abs(s.simTime-start-60)<1e-5);
 assert.equal(progress.at(-1),1);assert.ok(progress.every((p,i)=>i===0||p>=progress[i-1]));
});
test('an asynchronous jump stops at decisions without swallowing the pending event',async()=>{
 const s=testingCity();let fired=false;
 const result=await runSeasonJump(s,{yieldFrame:async()=>{},onProgress:p=>{if(p>0&&!fired){fired=true;s.event={id:'caravan',title:'Гость',text:'Гость'};}}});
 assert.equal(result.ok,false);assert.equal(s.event.id,'caravan');assert.ok(s.tick<1);assert.ok(decode(encode(s)));
});

test('asynchronous near-boundary travel preserves a full day without accumulating calendar rounding',async()=>{
 const s=testingCity();const {advanceTime}=await import('../engine.js');advanceTime(s,44.999999);const before=s.simTime;
 assert.equal((await runSeasonJump(s,{yieldFrame:async()=>{}})).ok,true);
 assert.ok(Math.abs(s.simTime-before-60)<1e-6);assert.ok(decode(encode(s)));
});
