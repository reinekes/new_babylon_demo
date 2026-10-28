import {createBackgroundQueue,createLazyFeature} from './asset-loading.js';
import {loadBabylonVendors} from './vendor-loading.js';
import {createBootstrapActors} from './bootstrap-actors.js';
import {createBootstrapLandscape} from './bootstrap-landscape.js';
import {foundingCameraTarget} from '../starter-settlement.js';
import {createBuildingReach,nearbySimilar} from './building-reach.js';
import {bindMapControls,orbitCamera} from './map-controls.js';
import {Renderer as CanvasRenderer} from '../renderer.js';
import {canBuild} from '../engine.js';
import {WIDTH,HEIGHT,terrain} from '../world.js';
import {lightingAt} from '../city-life.js';
import {createHouseLights} from './house-lights.js';
import {createDistrictMaterials} from '../district3d/materials.js';
import {createMiracleGarden} from './miracle-garden.js';
import {vegetationBankDistance} from './valley-vegetation.js';
import {visualSurfaceElevation} from './lake-shore.js';
import {sceneryClear} from './nature.js';
import {weatherAt} from '../environment.js';
import {createRelicScene} from './relic-scene.js';
import {createSacredEffects} from './sacred-effects.js';
import {newFootprint} from '../footprints.js';

export const GAME3D_RELEASE='ceremony-poses-20261028-1';
export function worldCell(point){if(!Number.isFinite(point?.x)||!Number.isFinite(point?.z))return null;const x=Math.floor(point.x/6+.5),y=Math.floor(point.z/6+.5);return x>=0&&y>=0&&x<WIDTH&&y<HEIGHT?{x,y}:null;}
export function pickedEntity(mesh){for(let n=mesh;n;n=n.parent)if(n.metadata&&(n.metadata.tile||n.metadata.citizenId!==undefined||n.metadata.animalId))return n.metadata;return null;}
export function roadNear(state,point){let best=null,distance=.85;for(const road of state?.roads||[]){const {a,b}=road;if(!a||!b)continue;const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1))),d=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);if(d<distance){best=road;distance=d;}}return best;}
export function previewFor(state,type,cell,rotation=0){if(!type||!cell)return null;const reason=canBuild(state,type,cell.x,cell.y,false,rotation);return {...cell,allowed:!reason,reason};}
export async function createGameRenderer(canvas,onSelect,options={}){
 const injected=Object.hasOwn(options,'BABYLON');let B=injected?options.BABYLON:globalThis.BABYLON;
 const legacy=options.legacyFactory||((c,fn)=>new CanvasRenderer(c,fn));
 const manual=typeof location!=='undefined'&&new URLSearchParams(location.search).get('view')==='2d';
 const showLoading=()=>{const element=document.createElement('div');element.className='game3d-loading';element.setAttribute('role','status');element.innerHTML='<span>НОВЫЙ ВАВИЛОН</span><strong>Город обретает объём</strong><small>Загружаем 3D-движок…</small>';canvas.parentNode.append(element);return element;};
 let loading=null,vendorError=null;
 if(!manual&&!injected&&typeof document!=='undefined'){loading=showLoading();try{B=await loadBabylonVendors();}catch(error){vendorError=error;console.error('3D vendor loading:',error);}}
 let supported=false;try{supported=!!B?.Engine.IsSupported;}catch{}
 if(manual||!supported||vendorError){loading?.remove();const r=legacy(canvas,onSelect);if(typeof document!=='undefined'){document.body.dataset.renderer='2d';if(!manual){const note=document.createElement('div');note.className='game3d-fallback';note.textContent=vendorError?'3D не загрузился. Город открыт в 2D с прежним сохранением.':'WebGL недоступен. Город открыт в 2D с прежним сохранением.';canvas.parentNode?.append(note);}const link=document.querySelector('.district-link');if(link){link.href='?view=3d';link.textContent='Открыть 3D ↗';}}return r;}
 loading??=showLoading();loading.innerHTML='<span>НОВЫЙ ВАВИЛОН</span><strong>Город обретает объём</strong><small>Загружаем здания, жителей и долину…</small>';
 let r;
 try{r=new GameRenderer3D(B,canvas,onSelect);await r.initialize(options.initialState);r.interactive=true;loading.remove();document.body.dataset.renderer='3d';return r;}
 catch(error){console.error('Main 3D renderer:',error);r?.dispose();const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);loading.remove();const fallback=legacy(replacement,onSelect);document.body.dataset.renderer='2d';const note=document.createElement('div');note.className='game3d-fallback';note.textContent='3D не загрузился. Город открыт в 2D, сохранение доступно.';replacement.parentNode.append(note);return fallback;}
}

