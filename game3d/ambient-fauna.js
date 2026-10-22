import {WIDTH,HEIGHT} from '../world.js';
import {shoreDistance,surfaceElevation} from '../district3d/terrain.js';
export const AMBIENT_MODELS=Object.freeze({'orange-bird':{file:'imported-orange-bird.glb',count:3,moving:true},goose:{file:'imported-goose.glb',count:2},fox:{file:'imported-fox.glb',count:1},boar:{file:'imported-boar.glb',count:1},lioness:{file:'imported-lioness.glb',count:1}});
// Ambient actors are deliberately absent from saves, hunting, stocks and selection.
export function ambientDryPoint(state,x,y,margin=.18){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<1||y<1||x>WIDTH-2||y>HEIGHT-2||shoreDistance(x,y,state)<margin)return false;
 return !(state.buildings||[]).some(b=>{const r=b.type==='canal'?.36:.72;return Math.abs(b.x-x)<r&&Math.abs(b.y-y)<r;});
}
export function ambientClearSegment(state,a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.06));for(let i=0;i<=n;i++)if(!ambientDryPoint(state,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;return true;}
export function ambientAnchor(state,species,index=0){
 const houses=(state.buildings||[]).filter(b=>b.type==='house'),seed=species==='orange-bird'?(houses[index%Math.max(1,houses.length)]||{x:8,y:8}):species==='goose'?{x:6,y:11}:species==='fox'?{x:4,y:20}:species==='boar'?{x:4,y:25}:{x:34,y:26};
 for(let ring=0;ring<12;ring++)for(let j=0;j<12;j++){const angle=(j+index*.73)*Math.PI/6,r=.9+ring*.22,x=seed.x+Math.cos(angle)*r,y=seed.y+Math.sin(angle)*r;if(ambientDryPoint(state,x,y,species==='goose'?.20:.3)&& (['fox','boar','lioness'].includes(species)?!(state.buildings||[]).some(b=>Math.hypot(b.x-x,b.y-y)<3):true))return {x,y};}
 return null;
}
export async function createAmbientFauna(B,scene,meshes=[],options={}){
 const assets=new Map(),actors=[],warn=options.warn||console.warn,load=options.loadAsset||(file=>B.SceneLoader.LoadAssetContainerAsync('assets/art-courtyard/models/',`${file}?v=city-creatures-20261022-1`,scene,undefined,'.glb'));
 const entries=Object.entries(AMBIENT_MODELS);if(options.includeRestrictedBirds!==false)entries.push(['sky-birds',{file:'imported-sky-birds.glb',count:1}]);
 const results=await Promise.allSettled(entries.map(async([species,c])=>({species,asset:await load(c.file)})));
 for(const r of results)if(r.status==='fulfilled')assets.set(r.value.species,r.value.asset);else warn('Ambient animal unavailable; remaining fauna continues.',r.reason);
 let disposed=false,clock=0,initialized=false;
 function register(a){a.owned=a.root.getChildMeshes();for(const m of a.owned){m.isPickable=false;if(!m.isAnInstance)m.receiveShadows=true;meshes.push(m);}actors.push(a);return a;}
 function imported(species,index){const source=assets.get(species);if(!source)return null;const id=`ambient-${species}-${index}`,copy=source.instantiateModelsToScene(n=>`${id}-${n}`,false,{doNotInstantiate:true}),root=new B.TransformNode(id,scene),model=new B.TransformNode(`${id}-model`,scene);model.parent=root;for(const n of copy.rootNodes)n.parent=model;root.metadata={ambientId:id,ambientSpecies:species,sourceMotion:species==='orange-bird'?'source anim':species==='sky-birds'?'source Scene':'stationary unrigged; breathing only'};for(const g of copy.animationGroups){g.start(true);g.pause();}return register({root,model,groups:copy.animationGroups,skeletons:copy.skeletons,species,index,phase:index*.73,anchor:null,target:null,enabled:false});}
 function originalSky(index,shared){const root=new B.TransformNode(`ambient-sky-${index}`,scene);root.metadata={ambientId:`ambient-sky-${index}`,ambientSpecies:'sky-bird',sourceMotion:'original procedural wing flaps'};const body=shared.body.createInstance(`ambient-sky-${index}-body`),left=shared.wing.createInstance(`ambient-sky-${index}-left`),right=shared.wing.createInstance(`ambient-sky-${index}-right`);for(const m of [body,left,right])m.parent=root;body.scaling.set(.20,.13,.48);left.position.x=-.1;right.position.x=.1;right.rotation.z=Math.PI;return register({root,model:root,species:'original-sky',index,phase:index*.8,groups:[],wings:[left,right],enabled:true});}
 const templates=[];let skyMaterial;
 if(!assets.has('sky-birds')){
  skyMaterial=new B.StandardMaterial('ambient-sky-ochre',scene);skyMaterial.diffuseColor=new B.Color3(.27,.23,.18);const body=B.MeshBuilder.CreateSphere('ambient-sky-template-body',{diameter:1,segments:6},scene),wing=B.MeshBuilder.CreateBox('ambient-sky-template-wing',{width:.65,height:.026,depth:.17},scene);body.material=wing.material=skyMaterial;body.isVisible=wing.isVisible=false;body.isPickable=wing.isPickable=false;templates.push(body,wing);for(let i=0;i<8;i++)originalSky(i,{body,wing});
 }else imported('sky-birds',0);
 for(const [species,c]of Object.entries(AMBIENT_MODELS))for(let i=0;i<c.count;i++)imported(species,i);
 function seek(a,state){const p=ambientAnchor(state,a.species,a.index);a.anchor=p;a.target=null;a.enabled=!!p;a.root.setEnabled(!!p);if(p)a.root.position.set(p.x*6,surfaceElevation(p.x,p.y,state),p.y*6);}
 function animate(a,t){for(const g of a.groups){const duration=Math.max(.1,(g.to-g.from)/(g.targetedAnimations[0]?.animation.framePerSecond||30));g.goToFrame(g.from+((t+a.phase)%duration)/duration*(g.to-g.from));}}
 function update(state,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;speed=Number.isFinite(speed)?Math.max(0,Math.min(4,speed)):1;const advancing=!paused&&dt>0&&speed>0;if(advancing)clock+=dt*speed;
  for(const a of actors){const sky=a.species==='sky-birds'||a.species==='original-sky';
   if(sky){if(!advancing&&initialized)continue;const t=clock*.045+a.phase,offset=a.index%4;a.root.position.set(WIDTH*3+Math.cos(t)*75+offset*1.1,17+Math.sin(t*.6)*2+(a.index%3)*.7,HEIGHT*3+Math.sin(t)*55+Math.floor(a.index/4)*2);a.root.rotation.y=-t;a.root.rotation.z=.04*Math.sin(t);if(a.wings){a.wings[0].rotation.z=.55*Math.sin(clock*7+a.phase);a.wings[1].rotation.z=Math.PI-.55*Math.sin(clock*7+a.phase);}animate(a,clock);continue;}
   if(!initialized)seek(a,state);if(!advancing)continue;
   const x=a.root.position.x/6,y=a.root.position.z/6;
   if(!a.anchor||!ambientDryPoint(state,x,y)){seek(a,state);continue;}
   if(!a.enabled)continue;
   if(a.species==='orange-bird'){
    if(!a.target){const angle=(Math.floor(clock/4)+a.index*2.1)*2.4,candidate={x:a.anchor.x+Math.cos(angle)*.46,y:a.anchor.y+Math.sin(angle)*.46};if(ambientClearSegment(state,{x,y},candidate))a.target=candidate;}
    if(a.target){const dx=a.target.x-x,dy=a.target.y-y,d=Math.hypot(dx,dy),step=Math.min(d,dt*speed*.055),nx=x+(d?dx/d*step:0),ny=y+(d?dy/d*step:0);if(ambientClearSegment(state,{x,y},{x:nx,y:ny})){a.root.position.set(nx*6,surfaceElevation(nx,ny,state),ny*6);if(d>.001)a.root.rotation.y=Math.atan2(dx,dy);}else a.target=null;if(d<.015)a.target=null;}
    animate(a,clock);
   }else {a.model.scaling.y=1+.004*Math.sin(clock*1.6+a.phase);a.model.rotation.y=.025*Math.sin(clock*.25+a.phase);}
  }
  initialized=true;
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of actors){for(const m of a.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of a.groups)g.dispose();a.root.dispose();for(const s of a.skeletons||[])s.dispose();}actors.length=0;for(const t of templates)t.dispose();skyMaterial?.dispose();for(const a of assets.values())a.dispose();assets.clear();}
 return {update,dispose,roots:()=>actors.map(a=>a.root)};
}
