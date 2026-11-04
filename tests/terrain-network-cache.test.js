import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {networkFor,cachedStreetsFor} from '../workforce.js';
import {generateStreets} from '../city-life.js';
import {districtRoadEdges} from '../district3d/terrain.js';
import {landscapePlan} from '../game3d/landscape.js';

test('terrain shares valid workforce street edges without changing city state',()=>{
 const s=createGame({start:'established',seed:137});networkFor(s);
 const cached=cachedStreetsFor(s);assert.ok(cached);const before=JSON.stringify(s);
 for(const edge of cached.edges){Object.freeze(edge[0]);Object.freeze(edge[1]);Object.freeze(edge);}Object.freeze(cached.edges);
 assert.ok(districtRoadEdges(s)===cached.edges,'a render view does not regenerate an already-valid street network');
 assert.deepEqual(landscapePlan(s).roads.map(r=>[r.a,r.b]),cached.edges);
 assert.equal(JSON.stringify(s),before);
});

test('cold and invalidated terrain views derive current streets without warming workforce',()=>{
 const s=structuredClone(createGame({start:'established',seed:137}));assert.equal(cachedStreetsFor(s),null);
 const before=JSON.stringify(s),expected=generateStreets([...s.buildings,...s.roadAnchors||[]],s).edges;
 assert.deepEqual(districtRoadEdges(s),expected);assert.equal(cachedStreetsFor(s),null);assert.equal(JSON.stringify(s),before);
 networkFor(s);const previous=cachedStreetsFor(s).edges;
 s.roadAnchors=[{type:'road',x:0,y:9}];assert.equal(cachedStreetsFor(s),null);const anchored=JSON.stringify(s),actual=districtRoadEdges(s);
 assert.notEqual(actual,previous);assert.deepEqual(actual,generateStreets([...s.buildings,...s.roadAnchors],s).edges);
 assert.equal(cachedStreetsFor(s),null);assert.equal(JSON.stringify(s),anchored);
 networkFor(s);assert.ok(districtRoadEdges(s)===cachedStreetsFor(s).edges);
});
