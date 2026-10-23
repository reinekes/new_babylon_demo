import {ecologyCount} from '../ecology.js';
import {skyFlightPose,SKY_BIRD_MODEL} from './sky-flight.js';
import {WIDTH,HEIGHT} from '../world.js';
import {footprintSize} from '../footprints.js';
import {shoreDistance,surfaceElevation} from '../district3d/terrain.js';
export const AMBIENT_MODELS=Object.freeze({
 'orange-bird':{file:'imported-orange-bird.glb',count:3,stride:.14,pace:.18},
 goose:{file:'imported-goose.glb',count:2,stride:.16,pace:.15},
 fox:{file:'imported-fox.glb',count:1,stride:.23,pace:.24},
 boar:{file:'imported-boar.glb',count:1,stride:.32,pace:.26},
 lioness:{file:'imported-lioness.glb',count:1,stride:.42,pace:.3},
 dog:{file:'ambient-dog.glb',count:1,stride:.36,pace:.32},
 duck:{file:'ambient-duck.glb',count:2,stride:.17,pace:.16},
 donkey:{file:'ambient-donkey.glb',count:1,stride:1.17,pace:.48},
 bull:{file:'ambient-bull.glb',count:1,stride:1.23,pace:.46},
 'sheep-kenchoo':{file:'ambient-sheep-kenchoo.glb',count:1,stride:.19,pace:.2}
});
// Ambient actors are deliberately absent from saves, hunting, stocks and selection.
export function ambientDryPoint(state,x,y,margin=.18){
 if(!Number.isFinite(x)||!Number.isFinite(y)||x<1||y<1||x>WIDTH-2||y>HEIGHT-2||shoreDistance(x,y,state)<margin)return false;
 return !(state.buildings||[]).some(b=>{const r=b.type==='canal'?.36:.72,n=footprintSize(b);return x>b.x-r&&x<b.x+n-1+r&&y>b.y-r&&y<b.y+n-1+r;});
}
export function ambientClearSegment(state,a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/.06));for(let i=0;i<=n;i++)if(!ambientDryPoint(state,a.x+(b.x-a.x)*i/n,a.y+(b.y-a.y)*i/n))return false;return true;}
export function ambientAnchor(state,species,index=0,occupied=[]){
 const kinds=Object.keys(AMBIENT_MODELS),id=kinds.indexOf(species),houses=(state.buildings||[]).filter(b=>b.type==='house'),home=houses[(Math.max(0,id)*2+index*3)%Math.max(1,houses.length)]||{x:8,y:8};
 const wild={goose:{x:27,y:10},duck:{x:29,y:21},fox:{x:4,y:24},boar:{x:28,y:17},lioness:{x:34,y:27},bull:{x:22,y:12},'sheep-kenchoo':{x:5,y:15},donkey:{x:home.x+2,y:home.y+2}};
 const base=wild[species]||home,seed={x:base.x+(index%2)*4.5-Math.floor(index/2)*2,y:base.y+Math.floor(index/2)*4-(index%2)*2};
 for(let ring=0;ring<32;ring++)for(let j=0;j<16;j++){const angle=(j+index*.73+id*1.37)*Math.PI/8,r=.9+ring*.28,x=seed.x+Math.cos(angle)*r,y=seed.y+Math.sin(angle)*r;if(ambientDryPoint(state,x,y,.3)&&occupied.every(p=>Math.hypot(p.x-x,p.y-y)>2.2)&&(!['fox','boar','lioness'].includes(species)||!(state.buildings||[]).some(b=>Math.hypot(b.x-x,b.y-y)<3)))return {x,y};}
 return null;
}
export async function createAmbientFauna(B,scene,meshes=[],options={}){
 const assets=new Map(),actors=[],warn=options.warn||console.warn,load=options.loadAsset||(file=>B.SceneLoader.LoadAssetContainerAsync('assets/art-courtyard/models/',`${file}?v=founding-village-20261023-1`,scene,undefined,'.glb'));
 const entries=Object.entries(AMBIENT_MODELS);if(options.includeRestrictedBirds!==false)entries.push(['sky-birds',{file:SKY_BIRD_MODEL,count:2}]);
 const results=await Promise.allSettled(entries.map(async([species,c])=>({species,asset:await load(c.file)})));
 for(const r of results)if(r.status==='fulfilled')assets.set(r.value.species,r.value.asset);else warn('Ambient animal unavailable; remaining fauna continues.',r.reason);
 let disposed=false,clock=0,initialized=false;
 function register(a){a.owned=a.root.getChildMeshes();for(const m of a.owned){m.isPickable=false;if(!m.isAnInstance)m.receiveShadows=true;meshes.push(m);}actors.push(a);return a;}
 function imported(species,index){const source=assets.get(species);if(!source)return null;const id=`ambient-${species}-${index}`,copy=source.instantiateModelsToScene(n=>`${id}-${n}`,false,{doNotInstantiate:true}),root=new B.TransformNode(id,scene),model=new B.TransformNode(`${id}-model`,scene);model.parent=root;for(const n of copy.rootNodes)n.parent=model;
  root.metadata={ambientId:id,ambientSpecies:species,sourceMotion:['orange-bird','sky-birds'].includes(species)?'source clip':'articulated Walk / Idle; provenance embedded in GLB'};
  const groups=new Map();for(const g of copy.animationGroups){g.stop();groups.set(g.name.startsWith(id+'-')?g.name.slice(id.length+1):g.name,g);}
  return register({root,model,groups,skeletons:copy.skeletons,species,index,phase:index*.73,anchor:null,target:null,enabled:false,walkPhase:index*.31,clip:null,clipClock:0,restUntil:0,routeAttempt:0});}
 function originalSky(index,shared){const root=new B.TransformNode(`ambient-sky-${index}`,scene);root.metadata={ambientId:`ambient-sky-${index}`,ambientSpecies:'sky-bird',sourceMotion:'original procedural wing flaps'};const body=shared.body.createInstance(`ambient-sky-${index}-body`),left=shared.wing.createInstance(`ambient-sky-${index}-left`),right=shared.wing.createInstance(`ambient-sky-${index}-right`);for(const m of [body,left,right])m.parent=root;body.scaling.set(.20,.13,.48);left.position.x=-.1;right.position.x=.1;right.rotation.z=Math.PI;return register({root,model:root,species:'original-sky',index,phase:index*.8,groups:new Map(),wings:[left,right],enabled:true});}
 const templates=[];let skyMaterial;
 if(!assets.has('sky-birds')){
  skyMaterial=new B.StandardMaterial('ambient-sky-ochre',scene);skyMaterial.diffuseColor=new B.Color3(.27,.23,.18);const body=B.MeshBuilder.CreateSphere('ambient-sky-template-body',{diameter:1,segments:6},scene),wing=B.MeshBuilder.CreateBox('ambient-sky-template-wing',{width:.65,height:.026,depth:.17},scene);body.material=wing.material=skyMaterial;body.isVisible=wing.isVisible=false;body.isPickable=wing.isPickable=false;templates.push(body,wing);for(let i=0;i<2;i++)originalSky(i,{body,wing});
 }else for(let i=0;i<2;i++)imported('sky-birds',i);
 for(const [species,c]of Object.entries(AMBIENT_MODELS))for(let i=0;i<2;i++)imported(species,i);
 function seek(a,state){const p=ambientAnchor(state,a.species,a.index,actors.filter(other=>other!==a&&other.anchor&&other.enabled).map(other=>other.anchor));a.anchor=p;a.target=null;a.enabled=!!p;a.root.setEnabled(!!p);if(p)a.root.position.set(p.x*6,surfaceElevation(p.x,p.y,state),p.y*6);}
 function animate(a,t,walking=false){
  const name=a.groups.has('Walk')?(walking?'Walk':'Idle'):a.groups.keys().next().value,g=a.groups.get(name);if(!g)return;
  if(a.clip!==name){for(const other of a.groups.values())other.stop();g.start(true);g.pause();a.clip=name;a.clipClock=t;}
  const duration=Math.max(.1,(g.to-g.from)/(g.targetedAnimations[0]?.animation.framePerSecond||30));
  const phase=name==='Walk'?a.walkPhase:((t-a.clipClock+a.phase)%duration)/duration;g.goToFrame(g.from+phase*(g.to-g.from));
  Object.assign(a.root.metadata,{clip:name,gaitPhase:a.walkPhase});
 }
 function removeActor(a){for(const m of a.owned){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}for(const g of a.groups.values())g.dispose();a.root.dispose();for(const sk of a.skeletons||[])sk.dispose();const i=actors.indexOf(a);if(i>=0)actors.splice(i,1);}
 function update(state,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;
  for(const a of [...actors]){const kind=['sky-birds','original-sky'].includes(a.species)?'sky-birds':a.species;if(a.index>=ecologyCount(state,kind,2))removeActor(a);}
  for(const species of Object.keys(AMBIENT_MODELS)){const desired=ecologyCount(state,species,2);for(let i=actors.filter(a=>a.species===species).length;i<desired;i++)imported(species,i);}
  const skyKind=assets.has('sky-birds')?'sky-birds':'original-sky',skyDesired=ecologyCount(state,'sky-birds',2);for(let i=actors.filter(a=>a.species===skyKind).length;i<skyDesired;i++){if(skyKind==='sky-birds')imported('sky-birds',i);else originalSky(i,{body:templates[0],wing:templates[1]});}
  dt=Number.isFinite(dt)?Math.max(0,Math.min(.1,dt)):0;speed=Number.isFinite(speed)?Math.max(0,Math.min(4,speed)):1;const advancing=!paused&&dt>0&&speed>0;if(advancing)clock+=dt*speed;
  for(const a of actors){const sky=a.species==='sky-birds'||a.species==='original-sky';
   if(sky){if(!advancing&&a.skyPlaced)continue;const p=skyFlightPose(clock*.045,a.index);a.root.position.set(p.x,p.y,p.z);a.root.rotation.y=p.yaw;a.root.rotation.z=p.bank;a.skyPlaced=true;if(a.wings){a.wings[0].rotation.z=.55*Math.sin(clock*7+a.phase);a.wings[1].rotation.z=Math.PI-.55*Math.sin(clock*7+a.phase);}animate(a,clock);continue;}
   if(!a.anchor)seek(a,state);if(!advancing)continue;
   const x=a.root.position.x/6,y=a.root.position.z/6;
   if(!a.anchor||!ambientDryPoint(state,x,y)){seek(a,state);continue;}
   if(!a.enabled)continue;
   const config=AMBIENT_MODELS[a.species];let moved=0;
   if(!a.target&&clock>=a.restUntil){
    const angle=(a.routeAttempt++ + a.index*2.1)*2.4,radius=.38+(a.routeAttempt%3)*.16,candidate={x:a.anchor.x+Math.cos(angle)*radius,y:a.anchor.y+Math.sin(angle)*radius};
    if(ambientClearSegment(state,{x,y},candidate))a.target=candidate;else a.restUntil=clock+.6;
   }
   if(a.target){
    const dx=a.target.x-x,dy=a.target.y-y,d=Math.hypot(dx,dy),step=Math.min(d,dt*speed*config.pace/6),nx=x+(d?dx/d*step:0),ny=y+(d?dy/d*step:0);
    if(ambientClearSegment(state,{x,y},{x:nx,y:ny})){a.root.position.set(nx*6,surfaceElevation(nx,ny,state),ny*6);moved=step*6;if(d>.001)a.root.rotation.y=Math.atan2(dx,dy);}else{a.target=null;a.restUntil=clock+.8;}
    if(d<=step+.001){a.target=null;a.restUntil=clock+1.2+a.index*.3;}
   }
   if(moved>0)a.walkPhase=(a.walkPhase+moved/config.stride)%1;
   animate(a,clock,moved>.00001);

  }
  initialized=true;
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of [...actors])removeActor(a);for(const t of templates)t.dispose();skyMaterial?.dispose();for(const a of assets.values())a.dispose();assets.clear();}
 return {update,dispose,roots:()=>actors.map(a=>a.root)};
}
