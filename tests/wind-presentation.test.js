import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createGame,encode} from '../engine.js';
import {createWindPresentation,windSceneFrame,windSceneRoute} from '../wind-presentation.js';

test('wind scene follows a walkable delivery route and finishes at the designed times',()=>{
 assert.deepEqual([0,8,16,24].map(t=>windSceneFrame('opening',t)),['load','trail','receive',null]);
 assert.deepEqual([0,3,6].map(t=>windSceneFrame('cast',t)),['gust','cloth',null]);
 const s=createGame({start:'established'});
 s.windDelivery={amount:60,destinations:['9,8','9,9'],path:{kind:'road',source:'7,7',target:'9,8'}};
 const before=encode(s),scene=windSceneRoute(s);
 assert.deepEqual(scene.source,{x:7,y:7});
 assert.deepEqual(scene.target,{x:9,y:8});
 assert.ok(scene.points.length>2);
 assert.equal(encode(s),before);
});

test('skipping the wind only stops presentation and does not reset its benefit',()=>{
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 const s=createGame({start:'established'});
 s.windDelivery={amount:60,destinations:['9,8','9,9'],path:{kind:'road',source:'7,7',target:'9,8'}};
 s.buffs.haste=3;
 const before=encode(s);
 const focus=[];
 const scene=createWindPresentation(root,{focus:p=>focus.push(p),project:p=>p});
 scene.reset(s);
 scene.cast(s);
 scene.tick(s,1000);
 assert.equal(root.querySelector('.wind-scene').hidden,false);
 assert.ok(root.querySelector('.wind-route path').getAttribute('d'));
 assert.equal(focus.length,1);
 root.querySelector('button').click();
 assert.equal(root.querySelector('.wind-scene').hidden,true);
 assert.equal(encode(s),before);
 dom.window.close();
});
