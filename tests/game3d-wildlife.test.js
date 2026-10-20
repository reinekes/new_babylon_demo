import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createWildlife} from '../game3d/wildlife.js';
const sandbox={exports:{},module:{exports:{}},console,setTimeout,clearTimeout,performance,window:{addEventListener(){},removeEventListener(){}},navigator:{userAgent:'node'}};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);
const B=sandbox.exports.NullEngine?sandbox.exports:sandbox.module.exports;

test('wildlife has rounded species anatomy, shared geometry, exact identity/positions, and no stock mutation',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),meshes=[],view=createWildlife(B,scene,meshes),s=createGame();
 const animals=['goat','gazelle','cat','jackal','bird','mouse'].flatMap((kind,i)=>[0,1].map(n=>({id:`${kind}${n}`,kind,x:4+i,y:4+n,behavior:'looking'})));
 const before=JSON.stringify(s);view.update(s,animals,1/60,{speed:.25});assert.equal(JSON.stringify(s),before);
 const bodySources=[];
 for(const c of animals){const root=view.rootFor({animalId:c.id});assert.ok(root);assert.equal(root.metadata.animalId,c.id);assert.equal(root.position.x,c.x*6);assert.equal(root.position.z,c.y*6);
  const body=root.getChildMeshes().find(m=>m.name.includes('-torso'));assert.ok(body);assert.ok(body.getTotalVertices()>100,'anatomical torso cannot be a box');
  assert.ok(body.getVerticesData(B.VertexBuffer.PositionKind).every(Number.isFinite));
  const positions=body.getVerticesData(B.VertexBuffer.PositionKind),normals=body.getVerticesData(B.VertexBuffer.NormalKind),middle=3*17*3;
  assert.ok(positions[middle]*normals[middle]>0,'torso side normals must face outward');bodySources.push(body.sourceMesh);
 }
 for(let i=0;i<bodySources.length;i+=2)assert.equal(bodySources[i],bodySources[i+1]);
 assert.notDeepEqual(bodySources[0].getVerticesData(B.VertexBuffer.PositionKind),bodySources[2].getVerticesData(B.VertexBuffer.PositionKind),'goat and gazelle must have different anatomy');
 assert.ok(scene.meshes.filter(m=>m.name.startsWith('wildlife-source')).every(m=>!m.isVisible&&!m.isPickable));
 const count=scene.meshes.length;for(let i=0;i<10;i++)view.update(s,animals,1/60,{speed:.25});assert.equal(scene.meshes.length,count);
 const root=view.rootFor({animalId:'goat0'}),owned=root.getChildMeshes();view.update(s,animals.filter(c=>c.id!=='goat0'),1/60);assert.ok(root.isDisposed());assert.ok(owned.every(m=>!meshes.includes(m)));
 view.dispose();assert.equal(meshes.length,0);assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});

test('gait follows distance, birds alternate feet, grazing lowers head, pause freezes every transform',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createWildlife(B,scene),s=createGame(),animals=[{id:'goat',kind:'goat',x:4,y:4,behavior:'looking'},{id:'bird',kind:'bird',x:5,y:5,behavior:'walking'}];
 view.update(s,animals,.05,{speed:.25});const root=view.rootFor({animalId:'goat'}),head=root.getChildTransformNodes().find(n=>n.name.endsWith('-head-pivot')),body=root.getChildTransformNodes().find(n=>n.name.endsWith('-body-pivot'));
 for(let i=0;i<15;i++){animals[0].x+=.002;animals[1].x+=.002;view.update(s,animals,.05,{speed:.25});}
 const gait=root.metadata.gait;for(let i=0;i<10;i++)view.update(s,animals,.05,{speed:.25});assert.equal(root.metadata.gait,gait,'waiting must not march on the spot');
 animals[0].behavior='grazing';for(let i=0;i<30;i++)view.update(s,animals,.05,{speed:.25});assert.ok(head.rotation.x>.5,'grazing must lower the real articulated head');
 const snapshot=JSON.stringify(root.getDescendants().map(n=>[n.position?.asArray(),n.rotation?.asArray(),n.scaling?.asArray()]));for(let i=0;i<10;i++)view.update(s,animals,.05,{paused:true,speed:4});assert.equal(JSON.stringify(root.getDescendants().map(n=>[n.position?.asArray(),n.rotation?.asArray(),n.scaling?.asArray()])),snapshot);
 animals[0].behavior='resting';for(let i=0;i<40;i++)view.update(s,animals,.05,{speed:1});assert.ok(body.position.y<.5,'resting folds the animal down');
 const bird=view.rootFor({animalId:'bird'});for(let i=0;i<10;i++){animals[1].x+=.01;view.update(s,animals,.05,{speed:1});}const legs=bird.getChildTransformNodes().filter(n=>/-hip--?1-0$/.test(n.name));assert.equal(legs.length,2);assert.ok(legs[0].rotation.x*legs[1].rotation.x<0);
 view.dispose();scene.dispose();engine.dispose();
});
