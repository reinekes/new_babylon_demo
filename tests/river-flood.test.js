import test from 'node:test';
import assert from 'node:assert/strict';
import {floodFootprint,floodedSegment,floodedRoads,floodEscapeRoute,changeFloodSeason,floodPhase,validateRiverFlood} from '../river-flood.js';
import {createWalkingNetwork,navigationDistance,shortestWalkingPath} from "../navigation.js";
import {strictScenario} from "../scenario-profiles.js";
import {createGame,advanceTime,encode,decode,build} from "../engine.js";
import {routeBetween,networkFor} from "../workforce.js";
import {cityToolsHTML} from "../ui-city-tools.js";
import {advanceWellbeing} from "../wellbeing.js";
import {advanceWater} from "../water.js";

const world=axis=>({
 width:64,height:64,river:{axis,offset:25,slope:0,amplitude:.5,frequency:.1,phase:Math.PI*2-2}
});
const event={along:20,bank:-1};

test('a local spill follows one bank on both river orientations',()=>{
 for(const axis of ['x','y']){
  const s={world:world(axis)};
  const xy=(across,along)=>axis==='x'?[along,across]:[across,along];
  const footprint=floodFootprint(s,event);
  assert.ok(footprint.has(xy(23,20).join(',')));
  assert.ok(footprint.has(xy(22,20).join(',')));
  assert.ok(!footprint.has(xy(23,30).join(',')));
  assert.ok(!footprint.has(xy(27,20).join(',')));
  assert.ok(!footprint.has(xy(25,20).join(',')));
  assert.ok(!footprint.has(xy(21,20).join(',')));
 }
});

test('a segment is affected when it crosses a flooded tile between dry endpoints',()=>{
 const s={world:world('y')},footprint=floodFootprint(s,event);
 assert.equal(floodedSegment(footprint,{x:22,y:15},{x:22,y:25}),true);
 assert.equal(floodedSegment(footprint,{x:21.5,y:15},{x:21.5,y:25}),true);
 assert.equal(floodedSegment(footprint,{x:21,y:15},{x:21,y:25}),false);
});

test('standing lake water is excluded from the temporary flood footprint',()=>{
 const s={world:{...world('y'),lakes:[{cells:[{x:22,y:20}]}]}};
 const footprint=floodFootprint(s,event);
 assert.ok(footprint.has('23,20'));
 assert.ok(!footprint.has('22,20'));
});

test('flood forecast and the walking graph agree on the closed route and a dry detour',()=>{
 const a={x:22.5,y:12.5,key:'23,13'},b={x:22.5,y:27.5,key:'23,28'};
 const s={world:world('y'),buildings:[],roads:[{id:'river-bank',a,b}]};
 const footprint=floodFootprint(s,event);
 assert.deepEqual(floodedRoads(s,footprint).map(r=>r.id),['river-bank']);
 const dry=createWalkingNetwork(s,{}),wet=createWalkingNetwork(s,{},footprint);
 const original=shortestWalkingPath(dry,a.key,b.key),detour=shortestWalkingPath(wet,a.key,b.key);
 assert.ok(original.some((p,i)=>i&&floodedSegment(footprint,original[i-1],p)));
 assert.ok(detour&&navigationDistance(detour)>navigationDistance(original));
 assert.ok(detour.every((p,i)=>!i||!floodedSegment(footprint,detour[i-1],p)));
 assert.equal(s.roads.length,1);
});

test('evacuation can leave a submerged street for a real dry shelter without reentering water',()=>{
 const s={world:world('y'),buildings:[],roads:[]};
 const footprint=floodFootprint(s,event);
 const dry=createWalkingNetwork(s,{}),wet=createWalkingNetwork(s,{},footprint);
 const start='23,20',safe='20,20';
 assert.ok(dry.nodes.has(start)&&!wet.nodes.has(start));
 const route=floodEscapeRoute(dry,wet,start,new Set([start,safe]));
 assert.equal(route?.at(-1)?.key,safe);
 let leftWater=false;
 for(let i=0;i<route.length;i++){
  const node=route[i];
  if(leftWater)assert.ok(wet.graph.get(route[i-1].key).has(node.key));
  if(wet.nodes.has(node.key))leftWater=true;
 }
 assert.equal(floodEscapeRoute(dry,wet,start,new Set([start])),null);
});

test('the winter warning fixes the same bank and reach through the spring flood',()=>{
 const s={world:world('y'),scenario:strictScenario(),buildings:[{type:'house',x:22,y:20,level:1}],year:3,season:3};
 assert.equal(changeFloodSeason(s),'warning');
 const warning=structuredClone(s.riverFlood);
 assert.equal(floodPhase(s),'warning');
 assert.ok(floodFootprint(s,warning).has('22,20'));
 s.buildings.unshift({type:'house',x:27,y:35,level:1});
 s.year=4;s.season=0;
 assert.equal(changeFloodSeason(s),'active');
 assert.equal(floodPhase(s),'active');
 assert.deepEqual(s.riverFlood,warning);
 assert.ok(validateRiverFlood(s));
 assert.equal(validateRiverFlood({...s,riverFlood:{...warning,bank:0}}),false);
 s.season=1;
 assert.equal(changeFloodSeason(s),'ended');
 assert.equal(s.riverFlood,undefined);
 assert.ok(validateRiverFlood(s));
});

test('entering winter announces the warning and preserves its location through a save',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 for(let i=0;i<1200&&s.tick<11;i++){
  if(s.event)s.event=null;
  advanceTime(s,.5);
 }
 assert.equal(s.tick,11);
 assert.equal(floodPhase(s),'warning');
 assert.ok(s.news.some(n=>n.title==='Весной ожидается разлив'));
 assert.match(cityToolsHTML(s,{tab:'workshops'}),/Прогноз весеннего разлива/);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 assert.deepEqual(restored.riverFlood,s.riverFlood);
});

