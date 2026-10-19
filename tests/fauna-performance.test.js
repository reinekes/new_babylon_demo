import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {animalsFor} from '../fauna.js';
test('habitats are reused between animation frames and invalidated by occupied tiles',()=>{
 const s=createGame();let reads=0;for(const lake of s.world.lakes){const cells=lake.cells;Object.defineProperty(lake,'cells',{get(){reads++;return cells;}});}
 const first=animalsFor(s),cold=reads;reads=0;s.simTime+=.1;const next=animalsFor(s);
 assert.ok(reads<cold/4,`warm habitat reads ${reads}, cold ${cold}`);
 assert.deepEqual(next.map(a=>a.id),first.map(a=>a.id));assert.notDeepEqual(next,first);
 const a=next[0],x=Math.round(a.x),y=Math.round(a.y);s.buildings.push({type:'house',x,y});
 assert.ok(animalsFor(s).every(a=>Math.round(a.x)!==x||Math.round(a.y)!==y));
 s.buildings.pop();s.simTime-=.1;assert.deepEqual(animalsFor(s),first);
});
