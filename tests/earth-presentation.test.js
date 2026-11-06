import test from 'node:test';
import assert from 'node:assert/strict';
import {earthSceneFrame,earthSceneFields} from '../earth-presentation.js';

test('the opening shows three accepted fields and the cast accent ends after twelve seconds',()=>{
 assert.deepEqual([0,5,10,15,21,27,35].map(t=>earthSceneFrame('opening',t)),[
  'field-one','field-two','field-three','sheaf','bow','garden',null
 ]);
 assert.deepEqual([0,3,8,12].map(t=>earthSceneFrame('cast',t)),['breath','furrows','leaves',null]);
});

test('the camera visits real accepted fields and finishes on the inspired harvest',()=>{
 const receipt=(x,id,inspired=false)=>({field:`${x},4`,fieldId:id,inspired,time:3});
 const s={earthDiscovery:{qualifiedAt:3,receipts:[receipt(1,1,true),receipt(2,2),receipt(3,3),receipt(4,4)]},
  buildings:[1,2,3,4].map(x=>({type:'field',x,y:4,grainFieldId:x}))};
 const raw=JSON.stringify(s);
 assert.deepEqual(earthSceneFields(s),[{x:2,y:4},{x:3,y:4},{x:1,y:4}]);
 assert.equal(JSON.stringify(s),raw);
 s.buildings[1].grainFieldId=9;
 assert.deepEqual(earthSceneFields(s),[{x:3,y:4},{x:4,y:4},{x:1,y:4}]);
});
