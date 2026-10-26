import {relicQuestView} from '../relic-quest.js';
export function createRelicScene(B,scene){
 const root=new B.TransformNode('god-only-oasis-relic',scene),gold=new B.StandardMaterial('relic-ancient-gold',scene),lapis=new B.StandardMaterial('relic-lapis',scene),glow=new B.StandardMaterial('relic-god-vision',scene);
 gold.diffuseColor=B.Color3.FromHexString('#ba9254');gold.emissiveColor=B.Color3.FromHexString('#3d2b0e');lapis.diffuseColor=B.Color3.FromHexString('#246f9b');lapis.emissiveColor=B.Color3.FromHexString('#10385d');glow.emissiveColor=B.Color3.FromHexString('#d3b65c');glow.disableLighting=true;glow.alpha=.42;glow.disableDepthWrite=true;
 const ring=B.MeshBuilder.CreateTorus('relic-gold-ring',{diameter:.58,thickness:.065,tessellation:16},scene);ring.parent=root;ring.material=gold;
 const seal=B.MeshBuilder.CreateCylinder('relic-lapis-seal',{height:.10,diameter:.34,tessellation:8},scene);seal.parent=root;seal.position.y=.035;seal.material=lapis;
 const vision=B.MeshBuilder.CreateTorus('relic-visible-only-to-god',{diameter:1.15,thickness:.025,tessellation:24},scene);vision.material=glow;vision.renderingGroupId=2;
 const chosen=B.MeshBuilder.CreateTorus('possessed-citizen-halo',{diameter:1.05,thickness:.045,tessellation:24},scene);chosen.material=glow;chosen.renderingGroupId=2;
 for(const m of [ring,seal,vision,chosen]){m.isPickable=false;m.checkCollisions=false;}
 function update(s){const v=relicQuestView(s);root.setEnabled(!!v&&['lake','ground','temple'].includes(v.artifact.location));vision.setEnabled(!!v&&['lake','ground'].includes(v.artifact.location));chosen.setEnabled(!!v?.active);if(!v)return;
  root.position.set(v.artifact.x*6,v.artifact.underwater?-.48:.16,v.artifact.y*6);vision.position.set(v.artifact.x*6,.12,v.artifact.y*6);vision.scaling.setAll(1+.12*Math.sin((s.simTime||0)*2));
  const c=s.citizens.find(c=>c.id===v.actorId);if(c)chosen.position.set(c.x*6,.13,c.y*6);
 }
 return {update,dispose(){root.dispose();vision.dispose();chosen.dispose();gold.dispose();lapis.dispose();glow.dispose();}};
}
export function drawRelic2D(renderer,s){const v=relicQuestView(s);if(!v||!renderer.ctx||!renderer.point)return;const c=renderer.ctx,p=renderer.point(v.artifact.x,v.artifact.y);if(['lake','ground','temple'].includes(v.artifact.location)){c.save();c.strokeStyle='#d4af53';c.fillStyle='#2782ad';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,5,0,Math.PI*2);c.fill();c.stroke();c.restore();}if(v.active){const a=s.citizens.find(c=>c.id===v.actorId);if(a){const p=renderer.point(a.x,a.y);c.save();if(v.artifact.location==='carried'){c.fillStyle='#2782ad';c.strokeStyle='#d4af53';c.lineWidth=2;c.beginPath();c.arc(p.x+3,p.y-8,3,0,Math.PI*2);c.fill();c.stroke();}c.strokeStyle='#72c1dc';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,10,5,0,0,Math.PI*2);c.stroke();c.restore();}}}
