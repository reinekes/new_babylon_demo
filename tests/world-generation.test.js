import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode,canPlace} from '../engine.js';
import {initializeGeneratedWorld,initializeWorld,validateWorld,river,terrain,isDryPoint,isShore,bridgeSpan,onBridge,WIDTH,HEIGHT} from '../world.js';
import {networkFor} from '../workforce.js';
import {navigationSegmentClear,shortestWalkingPath} from '../navigation.js';
import {riverRoute,riverEntry,routeBoat,moveBoat,validBoatPoint,isRiverBank} from '../river-trade.js';
import {shoreDistance,alluvialTerrainGeometry} from '../district3d/terrain.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
import {landscapeSignature} from '../game3d/landscape.js';
import {gameBuildingSignature} from '../game3d/buildings.js';

const seeds=[...Array.from({length:180},(_,i)=>i),...Array.from({length:20},(_,i)=>(Math.imul(i+1,2654435761)>>>0)),0xffffffff];

test('hundreds of seeded founding and established maps retain dry connected starts, resources and both relics',()=>{
 const worlds=new Set(),courses=new Set(),lakeSets=new Set();
 for(const seed of seeds){
  for(const start of ['beehives','established']){
   const s=createGame({seed,start}),context=`${seed}/${start}`;
   assert.ok(validateWorld(s),context);assert.equal(s.world.seed,seed);assert.ok(s.world.lakes.length>=3&&s.world.lakes.length<=5,context);
   assert.ok(s.relicQuest&&s.landRelicQuest,`both relics ${context}`);
   assert.ok(s.buildings.every(b=>isDryPoint(s,b.x,b.y)),`dry starts ${context}`);
   assert.ok(s.buildings.filter(b=>b.type==='field').every(b=>terrain(b.x,b.y,s)==='fertile'),`fertile fields ${context}`);
   const net=networkFor(s),ports=net.ports.filter(p=>p.building.type==='house');
   assert.equal(ports.length,s.buildings.filter(b=>b.type==='house').length,context);
   assert.equal(new Set(ports.map(p=>net.components.get(p.key))).size,1,context);
   for(const left of [true,false])for(const kind of ['clay','reed','dates','forest','wildlife','stone']){
    const sites=s.world.deposits.filter(d=>d.kind===kind&&(d.x<river(d.y,s))===left);
    assert.ok(sites.length>=(['clay','reed','dates'].includes(kind)?2:1),`${kind}/${left}/${context}`);
    assert.ok(sites.every(d=>isDryPoint(s,d.x,d.y)),context);
    if(left)assert.ok(sites.some(d=>[[0,0],[1,0],[0,1],[1,1]].some(([dx,dy])=>net.components.get(`${d.x+dx},${d.y+dy}`)===net.components.get(ports[0].key))),`reachable ${kind}/${context}`);
    if(kind==='reed')assert.ok(sites.every(d=>isShore(s,d.x,d.y)),context);
   }
   const restored=decode(encode(s));assert.ok(restored,context);assert.deepEqual(restored.world,s.world,context);assert.deepEqual(restored.citizens,s.citizens,context);
   if(start==='beehives'){worlds.add(JSON.stringify(s.world));courses.add(JSON.stringify(s.world.river));lakeSets.add(JSON.stringify(s.world.lakes));}
  }
 }
 assert.equal(worlds.size,seeds.length);assert.equal(courses.size,seeds.length);assert.equal(lakeSets.size,seeds.length);
});

test('same seed is deterministic and loading a world never rerolls its geography',()=>{
 const a=createGame({seed:187436}),b=createGame({seed:187436});assert.deepEqual(a.world,b.world);
 const before=JSON.stringify(a.world);initializeWorld(a);initializeGeneratedWorld(a,999);assert.equal(JSON.stringify(a.world),before);
 const legacy=createGame(),legacyWorld=JSON.stringify(legacy.world);assert.equal(legacy.world.river,undefined);
 for(let y=-.5;y<HEIGHT;y+=.125)assert.equal(river(y,legacy),16-y*.27+Math.sin(y*.55)*.7);
 assert.equal(JSON.stringify(decode(encode(legacy)).world),legacyWorld);
});

test('new river descriptors are validated strictly without accepting malformed saved geometry',()=>{
 const source=createGame({seed:7});
 for(const mutate of [w=>w.river=null,w=>w.river=[],w=>w.river.offset=1e9,w=>w.river.phase=NaN,w=>w.river.slope='0',w=>w.river.extra=true,w=>w.seed=-1,w=>w.seed=2**32,w=>w.generationVersion=2,w=>delete w.river]){
  const s=structuredClone(source);mutate(s.world);assert.equal(validateWorld(s),false);assert.equal(decode(encode(s)),null);
 }
 for(const seed of [-1,2**32,.5,NaN,Infinity,'9'])assert.throws(()=>initializeGeneratedWorld({buildings:[]},seed),RangeError);
});

test('seeded bridges connect the generated banks, not the legacy river',()=>{
 const s=createGame({seed:96}),row=20,x=Math.round(river(row,s)),bridge={type:'bridge',x,y:row,level:1};
 assert.equal(canPlace(s,'bridge',x,row),'');s.buildings.push(bridge);
 const span=bridgeSpan(row,s);assert.ok(Math.abs(span.left-bridgeSpan(row).left)>2);
 const a={x:span.left,y:span.y},b={x:span.right,y:span.y};
 assert.ok(onBridge(s.buildings,river(span.y,s),span.y,s));assert.ok(navigationSegmentClear(s,a,b));
 const net=networkFor(s),path=shortestWalkingPath(net,`${a.x+.5},${a.y+.5}`,`${b.x+.5},${b.y+.5}`);assert.ok(path?.length>2);
 assert.ok(path.every((p,i)=>!i||navigationSegmentClear(s,path[i-1],p)));
});

test('boat routes and validation follow the stored generated river through partial moves',()=>{
 const s=createGame({seed:96}),c={...riverEntry(s)};routeBoat(c,HEIGHT-1,'arriving',s);
 assert.ok(c.route.every(p=>validBoatPoint(p,s)));assert.ok(!validBoatPoint(c));
 for(let i=0;i<100;i++){moveBoat(c,.037,s);assert.ok(validBoatPoint(c,s));}
 assert.deepEqual(riverRoute(-.5,HEIGHT-1,s),c.route);
 const banks=[];for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)if(isRiverBank(s,x,y))banks.push({x,y});
 assert.ok(banks.length>40);assert.ok(banks.some(p=>!isRiverBank(createGame(),p.x,p.y)));
});

test('terrain, rendered shore and visual cache signatures change with the saved river',()=>{
 const s=createGame({seed:96}),other=structuredClone(s);other.world.river.offset+=.1;
 for(let y=.5;y<HEIGHT-.5;y+=1){assert.ok(shoreDistance(river(y,s),y,s)<0);assert.ok(renderedShoreDistance(river(y,s),y,s)<0);}
 assert.notEqual(landscapeSignature(s),landscapeSignature(other));
 const bridge={type:'bridge',x:20,y:20,level:1};assert.notEqual(gameBuildingSignature(bridge,s),gameBuildingSignature(bridge,other));
 const a=alluvialTerrainGeometry(s),b=alluvialTerrainGeometry(other);assert.notDeepEqual(a.positions,b.positions);
});
