import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {abundanceSceneFrame,createAbundancePresentation} from '../abundance-presentation.js';

test('Abundance shows three deliveries and reveals the accepted amount only after filling',()=>{
 assert.deepEqual([0,5,10,15,21,26].map(t=>abundanceSceneFrame('opening',t)),['first','second','third','measure','grains',null]);
 assert.deepEqual([0,2,6,7.5,9].map(t=>abundanceSceneFrame('cast',t)),['empty','fill','accepted','grain',null]);
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 const s={buildings:[{type:'house',x:2,y:2},{type:'house',x:3,y:2},{type:'house',x:4,y:2},{type:'depot',x:5,y:2}],
  abundanceDiscovery:{homes:['2,2','3,2','4,2']},abundanceGift:{last:{store:'5,2',amount:27,at:2}}};
 const points=[],scene=createAbundancePresentation(root,{focus:p=>points.push(p)});
 const panel=root.querySelector('.abundance-scene');
 scene.reset({...s,abundanceDiscovery:{homes:[]}});
 const before=JSON.stringify(s);
 for(const dt of [5000,5000,5000,11000,0])scene.tick(s,dt);
 assert.deepEqual(points.map(p=>p.x),[2,3,4]);
 assert.ok(panel.hidden);
 scene.cast(s);
 scene.tick(s,6000);
 assert.ok(!panel.textContent.includes('27'));
 scene.tick(s,0);
 assert.match(panel.textContent,/27/);
 assert.equal(points.at(-1).x,5);
 panel.querySelector('button').click();
 assert.ok(panel.hidden);
 assert.equal(JSON.stringify(s),before);
 dom.window.close();
});
