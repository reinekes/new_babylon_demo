import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('the star scenes can be skipped while map signs follow live forecasts',async()=>{
 const {createStarPresentation}=await import('../star-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const state={starObservations:{forecast:{tick:2,targets:[]}},tick:2};
 let rows=[{kind:'food',x:2,y:4,title:'Нехватка еды'}],openings=0;
 const view=createStarPresentation(root,{ready:()=>true,onOpening:()=>openings++,forecasts:()=>rows,project:p=>p});
 view.tick(state,16);
 const panel=root.querySelector('.star-scene');
 assert.equal(panel.dataset.kind,'opening');
 assert.equal(openings,1);
 assert.equal(root.querySelector('.star-mark').dataset.kind,'food');
 view.cast();view.tick(state,16);
 assert.equal(panel.dataset.kind,'cast');
 panel.querySelector('button').click();
 rows=[];view.tick(state,300);
 assert.equal(root.querySelector('.star-mark'),null);
 assert.equal(panel.hidden,true);
 assert.equal(openings,1);
});
