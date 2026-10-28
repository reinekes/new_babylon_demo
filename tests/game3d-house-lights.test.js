import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GameRenderer3D} from '../game3d/renderer.js';
import {lightingAt} from '../city-life.js';
import {houseLightCount} from '../households.js';
import {createHouseLights} from '../game3d/house-lights.js';
import {surfaceElevation} from '../district3d/terrain.js';

const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;
function setup(){
 const engine=new B.NullEngine(),scene=new B.Scene(engine),r=Object.create(GameRenderer3D.prototype),windows=[];
 scene.imageProcessingConfiguration.exposure=1.1;scene.environmentIntensity=.26;
 Object.assign(r,{B,scene,lightMode:'auto',lamps:new Map(),camera:{target:new B.Vector3(33,0,24),radius:50},sun:new B.DirectionalLight('sun',new B.Vector3(-.6,-.8,-.5),scene),fill:new B.HemisphericLight('sky',B.Vector3.Up(),scene),landscape:{light(){}},buildings:{light:n=>windows.push(n)}});
 const state={simTime:10,season:0,rain:0,buildings:Array.from({length:12},(_,x)=>({type:'house',x,y:4,level:1})),citizens:Array.from({length:12},(_,id)=>({id,home:`${id},4`}))};
 return {r,state,scene,windows,points:()=>Array.from(scene.lights).filter(l=>l instanceof B.PointLight),close(){r.houseLights?.dispose();scene.dispose();engine.dispose();}};
}
const active=points=>points.filter(l=>l.isEnabled());
const keys=points=>active(points).map(l=>l.metadata?.houseKey).sort();

test('real Babylon creates no household lights in daylight and still updates emissive windows',()=>{
 const f=setup();try{const before=JSON.stringify(f.state);f.r.updateLight(f.state);assert.equal(f.points().length,0);assert.deepEqual(f.windows,[0]);assert.equal(JSON.stringify(f.state),before);}finally{f.close();}
});

test('night picks six closest occupied completed homes with stable ties and one resident pass',()=>{
 const f=setup();try{
  f.state.simTime=37.5;let reads=0;for(const c of f.state.citizens){const home=c.home;Object.defineProperty(c,'home',{enumerable:true,get(){reads++;return home;}});}
  f.r.updateLight(f.state);assert.equal(active(f.points()).length,6);assert.ok(reads<=f.state.citizens.length,`household reads: ${reads}`);assert.deepEqual(keys(f.points()),['3,4','4,4','5,4','6,4','7,4','8,4']);
  const selected=keys(f.points());f.state.buildings.reverse();f.state.citizens.reverse();f.r.updateLight(f.state);assert.deepEqual(keys(f.points()),selected);
  for(const lamp of active(f.points())){const b=f.state.buildings.find(b=>`${b.x},${b.y}`===lamp.metadata.houseKey);assert.equal(lamp.intensity,lightingAt(37.5).night*houseLightCount(b,1)*3.5);assert.deepEqual(Array.from(lamp.diffuse.asArray()),[1,.6,.22]);}
 }finally{f.close();}
});

test('camera movement reuses six actual point lights; repeated daylight performs no light resync',()=>{
 const f=setup();try{
  const mesh=B.MeshBuilder.CreateBox('lit-ground',{size:1},f.scene);f.state.simTime=37.5;f.r.updateLight(f.state);const ids=new Set(f.points().map(l=>l.uniqueId));
  for(let i=0;i<30;i++){f.r.camera.target.x=(i%12)*6;f.r.updateLight(f.state);assert.ok(active(f.points()).length<=6);assert.equal(f.points().length,6);assert.ok(f.points().every(l=>ids.has(l.uniqueId)));}
  f.r.lightMode='day';f.r.updateLight(f.state);assert.equal(active(f.points()).length,0);assert.ok(mesh.lightSources.every(l=>!(l instanceof B.PointLight)),'disabled lights leave real Babylon mesh light sources');
  let visits=0;const original=mesh._resyncLightSource;mesh._resyncLightSource=function(...args){visits++;return original.apply(this,args);};
  for(let i=0;i<60;i++)f.r.updateLight(f.state);assert.equal(visits,0,'unchanged day must not rescan meshes for already-disabled lamps');
  f.r.lightMode='night';f.r.updateLight(f.state);assert.equal(active(f.points()).length,6);assert.equal(f.points().length,6);assert.ok(f.points().every(l=>ids.has(l.uniqueId)));
 }finally{f.close();}
});

