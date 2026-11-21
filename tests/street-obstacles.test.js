import test from 'node:test';
import assert from 'node:assert/strict';
import {footpathId,footpathRibbonPoint,streetCurveLookup,residentFootpathPositions} from '../footpaths.js';
import {streetCrossSections,streetSurfaceLayout} from '../street-surfaces.js';
const a={x:9.5,y:9.5},b={x:10.5,y:10.5},site={kind:'stone',x:10,y:10};
const roads=[{a,b,id:footpathId(a,b),level:1,built:true}];
const state=()=>({buildings:[],world:{seed:73129,lakes:[],deposits:[site]},footpaths:[{a,b,wear:32,at:0}],simTime:0});

test('a saved diagonal rounds its stone outcrop in both directions with the walker on the street and soil clear of rock',()=>{
 const town=state(),raw=JSON.stringify(town);
 for(const paved of [[],roads]){
  const shape=streetSurfaceLayout(town,paved).get(roads[0].id);
  const position=residentFootpathPositions(town);
  const rows=streetCrossSections(town,a,b,shape,shape.control,undefined,32);
  assert.equal(rows.length,33);
  for(const row of rows){
   const t=row.t,point=row.p,reverse=footpathRibbonPoint(b,a,streetCurveLookup(town)(b,a),1-t);
   const actor=position({route:[a,b],routeIndex:1,x:a.x+t,y:a.y+t});
   assert.ok(Math.hypot(point.x-site.x,point.y-site.y)>.5,'walking clearance around an outcrop');
   assert.ok(Math.hypot(point.x-reverse.x,point.y-reverse.y)<1e-7);
   assert.ok(Math.hypot(point.x-actor.x,point.y-actor.y)<1e-7);
   for(const side of [-1,1]){
    const distance=side*row.reach*(side<0?row.left*row.trimLeft:row.right*row.trimRight);
    assert.ok(Math.hypot(point.x+row.nx*distance-site.x,point.y+row.nz*distance-site.y)>.40,'outer shoulder clears the stone');
   }
  }
 }
 assert.equal(JSON.stringify(town),raw);
});

test('the visible tree displaces one shared junction for its branches and survives laying a street',async()=>{
 const {roadsideNature}=await import('../street-obstacles.js');
 const town=state();town.world.deposits=[];town.gathering={features:[{id:'tree:3,4:0',kind:'tree',x:9.5,y:9.5,health:1}]};
 const get=streetCurveLookup(town),west={x:8.5,y:9.5},north={x:9.5,y:8.5};
 const node=footpathRibbonPoint(a,b,get(a,b),0);
 assert.ok(Math.hypot(node.x-a.x,node.y-a.y)>.20);
 for(const from of [west,north])assert.deepEqual(footpathRibbonPoint(from,a,get(from,a),1),node);
 town.roads=roads;
 assert.equal(roadsideNature(town).features[0].id,'tree:3,4:0');
 const steps=streetSurfaceLayout(town,roads).get(roads[0].id);
 assert.deepEqual(footpathRibbonPoint(a,b,steps.control,0),node);
 // A fallen palm leaves a stump. Removing the source frees the junction.
 town.gathering.features[0].health=0;assert.equal(get.revision,streetCurveLookup(town).revision);
 town.gathering.features=[];assert.notEqual(get.revision,streetCurveLookup(town).revision);
});

test('reeds and small debris leave the same route; exhausting a stone deposit releases its original ground',()=>{
 const town=state();town.scenario={version:1,history:'sumer-iii-v1',miracles:'classic-v1'};
 const saved=streetCurveLookup(town),obstructed=footpathRibbonPoint(a,b,saved(a,b),.5);
 town.stonePits={'10,10':0};
 const cleared=streetCurveLookup(town),point=footpathRibbonPoint(a,b,cleared(a,b),.5);
 assert.ok(Math.hypot(point.x-obstructed.x,point.y-obstructed.y)>.25);
 town.world.deposits=[{kind:'reed',x:10,y:10}];town.gathering={features:[{kind:'grass',x:10,y:10}]};
 const soft=streetCurveLookup(town);assert.deepEqual(footpathRibbonPoint(a,b,soft(a,b),.5),point);
});

