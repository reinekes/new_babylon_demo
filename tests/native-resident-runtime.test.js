import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createGame} from '../engine.js';
import {createGameActors} from '../game3d/actors.js';
const sandbox={console,setTimeout,clearTimeout,performance,self:{},TextDecoder,TextEncoder,URL,Blob};
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylon-9.31.0.js',import.meta.url),'utf8'),sandbox);const B=sandbox.BABYLON;
vm.runInNewContext(readFileSync(new URL('../assets/vendor/babylonjs-loaders-9.31.0.min.js',import.meta.url),'utf8'),sandbox);
async function studio(check){const engine=new B.NullEngine(),scene=new B.Scene(engine),loader=B.SceneLoader.LoadAssetContainerAsync;let actors;B.SceneLoader.LoadAssetContainerAsync=(path,file)=>loader.call(B.SceneLoader,'',new Uint8Array(readFileSync(new URL('../'+path+file.split('?')[0],import.meta.url))),scene,undefined,'.glb');try{scene.activeCamera=new B.FreeCamera('camera',new B.Vector3(0,3,-8),scene);actors=await createGameActors(B,scene,{},{includeFauna:false});await check({scene,actors});}finally{actors?.dispose();B.SceneLoader.LoadAssetContainerAsync=loader;scene.dispose();engine.dispose();}}
function stateWithPeople(){const s=createGame({start:'established'}),base=s.citizens.find(c=>c.age>=16);s.buildings=[];s.citizens=[{age:30,sex:'m'},{age:30,sex:'f'},{age:7,sex:'m'},{age:13,sex:'f'}].map((p,i)=>({...base,...p,id:7800+i,work:null,phase:'waiting',x:7+i*.45,y:10,cargo:{},buildCargo:{},calling:'auto'}));return s;}
function sourceAsset(root){const bytes=readFileSync(new URL('../assets/art-courtyard/models/source-walk-'+root.metadata.residentVariant+'.glb',import.meta.url));return JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));}
function local(root,name){const n=root.getChildTransformNodes().find(n=>n.name.endsWith('-'+name));n.computeWorldMatrix(true);return B.Vector3.TransformCoordinates(n.getAbsolutePosition(),root.computeWorldMatrix(true).clone().invert());}
function localVertices(root,mesh){mesh.skeleton.prepare(true);mesh.computeWorldMatrix(true);const inverse=root.computeWorldMatrix(true).clone().invert(),matrix=mesh.getWorldMatrix().multiply(inverse),positions=mesh.getPositionData(true,true),points=[];for(let i=0;i<positions.length;i+=3)points.push(B.Vector3.TransformCoordinates(B.Vector3.FromArray(positions,i),matrix));return points;}
function palmSurfaceCentre(root,side){const centre=new B.Vector3();let count=0;for(const mesh of root.getChildMeshes().filter(m=>m.skeleton)){const weights=mesh.getVerticesData(B.VertexBuffer.MatricesWeightsKind),joints=mesh.getVerticesData(B.VertexBuffer.MatricesIndicesKind);if(!weights||!joints)continue;const points=localVertices(root,mesh);for(let i=0;i<points.length;i++){let hand=0;for(let k=0;k<4;k++)if(new RegExp('(?:^|-)hand_'+side+'$').test(mesh.skeleton.bones[Math.round(joints[i*4+k])]?.name||''))hand+=weights[i*4+k];if(hand>.65){centre.addInPlace(points[i]);count++;}}}assert.ok(count>=4,'measure the actual native palm surface');return centre.scale(1/count);}
function skirtClearance(root,point){const skirt=root.getChildMeshes().find(m=>/draped wool skirt/i.test(m.name));assert.ok(skirt);const vertices=localVertices(root,skirt),indices=skirt.getIndices();let inside=false,clearance=Infinity,sections=0;for(let i=0;i<indices.length;i+=3){const face=Array.from(indices.slice(i,i+3),index=>vertices[index]),cuts=[];for(let edge=0;edge<3;edge++){const a=face[edge],b=face[(edge+1)%3];if((a.y<=point.y&&b.y>point.y)||(b.y<=point.y&&a.y>point.y)){const t=(point.y-a.y)/(b.y-a.y);cuts.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}if(cuts.length!==2)continue;sections++;const [a,b]=cuts;if((a.z>point.z)!==(b.z>point.z)&&point.x<(b.x-a.x)*(point.z-a.z)/(b.z-a.z)+a.x)inside=!inside;const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.z-a.z)*dz)/(dx*dx+dz*dz||1)));clearance=Math.min(clearance,Math.hypot(point.x-a.x-t*dx,point.z-a.z-t*dz));}const ys=vertices.map(p=>p.y);assert.ok(sections>0||point.y<Math.min(...ys)||point.y>Math.max(...ys),'an interior skirt height has real triangle-plane intersections');return {inside,clearance};}
test('default residents use the supplied native skins for both sexes and distinct age surfaces',async()=>studio(({scene,actors})=>{
 const s=stateWithPeople(),before=JSON.stringify(s);actors.update(s,.05);scene.render();const variants=[];
 for(const c of s.citizens){const root=actors.rootFor({citizenId:c.id});assert.equal(root.metadata.nativeResident,true,'new body must be visible by default');assert.equal(root.metadata.sourceWalk,true);assert.equal(root.metadata.citizenId,c.id);const source=sourceAsset(root),meta=source.asset.extras.native_resident;assert.equal(root.metadata.nativeStrideMetres,meta.strideMetres,'distance clock uses the actual source clip stride');const skins=root.getChildMeshes().filter(m=>m.skeleton),triangles=source.meshes.reduce((total,m)=>total+m.primitives.reduce((sum,p)=>sum+source.accessors[p.indices].count/3,0),0);assert.ok(skins.every(m=>m.skeleton.bones.length===meta.bones));assert.ok(triangles<=9636+1200,'stay within the larger supplied figure plus one draped skirt');assert.equal(skins.reduce((n,m)=>n+m.getTotalIndices()/3,0),triangles,'instantiation does not duplicate body or clothing');assert.ok(root.scaling.x/root.scaling.y>.90&&root.scaling.x/root.scaling.y<1.12,'identity must not squash anatomy');variants.push(root.metadata.residentVariant);}
 assert.deepEqual(variants,['male','female','child','adolescent']);assert.equal(JSON.stringify(s),before);
}));
test('native specialist upper cloth follows native bones and calling changes leave no layered remnants',async()=>studio(({scene,actors})=>{
 const s=stateWithPeople();s.citizens=s.citizens.slice(0,2);for(const c of s.citizens){c.calling='potter';c.role='production';}actors.update(s,.05);scene.render();
 for(const c of s.citizens){const root=actors.rootFor({citizenId:c.id}),cloth=root.getChildMeshes().filter(m=>m.metadata?.profession==='potter'),source=sourceAsset(root);assert.equal(cloth.length,1);assert.equal(cloth[0].skeleton.bones.length,source.asset.extras.native_resident.bones,'profession uses the supplied native garment skin');assert.ok(!root.getChildMeshes().some(m=>/hair-bun|full-beard/.test(m.name)),'no old procedural hair blobs');}
 const count=scene.meshes.length;for(let i=0;i<12;i++){const old=scene.meshes.filter(m=>m.metadata?.profession);for(const c of s.citizens)c.calling=i%2?'potter':'weaver';actors.update(s,.05);scene.render();assert.ok(scene.meshes.length<=count+2);assert.ok(old.every(m=>m.isDisposed()),'each replaced garment is released');}for(const c of s.citizens)c.calling='auto';actors.update(s,.05);scene.render();for(const c of s.citizens)assert.ok(!actors.rootFor({citizenId:c.id}).getChildMeshes().some(m=>m.metadata?.profession));
}));
test('native relaxed hand surfaces clear the actual drapery and carrying palms reach the load on their own side',async()=>studio(({scene,actors})=>{
 const s=stateWithPeople();s.citizens=s.citizens.slice(0,2);
 for(const mode of ['idle','carry']){for(const c of s.citizens){c.cargo=mode==='carry'?{wood:3}:{};c.phase=mode==='carry'?'toStore':'waiting';}actors.update(s,.05);scene.render();for(const c of s.citizens){const root=actors.rootFor({citizenId:c.id});for(const side of ['l','r']){const palm=local(root,'hand_'+side),shoulder=local(root,'upperarm_'+side);assert.equal(Math.sign(palm.x),Math.sign(shoulder.x),`${mode}/${c.sex}/${side}: crossed wrists`);if(mode==='idle'){assert.ok(palm.y<shoulder.y-.20,'relaxed arms remain below the shoulders');const centre=palmSurfaceCentre(root,side),surface=skirtClearance(root,centre);assert.equal(surface.inside,false,`${c.sex}/${side}: palm surface is inside the actual wool skirt`);assert.ok(surface.clearance>.005,`${c.sex}/${side}: hand surface touches the wool skirt`);}else assert.ok(B.Vector3.Distance(palm,new B.Vector3(side==='l'?-.21:.21,1.01,.34))<.12,'carrying palm retains the existing load contact bound');}}}
}));

