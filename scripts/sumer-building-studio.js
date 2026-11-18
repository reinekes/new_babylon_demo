// Isolated test city using the production engine, assets and WebGL renderer.
import {advanceTime, build, buildingAt, canBuild, createGame, encode, decode} from '../engine.js';
import {simulationSeconds} from '../calendar.js';
import {BUILDINGS, MATERIALS, buildingKey, housingOf} from '../definitions.js';
import {footprintCells, footprintSize} from '../footprints.js';
import {legacyScenario,strictScenario} from '../scenario-profiles.js';
import {worldHeight, worldWidth, terrain, signedRiverDistance} from '../world.js';
import {syncCitizens} from '../workforce.js';
import {createGameRenderer} from '../game3d/renderer.js';
import {extractionKinds} from '../extraction-courts.js';
import {referenceYardFrame} from '../game3d/reference-yards.js';
import {isReferenceWorkshop,workshopAngle} from '../game3d/reference-workshops.js';
import {workstationBuilding} from '../game3d/workstations.js';
import {fieldCropKind} from '../game3d/crop-varieties.js';
import {stockStores} from '../inventory.js';

const query=new URLSearchParams(location.search);
const requested=query.get('model')||'house';
const craftDownloads=new Set(['pottery','brickyard','kiln','bakery','brewery']);
const homeVariants={'house-2':'Дом II','house-3':'Дом III',starterHut:'Дом основателей',reedCamp:'Тростниковый шалаш'};
const titles={...Object.fromEntries(Object.entries(BUILDINGS).map(([id,def])=>[id,def.name])),...homeVariants,road:'Дорога'};
const legacyFounder=requested==='starterHut';
const state=createGame({start:'established',seed:137,scenario:legacyFounder?legacyScenario():strictScenario()});
state.population=100;
const models=new Map();
// The founding hut belongs to the legacy city. Strict-only workshops and
// fortifications load on their own scenario through the selector.
for(const type of legacyFounder?['house']:Object.keys(BUILDINGS)){
 state.resources.faith=3000;state.resources.prestige=3000;
 const stock=stockStores(state)[0].stock;
 for(const k of MATERIALS){const restock=Math.max(0,500-stock[k]);stock[k]+=restock;state.resources[k]+=restock;}
 const cells=[];
 for(let y=1;y<worldHeight(state)-1;y++)for(let x=1;x<worldWidth(state)-1;x++)cells.push({x,y});
 // Separate neighboring fields and avoid merging the catalog into the starter block.
 cells.sort((a,b)=>type==='canal'
  ?Math.abs(signedRiverDistance(a.x,a.y,state))-Math.abs(signedRiverDistance(b.x,b.y,state))
  :Math.hypot(a.x-29,a.y-19)-Math.hypot(b.x-29,b.y-19));
 const position=cells.find(({x,y})=>(type!=='field'||fieldCropKind({x,y})==='barley')&&!canBuild(state,type,x,y));
 if(!position)throw Error('No legal slot for '+type+': '+[...new Set(cells.map(({x,y})=>canBuild(state,type,x,y)))].join(', '));
 const result=build(state,type,position.x,position.y,0,{instant:true});
 if(!result.ok)throw Error(type+': '+result.reason);
 const building=state.buildings.at(-1);
 if(!footprintCells(building).every(p=>buildingAt(state,p.x,p.y)===building))throw Error('Footprint mismatch: '+type);
 models.set(type,building);
}

