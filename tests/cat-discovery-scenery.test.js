import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame,encode} from '../engine.js';
import {strictScenario,CAT_DISCOVERY_RULES} from '../scenario-profiles.js';
import {advanceCatDiscovery,catDiscoveryView} from '../miracle-discovery.js';
import {createCatDiscoveryScenery,catDiscoverySurfaceHeight} from '../game3d/cat-discovery.js';
const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
function fixture(){const s=createGame({start:'established',mode:'awakening',scenario:{...strictScenario(),miracles:CAT_DISCOVERY_RULES}}),c=s.citizens.find(c=>c.age>=16);Object.assign(c,{calling:'fisher',role:'production'});s.godhood.stage='recognized';s.catFishing.lessons[c.id]=3;advanceCatDiscovery(s,.1);return s;}
test('3D discovery stays on actual ground, follows saved stages and reuses a bounded set of meshes without touching the save',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),height=(x,y)=>2+x*.1+y*.02,view=createCatDiscoveryScenery(B,scene,{tileSize:6,groundHeight:height});let s=fixture(),before=encode(s);view.update(s);const v=catDiscoveryView(s),bowl=scene.getMeshByName('cat-discovery-bowl');assert.ok(bowl);assert.equal(bowl.position.x,v.x*6);assert.ok(Math.abs(bowl.position.y-height(v.x,v.y))<.02);assert.equal(encode(s),before);
 s.simTime=30;advanceCatDiscovery(s,.1);view.update(s);assert.equal(scene.getMeshByName('cat-discovery-eyes').isEnabled(),true);s.simTime=55;advanceCatDiscovery(s,.1);view.update(s);assert.equal(scene.getMeshByName('cat-discovery-eyes').isEnabled(),false);assert.equal(scene.getMeshByName('cat-discovery-tracks').isEnabled(),true);
 const meshes=scene.meshes.length,materials=scene.materials.length;before=encode(s);for(let i=0;i<100;i++)view.update(s);assert.equal(scene.meshes.length,meshes);assert.ok(meshes<=4);assert.equal(scene.materials.length,materials);assert.equal(encode(s),before);assert.equal(s.pests.cats.length,0);
 view.update(createGame());assert.ok(view.meshes.every(m=>!m.isEnabled()));view.dispose();view.dispose();assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});

test('ground sampling includes raised road surfaces even when the road is not selectable',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),road=B.MeshBuilder.CreateGround('road-test',{width:20,height:20},scene);road.position.y=.038;road.metadata={road:{}};road.isPickable=false;road.computeWorldMatrix(true);
 assert.ok(Math.abs(catDiscoverySurfaceHeight(B,scene,0,0,()=>0)-.038)<1e-7);road.dispose();assert.equal(catDiscoverySurfaceHeight(B,scene,0,0,()=>.2),.2);scene.dispose();engine.dispose();
});
