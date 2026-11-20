import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {footpathId,recordFootsteps,routingTraffic,visibleFootpaths} from '../footpaths.js';
import {navigationDistance,navigationSegmentClear,shortestWalkingPath} from '../navigation.js';
import {layRoad,roadIsBuilt} from '../roads.js';
import {networkFor,rerouteCitizens,routeBetween} from '../workforce.js';

const city=()=>({buildings:[],roadAnchors:[],roads:[],world:{lakes:[]},simTime:0});
const route=(net,keys)=>keys.map(k=>net.nodes.get(k));
const routeKeys=points=>points.map(p=>p.key);

function walk(s,net,steps,count=1){
 for(let repeat=0;repeat<count;repeat++)for(let i=1;i<steps.length;i++){
  const a=steps[i-1],b=steps[i];
  assert.ok(net.graph.get(a.key).has(b.key));
  recordFootsteps(s,a,b,Math.hypot(b.x-a.x,b.y-a.y),net.navigation);
 }
}

test('repeated passages turn an equal alternative into the preferred earth road, then disuse reverses the choice',()=>{
 const s=city(),net=networkFor(s),ctx={network:net};
 const altKeys=['2,2','3,2','4,2','5,2','6,2','7,3','8,4'],alt=route(net,altKeys);
 const from=altKeys[0],to=altKeys.at(-1),baseline=routeBetween(s,from,to,ctx);
 const remote=routeBetween(s,'3,9','9,11',ctx);
 assert.notDeepEqual(routeKeys(baseline),altKeys);
 assert.ok(Math.abs(navigationDistance(baseline)-navigationDistance(alt))<1e-8);
 const countUsing=()=>Array.from({length:100},(_,id)=>routeBetween(s,from,to,ctx,id))
   .filter(path=>path.every((p,i)=>p.key===altKeys[i])).length;
 let previous=0;
 for(const [passes,expected] of [[0,0],[3,25],[7,50],[11,75],[15,100],[32,100]]){
  walk(s,net,alt,passes-previous);previous=passes;
  assert.equal(countUsing(),expected,`${passes} passes; out of 100 residents`);
 }
 assert.equal(s.roads.length,0);
 assert.ok(visibleFootpaths(s).every(p=>p.traffic===1));
 assert.deepEqual(routeKeys(routeBetween(s,to,from,ctx,99)),[...altKeys].reverse());
 assert.deepEqual(routeBetween(s,'3,9','9,11',ctx,19),remote);
 assert.equal(routeBetween(s,from,to,ctx),baseline,'stock selection keeps its cached access path');
 s.simTime+=36*32;
 assert.equal(countUsing(),0);
 assert.deepEqual(visibleFootpaths(s),[]);
});

test('a busy street can earn a modest detour while a distant street or newly blocked shortcut cannot divert walkers',()=>{
 const s=city(),net=networkFor(s),from='2,2',to='12,2';
 const direct=routeBetween(s,from,to);
 const nearby=route(net,[from,...Array.from({length:9},(_,i)=>`${i+3},3`),to]);
 walk(s,net,nearby,32);
 assert.deepEqual(routeBetween(s,from,to,undefined,0),nearby);
 assert.ok(navigationDistance(nearby)/navigationDistance(direct)<1.09);
 // A new lake covers the middle of the worn road. Its traffic is still in the save.
 s.world.lakes=[{cells:[{x:6,y:3}]}];
 const around=routeBetween(s,from,to,undefined,0);
 assert.ok(around.every((p,i)=>!i||navigationSegmentClear(s,around[i-1],p)));
 assert.notDeepEqual(around,nearby);
 const other=city(),otherNet=networkFor(other);
 const distant=route(otherNet,[from,'2,3','2,4','2,5',...Array.from({length:10},(_,i)=>`${i+3},5`),'12,4','12,3',to]);
 walk(other,otherNet,distant,32);
 assert.deepEqual(routeKeys(routeBetween(other,from,to,undefined,0)),routeKeys(direct));
});

test('additional footsteps postpone decay without discarding unchanged cached routes',()=>{
 const s=city(),net=networkFor(s),ctx={network:net},from='2,2',to='8,4';
 const alt=route(net,[from,'3,2','4,2','5,2','6,2','7,3',to]);
 walk(s,net,alt,3);
 const snapshot=routingTraffic(s),selected=routeBetween(s,from,to,ctx,0);
 s.simTime=10;
 for(let i=1;i<alt.length;i++){
  const a=alt[i-1],b=alt[i];
  recordFootsteps(s,a,b,.2*Math.hypot(b.x-a.x,b.y-a.y),net.navigation);
 }
 s.simTime=19;
 assert.equal(routingTraffic(s),snapshot);
 assert.equal(routeBetween(s,from,to,ctx,0),selected);
 s.simTime=26;
 assert.equal(routingTraffic(s),null);
 assert.notDeepEqual(routeBetween(s,from,to,ctx,0),selected);
});

