import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {STARTER_HOMES} from '../starter-settlement.js';
import {initializeGeneratedWorld,initializeWorld,validateWorld,worldWidth,worldHeight,riverAxis,riverFlowSign,riverLength,riverAcrossSize,riverLocal,worldFromRiver,riverPoint,signedRiverDistance,bridgeSpanAt,onBridge,terrain,isDryPoint,isShore} from '../world.js';
import {networkFor} from '../workforce.js';

const founding=seed=>{const s={buildings:STARTER_HOMES.map(p=>({type:'house',...p,level:1}))};initializeGeneratedWorld(s,seed);return s;};
const seeds=[...Array.from({length:64},(_,i)=>i),123456789,0xffffffff];

test('new 64 × 64 worlds vary river axis, flow, position and connected oasis silhouettes',()=>{
 const courses=new Set(),modes=new Set(),outlines=new Set(),sizes=new Set(),offsets=[];
 for(const seed of seeds){
  const s=founding(seed);assert.ok(validateWorld(s),`valid ${seed}`);assert.equal(worldWidth(s),64);assert.equal(worldHeight(s),64);
  assert.equal(riverLength(s),64);assert.equal(riverAcrossSize(s),64);assert.equal(s.world.generationVersion,2);
  assert.ok(s.buildings.every(b=>isDryPoint(s,b.x,b.y)&&signedRiverDistance(b.x,b.y,s)<0),`founder bank ${seed}`);
  assert.ok(s.world.lakes.length>=4&&s.world.lakes.length<=6);modes.add(`${riverAxis(s)}/${riverFlowSign(s)}`);courses.add(JSON.stringify(s.world.river));offsets.push(s.world.river.offset);
  const near=s.world.lakes[0];assert.ok(near.cells.every(c=>signedRiverDistance(c.x,c.y,s)<0),`near oasis bank ${seed}`);
  for(const lake of s.world.lakes){
   const minX=Math.min(...lake.cells.map(c=>c.x)),minY=Math.min(...lake.cells.map(c=>c.y));
   outlines.add(lake.cells.map(c=>`${c.x-minX},${c.y-minY}`).sort().join('|'));sizes.add(lake.cells.length);
   const seen=new Set(),queue=[lake.cells[0]],keys=new Set(lake.cells.map(c=>`${c.x},${c.y}`));
   for(let i=0;i<queue.length;i++){const p=queue[i],key=`${p.x},${p.y}`;if(seen.has(key))continue;seen.add(key);for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]])if(keys.has(`${p.x+dx},${p.y+dy}`)&&!seen.has(`${p.x+dx},${p.y+dy}`))queue.push({x:p.x+dx,y:p.y+dy});}
   assert.equal(seen.size,lake.cells.length,`connected ${seed}/${lake.id}`);
  }
  for(const negative of [true,false])for(const kind of ['reed','clay','dates','forest','wildlife','stone']){
   const sites=s.world.deposits.filter(d=>d.kind===kind&&(signedRiverDistance(d.x,d.y,s)<0)===negative);
   assert.ok(sites.length>=(['reed','clay','dates'].includes(kind)?2:1),`${seed}/${kind}/${negative}`);
   assert.ok(sites.every(p=>isDryPoint(s,p.x,p.y)));if(kind==='reed')assert.ok(sites.every(p=>isShore(s,p.x,p.y)));
  }
 }
 assert.equal(courses.size,seeds.length);assert.deepEqual([...modes].sort(),['x/-1','x/1','y/-1','y/1']);
 assert.ok(Math.max(...offsets)-Math.min(...offsets)>20);assert.ok(outlines.size>100);assert.ok(sizes.size>20);
});

