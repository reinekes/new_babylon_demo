import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {advanceTrade} from '../trading.js';
import {inviteExternalMaster,advanceExternalGuest,externalGuestView} from '../external-guest.js';
import {networkFor} from '../workforce.js';

function fixture(){
 const s=createGame({start:'established',scenario:strictScenario()});
 s.buildings.push({type:'market',x:10,y:9,level:1});
 s.tick=1;s.year=1;s.season=1;s.simTime=45;advanceTrade(s);
 Object.assign(s.trade.caravan,{phase:'trading',market:'10,9'});
 const pupil=s.citizens.find(c=>c.age>=16);
 Object.assign(pupil,{role:'builder',calling:'builder',phase:'home'});
 const house=s.buildings.find(b=>`${b.x},${b.y}`===pupil.home);
 house.water=10;
 return {s,pupil,house};
}
function step(s,n,until=()=>false){
 for(let i=0;i<n&&!until();i++){advanceExternalGuest(s,.1,networkFor(s));s.simTime+=.1;s.seasonElapsed+=.1;}
}
test('a named visitor walks, consumes provisions and gives lasting practice once',()=>{
 const {s,pupil,house}=fixture(),food=s.resources.food;
 assert.equal(inviteExternalMaster(s).ok,true);
 assert.equal(s.resources.food,food-3);
 assert.equal(inviteExternalMaster(s).ok,false);
 const start=externalGuestView(s);
 step(s,3);assert.notEqual(externalGuestView(s).x,start.x);
 const raw=encode(s),copy=decode(raw);assert.ok(copy);assert.equal(encode(copy),raw);
 step(s,350,()=>s.externalGuest.phase==='departed');
 assert.equal(s.externalGuest.phase,'departed');
 assert.equal(s.externalGuest.outcome,'taught');
 assert.equal(pupil.builderSkill.practice,8);
 assert.equal(house.water,8);
 assert.equal(externalGuestView(s),null);
 step(s,5);assert.equal(pupil.builderSkill.practice,8);
 assert.equal(inviteExternalMaster(s).ok,false);
 assert.ok(decode(encode(s)));
});

test('losing the pupil during arrival returns the unused ration and closes the visit once',()=>{
 const {s,pupil}=fixture(),food=s.resources.food;
 assert.ok(inviteExternalMaster(s).ok);
 step(s,10);
 pupil.role='carrier';
 step(s,100,()=>s.externalGuest.phase==='departed');
 assert.equal(s.externalGuest.phase,'departed');
 assert.equal(s.externalGuest.outcome,'interrupted');
 assert.equal(s.resources.food,food);
 assert.equal(pupil.builderSkill,undefined);
 const copy=decode(encode(s));assert.ok(copy);
 assert.equal(inviteExternalMaster(copy).ok,false);
 assert.equal(copy.news.filter(n=>n.title==='Визит мастера прерван').length,1);
 const bad=structuredClone(copy);bad.externalGuest.progress=4;
 assert.equal(decode(encode(bad)),null);
});

test('the regular game loop advances the visit without adding a resident',async()=>{
 const {advanceTime}=await import('../engine.js');
 const {s,pupil,house}=fixture(),ids=s.citizens.map(c=>c.id);
 house.pantry=40;house.pantryDelivered=40;
 assert.ok(inviteExternalMaster(s).ok);
 for(let i=0;i<180&&s.externalGuest.phase!=='departed';i++)advanceTime(s,.25);
 assert.equal(s.externalGuest.outcome,'taught');
 assert.equal(s.externalGuest.phase,'departed');
 assert.equal(pupil.builderSkill.practice,8);
 assert.deepEqual(s.citizens.map(c=>c.id),ids);
});

test('pilgrim and envoy carry distinct gifts, retain identity on reload and record their outcomes once',async()=>{
 const {advanceTime}=await import('../engine.js');
 const {inviteVisitor,visitorsView}=await import('../external-guest.js');
 const {putStock}=await import('../inventory.js');
 const {templeOfferings}=await import('../votive-offerings.js');
 let {s}=fixture();
 assert.equal(putStock(s,'9,8','cloth',1),1);
 const food=s.resources.food;
 assert.ok(inviteVisitor(s,'pilgrim').ok);
 assert.ok(inviteVisitor(s,'envoy').ok);
 assert.equal(s.resources.food,food-5);assert.equal(s.resources.cloth,0);
 const [pilgrim,envoy]=visitorsView(s);assert.notEqual(pilgrim.id,envoy.id);assert.deepEqual(pilgrim.cargo,{pottery:1});
 advanceTime(s,.5);
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 let carried=false;
 for(let i=0;i<120&&(s.externalVisits.envoy.phase!=='departed'||s.externalVisits.pilgrim.phase!=='departed');i++){
  advanceTime(s,.25);carried||=visitorsView(s).some(p=>p.id===envoy.id&&p.cargo.cloth===1);
 }
 assert.equal(carried,true);
 assert.equal(s.externalVisits.envoy.phase,'departed');assert.equal(s.externalVisits.pilgrim.phase,'departed');
 assert.equal(s.resources.pottery,0);
 assert.equal(templeOfferings(s,'9,8')[0].id,s.externalVisits.pilgrim.offeringId);
 assert.equal(templeOfferings(s,'9,8')[0].donorName,pilgrim.name);
 assert.equal(s.news.filter(n=>n.title==='Посланник увёз ответный дар').length,1);
 assert.equal(s.news.filter(n=>n.title==='Паломник посвятил сосуд').length,1);
 assert.ok(decode(encode(s)));
 assert.equal(inviteVisitor(s,'pilgrim').ok,false);
});
