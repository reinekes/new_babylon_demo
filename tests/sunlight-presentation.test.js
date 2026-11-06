import assert from 'node:assert/strict';
import test from 'node:test';
import {JSDOM} from 'jsdom';
import {createSunlightPresentation,sunlightVessel} from '../sunlight-presentation.js';

function fixture(){
 const dom=new JSDOM('<main></main>'),root=dom.window.document.querySelector('main');
 const shrine={type:'shrine',x:5,y:6,level:1},depot={type:'depot',x:4,y:4,level:1};
 const priest={id:2,age:30,calling:'priest',role:'production',work:'5,6',workplace:'5,6',phase:'working'};
 const s={buildings:[depot,shrine],citizens:[priest],buffs:{sunlight:2},godhood:{witnessId:9},sunlightService:{temple:'5,6'}};
 const focus=[],scene=createSunlightPresentation(root,{focus:b=>focus.push(b),project:()=>({x:10,y:20})});
 return {root,s,scene,focus,shrine,depot,priest};
}

test('opening follows the actual gathering, lasts 32 seconds and leaves state intact',()=>{
 const {s,root,scene,focus,depot,shrine}=fixture();
 s.sunlightChapter=1;
 s.votiveOfferings=[1,2,3].map(id=>({id,donorId:id,donorHome:`${id},1`,temple:'5,6',receivedTick:id}));
 scene.reset(s);
 s.sunlightMeal={depot:'4,4'};
 const state=JSON.stringify(s),panel=root.querySelector('.sunlight-scene');
 scene.tick(s,0,{allowOpening:false});assert.ok(panel.hidden);
 scene.tick(s,6000);assert.deepEqual(focus,[depot]);
 scene.tick(s,26000);assert.deepEqual(focus,[depot,shrine]);
 scene.tick(s,0);assert.ok(panel.hidden);
 assert.equal(JSON.stringify(s),state);
 scene.reset(s);scene.tick(s,0);assert.ok(panel.hidden);
});

test('cast clears on skip and the glow follows real priest service and the buff',()=>{
 const {s,root,scene,priest}=fixture();
 scene.cast(s);scene.tick(s,8000);
 const panel=root.querySelector('.sunlight-scene'),glow=root.querySelector('.sunlight-glow');
 assert.ok(!panel.hidden&&!glow.hidden);
 scene.tick(s,0);assert.ok(panel.hidden);
 scene.cast(s);scene.tick(s,0);panel.querySelector('button').click();assert.ok(panel.hidden);
 priest.phase='home';scene.tick(s,0);assert.ok(glow.hidden);
 priest.phase='working';s.buffs.sunlight=0;scene.tick(s,0);assert.ok(glow.hidden);
});

test('only actual delivered vessels can take the brightest reflection',()=>{
 const {s,shrine}=fixture();
 const earlier={id:1,temple:'5,6',receivedTick:2,donorId:4};
 const witness={id:2,temple:'5,6',receivedTick:3,donorId:9};
 s.votiveOfferings=[witness,earlier,{id:3,temple:'5,6',receivedTick:null,donorId:9}];
 assert.equal(sunlightVessel(s,shrine),witness);
 s.godhood.witnessId=0;assert.equal(sunlightVessel(s,shrine),earlier);
 assert.equal(sunlightVessel(s,{x:0,y:0}),undefined);
});
