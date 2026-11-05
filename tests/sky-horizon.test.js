import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import vm from 'node:vm';
import {DAY_SECONDS} from '../city-life.js';
import {GameRenderer3D} from '../game3d/renderer.js';
import {alluvialSceneryGeometry} from '../district3d/terrain.js';
import {bindAtmosphere} from '../game3d/atmosphere.js';

const file=new URL('../game3d/sky-horizon.js',import.meta.url);
const load=async()=>{assert.ok(existsSync(file),'visible celestial sky and horizon extension must exist');return import(file.href);};
const seconds=hour=>(hour-8)*DAY_SECONDS/24;
const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
const state=size=>({simTime:10,buildings:[],citizens:[],...(size===64?{world:{width:64,height:64,generationVersion:2,seed:32,river:{axis:'x',flowSign:-1,offset:30,slope:.04,amplitude:1,frequency:.12,phase:1},lakes:[]}}:{})});

test('directional light fades through sunrise and sunset without a sun/moon intensity jump',async()=>{
 const {celestialAt}=await load();
 for(const hour of [6,18]){
  const before=celestialAt(seconds(hour-.00001)),at=celestialAt(seconds(hour)),after=celestialAt(seconds(hour+.00001));
  assert.ok(Math.abs(before.light.intensity-after.light.intensity)<1e-6,`light jumps at hour${hour}`);
  assert.ok(at.light.intensity<1e-8,'opposed artistic sun/moon are both at the horizon, direct light is dark');
 }
 assert.ok(celestialAt(seconds(12)).light.intensity>3,'daytime direct light remains bright');
 assert.ok(celestialAt(seconds(0)).light.intensity>.2,'high moon still illuminates night');
});

test('custom water fog receives exactly the linear fog colour bound by real Babylon PBR',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine);try{
  scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogColor=B.Color3.FromHexString('#252f42');
  let expected;B.MaterialHelper.BindFogParameters(scene,null,{setFloat4(){},setColor3(name,c){if(name==='vFogColor')expected={r:c.r,g:c.g,b:c.b};}},true);
  const material=new B.ShaderMaterial('qa-water',scene,{vertex:'unused',fragment:'unused'},{uniforms:[]});bindAtmosphere(scene,material);
  const actual=material._colors3.valleyFogColor;assert.ok(expected);for(const k of ['r','g','b'])assert.ok(Math.abs(actual[k]-expected[k])<1e-10,`${k}: custom fog ${actual[k]} vs PBR ${expected[k]}`);
  assert.equal(scene.fogColor.toHexString(),'#252F42','binding cannot change the scene colour');
 }finally{scene.dispose();engine.dispose();}
});

test('the sky horizon meets the same linear nighttime fog as the PBR ground',async()=>{
 const {createSkyHorizon}=await load(),engine=new B.NullEngine(),scene=new B.Scene(engine);let sky;try{
  scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogColor=B.Color3.FromHexString('#252f42');const camera=new B.ArcRotateCamera('qa',0,1.48,65,new B.Vector3(120,0,120),scene);
  let expected;B.MaterialHelper.BindFogParameters(scene,null,{setFloat4(){},setColor3(name,c){if(name==='vFogColor')expected={r:c.r,g:c.g,b:c.b};}},true);
  sky=createSkyHorizon(B,scene);sky.update(state(40),camera,'night');const actual=sky.dome.material._vectors3.horizonColor;
  for(const [axis,k]of [['x','r'],['y','g'],['z','b']])assert.ok(Math.abs(actual[axis]-expected[k])<1e-10,`${axis}: horizon differs from PBR fog`);
 }finally{sky?.dispose();scene.dispose();engine.dispose();}
});

