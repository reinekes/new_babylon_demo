import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createFishingProps,updateFishingTackle} from '../game3d/harvest-gear.js';
import {WATER_HEIGHT} from '../game3d/water.js';

const sandbox={console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.BABYLON;

test('updating the bent reed keeps its narrow section, and only a confirmed blessing shows the shoal',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),mat=new B.StandardMaterial('test',scene);
 try{
  const node=(name,parent)=>{const n=new B.TransformNode(name,scene);n.parent=parent;return n;};
  const root=node('fisher',null);root.metadata={citizenId:1};root.position.set(77,0,84);root.scaling.set(.83,1.12,.92);root.rotation.y=.35;
  const hand=node('palm',root);hand.position.set(0,1.1,0);hand.rotation.x=.52;hand.scaling.set(.78,1.03,1.19);
  const a={root,hands:{r:hand,l:hand},tool:node('tool',hand),state:createGame(),c:{x:77/6,y:14}};
  createFishingProps(B,scene,a,{reed:mat,wicker:mat,fish:mat,school:mat},[]);
  const activity={kind:'fishing',task:'land-fish',stage:'working',target:{x:13.5,y:14},progress:.16,firstBlessed:false};
  a.c.activity=activity;updateFishingTackle(B,a,WATER_HEIGHT);
  assert.equal(a.school,undefined);assert.equal(a.caughtFish.isEnabled(),false);
  activity.firstBlessed=activity.blessed=true;updateFishingTackle(B,a,WATER_HEIGHT);
  assert.equal(a.schoolFish.filter(f=>f.isEnabled()).length,13);
  activity.progress=.56;updateFishingTackle(B,a,WATER_HEIGHT);
  const positions=a.cane.getVerticesData(B.VertexBuffer.PositionKind);
  const transform=a.cane.computeWorldMatrix(true),tip=B.Vector3.FromArray(a.fishingLine.getVerticesData(B.VertexBuffer.PositionKind));
  assert.equal(a.cane.parent,a.tool);
  assert.ok(B.Vector3.Distance(transform.getTranslation(),a.tool.computeWorldMatrix(true).getTranslation())<.0001);
  assert.ok(B.Vector3.Distance(B.Vector3.TransformCoordinates(a.canePath.at(-1),transform),tip)<.0001,'line attaches to the rod tip on a scaled moving palm');
  const ring=Array.from({length:8},(_,i)=>B.Vector3.FromArray(positions,i*3));
  assert.ok(Math.max(...ring.flatMap(a=>ring.map(b=>B.Vector3.Distance(a,b))))<.057,'the original .026 m cane radius survives bending');
  assert.equal(a.caughtFish.isEnabled(),true);assert.equal(a.school.isEnabled(),false);
  assert.equal(a.fishingLine.metadata.phase,'lift');assert.equal(a.catchBasket.isEnabled(),true);
  activity.progress=.99;updateFishingTackle(B,a,WATER_HEIGHT);
  assert.equal(a.fishingLine.metadata.phase,'basket');
  assert.ok(Math.abs(a.caughtFish.position.x-a.catchBasket.position.x)<.02);
 }finally{scene.dispose();engine.dispose();}
});
