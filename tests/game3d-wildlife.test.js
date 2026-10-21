import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createWildlife} from '../game3d/wildlife.js';
import {createCoatPixels,coatVariant} from '../game3d/animal-coats.js';
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
 for(let i=0;i<bodySources.length;i+=2)assert.equal(bodySources[i].geometry,bodySources[i+1].geometry);
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

test('fish swim with shared outward anatomy, rodents are small, cats have feline details, hunted prey lies still',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createWildlife(B,scene),s=createGame();
 const animals=[{id:'fish-a',kind:'fish',x:4,y:4,behavior:'swimming',waterLevel:.12,swimDepth:.2},{id:'fish-b',kind:'fish',x:5,y:4,behavior:'swimming'},{id:'cat-a',kind:'cat',x:6,y:4,behavior:'looking'},{id:'mouse-a',kind:'mouse',x:7,y:4,behavior:'looking'},{id:'prey',kind:'gazelle',x:8,y:4,behavior:'looking'}];
 const saved=JSON.stringify(animals);view.update(s,animals,.05);
 const fish=view.rootFor({animalId:'fish-a'}),fishB=view.rootFor({animalId:'fish-b'}),cat=view.rootFor({animalId:'cat-a'}),mouse=view.rootFor({animalId:'mouse-a'}),prey=view.rootFor({animalId:'prey'});
 assert.equal(mouse.scaling.x,.55,'rodents should occupy substantially less street space');
 assert.ok(cat.getChildMeshes().filter(m=>m.name.includes('whisker')).length>=6,'cat needs visible paired whiskers');
 assert.ok(cat.getChildMeshes().some(m=>m.name.includes('iris')),'feline iris surrounds dark slit pupil');
 assert.ok(fish.getChildMeshes().some(m=>m.name.includes('caudal-fin')),'fish must have a fish tail');
 assert.ok(fish.position.y<=-.4,'fish anatomy remains fully below the rendered water even with stale positive water elevation');
 const torso=fish.getChildMeshes().find(m=>m.name.includes('torso')),second=fishB.getChildMeshes().find(m=>m.name.includes('torso'));
 assert.equal(torso.sourceMesh,second.sourceMesh);assert.ok(!fish.getChildTransformNodes().some(n=>n.name.includes('-hip-')),'fish has no mammal legs');
 const positions=torso.getVerticesData(B.VertexBuffer.PositionKind),normals=torso.getVerticesData(B.VertexBuffer.NormalKind),middle=3*17*3;assert.ok(positions[middle]*normals[middle]>0);
 const tail=fish.getChildTransformNodes().find(n=>n.name.endsWith('-tail'));const priorTail=tail.rotation.y;
 for(let i=0;i<20;i++)view.update(s,animals,.05);assert.notEqual(tail.rotation.y,priorTail,'fish tail swims continuously');assert.equal(JSON.stringify(animals),saved);
 animals[4].behavior='dead';animals[4].deathProgress=1;for(let i=0;i<80;i++)view.update(s,animals,.05);
 const body=prey.getChildTransformNodes().find(n=>n.name.endsWith('-body-pivot'));assert.ok(Math.abs(body.rotation.z)>1,'prey lies on its side');assert.ok(body.position.y<.4);
 const snapshot=()=>JSON.stringify(prey.getDescendants().map(n=>[n.position?.asArray(),n.rotation?.asArray(),n.scaling?.asArray()]));const still=snapshot();for(let i=0;i<10;i++)view.update(s,animals,.05);assert.equal(snapshot(),still,'dead prey must stop breathing, stepping and moving its ears/tail');
 const count=scene.meshes.length;for(let i=0;i<10;i++)view.update(s,animals,.05);assert.equal(scene.meshes.length,count,'animation creates no meshes');
 view.dispose();assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});