test('ruts and pushed wheels clear the close pair of a rock deposit and date grove in either direction',async()=>{
 const {createGame,build}=await import('../engine.js'),{strictScenario}=await import('../scenario-profiles.js');
 const {recordFootsteps}=await import('../footpaths.js'),{roadsideNature}=await import('../street-obstacles.js');
 const {streetWheelSection}=await import('../street-surfaces.js');
 const town=createGame({seed:137,start:'established',scenario:strictScenario()});
 assert.ok(build(town,'field',11,11,0,{instant:true}).ok);
 for(let i=0;i<32;i++)recordFootsteps(town,a,b,Math.SQRT2,undefined,i<6);
 const profile=streetSurfaceLayout(town,[]).get(footpathId(a,b));
 const nearby=roadsideNature(town).solids.filter(o=>Math.hypot(o.x-10,o.y-10)<2);
 let rut=Infinity,wheels=Infinity;
 for(const row of streetCrossSections(town,a,b,profile,profile.control,undefined,128)){
  const wheel=streetWheelSection(profile,row);
  for(const o of nearby){
   const x=(o.x-row.p.x)*6,z=(o.y-row.p.y)*6,along=x*row.nz-z*row.nx,across=x*row.nx+z*row.nz;
   for(const sign of [-1,1]){
    const width=row.half*(sign<0?row.left*row.trimLeft:row.right*row.trimRight);
    rut=Math.min(rut,Math.hypot(along,across-sign*width*(wheel.gauge+wheel.rim))-o.radius*6);
    // Fore and aft directions, 1.23 m axle offset, .40 m discs and both hubs.
    const longitudinal=Math.max(0,Math.abs(Math.abs(along)-1.23)-.40),lateral=Math.max(0,Math.abs(across-sign*.493)-.122);
    wheels=Math.min(wheels,Math.hypot(longitudinal,lateral)-o.radius*6);
   }
  }
 }
 assert.ok(rut>.20&&wheels>.20,`clearance in metres: rut ${rut}, wheels ${wheels}`);
});

test('every finished verge and civic entrance keeps its full edges clear of a natural clay outcrop',async()=>{
 const {createGame,build}=await import('../engine.js'),{strictScenario}=await import('../scenario-profiles.js');
 const {recordFootsteps}=await import('../footpaths.js'),{solidClearance}=await import('../street-obstacles.js');
 const {wornRoadGeometry}=await import('../game3d/water.js'),{civicEntranceBricks}=await import('../civic-entrance-bricks.js');
 const town=createGame({seed:137,start:'established',scenario:strictScenario()});
 const clay=town.world.deposits.find(d=>d.kind==='clay'&&d.x===9&&d.y===7),rock={...clay,radius:.395};
 assert.ok(clay);
 const a={x:8.5,y:7.5},b={x:9.5,y:7.5},id=footpathId(a,b);
 for(let i=0;i<40;i++)recordFootsteps(town,a,b,1,undefined,i<10);
 for(const level of [0,1,2,3]){
  const paved=level?[{a,b,id,level,built:true}]:[];
  const profile=streetSurfaceLayout(town,paved).get(id);
  const mesh=wornRoadGeometry(town,a,b,profile,.04,level||1,level?2:.85,profile.control);
  assert.ok(mesh.indices.length);
  const vertex=i=>({x:(mesh.origin.x+mesh.positions[i*3])/6,y:(mesh.origin.z+mesh.positions[i*3+2])/6});
  for(let j=0;j<mesh.indices.length;j+=3)for(let k=0;k<3;k++){
   const p=vertex(mesh.indices[j+k]),q=vertex(mesh.indices[j+(k+1)%3]);
   assert.ok(solidClearance(rock,p,q)>.01,'the entire triangle edge stays clear, including a straight axis');
  }
 }
 assert.ok(build(town,'shrine',9,6,0,{instant:true}).ok);
 const bricks=civicEntranceBricks(town).filter(brick=>Math.hypot(brick.at.x-9,brick.at.y-6)<2);
 assert.ok(bricks.length>0);
 for(const {polygon} of bricks)for(let i=0;i<polygon.length;i++){
  assert.ok(solidClearance(rock,polygon[i],polygon[(i+1)%polygon.length])>.02);
 }
 const {landscapeSignature}=await import('../game3d/landscape.js');
 const before=landscapeSignature(town);town.clayPits={...town.clayPits,'9,7':0};
 assert.notEqual(landscapeSignature(town),before);
 assert.ok(civicEntranceBricks(town).filter(brick=>Math.hypot(brick.at.x-9,brick.at.y-6)<2).length>bricks.length);
});
