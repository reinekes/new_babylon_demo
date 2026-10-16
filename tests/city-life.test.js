import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame,build,WIDTH,HEIGHT,river} from '../engine.js';
import {generateStreets,makeWalkers,walkerAt,sortScene,lightingAt,DAY_SECONDS} from '../city-life.js';
const onLand=p=>Math.abs(p.x-river(p.y))>=1.25;
test('streets connect every initial building and avoid the river and building interiors',()=>{
 const s=createGame(), roads=generateStreets(s.buildings);
 assert.equal(roads.ports.length,s.buildings.length);assert.ok(roads.edges.length>0);
 for(const [a,b] of roads.edges){assert.equal(Math.abs(a.x-b.x)+Math.abs(a.y-b.y),1);assert.ok(onLand(a)&&onLand(b)&&onLand({x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
 for(const p of [a,b,{x:(a.x+b.x)/2,y:(a.y+b.y)/2}])for(const house of s.buildings)assert.ok(Math.abs(p.x-house.x)>=.49||Math.abs(p.y-house.y)>=.49);}
 assert.equal(new Set(roads.ports.map(p=>roads.components.get(p.key))).size,1);
});
test('building a distant house automatically extends roads, with no resource charge beyond house',()=>{
 const s=createGame(),before=generateStreets(s.buildings),r=structuredClone(s.resources);assert.ok(build(s,'house',2,3).ok);
 const after=generateStreets(s.buildings);assert.ok(after.edges.length>before.edges.length);assert.equal(after.ports.length,6);assert.equal(s.resources.clay,r.clay-12);assert.equal(s.resources.reed,r.reed-8);
 assert.deepEqual(after.edges,generateStreets(s.buildings).edges);
});
test('opposite riverbanks use separate streets and never create a bridge through water',()=>{
 const streets=generateStreets([{type:'house',x:4,y:4},{type:'shrine',x:7,y:6},{type:'house',x:20,y:4},{type:'house',x:20,y:9}]);
 for(const [a,b] of streets.edges)assert.ok(onLand({x:(a.x+b.x)/2,y:(a.y+b.y)/2}));
 assert.equal(new Set(streets.ports.map(p=>streets.components.get(p.key))).size,2);
});
test('daytime crowd reflects population and every walker follows connected road segments',()=>{
 const roads=generateStreets(createGame().buildings),walkers=makeWalkers(roads,36);assert.equal(walkers.length,36);
 for(const agent of walkers)for(let t=0;t<90;t+=.71){const p=walkerAt(agent,t);assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));assert.ok(roads.edges.some(([a,b])=>Math.abs((p.x-a.x)*(b.y-a.y)-(p.y-a.y)*(b.x-a.x))<1e-7&&p.x>=Math.min(a.x,b.x)-1e-7&&p.x<=Math.max(a.x,b.x)+1e-7&&p.y>=Math.min(a.y,b.y)-1e-7&&p.y<=Math.max(a.y,b.y)+1e-7));}
 assert.equal(makeWalkers(roads,0).length,0);
});
test('depth order places walkers behind buildings before them and front walkers after them',()=>{
 const house={kind:'building',type:'house',x:9,y:8},behind={kind:'person',x:9,y:7.5,id:1},front={kind:'person',x:9.5,y:8.5,id:2};
 assert.deepEqual(sortScene([front,house,behind]),[behind,house,front]);
});
test('day and night loop smoothly and remain independent of the economy state',()=>{
 const s=createGame(),before=JSON.stringify(s),day=lightingAt(DAY_SECONDS/6),night=lightingAt(DAY_SECONDS*2/3);assert.equal(day.night,0);assert.equal(night.night,1);assert.deepEqual(lightingAt(0),lightingAt(DAY_SECONDS));
 for(let t=0;t<DAY_SECONDS;t+=.1){const a=lightingAt(t),b=lightingAt(t+.1);assert.ok(a.night>=0&&a.night<=1);assert.ok(Math.abs(a.night-b.night)<.03);}
 assert.equal(JSON.stringify(s),before);
});
test('walkers along BOTH front side streets stay in front, rear side streets stay hidden',()=>{
 const house={kind:'building',type:'house',x:9,y:8};
 for(let f=.05;f<1;f+=.05){
  for(const person of [{kind:'person',x:9.5,y:7.5+f},{kind:'person',x:8.5+f,y:8.5}])assert.equal(sortScene([person,house])[0],house,'front-side walker must be painted after house');
  for(const person of [{kind:'person',x:8.5,y:7.5+f},{kind:'person',x:8.5+f,y:7.5}])assert.equal(sortScene([house,person])[0],person,'rear-side walker must be painted before house');
 }
});
