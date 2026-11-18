import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {canTillField,workField,fieldActive,changeCropSeason} from '../agriculture.js';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';
import {ploughTeams} from '../plough-team.js';
import {createPloughTeams} from '../game3d/plough-teams.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';

test('one independent ox team follows real seed work and field rotation without editing the city',()=>{
 const s=createGame({start:'established',seed:137,scenario:strictScenario()});
 const field=s.buildings.find(b=>b.type==='field');
 field.rotation=1;
 Object.assign(field.crop,{sown:.25,seedStock:2,sheaves:0});
 const worker={id:2,phase:'working',age:24,work:`${field.x},${field.y}`,x:field.x,y:field.y,cargo:{}};
 s.citizens=[{...worker,id:8},worker];
 const before=structuredClone(s);
 const [team]=ploughTeams(s);
 assert.equal(ploughTeams(s).length,1);
 assert.equal(team.driverId,2);
 assert.ok(team.yaw>=Math.PI/2&&team.yaw<Math.PI*1.5);
 assert.equal(team.oxen.length,2);
 assert.ok(team.oxen.every(o=>o.x>team.driver.x&&Math.abs(o.y-field.y)<.5));
 assert.deepEqual(s,before);
 field.crop.sown=.75;
 const returning=ploughTeams(s)[0];
 assert.ok(returning.travelMetres>team.travelMetres+.9);
 assert.ok(returning.yaw>team.yaw);
 assert.ok(Math.abs(returning.y-team.y)>.1, 'the team returns along the next furrow');
 field.crop.seedStock=0;
 assert.deepEqual(ploughTeams(s),[]);
 field.crop.seedStock=1;
 s.season=2;
 assert.deepEqual(ploughTeams(s),[]);
 s.season=0;
 s.scenario=legacyScenario();
 assert.equal(ploughTeams(s).length,1);
});

test('plough view holds two independent rigs and removes the whole team when the work ends',()=>{
 const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
 vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
 const B=sandbox.BABYLON,engine=new B.NullEngine(),scene=new B.Scene(engine);
 const frames=[];
 const source={instantiateModelsToScene(rename){
  const root=B.MeshBuilder.CreateBox(rename('ox'),{},scene),record=[];
  frames.push(record);
  return {rootNodes:[root],skeletons:[],animationGroups:[{name:rename('Walk'),from:0,to:30,start(){},stop(){},pause(){},dispose(){},goToFrame(frame){record.push(frame);}}]};
 }};
 const meshes=[],view=createPloughTeams(B,scene,source,meshes),state=createGame({seed:137});
 const pose={key:'12,8',x:12,y:8,yaw:0,progress:.4,oxen:[{x:11.9,y:8.1},{x:12.1,y:8.1}]};
 try{
  view.update(state,[pose]);view.update(state,[pose]);
  assert.equal(frames.length,2);
  assert.equal(frames[0][0],frames[0][1]);
  assert.notEqual(frames[0][0],frames[1][0]);
  assert.ok(meshes.some(m=>m.name==='plough-yoke'));
  assert.ok(meshes.every(m=>!m.isPickable));
  view.update(state,[{...pose,progress:.6}]);
  assert.notEqual(frames[0][1],frames[0][2]);
  view.update(state,[]);
  assert.equal(meshes.length,0);
  assert.equal(scene.getTransformNodeByName('plough-team-12,8'),null);
 }finally{view.dispose();scene.dispose();engine.dispose();}
});


test('staff can prepare a bare field once before sowing without moving seed or harvest stock',()=>{
 const s=createGame({start:'established',seed:137,scenario:strictScenario()});
 const f=s.buildings.find(b=>b.type==='field');
 for(let i=0;i<1000&&!canTillField(s,f);i++)advanceTime(s,.25);
 const old=structuredClone(f.crop),stock=structuredClone(s.resources),seeds=f.crop.seedStock;
 assert.equal(canTillField(s,f),true);assert.equal(fieldActive(s,f),true);
 workField(s,f,6);assert.equal(f.crop.tilled,.25);
 const saved=encode(s),loaded=decode(saved);assert.ok(loaded);assert.equal(encode(loaded),saved);
 workField(s,f,25);assert.equal(canTillField(s,f),false);assert.deepEqual(s.resources,stock);
 const {tilled,...rest}=f.crop;assert.equal(tilled,1);assert.deepEqual(rest,old);
 s.season=0;changeCropSeason(s,3);assert.equal(f.crop.tilled,undefined);assert.equal(f.crop.seedStock,seeds);
});


test('both oxen and the driver fit the narrow dry slice of the single starter bank plot',()=>{
 const s=createGame({start:'established',scenario:strictScenario()});
 const field=s.buildings.find(b=>b.type==='field');
 assert.ok(renderedShoreDistance(field.x,field.y,s)<.05);
 const farmer={id:8,age:29,phase:'working',work:`${field.x},${field.y}`};
 field.crop.seedStock=3;
 for(const rotation of [0,1,2,3]){
  field.rotation=rotation;let start,last;
  for(let i=0;i<40;i++){
   field.crop.sown=i/40;
   const [p]=ploughTeams(s,[farmer]);assert.ok(p,'team can fit the dry bank');
   for(const point of [p.driver,...p.oxen])assert.ok(renderedShoreDistance(point.x,point.y,s)>.025);
   for(const end of [-1,1])for(const ox of p.oxen){
    const x=ox.x+(Math.cos(p.yaw)*end*.35+Math.sin(p.yaw))/6,y=ox.y+(Math.cos(p.yaw)-Math.sin(p.yaw)*end*.35)/6;
    assert.ok(renderedShoreDistance(x,y,s)>.025,'outer edges of the cattle stay on land');
   }
   start??=p;last=p;
  }
  assert.ok(Math.hypot(last.x-start.x,last.y-start.y)*6>1.40);
 }
});
