import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorkAudio,waterWorkSource} from '../work-audio.js';

test('only the nearest real water filling is audible at close zoom',()=>{
 const s={citizens:[{id:1,x:4,y:4,waterTrip:{phase:'deliver'}},{id:2,x:5,y:4,waterTrip:{phase:'fill'}},{id:3,x:4.2,y:4,waterTrip:{phase:'fill'}}]};
 assert.equal(waterWorkSource(s,{x:4,y:4,proximity:1}).id,3);
 assert.equal(waterWorkSource(s,{x:4,y:4,proximity:0}),null);
 assert.equal(waterWorkSource(s,{x:20,y:20,proximity:1}),null);
});

test('the local effect uses one voice and stops on pause without scheduling missed work',()=>{
 const voices=[];
 const context={sampleRate:8000,currentTime:1,destination:{},resume(){},createBuffer(_,n){return {getChannelData:()=>new Float32Array(n)};},
  createGain(){return {gain:{value:0},connect(){},disconnect(){}};},
  createBufferSource(){const node={connect(){},disconnect(){},start(){this.playing=true;},stop(){this.playing=false;}};voices.push(node);return node;}};
 const audio=createWorkAudio(()=>context),c={id:1,x:4,y:4,waterTrip:{phase:'fill'}},s={citizens:[c]},listener={x:4,y:4,proximity:1};
 audio.tick(s,false,listener);assert.equal(voices.length,0);
 audio.enable();audio.tick(s,false,listener);audio.tick(s,false,listener);
 assert.equal(voices.length,1);
 audio.tick(s,true,listener);assert.equal(voices[0].playing,false);
 audio.tick(s,false,listener);assert.equal(voices.length,1);
 c.waterTrip={phase:'fill'};
 audio.tick(s,false,listener);assert.equal(voices.length,2);
 audio.silence();assert.ok(voices.every(v=>!v.playing));
});
