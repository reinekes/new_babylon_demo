import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {createRevelationPresentation} from '../revelation-presentation.js';

function fixture(){
 const root=new JSDOM('<main></main>').window.document.querySelector('main');
 const focus=[],done=[];
 const scene=createRevelationPresentation(root,{focus:point=>focus.push(point),onAdvice:()=>done.push(true)});
 const s={citizens:[{id:1,x:2,y:3}],revelationEvidence:{family:{x:1,y:2,time:0},building:{x:2,y:3,time:0},food:{x:3,y:4,time:0}}};
 return {scene,s,focus,done,panel:root.querySelector('.revelation-scene')};
}

test('the opening waits for visibility, uses the three recorded places and never rewrites the city',()=>{
 const {scene,s,panel,focus}=fixture();
 scene.reset(s);
 s.revelationEvidence.opening={citizenId:1,time:1};
 const before=JSON.stringify(s);
 scene.tick(s,0,{allowOpening:false});
 assert.ok(panel.hidden);
 scene.tick(s,6000);assert.equal(panel.dataset.phase,'first');
 scene.tick(s,6000);assert.equal(panel.dataset.phase,'second');
 scene.tick(s,18000);assert.equal(panel.dataset.phase,'third');
 scene.tick(s,0);assert.ok(panel.hidden);
 assert.deepEqual(focus.map(p=>[p.x,p.y]),[[1,2],[2,3],[3,4]]);
 assert.equal(JSON.stringify(s),before);
 scene.reset(s);scene.tick(s,0);assert.ok(panel.hidden);
});

test('paid scene lasts seven seconds and only actual advice opens the overview',()=>{
 const {scene,s,panel,done}=fixture();
 s.revelationEvidence.opening={citizenId:1,time:1};
 scene.reset(s);
 const note={branch:'haste',x:5,y:7,citizenId:9,time:2};
 scene.cast(s,note);scene.tick(s,7000);
 assert.ok(!panel.hidden);
 scene.tick(s,0);assert.ok(panel.hidden);assert.equal(done.length,1);
 scene.cast(s,null);scene.tick(s,0);panel.querySelector('button').click();assert.equal(done.length,1);
 scene.cast(s,note);scene.tick(s,0);panel.querySelector('button').click();assert.equal(done.length,2);
 scene.cast(s,note);scene.reset(s);assert.equal(done.length,2);
});