test('mammal coats have UV mapped hair relief, stable ID variants and cached disposable textures',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createWildlife(B,scene),s=createGame();
 const animals=['goat','gazelle','cat','jackal','mouse'].flatMap(kind=>Array.from({length:6},(_,i)=>({id:`coat-${kind}-${i}`,kind,x:5+i,y:5,behavior:'looking'})));
 view.update(s,animals,.05);
 for(const kind of ['goat','gazelle','cat','jackal','mouse']){
  const torsos=animals.filter(c=>c.kind===kind).map(c=>view.rootFor({animalId:c.id}).getChildMeshes().find(m=>m.name.includes('-torso')));
  assert.ok(torsos.every(m=>m.getVerticesData(B.VertexBuffer.UVKind)?.length===m.getTotalVertices()*2),'every rounded torso needs complete UV mapping');
  assert.ok(torsos.every(m=>m.material.albedoTexture&&m.material.bumpTexture),'fur needs authored coat color and strand relief');
  assert.ok(new Set(torsos.map(m=>m.material)).size>1,'stable IDs should produce visibly different coats');
  assert.ok(torsos.every(m=>m.sourceMesh.geometry===torsos[0].sourceMesh.geometry),'variants share anatomical geometry');
 }
 const textures=scene.textures.filter(t=>t.name.startsWith('wildlife-coat-')),materials=animals.map(c=>view.rootFor({animalId:c.id}).getChildMeshes().find(m=>m.name.includes('-torso')).material);
 assert.ok(textures.length>0);const count=scene.textures.length;for(let i=0;i<30;i++)view.update(s,animals,.05,{speed:4});assert.equal(scene.textures.length,count,'animation must allocate no textures');
 view.update(s,[],.05);view.update(s,animals,.05);assert.deepEqual(animals.map(c=>view.rootFor({animalId:c.id}).getChildMeshes().find(m=>m.name.includes('-torso')).material),materials,'recreated identity retains its coat');
 view.dispose();assert.equal(scene.textures.filter(t=>t.name.startsWith('wildlife-coat-')).length,0,'dispose must release owned coat textures');scene.dispose();engine.dispose();
});


test('authored coat maps distinguish coarse patches, fine tabby stripes and opaque directional hair relief',()=>{
 const coats=['goat','gazelle','cat','jackal','mouse'].map(kind=>createCoatPixels(kind,0));
 for(const [index,{color,normal,size}]of coats.entries()){
  assert.equal(color.length,size*size*4);assert.equal(normal.length,color.length);
  const shades=new Set();let relief=0;for(let i=0;i<color.length;i+=4){shades.add(`${color[i]},${color[i+1]},${color[i+2]}`);assert.equal(color[i+3],255);assert.equal(normal[i+3],255);relief+=Math.abs(normal[i]-127);}
  assert.ok(shades.size>256,'coat must contain actual hair/gradient detail rather than flat tint');assert.ok(relief/(size*size)>(index===2?3:10),'directional hair relief remains present, with subdued short cat hair');
 }
 assert.notDeepEqual(coats[0].color,coats[1].color);assert.notDeepEqual(coats[0].normal,coats[1].normal,'short gazelle hair must differ from coarse goat hair');
 assert.notDeepEqual(createCoatPixels('goat',0).color,createCoatPixels('goat',1).color,'cream and dark patches must differ between variants');
});

test('every goat coat retains warm flanks and cream patches instead of near-black pigment',()=>{
 for(let variant=0;variant<3;variant++){
  const {color,size}=createCoatPixels('goat',variant);let paleFlank=0,nearBlackFlank=0,count=0;
  // Around the two visible lateral sides, excluding the naturally pale belly.
  for(let y=0;y<size;y++)for(const x of [0,1,2,3,128,129,130,131]){const i=(y*size+x)*4;count++;if(color[i]>160&&color[i+1]>135&&color[i+2]>105)paleFlank++;if(color[i]<65&&color[i+1]<60&&color[i+2]<55)nearBlackFlank++;}
  assert.ok(paleFlank/count>.12,`variant ${variant} needs cream patches on its flanks`);
  assert.ok(nearBlackFlank/count<.05,`variant ${variant} should read as warm brown rather than near-black`);
 }
});


