import test from 'node:test';
import assert from 'node:assert/strict';
import * as crops from '../game3d/crop-varieties.js';

test('stable crop allocation covers seven species without changing simulation buildings',()=>{
 assert.equal(typeof crops.fieldCropKind,'function');
 const found=new Set();
 for(let id=0;id<140;id++){
  const b={id,x:3,y:4,type:'field',crop:{growth:1,sown:1}},before=structuredClone(b);
  const kind=crops.fieldCropKind(b);found.add(kind);assert.equal(crops.fieldCropKind({...b,workers:4}),kind);assert.deepEqual(b,before);
 }
 assert.deepEqual([...found].sort(),['barley','chickpea','emmer','flax','lentil','onion','pea']);
});

test('botanical meshes have bounded finite indexed geometry and distinct silhouettes',()=>{
 assert.equal(typeof crops.cropPlantGeometry,'function');
 const signatures=new Set();
 for(const kind of ['flax','lentil','pea','chickpea','onion']){
  const g=crops.cropPlantGeometry(kind);assert.ok(g.indices.length>60);assert.ok(g.indices.length/3<=400);
  assert.equal(g.colors.length,g.positions.length/3*4);
  assert.ok(g.positions.every(Number.isFinite));assert.ok(g.indices.every(i=>Number.isInteger(i)&&i>=0&&i<g.positions.length/3));
  const h=g.positions.filter((_,i)=>i%3===1);assert.ok(Math.min(...h)>=-.04);assert.ok(Math.max(...h)>.3&&Math.max(...h)<1.2);
  assert.ok(g.positions.every((v,i)=>i%3===1||Math.abs(v)<.36));signatures.add(JSON.stringify(g.positions));
 }
 assert.equal(signatures.size,5);
});

test('date fruit bunches hang below their attachment and stay within a palm crown',()=>{
 assert.equal(typeof crops.dateClusterGeometry,'function');
 const g=crops.dateClusterGeometry({height:6,radius:.55,seed:9});assert.ok(g.indices.length/3<2500);
 for(let i=0;i<g.positions.length;i+=3){assert.ok(Math.hypot(g.positions[i],g.positions[i+2])<1.1);assert.ok(g.positions[i+1]>4.7&&g.positions[i+1]<=6);}
 assert.deepEqual(g,crops.dateClusterGeometry({height:6,radius:.55,seed:9}));
});
