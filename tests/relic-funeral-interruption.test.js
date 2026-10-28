import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {startFuneral} from '../funerals.js';
import {isDryPoint} from '../world.js';
import {startRelicQuest,orderRelicMove,relicQuestView,interruptRelicForFuneral} from '../relic-quest.js';

function city(){const s=createGame({start:'established'});s.resources.faith=1000;for(const c of s.citizens){Object.assign(c,{age:25,role:'builder',work:null,site:null,phase:'home',cargo:{},buildCargo:{}});delete c.pantryTrip;delete c.waterTrip;}syncCitizens(s);assert.equal(startRelicQuest(s,s.citizens[0].id).ok,true);return s;}
const position=c=>({x:c.x,y:c.y});
test('funeral interruption transitions a swimmer without any artificial movement or elapsed time',()=>{
 const s=city(),id=s.relicQuest.actorId,c=s.citizens.find(c=>c.id===id);assert.equal(orderRelicMove(s,relicQuestView(s).searchPoint).ok,true);
 for(let i=0;i<1600&&isDryPoint(s,c.x,c.y);i++)advanceTime(s,.1);assert.equal(isDryPoint(s,c.x,c.y),false);
 assert.equal(startFuneral(s,[{id:999,name:'Покойный',x:6,y:6}],{family:true}),true);
 const funeral=s.funeral,point=position(c),clock=[s.simTime,s.seasonElapsed,s.tick],resources=structuredClone(s.resources);
 assert.equal(interruptRelicForFuneral(s),true);assert.equal(s.funeral,null);assert.equal(s.relicQuest.deferredFuneral,funeral);assert.equal(s.relicQuest.phase,'returning');assert.equal(s.relicQuest.returnReason,'funeral');assert.deepEqual(position(c),point);assert.deepEqual([s.simTime,s.seasonElapsed,s.tick],clock);assert.deepEqual(s.resources,resources);assert.equal(funeral.timer,0);assert.ok(decode(encode(s)));
 const snapshot=JSON.stringify(s);assert.equal(interruptRelicForFuneral(s),false);assert.equal(JSON.stringify(s),snapshot);
});
test('funeral interruption releases a dry chosen resident and leaves the rite untouched',()=>{
 const s=city(),c=s.citizens.find(c=>c.id===s.relicQuest.actorId);assert.equal(startFuneral(s,[{id:999,name:'Покойный',x:6,y:6}],{family:true}),true);
 const funeral=s.funeral,rite=JSON.stringify(funeral),point=position(c),clock=[s.simTime,s.seasonElapsed,s.tick];assert.equal(interruptRelicForFuneral(s),true);assert.equal(s.relicQuest.phase,'dormant');assert.equal(s.relicQuest.actorId,null);assert.notEqual(c.phase,'relic');assert.equal(s.funeral,funeral);assert.equal(JSON.stringify(funeral),rite);assert.deepEqual(position(c),point);assert.deepEqual([s.simTime,s.seasonElapsed,s.tick],clock);assert.ok(decode(encode(s)));assert.equal(interruptRelicForFuneral(s),false);
});
