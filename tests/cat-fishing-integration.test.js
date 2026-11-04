import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,decode,encode} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncCitizens,invalidateAssignments} from '../workforce.js';
import {isShore,terrain} from '../world.js';
import {advancePests} from '../pests.js';
const scenario=()=>({...strictScenario(),miracles:CAT_DISCOVERY_RULES});

test('C01 saves roundtrip only with a complete valid ledger and Awakening mode',()=>{
 const s=createGame({mode:'awakening',scenario:scenario()});assert.deepEqual(decode(encode(s)),s);for(const change of [s=>delete s.catFishing,s=>s.catFishing.completed=4,s=>s.godhood.mode='mature']){const bad=JSON.parse(encode(s));change(bad);assert.equal(decode(JSON.stringify(bad)),null);}assert.throws(()=>createGame({mode:'mature',scenario:scenario()}),/scenario/);
});

test('food loss still gifts a cat in classic saves, but never bypasses the C01 fisherman story',()=>{
 for(const c01 of [false,true]){const s=createGame({start:'established',mode:'awakening',...c01?{scenario:scenario()}: {}});s.pests.totalLoss=3;advancePests(s,.1);assert.equal(s.pests.cats.length,c01?0:1);}
});

test('real fishing, local output, porter and warehouse admission carry the same three operations across reload',()=>{
 let s=createGame({start:'established',mode:'awakening',scenario:scenario()});const cells=[];for(let y=1;y<31;y++)for(let x=1;x<39;x++)if(isShore(s,x,y)&&terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))cells.push({x,y});cells.sort((a,b)=>Math.hypot(a.x-9,a.y-8)-Math.hypot(b.x-9,b.y-8));assert.ok(cells.length);
 const b={type:'fishing',...cells[0],level:1};s.buildings.push(b);const fisher=s.citizens.find(c=>c.age>=16);Object.assign(fisher,{role:'production',workplace:`${b.x},${b.y}`});invalidateAssignments(s);syncCitizens(s);
 let sawOutput=false,sawCarrier=false,reloaded=false;
 for(let i=0;i<2400&&s.catFishing.completed<3;i++){
  advanceTime(s,.1);const q=s.catFishing;sawOutput ||= Object.keys(q.flows).some(k=>k.startsWith('output:'));sawCarrier ||= Object.keys(q.flows).some(k=>k.startsWith('cargo:')&&k!==`cargo:${q.candidateId}`);
  if(!reloaded&&(q.pending.some(r=>r.accepted>0)||sawCarrier)){const loaded=decode(encode(s));assert.ok(loaded,'save with fish in physical transit');s=loaded;reloaded=true;}
 }
 assert.ok(sawOutput,'actual fish passed through the workshop output');assert.ok(sawCarrier,'another resident really carried the fish');assert.ok(reloaded);assert.equal(s.catFishing.completed,3,JSON.stringify({ledger:s.catFishing,time:s.simTime,event:s.event,ceremony:s.miracleCelebration?.id,output:s.buildings.find(b=>b.type==='fishing')?.workshopStock,people:s.citizens.map(c=>({id:c.id,work:c.work,phase:c.phase,role:c.role,cargo:c.cargo})),jobs:s.district.jobs}));assert.ok(s.delivered.food>=15);assert.deepEqual(decode(encode(s)),s);
});
