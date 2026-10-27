import {visibleCitizens} from '../workforce.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {WATER_HEIGHT} from './water.js';
// Recognizable low-cost silhouettes keep all person IDs selectable until the rig arrives.
export function createBootstrapActors(B,scene){
 const meshes=[],actors=new Map(),cloth=new B.StandardMaterial('quick-linen',scene),skin=new B.StandardMaterial('quick-skin',scene);cloth.diffuseColor=B.Color3.FromHexString('#cdbf9e');skin.diffuseColor=B.Color3.FromHexString('#99623f');let disposed=false;
 function remove(a){for(const m of a.root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}a.root.dispose();}
 function update(s){if(disposed)return;const seen=new Set();for(const c of visibleCitizens(s)){seen.add(c.id);let a=actors.get(c.id);if(!a){const root=new B.TransformNode(`quick-citizen-${c.id}`,scene),body=B.MeshBuilder.CreateCylinder('quick-robe',{height:.96,diameterTop:.35,diameterBottom:.56,tessellation:7},scene),head=B.MeshBuilder.CreateSphere('quick-head',{diameter:.30,segments:6},scene);body.position.y=.70;body.material=cloth;head.position.y=1.37;head.material=skin;for(const m of[body,head]){m.parent=root;m.metadata={citizenId:c.id,bootstrap:true};m.isPickable=true;meshes.push(m);}root.scaling.setAll(c.age<16?.62:1);a={root};actors.set(c.id,a);}a.root.scaling.setAll(c.age<16?.62:1);a.root.position.set(c.x*6,c.swimming?WATER_HEIGHT-.48:surfaceElevation(c.x,c.y,s),c.y*6);a.root.rotation.x=c.swimming?1.12:0;a.root.metadata={...a.root.metadata,swimming:!!c.swimming};}for(const[id,a]of actors)if(!seen.has(id)){remove(a);actors.delete(id);}}
 return {meshes,update,rootFor(s){return actors.get(s?.citizenId)?.root;},dispose(){if(disposed)return;disposed=true;for(const a of actors.values())remove(a);actors.clear();cloth.dispose();skin.dispose();}};
}
