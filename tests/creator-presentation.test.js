import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorSceneFrame,creatorScenePoints} from '../creator-presentation.js';

test('the clay opening and cast end on their planned seconds',()=>{
 assert.deepEqual([0,7,14,21,30].map(t=>creatorSceneFrame('opening',t)),['brick','hand','echo','lesson',null]);
 assert.deepEqual([0,2,5,7].map(t=>creatorSceneFrame('cast',t)),['dust','cut','bundle',null]);
});

test('the scene selects an actual brick and working extraction yards when available',()=>{
 const yard={type:'brickyard',x:8,y:7,workshopStock:{output:{brick:4}}},clay={type:'clay',x:7,y:7},reed={type:'reed',x:12,y:8};
 const s={creatorMaterials:{projects:['8,7']},buildings:[yard,clay,reed],citizens:[{work:'12,8'},{work:'7,7'}]};
 assert.deepEqual(creatorScenePoints(s),{brick:yard,clay,reed});
 yard.workshopStock.output.brick=0;
 assert.deepEqual(creatorScenePoints(s),{brick:null,clay,reed});
});