export class GameRenderer3D{
 constructor(B,canvas,onSelect){
  this.B=B;this.canvas=canvas;this.onSelect=onSelect;this.mode='3d';this.quality='high';this.effects=[];this.lightMode='auto';this.pan={x:0,y:0};this._zoom=2.5;this.hover=null;this.selected=null;this.ambient=0;this.mapOverview=false;this.state=null;this.lastTime=null;this.lastSim=null;this.layersReady=false;this.lamps=new Map();this.effectViews=[];
  this.engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});
  this.engine.setHardwareScalingLevel(1/Math.min(globalThis.devicePixelRatio||1,1.5));
  this.scene=new B.Scene(this.engine);this.scene.skipPointerMovePicking=true;this.scene.clearColor=B.Color4.FromHexString('#d0c8aeff');this.scene.fogMode=B.Scene.FOGMODE_EXP2;this.scene.fogDensity=.0018;
  const ip=this.scene.imageProcessingConfiguration;ip.toneMappingEnabled=true;ip.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;ip.exposure=1.1;ip.contrast=1.1;
  // Keep shared image processing fixed: changing exposure broadcasts PBR
  // dirtiness across the whole city. Sun, sky, fog and windows carry twilight.
  // .26 is the midpoint of the old .17–.35 environment range.
  this.scene.environmentIntensity=.26;
  this.camera=new B.ArcRotateCamera('city-camera',Math.PI/3,.96,62,new B.Vector3(53,0,55),this.scene);this.camera.attachControl(canvas,true);this.camera.inputs.removeByType('ArcRotateCameraPointersInput');this.camera.minZ=.1;this.camera.maxZ=900;this.camera.lowerRadiusLimit=8;this.camera.upperRadiusLimit=360;this.camera.lowerBetaLimit=.18;this.camera.upperBetaLimit=1.48;this.camera.wheelDeltaPercentage=.025;this.camera.panningSensibility=70;this.camera.inertia=0;
  this.sun=new B.DirectionalLight('city-sun',new B.Vector3(-.6,-.85,-.5),this.scene);this.sun.shadowMinZ=.1;this.sun.shadowMaxZ=350;this.sun.shadowFrustumSize=90;
  this.fill=new B.HemisphericLight('city-sky',new B.Vector3(0,1,0),this.scene);this.fill.intensity=.35;
  this.shadow=new B.ShadowGenerator(2048,this.sun);this.shadow.usePercentageCloserFiltering=true;this.shadow.filteringQuality=B.ShadowGenerator.QUALITY_MEDIUM;this.shadow.bias=.0004;this.shadow.normalBias=.025;
  // Environment and photographic textures are optional detail, never a first-frame barrier.
  this.materials=createDistrictMaterials(B,this.scene,{deferPhotos:true});this.reach=createBuildingReach(B,this.scene);
  this.reachNote=document.createElement('output');this.reachNote.className='building-reach-note';this.reachNote.hidden=true;canvas.parentNode.append(this.reachNote);
  this.marker=B.MeshBuilder.CreateGround('placement-cell',{width:5.75,height:5.75},this.scene);this.marker.position.y=.10;this.marker.isPickable=false;this.marker.material=new B.StandardMaterial('placement-glow',this.scene);this.marker.material.disableLighting=true;this.marker.material.alpha=.47;this.marker.setEnabled(false);
  this.engine.runRenderLoop(()=>this.scene.render());this.createControls();this.bindInput();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.home();
 }
 async initialize(state){
  if(!state)throw Error('Нет состояния города для карты');
  const {createGameBuildings}=await import('./buildings.js');
  this.state=state;this.buildings=await createGameBuildings(this.B,this.scene,this.materials,{deferAssets:true});
  this.actors=createBootstrapActors(this.B,this.scene);this.landscape=createBootstrapLandscape(this.B,this.scene,state,this.materials);this.relicScene=createRelicScene(this.B,this.scene);this.relicScene.update(state);this.sacredEffects=createSacredEffects(this.B,this.scene);this.sacredEffects.update(state,0,{paused:true});
  this.buildings.sync(state);this.actors.update(state);this.layersReady=true;this.engine.stopRenderLoop();this.resize();if(foundingCameraTarget(state))this.home();
  this.detailNote=document.createElement('output');this.detailNote.className='game3d-detail-status';this.detailNote.setAttribute('role','status');this.detailNote.textContent='Город открыт · подробности загружаются';this.canvas.parentNode.append(this.detailNote);
  this.detailQueue=createBackgroundQueue(2,{onError:error=>{console.warn('Optional 3D detail unavailable:',error);if(!this.disposed)this.detailNote.textContent='Город открыт · часть деталей в лёгком виде';}});
  const replace=(name,value)=>{if(this.disposed){value.dispose();return;}const previous=this[name];try{name==='actors'?value.update(this.state,0,{paused:true,speed:1}):value.update(this.state,this.state.simTime);value.setQuality?.(this.quality);}catch(error){value.dispose();throw error;}this[name]=value;previous.dispose();};
  if(state.buildings.some(b=>b.type==='field'))this.detailQueue.add(()=>this.buildings.loadDetails(),()=>{});
  this.detailQueue.add(async()=>{const {createGameActors}=await import('./actors.js');return createGameActors(this.B,this.scene,this.materials,{deferFauna:true});},value=>replace('actors',value));
  this.detailQueue.add(async()=>{const {createGameLandscape}=await import('./landscape.js');return createGameLandscape(this.B,this.scene,this.state,this.materials,{tier:this.quality,deferOptional:true});},value=>replace('landscape',value));
  // A miracle and its vegetation are loaded on first invocation, not before playing.
  this.miracleGarden=createLazyFeature(()=>createMiracleGarden(this.B,this.scene,{groundHeight:(x,y)=>visualSurfaceElevation(x,y,this.state),canPlant:(x,y)=>x>0&&y>0&&x<WIDTH-1&&y<HEIGHT-1&&vegetationBankDistance(x,y,this.state)>.08&&sceneryClear(this.state,{x,y},.16)}),{required:()=>false,onError:error=>console.warn('Miracle plants unavailable',error)});
  this.detailsReady=this.detailQueue.idle().then(()=>this.actors.faunaReady).then(()=>{if(!this.disposed){this.detailNote.textContent=this.detailQueue.errors.length?'Часть деталей недоступна · игра продолжается':'Подробный город готов';this.detailNote.dataset.complete='true';setTimeout(()=>{if(!this.disposed)this.detailNote.hidden=true;},4000);}});
  setTimeout(()=>{if(this.disposed)return;this.materials.loadPhotos().then(()=>{if(!this.disposed)this.buildings.refreshMaterials?.();});const hdr=new this.B.HDRCubeTexture('assets/art-courtyard/textures/kiara_1_dawn_1k.hdr',this.scene,128,false,true,false,true);hdr.onLoadObservable.addOnce(()=>{if(!this.disposed)this.scene.environmentTexture=hdr;});},250);
 }
 createControls(){
  const panel=document.createElement('div');panel.className='game3d-options';panel.title='Перетаскивание — перемещение карты; средняя кнопка мыши — вращение и наклон; колесо — масштаб';panel.innerHTML='<span>3D · ЖИВОЙ ГОРОД</span><div class="game3d-orbit" role="group" aria-label="Направление и наклон камеры"><button type="button" data-turn="-1" aria-label="Повернуть камеру влево" title="Повернуть камеру влево">↶</button><button type="button" data-turn="1" aria-label="Повернуть камеру вправо" title="Повернуть камеру вправо">↷</button><button type="button" data-tilt="-1" aria-label="Поднять камеру: вид сверху" title="Поднять камеру: вид сверху">↑</button><button type="button" data-tilt="1" aria-label="Опустить камеру: вид к горизонту" title="Опустить камеру: вид к горизонту">↓</button><button type="button" data-camera-home aria-label="Вернуть исходный наклон и вид города" title="Вернуть исходный наклон и вид города">⌂</button></div><select aria-label="Качество 3D"><option value="high">Высокая</option><option value="low">Лёгкая</option></select><a href="?view=2d" title="Открыть прежнюю графику с тем же сохранением">2D</a><a href="assets/art-courtyard/CREDITS.html" target="_blank" rel="noopener" title="Модели и авторы">Авторы ↗</a>';
  this.canvas.parentNode.append(panel);this.controls=panel;for(const b of panel.querySelectorAll('[data-turn]'))b.onclick=()=>this.orbitBy(Number(b.dataset.turn)*Math.PI/4,0);for(const b of panel.querySelectorAll('[data-tilt]'))b.onclick=()=>this.orbitBy(0,Number(b.dataset.tilt)*.18);panel.querySelector('[data-camera-home]').onclick=()=>this.home();panel.querySelector('select').onchange=e=>{const low=e.target.value==='low';this.quality=low?'low':'high';this.scene.shadowsEnabled=!low;this.landscape?.setQuality?.(low?'low':'high');this.engine.setHardwareScalingLevel(1/Math.min(globalThis.devicePixelRatio||1,low?1:1.5));this.resize();};
  const metrics=document.createElement('output');metrics.className='game3d-metrics';metrics.setAttribute('aria-label','Производительность 3D');this.canvas.parentNode.append(metrics);this.metrics=metrics;this.samples=[];this.frameCount=0;this.windowStart=0;
 }
 bindInput(){
  const c=this.canvas;this.inputHandlers=[];const on=(name,fn)=>{c.addEventListener(name,fn);this.inputHandlers.push([name,fn]);};
  this.unbindMap=bindMapControls(c,{camera:this.camera,groundAt:(x,y)=>this.groundPoint(x,y),onHover:(x,y)=>{this.hover=x===null?null:this.pick(x,y);this.keyboardHover=false;},onClick:(x,y)=>{const cell=this.pick(x,y,true);if(cell)this.selectPoint(cell,this.onSelect);},isPhoto:()=>this.photoMode});
  on('keydown',e=>{if(this.photoMode)return;const moves={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};if(moves[e.key]){e.preventDefault();const p=this.hover||{x:9,y:9},d=moves[e.key];this.hover={x:Math.max(0,Math.min(WIDTH-1,p.x+d[0])),y:Math.max(0,Math.min(HEIGHT-1,p.y+d[1]))};this.keyboardHover=true;}if(e.key==='Enter'){e.preventDefault();this.hover||={x:9,y:9};this.selectPoint(this.hover,this.onSelect);}if(this.hover)c.setAttribute('aria-description',`Выбрана клетка ${this.hover.x}, ${this.hover.y}`);});
 }
 groundPoint(clientX,clientY){const r=this.canvas.getBoundingClientRect(),B=this.B,ray=this.scene.createPickingRay(clientX-r.left,clientY-r.top,B.Matrix.Identity(),this.camera),d=ray.intersectsPlane(new B.Plane(0,1,0,0));return d!==null&&d>=0?ray.origin.add(ray.direction.scale(d)):null;}
 pick(clientX,clientY,entity=false){
  if(!this.state)return null;const rect=this.canvas.getBoundingClientRect(),x=clientX-rect.left,y=clientY-rect.top;if(x<0||y<0||x>rect.width||y>rect.height)return null;
  const B=this.B,ray=this.scene.createPickingRay(x,y,B.Matrix.Identity(),this.camera);
  if(entity&&!this.selection&&!this.roadMode){const hit=this.scene.pickWithRay(ray,m=>m.isPickable&&m.isEnabled()&&!!pickedEntity(m));if(hit?.hit){const meta=pickedEntity(hit.pickedMesh);if(meta?.tile)return {...meta.tile};if(meta?.citizenId!==undefined){const c=this.state.citizens.find(v=>v.id===meta.citizenId);if(c)return {...worldCell({x:c.x*6,z:c.y*6}),citizenId:c.id};}if(meta?.animalId)return {...worldCell(hit.pickedPoint),animalId:meta.animalId,animalKind:meta.animalKind};}}
  const d=ray.intersectsPlane(new B.Plane(0,1,0,0));return d!==null&&d>=0?worldCell(ray.origin.add(ray.direction.scale(d))):null;
 }
 setRoadMode(enabled){this.roadMode=!!enabled;if(!enabled)this.roadDrawMode=false;}
 roadNear(point){return roadNear(this.state,point);}
 selectPoint(point,onSelect){if(this.roadDrawMode){this.onRoadGround?.(point);return;}if(!this.interactive)return;if(this.roadMode){const road=this.roadNear(point);if(road)this.onRoadSelect?.(road);}else onSelect(point);}
 get zoom(){return this.camera?104/this.camera.radius:this._zoom;}
 zoomBy(amount){this.mapOverview=false;this.camera.radius=Math.max(8,Math.min(360,this.camera.radius*Math.exp(-amount)));this._zoom=104/this.camera.radius;}
 orbitBy(alpha,beta=0){orbitCamera(this.camera,alpha,beta);}
 set zoom(value){this._zoom=Math.max(.3,Math.min(4,value));if(this.camera){this.mapOverview=false;this.camera.radius=104/this._zoom;}}
 layout(){if(this.camera)this.camera.radius=this.mapOverview?240:104/this._zoom;}
 resize(){if(!this.engine)return;this.engine.resize();const r=this.canvas.getBoundingClientRect();this.w=r.width;this.h=r.height;}
 home(){const founding=foundingCameraTarget(this.state);this.mapOverview=false;this._zoom=founding?104/founding.radius:2.5;this.pan={x:0,y:0};this.camera?.setTarget(new this.B.Vector3(founding?founding.x*6:53,0,founding?founding.y*6:55));if(this.camera){this.camera.alpha=Math.PI/3;this.camera.beta=.96;this.camera.radius=104/this._zoom;}}
 overview(){this.mapOverview=true;this.camera.setTarget(new this.B.Vector3((WIDTH-1)*3,0,(HEIGHT-1)*3));this.camera.beta=.68;this.camera.radius=240;}
 focusOn(x,y){this.mapOverview=false;this.camera.setTarget(new this.B.Vector3(x*6,1,y*6));this.camera.radius=30;this.hover={x,y};}
 captureView(){return {target:this.camera.target.clone(),alpha:this.camera.alpha,beta:this.camera.beta,radius:this.camera.radius};}
 restoreView(v){if(v){this.camera.setTarget(v.target);this.camera.alpha=v.alpha;this.camera.beta=v.beta;this.camera.radius=v.radius;}}
 resetPresentation(){this.miracleGarden?.clear?.();this.sacredEffects?.reset(this.state);this.effects=[];for(const v of this.effectViews){v.mesh.dispose();v.mat.dispose();}this.effectViews=[];this.lastSim=null;this.lastTime=null;}
 addEffect(id,at){this.effects.push({id,born:this.state?.simTime||0,at:at?{...at}:this.hover?{...this.hover}:{x:9,y:9}});}
 updateEffects(state,dt){
  const B=this.B;while(this.effects.length){const effect=this.effects.shift(),m=B.MeshBuilder.CreateTorus(`miracle-${effect.id}`,{diameter:3,thickness:.08,tessellation:48},this.scene),mat=new B.StandardMaterial('divine-light',this.scene);mat.emissiveColor=B.Color3.FromHexString(effect.id==='rain'?'#88c7df':effect.id==='festival'?'#ffc86c':'#f7dc8c');mat.disableLighting=true;mat.alpha=.8;m.material=mat;m.isPickable=false;const p=effect.at||{x:9,y:9};if(effect.id==='fertility')this.miracleGarden?.show(p,2);m.position.set(p.x*6,.35,p.y*6);this.effectViews.push({mesh:m,mat,age:0});}
  for(const v of [...this.effectViews]){v.age+=dt;v.mesh.scaling.setAll(1+v.age*3);v.mat.alpha=Math.max(0,.8-v.age*.3);if(v.age>2.7){v.mesh.dispose();v.mat.dispose();this.effectViews.splice(this.effectViews.indexOf(v),1);}}
 }
 updateLight(state){
  const B=this.B,forced={day:10,sunset:28,night:37.5},clock=lightingAt(this.lightMode==='auto'?state.simTime:forced[this.lightMode]??state.simTime),n=clock.night,warm=clock.warm;
  const weather=weatherAt(state),cloud=weather.type==='rain'?.7:weather.type==='clouds'?.85:1;
  this.sun.direction.set(-.6,-.85+warm*.35,-.5);this.sun.position=this.camera.target.subtract(this.sun.direction.normalizeToNew().scale(140));this.sun.shadowFrustumSize=Math.max(42,Math.min(260,this.camera.radius*1.5));this.sun.intensity=((1-n)*2.9+.32)*cloud;this.sun.diffuse=B.Color3.Lerp(B.Color3.FromHexString('#fff0da').toLinearSpace(),B.Color3.FromHexString('#a3b2d8').toLinearSpace(),n);this.fill.intensity=.4-.17*n;this.fill.diffuse=B.Color3.Lerp(new B.Color3(.9,.9,.85),new B.Color3(.35,.46,.65),n);this.fill.groundColor=new B.Color3(.38,.30,.19);this.scene.fogColor=B.Color3.Lerp(B.Color3.FromHexString('#c7bfa5'),B.Color3.FromHexString('#252f42'),n);this.scene.clearColor=new B.Color4(this.scene.fogColor.r,this.scene.fogColor.g,this.scene.fogColor.b,1);this.landscape.light(n);this.buildings.light?.(n);
  this.houseLights??=createHouseLights(B,this.scene,{lamps:this.lamps});this.houseLights.update(state,n,this.camera.target);
 }
 updateSelection(){
  if(this.photoMode){this.reach.clear();this.reachNote.hidden=true;this.buildings.highlight([]);this.buildings.clearPreview();this.marker.setEnabled(false);for(const m of this.routeMarkers||[])m.setEnabled(false);return;}for(const m of this.routeMarkers||[])m.setEnabled(true);
  const B=this.B,p=previewFor(this.state,this.selection,this.hover,this.placementRotation||0),size=newFootprint(this.selection);this.marker.setEnabled(!!p||!!this.hover&&!!this.roadMode||!!this.keyboardHover&&!!this.hover);if(this.marker.isEnabled()){const at=p||this.hover,n=this.selection?size:1;this.marker.scaling.set(n,1,n);this.marker.position.set((at.x+(n-1)/2)*6,.10,(at.y+(n-1)/2)*6);this.marker.material.emissiveColor=B.Color3.FromHexString(p&&!p.allowed?'#e27857':'#dcdda0');this.marker.material.diffuseColor=this.marker.material.emissiveColor;if(p)this.canvas.title=p.allowed?'Нажми, чтобы заложить строительство':p.reason;}
  if(p)this.buildings.preview({type:this.selection,x:p.x,y:p.y,level:1,rotation:this.placementRotation||0,...(size>1?{footprint:size}:{})},this.state,{allowed:p.allowed});else this.buildings.clearPreview();
  const selected=this.selection&&this.hover?{type:this.selection,...this.hover,...(size>1?{footprint:size}:{})}:this.inspected&&this.state.buildings.find(b=>b.x===this.inspected.x&&b.y===this.inspected.y);
  this.buildings.highlight(this.selection&&selected?nearbySimilar(this.state,selected):[]);this.reachNote.textContent=this.reach.update(this.state,selected);this.reachNote.hidden=!this.reachNote.textContent;
  const ids=this.routeRoads||new Set();const signature=[...ids].join('|')+'|'+(this.selectedRoad||'')+'|'+(this.plannedRoads||[]).map(r=>r.id).join('|');if(signature!==this.routeSignature){for(const m of this.routeMarkers||[])m.dispose();this.routeMarkers=[];for(const r of [...this.state.roads||[],...this.plannedRoads||[]])if(ids.has(r.id)||r.id===this.selectedRoad||this.plannedRoads?.includes(r)){const a=new B.Vector3(r.a.x*6,.12,r.a.y*6),b=new B.Vector3(r.b.x*6,.12,r.b.y*6),line=B.MeshBuilder.CreateLines('road-route',{points:[a,b]},this.scene);line.color=B.Color3.FromHexString('#e9d891');line.isPickable=false;this.routeMarkers.push(line);}this.routeSignature=signature;}
 }
 draw(state,selection,now,options={}){
  if(!this.layersReady)return;const changedState=state!==this.state;const start=performance.now(),dt=this.lastTime===null?0:Math.max(0,Math.min(.25,(now-this.lastTime)/1000)),simDelta=this.lastSim===null?0:state.simTime-this.lastSim;this.lastTime=now;this.lastSim=state.simTime;this.state=state;this.selection=selection;if(changedState&&foundingCameraTarget(state))this.home();
  const paused=options.paused??simDelta<=0;this.buildings.sync(state);this.landscape.update(state,state.simTime,selection);this.actors.update(state,dt,{paused,speed:options.speed??1});this.relicScene?.update(state);this.sacredEffects?.update(state,dt,{paused});this.updateLight(state);this.updateSelection();this.updateEffects(state,state.event?dt:paused?0:dt);this.miracleGarden?.update(dt,{paused});
  this.shadow.getShadowMap().renderList=[...this.buildings.meshes,...this.actors.meshes,...this.landscape.meshes.filter(m=>/palm/.test(m.name))].filter(m=>!m.isDisposed()&&m.isEnabled());this.scene.render();
  this.samples.push(performance.now()-start);this.frameCount++;if(!this.windowStart)this.windowStart=now;if(now-this.windowStart>=2000){this.samples.sort((a,b)=>a-b);this.metrics.textContent=`${Math.round(this.frameCount*1000/(now-this.windowStart))} FPS · CPU p95 ${(this.samples[Math.floor(this.samples.length*.95)]||0).toFixed(1)} мс`;this.metrics.dataset.simTime=state.simTime.toFixed(2);this.metrics.dataset.citizens=state.citizens.length;this.metrics.dataset.buildings=state.buildings.length;this.metrics.dataset.paused=String(paused);this.samples=[];this.frameCount=0;this.windowStart=now;}
 }
 dispose(){this.disposed=true;this.detailQueue?.dispose();this.detailNote?.remove();this.unbindMap?.();this.observer?.disconnect();for(const [name,fn]of this.inputHandlers||[])this.canvas.removeEventListener(name,fn);this.controls?.remove();this.metrics?.remove();this.reachNote?.remove();this.reach?.dispose();this.buildings?.dispose();this.actors?.dispose();this.landscape?.dispose();this.miracleGarden?.dispose();this.relicScene?.dispose();this.sacredEffects?.dispose();this.houseLights?.dispose();this.scene?.dispose();this.engine?.dispose();}
}
