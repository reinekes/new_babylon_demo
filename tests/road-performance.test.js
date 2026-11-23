import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {networkFor} from '../workforce.js';
import {ensureRoads,roadSegment,roadSpeed} from '../roads.js';
import {markRoadTopologyChanged} from '../road-revisions.js';
test('existing road edges do not repeat terrain validation, missing edges are restored',()=>{
 const s=createGame({start:'established'}),net=networkFor(s);let reads=0;
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
 const s=createGame({start:'established'}),net=networkFor(s),roads=s.roads;let visits=0;
 s.roads=new Proxy(roads,{get(t,k,r){if(k==='map')visits++;return Reflect.get(t,k,r);}});
 networkFor(s);visits=0;for(let i=0;i<20;i++)networkFor(s);assert.equal(visits,0);
 const removed=s.roads.pop();networkFor(s);assert.ok(s.roads.some(r=>r.id===removed.id));assert.equal(networkFor(s),net);
});

test('walking segments match fractional edges and live roads after flood repair, replacement and restoration',()=>{
 const s=createGame({start:'established'}),net=networkFor(s);
 const road=s.roads.at(-1),mid={x:(road.a.x+road.b.x)/2,y:(road.a.y+road.b.y)/2};
 assert.equal(roadSegment(s,mid,road.b),road);
 road.floodDamage=1;assert.equal(roadSpeed(s,mid,road.b),.8);
 delete road.floodDamage;assert.equal(roadSpeed(s,mid,road.b),1);
 s.roads.pop();ensureRoads(s,net);
 const restored=roadSegment(s,mid,road.b);
 assert.equal(restored.id,road.id);assert.notEqual(restored,road);
 const first={a:{x:0,y:0},b:{x:1,y:0}},second={a:{x:1,y:0},b:{x:1,y:1}};
 s.roads=[first,second];
 assert.equal(roadSegment(s,first.b,first.b),first);
 assert.equal(roadSegment(s,first.b,{x:.5,y:0}),first);
 assert.equal(roadSegment(s,{x:-1e-8,y:0},first.a),first);
 assert.equal(roadSegment(s,first.a,{x:1+1e-6,y:0}),undefined);
 s.roads.reverse();markRoadTopologyChanged(s);
 assert.equal(roadSegment(s,first.b,first.b),second);
});
