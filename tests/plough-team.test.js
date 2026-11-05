import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {createGame} from '../engine.js';
import {strictScenario,legacyScenario} from '../scenario-profiles.js';
import {ploughTeams} from '../plough-team.js';
import {createPloughTeams} from '../game3d/plough-teams.js';

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
 assert.equal(team.yaw,Math.PI/2);
 assert.equal(team.oxen.length,2);
 assert.ok(team.oxen.every(o=>o.x>team.driver.x&&Math.abs(o.y-field.y)<.5));
 assert.deepEqual(s,before);
 field.crop.sown=.75;
 assert.ok(ploughTeams(s)[0].x>team.x);
 field.crop.seedStock=0;
 assert.deepEqual(ploughTeams(s),[]);
 field.crop.seedStock=1;
 s.season=2;
 assert.deepEqual(ploughTeams(s),[]);
 s.season=0;
 s.scenario=legacyScenario();
 assert.deepEqual(ploughTeams(s),[]);
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