test('river coordinate conversion and bridge access agree in both world orientations',()=>{
 for(const axis of ['x','y']){
  const s=founding(3);s.world.river.axis=axis;
  for(const p of [{x:1.25,y:7.5},{x:40,y:60},{x:-12,y:78}]){const q=riverLocal(p.x,p.y,s);assert.deepEqual(worldFromRiver(q.across,q.along,s),p);}
  const center=riverPoint(40,s);assert.ok(Math.abs(signedRiverDistance(center.x,center.y,s))<1e-9);
  const bridge={type:'bridge',...worldFromRiver(Math.round(riverLocal(center.x,center.y,s).across),40,s),level:1};s.buildings.push(bridge);
  const span=bridgeSpanAt(bridge,s),mid=worldFromRiver((span.left+span.right)/2,span.y,s),end=worldFromRiver(span.left,span.y,s);
  assert.ok(onBridge(s.buildings,mid.x,mid.y,s));assert.ok(onBridge(s.buildings,end.x,end.y,s));
  const off=worldFromRiver((span.left+span.right)/2,span.y+1,s);assert.equal(onBridge(s.buildings,off.x,off.y,s),false);
  assert.equal(terrain(63,63,s)==='void',false);assert.equal(terrain(64,63,s),'void');assert.equal(terrain(63,64,s),'void');
 }
});

test('v2 dimensions, flow and lake data reject malformed geometry without widening legacy saves',()=>{
 const source=founding(19);
 for(const mutate of [w=>w.width=63,w=>w.width='64',w=>delete w.height,w=>w.height=Infinity,w=>w.river.axis='z',w=>delete w.river.flowSign,w=>w.river.flowSign=0,w=>w.river.flowSign='1',w=>w.river.extra=true,w=>w.river.offset=53,w=>w.lakes[0].cells.push({x:63,y:63}),w=>w.lakes[0].cells[0].x=64,w=>w.generationVersion=1]){
  const s=structuredClone(source);mutate(s.world);assert.equal(validateWorld(s),false);
 }
 const legacy={buildings:STARTER_HOMES.map(p=>({type:'house',...p}))};initializeGeneratedWorld(legacy,19,{version:1});
 assert.equal(validateWorld(legacy),true);assert.equal(worldWidth(legacy),40);assert.equal(worldHeight(legacy),32);assert.equal(riverAxis(legacy),'y');assert.equal(riverFlowSign(legacy),1);
 assert.equal(terrain(45,20,legacy),'void');assert.equal(legacy.world.width,undefined);
 const before=JSON.stringify(legacy.world);initializeGeneratedWorld(legacy,3);initializeWorld(legacy);assert.equal(JSON.stringify(legacy.world),before);
 const widened=structuredClone(legacy);widened.world.width=64;assert.equal(validateWorld(widened),false);
 assert.throws(()=>initializeGeneratedWorld({buildings:[]},0,{version:3}),RangeError);
});

test('64 × 64 starts retain connected founders, available relics and round-trip resident identities',()=>{
 for(const seed of [0,1,3,7,19,96,123456789,0xffffffff])for(const start of ['beehives','established']){
  const s=createGame({seed,start}),context=`${seed}/${start}`;assert.equal(worldWidth(s),64,context);assert.equal(worldHeight(s),64,context);
  assert.ok(validateWorld(s),context);assert.ok(s.relicQuest&&s.landRelicQuest,`both relics ${context}`);
  assert.ok(s.buildings.filter(b=>b.type==='field').every(b=>terrain(b.x,b.y,s)==='fertile'),`fields ${context}`);
  const net=networkFor(s),homes=net.ports.filter(p=>p.building.type==='house'),component=net.components.get(homes[0].key);
  assert.equal(homes.length,s.buildings.filter(b=>b.type==='house').length);assert.ok(homes.every(p=>net.components.get(p.key)===component));
  for(const kind of ['reed','clay','dates','forest','wildlife','stone'])assert.ok(s.world.deposits.filter(d=>d.kind===kind&&signedRiverDistance(d.x,d.y,s)<0).some(d=>[[0,0],[1,0],[0,1],[1,1]].some(([dx,dy])=>net.components.get(`${d.x+dx},${d.y+dy}`)===component)),`${kind} reachable ${context}`);
  const restored=decode(encode(s));assert.ok(restored,`load ${context}`);assert.deepEqual(restored.world,s.world,context);assert.deepEqual(restored.citizens,s.citizens,context);
 }
});
