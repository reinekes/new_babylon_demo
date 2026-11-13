import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {river,signedRiverDistance} from '../world.js';
import {districtRoadEdges,shoreDistance,surfaceElevation,createDistrictTerrain,indexNearbyRoads,alluvialHeight,alluvialNormal} from '../district3d/terrain.js';
const context={console,setTimeout,clearTimeout,performance,window:{URL:globalThis.URL,addEventListener(){},removeEventListener(){}},navigator:{userAgent:"node"}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),context);
const B=context.BABYLON;

test('road spatial lookup retains every segment capable of cutting the grass mask',()=>{
 const edges=Array.from({length:600},(_,i)=>[{x:i%30-5,y:Math.floor(i/30)-3},{x:i%30-4,y:Math.floor(i/30)-2.5}]);
 edges.push([{x:-4,y:-4},{x:20,y:18}]);
 const nearby=indexNearbyRoads(edges),distance=(x,y,[a,b])=>{const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(x-a.x-dx*t,y-a.y-dy*t);};
 for(let y=-4.25;y<20;y+=.25)for(let x=-5.25;x<26;x+=.25){
  const all=edges.filter(e=>distance(x,y,e)<.24),local=nearby(x,y).filter(e=>distance(x,y,e)<.24);assert.deepEqual(local,all);
 }
 assert.ok(nearby(10,10).length<edges.length/10,'local masks do not scan the whole road network');
 assert.deepEqual(nearby(200,200),[]);
});

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

test('road mask refresh matches a fresh terrain and restores grass after an anchor disappears',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','wood','grass','reed','stone'].map(k=>[k,new B.PBRMaterial(k,scene)]));
 const s={buildings:[{type:'house',x:8,y:8},{type:'shrine',x:9,y:8}],roads:[],world:{lakes:[]}};
 const view=createDistrictTerrain(B,scene,s,materials),grass=view.meshes.find(m=>m.name==='soft-riparian-grass'),original=grass.getVerticesData('color').slice(),indices=grass.getIndices().slice(),land=view.meshes.find(m=>m.name==='alluvial-valley');let fresh;
 try{
  s.roadAnchors=[{type:'road',x:12,y:8}];const before=JSON.stringify(s),mask=view.refreshRoadMask(s);fresh=createDistrictTerrain(B,scene,s,materials);const expected=fresh.meshes.find(m=>m.name==='soft-riparian-grass');
  assert.equal(mask.mesh,grass);assert.ok(view.meshes.includes(land)&&!land.isDisposed());assert.deepEqual(grass.getVerticesData('color'),expected.getVerticesData('color'));assert.deepEqual(grass.getIndices(),expected.getIndices());assert.equal(JSON.stringify(s),before);
  delete s.roadAnchors;view.refreshRoadMask(s);assert.deepEqual(grass.getVerticesData('color'),original);assert.deepEqual(grass.getIndices(),indices);
 }finally{view.dispose();fresh?.dispose();scene.dispose();engine.dispose();}
});

test('road-only grass refresh reuses shore/building alpha rather than scanning every building per vertex',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','wood','grass','reed','stone'].map(k=>[k,new B.PBRMaterial(k,scene)]));let reads=0;const b={type:'house',get x(){reads++;return 8;},y:8},s={buildings:[b,{type:'shrine',x:9,y:8}],roads:[],world:{lakes:[]}},view=createDistrictTerrain(B,scene,s,materials);
 try{const grass=view.meshes.find(m=>m.name==='soft-riparian-grass');assert.ok(grass.getTotalVertices()>1000);reads=0;s.roadAnchors=[{type:'road',x:12,y:8}];view.refreshRoadMask(s);assert.ok(reads<500,`building x read ${reads} times for ${grass.getTotalVertices()} vertices`);}finally{view.dispose();scene.dispose();engine.dispose();}
});

test('grass road-mask static alpha invalidates after building coordinates or lake shape change',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),materials=Object.fromEntries(['soil','wood','grass','reed','stone'].map(k=>[k,new B.PBRMaterial(k,scene)])),s={buildings:[{type:'house',x:8,y:8},{type:'shrine',x:9,y:8}],roads:[],world:{lakes:[]}},view=createDistrictTerrain(B,scene,s,materials);let fresh;
 try{for(const change of [()=>s.buildings[0].x=12,()=>s.world.lakes=[{cells:[{x:13,y:8}]}],()=>s.world.lakes=[]]){change();const before=JSON.stringify(s),mask=view.refreshRoadMask(s);fresh=createDistrictTerrain(B,scene,s,materials);const expected=fresh.meshes.find(m=>m.name==='soft-riparian-grass');assert.deepEqual(mask.mesh.getVerticesData('color'),expected.getVerticesData('color'));assert.deepEqual(mask.mesh.getIndices(),expected.getIndices());assert.equal(JSON.stringify(s),before);fresh.dispose();fresh=null;}}finally{view.dispose();fresh?.dispose();scene.dispose();engine.dispose();}
});

test('lake cell rejection preserves the exact signed shore distance',()=>{
 const state={world:{lakes:[{cells:[{x:27,y:7},{x:27,y:8},{x:28,y:8}]},{cells:[{x:7,y:18},{x:8,y:18}]}]}};
 for(let y=-2;y<32;y+=.25)for(let x=-2;x<34;x+=.25){
  const distances=state.world.lakes.flatMap(l=>l.cells.map(c=>{
   const dx=Math.abs(x-c.x)-.5,dy=Math.abs(y-c.y)-.5;
   return Math.hypot(Math.max(dx,0),Math.max(dy,0))+Math.min(Math.max(dx,dy),0);
  }));
  assert.equal(shoreDistance(x,y,state),Math.min(Math.abs(signedRiverDistance(x,y,state))-1.1,...distances));
 }
});


test('dry relief stays low, flattens occupied footprints and meets the backdrop continuously',()=>{
 const s={world:{seed:137,lakes:[]},buildings:[]};
 const samples=[];
 for(let y=1;y<30;y++)for(let x=1;x<11;x++)samples.push({x,y,h:surfaceElevation(x,y,s)});
 const ridge=samples.sort((a,b)=>b.h-a.h)[0];
 assert.ok(ridge.h>1.1&&ridge.h<3.5);
 assert.ok(samples.some(p=>p.h<.08),'flat swales remain between the low dunes');
 s.buildings.push({type:'ziggurat',x:ridge.x,y:ridge.y,footprint:2});
 for(const dx of [-.5,.5,1.5])for(const dy of [-.5,.5,1.5])assert.equal(surfaceElevation(ridge.x+dx,ridge.y+dy,s),0);
 for(let y=3;y<29;y+=2){
  const x=river(y)+3.2;
  assert.equal(surfaceElevation(x,y,s),0,'low irrigated plain stays flat');
  const rim=-.5,e=.00001;
  assert.ok(Math.abs(alluvialHeight(rim-e,y,s)-alluvialHeight(rim+e,y,s))<.0001);
  assert.ok(alluvialNormal(rim,y,s).every(Number.isFinite));
 }
});