test('sun rises east, crosses above the city and sets west; moon travels at night',async()=>{
 const {celestialAt}=await load(),dawn=celestialAt(seconds(6)),noon=celestialAt(seconds(12)),dusk=celestialAt(seconds(18)),midnight=celestialAt(seconds(0));
 assert.ok(dawn.sun.x>.99&&Math.abs(dawn.sun.y)<1e-8);assert.ok(noon.sun.y>.7);assert.ok(dusk.sun.x<-.99&&Math.abs(dusk.sun.y)<1e-8);assert.ok(midnight.moon.y>.7);assert.ok(midnight.sun.y<0);
 for(let hour=0;hour<24;hour+=.25){const v=celestialAt(seconds(hour));for(const body of [v.sun,v.moon])assert.ok(Math.abs(Math.hypot(body.x,body.y,body.z)-1)<1e-10);assert.ok(v.light.direction.y<0);}
 assert.deepEqual(celestialAt(seconds(7),'day'),celestialAt(seconds(23),'day'));
 assert.deepEqual(celestialAt(seconds(7),'night'),celestialAt(seconds(23),'night'));
 assert.deepEqual(celestialAt(10),celestialAt(10+DAY_SECONDS),'complete day repeats without wall-clock drift');
});

test('real Babylon sky follows camera, keeps a bounded mesh/light budget, and disposes cleanly',async()=>{
 const {createSkyHorizon}=await load(),engine=new B.NullEngine(),scene=new B.Scene(engine),camera=new B.ArcRotateCamera('camera',0,1.48,45,new B.Vector3(120,0,120),scene);scene.activeCamera=camera;camera.maxZ=2600;
 const material=new B.PBRMaterial('sand',scene),sky=createSkyHorizon(B,scene,{soil:material});
 try{for(const size of [40,64,40,64]){const s=state(size),before=JSON.stringify(s);for(const radius of [45,360,1500])for(const alpha of [0,Math.PI/2,Math.PI,Math.PI*1.5]){camera.radius=radius;camera.alpha=alpha;camera.beta=radius===1500?.68:1.48;camera.getViewMatrix(true);sky.update(s,camera,'auto');assert.equal(JSON.stringify(s),before);assert.ok(scene.meshes.length<=4,'at most sky, sand extension, river continuation');assert.equal(scene.lights.length,0,'uses the existing directional light');assert.ok(sky.meshes.every(m=>!m.isPickable));assert.ok(B.Vector3.Distance(sky.dome.position,camera.globalPosition)<1e-6);assert.ok(sky.dome.scaling.x<camera.maxZ);assert.ok(sky.stats.triangles<12000);}}
 const count=scene.meshes.length,materials=scene.materials.length;for(let i=0;i<100;i++)sky.update(state(64),camera,'auto');assert.equal(scene.meshes.length,count);assert.equal(scene.materials.length,materials);
 sky.dispose();sky.dispose();assert.equal(scene.meshes.length,0);assert.equal(scene.materials.length,1,'shared soil material remains owned by caller');
 }finally{sky.dispose();scene.dispose();engine.dispose();}
});

test('outer landscape extension starts at the actual scenery rim and continues well beyond every permitted view',async()=>{
 const {horizonGeometry}=await load();for(const size of [40,64]){const s=state(size),g=horizonGeometry(s);assert.ok(g.positions.every(Number.isFinite));assert.ok(g.indices.length/3<10000);assert.ok(g.innerRim.length>40);const existing=alluvialSceneryGeometry(s),positions=new Map();for(let i=0;i<existing.positions.length;i+=3)positions.set(`${existing.positions[i].toFixed(5)},${existing.positions[i+2].toFixed(5)}`,existing.positions[i+1]);for(const p of g.innerRim){const [x,y,z]=p.position,expected=positions.get(`${x.toFixed(5)},${z.toFixed(5)}`);assert.ok(expected!==undefined&&Math.abs(y-expected)<1e-8,'rim positions match actual existing terrain in all three coordinates');}const xs=g.positions.filter((_,i)=>i%3===0),zs=g.positions.filter((_,i)=>i%3===2);assert.ok(Math.min(...xs)<-12000&&Math.max(...xs)>12000);assert.ok(Math.min(...zs)<-12000&&Math.max(...zs)>12000);assert.ok(g.water.indices.length>0,'river continues past the old rectangular backdrop');}
});