test('five distinct cloth cuts stay on the real male and female rigs and share geometry between wearers', async()=>studio(({scene,actors})=>{
 const state=stateWithPeople();
 state.citizens=state.citizens.slice(0,2);
 const twin={...state.citizens[0],id:7888,x:8};
 state.citizens.push(twin);
 const extents=[new Map(),new Map()];
 for(const [calling,style] of [['potter','apron'],['clayworker','short'],['kilnworker','sash'],['brickmaker','wrap'],['scribe','mantle']]){
  for(const c of state.citizens){c.calling=calling;c.role='production';c.pendingRole=null;}
  actors.update(state,.05);scene.render();
  const garments=state.citizens.map(c=>actors.rootFor({citizenId:c.id}).getChildMeshes().find(m=>m.metadata?.profession===calling));
  for(const [i,mesh] of garments.slice(0,2).entries()){
   assert.ok(mesh,style+' exists on '+state.citizens[i].sex);
   const p=mesh.getVerticesData(B.VertexBuffer.PositionKind),weights=mesh.getVerticesData(B.VertexBuffer.MatricesWeightsKind);
   let min=Infinity,max=-Infinity;
   for(let k=0;k<p.length;k+=3){
    assert.ok(Number.isFinite(p[k])&&Number.isFinite(p[k+1])&&Number.isFinite(p[k+2]));
    min=Math.min(min,p[k+1]);max=Math.max(max,p[k+1]);
    const j=k/3*4;assert.ok(Math.abs(weights[j]+weights[j+1]+weights[j+2]+weights[j+3]-1)<1e-5);
   }
   if(style==='apron' && state.citizens[i].sex==='f'){
    // This return of the front pleat moves in front of the knee in Walk.
    // The shorter pattern exposed a rectangular patch of the base robe.
    let frontCoverage=0;
    for(let k=0;k<p.length;k+=3) if(Math.abs(p[k])<.14 && p[k+2]>.21 && p[k+1]<.68) frontCoverage++;
    assert.ok(frontCoverage>=4,'the protective panel covers the returning front pleat below the knee fold');
   }
   extents[i].set(style,{min,max});
  }
  assert.equal(garments[0].geometry,garments[2].geometry,'one fitted pattern per source body and cut');
  assert.notEqual(garments[0].skeleton,garments[2].skeleton,'each wearer retains a separate moving skeleton');
 }
 for(const bounds of extents){
  assert.ok(bounds.get('apron').min+.07<bounds.get('short').min,'protective panel falls below the tucked short wrap');
  assert.ok(bounds.get('sash').max>bounds.get('apron').max+.18,'the sling reaches the shoulder');
  assert.ok(bounds.get('wrap').min<bounds.get('mantle').min,'a wrap falls below the shoulder shawl');
 }
}));
