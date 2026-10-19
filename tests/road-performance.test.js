import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {networkFor} from '../workforce.js';
import {ensureRoads} from '../roads.js';
test('existing road edges do not repeat terrain validation, missing edges are restored',()=>{
 const s=createGame(),net=networkFor(s);let reads=0;
 for(const lake of s.world.lakes){const cells=lake.cells;Object.defineProperty(lake,'cells',{get(){reads++;return cells;}});}
 ensureRoads(s,net);assert.equal(reads,0);
 const removed=s.roads.pop();ensureRoads(s,net);assert.ok(s.roads.some(r=>r.id===removed.id));assert.ok(reads>0);
});
test('drawing streets indexes road edges instead of scanning all roads for each edge',async()=>{
 const {Renderer}=await import('../renderer.js');let reads=0;
 const roads=Array.from({length:100},(_,i)=>{const a={x:i,y:0,key:`${i},0`},b={x:i+1,y:0,key:`${i+1},0`};return {id:`r${i}`,get a(){reads++;return a;},get b(){reads++;return b;},level:1};});
 const edges=roads.map(r=>[r.a,r.b]);reads=0;
 const r=Object.create(Renderer.prototype);Object.assign(r,{ctx:{save(){},restore(){}},state:{roads},streets:{edges,ports:[]},s:1,point:(x,y)=>({x,y}),line(){},box(){}});
 r.streetsLayer();assert.ok(reads<2000,`road endpoint reads ${reads}`);
});
test('cached route lookups do not rescan infrastructure and detect road removal',()=>{
 const s=createGame(),net=networkFor(s),roads=s.roads;let visits=0;
 s.roads=new Proxy(roads,{get(t,k,r){if(k==='map')visits++;return Reflect.get(t,k,r);}});
 networkFor(s);visits=0;for(let i=0;i<20;i++)networkFor(s);assert.equal(visits,0);
 const removed=s.roads.pop();networkFor(s);assert.ok(s.roads.some(r=>r.id===removed.id));assert.equal(networkFor(s),net);
});
