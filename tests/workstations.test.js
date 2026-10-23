import test from 'node:test';
import assert from 'node:assert/strict';
import {workstationLayout,workstationFor,workstationWorldPoint,workstationPose} from '../game3d/workstations.js';
const types=['pottery','brewery','weaver','tailor','brickyard','kiln','clay','reed','garden','sheepfold'];
test('real shared equipment supports two reachable nonoverlapping workers at all rotations',()=>{
 for(const type of types)for(let rotation=0;rotation<4;rotation++){
  const b={type,x:6,y:10,rotation,workCorner:[[1,1],[-1,1],[-1,-1],[1,-1]][rotation]},c={id:1,x:6.5,y:10.5,activity:{stage:'working',target:b}};
  const a=workstationFor(b,c,0),d=workstationFor(b,c,1);assert.ok(a&&d,type);
  assert.ok(Math.hypot(a.stand.x-d.stand.x,a.stand.y-d.stand.y)*6>.65,type);
  for(const slot of [a,d]){assert.ok(Math.hypot(c.x-slot.stand.x,c.y-slot.stand.y)<.3);assert.ok(Math.hypot(slot.target.x-slot.stand.x,slot.target.y-slot.stand.y)*6<.7);for(const t of [0,.4,.9,1.3]){const p=workstationPose(slot,t);assert.ok(p.right.every(Number.isFinite));assert.ok(p.left.every(Number.isFinite));}}
  assert.equal(workstationLayout(b).length,1);
 }
});
test('waiting never acquires working contacts and layout rotation follows Babylon +Y',()=>{
 const b={type:'pottery',x:5,y:8,rotation:1};assert.deepEqual(workstationWorldPoint(b,[1,0,0]),{x:5,y:8-1/6,height:0});
 assert.equal(workstationFor(b,{x:5.5,y:8.5,activity:{stage:'waiting'}},0),null);
});
test('real road port chooses one gallery and stationary approach is dry, bounded and read only',async()=>{
 const {createGame}=await import('../engine.js'),{generateStreets}=await import('../city-life.js'),{residentViewPositions}=await import('../game3d/resident-motion.js'),{workstationBuilding}=await import('../game3d/workstations.js');
 const s=createGame({start:'established'});for(const rotation of [0,1,2,3]){
  const b={type:'pottery',x:6,y:10,rotation};s.buildings=[...s.buildings.filter(v=>Math.hypot(v.x-6,v.y-10)>2),b];
  const port=generateStreets(s.buildings,s).ports.find(p=>p.building===b),target=workstationBuilding(b,s),citizens=[1,2].map(id=>({id,age:30,x:port.x,y:port.y,phase:'working',activity:{kind:'pottery',stage:'working',target}}));
  const before=JSON.stringify(s),positions=residentViewPositions(s,citizens);assert.equal(JSON.stringify(s),before);
  assert.equal([...positions.values()].filter(p=>p.contact).length,2);assert.deepEqual(positions,residentViewPositions(s,[...citizens].reverse()));
 }
});
test('every passive artisan/kiln/brick stage keeps equipment idle; active stages acquire contacts',async()=>{
 const {createGame}=await import('../engine.js'),{workplaceActivity,workplaceIndex}=await import('../game3d/work-poses.js');const s=createGame({start:'established'}),c={id:1,age:30,phase:'working',work:'6,10',x:6.5,y:10.5};
 for(const type of ['pottery','brewery'])for(const stage of ['idle','forming','brewing','drying','firing','cooling','ready']){const b={type,x:6,y:10,level:1,artisan:{stage,clay:4,reed:2,food:4,water:3,pottery:1,vesselUses:4}};s.buildings=[b];const a=workplaceActivity(s,c,workplaceIndex(s));assert.equal(a.stage==='working',['forming','brewing','idle'].includes(stage),`${type}/${stage}`);}
 for(const [type,data,active]of [['kiln',{firing:{brick:4,reed:3,hot:0,ready:0,time:0}},true],['kiln',{firing:{brick:0,reed:0,hot:4,ready:0,time:1}},false],['kiln',{firing:{brick:0,reed:0,hot:0,ready:4,time:0}},true],['brickyard',{brickmaking:{clay:4,reed:2,water:2,wet:0,ready:0,time:0}},true],['brickyard',{brickmaking:{clay:0,reed:0,water:0,wet:4,ready:0,time:0}},false]]){const b={type,x:6,y:10,level:1,...data};s.buildings=[b];assert.equal(workplaceActivity(s,c,workplaceIndex(s)).stage==='working',active,JSON.stringify(data));}
});
test('builder contact lies on the real construction corner scaffold, field contact remains at soil edge',()=>{
 const c={x:6.5,y:10.5,phase:'constructing',activity:{stage:'working'}},b={type:'house',x:6,y:10,construction:{target:1}};
 const station=workstationFor(b,c,0);assert.ok(Math.abs((station.target.x-b.x)*6-2.72)<1e-8);assert.ok(Math.abs((station.target.y-b.y)*6-2.72)<1e-8);assert.equal(station.target.height,.95);
 const field=workstationFor({type:'field',x:6,y:10},{...c,activity:{stage:'working',task:'harvesting'}},0);assert.equal(field.target.height,.65);assert.equal(workstationPose(field,0).tool,'sickle');
});
