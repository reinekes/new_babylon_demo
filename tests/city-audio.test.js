import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityAudio} from '../city-audio.js';

const town=()=>({simTime:0,buildings:[{type:'musicHouse',x:5,y:5,level:1}],citizens:[{id:0,age:30,role:'production',calling:'musician',work:'5,5',workplace:'5,5',phase:'working',x:5.5,y:5.5,cargo:{}}]});
function fakeAudio(){const oscillators=[],contexts=[];class Context{constructor(){this.currentTime=3;this.destination={};contexts.push(this);}async resume(){}async suspend(){}createOscillator(){const o={frequency:{},starts:[],stops:[],connect(){},disconnect(){this.disconnected=true;},start(t){this.starts.push(t);},stop(t){this.stops.push(t);}};oscillators.push(o);return o;}createGain(){return {gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){},disconnect(){}};}}return {Context,oscillators,contexts};}
test('opt-in city audio plays real on-site music once per beat and cancels every active voice on absence, distance and mute, while a paused simulation keeps the current note',async()=>{
 const oldAudio=globalThis.AudioContext,oldDoc=globalThis.document,fake=fakeAudio();globalThis.AudioContext=fake.Context;globalThis.document={hidden:false};
 try{const audio=createCityAudio(),s=town();audio.tick(s,false,{x:5,y:5});assert.equal(fake.oscillators.length,0);assert.equal(await audio.toggle(),true);audio.tick(s,false,{x:5,y:5});assert.equal(fake.oscillators.length,3);audio.tick(s,false,{x:5,y:5});assert.equal(fake.oscillators.length,3);
  audio.tick(s,true,{x:5,y:5});assert.ok(fake.oscillators.every(o=>!o.stops.includes(3)));s.simTime=.5;fake.contexts[0].currentTime=3.5;audio.tick(s,false,{x:5,y:5});const away=fake.oscillators.slice(-3);audio.tick(s,false,{x:30,y:30});assert.ok(away.every(o=>o.stops.includes(3.5)));
  s.simTime=1;fake.contexts[0].currentTime=4;audio.tick(s,false,{x:5,y:5});const hidden=fake.oscillators.slice(-3);globalThis.document.hidden=true;audio.tick(s,false,{x:5,y:5});assert.ok(hidden.every(o=>o.stops.includes(4)));globalThis.document.hidden=false;
  s.simTime=1.5;fake.contexts[0].currentTime=4.5;audio.tick(s,false,{x:5,y:5});const absent=fake.oscillators.slice(-3);s.citizens[0].phase='toWork';audio.tick(s,false,{x:5,y:5});assert.ok(absent.every(o=>o.stops.includes(4.5)));s.citizens[0].phase='working';s.simTime=2;fake.contexts[0].currentTime=5;audio.tick(s,false,{x:5,y:5});const muted=fake.oscillators.slice(-3);assert.equal(await audio.toggle(),false);assert.ok(muted.every(o=>o.stops.includes(5)));
 }finally{if(oldAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAudio;if(oldDoc===undefined)delete globalThis.document;else globalThis.document=oldDoc;}
});
test('synthetic notes follow the audio clock while simulation is paused without queuing missed notes',async()=>{
 const oldAudio=globalThis.AudioContext,fake=fakeAudio();globalThis.AudioContext=fake.Context;
 try{const audio=createCityAudio(),s=town();await audio.toggle();audio.tick(s,false,{x:5,y:5});audio.tick(s,true,{x:5,y:5});assert.equal(fake.oscillators.length,3);fake.contexts[0].currentTime=13;audio.tick(s,true,{x:5,y:5});assert.equal(fake.oscillators.length,6);audio.tick(s,true,{x:5,y:5});assert.equal(fake.oscillators.length,6);}
 finally{if(oldAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAudio;}
});

test('cat discovery and summon play distinct cues over continuous background and never replay on load',async()=>{
 const {oscillators,Context}=fakeAudio(),context=new Context(),media=[];
 context.state='running';
 const audio=createCityAudio(undefined,{createWorkContext:()=>context,createMedia:()=>{
  const element={paused:true,plays:0,play(){this.paused=false;this.plays++;},pause(){this.paused=true;}};
  media.push(element);return element;
 }});
 const s=town();
 s.scenario={miracles:'awakening-c01-v1'};
 s.catDiscovery={openedAt:null};
 audio.tick(s,true,null);
 await audio.toggle();
 const background=media[0];
 s.catDiscovery.openedAt=1;
 audio.tick(s,true,null);
 const opening=oscillators.map(o=>o.frequency.value);
 assert.equal(opening.length,9);
 audio.tick(s,true,null);
 assert.equal(oscillators.length,9);
 s.miracleCelebration={kind:'cat',duration:8};
 audio.tick(s,true,null);
 const summon=oscillators.slice(9).map(o=>o.frequency.value);
 assert.equal(summon.length,9);
 assert.notDeepEqual(summon,opening);
 assert.equal(media.length,1);
 assert.equal(background.plays,1);
 audio.tick(structuredClone(s),true,null);
 assert.equal(oscillators.length,18);
 audio.dispose();
});

test('a missing positional track leaves background and miracle cues playing',async()=>{
 const {oscillators,Context}=fakeAudio(),context=new Context(),media=[];
 context.state='running';
 let time=0,missing=true;
 const audio=createCityAudio(undefined,{now:()=>time,createWorkContext:()=>context,createMedia:()=>{
  const element={paused:true,plays:0,loads:0,load(){this.loads++;},play(){
   this.plays++;
   if(missing&&media.indexOf(this)===1)return Promise.reject(new Error('missing lithophone recording'));
   this.paused=false;
  },pause(){this.paused=true;}};
  media.push(element);return element;
 }});
 try{
  const s=town(),near={x:5,y:5};
  audio.tick(s,true,near);
  await audio.toggle();
  await Promise.resolve();
  time=2;
  audio.tick(s,true,near);
  assert.equal(audio.enabled,true);
  assert.deepEqual(audio.status.playing,['main']);
  assert.equal(media[0].plays,1);
  time=4;audio.tick(s,true,near);
  assert.equal(media[0].volume,.16);
  assert.equal(media[1].plays,1);
  audio.cueEarth('bow');
  assert.ok(oscillators.length>0);
  missing=false;
  await audio.toggle();
  assert.equal(await audio.toggle(),true);
  assert.equal(media[1].loads,1);
  assert.equal(media[1].plays,2);
  assert.equal(audio.status.lithophone,true);
 }finally{audio.dispose();}
});

test('miracle cues stay safe without a media element and share the synthetic audio context',async()=>{
 const oldAudio=globalThis.AudioContext,oldMedia=globalThis.Audio,fake=fakeAudio();
 globalThis.AudioContext=fake.Context;
 delete globalThis.Audio;
 let audio;
 try{
  audio=createCityAudio();
  assert.equal(audio.cueRain('drop'),undefined);
  assert.equal(audio.cueEarth('bow'),undefined);
  assert.equal(audio.cueCatch('reflection'),undefined);
  assert.equal(await audio.toggle(),true);
  fake.contexts[0].state='running';
  const stopRain=audio.cueRain('drop'),rain=fake.oscillators.slice();
  const stopCatch=audio.cueCatch('reflection'),catchNotes=fake.oscillators.slice(rain.length);
  assert.equal(fake.contexts.length,1);
  assert.equal(rain.length,3);
  assert.equal(catchNotes.length,3);
  stopRain();
  assert.ok(rain.every(o=>o.stops.includes(undefined)));
  assert.ok(catchNotes.every(o=>!o.stops.includes(undefined)));
  stopCatch();
  assert.ok(catchNotes.every(o=>o.stops.includes(undefined)));
  await audio.toggle();
  assert.equal(audio.cueEarth('bow'),undefined);
 }finally{
  audio?.dispose();
  if(oldAudio===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=oldAudio;
  if(oldMedia!==undefined)globalThis.Audio=oldMedia;
 }
});