test('an already maximally worn shortest path needs no A* expansion',()=>{
 const s=city(),net=networkFor(s),from='2,2',to='8,4',ordinary=routeBetween(s,from,to);
 walk(s,net,ordinary,32);
 const network={...net,graph:{get(){assert.fail('the ordinary route already has the lowest possible cost');}}};
 assert.equal(shortestWalkingPath(network,from,to,routingTraffic(s),0,ordinary),ordinary);
});

test('a dispatched carrier keeps their in-flight route and cargo across a reload, then uses the busy branch on a new trip',()=>{
 const s=createGame({start:'established'}),net=networkFor(s),carrier=s.citizens[0];
 Object.assign(carrier,{phase:'toStore',cargo:{wood:4},x:1.5,y:5.5});
 rerouteCitizens(s);
 const inFlight=structuredClone(carrier.route),alternate=route(net,['2,6','3,7','4,8','5,9','6,9','7,9','8,9','9,9','10,9']);
 walk(s,net,alternate,32);
 assert.deepEqual(carrier.route,inFlight);
 const loaded=decode(encode(s));assert.ok(loaded);
 const courier=loaded.citizens.find(c=>c.id===carrier.id);
 assert.deepEqual(courier.route,inFlight);
 rerouteCitizens(loaded);
 const expected=alternate.map(({x,y})=>({x,y}));
 assert.notDeepEqual(courier.route,inFlight);
 assert.deepEqual(courier.route.slice(1),expected);
 assert.deepEqual(courier.cargo,{wood:4});assert.equal(courier.store,carrier.store);
 const store=loaded.buildings.find(b=>`${b.x},${b.y}`===courier.store),before=store.stock.wood;
 for(let i=0;i<200&&courier.cargo.wood;i++)advanceTime(loaded,.1);
 assert.equal(store.stock.wood-before,4);assert.deepEqual(courier.cargo,{});
 assert.ok(decode(encode(loaded)));
});

test('finished hand-laid paving collects actual worker foot traffic and remains paving after the traffic fades',()=>{
 const s=createGame({start:'established'});advanceTime(s,3.4);
 const c=s.citizens[0],a=c.route[c.routeIndex-1],b=c.route[c.routeIndex],id=footpathId(a,b);
 assert.ok(layRoad(s,{x:a.x-.5,y:a.y-.5},{x:b.x-.5,y:b.y-.5}).ok);
 const road=s.roads.find(r=>r.id===id);assert.ok(roadIsBuilt(road));
 const wear=()=>s.footpaths.find(p=>footpathId(p.a,p.b)===id)?.wear||0;
 const before=wear();advanceTime(s,.2);
 assert.ok(wear()>before,'an already laid road records new consumed walking distance');
 s.simTime+=36*32;
 assert.ok(roadIsBuilt(road));assert.ok(!visibleFootpaths(s).some(p=>p.id===id));
});

test('a family water carrier follows a busy bank path to the same intake and brings the vessel back',async()=>{
 const {initializeWater,advanceWater,validateWater}=await import('../water.js');
 const house={type:'house',x:2,y:2,level:1},s={...city(),buildings:[house],resources:{},buffs:{}};
 const net=networkFor(s),port=net.ports[0];
 const c={id:1,age:25,home:'2,2',x:port.x,y:port.y,health:100,mood:75,phase:'home',cargo:{},buildCargo:{},work:null};
 s.citizens=[c];initializeWater(s);house.water=0;
 const plain=structuredClone(s);
 advanceWater(plain,.1);
 const original=plain.citizens[0].waterTrip.route;
 const bankRoad=route(net,['3,3',...Array.from({length:13},(_,i)=>`${i+3},2`),'15,3']);
 walk(s,net,bankRoad,32);
 advanceWater(s,.1);
 assert.deepEqual(c.waterTrip.route.at(-1),original.at(-1));
 assert.deepEqual(c.waterTrip.route.slice(1),bankRoad.map(({x,y})=>({x,y})));
 assert.equal(house.water,0);
 let carried=0;
 for(let i=0;i<600&&c.waterTrip;i++){
  advanceWater(s,.1);s.simTime+=.1;
  carried=Math.max(carried,c.waterTrip?.load||0);
  if(c.waterTrip?.phase==='source')assert.equal(c.waterTrip.load,0);
 }
 assert.ok(carried>0);assert.equal(c.waterTrip,undefined);
 assert.ok(house.water>0);assert.ok(validateWater(s));
});
