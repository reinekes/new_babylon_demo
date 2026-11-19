import test from 'node:test';
import assert from 'node:assert/strict';
import {ambientClearSegment,penClearance} from '../game3d/ambient-fauna.js';

test('herd route search agrees with live collision checks, including footprint edges and the shore',()=>{
 const state={buildings:[
  {type:'house',x:4,y:5},{type:'canal',x:6,y:6},{type:'sheepfold',footprint:2,x:8,y:5},
  {type:'ishtarGate',footprint:3,x:8,y:9},{type:'quarry',x:5,y:9}
 ]};
 function compare(){
  const indexed=penClearance(state);
  for(let x=0;x<=25;x+=.37)for(let y=3;y<13;y+=.43){
   const a={x,y},b={x:x+1.19,y:y-.63};
   assert.equal(indexed(state,a,b),ambientClearSegment(state,a,b));
  }
  for(const b of state.buildings)for(const r of [.36,.72]){
   for(const delta of [-1e-8,0,1e-8]){
    const a={x:b.x-r+delta,y:b.y};
    assert.equal(indexed(state,a,a),ambientClearSegment(state,a,a));
   }
  }
 }
 compare();
 state.buildings[2].x=14;
 state.buildings[3].footprint=1;
 state.buildings.splice(0,1,{type:'cityGate',footprint:2,x:7,y:4});
 compare();
});
