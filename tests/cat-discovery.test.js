import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode,miracle,advanceTime} from '../engine.js';
import * as discovery from '../miracle-discovery.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {syncInventory} from '../inventory.js';
function ready(){
 const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}}),c=s.citizens.find(c=>c.age>=16);
 Object.assign(c,{calling:'fisher',role:'production'});s.catFishing.lessons[c.id]=3;s.catFishing.candidateId=c.id;s.catFishing.completed=3;
 Object.assign(s.godhood,{stage:'recognized',witnessId:c.id,recognitionAt:0,believerIds:[c.id]});return {s,c};
}
test('offering uses one actual surplus food, eyes wait for night and the morning opens one trial without an animal',()=>{
 let {s,c}=ready();const before=s.resources.food;discovery.advanceCatDiscovery(s,.1);
 assert.equal(s.catDiscovery.phase,'offering');assert.equal(s.catDiscovery.initiatorId,c.id);assert.equal(s.catDiscovery.offering.kind,'food');assert.equal(s.resources.food,before-1);assert.equal(s.pests.cats.length,0);
 s=decode(encode(s));assert.ok(s);s.simTime=30;s.calendarOffset=30;discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'eyes');
 s.simTime=55;s.calendarOffset=55;discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'opened');assert.equal(s.catDiscovery.trial,'ready');assert.equal(s.pests.cats.length,0);
 for(let i=0;i<10;i++){s=decode(encode(s));assert.ok(s);discovery.advanceCatDiscovery(s,.1);}assert.equal(s.resources.food,before-1);assert.equal(s.catDiscovery.trial,'ready');
});
test('no surplus or water means waiting; a real bowl of household water can replace food',()=>{
 const {s}=ready();for(const b of s.buildings){if(b.stock)b.stock.food=0;if(b.type==='house')b.water=0;}s.resources.food=0;syncInventory(s);
 discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'learning');const home=s.buildings.find(b=>b.type==='house');home.water=2;
 discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'offering');assert.equal(s.catDiscovery.offering.kind,'water');assert.equal(home.water,1);assert.equal(s.resources.food,0);
});
test('an offering survives its initiator death and a whole-day jump; opening remains permanent after the store disappears',()=>{
 const {s,c}=ready();discovery.advanceCatDiscovery(s,.1);s.citizens=s.citizens.filter(v=>v!==c);s.simTime=60;discovery.advanceCatDiscovery(s,.1);
 assert.equal(s.catDiscovery.phase,'opened');assert.equal(s.catDiscovery.initiatorId,c.id);s.buildings=s.buildings.filter(b=>!['shrine','granary','depot'].includes(b.type));discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.trial,'ready');assert.equal(s.pests.cats.length,0);
});
test('unaccepted calling, unfinished training and a busy ceremony cannot start an offering',()=>{
 for(const change of [(s,c)=>c.pendingRole='production',(s,c)=>s.catFishing.lessons[c.id]=2,(s)=>s.festival={}]){const {s,c}=ready();change(s,c);const food=s.resources.food;discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'learning');assert.equal(s.resources.food,food);}
});

