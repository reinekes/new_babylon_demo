import {relicQuestViews} from '../relic-quest.js';
import {templeRelicAnchor} from './relic-scene.js';

export const SACRED_EFFECT_LIMITS=Object.freeze({portals:0,bursts:2,meshes:64,lifetime:6.5});
// Small unlit meshes; no postprocess, shadows or additional lights. Completion
// stamps are observed only in memory; loading completed quests never replays.
export function createSacredEffects(B,scene,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
 const meshes=[],owned=[],bursts=[],seen=new Map();let state=null,time=0,disposed=false;
 const mat=(name,color,alpha)=>{const m=new B.StandardMaterial(name,scene);m.emissiveColor=B.Color3.FromHexString(color);m.diffuseColor=m.emissiveColor;m.disableLighting=true;m.alpha=alpha;m.backFaceCulling=false;m.disableDepthWrite=true;owned.push(m);return m;};
 const edge=mat('relic-delivery-blue','#80c6ff',.66),gold=mat('relic-delivery-gold','#f9d985',.78),ray=mat('relic-delivery-beam','#9fd9ff',.38);
 function add(mesh,material){mesh.material=material;mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;meshes.push(mesh);return mesh;}
 function remove(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}root.dispose();}
 function burst(s,v){if(bursts.length>=SACRED_EFFECT_LIMITS.bursts)remove(bursts.shift().root);const at=templeRelicAnchor(s,v),root=new B.TransformNode('relic-delivery-'+v.id,scene);root.position.set(at.x*6,.14,at.y*6);
  const rings=[];for(let i=0;i<2;i++){const ring=add(B.MeshBuilder.CreateTorus('relic-blessing-ring',{diameter:5+i*2,thickness:.085,tessellation:32},scene),gold);ring.parent=root;ring.position.y=.05+i*.08;rings.push(ring);}
  const beam=add(B.MeshBuilder.CreateCylinder('relic-blessing-column',{height:12,diameterTop:.22,diameterBottom:2.4,tessellation:16},scene),ray);beam.parent=root;beam.position.y=6;
  const sparks=[];for(let i=0;i<12;i++){const spark=add(B.MeshBuilder.CreatePolyhedron('relic-blessing-star',{type:1,size:.17},scene),i%3?gold:edge);spark.parent=root;sparks.push(spark);}
  bursts.push({root,rings,beam,sparks,age:0,id:v.id});
 }
 function reset(s=null){for(const b of bursts)remove(b.root);bursts.length=0;seen.clear();state=s;time=0;if(s)for(const v of relicQuestViews(s))seen.set(v.id,v.completedAt);}
 function update(s,dt=0,{paused=false}={}){if(disposed)return;if(s!==state)reset(s);const delta=paused?0:Math.max(0,Math.min(.25,Number.isFinite(dt)?dt:0));time+=delta;
  edge.alpha=.62+(reducedMotion?0:Math.sin(time*1.5)*.10);
  for(const v of relicQuestViews(s)){if(v.phase==='completed'&&v.completedAt!==null&&seen.has(v.id)&&seen.get(v.id)!==v.completedAt)burst(s,v);seen.set(v.id,v.completedAt);}
  for(const b of [...bursts]){b.age+=delta;if(b.age>SACRED_EFFECT_LIMITS.lifetime){remove(b.root);bursts.splice(bursts.indexOf(b),1);continue;}const t=b.age/SACRED_EFFECT_LIMITS.lifetime,fade=Math.max(0,1-t),movement=reducedMotion?0:b.age;
   for(let i=0;i<b.rings.length;i++){b.rings[i].scaling.setAll(1+movement*(.65+i*.2));b.rings[i].visibility=fade;}
   b.beam.visibility=fade*(reducedMotion?.45:1);for(let i=0;i<b.sparks.length;i++){const a=i*Math.PI*2/b.sparks.length+movement*.24,r=1.1+movement*.25;b.sparks[i].position.set(Math.cos(a)*r,.6+i*.60+(reducedMotion?0:Math.sin(time*1.4+i)*.18),Math.sin(a)*r);b.sparks[i].visibility=fade;}
  }
 }
 return {update,reset,meshes,stats:()=>({portals:0,bursts:bursts.length,meshes:meshes.length}),dispose(){if(disposed)return;reset();disposed=true;for(const m of owned)m.dispose();}};
}
