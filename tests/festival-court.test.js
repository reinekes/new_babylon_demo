import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {syncInventory} from '../inventory.js';
import {networkFor,routeBetween} from '../workforce.js';
import {navigationSegmentClear} from '../navigation.js';
import {isDryPoint} from '../world.js';
import {festivalCourtLayout} from '../festival-layout.js';
import {orderFestival,cancelFestival,advanceFestival,festivalCitizenView,festivalView,festivalSummary,validateFestival} from '../festival.js';
import {testingCity,brewingCity,advanceUntil,clockOf,reloadCity} from './helpers/testing-ceremonies.js';

function suppliedCity(){
 const s=createGame({start:'established'});Object.assign(s.resources,{prestige:100,beer:20,food:100});syncInventory(s);
 for(const c of s.citizens){Object.assign(c,{age:25,role:'carrier',work:null,phase:'home',cargo:{},buildCargo:{}});delete c.pantryTrip;delete c.waterTrip;}
 assert.ok(orderFestival(s).ok);
 for(let i=0;i<1000&&s.festival.stage==='supplying';i++){advanceFestival(s,.1);s.simTime+=.1;}
 assert.equal(s.festival.stage,'waiting');return s;
}
function gatheredCity(){
 const s=suppliedCity();s.simTime=32.5;
 for(const c of s.citizens)Object.assign(c,{phase:'home',mealEaten:.8});
 for(let i=0;i<200&&s.festival.stage!=='celebrating';i++){advanceFestival(s,.1);s.simTime+=.1;}
 assert.equal(s.festival.stage,'celebrating');advanceFestival(s,3,{ceremony:true});return s;
}

test('festival guests walk to one shared courtyard instead of twelve distant road tiles',()=>{
 const s=gatheredCity(),guests=s.festival.actors.filter(a=>a.kind==='guest');
 assert.ok(guests.length>=8);
 assert.equal(new Set(guests.map(a=>a.route.at(-1).key)).size,1);
 assert.ok(guests.every(a=>a.stage==='dancing'));
});

test('arrived guests have compact dry separate places facing the feast without changing saved people or cargo',()=>{
 const s=gatheredCity(),before=encode(s),view=festivalView(s),people=s.festival.actors.filter(a=>a.kind==='guest').map(a=>s.citizens.find(c=>c.id===a.id)).filter(c=>!festivalCitizenView(s,c).festivalTorch);
 const contacts=people.map(c=>festivalCitizenView(s,c).festivalContact);
 assert.ok(view.court,'the 3D court and people need the same anchor');
 assert.ok(contacts.every(Boolean),'every arrived guest needs a safe courtyard place');
 for(const [i,p]of contacts.entries()){
  assert.ok(isDryPoint(s,p.x,p.y));assert.ok(navigationSegmentClear(s,view.court,p));
  assert.ok(Math.hypot(p.x-view.court.x,p.y-view.court.y)<=.681);
  assert.ok(Math.hypot(p.x-view.court.x,p.y-view.court.y)>=.48,'the food and torches stay clear');
  assert.ok(Math.abs(Math.atan2(Math.sin(p.yaw-Math.atan2(view.court.x-p.x,view.court.y-p.y)),Math.cos(p.yaw-Math.atan2(view.court.x-p.x,view.court.y-p.y))))<1e-8);
  for(const q of contacts.slice(0,i))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=.149,'neighbouring guests cannot overlap');
 }
 assert.deepEqual(contacts,people.map(c=>festivalCitizenView(s,c).festivalContact));
 assert.equal(encode(s),before,'render geometry cannot move identities, loads, routes or reservations');
});

test('Night of Lights gives two or three real guests torches and dry street patrols instead of copying residents',()=>{
 const s=gatheredCity(),net=networkFor(s),ids=s.citizens.map(c=>c.id),actorIds=s.festival.actors.map(a=>a.id),clock=clockOf(s),resources=structuredClone(s.resources),positions=[];
 for(const elapsed of [0,1,5,12,27,60,89]){
  s.festival.elapsed=elapsed;const before=encode(s),views=s.citizens.map(c=>({id:c.id,...festivalCitizenView(s,c)})),walkers=views.filter(v=>v.festivalTorch);
  assert.ok(walkers.length>=2&&walkers.length<=3,'a few real arrived guests carry the lights');
  for(const v of walkers){
   assert.ok(actorIds.includes(v.id));assert.equal(v.walking,true);assert.equal(v.celebrating,false);assert.equal(v.festivalContact,undefined);
   const p=v.eventContact,from=net.nodes.get(p.fromKey),to=net.nodes.get(p.toKey);
   assert.ok(from&&to&&net.graph.get(from.key).has(to.key),'walking stays on a real street graph edge');
   assert.ok(isDryPoint(s,p.x,p.y));assert.ok(navigationSegmentClear(s,from,to));
   assert.ok(Math.hypot(p.x-festivalView(s).court.x,p.y-festivalView(s).court.y)<=2.61);
   assert.ok(Math.abs(Math.hypot(p.x-from.x,p.y-from.y)+Math.hypot(p.x-to.x,p.y-to.y)-Math.hypot(to.x-from.x,to.y-from.y))<1e-7,'the shown person lies on the safe edge');
  }
  positions.push(walkers.map(v=>[v.id,v.eventContact.x,v.eventContact.y]));
  assert.equal(encode(s),before,'rendering cannot move people or touch the saved festival ledger');
 }
 assert.notDeepEqual(positions[0],positions[2],'the torchbearers actually walk over ceremony time');
 assert.deepEqual(s.citizens.map(c=>c.id),ids);assert.deepEqual(clockOf(s),clock);assert.deepEqual(s.resources,resources);
});