test('renderer directional light follows the visible sun and moon with fixed image processing',async()=>{
 const {celestialAt}=await load(),engine=new B.NullEngine(),scene=new B.Scene(engine),r=Object.create(GameRenderer3D.prototype);Object.assign(r,{B,scene,lightMode:'auto',lamps:new Map(),camera:{target:B.Vector3.Zero(),radius:50},sun:new B.DirectionalLight('sun',B.Vector3.Down(),scene),fill:new B.HemisphericLight('fill',B.Vector3.Up(),scene),landscape:{light(){}},buildings:{light(){}}});
 try{const s=state(40);for(const hour of [8,12,16,22,2]){s.simTime=seconds(hour);r.updateLight(s);const c=celestialAt(s.simTime),body=c.light.body==='sun'?c.sun:c.moon;assert.ok(B.Vector3.Dot(r.sun.direction.normalizeToNew(),new B.Vector3(-body.x,-body.y,-body.z))>.99);assert.ok(r.sun.intensity>0);}}
 finally{r.houseLights?.dispose();scene.dispose();engine.dispose();}
});

test('every far-ground triangle keeps one winding for legacy and both river axes',async()=>{
 const {horizonGeometry}=await load(),{initializeGeneratedWorld}=await import('../world.js');
 for(const seed of [undefined,...Array.from({length:80},(_,i)=>i+1)]){const s={buildings:[]};if(seed!==undefined)initializeGeneratedWorld(s,seed);const g=horizonGeometry(s),signs=new Set();for(let i=0;i<g.indices.length;i+=3){const [a,b,c]=g.indices.slice(i,i+3).map(j=>g.positions.slice(j*3,j*3+3)),cross=(b[0]-a[0])*(c[2]-a[2])-(b[2]-a[2])*(c[0]-a[0]);assert.ok(Math.abs(cross)>1e-9,`degenerate ${seed}/${i}`);signs.add(Math.sign(cross));}assert.equal(signs.size,1,`folded extension seed ${seed}`);}
});

test('far river joins the detailed cross-section with identical depth and shares the live material across upgrades',async()=>{
 const {horizonGeometry,createSkyHorizon}=await load(),{waterSurfaceGeometry,createGameWater}=await import('../game3d/water.js'),{createBootstrapLandscape}=await import('../game3d/bootstrap-landscape.js');
 for(const size of [40,64]){const s=state(size),near=waterSurfaceGeometry(s).river,far=horizonGeometry(s).water;for(const side of [0,1])for(let col=0;col<25;col++){const nearIndex=side?(near.positions.length/3-25+col):col,farIndex=side*125+col;assert.deepEqual(far.positions.slice(farIndex*3,farIndex*3+3),near.positions.slice(nearIndex*3,nearIndex*3+3));assert.ok(Math.abs(far.colors[farIndex*4]-near.colors[nearIndex*4])<1e-8,'alpha depth agrees at water seam');}}
 const engine=new B.NullEngine(),scene=new B.Scene(engine),camera=new B.FreeCamera('camera',new B.Vector3(20,20,20),scene),materials=Object.fromEntries(['soil','grass','reed','stone','wood'].map(k=>[k,new B.PBRMaterial(k,scene)])),s=state(40);scene.activeCamera=camera;camera.maxZ=20000;scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.0018;scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.1;scene.imageProcessingConfiguration.contrast=1.1;
 const bootstrap=createBootstrapLandscape(B,scene,s,materials),sky=createSkyHorizon(B,scene,{soil:materials.soil}),detailed=createGameWater(B,scene,materials);
 try{sky.update(s,camera,'auto',bootstrap.waterMaterial);assert.equal(sky.meshes.find(m=>m.name==='horizon-river').material,bootstrap.waterMaterial);detailed.update(s,10);sky.update(s,camera,'auto',detailed.material);assert.equal(sky.meshes.find(m=>m.name==='horizon-river').material,detailed.material);for(const material of [sky.dome.material,bootstrap.waterMaterial,detailed.material]){material.onBindObservable.notifyObservers(null);assert.equal(material._floats.exposureLinear,1.1);assert.equal(material._floats.contrast,1.1);assert.ok(material.options.defines.includes('#define TONEMAPPING 2'));assert.equal(material._floats.valleyFogDensity,.0018);}
  sky.dispose();assert.ok(scene.materials.includes(detailed.material),'sky never owns the live water material');
 }finally{sky.dispose();bootstrap.dispose();detailed.dispose();scene.dispose();engine.dispose();}
});
