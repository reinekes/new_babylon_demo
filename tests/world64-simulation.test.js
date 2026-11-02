import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,buildingAt,canBuild,canPlace,build} from '../engine.js';
import {worldWidth,worldHeight,riverLocal,bridgeSpanAt,worldFromRiver,isDryPoint} from '../world.js';
import {syncCitizens} from '../workforce.js';
import {advanceTrade,advanceTradeLogistics} from '../trading.js';
import {generateStreets} from '../city-life.js';
import {createWalkingNetwork,shortestWalkingPath,navigationSegmentClear} from '../navigation.js';
import {riverEntry,riverExit,riverRoute,moveBoat,validBoatPoint,isRiverBank} from '../river-trade.js';
import {syncInventory} from '../inventory.js';
import {syncPestSites} from '../pests.js';
import {validateGathering} from '../labor-life.js';

const valley=(axis='x',flowSign=1)=>({world:{generationVersion:2,width:64,height:64,river:{axis,flowSign,offset:30,slope:0,amplitude:0,frequency:.1,phase:0},lakes:[],deposits:[]},buildings:[],roads:[]});
test('a horizontal river has a working north-south bridge and no free diagonal water shortcuts',()=>{
 const s=valley(),bridge={type:'bridge',x:10,y:30,level:2};s.buildings=[bridge];
 const span=bridgeSpanAt(bridge,s),a=worldFromRiver(span.left,span.y,s),b=worldFromRiver(span.right,span.y,s);
 assert.equal(navigationSegmentClear(s,a,b),true);
 const streets=generateStreets(s.buildings,s),net=createWalkingNetwork(s,streets),key=p=>`${p.x+.5},${p.y+.5}`;
 assert.ok(shortestWalkingPath(net,key(a),key(b))?.length>2);
 assert.equal(navigationSegmentClear(s,{x:a.x+1,y:a.y},{x:b.x+1,y:b.y}),false);
 assert.equal(buildingAt(s,10,29),bridge);
 assert.equal(isDryPoint(s,60,60),true);
 assert.ok(net.nodes.has('60,60'));
});
test('river boats enter upstream and leave downstream on both axes and directions',()=>{
 for(const axis of ['x','y'])for(const flowSign of [-1,1]){
  const s=valley(axis,flowSign),entry=riverEntry(s),exit=riverExit(s),route=riverRoute(riverLocal(entry.x,entry.y,s).along,riverLocal(exit.x,exit.y,s).along,s);
  assert.equal(riverLocal(entry.x,entry.y,s).along,flowSign===1?-.5:63.5);
  assert.equal(riverLocal(exit.x,exit.y,s).along,flowSign===1?63.5:-.5);
  assert.ok(route.every(p=>validBoatPoint(p,s)));
  const boat={...entry,route,routeIndex:0};assert.equal(moveBoat(boat,.17,s),false);assert.ok(validBoatPoint(boat,s));
  assert.equal(moveBoat(boat,200,s),true);assert.deepEqual({x:boat.x,y:boat.y},exit);
  const shore=worldFromRiver(28,55,s);assert.equal(isRiverBank(s,shore.x,shore.y),true);
 }
});
test('new 64x64 cities round trip while explicit previous generation stays 40x32',()=>{
 for(const version of [1,2]){
  const s=createGame({seed:197,mode:'mature',generationVersion:version});
  assert.equal(worldWidth(s),version===2?64:40);assert.equal(worldHeight(s),version===2?64:32);
  const saved=decode(encode(s));assert.ok(saved);assert.deepEqual(saved.world,s.world);
  assert.deepEqual(saved.citizens.map(c=>c.id),s.citizens.map(c=>c.id));
 }
});

test('bridges can be placed in the expanded area on either axis',()=>{
 for(const axis of ['x','y']){
  const s=valley(axis),p=worldFromRiver(30,55,s);
  assert.equal(canBuild(s,'bridge',p.x,p.y,true),'');
 }
});

