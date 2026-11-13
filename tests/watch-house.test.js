import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,build,canBuild,canUpgrade,createGame,decode,encode} from '../engine.js';
import {buildingKey,housingOf} from '../definitions.js';
import {strictScenario} from '../scenario-profiles.js';
import {advanceWorkers,invalidateAssignments,networkFor,syncCitizens,visibleCitizens} from '../workforce.js';
import {assignGuard,demolish} from '../management.js';
import {advanceCivicOrder,newCivicOrder} from '../civic-order.js';
import {syncInventory} from '../inventory.js';
import {watchOnDuty,watchOnShift,watchShift} from '../watch-house.js';

const seconds=hour=>(hour+16)%24*2.5;
const key='10,8';
function town({instant=true}={}){
 const s=createGame({start:'established',scenario:strictScenario(),mode:'mature'});
 assert.match(canBuild(s,'watchHouse',10,8),/48/);
 for(let x=2;x<=9;x++)s.buildings.push({type:'house',x,y:4,level:1});
 s.capacity=housingOf(s);s.population=48;
 invalidateAssignments(s);syncCitizens(s);
 s.resources.brick=24;
 const result=build(s,'watchHouse',10,8,0,{instant});
 assert.ok(result.ok,result.reason);
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=10;b.pantryDelivered=10;b.water=10;b.waterDelivered=10;}
 return s;
}

test('residents build the watch house before recruitment and return to ordinary work if it is removed',()=>{
 const s=town({instant:false}),post=()=>s.buildings.find(b=>buildingKey(b)===key),id=s.citizens.find(c=>c.age>=16).id;
 assert.match(assignGuard(s,id,key).reason,/готовый/);
 for(let i=0;i<300&&post().construction;i++){s.event=null;advanceTime(s,.5);}
 assert.equal(post().construction,undefined);
 assert.match(canUpgrade(s,post()),/один уровень/);
 assert.ok(assignGuard(s,id,key).ok);
 assert.ok(demolish(s,post().x,post().y).ok);
 const citizen=s.citizens.find(c=>c.id===id);
 assert.equal(citizen.guardPost,undefined);assert.notEqual(citizen.work,key);assert.ok(decode(encode(s)));
});

test('the watch recruits two living residents and walks real routes at night',()=>{
 let s=town();const people=s.citizens.filter(c=>c.age>=16).slice(0,3),ids=people.map(c=>c.id);
 for(const c of people.slice(0,2))assert.ok(assignGuard(s,c.id,key).ok);
 assert.match(assignGuard(s,people[2].id,key).reason,/заняты/);
 const night=()=>s.citizens.find(c=>c.id===ids[0]),day=()=>s.citizens.find(c=>c.id===ids[1]);
 assert.equal(watchShift(s,night()),'night');assert.equal(watchShift(s,day()),'day');
 assert.equal(watchOnShift('night',seconds(21)),true);
 assert.equal(watchOnShift('night',seconds(1)),true);
 assert.equal(watchOnShift('night',seconds(5)),false);
 const net=networkFor(s),port=net.ports.find(p=>buildingKey(p.building)===key);
 s.simTime=seconds(21);
 const nightHome=net.ports.find(p=>buildingKey(p.building)===night().home);
 Object.assign(night(),{phase:'home',x:nightHome.x,y:nightHome.y});
 for(let i=0;i<120&&night().phase!=='returnWork';i++)advanceWorkers(s,.1);
 assert.equal(night().phase,'returnWork');assert.equal(watchOnDuty(s,night()),true);
 assert.equal(watchOnDuty(s,day()),false);
 assert.ok(night().route.length>=3);
 assert.deepEqual(night().route.at(-1),{x:port.x,y:port.y});
 s.seasonElapsed=s.simTime;
 const raw=encode(s);s=decode(raw);assert.ok(s);assert.equal(encode(s),raw);
 const before={x:night().x,y:night().y};advanceWorkers(s,.3);
 assert.notDeepEqual({x:night().x,y:night().y},before);
 assert.ok(visibleCitizens(s).find(c=>c.id===night().id)?.nightWatch);
 assert.ok(s.footpaths?.length);
 const release=assignGuard(s,night().id,'');assert.ok(release.ok);assert.equal(night().guardPost,undefined);
 const malformed=structuredClone(s);for(const c of malformed.citizens.filter(c=>ids.includes(c.id)))c.guardPost=key;
 assert.equal(decode(encode(malformed)),null);
});

test('a nearby staffed watch post prevents the existing grain theft',()=>{
 const s=town(),[resident,night,day]=s.citizens.filter(c=>c.age>=16);
 assert.ok(assignGuard(s,night.id,key).ok);assert.ok(assignGuard(s,day.id,key).ok);
 const home=s.buildings.find(b=>buildingKey(b)===resident.home),store=s.buildings.find(b=>b.type==='shrine');
 home.pantry=0;resident.hunger=70;resident.mood=30;s.civicOrder=newCivicOrder();syncInventory(s);
 s.civicOrder.case={person:resident.id,name:'Житель',home:resident.home,day:0};s.simTime=120;
 const guard=s.citizens.find(c=>c.id===day.id);
 Object.assign(guard,{work:key,phase:'working',x:10.5,y:8.5});
 const food=store.stock.food;
 advanceCivicOrder(s);
 assert.equal(s.civicOrder.history.length,0);assert.equal(store.stock.food,food);
 guard.phase='home';s.simTime=180;advanceCivicOrder(s);
 assert.equal(s.civicOrder.history[0]?.outcome,'theft');assert.equal(store.stock.food,food-2);
});
