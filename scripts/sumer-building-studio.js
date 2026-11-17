// Isolated test city using the production engine, assets and WebGL renderer.
import {advanceTime, build, buildingAt, canBuild, createGame, encode, decode} from '../engine.js';
import {simulationSeconds} from '../calendar.js';
import {BUILDINGS, MATERIALS, buildingKey, housingOf} from '../definitions.js';
import {footprintCells, footprintSize} from '../footprints.js';
import {strictScenario} from '../scenario-profiles.js';
import {worldHeight, worldWidth, terrain, signedRiverDistance} from '../world.js';
import {syncCitizens} from '../workforce.js';
import {createGameRenderer} from '../game3d/renderer.js';
import {extractionKinds} from '../extraction-courts.js';
import {stockStores} from '../inventory.js';

const state=createGame({start:'established',seed:137,scenario:strictScenario()});
state.population=100;
const models=new Map();
for(const type of Object.keys(BUILDINGS)){
 state.resources.faith=3000;state.resources.prestige=3000;
 const stock=stockStores(state)[0].stock;
 for(const k of MATERIALS){const restock=Math.max(0,500-stock[k]);stock[k]+=restock;state.resources[k]+=restock;}
 const cells=[];
 for(let y=1;y<worldHeight(state)-1;y++)for(let x=1;x<worldWidth(state)-1;x++)cells.push({x,y});
 // Separate neighboring fields and avoid merging the catalog into the starter block.
 cells.sort((a,b)=>type==='canal'
  ?Math.abs(signedRiverDistance(a.x,a.y,state))-Math.abs(signedRiverDistance(b.x,b.y,state))
  :Math.hypot(a.x-29,a.y-19)-Math.hypot(b.x-29,b.y-19));
 const position=cells.find(({x,y})=>!canBuild(state,type,x,y));
 if(!position)throw Error('No legal slot for '+type+': '+[...new Set(cells.map(({x,y})=>canBuild(state,type,x,y)))].join(', '));
 const result=build(state,type,position.x,position.y,0,{instant:true});
 if(!result.ok)throw Error(type+': '+result.reason);
 const building=state.buildings.at(-1);
 if(!footprintCells(building).every(p=>buildingAt(state,p.x,p.y)===building))throw Error('Footprint mismatch: '+type);
 models.set(type,building);
}

const stress=new URLSearchParams(location.search).has('stress');
if(!stress)Object.assign(models.get('field').crop,{sown:1,growth:.98,total:40,remaining:40,seedUsed:4});
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
for(const [id,def] of Object.entries(BUILDINGS))selector.add(new Option(def.name,id));
const renderer=await createGameRenderer(document.querySelector('#city'),()=>{}, {initialState:state});
if(renderer.mode!=='3d')throw Error('WebGL renderer unavailable');
renderer.lightMode='day';
renderer.draw(state,null,performance.now(),{paused:true});
await renderer.detailsReady;
await renderer.buildings.sacredReady();
const meshesFor=(type)=>{
 if(type==='canal')return renderer.scene.meshes.filter(mesh=>mesh.metadata?.canalArms&&mesh.getTotalVertices());
 const b=models.get(type),key=buildingKey(b),cells=footprintCells(b);
 const buildings=renderer.buildings.meshes.filter(mesh=>mesh.metadata?.buildingKey===key&&mesh.isVisible&&mesh.getTotalVertices());
 const resource=extractionKinds[type];
 return resource?buildings.concat(renderer.scene.meshes.filter(mesh=>{
  const site=mesh.metadata?.resourceSite;
  return mesh.isEnabled()&&mesh.name.startsWith('deposit-open-')&&site?.kind===resource&&
   cells.some(cell=>cell.x===site.x&&cell.y===site.y)&&mesh.getTotalVertices();
 })):buildings;
};
const focus=type=>{
 const b=models.get(type),n=footprintSize(b),center=(n-1)*3;
 renderer.camera.setTarget(new renderer.B.Vector3(b.x*6+center,1.1,b.y*6+center));
 renderer.camera.alpha=Math.PI/2-.56;renderer.camera.beta=1.01;renderer.camera.radius=n===1?12:n===2?23:30;
 renderer.camera.inertialAlphaOffset=0;renderer.camera.inertialBetaOffset=0;renderer.camera.inertialRadiusOffset=0;
 selector.value=type;
 renderer.draw(state,null,performance.now(),{paused:true});
 const link=document.querySelector('#download');link.href='assets/3d/sumer-buildings/'+type+'.glb';link.download=type+'.glb';
 status.textContent=BUILDINGS[type].name+' · '+n+'×'+n+(type==='bridge'?' · пролёт по реке':'');
};
selector.onchange=()=>focus(selector.value);
document.querySelector('#overview').onclick=()=>{renderer.overview();renderer.draw(state,null,performance.now(),{paused:true});};
focus('house');
renderer.draw(state,null,performance.now(),{paused:true});
window.sumerStudio={renderer,state,models,focus,meshesFor,encode,decode,
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
