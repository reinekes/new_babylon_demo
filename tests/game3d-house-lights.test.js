import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {GameRenderer3D} from '../game3d/renderer.js';
import {lightingAt} from '../city-life.js';
import {houseLightCount} from '../households.js';

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
