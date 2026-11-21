import test from 'node:test';
import assert from 'node:assert/strict';
import {civicBrickCanvasLayer,civicBrickGeometry,civicEntranceBricks} from '../civic-entrance-bricks.js';
import {strictScenario} from '../scenario-profiles.js';
import {footprintSize} from '../footprints.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';

const world={lakes:[],river:{axis:'y',offset:24,slope:0,amplitude:0,frequency:.1,phase:0}};
const state=(building,others=[])=>({world,scenario:strictScenario(),buildings:[building,...others]});
const civic={type:'communalHouse',level:1,footprint:2,x:5,y:6};

test('thresholds rotate about the actual gate or temple stair, including the archive single-cell monument',()=>{
 for(const b of [civic,{...civic,type:'shrine',footprint:1},{...civic,type:'ziggurat'},{...civic,type:'ziggurat',footprint:undefined}]){
  const offset=(footprintSize(b)-1)*.5,cx=b.x+offset,cy=b.y+offset;
  const regular=civicEntranceBricks(state(b));assert.ok(regular.length>35);
  const near=b.type==='shrine'?1.75:offset?5.28:2.5;
  assert.ok(regular.every(brick=>brick.at.y>=cy+near/6));
  for(let turn=1;turn<=3;turn++){
   const rotated=civicEntranceBricks(state({...b,rotation:turn}));
   assert.equal(rotated.length,regular.length);
   for(let i=0;i<regular.length;i++){
    let x=regular[i].at.x-cx,y=regular[i].at.y-cy;
    for(let times=0;times<turn;times++)[x,y]=[y,-x];
    assert.ok(Math.abs(rotated[i].at.x-cx-x)<1e-9&&Math.abs(rotated[i].at.y-cy-y)<1e-9);
   }
  }
 }
});

test('only completed civic plots show brickwork; adjoining fields, channels and shore stay clear',()=>{
 for(const b of [{...civic,type:'house'},{...civic,type:'market'},{...civic,construction:{kind:'new'}}])assert.deepEqual(civicEntranceBricks(state(b)),[]);
 assert.deepEqual(civicEntranceBricks(state({...civic,construction:{kind:'upgrade'}})),civicEntranceBricks(state(civic)));
 const shrine={...civic,type:'shrine',footprint:1},open=civicEntranceBricks(state(shrine));
 for(const type of ['field','canal']){
  const blocked=civicEntranceBricks(state(shrine,[{x:5,y:7,type}]));
  assert.ok(blocked.length && blocked.length<open.length);
  assert.ok(blocked.every(b=>b.polygon.every(p=>p.y<6.5)));
 }
 const s=state({...shrine,x:22,rotation:1});
 const coast=civicEntranceBricks(s);
 assert.ok(coast.length && coast.length<open.length);
 for(const brick of coast)for(const p of brick.polygon)assert.ok(renderedShoreDistance(p.x,p.y,s)>.22);
});

test('one indexed mesh and the canvas painter use the same deterministic set of hand-laid faces',()=>{
 const s=state(civic),before=JSON.stringify(s),bricks=civicEntranceBricks(s);
 const g=civicBrickGeometry(bricks,s),faces=[];
 civicBrickCanvasLayer(bricks)({point:(x,y)=>[x,y],polygon:(face,shade)=>faces.push([face,shade])});
 assert.equal(faces.length,bricks.length);assert.ok(new Set(faces.map(f=>f[1])).size>=4);
 assert.equal(g.positions.length/3,g.colors.length/4);
 assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<g.positions.length/3));
 assert.equal(g.indices.length%3,0);
 assert.ok(g.positions.every(Number.isFinite));assert.equal(JSON.stringify(s),before);
});

test('the temple runner meets the lowest stair and its raised faces clear a crossing paved road',()=>{
 const b={...civic,type:'ziggurat',rotation:0},s=state(b),bricks=civicEntranceBricks(s);
 const first=bricks.filter(({at})=>(at.y-b.y-.5)*6<5.60);
 assert.ok(first.length>=3);
 const front=first.flatMap(({polygon})=>polygon);
 const x=(p)=>(p.x-b.x-.5)*6,z=(p)=>(p.y-b.y-.5)*6;
 assert.ok(Math.min(...front.map(z))<5.4&&Math.max(...front.map(z))>5.4);
 assert.ok(Math.min(...front.map(x))<-.85&&Math.max(...front.map(x))>.85);
 // Road upgrades at this crossing can reach .063 m plus .012 m of crown.
 assert.ok(civicBrickGeometry(first,s).positions.filter((v,i)=>i%3===1).every(y=>y>.075));
});
