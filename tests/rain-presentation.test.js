import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createRainPresentation,rainSceneFrame} from '../rain-presentation.js';

test('opening and casting have distinct timelines and bounded lifetimes',()=>{
 assert.equal(rainSceneFrame('opening',0),'waiting');
 assert.equal(rainSceneFrame('opening',6),'drop');
 assert.equal(rainSceneFrame('opening',11),'shadow');
 assert.equal(rainSceneFrame('opening',18),'rain');
 assert.equal(rainSceneFrame('opening',24),null);
 assert.equal(rainSceneFrame('cast',0),'shadow');
 assert.equal(rainSceneFrame('cast',3),'rain');
 assert.equal(rainSceneFrame('cast',10),null);
});

test('cue plays once, skip stops it, and resetting to a loaded harvest does not replay',()=>{
 const {window}=new JSDOM('<main></main>');
 const cues=[],targets=[];
 const scene=createRainPresentation(window.document.querySelector('main'),{
  focus:p=>targets.push(p),cue:p=>{cues.push(p);return ()=>cues.push('stopped');}
 });
 const harvest={field:'12,8',time:80},s={rainDiscovery:{},buildings:[{type:'field',x:12,y:8}]};
 scene.reset(s);
 s.irrigatedHarvest=harvest;
 const snapshot=JSON.stringify(s);
 scene.tick(s,0);
 assert.deepEqual(targets,[{x:12,y:8}]);
 scene.tick(s,6000);scene.tick(s,6100);
 assert.deepEqual(cues,['drop']);
 window.document.querySelector('.rain-scene button').click();
 assert.equal(window.document.querySelector('.rain-scene').hidden,true);
 assert.deepEqual(cues,['drop','stopped']);
 const loaded=structuredClone(s);scene.reset(loaded);scene.tick(loaded,9000);
 assert.equal(window.document.querySelector('.rain-scene').hidden,true);
 assert.equal(JSON.stringify(s),snapshot);
});

test('cast focuses the selected field and skip leaves weather, faith and cooldown intact',()=>{
 const {window}=new JSDOM('<main></main>');
 const targets=[],cues=[];
 const scene=createRainPresentation(window.document.querySelector('main'),{focus:p=>targets.push(p),cue:p=>cues.push(p)&&undefined});
 const s={buildings:[{type:'field',x:12,y:8},{type:'field',x:13,y:9}],rain:2,resources:{faith:15},cooldowns:{rain:2}};
 const before=JSON.stringify(s);
 scene.cast(s,{x:13,y:9},1000);
 assert.deepEqual(targets,[{x:13,y:9}]);
 assert.equal(window.document.querySelector('.rain-scene').dataset.phase,'shadow');
 scene.tick(s,4100);
 assert.deepEqual(cues,['rain']);
 scene.skip();
 assert.equal(JSON.stringify(s),before);
});