test('far construction reservations save without changing resident identities or in-flight cargo',()=>{
 const s=createGame({seed:197,mode:'mature'}),identities=s.citizens.map(c=>({id:c.id,name:c.name,parents:c.parents}));
 let target;for(let y=50;y<60&&!target;y++)for(let x=50;x<60;x++)if(canBuild(s,'house',x,y)===''){target={x,y};break;}
 assert.ok(target);assert.ok(build(s,'house',target.x,target.y).ok);
 const saved=decode(encode(s));assert.ok(saved);assert.deepEqual(saved,s);
 assert.deepEqual(saved.citizens.map(c=>({id:c.id,name:c.name,parents:c.parents})),identities);
 assert.ok(saved.buildings.some(b=>b.x===target.x&&b.y===target.y&&b.construction));
});

test('a horizontal-river harbor receives real trade, preserves a sailing save and sends the boat downstream',()=>{
 const s=createGame({seed:1,mode:'mature'});assert.equal(s.world.river.axis,'x');
 s.buildings.push({type:'granary',x:7,y:10,level:1});
 let harbor;for(let across=0;across<64;across++){const p=worldFromRiver(across,8,s);if(!canPlace(s,'harbor',p.x,p.y)){harbor={...p,type:'harbor',level:1};break;}}
 assert.ok(harbor);s.buildings.push(harbor);syncCitizens(s);
 s.tick=1;s.year=1;s.season=1;s.simTime=45;advanceTrade(s);advanceTradeLogistics(s,.1);
 assert.equal(s.trade.caravan.transport,'river');assert.equal(s.trade.caravan.phase,'arriving');
 const loaded=decode(encode(s));assert.ok(loaded);assert.deepEqual(loaded,s);
 for(let i=0;i<1200&&s.trade.caravan.phase!=='trading';i++){advanceTradeLogistics(s,.1);advanceTradeLogistics(loaded,.1);}
 assert.equal(s.trade.caravan.phase,'trading');assert.deepEqual(loaded,s);
 const cargo=structuredClone(s.trade.caravan.stock);s.tick=3;s.season=3;s.simTime=135;advanceTradeLogistics(s,.1);
 assert.equal(s.trade.caravan.phase,'departing');assert.deepEqual(s.trade.caravan.stock,cargo);
 const end=s.trade.caravan.route.at(-1);assert.deepEqual({x:end.x,y:end.y},riverExit(s));assert.ok(decode(encode(s)));
 for(let i=0;i<1200&&s.trade.caravan;i++)advanceTradeLogistics(s,.1);assert.equal(s.trade.caravan,null);
});

test('a legal 64x64 city with more than 1280 protected stores survives saving and loading',()=>{
 const s=createGame({seed:1,mode:'mature'});let stores=0;
 for(let y=20;y<64&&stores<1281;y++)for(let x=0;x<64&&stores<1281;x++)if(!canPlace(s,'granary',x,y)){s.buildings.push({type:'granary',x,y,level:1});stores++;}
 assert.equal(stores,1281);syncInventory(s);syncPestSites(s);
 s.pests.cats=s.pests.sites.map((site,id)=>({id,site:site.key}));s.pests.nextCat=s.pests.cats.length;
 assert.equal(s.pests.sites.length,1281);assert.equal(s.pests.cats.length,1281);
 const loaded=decode(encode(s));assert.ok(loaded,'large legal city must remain loadable');
 assert.deepEqual(loaded.pests,s.pests);assert.deepEqual(loaded.citizens,s.citizens);assert.deepEqual(loaded.resources,s.resources);
});

test('64x64 gathering capacity allows four natural work targets per building tile',()=>{
 const s=valley();s.citizens=[];s.population=0;s.simTime=0;
 s.gathering={features:[],jobs:[],kills:[]};
 for(let i=0;i<1281;i++)for(let slot=0;slot<4;slot++){const x=i%64,y=Math.floor(i/64);s.gathering.features.push({id:`tree:${x},${y}:${slot}`,kind:'tree',x,y,health:1,felledAt:null,recoverAt:null});}
 assert.equal(s.gathering.features.length,5124);assert.equal(validateGathering(s),true);
});
