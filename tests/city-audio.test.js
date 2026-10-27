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
