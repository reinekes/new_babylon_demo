import {surfaceElevation} from '../district3d/terrain.js';
// Funeral props are presentation-only. Stable deceased IDs own one shrouded bier;
// route coordinates, personal identity and inventories remain in the simulation.
export function createFuneralRitual(B,scene,meshes){
 const biers=new Map(),torches=new Map(),materials=[],lights=[];let template=null;
 const material=(name,color,emissive=false)=>{const m=new B.StandardMaterial(`rite-${name}`,scene);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=B.Color3.Black();if(emissive){m.emissiveColor=m.diffuseColor;m.disableLighting=true;}materials.push(m);return m;};
 const wood=material('reed-wood','#705139'),wrap=material('torch-wrapping','#b6a283'),white=material('white-shroud','#f4f0e5'),outer=material('flame-amber','#f57a14',true),inner=material('flame-core','#fff0aa',true);
 function track(m,parent,mat){m.parent=parent;m.material=mat;m.isPickable=false;m.receiveShadows=true;meshes.push(m);return m;}
 function box(name,parent,mat,w,h,d,x=0,y=0,z=0){const m=track(B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),parent,mat);m.position.set(x,y,z);return m;}
 function flame(name,parent,mat,size,y){const m=track(B.MeshBuilder.CreateCylinder(name,{height:size,diameterTop:0,diameterBottom:size*.40,tessellation:6},scene),parent,mat);m.position.y=y;return m;}
 function disposeRoot(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}root.dispose();}
 function bierTemplate(){if(template)return template;const root=new B.TransformNode('funeral-prop-template',scene),bundle=new B.TransformNode('funeral-shroud-template',scene);bundle.parent=root;
  const cloth=track(B.MeshBuilder.CreateLathe('white-shroud-template',{shape:[[-.85,.06],[-.75,.12],[-.46,.17],[-.08,.22],[.22,.26],[.37,.23],[.45,.14],[.57,.16],[.73,.14],[.84,.025]].map(([y,r])=>new B.Vector3(r,y,0)),tessellation:12,cap:B.Mesh.CAP_ALL},scene),bundle,white);cloth.rotation.x=Math.PI/2;cloth.scaling.z=.65;cloth.position.y=.18;
  for(const z of [-.53,.53])box('cloth-tie-template',bundle,wrap,.49,.035,.045,0,.21,z);
  box('cloth-grip-template',bundle,white,.095,.04,.12,0,.18,-.80);
  box('reed-bed-template',root,wrap,.72,.065,1.78,0,.035);
  for(const x of [-.378,.378])box('rail-template',root,wood,.045,.045,2.40,x,0);
  const merge=(parts,name,parent)=>{for(const m of parts){m.computeWorldMatrix(true);const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}const merged=B.Mesh.MergeMeshes(parts,true,true,undefined,false,true);merged.name=name;merged.parent=parent;merged.isVisible=false;merged.receiveShadows=true;if(merged.material)materials.push(merged.material);return merged;};
  const clothParts=bundle.getChildMeshes(),bedParts=root.getChildMeshes().filter(m=>!clothParts.includes(m));template={root,bundle,cloth:merge(clothParts,'funeral-white-shroud-source',bundle),bed:merge(bedParts,'funeral-bier-source',root)};return template;
 }
 function bierFor(b){let a=biers.get(b.id);if(a)return a;const source=bierTemplate(),root=new B.TransformNode(b.id,scene),bundle=new B.TransformNode(`${b.id}-shroud`,scene);bundle.parent=root;root.metadata={deceasedId:b.deceasedId,funeralBier:true};
  // Two instanced meshes per deceased share geometry and GPU batches. Every
  // deceased remains individually represented even in a mass-casualty save.
  for(const [mesh,parent,name]of [[source.cloth,bundle,'white-shroud'],[source.bed,root,'bier-rails']]){const instance=mesh.createInstance(`${b.id}-${name}`);instance.parent=parent;instance.isVisible=true;instance.isPickable=false;meshes.push(instance);}
  a={root,bundle};biers.set(b.id,a);return a;
 }
 function torchFor(id){let a=torches.get(id);if(a)return a;const root=new B.TransformNode(`funeral-torch-${id}`,scene);
  box('torch-stem',root,wood,.045,.70,.045,0,.28);box('torch-wrapped-head',root,wrap,.09,.21,.09,0,.65);
  const fire=new B.TransformNode(`funeral-fire-${id}`,scene);fire.parent=root;const flameOuter=flame('torch-outer-flame',fire,outer,.31,.89),flameInner=flame('torch-inner-flame',fire,inner,.19,.84),tongue=flame('torch-flame-tongue',fire,outer,.20,1.00);tongue.position.x=.035;
  let light=null;if(lights.length<3){light=new B.PointLight(`funeral-fire-light-${id}`,new B.Vector3(0,.9,0),scene);light.parent=root;light.diffuse=B.Color3.FromHexString('#ffad55');light.intensity=.45;light.range=3;lights.push(light);}a={root,fire,flameOuter,flameInner,tongue,light};torches.set(id,a);return a;
 }
 function update(view,state,time,torchGrips=new Map(),jackalMouth=null){
  const seen=new Set();for(const b of view?.biers||[]){if(b.visible===false)continue;seen.add(b.id);const a=bierFor(b);a.root.position.set(b.x*6,surfaceElevation(b.x,b.y,state)+b.height,b.y*6);a.root.rotation.y=b.yaw;
   // A shroud remains fully opaque and recognizable while the animal tugs it.
   const animal=view.jackals?.find(j=>j.bundleId===b.id&&j.pulling),mouth=animal&&jackalMouth?.(animal.id);a.bundle.position.set(0,0,0);a.bundle.rotation.y=0;
   const puller=b.transport==='sledge'&&b.carriers[0];if(puller){const hand=puller.hands.right,inverse=a.root.computeWorldMatrix(true).clone().invert(),grip=B.Vector3.TransformCoordinates(new B.Vector3(hand.x*6,surfaceElevation(hand.x,hand.y,state)+hand.height,hand.y*6),inverse),points=[new B.Vector3(0,.04,1.20),grip];if(a.rope)B.MeshBuilder.CreateLines('sledge-rope',{points,instance:a.rope},scene);else{a.rope=B.MeshBuilder.CreateLines('sledge-rope',{points},scene);a.rope.parent=a.root;a.rope.color=B.Color3.FromHexString('#b6a283');meshes.push(a.rope);}}else if(a.rope){a.rope.setEnabled(false);}
   if(mouth){const dx=(animal.faceX-animal.x),dz=(animal.faceY-animal.y),length=Math.hypot(dx,dz)||1,forward=new B.Vector3(dx/length,0,dz/length),centre=mouth.add(forward.scale(.80)),local=B.Vector3.TransformCoordinates(centre,a.root.computeWorldMatrix(true).clone().invert());a.bundle.position.copyFrom(local);a.bundle.position.y-=.18;a.bundle.rotation.y=Math.atan2(forward.x,forward.z)-b.yaw;}
  }
  for(const [id,a]of biers)if(!seen.has(id)){disposeRoot(a.root);biers.delete(id);}
  const flames=new Set();for(const p of view?.participants||[]){if(!p.torch)continue;flames.add(p.id);const a=torchFor(p.id),grip=torchGrips.get(p.id);a.root.setEnabled(!!grip);if(grip)a.root.position.copyFrom(grip);
   const flicker=.91+.09*Math.sin(time*19+p.id*2.1)+.045*Math.sin(time*31+p.id);a.fire.scaling.set(.96+.08*Math.sin(time*13+p.id),flicker,1);a.fire.rotation.z=.06*Math.sin(time*11+p.id);a.tongue.rotation.z=.20*Math.sin(time*17+p.id);if(a.light)a.light.intensity=.40*flicker;
  }
  for(const [id,a]of torches)if(!flames.has(id)){if(a.light){a.light.dispose();const i=lights.indexOf(a.light);if(i>=0)lights.splice(i,1);}disposeRoot(a.root);torches.delete(id);}
 }
 return {update,dispose(){for(const a of biers.values())disposeRoot(a.root);for(const a of torches.values())disposeRoot(a.root);for(const l of lights)l.dispose();if(template)template.root.dispose();for(const m of materials)m.dispose();biers.clear();torches.clear();},rootForBier(id){return biers.get(id)?.root;}};
}
