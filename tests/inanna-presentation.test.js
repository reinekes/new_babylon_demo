import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('the threshold opening and roof marks are skippable without changing the protection',async()=>{
 const {createInannaPresentation}=await import('../inanna-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const store={type:'granary',x:6,y:7},s={inannaDiscovery:{},buildings:[store],sacred:{unlocks:{}},buffs:{inannaProtection:3}};
 const scene=createInannaPresentation(root,{project:p=>p,onOpening:state=>{state.inannaSceneSeen=true;}});
 scene.tick(s,16);
 assert.equal(scene.active,false);
 s.sacred.unlocks.inannaProtection={source:'3,3'};
 scene.tick(s,16);
 assert.equal(scene.active,true);
 assert.equal(s.inannaSceneSeen,true);
 scene.skip();
 scene.cast({stores:[store]});
 scene.tick(s,5000);
 scene.tick(s,16);
 assert.equal(root.querySelector('.inanna-roof-mark').hidden,false);
 const before=structuredClone(s);
 root.querySelector('.inanna-scene button').click();
 scene.tick(s,16);
 assert.deepEqual(s,before);
 assert.equal(root.querySelector('.inanna-roof-mark').hidden,true);
 assert.equal(scene.active,false);
});
