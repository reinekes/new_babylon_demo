import test from 'node:test';import assert from 'node:assert/strict';
import * as musicAudio from '../music-audio.js';
import {musicSoundSources,playStoneNote} from '../music-audio.js';
const town=()=>({simTime:0,buildings:[{type:'musicHouse',x:5,y:5,level:1}],citizens:[{id:0,age:30,role:'production',calling:'musician',work:'5,5',workplace:'5,5',phase:'working',x:5.5,y:5.5,cargo:{}}]});
test('audio requires inspiration and real daytime on-site work, with distance falloff',()=>{const s=town(),listener={x:5,y:5},before=JSON.stringify(s);assert.equal(musicSoundSources(s,listener).length,1);assert.equal(JSON.stringify(s),before);assert.equal(musicSoundSources(s,{x:30,y:30}).length,0);s.citizens[0].calling='auto';assert.equal(musicSoundSources(s,listener).length,0);s.citizens[0].calling='musician';s.citizens[0].phase='toWork';assert.equal(musicSoundSources(s,listener).length,0);s.citizens[0].phase='working';s.simTime=35;assert.equal(musicSoundSources(s,listener).length,0);});
test('stone sound uses bounded, fading partials that all stop',()=>{const oscillators=[],gains=[],context={currentTime:3,destination:{},createOscillator(){const o={frequency:{},connect(){},start(t){this.startAt=t;},stop(t){this.stopAt=t;}};oscillators.push(o);return o;},createGain(){const events=[],g={gain:{setValueAtTime:(...v)=>events.push(v),exponentialRampToValueAtTime:(...v)=>events.push(v)},connect(){},events};gains.push(g);return g;}};playStoneNote(context,220,.012);assert.equal(oscillators.length,3);assert.ok(oscillators.every(o=>o.stopAt>o.startAt&&o.stopAt<5));assert.ok(gains.every(g=>g.events.every(([v])=>v<=.012)));});

test('lithophone is only audible beside the courtyard, with known close camera and a short soft edge',()=>{
 const s=town();
 assert.equal(musicSoundSources(s).length,0,'a missing listener must not use an imaginary location');
 assert.equal(musicSoundSources(s,{x:5,y:5,proximity:0}).length,0,'a distant zoom must be silent');
 assert.equal(musicSoundSources(s,{x:6.5,y:5}).length,0,'one and a half cells is already outside the courtyard');
 assert.equal(musicSoundSources(s,{x:5,y:5})[0].gain,.012);
 assert.equal(musicSoundSources(s,{x:5.6,y:5})[0].gain,.012);
 const edge=musicSoundSources(s,{x:6.4,y:5})[0];assert.ok(edge.gain>0&&edge.gain<.001);
 assert.equal(musicSoundSources(s,{x:5,y:5,proximity:.5})[0].gain,.006);
});
test('audio listener follows 3D zoom and 2D map pan instead of a fixed town tile',()=>{
 assert.equal(typeof musicAudio.cityAudioListener,'function','the active renderer must provide the real listener');
 const listener=musicAudio.cityAudioListener;
 assert.equal(listener({camera:{target:{x:30,z:42},radius:41.6}}).proximity,0,'default city view is too far');
 assert.equal(listener({camera:{target:{x:30,z:42},radius:240}}).proximity,0,'city overview is too far');
 assert.deepEqual(listener({camera:{target:{x:30,z:42},radius:8}}),{x:5,y:7,proximity:1});
 assert.equal(listener({camera:{target:{x:30,z:42},radius:30}}).proximity,1/3);
 const map={ctx:{},w:800,h:600,ox:400,oy:0,tw:120,th:60,zoom:3.5};
 assert.deepEqual(listener(map),{x:5,y:5,proximity:1});
 assert.deepEqual(listener({...map,ox:280}),{x:6,y:4,proximity:1},'panning shifts the audible courtyard');
 assert.equal(listener({...map,zoom:1.75}).proximity,0,'default 2D view is too far');
 assert.equal(listener({...map,mapOverview:true}).proximity,0);
 assert.equal(listener({}),null,'uninitialised renderer is not a listener');
});