test('forced light modes, occupancy, demolition and pause remain view-only and leak no lights',()=>{
 const f=setup();try{
  f.r.lightMode='night';const saved=JSON.stringify(f.state);f.r.updateLight(f.state);assert.equal(active(f.points()).length,6);const snapshot=()=>JSON.stringify(active(f.points()).map(l=>[l.uniqueId,l.metadata.houseKey,l.position.asArray(),l.intensity]));const frozen=snapshot();
  for(let i=0;i<20;i++)f.r.updateLight(f.state);assert.equal(snapshot(),frozen);assert.equal(JSON.stringify(f.state),saved);
  f.state.citizens=f.state.citizens.filter(c=>c.home==='0,4');f.state.buildings.find(b=>b.x===0).construction={kind:'new'};f.r.updateLight(f.state);assert.equal(active(f.points()).length,0,'empty and unfinished homes have no lights');
  f.state.buildings=[];f.r.updateLight(f.state);assert.equal(active(f.points()).length,0);assert.ok(f.points().length<=6);
  f.r.houseLights.dispose();f.r.houseLights.dispose();assert.equal(f.points().length,0);assert.equal(f.r.lamps.size,0);assert.equal(f.scene.lights.length,2);
 }finally{f.close();}
});

test('100 real PBR twilight frames do not broadcast image-processing dirtiness',t=>{
 const f=setup();try{
  f.r.updateLight(f.state);let notifications=0,dirty=0;const materials=[];
  for(let i=0;i<24;i++){
   const material=new B.PBRMaterial(`twilight-material-${i}`,f.scene),mesh=B.MeshBuilder.CreateBox(`twilight-mesh-${i}`,{size:1},f.scene);mesh.material=material;materials.push(material);
   const original=material._markAllSubMeshesAsImageProcessingDirty;material._markAllSubMeshesAsImageProcessingDirty=function(...args){dirty++;return original.apply(this,args);};
  }
  f.scene.imageProcessingConfiguration.onUpdateParameters.add(()=>notifications++);
  const exposure=f.scene.imageProcessingConfiguration.exposure,environment=f.scene.environmentIntensity,sun=[],fill=[],fog=[];
  for(let i=0;i<100;i++){
   const state={...f.state,simTime:10+27.5*i/99},saved=JSON.stringify(state);f.r.updateLight(state);assert.equal(JSON.stringify(state),saved);sun.push(f.r.sun.intensity);fill.push(f.r.fill.intensity);fog.push(f.scene.fogColor.r);
  }
  t.diagnostic(`Actual Babylon image-processing notifications=${notifications}; PBR dirty calls=${dirty}`);
  assert.equal(notifications,0,'smooth twilight must not invalidate every PBR material');assert.equal(dirty,0);
  assert.equal(f.scene.imageProcessingConfiguration.exposure,exposure);assert.equal(f.scene.environmentIntensity,environment);
  assert.ok(sun[0]>sun.at(-1)*5);assert.ok(fill[0]>fill.at(-1));assert.ok(fog[0]>fog.at(-1));assert.ok(f.windows.some(n=>n>0&&n<1));assert.equal(f.windows.at(-1),1);
 }finally{f.close();}
});

test('forced day, sunset, night and paused repeats keep shared PBR configuration fixed',()=>{
 const f=setup();try{
  f.r.updateLight(f.state);const exposure=f.scene.imageProcessingConfiguration.exposure,environment=f.scene.environmentIntensity;let notifications=0;
  f.scene.imageProcessingConfiguration.onUpdateParameters.add(()=>notifications++);let daytimeSun;
  for(const mode of ['day','sunset','night','night','day']){
   f.r.lightMode=mode;f.r.updateLight(f.state);assert.equal(f.scene.imageProcessingConfiguration.exposure,exposure);assert.equal(f.scene.environmentIntensity,environment);
   if(mode==='day'){daytimeSun=f.r.sun.intensity;assert.equal(active(f.points()).length,0);}if(mode==='night'){assert.ok(f.r.sun.intensity<daytimeSun);assert.equal(active(f.points()).length,6);}
  }
  assert.equal(notifications,0);
 }finally{f.close();}
});

test('Night of Lights decorates every completed building, including empty homes, without adding a light per lamp',()=>{
 const f=setup();try{
  f.state.citizens=[];f.state.buildings=[{type:'house',x:0,y:0,level:1},{type:'brewery',x:1,y:0,level:1},{type:'shrine',x:2,y:0,level:2},{type:'house',x:3,y:0,level:2,construction:{kind:'upgrade'}},{type:'field',x:4,y:0},{type:'canal',x:5,y:0},{type:'bridge',x:6,y:0},{type:'depot',x:7,y:0,construction:{kind:'new'}}];
  f.state.festival={stage:'celebrating',occasion:'nightLights',elapsed:0};
  const before=JSON.stringify(f.state);f.r.updateLight(f.state);const view=f.r.houseLights;
  assert.equal(view.festivalBuildingCount,4,'a citywide celebration includes every completed building, regardless of occupancy');
  assert.ok(view.festivalLampCount>=24,'many visible lamps instead of only six local point lights');
  assert.equal(view.festivalMeshes.length,4,'the whole city shares four instanced batches');
  assert.ok(view.festivalMeshes.every(mesh=>mesh.isEnabled()&&mesh.thinInstanceCount===view.festivalLampCount));
  assert.ok(f.points().length<=6,'real point-light budget remains bounded');assert.equal(active(f.points()).length,4);
  assert.equal(JSON.stringify(f.state),before,'lighting never changes simulation or save data');
 }finally{f.close();}
});

