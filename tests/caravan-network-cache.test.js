import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode} from '../engine.js';
import {networkFor,routeBetween,syncCitizens} from '../workforce.js';
import {markRoadTopologyChanged} from '../road-revisions.js';

test('a caravan road anchor updates street ports without rebuilding unchanged walking geometry',()=>{
 const s=createGame({start:'established'}),before=networkFor(s),home=before.ports.find(p=>p.building.type==='house').key;
 s.roadAnchors=[{type:'road',x:0,y:8}];const after=networkFor(s),entry=after.ports.find(p=>p.building.type==='road'&&p.building.x===0);
 assert.ok(entry);assert.equal(after.nodes,before.nodes);assert.equal(after.graph,before.graph);assert.equal(after.navigation,before.navigation);
 const route=routeBetween(s,home,entry.key),fresh=decode(encode(s));assert.ok(fresh);assert.deepEqual(route,routeBetween(fresh,home,entry.key));
});
test('real building or road-cost changes still invalidate the walking geometry',()=>{
 const s=createGame({start:'established'}),before=networkFor(s);s.buildings.push({type:'house',x:10,y:9,level:1});
 const built=networkFor(s);syncCitizens(s);s.capacity=24;assert.notEqual(built.graph,before.graph);
 s.roads[0].level=2;markRoadTopologyChanged(s);const upgraded=networkFor(s);assert.notEqual(upgraded.graph,built.graph);
 const fresh=decode(encode(s));assert.ok(fresh);const expected=networkFor(fresh);assert.deepEqual([...upgraded.navigation.costs],[...expected.navigation.costs]);
});
