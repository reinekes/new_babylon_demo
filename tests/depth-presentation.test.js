import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';

test('depth scenes follow completed delivery and skipping leaves the quest untouched',async()=>{
 const {createDepthPresentation}=await import('../depth-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const state={depthSupply:{},relicQuest:{phase:'carrying',site:{x:3,y:4}}};
 let openings=0;
 const scene=createDepthPresentation(root,{eligible:()=>true,onOpening:()=>openings++,project:p=>p});
 scene.tick(state,16);
 assert.equal(openings,0);
 state.relicQuest.phase='dormant';scene.tick(state,16);
 assert.equal(root.querySelector('.depth-ripple').hidden,false);
 state.relicQuest.phase='completed';scene.tick(state,16);
 assert.equal(openings,1);
 assert.equal(root.querySelector('.depth-ripple').hidden,true);
 const before=structuredClone(state);
 scene.cast();scene.tick(state,16);
 assert.equal(root.querySelector('.depth-scene').dataset.kind,'cast');
 root.querySelector('.depth-scene button').click();
 assert.deepEqual(state,before);
 assert.equal(root.querySelector('.depth-scene').hidden,true);
});

test('the Depths wave follows the supplied canal edges and clears when skipped',async()=>{
 const {createDepthPresentation}=await import('../depth-presentation.js');
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const state={depthSupply:{},relicQuest:{phase:'completed'}};
 const scene=createDepthPresentation(root,{project:p=>p});
 scene.cast({point:{x:10,y:20},edges:[{from:{x:10,y:20},to:{x:30,y:20},distance:1}]});
 scene.tick(state,6000);
 scene.tick(state,16);
 const wave=root.querySelector('.depth-wave');
 assert.equal(wave.hasAttribute('hidden'),false);
 assert.match(wave.querySelector('path').getAttribute('d'),/M10 20L30 20/);
 scene.skip();
 assert.equal(wave.hasAttribute('hidden'),true);
 scene.cast();
 scene.tick(state,6000);
 scene.tick(state,16);
 assert.equal(wave.hasAttribute('hidden'),true);
});