test('the city uses a dry detour during the flood and reopens the road afterward',()=>{
 const a={x:22.5,y:12.5,key:'23,13'},b={x:22.5,y:27.5,key:'23,28'};
 const s={world:world('y'),scenario:strictScenario(),buildings:[],roads:[],year:3,season:3,riverFlood:{...event,year:4}};
 const dry=routeBetween(s,a.key,b.key);
 s.year=4;s.season=0;
 const wet=routeBetween(s,a.key,b.key),footprint=floodFootprint(s,event);
 assert.ok(wet&&navigationDistance(wet)>navigationDistance(dry));
 assert.ok(wet.every((p,i)=>!i||!floodedSegment(footprint,wet[i-1],p)));
 s.season=1;changeFloodSeason(s);
 assert.deepEqual(routeBetween(s,a.key,b.key),dry);
});

test('a carrier already travelling at flood onset changes course with the same cargo and identity',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 Object.assign(s,{year:4,tick:12,simTime:540,riverFlood:{year:4,along:6,bank:-1}});
 const c=s.citizens[0],id=c.id;
 const flooded=floodFootprint(s,s.riverFlood);
 const [x,y]=[...flooded][0].split(',').map(Number);
 Object.assign(c,{x,y,phase:'toStore',route:[{x,y},{x:x-1,y}],routeIndex:1,cargo:{stone:2}});
 advanceTime(s,.1);
 assert.equal(c.id,id);
 assert.deepEqual(c.cargo,{stone:2});
 assert.ok(Math.hypot(c.x-x,c.y-y)<=.105001);
 assert.ok(c.floodShelter);
});

test('a resident on a flooded bank walks to shelter while retaining their home and cargo',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 for(let i=0;i<1250&&s.tick<12;i++){
  if(s.event)s.event=null;
  advanceTime(s,.5);
 }
 assert.equal(floodPhase(s),'active');
 const c=s.citizens.find(p=>p.age>=16&&!p.waterTrip),home=c.home,id=c.id;
 const footprint=floodFootprint(s,s.riverFlood);
 const [x,y]=[...footprint][0].split(',').map(Number);
 Object.assign(c,{x,y,cargo:{stone:2},phase:'blocked',route:[],routeIndex:0});
 advanceTime(s,.1);
 assert.ok(c.floodShelter);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 const evacuee=restored.citizens.find(p=>p.id===id);
 for(let i=0;i<90&&evacuee.routeIndex<evacuee.route.length;i++)advanceTime(restored,.25);
 assert.equal(evacuee.routeIndex,evacuee.route.length);
 assert.equal(floodedSegment(footprint,evacuee,evacuee),false);
 assert.equal(evacuee.home,home);
 assert.deepEqual(evacuee.cargo,{stone:2});
});

test('evacuees consume real food and water only after reaching a receiving home',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const c=s.citizens[0],source=s.buildings.find(b=>`${b.x},${b.y}`===c.home);
 const host=s.buildings.find(b=>b.type==='house'&&b!==source);
 s.citizens=[c];
 s.simTime=35;
 source.pantry=3;source.water=3;host.pantry=3;host.water=3;
 Object.assign(c,{phase:'blocked',floodShelter:`${host.x},${host.y}`,route:[{x:host.x,y:host.y}],routeIndex:0});
 advanceWellbeing(s,.1);advanceWater(s,.1);
 assert.equal(source.pantry,3);assert.equal(source.water,3);
 assert.equal(host.pantry,3);assert.equal(host.water,3);
 c.routeIndex=1;
 advanceWellbeing(s,.1);advanceWater(s,.1);
 assert.ok(host.pantry<3);assert.ok(host.water<3);
 assert.equal(source.pantry,3);assert.equal(source.water,3);
 assert.equal(c.home,`${source.x},${source.y}`);
});

test('only an unblocked drain with an outlet beyond the spill removes adjacent flood cells',()=>{
 const s={world:world('y'),scenario:strictScenario(),buildings:[],roads:[],year:4,season:0,riverFlood:{...event,year:4}};
 const channel=(x,y)=>({type:'canal',x,y,level:1,drain:true});
 for(let y=20;y<=26;y++)s.buildings.push(channel(22,y));
 assert.ok(networkFor(s).navigation.flooded.has('23,20'));
 s.buildings.push(channel(23,26),channel(24,26));
 assert.ok(!networkFor(s).navigation.flooded.has('23,20'));
 s.buildings.find(b=>b.x===22&&b.y===24).silt=1;
 assert.ok(networkFor(s).navigation.flooded.has('23,20'));
});

test('finished levee sections keep inland ground dry and a construction gap lets water through',()=>{
 const s={world:world('y'),scenario:strictScenario(),buildings:[]};
 for(let y=15;y<=25;y++)s.buildings.push({type:'levee',x:23,y,level:1});
 const section=s.buildings.find(b=>b.y===20);
 assert.ok(!floodFootprint(s,event).has('22,20'));
 section.construction={kind:'new'};
 assert.ok(floodFootprint(s,event).has('22,20'));
 section.construction={kind:'upgrade'};
 assert.ok(!floodFootprint(s,event).has('22,20'));
});

test('a strict city can reserve a levee through normal construction and reload the unfinished section',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 assert.ok(build(s,'levee',13,6).ok);
 const raw=encode(s),restored=decode(raw);
 assert.ok(restored);
 assert.equal(encode(restored),raw);
 assert.equal(restored.buildings.find(b=>b.type==='levee').construction.kind,'new');
 assert.equal(build(createGame({start:'established',mode:'mature'}),'levee',13,6).ok,false);
 assert.equal(build(s,'levee',5,5).ok,false);
});
