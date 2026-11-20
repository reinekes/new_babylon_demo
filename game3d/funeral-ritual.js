import {isStrictSumer} from '../scenario-profiles.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {createFestivalCandles} from './festival-candles.js';
// Funeral props are presentation-only. Stable deceased IDs own one shrouded bier;
// route coordinates, personal identity and inventories remain in the simulation.
export function createFuneralRitual(B,scene,meshes){
 const biers=new Map(),torches=new Map(),materials=[],lights=[],candles=createFestivalCandles(B,scene,meshes);let template=null;
 const material=(name,color,emissive=false)=>{const m=new B.StandardMaterial(`rite-${name}`,scene);const tint=B.Color3.FromHexString(color);m.diffuseColor=emissive?tint:tint.toLinearSpace();m.specularColor=B.Color3.Black();if(emissive){m.emissiveColor=m.diffuseColor;m.disableLighting=true;}materials.push(m);return m;};
 const wood=material('reed-wood','#705139'),wrap=material('torch-wrapping','#b6a283'),white=material('white-shroud','#d8d1bd'),outer=material('flame-amber','#f57a14',true),inner=material('flame-core','#fff0aa',true);
 function track(m,parent,mat){m.parent=parent;m.material=mat;m.isPickable=false;m.receiveShadows=true;meshes.push(m);return m;}
 function box(name,parent,mat,w,h,d,x=0,y=0,z=0){const m=track(B.MeshBuilder.CreateBox(name,{width:w,height:h,depth:d},scene),parent,mat);m.position.set(x,y,z);return m;}
 function flame(name,parent,mat,size,y){const m=track(B.MeshBuilder.CreateCylinder(name,{height:size,diameterTop:0,diameterBottom:size*.40,tessellation:6},scene),parent,mat);m.position.y=y;return m;}
 function disposeRoot(root){for(const m of root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}root.dispose();}
 function bierTemplate(){if(template)return template;const root=new B.TransformNode('funeral-prop-template',scene),bundle=new B.TransformNode('funeral-shroud-template',scene);bundle.parent=root;
  // Linen hangs from the shoulders, chest, knees and toes to a flat underside.
  const sections=[[-.85,.012,.12],[-.79,.105,.205],[-.68,.13,.23],[-.54,.105,.18],[-.40,.145,.22],[-.25,.17,.235],[-.08,.205,.27],[.08,.209,.29],[.23,.233,.314],[.34,.245,.30],[.43,.205,.235],[.48,.11,.195],[.53,.107,.236],[.61,.144,.302],[.70,.147,.30],[.78,.112,.25],[.835,.04,.195],[.845,.008,.18]];
  const ring=([z,width,top],extra=0)=>Array.from({length:25},(_,i)=>{
   const theta=i*Math.PI/12,side=Math.cos(theta),up=Math.sin(theta),wave=.012*Math.cos(3*theta+z*3)*Math.max(0,up);
   return new B.Vector3((width+extra)*side,.076+(top-.076)*(1+up)*.5+wave+extra*up,z);
  });
  track(B.MeshBuilder.CreateRibbon('white-shroud-template',{pathArray:sections.map(section=>ring(section)),sideOrientation:B.Mesh.DOUBLESIDE},scene),bundle,white);
  for(const index of [3,11])track(B.MeshBuilder.CreateTube('linen-tie-template',{path:ring(sections[index],.002),radius:.012,tessellation:5},scene),bundle,wrap);
  const lip=track(B.MeshBuilder.CreateSphere('cloth-grip-template',{diameter:1,segments:6},scene),bundle,white);
  lip.position.set(0,.18,-.80);lip.scaling.set(.10,.045,.095);
  for(let slat=0;slat<15;slat++)box('woven-bed-template',root,wrap,.72,.043,.103,0,.038,(slat-7)*.116);
  for(const x of [-.25,-.11,.11,.25])box('reed-lashing-template',root,wood,.019,.019,1.74,x,.064);
  for(const x of [-.378,.378]){
   box('rail-template',root,wood,.045,.045,2.40,x,0);
   for(const z of [-1.08,1.08]){
    const bow=[[-.085,.018],[-.065,.105],[-.035,.133],[.035,.133],[.065,.105],[.085,.018]].map(([offset,y])=>new B.Vector3(x,y,z+offset));
    track(B.MeshBuilder.CreateTube('bier-lifting-loop',{path:bow,radius:.012,tessellation:6},scene),root,wrap);
   }
  }
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
   const animal=view.jackals?.find(j=>j.bundleId===b.id&&j.pulling),mouth=animal&&jackalMouth?.(animal.id);a.bundle.position.set(0,0,0);a.bundle.rotation.set(0,0,0);
   const puller=b.transport==='sledge'&&b.carriers[0];if(puller){const inverse=a.root.computeWorldMatrix(true).clone().invert();
    const grip=hand=>B.Vector3.TransformCoordinates(new B.Vector3(hand.x*6,surfaceElevation(hand.x,hand.y,state)+hand.height,hand.y*6),inverse);
    const hitch=new B.Vector3(0,.04,1.20),right=grip(puller.hands.right);
    const points=puller.pullingSledge?[hitch,grip(puller.hands.left),right,hitch]:[hitch,hitch,right,right];
    if(a.rope){a.rope.setEnabled(true);B.MeshBuilder.CreateLines('sledge-rope',{points,instance:a.rope},scene);}else{a.rope=B.MeshBuilder.CreateLines('sledge-rope',{points},scene);a.rope.parent=a.root;a.rope.color=B.Color3.FromHexString('#b6a283');meshes.push(a.rope);}}else if(a.rope){a.rope.setEnabled(false);}
   if(b.drag){
    const restingGrip=new B.Vector3(0,.18,-.80),inverse=a.root.computeWorldMatrix(true).clone().invert();
    const blend=b.drag.contact,headGround=surfaceElevation(b.drag.x,b.drag.y,state)+.16;
    if(mouth){
     const local=B.Vector3.TransformCoordinates(mouth,inverse);
     // Keep the held end at the teeth while the far end slides on the ground.
     const pitch=Math.max(-.16,Math.min(.19,Math.atan2(mouth.y-headGround,1.53)))*b.drag.pull;
     a.bundle.rotation.x=pitch;
     const rotatedGrip=B.Vector3.TransformCoordinates(restingGrip,B.Matrix.RotationX(pitch));
     a.bundle.position.copyFrom(local.subtract(rotatedGrip).scale(blend));
    }else{
     const ground=surfaceElevation(b.drag.x,b.drag.y,state);
     a.bundle.position.copyFrom(B.Vector3.TransformCoordinates(new B.Vector3(b.drag.x*6,ground+b.height*(1-b.drag.pull),b.drag.y*6),inverse));
    }
   }
  }
  for(const [id,a]of biers)if(!seen.has(id)){disposeRoot(a.root);biers.delete(id);}
  candles.update((view?.participants||[]).filter(p=>p.candle),state.festival?.elapsed||0,torchGrips,{shell:isStrictSumer(state)});
  const flames=new Set();for(const p of view?.participants||[]){if(!p.torch||p.candle)continue;flames.add(p.id);const a=torchFor(p.id),grip=torchGrips.get(p.id);a.root.setEnabled(!!grip);if(grip)a.root.position.copyFrom(grip);
   const flicker=.91+.09*Math.sin(time*19+p.id*2.1)+.045*Math.sin(time*31+p.id);a.fire.scaling.set(.96+.08*Math.sin(time*13+p.id),flicker,1);a.fire.rotation.z=.06*Math.sin(time*11+p.id);a.tongue.rotation.z=.20*Math.sin(time*17+p.id);if(a.light)a.light.intensity=.40*flicker;
  }
  for(const [id,a]of torches)if(!flames.has(id)){if(a.light){a.light.dispose();const i=lights.indexOf(a.light);if(i>=0)lights.splice(i,1);}disposeRoot(a.root);torches.delete(id);}
 }
 return {update,dispose(){candles.dispose();for(const a of biers.values())disposeRoot(a.root);for(const a of torches.values())disposeRoot(a.root);for(const l of lights)l.dispose();if(template)template.root.dispose();for(const m of materials)m.dispose();biers.clear();torches.clear();},rootForBier(id){return biers.get(id)?.root;}};
}