const stress=query.has('stress');
const home=models.get('house');
for(const variant of Object.keys(homeVariants))models.set(variant,home);
if(!stress){
 const path=state.roads?.find(r=>!r.construction);
 if(path){path.built=true;models.set('road',path);}
}
if(!stress&&models.has('ziggurat'))models.get('ziggurat').level=3;
if(!stress&&models.has('field'))Object.assign(models.get('field').crop,{sown:1,growth:.98,total:40,remaining:40,seedUsed:4});
if(stress){
 for(let y=2;y<worldHeight(state)-2&&state.buildings.length<250;y+=2)
  for(let x=2;x<worldWidth(state)-2&&state.buildings.length<250;x+=2)
   if(terrain(x,y,state)!=='water'&&!buildingAt(state,x,y))state.buildings.push({type:'house',x,y,level:1});
 state.population=500;
}
state.capacity=housingOf(state);
if(!stress)state.population=Math.min(state.population,state.capacity);
syncCitizens(state);
state.dayTime=.54;
const selector=document.querySelector('#building'),status=document.querySelector('#status');
for(const [id,title] of Object.entries(titles))if(legacyFounder||models.has(id))selector.add(new Option(title,id));
const renderer=await createGameRenderer(document.querySelector('#city'),()=>{}, {initialState:state});
if(renderer.mode!=='3d')throw Error('WebGL renderer unavailable');
renderer.lightMode='day';
renderer.draw(state,null,performance.now(),{paused:true});
await renderer.detailsReady;
await renderer.buildings.sacredReady();
const meshesFor=(type)=>{
 if(type==='road'){
  const road=models.get('road');
  return renderer.scene.meshes.filter(m=>m.metadata?.road?.a&&m.name.startsWith('road-')&&m.metadata.road.a.x===road.a.x&&m.metadata.road.a.y===road.a.y&&m.metadata.road.b.x===road.b.x&&m.metadata.road.b.y===road.b.y);
 }
 if(type==='canal')return renderer.scene.meshes.filter(mesh=>mesh.metadata?.canalArms&&mesh.getTotalVertices());
 const b=models.get(type),key=buildingKey(b),cells=footprintCells(b);
 const buildings=renderer.buildings.meshes.filter(mesh=>mesh.metadata?.buildingKey===key&&mesh.isVisible&&mesh.getTotalVertices());
 const resource=extractionKinds[type];
 if(!resource)return buildings;
 const palms=type==='garden'?cells.flatMap(({x,y})=>[
  `date-palm-resource-dates-${x}-${y}-`,`date-palm-garden-${x}-${y}-`
 ]):[];
 return buildings.concat(renderer.scene.meshes.filter(mesh=>{
  // The landscape batches these same palm instances in the city. The exported
  // single orchard needs the individual frond and trunk matrices within its site.
  if(palms.some(prefix=>mesh.name.startsWith(prefix))&&mesh.sourceMesh)return true;
  const site=mesh.metadata?.resourceSite;
  return mesh.isEnabled()&&mesh.name.startsWith('deposit-open-')&&site?.kind===resource&&
   cells.some(cell=>cell.x===site.x&&cell.y===site.y)&&mesh.getTotalVertices();
 }));
};
function cameraAngle(type){
 const b=models.get(type);
 if(type==='cityGate')return .27;
 if(isReferenceWorkshop(type))return 1.05-workshopAngle(workstationBuilding(b,state).workCorner);
 return 1.05-referenceYardFrame(b,state).angle;
}
const focus=type=>{
 if((type==='starterHut')!==(state.scenario.history==='legacy-v1')){
  const url=new URL(location.href);url.searchParams.set('model',type);location.assign(url);return;
 }
 if(type==='house'||type in homeVariants){
  home.level=type==='house-2'?2:type==='house-3'?3:1;
  if(type==='starterHut')home.starterHut=true;else delete home.starterHut;
  if(type==='reedCamp')home.reedCamp=true;else delete home.reedCamp;
  state.capacity=housingOf(state);
 }
 const b=models.get(type),n=footprintSize(b),center=(n-1)*3;
 renderer.camera.setTarget(new renderer.B.Vector3(b.x*6+center,1.1,b.y*6+center));
 renderer.camera.alpha=cameraAngle(type);renderer.camera.beta=1.01;renderer.camera.radius=n===1?12:n===2?23:30;
 renderer.camera.inertialAlphaOffset=0;renderer.camera.inertialBetaOffset=0;renderer.camera.inertialRadiusOffset=0;
 selector.value=type;
 renderer.draw(state,null,performance.now(),{paused:true});
 renderer.buildings.sacredReady().then(()=>{if(selector.value===type)renderer.draw(state,null,performance.now(),{paused:true});});
 const link=document.querySelector('#download');
 link.download=type+'.glb';
 link.href='assets/3d/sumer-buildings/'+link.download+(craftDownloads.has(type)?'?v=alluvial-craft-20261118':'');
 status.textContent=titles[type]+' · '+n+'×'+n+(type==='bridge'?' · пролёт по реке':'');
};
selector.onchange=()=>focus(selector.value);
document.querySelector('#overview').onclick=()=>{renderer.overview();renderer.draw(state,null,performance.now(),{paused:true});};
focus(models.has(requested)?requested:'house');
renderer.draw(state,null,performance.now(),{paused:true});
window.sumerStudio={renderer,state,models,focus,cameraAngle,meshesFor,encode,decode,
 async benchmark(seconds=12){
  renderer.overview();const intervals=[],cpu=[];
  let start,last;
  await new Promise(resolve=>{
   const frame=now=>{
    if(start===undefined){start=last=now;requestAnimationFrame(frame);return;}
    const dt=now-last;last=now;intervals.push(dt);
    const cpuStart=performance.now();advanceTime(state,simulationSeconds(dt/1000,4));cpu.push(performance.now()-cpuStart);
    renderer.draw(state,null,now,{paused:false,speed:4});
    if(now-start>=seconds*1000)resolve();else requestAnimationFrame(frame);
   };requestAnimationFrame(frame);
  });
  const total=intervals.reduce((sum,value)=>sum+value,0);cpu.sort((a,b)=>a-b);
  const gl=renderer.engine._gl,debug=gl?.getExtension('WEBGL_debug_renderer_info');
  return {fps:intervals.length*1000/total,frames:intervals.length,seconds:total/1000,population:state.population,
   buildings:state.buildings.length,simulationP95:cpu[Math.floor(cpu.length*.95)],
   gpu:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'',errors:renderer.detailQueue.errors.map(String)};
 },
};