test('cat and goat torsos are slim in width and depth, with a smaller feline silhouette',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createWildlife(B,scene),s=createGame();
 const animals=['cat','goat'].map(kind=>({id:kind,kind,x:5,y:5,behavior:'looking'}));view.update(s,animals,.05);
 for(const kind of ['cat','goat']){const root=view.rootFor({animalId:kind}),torso=root.getChildMeshes().find(m=>m.name.includes('-torso')),p=torso.getVerticesData(B.VertexBuffer.PositionKind),xs=p.filter((_,i)=>i%3===0),ys=p.filter((_,i)=>i%3===1),zs=p.filter((_,i)=>i%3===2),width=Math.max(...xs)-Math.min(...xs),depth=Math.max(...ys)-Math.min(...ys),length=Math.max(...zs)-Math.min(...zs);
  assert.ok(width/length<(kind==='cat'?.37:.46));assert.ok(depth/length<(kind==='cat'?.45:.55));
  if(kind==='cat'){assert.equal(root.scaling.x,.85);assert.ok(width*root.scaling.x<.19);assert.ok(depth*root.scaling.x<.23);}
  assert.ok(torso.material.albedoTexture&&torso.material.bumpTexture,'retain the previously authored coats');
 }view.dispose();scene.dispose();engine.dispose();
});


test('tabby cats have no raised stripe objects; three ID coats share natural anatomy and dispose cleanly',()=>{
 const engine=new B.NullEngine(),scene=new B.Scene(engine),view=createWildlife(B,scene),s=createGame(),ids=new Map();
 for(let i=0;ids.size<3;i++){const id=`natural-cat-${i}`,variant=coatVariant(id);if(!ids.has(variant))ids.set(variant,id);}
 const cats=[...ids.values()].flatMap(id=>[{id,kind:'cat',x:5,y:5,behavior:'looking'},{id:id+'-paired',kind:'cat',x:6,y:5,behavior:'looking'}]),before=JSON.stringify([s,cats]);view.update(s,cats,.05);
 for(const c of cats){const root=view.rootFor({animalId:c.id}),parts=root.getChildMeshes(),torso=parts.find(m=>m.name.includes('-torso')),face=parts.find(m=>m.name.includes('-face'));
  assert.ok(!parts.some(m=>/stripe|saddle|marking/.test(m.name)),'tabby stripes must never be separate balls, tubes or cards');
  assert.ok(parts.filter(m=>m.parent.name.endsWith('-body-pivot')).every(m=>!m.material.name.includes('horn')),'nothing dark sits on the feline back');
  assert.equal(root.scaling.x,.85);const positions=torso.getVerticesData(B.VertexBuffer.PositionKind),xs=positions.filter((_,i)=>i%3===0);assert.ok(Math.abs(Math.max(...xs)-.105)<1e-6&&Math.abs(Math.min(...xs)+.105)<1e-6,'slim torso dimensions unchanged');
  for(const m of [torso,face]){assert.equal(m.getVerticesData(B.VertexBuffer.UVKind).length,m.getTotalVertices()*2);assert.ok(m.material.albedoTexture&&m.material.bumpTexture);assert.equal(m.material.bumpTexture.level,.22);}
 }
 const torsos=cats.map(c=>view.rootFor({animalId:c.id}).getChildMeshes().find(m=>m.name.includes('-torso')));assert.equal(new Set(torsos.map(m=>m.material)).size,3);assert.ok(torsos.every(m=>m.sourceMesh.geometry===torsos[0].sourceMesh.geometry));
 const count=scene.textures.length;for(let i=0;i<20;i++)view.update(s,cats,.05,{speed:4});assert.equal(scene.textures.length,count);assert.equal(JSON.stringify([s,cats]),before);view.dispose();assert.equal(scene.textures.filter(t=>t.name.startsWith('wildlife-coat-cat-')).length,0);assert.equal(scene.meshes.length,0);scene.dispose();engine.dispose();
});
test('all tabby variants carry a flat visible fur pattern with low hair relief and no black dorsal patch',()=>{
 for(let variant=0;variant<3;variant++){const {color,normal,size}=createCoatPixels('cat',variant),rows=[];let relief=0;
  for(let y=0;y<size;y++){let brightness=0;for(let x=61;x<=67;x++){const i=(y*size+x)*4;brightness+=.2126*color[i]+.7152*color[i+1]+.0722*color[i+2];}rows.push(brightness/7);}
  const contrast=Math.max(...rows)-Math.min(...rows);assert.ok(contrast>20&&contrast<60,'each dorsal UV strip has recognisable but moderate tabby bars');assert.ok(Math.min(...rows)>55,'markings remain fur-coloured rather than near-black objects');
  for(let i=0;i<normal.length;i+=4)relief+=Math.abs(normal[i]-127);assert.ok(relief/(size*size)>3&&relief/(size*size)<9,'normal contains only fine short-hair relief');
 }
});
