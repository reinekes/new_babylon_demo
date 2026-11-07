import {advanceToNextSeason} from '../season-jump.js';
import {pestActors} from '../pests.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,miracle,advanceTime,decode,encode} from '../engine.js';
import {advanceCatDiscovery} from '../miracle-discovery.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {miracleCelebrationView,startMiracleCelebration} from '../miracle-celebration.js';
import {terrain} from '../world.js';
function afterFirst(){
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}}),c=s.citizens.find(c=>c.age>=16);
 Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,recognitionAt:0,believerIds:[c.id]});Object.assign(c,{calling:'fisher',role:'production'});Object.assign(s.catFishing,{candidateId:c.id,completed:3});s.catFishing.lessons[c.id]=3;
 advanceCatDiscovery(s,.1);s.simTime=60;s.calendarOffset=60;advanceCatDiscovery(s,.1);s.resources.faith=0;assert.equal(miracle(s,'cat').ok,true);assert.equal(s.miracleCelebration.duration,60);advanceTime(s,60);
 s.buildings.push({type:'granary',x:10,y:8,level:1});s.cooldowns.cat=0;s.resources.faith=12;return s;
}
test('paid C01 repeat is an eight-second direct arrival without gathering citizens or advancing the calendar',()=>{
 let s=afterFirst();const time=s.simTime,tick=s.tick;assert.equal(miracle(s,'cat').ok,true);assert.equal(s.miracleCelebration.duration,8);assert.equal(s.resources.faith,0);assert.equal(s.pests.cats.length,2);const people=structuredClone(s.citizens);assert.ok(s.miracleCelebration.participants.every(a=>!a.joined));
 const first=miracleCelebrationView(s).cat;for(let i=0;i<3;i++){advanceTime(s,2);assert.ok(s.miracleCelebration);const v=miracleCelebrationView(s);assert.equal(v.duration,8);assert.ok(Math.abs(v.elapsed-(i+1)*2)<1e-7);assert.ok(v.participants.every(a=>!a.walking&&!a.celebrating));s=decode(encode(s));assert.ok(s);}
 const near=miracleCelebrationView(s).cat;assert.ok(Math.hypot(first.x-near.x,first.y-near.y)>0);advanceTime(s,1.999);assert.ok(s.miracleCelebration);const arrival=miracleCelebrationView(s).cat;advanceTime(s,.001);const residentCat=pestActors(s).find(c=>c.id===arrival.id);assert.ok(Math.hypot(residentCat.x-arrival.x,residentCat.y-arrival.y)<.001);assert.equal(s.miracleCelebration,null);assert.equal(s.simTime,time);assert.equal(s.tick,tick);assert.deepEqual(s.citizens,people);assert.equal(s.pests.cats.length,2);assert.equal(s.catDiscovery.trial,'spent');assert.ok(decode(encode(s)));
});
test('short repeat paths reject a wet destination and cannot be forged into classic or fertility saves',()=>{
 const s=afterFirst();let wet;for(let y=0;y<32&&!wet;y++)for(let x=0;x<40;x++)if(terrain(x,y,s)==='water'){wet={x,y};break;}
 assert.ok(wet);assert.equal(startMiracleCelebration(s,'cat',{catId:s.pests.cats[0].id,catDestination:wet}),false);assert.equal(s.miracleCelebration,null);
 assert.equal(miracle(s,'cat').ok,true);const bad=JSON.parse(encode(s));bad.miracleCelebration.kind='fertility';assert.equal(decode(JSON.stringify(bad)),null);
 const classic=createGame({start:'established'});assert.equal(miracle(classic,'cat').ok,true);assert.equal(classic.miracleCelebration.duration,60);classic.miracleCelebration.duration=8;assert.equal(decode(encode(classic)),null);
});

test('skipping the short repeat changes the season at the same hour without another animal or trial',()=>{
 const s=afterFirst();assert.equal(miracle(s,'cat').ok,true);advanceTime(s,3);const cats=structuredClone(s.pests.cats),next=s.pests.nextCat,time=s.simTime,tick=s.tick;const result=advanceToNextSeason(s);
 assert.equal(result.ok,true);assert.ok(result.skipped.includes('cat'));assert.equal(s.miracleCelebration,null);assert.deepEqual(s.pests.cats,cats);assert.equal(s.pests.nextCat,next);assert.equal(s.catDiscovery.trial,'spent');assert.equal(s.tick,tick+1);assert.equal(s.simTime,time+60);assert.ok(decode(encode(s)));
});
test('a saved single-point short arrival cannot stand in water',()=>{
 const s=afterFirst();assert.equal(miracle(s,'cat').ok,true);let wet;for(let y=0;y<32&&!wet;y++)for(let x=0;x<40;x++)if(terrain(x,y,s)==='water'){wet={x,y};break;}
 assert.ok(decode(encode(s)));s.miracleCelebration.cat.path=[wet];s.miracleCelebration.cat.stroll=[wet];s.miracleCelebration.cat.exit=[wet];assert.equal(decode(encode(s)),null);
});

test('the first C01 arrival invites at most four free adults and keeps busy residents out of the scene',()=>{
 const s=afterFirst();
 const busy=s.citizens[0],child=s.citizens[1],rest=s.citizens.slice(2);
 Object.assign(busy,{age:30,phase:'home',cargo:{food:1}});
 Object.assign(child,{age:10,phase:'home'});
 for(const c of rest)Object.assign(c,{age:30,phase:'home',health:100,cargo:{},buildCargo:{}});
 s.catDiscovery.trial='ready';
 assert.ok(startMiracleCelebration(s,'cat',{catId:s.pests.cats[0].id}));
 const joined=s.miracleCelebration.participants.filter(a=>a.joined);
 assert.equal(joined.length,4);
 assert.ok(joined.every(a=>a.id!==busy.id&&a.id!==child.id));
 const people=structuredClone(s.citizens);
 advanceTime(s,20);
 assert.deepEqual(miracleCelebrationView(s).participants.filter(a=>a.celebrating).map(a=>a.id),joined.map(a=>a.id));
 assert.deepEqual(s.citizens,people);
});