test('festival lamp batches and point lights are reused across 200-building frames and released after the event',()=>{
 const f=setup();try{
  f.state.citizens=[];f.state.buildings=Array.from({length:200},(_,i)=>({type:i%2?'house':'pottery',x:i%20,y:Math.floor(i/20),level:1+i%3}));
  f.state.festival={stage:'celebrating',occasion:'nightLights',elapsed:5};f.r.updateLight(f.state);const view=f.r.houseLights;
  assert.equal(view.festivalBuildingCount,200);assert.ok(view.festivalLampCount>=1200);const ids=(view.festivalMeshes||[]).map(m=>m.uniqueId),meshCount=f.scene.meshes.length,materialCount=f.scene.materials.length;
  for(let i=0;i<40;i++){f.state.festival.elapsed=i;f.r.camera.target.x=i*6;f.r.updateLight(f.state);assert.equal(f.scene.meshes.length,meshCount);assert.equal(f.scene.materials.length,materialCount);assert.deepEqual(view.festivalMeshes.map(m=>m.uniqueId),ids);assert.ok(f.points().length<=6);}
  f.state.buildings.pop();f.r.updateLight(f.state);assert.equal(view.festivalBuildingCount,199);
  f.state.festival=null;f.r.updateLight(f.state);assert.ok(view.festivalMeshes.every(m=>!m.isEnabled()));assert.equal(active(f.points()).length,0);
  view.dispose();assert.ok(view.festivalMeshes.every(m=>m.isDisposed()));assert.equal(f.points().length,0);
 }finally{f.close();}
});

test('preparation and first-beer feasts do not enable the citywide Night of Lights decorations',()=>{
 const f=setup();try{
  const view=createHouseLights(B,f.scene);for(const festival of [null,{stage:'waiting',occasion:'nightLights'},{stage:'supplying',occasion:'nightLights'},{stage:'celebrating',occasion:'firstBeer'}]){f.state.festival=festival;view.update(f.state,0,f.r.camera.target);assert.equal(view.festivalLampCount,0);assert.equal(view.festivalMeshes.length,0);}
  view.dispose();
 }finally{f.close();}
});

test('shoreline festival lamps stay above the building platform instead of sinking to the river bed',()=>{
 const f=setup();try{
  f.state.citizens=[];f.state.buildings=[{type:'fishing',x:14,y:9,level:1}];f.state.festival={stage:'celebrating',occasion:'nightLights',elapsed:10};
  const bed=surfaceElevation(14,9,f.state);assert.ok(bed<-.2,'the existing shoreline building stands above a genuinely lower river bank');
  const before=JSON.stringify(f.state);f.r.updateLight(f.state);const view=f.r.houseLights;
  const bowlPositions=Array.from(view.festivalMeshes[0].thinInstanceGetWorldMatrices(),matrix=>matrix.getTranslation());assert.equal(bowlPositions.length,8);
  for(const position of bowlPositions)assert.ok([position.x,position.y,position.z].every(Number.isFinite)&&position.y>.13,'oil bowls remain above the authored y=0 platform');
  assert.ok(bowlPositions.slice(-2).every(position=>position.y>1.9),'roof lamps follow the authored roof, not the negative shoreline elevation');
  assert.equal(active(f.points())[0].position.y,1.5,'bounded real lights illuminate the same raised platform');assert.equal(JSON.stringify(f.state),before);
 }finally{f.close();}
});

test('large-gate ground lamps clear an unflattened dune at the map edge',()=>{
 const f=setup();try{
  f.state.citizens=[];f.state.buildings=[{type:'ishtarGate',x:0,y:0,level:1,footprint:3}];f.state.festival={stage:'celebrating',occasion:'nightLights',elapsed:10};
  const before=JSON.stringify(f.state);f.r.updateLight(f.state);const positions=Array.from(f.r.houseLights.festivalMeshes[0].thinInstanceGetWorldMatrices(),matrix=>matrix.getTranslation());
  assert.equal(positions.length,6);assert.ok(positions.some(p=>surfaceElevation(p.x/6,p.z/6,f.state)>.4),'large footprints reach genuinely raised, unflattened scenery');
  for(const p of positions){const support=Math.max(0,surfaceElevation(p.x/6,p.z/6,f.state));assert.ok(Math.abs(p.y-support-.14)<1e-6,`ground lamp at ${p.x},${p.z} must clear its dune`);}
  assert.equal(JSON.stringify(f.state),before);
 }finally{f.close();}
});
