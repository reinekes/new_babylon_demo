import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {createShapingPresentation} from '../shaping-presentation.js';

test('scenes have fixed durations and the marker follows ground stock without changing the batch',()=>{
 const root=new JSDOM('<main/>').window.document.querySelector('main');
 const scene=createShapingPresentation(root,{project:()=>({x:30,y:40})}),s={};
 scene.reset(s);
 s.shapingModel={completedAt:0,x:5,y:6};
 scene.tick(s,34000);
 const panel=root.querySelector('.shaping-scene');
 assert.equal(panel.hidden,false);
 scene.tick(s,0);assert.equal(panel.hidden,true);
 const batch={id:1,x:5,y:6,remaining:{clay:60,reed:40}};
 s.shapingBatches={rows:[batch]};
 scene.cast(batch);scene.tick(s,12000);assert.equal(panel.hidden,false);
 scene.tick(s,0);assert.equal(panel.hidden,true);
 const mark=root.querySelector('.shaping-pile');
 assert.match(mark.textContent,/60/);
 batch.grounded=true;batch.remaining.clay=6;
 const before=JSON.stringify(s);
 scene.tick(s,0);assert.match(mark.textContent,/6/);assert.equal(mark.dataset.grounded,'true');
 assert.equal(JSON.stringify(s),before);
 batch.remaining={clay:0,reed:0};scene.tick(s,0);assert.ok(!root.contains(mark));
});
