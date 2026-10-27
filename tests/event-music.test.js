import test from 'node:test';
import assert from 'node:assert/strict';
import {createCityAudio,eventMusicTheme} from '../city-audio.js';

const town=()=>({simTime:0,citizens:[],buildings:[]});
function rig(){let now=0;const media=[],messages=[],listeners=new Map();function createMedia(){const el={src:'',preload:'auto',loop:false,volume:1,paused:true,currentTime:0,plays:0,pauses:0,async play(){this.plays++;if(this.reject)throw Error('autoplay denied');this.paused=false;},pause(){this.pauses++;this.paused=true;},addEventListener(name,fn){this[name]=fn;},removeEventListener(){},removeAttribute(){},load(){}};media.push(el);return el;}const doc={hidden:false,addEventListener:(k,f)=>listeners.set(k,f),removeEventListener:(k,f)=>{if(listeners.get(k)===f)listeners.delete(k);}};const old=globalThis.document;globalThis.document=doc;const audio=createCityAudio(t=>messages.push(t),{createMedia,now:()=>now});return {audio,media,messages,doc,step:seconds=>{now+=seconds;},visibility:()=>listeners.get('visibilitychange')?.(),cleanup(){audio.dispose();if(old===undefined)delete globalThis.document;else globalThis.document=old;}};}
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('recorded event music is lazy, streamed, opt-in and crossfades the current theme without replaying past events',async()=>{const r=rig(),s=town();try{r.audio.tick(s,false);assert.equal(r.media.length,0);await r.audio.toggle();r.audio.tick(s,false);await settle();assert.equal(r.media.length,1);const start=r.media[0];assert.match(start.src,/main-theme\.mp3/);assert.equal(start.preload,'none');assert.equal(start.plays,1);r.step(2);r.audio.tick(s,false);assert.ok(start.volume>0&&start.volume<=.2);s.citizens=Array.from({length:24},(_,id)=>({id}));r.audio.tick(s,false);await settle();const grown=r.media.at(-1);assert.match(grown.src,/growing-city\.mp3/);r.step(2);r.audio.tick(s,false);assert.equal(start.paused,true);assert.ok(grown.volume>0);s.simTime=35;r.audio.tick(s,false);await settle();assert.match(r.media.at(-1).src,/night-theme\.mp3/);assert.equal(r.media.filter(m=>!m.paused).length<=2,true);r.audio.tick(s,true);assert.ok(r.media.every(m=>m.paused));s.funeral={stage:'procession',deceased:[{id:9}]};r.audio.tick(s,true);s.funeral=null;s.simTime=0;r.audio.tick(s,false);await settle();assert.match(r.media.findLast(m=>!m.paused).src,/growing-city\.mp3/);assert.equal(r.media.some(m=>m.src.includes('funeral')),false);}finally{r.cleanup();}});

test('funeral themes outrank night and alternate only for a new ceremony',async()=>{const r=rig(),s=town();try{await r.audio.toggle();s.simTime=35;s.funeral={stage:'gathering',deceased:[{id:3}]};r.audio.tick(s,false);await settle();assert.match(r.media.at(-1).src,/funeral-1\.mp3/);s.funeral={...s.funeral,stage:'procession'};r.audio.tick(s,false);assert.equal(r.media.length,1);s.funeral=null;r.audio.tick(s,false);s.funeral={stage:'procession',deceased:[{id:4}]};r.audio.tick(s,false);await settle();assert.match(r.media.at(-1).src,/funeral-2\.mp3/);r.step(2);r.audio.tick(s,false);assert.ok(r.media.filter(m=>!m.paused).length<=1);}finally{r.cleanup();}});

test('lithophone recording requires actual inspired work near camera, ducks background and stops immediately when worker leaves or tab hides',async()=>{const r=rig(),s=town();try{await r.audio.toggle();s.buildings=[{type:'musicHouse',x:5,y:5,level:1}];s.citizens=[{id:1,age:30,role:'production',calling:'musician',work:'5,5',workplace:'5,5',phase:'working',x:5.5,y:5.5,cargo:{}}];r.audio.tick(s,false,{x:5,y:5});await settle();const litho=r.media.find(m=>m.src.includes('lithophone'));assert.ok(litho);r.step(2);r.audio.tick(s,false,{x:5,y:5});assert.ok(litho.volume>0&&litho.volume<=.24);const background=r.media.find(m=>m!==litho);assert.ok(background.volume<.1);s.citizens[0].phase='toWork';r.audio.tick(s,false,{x:5,y:5});assert.equal(litho.paused,true);s.citizens[0].phase='working';r.audio.tick(s,false,{x:5,y:5});await settle();assert.equal(litho.paused,false);r.doc.hidden=true;r.visibility();assert.ok(r.media.every(m=>m.paused));}finally{r.cleanup();}});

test('mute cancels pending play and autoplay rejection is reported once without a tick retry storm',async()=>{const r=rig(),s=town();try{await r.audio.toggle();r.audio.tick(s,false);await settle();const el=r.media[0];await r.audio.toggle();assert.equal(el.paused,true);el.reject=true;await r.audio.toggle();r.audio.tick(s,false);await settle();const plays=el.plays;r.step(2);r.audio.tick(s,false);await settle();assert.equal(el.plays,plays);assert.equal(r.messages.length,1);assert.equal(r.audio.enabled,false);}finally{r.cleanup();}});