function opened(){const {s,c}=ready();discovery.advanceCatDiscovery(s,.1);s.simTime=60;s.calendarOffset=60;discovery.advanceCatDiscovery(s,.1);s.resources.faith=0;return {s,c};}
test('a ready trial costs zero faith, creates exactly one cat and cannot repeat through save or ceremony completion',()=>{
 let {s}=opened();assert.equal(miracle(s,'cat').ok,true);assert.equal(s.resources.faith,0);assert.equal(s.catDiscovery.trial,'spent');assert.equal(s.catDiscovery.usedAt,60);assert.equal(s.pests.cats.length,1);assert.equal(s.miracleCount,1);
 s=decode(encode(s));assert.ok(s);assert.equal(miracle(s,'cat').ok,false);advanceTime(s,60);assert.equal(s.pests.cats.length,1);assert.equal(s.catDiscovery.trial,'spent');
 s.cooldowns.cat=0;s.buildings.push({type:'granary',x:10,y:8,level:1});assert.equal(miracle(s,'cat').ok,false);s.resources.faith=12;assert.equal(miracle(s,'cat').ok,true);assert.equal(s.resources.faith,0);assert.equal(s.pests.cats.length,2);assert.equal(s.miracleCount,2);
});
test('a blocked target or cooldown leaves the trial untouched; discovery survives loss of builders and recognition',()=>{
 for(const change of [s=>s.cooldowns.cat=1,s=>s.buildings=s.buildings.filter(b=>!['shrine','granary','depot'].includes(b.type)),s=>s.festival={}]){const {s}=opened();change(s);assert.equal(miracle(s,'cat').ok,false);assert.equal(s.catDiscovery.trial,'ready');assert.equal(s.pests.cats.length,0);assert.equal(s.miracleCount,0);}
 const {s}=opened();s.godhood.stage='unseen';s.godhood.believerIds=[];assert.equal(miracle(s,'cat').ok,true);assert.equal(miracle(s,'fertility').ok,false);
});
test('normal simulation advances the discovery clock instead of requiring a UI action',()=>{
 const {s}=ready();advanceTime(s,.1);assert.equal(s.catDiscovery.phase,'offering');advanceTime(s,30);assert.equal(s.catDiscovery.phase,'eyes');
});
test('saved discovery rejects fabricated chronology, missing charge, invalid trace and altered offering',()=>{
 const {s}=opened();assert.ok(decode(encode(s)));
 for(const change of [q=>q.eyesAt=0,q=>q.openedAt=0,q=>q.trial='locked',q=>q.trace.x=-1,q=>q.offering.amount=2,q=>q.initiatorId=-1,q=>q.usedAt=0]){
  const bad=JSON.parse(encode(s));change(bad.catDiscovery);assert.equal(decode(JSON.stringify(bad)),null);
 }
});
test('one offering can use real fractional surplus from several stores without spending household water',()=>{
 const {s}=ready(),template=structuredClone(s.buildings.find(b=>b.stock).stock);for(const k of Object.keys(template))template[k]=0;
 for(const b of s.buildings){if(b.stock)b.stock.food=0;if(b.type==='house')b.water=2;}
 for(let i=0;i<70;i++)s.buildings.push({type:'granary',level:1,x:20+i%10,y:20+Math.floor(i/10),stock:{...template,food:.9}});
 s.resources.food=63;syncInventory(s);const water=s.buildings.filter(b=>b.type==='house').reduce((n,b)=>n+b.water,0),food=s.resources.food;
 discovery.advanceCatDiscovery(s,.1);assert.equal(s.catDiscovery.phase,'offering');assert.equal(s.catDiscovery.offering.kind,'food');assert.ok(Math.abs(s.resources.food-(food-1))<1e-7);assert.equal(s.buildings.filter(b=>b.type==='house').reduce((n,b)=>n+b.water,0),water);
 assert.ok(Object.keys(s.catDiscovery.offering.sources).length>=2);assert.ok(Math.abs(Object.values(s.catDiscovery.offering.sources).reduce((a,b)=>a+b,0)-1)<1e-7);
});
test('discovery scenery is a read-only ground-bound trace with eyes only at night and no animal',()=>{
 const {s}=ready();discovery.advanceCatDiscovery(s,.1);let before=encode(s),v=discovery.catDiscoveryView(s);assert.ok(v);assert.equal(v.bowl,'food');assert.equal(v.eyes,false);assert.deepEqual(v.tracks,[]);assert.equal(encode(s),before);
 s.simTime=30;s.calendarOffset=30;discovery.advanceCatDiscovery(s,.1);v=discovery.catDiscoveryView(s);assert.equal(v.eyes,true);
 s.simTime=55;s.calendarOffset=55;discovery.advanceCatDiscovery(s,.1);before=encode(s);v=discovery.catDiscoveryView(s);assert.equal(v.eyes,false);assert.ok(v.tracks.length>0);assert.equal(encode(s),before);assert.equal(s.pests.cats.length,0);
 s.buildings.push({type:'house',x:Math.round(v.x),y:Math.round(v.y),level:1});assert.equal(discovery.catDiscoveryView(s),null);assert.equal(s.catDiscovery.trial,'ready');assert.equal(discovery.catDiscoveryView(createGame()),null);
});