test('torch patrols freeze with ceremony time and retain the same people and route after reload',()=>{
 const s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);s.festival.elapsed=17.25;
 const views=state=>state.citizens.map(c=>({id:c.id,...festivalCitizenView(state,c)})).filter(v=>v.festivalTorch),before=views(s);
 assert.ok(before.length>=2);assert.deepEqual(views(s),before,'redrawing paused time must not advance a patrol');
 const restored=decode(encode(s));assert.ok(restored);assert.deepEqual(views(restored),before,'save/load does not change torchbearer identities or their route');
 const clock=clockOf(s);advanceTime(s,4);assert.ok(Math.abs(s.festival.elapsed-21.25)<1e-7);assert.notDeepEqual(views(s),before);assert.deepEqual(clockOf(s),clock);
});

test('the first-beer gathering and guests who are still arriving never receive Night of Lights torches',()=>{
 const s=brewingCity();assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));advanceTime(s,3);
 assert.ok(s.citizens.every(c=>!festivalCitizenView(s,c).festivalTorch));
 const q=gatheredCity();for(const a of q.festival.actors)a.stage='arriving';
 assert.ok(q.citizens.every(c=>!festivalCitizenView(q,c).festivalTorch));
});

test('the feast lasts ninety ceremony seconds across reload while the calendar and goods stay frozen',()=>{
 let s=testingCity();assert.ok(orderFestival(s).ok);assert.ok(advanceUntil(s,state=>state.festival?.stage==='celebrating'));
 const clock=clockOf(s),resources=structuredClone(s.resources),needs=s.citizens.map(c=>[c.hunger,c.thirst]);
 advanceTime(s,30);assert.ok(s.festival,'twelve seconds cannot silently end the party');assert.deepEqual(clockOf(s),clock);
 s=reloadCity(s);assert.ok(s);advanceTime(s,58);assert.ok(s.festival,'late arrivals still leave time to see the dance');
 assert.deepEqual(clockOf(s),clock);assert.deepEqual(s.resources,resources);assert.deepEqual(s.citizens.map(c=>[c.hunger,c.thirst]),needs);
 const left=90-s.festival.elapsed;advanceTime(s,left-.01);assert.ok(s.festival);advanceTime(s,.011);assert.equal(s.festival,null);
 assert.ok(Math.abs(s.simTime-clock.simTime)<.002,'only the fraction after the feast may resume city time');assert.ok(decode(encode(s)));
});

test('old distant dancers retain their saved place rather than teleporting into the new courtyard',()=>{
 const s=gatheredCity(),a=s.festival.actors.find(a=>a.kind==='guest'),net=networkFor(s),start=a.route.at(-1),center=net.ports.find(p=>`${p.building.x},${p.building.y}`===s.festival.temple);
 const target=[...net.nodes.values()].find(p=>Math.hypot(p.x-center.x,p.y-center.y)>1.5&&Math.hypot(p.x-center.x,p.y-center.y)<=2&&routeBetween(s,start.key,p.key));
 assert.ok(target);a.route.push(...routeBetween(s,start.key,target.key).slice(1).map(p=>({x:p.x,y:p.y,key:p.key})));a.routeIndex=a.route.length;
 const c=s.citizens.find(c=>c.id===a.id);Object.assign(c,{x:target.x,y:target.y});
 assert.ok(validateFestival(s),'legacy two-tile destination remains accepted');
 s.tick=Math.floor(s.simTime/45);s.season=s.tick%4;s.year=1+Math.floor(s.tick/4);s.seasonElapsed=s.simTime-s.tick*45;
 const before=encode(s),position={x:c.x,y:c.y};assert.equal(festivalCitizenView(s,c).festivalContact,undefined);
 assert.deepEqual({x:c.x,y:c.y},position);assert.equal(encode(s),before);
 const restored=decode(before);assert.ok(restored,'a former scattered party still loads');
 assert.equal(festivalCitizenView(restored,restored.citizens.find(p=>p.id===c.id)).festivalContact,undefined);
});

