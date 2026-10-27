import {relicQuestViews} from '../relic-quest.js';
import {footprintSize} from '../footprints.js';
import {templeRelicAnchor} from './relic-scene.js';
import {sacredModelTransform} from './sacred-models.js';

export const SACRED_EFFECT_LIMITS=Object.freeze({portals:4,bursts:2,meshes:64,lifetime:6.5});
// Small unlit meshes; no postprocess, shadows or additional lights. Completion
// stamps are observed only in memory; loading completed quests never replays.
export function createSacredEffects(B,scene,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
 const meshes=[],owned=[],portals=new Map(),bursts=[],seen=new Map();let state=null,time=0,disposed=false,ward=0;
 const mat=(name,color,alpha)=>{const m=new B.StandardMaterial(name,scene);m.emissiveColor=B.Color3.FromHexString(color);m.diffuseColor=m.emissiveColor;m.disableLighting=true;m.alpha=alpha;m.backFaceCulling=false;m.disableDepthWrite=true;owned.push(m);return m;};
 const blue=mat('ishtar-portal-blue','#3696e5',.27),edge=mat('ishtar-portal-edge','#80c6ff',.66),runes=mat('ishtar-gold-runes','#f1cc75',.82),gold=mat('relic-delivery-gold','#f9d985',.78),ray=mat('relic-delivery-beam','#9fd9ff',.38);
 function add(mesh,material){mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;meshes.push(mesh);return mesh;}
 function remove(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}root.dispose();}
 function portal(b){const root=new B.TransformNode('ishtar-portal-'+(b.id||`${b.x},${b.y}`),scene),{scale}=sacredModelTransform(b),size=footprintSize(b),center=(size-1)*3;
  root.position.set(b.x*6+center,.06,b.y*6+center);root.rotation.y=(b.rotation||0)*Math.PI/2;root.scaling.setAll(scale);
  const p=[0,1.1,.79,-.74,.06,.79,.74,.06,.79,.74,1.65,.79];for(let i=1;i<=16;i++){const a=i/16*Math.PI;p.push(Math.cos(a)*.74,1.65+Math.sin(a)*.74,.79);}const indices=[];for(let i=1;i<p.length/3;i++)indices.push(0,i,i===p.length/3-1?1:i+1);const normals=[];B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals});const curtain=add(new B.Mesh('ishtar-arched-curtain',scene),blue);data.applyToMesh(curtain);curtain.parent=root;
  const halo=add(B.MeshBuilder.CreateTorus('ishtar-vertical-halo',{diameter:1.8,thickness:.035,tessellation:32},scene),edge);halo.parent=root;halo.rotation.x=Math.PI/2;halo.position.set(0,1.30,.83);halo.scaling.set(.88,1,1.35);
  const wave=add(B.MeshBuilder.CreateTorus('ishtar-ground-wave',{diameter:4.8,thickness:.028,tessellation:32},scene),edge);wave.parent=root;wave.position.y=.025;
  const sigil=add(B.MeshBuilder.CreatePolyhedron('ishtar-divine-sigil',{type:1,size:.15},scene),runes);sigil.parent=root;sigil.position.set(0,2.62,.82);
  return {root,wave,halo,sigil,signature:`${b.x}:${b.y}:${b.rotation||0}:${b.footprint||1}`};
 }
 function burst(s,v){if(bursts.length>=SACRED_EFFECT_LIMITS.bursts)remove(bursts.shift().root);const at=templeRelicAnchor(s,v),root=new B.TransformNode('relic-delivery-'+v.id,scene);root.position.set(at.x*6,.14,at.y*6);
  const rings=[];for(let i=0;i<2;i++){const ring=add(B.MeshBuilder.CreateTorus('relic-blessing-ring',{diameter:5+i*2,thickness:.085,tessellation:32},scene),gold);ring.parent=root;ring.position.y=.05+i*.08;rings.push(ring);}
  const beam=add(B.MeshBuilder.CreateCylinder('relic-blessing-column',{height:12,diameterTop:.22,diameterBottom:2.4,tessellation:16},scene),ray);beam.parent=root;beam.position.y=6;
  const sparks=[];for(let i=0;i<12;i++){const spark=add(B.MeshBuilder.CreatePolyhedron('relic-blessing-star',{type:1,size:.17},scene),i%3?gold:edge);spark.parent=root;sparks.push(spark);}
  bursts.push({root,rings,beam,sparks,age:0,id:v.id});
 }
 function reset(s=null){for(const p of portals.values())remove(p.root);portals.clear();for(const b of bursts)remove(b.root);bursts.length=0;seen.clear();state=s;time=0;ward=s?.buffs?.inannaProtection||0;if(s)for(const v of relicQuestViews(s))seen.set(v.id,v.completedAt);}
 function update(s,dt=0,{paused=false}={}){if(disposed)return;if(s!==state)reset(s);const delta=paused?0:Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0));time+=delta;
  const gates=(s.buildings||[]).filter(b=>b.type==='ishtarGate'&&b.construction?.kind!=='new').slice(0,SACRED_EFFECT_LIMITS.portals),keys=new Set();for(const b of gates){const key=b.id||`${b.x},${b.y}`,signature=`${b.x}:${b.y}:${b.rotation||0}:${b.footprint||1}`;keys.add(key);let p=portals.get(key);if(p&&p.signature!==signature){remove(p.root);portals.delete(key);p=null;}if(!p){p=portal(b);portals.set(key,p);}p.pulse=Math.max(0,(p.pulse||0)-delta);const beat=reducedMotion?0:Math.sin(time*1.5);p.wave.scaling.setAll(1+beat*.035+(reducedMotion?0:p.pulse*.42));p.sigil.position.y=2.62+(reducedMotion?0:Math.sin(time*1.8)*.035);}
  for(const [key,p]of portals)if(!keys.has(key)){remove(p.root);portals.delete(key);}
  const currentWard=s.buffs?.inannaProtection||0;if(currentWard>ward&&!reducedMotion){time+=.7;for(const p of portals.values())p.pulse=2.5;}ward=currentWard;blue.alpha=.29+(reducedMotion?0:Math.sin(time*1.5)*.06)+(ward>0?.09:0);edge.alpha=.62+(reducedMotion?0:Math.sin(time*1.5)*.10);
  for(const v of relicQuestViews(s)){if(v.phase==='completed'&&v.completedAt!==null&&seen.has(v.id)&&seen.get(v.id)!==v.completedAt)burst(s,v);seen.set(v.id,v.completedAt);}
  for(const b of [...bursts]){b.age+=delta;if(b.age>SACRED_EFFECT_LIMITS.lifetime){remove(b.root);bursts.splice(bursts.indexOf(b),1);continue;}const t=b.age/SACRED_EFFECT_LIMITS.lifetime,fade=Math.max(0,1-t),movement=reducedMotion?0:b.age;
   for(let i=0;i<b.rings.length;i++){b.rings[i].scaling.setAll(1+movement*(.65+i*.2));b.rings[i].visibility=fade;}
   b.beam.visibility=fade*(reducedMotion?.45:1);for(let i=0;i<b.sparks.length;i++){const a=i*Math.PI*2/b.sparks.length+movement*.24,r=1.1+movement*.25;b.sparks[i].position.set(Math.cos(a)*r,.6+i*.60+(reducedMotion?0:Math.sin(time*1.4+i)*.18),Math.sin(a)*r);b.sparks[i].visibility=fade;}
  }
 }
 return {update,reset,meshes,stats:()=>({portals:portals.size,bursts:bursts.length,meshes:meshes.length}),dispose(){if(disposed)return;reset();disposed=true;for(const m of owned)m.dispose();}};
}
