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

test('only a free adult near the selected field reacts, then loses the pose if assigned a delivery',()=>{
 const {window}=new JSDOM('<main></main>');
 const scene=createRainPresentation(window.document.querySelector('main'));
 const citizen=(id,x,extra={})=>({id,x,y:8.5,age:24,phase:'resting',...extra});
 const busy=citizen(1,10.6,{cargo:{food:2}}),child=citizen(2,10.8,{age:12}),free=citizen(3,11);
 const s={buildings:[{type:'field',x:12,y:8}],citizens:[busy,child,free]};
 const before=JSON.stringify(s);
 scene.cast(s,{x:12,y:8},0);
 scene.tick(s,3100);
 assert.deepEqual(scene.reaction,{id:3,phase:'cover'});
 scene.tick(s,5200);
 assert.deepEqual(scene.reaction,{id:3,phase:'laugh'});
 assert.equal(JSON.stringify(s),before);
 free.phase='toStore';
 scene.tick(s,5400);
 assert.equal(scene.reaction,null);
 scene.skip();
 assert.equal(scene.reaction,null);
});