test('a full twenty-four-person courtyard keeps the dishes, buildings and neighbouring residents clear',()=>{
 const s=createGame({start:'established'}),layout=festivalCourtLayout(s,networkFor(s),'9,8'),places=layout.places.slice(0,24);
 assert.equal(places.length,24);
 for(const [i,p]of places.entries()){
  assert.ok(isDryPoint(s,p.x,p.y));assert.ok(navigationSegmentClear(s,layout.center,p));
  for(const q of places.slice(0,i))assert.ok(Math.hypot(p.x-q.x,p.y-q.y)>=.149);
 }
 for(const [dx,dy]of [[-.40,-.24],[.40,-.24],[.40,.24],[-.40,.24]])assert.ok(navigationSegmentClear(s,layout.center,{x:layout.center.x+dx,y:layout.center.y+dy}),'the entire serving mat and hearth area stays outside buildings');
});

test('a newly blocked shoreline courtyard is recomputed on the current walking network',()=>{
 const s=createGame({start:'established'}),original=festivalCourtLayout(s,networkFor(s),'9,8');
 s.world.lakes=[...s.world.lakes,{id:'shoreline-fixture',cells:[{x:11,y:8}]}];
 const next=festivalCourtLayout(s,networkFor(s),'9,8');assert.ok(next);assert.notEqual(next.center.key,original.center.key);
 assert.ok(next.places.length>=24);
 for(const p of next.places){assert.ok(isDryPoint(s,p.x,p.y));assert.ok(navigationSegmentClear(s,next.center,p));}
});

test('a fully built-up courtyard refuses guests, explains the missing space and refunds the untouched reservation',()=>{
 const s=suppliedCity(),occupied=new Set(s.buildings.map(b=>`${b.x},${b.y}`));
 for(let y=4;y<=12;y++)for(let x=5;x<=13;x++)if(!occupied.has(`${x},${y}`))s.buildings.push({type:'house',x,y,level:1});
 assert.equal(festivalCourtLayout(s,networkFor(s),s.festival.temple),null,'there is no dry apron large enough for the serving mat');
 s.simTime=32.5;for(const c of s.citizens)Object.assign(c,{phase:'home',mealEaten:.8});
 const reserved=structuredClone(s.festival.allocations),delivered=structuredClone(s.festival.delivered),before={food:s.resources.food,beer:s.resources.beer,prestige:s.resources.prestige};
 advanceFestival(s,1);assert.equal(s.festival.stage,'waiting');assert.deepEqual(s.festival.actors,[]);
 assert.equal(festivalSummary(s).progress.code,'noCourtyard');assert.match(festivalSummary(s).progress.text,/свободн.*площадк/i);
 assert.deepEqual(s.festival.allocations,reserved);assert.deepEqual(s.festival.delivered,delivered);
 assert.deepEqual({food:s.resources.food,beer:s.resources.beer,prestige:s.resources.prestige},before);
 assert.ok(cancelFestival(s).refunded);assert.equal(s.resources.food,100);assert.equal(s.resources.beer,20);assert.equal(s.resources.prestige,100);
 assert.ok(s.citizens.every(c=>c.phase!=='festival'));
});

test('the first-cup server returns to ordinary life when the brewery has no safe gathering apron',()=>{
 const s=brewingCity();assert.ok(advanceUntil(s,state=>state.festival?.occasion==='firstBeer'&&state.festival.actors.some(a=>a.load>0)));
 const brewery=s.buildings.find(b=>`${b.x},${b.y}`===s.festival.temple),occupied=new Set(s.buildings.map(b=>`${b.x},${b.y}`));
 for(let y=brewery.y-4;y<=brewery.y+4;y++)for(let x=brewery.x-4;x<=brewery.x+4;x++)if(!occupied.has(`${x},${y}`))s.buildings.push({type:'house',x,y,level:1});
 assert.equal(festivalCourtLayout(s,networkFor(s),s.festival.temple),null);
 for(let i=0;i<300&&s.festival.stage==='supplying';i++)advanceFestival(s,.1);
 assert.equal(s.festival.stage,'waiting');assert.deepEqual(s.festival.delivered,{food:0,beer:1});
 assert.deepEqual(s.festival.actors,[]);assert.ok(s.citizens.every(c=>c.phase!=='festival'),'a rejected invitation cannot strand its former porter outside the actor ledger');
 assert.equal(festivalSummary(s).progress.code,'noCourtyard');assert.ok(validateFestival(s));assert.ok(cancelFestival(s).refunded);
 assert.equal(s.firstBeerFeast.status,'pending','the unique first-cup occasion can retry after making room');
});


test('late guests do not reshuffle existing torchbearers or their street positions',()=>{
 const s=gatheredCity(),guests=s.festival.actors.filter(a=>a.kind==='guest');s.festival.elapsed=12;
 for(const a of guests.slice(6))a.stage='arriving';
 const views=()=>s.citizens.map(c=>({id:c.id,...festivalCitizenView(s,c)})).filter(v=>v.festivalTorch);
 const before=views();assert.ok(before.length>=2);
 for(const a of guests.slice(6))a.stage='dancing';
 assert.deepEqual(views(),before,'later arrivals cannot shift the existing patrol');
});
