import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {catchSceneFrame,catchOpeningPoints,createRichCatchPresentation} from '../rich-catch-presentation.js';
import {recordInspiredCatch,newRichCatchEvidence} from '../fish-provenance.js';

test('casting acknowledges the yard briefly, even if no fish ever bites',()=>{
 assert.deepEqual([0,6,12,20,27].map(t=>catchSceneFrame('opening',t)),['unload','share','reflection','still',null]);
 assert.deepEqual([0,1.5,2,5,8].map(t=>catchSceneFrame('cast',t)),['ripple','ripple',null,null,null]);
 const document=new JSDOM('<main></main>').window.document,host=document.querySelector('main');
 const yard={type:'fishing',x:11,y:9},s={buildings:[yard],citizens:[]},sounds=[],views=[];
 const scene=createRichCatchPresentation(host,{focus:p=>views.push(p),project:()=>({x:29,y:41}),cue:p=>{sounds.push(p);}});
 scene.reset(s);scene.cast(s,yard);scene.tick(s,1800);scene.tick(s,16);
 assert.equal(host.querySelector('.catch-yard-ripple').style.left,'29px');
 assert.equal(scene.active,false);assert.deepEqual(views,[]);assert.deepEqual(sounds,['ripple']);
});

test('the scene remembers the yard of the tenth catch after reassignment',()=>{
 const yard={type:'fishing',x:11,y:9},other={type:'fishing',x:12,y:9};
 const fisher={id:0,calling:'fisher',work:'11,9'},s={richCatchEvidence:newRichCatchEvidence(),buildings:[yard,other],citizens:[fisher]};
 for(let i=0;i<10;i++)recordInspiredCatch(s,yard,fisher,5);
 fisher.work='12,9';
 s.richCatchEvidence.homes=['1,2','3,4'];
 const raw=JSON.stringify(s);
 assert.deepEqual(catchOpeningPoints(s),{yard,home:{x:3,y:4},water:{x:12,y:9}});
 assert.equal(JSON.stringify(s),raw);
});
