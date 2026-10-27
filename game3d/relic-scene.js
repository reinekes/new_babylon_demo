import {relicQuestViews} from '../relic-quest.js';
import {footprintSize} from '../footprints.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {WATER_HEIGHT} from './water.js';

export function templeRelicAnchor(s,v){
 const b=(s.buildings||[]).find(b=>(b.id||`${b.x},${b.y}`)===v.artifact.temple),n=b?footprintSize(b):1;
 return b?{x:b.x+(n-1)/2,y:b.y+(n-1)/2+n*.5+.05,height:.50}:{x:v.artifact.x,y:v.artifact.y,height:.50};
}
// Tiny view-only objects: no NPC navigation, picking or freight changes.
export function createRelicScene(B,scene,{reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false}={}){
 const meshes=[],items=new Map(),owned=[],material=(name,color,alpha=1)=>{const m=new B.StandardMaterial(name,scene);m.diffuseColor=B.Color3.FromHexString(color);m.emissiveColor=m.diffuseColor.scale(.32);m.alpha=alpha;owned.push(m);return m;};
 const gold=material('relic-ancient-gold','#ba9254'),lapis=material('relic-lapis','#246f9b'),earth=material('relic-earth-seal','#a56c43'),stone=material('relic-altar-stone','#b1a284'),glow=material('relic-god-vision','#d3b65c',.52);
 glow.disableLighting=true;glow.emissiveColor=B.Color3.FromHexString('#e8cc75');glow.disableDepthWrite=true;
 const register=(m,mat)=>{m.material=mat;m.isPickable=false;m.checkCollisions=false;meshes.push(m);return m;};
 for(const id of ['oasis','land']){
  const root=new B.TransformNode(`god-only-${id}-relic`,scene),ring=register(B.MeshBuilder.CreateTorus(`relic-${id}-gold-ring`,{diameter:.66,thickness:.07,tessellation:16},scene),gold);ring.parent=root;
  const seal=register(B.MeshBuilder.CreateCylinder(`relic-${id}-seal`,{height:.12,diameter:.38,tessellation:id==='land'?6:8},scene),id==='land'?earth:lapis);seal.parent=root;seal.position.y=.04;
  const symbol=register(B.MeshBuilder.CreatePolyhedron(`relic-${id}-symbol`,{type:id==='land'?0:1,size:.13},scene),gold);symbol.parent=root;symbol.position.y=.15;
  const vision=register(B.MeshBuilder.CreateTorus(`relic-${id}-visible-only-to-god`,{diameter:1.35,thickness:.035,tessellation:24},scene),glow);vision.renderingGroupId=2;
  const altar=register(B.MeshBuilder.CreateCylinder(`relic-${id}-temple-plinth`,{diameter:.85,height:.36,tessellation:8},scene),stone);altar.setEnabled(false);
  root.setEnabled(false);vision.setEnabled(false);items.set(id,{root,vision,altar});
 }
 const chosen=register(B.MeshBuilder.CreateTorus('possessed-citizen-halo',{diameter:1.05,thickness:.045,tessellation:24},scene),glow);chosen.renderingGroupId=2;chosen.setEnabled(false);
 let disposed=false,visibleIds=[];
 function update(s){if(disposed)return;const views=relicQuestViews(s);visibleIds=[];chosen.setEnabled(false);
  for(const [id,item]of items){const v=views.find(v=>v.id===id),visible=!!v&&['lake','ground','temple'].includes(v.artifact.location);item.root.setEnabled(visible);item.vision.setEnabled(!!v&&['lake','ground'].includes(v.artifact.location));item.altar.setEnabled(!!v&&v.artifact.location==='temple');if(!v)continue;
   const temple=v.artifact.location==='temple',at=temple?templeRelicAnchor(s,v):v.artifact,y=temple?at.height:v.artifact.underwater?visualSurfaceElevation(at.x,at.y,s)+.10:Math.max(0,visualSurfaceElevation(at.x,at.y,s))+.16;
   item.root.position.set(at.x*6,y,at.y*6);item.altar.position.set(at.x*6,.18,at.y*6);item.vision.position.set(at.x*6,v.artifact.underwater?WATER_HEIGHT+.04:.14,at.y*6);item.vision.scaling.setAll(reducedMotion?1:1+.08*Math.sin((s.simTime||0)*2));if(visible)visibleIds.push(id);
   if(v.active){const c=s.citizens.find(c=>c.id===v.actorId);if(c){chosen.setEnabled(true);chosen.position.set(c.x*6,v.swimming?WATER_HEIGHT+.04:.13,c.y*6);}}
  }
 }
 return {update,meshes,stats:()=>({visibleIds:[...visibleIds],meshes:meshes.length}),dispose(){if(disposed)return;disposed=true;for(const item of items.values())item.root.dispose();for(const m of meshes)if(!m.isDisposed())m.dispose();for(const m of owned)m.dispose();items.clear();}};
}
export function drawRelic2D(renderer,s){if(!renderer.ctx||!renderer.point)return;const c=renderer.ctx;
 for(const v of relicQuestViews(s)){const at=v.artifact.location==='temple'?templeRelicAnchor(s,v):v.artifact,p=renderer.point(at.x,at.y);if(['lake','ground','temple'].includes(v.artifact.location)){c.save();c.strokeStyle='#d4af53';c.fillStyle=v.id==='land'?'#b47b4d':'#2782ad';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.fill();c.stroke();c.restore();}
  if(v.active){const a=s.citizens.find(c=>c.id===v.actorId);if(a){const p=renderer.point(a.x,a.y);c.save();if(v.artifact.location==='carried'){c.fillStyle=v.id==='land'?'#b47b4d':'#2782ad';c.strokeStyle='#d4af53';c.lineWidth=2;c.beginPath();c.arc(p.x+3,p.y-8,3,0,Math.PI*2);c.fill();c.stroke();}c.strokeStyle='#72c1dc';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,10,5,0,0,Math.PI*2);c.stroke();c.restore();}}
 }
}
