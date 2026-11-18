import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {mineralDepositGeometry,mineralExcavations,mineralPitGeometry} from '../game3d/mineral-excavation.js';
import {createDistrictTerrain} from '../district3d/terrain.js';
import {createArchitecture} from '../game3d/architecture.js';
import {createGame} from '../engine.js';
import {strictScenario} from '../scenario-profiles.js';
import {renderedShoreDistance} from '../game3d/shore-profile.js';
const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function fixture(){
 const s=createGame({start:'established',seed:137,scenario:strictScenario()});
 s.world.lakes=[];s.buildings=[];s.roadAnchors=[];s.roads=[];
 s.world.deposits=[{kind:'stone',x:7,y:7},{kind:'clay',x:10,y:7}];
 return s;
}
function palette(scene){return Object.fromEntries(['soil','grass','wood','reed','stone','raw','fired','plaster','shade','linen','terracotta','trim','reedRoof','brick'].map(k=>[k,new B.PBRMaterial('test-'+k,scene)]));}

test('native 1x1 and 2x2 clay and stone work yards really merge all material groups',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),m=palette(scene),s=fixture();
 try{for(const type of ['clay','quarry'])for(const footprint of [1,2])for(const rotation of [0,1,2,3]){
  const b={type,rotation,x:7,y:7,level:1,footprint,deposit:{x:7,y:7}};s.buildings=[b];
  const meshes=createArchitecture(B,scene,b,m,s);assert.ok(meshes.length>=2);assert.ok(meshes.every(q=>q.getTotalIndices()>0));
  for(const mesh of meshes)mesh.dispose();
 }}finally{scene.dispose();engine.dispose();}
});

test('a physical excavation exposes the same rock at depth at every stock level and leaves the top surface open',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),m=palette(scene),s=fixture(),p=s.world.deposits[0];let view;
 function exposure(){return view.meshes.find(n=>n.metadata?.resourceSite?.kind==='stone'&&n.sourceMesh);}
 function shoot(mesh,x,z){return new B.Ray(new B.Vector3(x,8,z),new B.Vector3(0,-1,0)).intersectsMesh(mesh).pickedPoint?.y;}
 try{
  s.stonePits={'7,7':104};const before=JSON.stringify(s);view=createDistrictTerrain(B,scene,s,m);
  const outside=exposure(),outY=outside.position.y,scale=outside.scaling.asArray(),yaw=outside.rotation.y;
  const vertices=outside.getVerticesData(B.VertexBuffer.PositionKind);assert.ok(vertices.length>800);assert.equal(JSON.stringify(s),before);
  view.dispose();s.buildings=[{type:'quarry',x:p.x,y:p.y,footprint:2,rotation:1,deposit:{x:p.x,y:p.y}}];const open=JSON.stringify(s);
  view=createDistrictTerrain(B,scene,s,m);const ore=exposure(),bed=view.meshes.find(x=>x.name==='alluvial-valley'),floor=view.meshes.find(x=>x.metadata?.mineralCut?.role==='bowl');
  const pit=mineralExcavations(s)[0];assert.ok(pit.extensionX||pit.extensionY);assert.equal(ore.rotation.y,yaw);assert.deepEqual(ore.scaling.asArray(),scale);assert.deepEqual(ore.getVerticesData(B.VertexBuffer.PositionKind),vertices);
  assert.equal(ore.position.y,-pit.depth);assert.ok(outY>=0);assert.ok(Math.abs(shoot(floor,p.x*6,p.y*6)+pit.depth)<1e-5);
  for(const c of [[p.x,p.y],[p.x+pit.extensionX,p.y+pit.extensionY]])for(const dx of [-2.5,0,2.5])for(const dz of [-2.5,0,2.5])assert.equal(shoot(bed,c[0]*6+dx,c[1]*6+dz),undefined);
  assert.equal(JSON.stringify(s),open);s.stonePits['7,7']=0;view.update(s,0);assert.equal(ore.isEnabled(),false);assert.ok(floor.isEnabled());
 }finally{view?.dispose();scene.dispose();engine.dispose();}
});

test('the riverbank remains above the water along the clay pit lip; a wet fallback extension is rejected',()=>{
 const s=fixture();s.world.river={axis:'y',offset:15,slope:0,phase:0,amplitude:0,frequency:.12};
 s.world.deposits=[{kind:'clay',x:17,y:7}];s.buildings=[{type:'clay',x:16,y:7,footprint:2,deposit:{x:17,y:7}}];
 const pit=mineralExcavations(s)[0];assert.equal(pit.extensionX,0);assert.equal(pit.extensionY,1);
 const g=mineralPitGeometry(pit);for(let i=0;i<g.positions.length;i+=3)if(g.positions[i+1]<-.1)assert.ok(renderedShoreDistance(pit.x+g.positions[i]/6,pit.y+g.positions[i+2]/6,s)>.02);
 // A simultaneous second vein gets a separate floor, with no ramp annex over it.
 s.world.deposits.push({kind:'clay',x:17,y:8});assert.ok(mineralExcavations(s).every(p=>!p.extensionX&&!p.extensionY));
 for(const kind of ['stone','clay']){const src=mineralDepositGeometry(kind);assert.ok(src.positions.every(Number.isFinite));assert.ok(Math.max(...src.positions)>1.6);}
});

test('residents follow the visible quarry floor and the surface of a diminishing seam',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),s=fixture();
 s.buildings=[{type:'quarry',x:7,y:7,footprint:2,deposit:{x:7,y:7}}];
 const view=createDistrictTerrain(B,scene,s,palette(scene));
 try{
  const pit=mineralExcavations(s)[0],x=7,y=7,ground=0;
  const top=view.mineralHeightAt(x,y,ground);
  assert.ok(top<-.4&&top>-pit.depth+.2,`top of the seam ${top}`);
  const toe=view.mineralHeightAt(x+pit.extensionX*.6,y+pit.extensionY*.6,ground);
  assert.ok(toe<-.5,'the shoulder inside the neighbouring cell descends too');
  assert.equal(view.mineralHeightAt(10,10,.7),.7);
  s.stonePits={'7,7':0};view.update(s,0);
  assert.ok(Math.abs(view.mineralHeightAt(x,y,ground)+pit.depth)<1e-4,'the emptied pit exposes the floor underfoot');
 }finally{view.dispose();scene.dispose();engine.dispose();}
});