test('a pending media play resolving after pause cannot restart an obsolete theme',async()=>{let resolvePlay,paused=0;const el={src:'',volume:0,paused:true,play(){this.paused=false;return new Promise(resolve=>resolvePlay=resolve);},pause(){this.paused=true;paused++;},addEventListener(){},removeAttribute(){},load(){}};const audio=createCityAudio(undefined,{createMedia:()=>el,now:()=>0});try{await audio.toggle();audio.tick(town(),false);audio.tick(town(),true);assert.equal(el.paused,true);resolvePlay();await settle();assert.equal(el.paused,true);assert.ok(paused>=2);assert.deepEqual(audio.status.playing,[]);}finally{audio.dispose();}});

const feast=(occasion='firstBeer')=>({occasion,stage:'celebrating',consumed:true,actors:[{id:1,kind:'guest',stage:'dancing'}]});
test('first beer and Night of Lights recordings wait for an actual feast and guests, including legacy festivals',()=>{
 const s=town();s.festival=feast();
 for(const stage of ['supplying','waiting']){s.festival.stage=stage;assert.equal(eventMusicTheme(s),'main');}
 s.festival.stage='celebrating';s.festival.consumed=false;assert.equal(eventMusicTheme(s),'main');
 s.festival.consumed=true;s.festival.actors[0].stage='arriving';assert.equal(eventMusicTheme(s),'main');
 s.festival.actors[0].stage='dancing';assert.equal(eventMusicTheme(s),'firstBeer');
 s.festival.occasion='nightLights';assert.equal(eventMusicTheme(s),'nightLights');
 delete s.festival.occasion;assert.equal(eventMusicTheme(s),'nightLights');
 s.festival.actors=[];assert.equal(eventMusicTheme(s),'main');
});
test('a real feast outranks ordinary night and growth music while funerals retain their priority',()=>{
 const s=town();s.simTime=35;s.citizens=Array.from({length:24},(_,id)=>({id}));s.festival=feast('nightLights');
 assert.equal(eventMusicTheme(s),'nightLights');s.funeral={stage:'procession',deceased:[{id:9}]};
 assert.equal(eventMusicTheme(s,2),'funeral2');s.funeral.stage='returning';assert.equal(eventMusicTheme(s),'nightLights');
 s.funeral=null;s.festival=null;assert.equal(eventMusicTheme(s),'night');s.simTime=0;assert.equal(eventMusicTheme(s),'grown');
});
test('recorded feasts crossfade, duck near lithophone, stop on pause and resume only the current feast',async()=>{
 const r=rig(),s=town();try{
  s.buildings=[{type:'musicHouse',x:5,y:5,level:1}];s.citizens=[{id:1,age:30,role:'production',calling:'musician',work:'5,5',workplace:'5,5',phase:'working',x:5.5,y:5.5,cargo:{}}];
  r.audio.tick(s,false,{x:5,y:5});assert.equal(r.media.length,0);await r.audio.toggle();r.audio.tick(s,false,{x:5,y:5});await settle();
  s.festival=feast();r.audio.tick(s,false,{x:5,y:5});await settle();assert.equal(r.audio.status.theme,'firstBeer');r.step(2);r.audio.tick(s,false,{x:5,y:5});
  const beer=r.media.find(el=>el.src.includes('first-beer-feast'));assert.ok(beer);assert.ok(beer.volume>0&&beer.volume<.1);assert.equal(r.audio.status.lithophone,true);
  s.funeral={stage:'procession',deceased:[{id:3}]};r.audio.tick(s,false,{x:5,y:5});await settle();assert.equal(r.audio.status.theme,'funeral1');
  s.funeral=null;s.festival=feast('nightLights');r.audio.tick(s,false,{x:5,y:5});await settle();assert.equal(r.audio.status.theme,'nightLights');assert.ok(r.media.filter(el=>!el.paused&&!el.src.includes('lithophone')).length<=2);
  r.audio.tick(s,true,{x:5,y:5});assert.ok(r.media.every(el=>el.paused));r.doc.hidden=true;r.visibility();s.festival=null;r.audio.tick(s,false,{x:5,y:5});assert.deepEqual(r.audio.status.playing,[]);
  r.doc.hidden=false;r.audio.tick(s,false,{x:5,y:5});await settle();assert.equal(r.audio.status.theme,'main');assert.ok(r.media.filter(el=>!el.paused).every(el=>!el.src.includes('feast')&&!el.src.includes('night-lights')));
 }finally{r.cleanup();}
});
test('a feast that ended while muted never fetches or replays its recording',async()=>{
 const r=rig(),s=town();try{s.festival=feast();r.audio.tick(s,false);s.festival=null;r.audio.tick(s,false);await r.audio.toggle();r.audio.tick(s,false);await settle();assert.equal(r.audio.status.theme,'main');assert.equal(r.media.length,1);assert.match(r.media[0].src,/main-theme/);}finally{r.cleanup();}
});
