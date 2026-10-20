import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {river} from '../world.js';
import {districtRoadEdges,shoreDistance,surfaceElevation,createDistrictTerrain} from '../district3d/terrain.js';
const context={console,setTimeout,clearTimeout,performance,window:{URL:globalThis.URL,addEventListener(){},removeEventListener(){}},navigator:{userAgent:"node"}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),context);
const B=context.BABYLON;

test('3D river banks follow the original curved world river',()=>{
  for(let y=0;y<32;y+=.25){
    assert.ok(shoreDistance(river(y),y,{})<0);
    assert.ok(Math.abs(shoreDistance(river(y)+1.1,y,{}))<1e-12);
    assert.ok(surfaceElevation(river(y),y,{})<-.18);
    if(y>4&&y<27)assert.equal(surfaceElevation(river(y)+2,y,{}),0);
  }
});
test('saved lake cells submerge the same world footprint and occupied ground stays level',()=>{
  const s={world:{lakes:[{cells:[{x:27,y:7},{x:28,y:7}]}]},buildings:[{x:1,y:1}]};
  assert.ok(shoreDistance(27,7,s)<0);
  assert.ok(surfaceElevation(27,7,s)<-.18);
  assert.ok(shoreDistance(29,7,s)>0);
  assert.equal(surfaceElevation(1,1,s),0);
});
test('terrain creates real meshes, preserves source state, and reuses static geometry across frames',()=>{
  const engine=new B.NullEngine(),scene=new B.Scene(engine),materials={};
  for(const key of ['soil','wood','grass','reed','stone'])materials[key]=new B.PBRMaterial(key,scene);
  const s={buildings:[{type:'house',x:8,y:8},{type:'shrine',x:9,y:8}],roads:[],world:{lakes:[{cells:[{x:27,y:7}]}]}};
  const before=JSON.stringify(s),terrain=createDistrictTerrain(B,scene,s,materials),count=scene.meshes.length;
  assert.ok(terrain.meshes.some(m=>m.name==='living-river'));
  assert.ok(terrain.meshes.some(m=>m.name==='saved-lakes'));
  for(const name of ['alluvial-valley','living-river','saved-lakes','connected-earth-streets']){
    const mesh=terrain.meshes.find(m=>m.name===name),normals=mesh.getVerticesData(B.VertexBuffer.NormalKind);
    for(let i=1;i<normals.length;i+=3)assert.ok(normals[i]>.1,`${name} front faces must point upward`);
  }
  const grass=terrain.meshes.find(m=>m.name==='soft-riparian-grass');
  assert.ok(grass.hasVertexAlpha);
  const grassColors=grass.getVerticesData(B.VertexBuffer.ColorKind),grassNormals=grass.getVerticesData(B.VertexBuffer.NormalKind);
  assert.ok(grassColors.some((v,i)=>i%4===3&&v>.5));
  assert.ok(grassColors.some((v,i)=>i%4===3&&v>0&&v<.5),'grass edges must fade continuously');
  for(const index of grass.getIndices())assert.ok(grassNormals[index*3+1]>.1,'grass must face upward');
  const crowns=terrain.meshes.find(m=>m.name==='date-palm-crowns');
  assert.ok(crowns.material.albedoColor.g>crowns.material.albedoColor.r,'date palm leaves must be olive green');
  assert.equal(crowns.material.albedoTexture,null);
  const normals=crowns.getVerticesData(B.VertexBuffer.NormalKind);
  for(let i=0;i<normals.length;i+=3)assert.ok(Math.hypot(normals[i],normals[i+1],normals[i+2])>.9,'leaf front/back normals must not cancel');
  const palms=terrain.meshes.find(m=>m.name==='date-palm-trunks').getVerticesData(B.VertexBuffer.PositionKind);
  let nearQuarter=false;
  for(let i=0;i<palms.length;i+=3)if(palms[i]>6*6&&palms[i]<12*6&&palms[i+2]>7*6&&palms[i+2]<11*6)nearQuarter=true;
  assert.ok(nearQuarter,'visible palms should surround the demonstration quarter');
  assert.ok(districtRoadEdges(s).length);
  for(let i=0;i<10;i++)terrain.update(s,i);
  assert.equal(scene.meshes.length,count);
  assert.equal(JSON.stringify(s),before);
  terrain.dispose();assert.equal(scene.meshes.length,0);
  scene.dispose();engine.dispose();
});
