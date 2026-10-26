import test from 'node:test';
import assert from 'node:assert/strict';
import {networkFor,routeBetween,advanceWorkers} from '../workforce.js';
import {createGame} from '../engine.js';
import {navigationSegmentClear,navigationDistance,navigationTravelCost} from '../navigation.js';
import {river,bridgeSpan,isDryPoint,onBridge} from '../world.js';
import {residentViewPositions} from '../game3d/resident-motion.js';
import {finishConstruction,createOrder,workRequired} from '../construction.js';

const city=()=>({buildings:[],roadAnchors:[{x:2,y:2},{x:7,y:7}],roads:[],world:{lakes:[]}});
test('residents cross open land diagonally with Euclidean cost, without painting every free tile into a road',()=>{
 const s=city(),net=networkFor(s),roads=s.roads.length,route=routeBetween(s,'3,3','8,8');
 assert.ok(route);assert.ok(Math.abs(navigationDistance(route)-5*Math.SQRT2)<1e-8);assert.ok(route.some((p,i)=>i&&p.x!==route[i-1].x&&p.y!==route[i-1].y));assert.ok(navigationDistance(route)<10);
 assert.equal(s.roads.length,roads);assert.ok(net.edges.every(([a,b])=>a.x===b.x||a.y===b.y),'street geometry remains actual cardinal roads');assert.equal(routeBetween(s,'3,3','8,8'),route,'warm pair returns the cached path');
});
test('a diagonal cannot cut through a house, a two-cell monument or the corner of a lake',()=>{
 const s=city();s.buildings=[{type:'house',x:3,y:3}];assert.equal(navigationSegmentClear(s,{x:2.5,y:2.5},{x:3.5,y:3.5}),false);
 const route=routeBetween(s,'3,3','4,4');assert.ok(route);assert.ok(navigationDistance(route)>Math.SQRT2+.1);for(let i=1;i<route.length;i++)assert.ok(navigationSegmentClear(s,route[i-1],route[i]));
 s.buildings=[{type:'ziggurat',x:3,y:3,footprint:2}];assert.equal(navigationSegmentClear(s,{x:2.5,y:2.5},{x:4.5,y:4.5}),false);
 s.buildings=[];s.world.lakes=[{cells:[{x:3,y:3}]}];assert.equal(navigationSegmentClear(s,{x:2.5,y:2.5},{x:3.5,y:3.5}),false);const lakeRoute=routeBetween(s,'3,3','4,4');assert.ok(!lakeRoute||navigationDistance(lakeRoute)>Math.SQRT2+.1);
});
test('opposite banks remain isolated until the completed bridge exists; no diagonal water crossing appears',()=>{
 const s=city(),span=bridgeSpan(8),from=`${span.left+.5},${span.keyY}`,to=`${span.right+.5},${span.keyY}`;
 assert.equal(routeBetween(s,from,to),null);const dryNetwork=networkFor(s);s.buildings.push({type:'bridge',x:Math.round(river(8)),y:8,level:1,construction:{kind:'new'}});assert.equal(routeBetween(s,from,to),null);
 delete s.buildings[0].construction;const route=routeBetween(s,from,to);assert.ok(route);assert.notEqual(networkFor(s),dryNetwork);
 for(let i=1;i<route.length;i++){const a=route[i-1],b=route[i];for(let j=0;j<=16;j++){const x=a.x+(b.x-a.x)*j/16,y=a.y+(b.y-a.y)*j/16;assert.ok(isDryPoint(s,x,y)||onBridge(s.buildings,x,y));if(!isDryPoint(s,x,y))assert.equal(a.y,b.y,'wet sections stay on the horizontal bridge deck');}}
 s.buildings=[];assert.equal(routeBetween(s,from,to),null);
});
test('faster upgraded roads can win over a shorter diagonal, and road upgrades invalidate weighted paths',()=>{
 const s=city();s.roadAnchors=[{x:2,y:2},{x:7,y:5}];networkFor(s);const direct=routeBetween(s,'3,3','8,6'),plainCost=navigationTravelCost(s,direct),net=networkFor(s);
 s.news=[];for(const r of s.roads){r.construction=createOrder({},3,'upgrade');r.construction.work=workRequired(r);}finishConstruction(s);const fast=routeBetween(s,'3,3','8,6');assert.notEqual(networkFor(s),net);assert.ok(navigationTravelCost(s,fast)<plainCost);assert.ok(navigationTravelCost(s,fast)<=navigationTravelCost(s,direct)+1e-8);
});
test('same-array build/demolition invalidates routes while legacy in-flight cargo routes and identities stay untouched',()=>{
 const s=city();s.citizens=[{id:71,phase:'toStore',cargo:{food:12},route:[{x:2.5,y:2.5},{x:7.5,y:2.5},{x:7.5,y:7.5}],routeIndex:1,x:4.25,y:2.5}];
 const before=JSON.stringify(s.citizens),first=routeBetween(s,'3,3','8,8');s.buildings.push({type:'house',x:5,y:5});const blocked=routeBetween(s,'3,3','8,8');assert.notEqual(blocked,first);assert.ok(blocked.every((p,i)=>!i||navigationSegmentClear(s,blocked[i-1],p)));s.buildings.pop();assert.ok(Math.abs(navigationDistance(routeBetween(s,'3,3','8,8'))-navigationDistance(first))<1e-8);assert.equal(JSON.stringify(s.citizens),before);
});
test('opposing walkers use stable clear lanes on free ground without editing canonical routes or cargo',()=>{
 const s=city(),people=[{id:10,x:5,y:5,walking:true,phase:'toStore',route:[{x:5,y:5},{x:8,y:8}],routeIndex:1,cargo:{wood:12}},{id:11,x:5,y:5,walking:true,phase:'toHome',route:[{x:5,y:5},{x:2,y:2}],routeIndex:1,cargo:{}}],before=JSON.stringify(people),a=residentViewPositions(s,people),b=residentViewPositions(s,people);
 assert.deepEqual(a,b);assert.ok(Math.hypot(a.get(10).x-a.get(11).x,a.get(10).y-a.get(11).y)>=.1);assert.ok(a.get(10).x>5&&a.get(10).y<5);assert.ok(a.get(11).x<5&&a.get(11).y>5);assert.equal(JSON.stringify(people),before);
});
test('equal-cost route ties do not depend on request direction or the pre-save cache history',()=>{
 const a=city(),b=city();a.roadAnchors=b.roadAnchors=[{x:2,y:2},{x:7,y:5}];const forward=routeBetween(a,'3,3','8,6');routeBetween(b,'8,6','3,3');assert.deepEqual(routeBetween(b,'3,3','8,6'),forward);assert.deepEqual(routeBetween(a,'8,6','3,3'),[...forward].reverse());
});
test('canonical walking speed uses actual diagonal metres rather than Manhattan distance',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);s.event=null;s.simTime=0;Object.assign(c,{role:'auto',work:null,site:null,phase:'toHome',x:4.5,y:4.5,route:[{x:4.5,y:4.5},{x:5.5,y:5.5},{x:8.5,y:5.5},{x:8.5,y:8.5}],routeIndex:1,cargo:{},buildCargo:{}});
 advanceWorkers(s,.1);assert.ok(Math.abs(Math.hypot(c.x-4.5,c.y-4.5)-.105)<1e-8);assert.ok(Math.abs(c.x-c.y)<1e-8);
});
