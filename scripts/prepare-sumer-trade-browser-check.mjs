// Run from a checkout, then serve the output on an isolated test-only origin.
// node scripts/prepare-sumer-trade-browser-check.mjs [output-directory]
import {execFileSync} from 'node:child_process';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url)),output=resolve(process.argv[2]||'/tmp/babylon-sumer-trade-check');
execFileSync(process.execPath,[join(source,'scripts/prepare-season-browser-check.mjs'),source,output],{stdio:'inherit'});
const tag='sumer-trade-supplied-20261105-17';
const fixture=`import {createGame,advanceTime,canBuild,miracle,resolveEvent,encode,decode,terrain} from './repo/engine.js';
import {strictScenario,legacyScenario} from './repo/scenario-profiles.js';
import {initializeEcology,POPULATION_LIMIT} from './repo/ecology.js';
import {housingOf,capacityOf,buildingKey} from './repo/definitions.js';
import {stockStores,takeStock,syncInventory} from './repo/inventory.js';
import {waterSummary,initializeWater} from './repo/water.js';
import {syncCitizens} from './repo/workforce.js';
import {isRiverBank} from './repo/river-trade.js';
import {marketAccess,trade} from './repo/trading.js';
export function serviceTrade(s,proof){
 if(s.event){proof.skippedEvents.push(s.event.id);resolveEvent(s,'skip');}
 const rite=s.funeral?'funeral':s.miracleCelebration?.kind||(s.festival?.stage==='celebrating'?'festival':null);if(rite&&!proof.ceremonies.includes(rite))proof.ceremonies.push(rite);
 const c=s.trade.caravan;if(!c)return;
 const transport=c.transport||'land',phase=c.id+':'+c.phase;
 if(proof.phases.at(-1)?.phase!==phase)proof.phases.push({phase,transport,time:s.simTime,x:c.x,y:c.y});
 if(c.phase==='trading'&&!proof.orders.some(q=>q.visit===c.id)){
  const buy=trade(s,'stone','buy',2),sell=trade(s,'wood','sell',2);proof.orders.push({visit:c.id,transport,buy:buy.ok,sell:sell.ok,time:s.simTime});
 }
}
export function createTradeFixture(transport='land',history='strict',ecologyMode='legacy'){
 if(!['land','river'].includes(transport))throw Error('Invalid transport');
 if(!['strict','legacy'].includes(history))throw Error('Invalid history');
 if(!['legacy','modern','modern-grown'].includes(ecologyMode))throw Error('Invalid ecology');
 const s=createGame({start:'established',mode:'mature',seed:137,scenario:history==='strict'?strictScenario():legacyScenario()});
 if(ecologyMode!=='legacy'){delete s.ecology;initializeEcology(s);if(ecologyMode==='modern-grown')for(const p of Object.values(s.ecology.populations))p.count=POPULATION_LIMIT;}
 const tradingBuilding=transport==='river'?'granary':'market';
 if(canBuild(s,tradingBuilding,10,9,true))throw Error('Trading district site changed');s.buildings.push({type:tradingBuilding,x:10,y:9,level:1});
 const banks=[];for(let y=1;y<63;y++)for(let x=1;x<63;x++)if(isRiverBank(s,x,y)&&!s.buildings.some(b=>b.x===x&&b.y===y))banks.push({x,y,d:Math.hypot(x-9,y-8)});banks.sort((a,b)=>a.d-b.d||a.y-b.y||a.x-b.x);
 const harbor=banks.find(p=>!canBuild(s,'harbor',p.x,p.y,true));if(!harbor)throw Error('No legal harbor');s.buildings.push({type:'harbor',x:harbor.x,y:harbor.y,level:1});
 for(let y=2;y<62&&s.buildings.length<129;y+=5)for(let x=2;x<62&&s.buildings.length<129;x+=5)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:s.buildings.length%3?'house':terrain(x,y,s)==='fertile'?'field':'clay',x,y,level:1});
 const houses=s.buildings.filter(b=>b.type==='house'),initialFood=2000+houses.reduce((n,b)=>n+capacityOf(b)*10,0);
 s.population=200;s.capacity=housingOf(s);syncCitizens(s);s.resources.food=initialFood;syncInventory(s);initializeWater(s);
 // A supplied benchmark, not a disconnected starvation/funeral benchmark.
 // Transfer initial food from the real central stock, preserving its accounting.
 const store=buildingKey(stockStores(s)[0]);let pantryFood=0;
 for(const b of houses){const amount=takeStock(s,store,'food',capacityOf(b)*10);b.pantry=(b.pantry||0)+amount;b.pantryDelivered=(b.pantryDelivered||0)+amount;pantryFood+=amount;b.water=waterSummary(s,b).capacity;b.waterDelivered=Math.max(b.waterDelivered||0,b.water);}
 if(!marketAccess(s,null,'harbor')||transport==='land'&&!marketAccess(s,null,'market'))throw Error('Disconnected trade port');
 if(!miracle(s,'cat').ok)throw Error('Cannot prepare the existing warehouse cat');advanceTime(s,s.miracleCelebration.duration);
 const proof={transport,history,ecologyMode,ecologyCounts:Object.fromEntries(Object.entries(s.ecology.populations).map(([kind,p])=>[kind,p.count])),ecologyLegacy:s.ecology?.legacyFauna===true,portSetup:transport==='river'?'harbor-without-land-market':'market-and-harbor',initialPopulation:200,buildings:129,seed:137,supply:{initialFood,pantryFood,centralFood:s.resources.food,waterFilledToCapacity:true},harbor:{x:harbor.x,y:harbor.y},phases:[],orders:[],skippedEvents:[],ceremonies:[]},target=35;
 while(s.simTime<target-1e-7){advanceTime(s,Math.min(.25,target-s.simTime));serviceTrade(s,proof);}
 if(!decode(encode(s))||s.buildings.length!==129||s.population<200)throw Error('Invalid warmed trade fixture');
 proof.measurementStart={population:s.population,buildings:s.buildings.length,simTime:s.simTime,tick:s.tick};return {state:s,proof};
}
export function auditTradeFixture(state,proof){
 const s=decode(encode(state)),p=structuredClone(proof),target=s.simTime+80;
 for(let i=0;i<400&&s.simTime<target-1e-7;i++){advanceTime(s,Math.min(.25,target-s.simTime));serviceTrade(s,p);}
 if(s.simTime<target-1e-6||s.population<200||p.ceremonies.length||!decode(encode(s)))throw Error('Supplied fixture must retain 200+ citizens without calendar-stopping ceremonies');
 if(!p.orders.some(q=>q.transport===p.transport&&q.buy&&q.sell)||s.trade.deliveries.some(q=>q.delivered!==q.amount)||s.trade.sales.some(q=>q.loaded!==q.amount))throw Error('Real trade was not completed');
 return {population:s.population,simTime:s.simTime,orders:p.orders,ceremonies:p.ceremonies};
}
`;
await writeFile(join(output,'trade-fixture.mjs'),fixture);
const helper=await import(pathToFileURL(join(output,'trade-fixture.mjs')).href+'?verify='+Date.now());
for(const ecologyMode of ['legacy','modern','modern-grown'])for(const transport of ['land','river']){const {state,proof}=helper.createTradeFixture(transport,'strict',ecologyMode);console.log(JSON.stringify({transport,ecologyMode,valid:true,start:proof.measurementStart,harbor:proof.harbor,audit:helper.auditTradeFixture(state,proof)}));}
// A private A/B probe: Babylon retains its own exact frustum decision.
const candidateSource=await readFile(join(source,'game3d/renderable-mesh-candidates.js'),'utf8'),preciseCheck='mesh.computeWorldMatrix?.();matrixReady=true;if(!mesh.isInFrustum(scene.frustumPlanes))continue;';
if(!candidateSource.includes(preciseCheck))throw Error('Review candidate probe after source changes');
await writeFile(join(output,'coarse-candidates.mjs'),candidateSource.replace(preciseCheck,''));
let app=await readFile(join(output,'app-check.js'),'utf8');
app=`import {serviceTrade} from './trade-fixture.mjs?probe=${tag}';\nimport {weatherAt as probeWeatherAt} from './repo/environment.js';\nimport {createRenderableMeshCandidates as coarseCandidates} from './coarse-candidates.mjs?probe=${tag}';\n`+app;
app=app.replace('await renderer.detailQueue?.idle();','await renderer.detailQueue?.idle();renderer.engine.setHardwareScalingLevel(1/1.5);renderer.resize();setProbeRoadBatching(new URLSearchParams(location.search).get(\"roadBatch\")!==\"off\");setProbePalmBatching(new URLSearchParams(location.search).get(\"palmBatch\")!==\"off\");if(new URLSearchParams(location.search).get("frustum")==="coarse")renderer.scene.getActiveMeshCandidates=coarseCandidates(renderer.scene);');
app=app.replace('quality:renderer.quality,','quality:renderer.quality,probeRenderPixelRatio:1.5,hardwareScalingLevel:renderer.engine.getHardwareScalingLevel(),');
app=app.replace('cameraRadius:renderer.camera?.radius,','cameraAlpha:renderer.camera?.alpha,cameraBeta:renderer.camera?.beta,cameraRadius:renderer.camera?.radius,');
app=app.replace('meshes:renderer.scene?.meshes.length,','activeMeshes:renderer.scene?.getActiveMeshes?.().length,meshes:renderer.scene?.meshes.length,');
app=app.replace("[renderer.scene,'render','scene.render']","[renderer.scene,'render','scene.render'],[renderer.scene,'getActiveMeshCandidates','scene.candidates'],[renderer.scene,'_evaluateActiveMeshes','scene.activeMeshes'],[renderer.scene,'animate','scene.animate'],[renderer.scene,'_renderForCamera','scene.camera']");
app=app.replace('export const timings=[];', 'export const timings=[];export const timingTotals={};export function resetTimingTotals(){for(const key of Object.keys(timingTotals))delete timingTotals[key];timings.length=0;}');
app=app.replace('if(ms>35)timings.push', 'const total=timingTotals[tag]??={count:0,ms:0,max:0};total.count++;total.ms+=ms;total.max=Math.max(total.max,ms);if(ms>35)timings.push');

app=app.replace("function advanceTime(...args){return timed('simulation',()=>rawAdvanceTime(...args));}","function advanceTime(...args){const result=timed('simulation',()=>rawAdvanceTime(...args));if(tradeProof)serviceTrade(args[0],tradeProof);return result;}");
app+=`\nlet palmProbeBatching=true;export function setProbePalmBatching(enabled){palmProbeBatching=enabled!==false;renderer.landscape?.setPalmBatching?.(palmProbeBatching);}export function palmBatchingMode(){return palmProbeBatching;}\nlet roadProbeBatching=true;export function setProbeRoadBatching(enabled){roadProbeBatching=enabled!==false;renderer.landscape?.setRoadBatching?.(roadProbeBatching);}export function roadBatchingMode(){return roadProbeBatching;}\nlet tradeProof=null;export function attachTradeProof(p){tradeProof=p;}\nexport function tradeStateInfo(){return {population:state.population,buildings:state.buildings.length,simTime:state.simTime,tick:state.tick,proof:tradeProof,deliveries:state.trade.deliveries.map(q=>({id:q.id,resource:q.resource,amount:q.amount,delivered:q.delivered})),sales:state.trade.sales.map(q=>({id:q.id,resource:q.resource,amount:q.amount,loaded:q.loaded,cancelled:q.cancelled}))};}\n`;
app+=`
export function sceneInventory(){
 const scene=renderer.scene;if(!scene)return null;const groupOf=new Map();
 for(const [kind,layer]of [['architecture',renderer.buildings],['actors',renderer.actors],['landscape',renderer.landscape]])for(const mesh of layer?.meshes||[])groupOf.set(mesh,kind);
 const live=scene.getActiveMeshes(),active=new Set(live.data.slice(0,live.length)),groups={},names=new Map();
 for(const mesh of scene.meshes){
  let kind=groupOf.get(mesh)||'other';if(kind==='actors')for(let node=mesh;node;node=node.parent){if(node.metadata?.citizenId!==undefined){kind='residents';break;}if(node.metadata?.animalKind||node.metadata?.animalId){kind='fauna';break;}}
  const row=groups[kind]??={all:0,enabled:0,visible:0,active:0,activeVertices:0,activeSubMeshes:0,activeThinInstances:0,materials:new Set()};row.all++;
  const enabled=mesh.isEnabled();if(enabled)row.enabled++;if(enabled&&mesh.isVisible&&mesh.visibility>0)row.visible++;
  if(active.has(mesh)){row.active++;row.activeThinInstances+=mesh.thinInstanceCount||0;row.activeVertices+=mesh.getTotalVertices?.()||0;row.activeSubMeshes+=mesh.subMeshes?.length||0;if(mesh.material)row.materials.add(mesh.material);const name=(mesh.sourceMesh?.name||mesh.name).replace(/[0-9]+/g,'#');names.set(name,(names.get(name)||0)+1);}
 }
 return {groups:Object.fromEntries(Object.entries(groups).map(([kind,row])=>[kind,{...row,materials:row.materials.size}])),topActiveSources:[...names].sort((a,b)=>b[1]-a[1]).slice(0,30),engineDrawCallsCounterCurrent:renderer.engine?._drawCalls?.current??null};
}
`;
app=app.replace('quality:renderer.quality,','quality:renderer.quality,palms:palmStateInfo(),inventory:sceneInventory(),');
app+=`\nexport function palmStateInfo(){const parts=(renderer.landscape?.meshes||[]).filter(m=>m.sourceMesh&&m.name.startsWith('date-palm-')),batches=(renderer.landscape?.meshes||[]).filter(m=>m.metadata?.palmBatch);return {parts:parts.length,enabledIndividuals:parts.filter(m=>m.isEnabled()).length,groups:batches.length,instances:batches.reduce((n,m)=>n+m.thinInstanceCount,0),uniqueGroupedParts:new Set(batches.flatMap(m=>m.metadata.palmBatch.parts)).size,weather:probeWeatherAt(state).type};}\n`;
await writeFile(join(output,'app-check.js'),app);
let check=await readFile(join(output,'check.js'),'utf8');const start=check.indexOf('const s=createGame('),end=check.indexOf("localStorage.setItem(");
if(start<0||end<start)throw Error('Generic fixture changed');
check=`import {createTradeFixture} from './trade-fixture.mjs?probe=${tag}';\n`+check.slice(0,start)+`const transport=new URLSearchParams(location.search).get('transport')||'land';const history=new URLSearchParams(location.search).get('history')||'strict';const ecologyMode=new URLSearchParams(location.search).get('ecology')||'legacy';const {state:s,proof}=createTradeFixture(transport,history,ecologyMode);\n`+check.slice(end);
check=check.replace('await app.profileLayers();','await app.profileLayers();app.attachTradeProof(proof);');
check=check.replace("fixture:'seed137-200-residents-129-buildings-start35'","fixture:'sumer-supplied-real-trade-200-initial-129-v4',transport,history,trade:app.tradeStateInfo()");
check=check.replace("out.textContent='Готово: 200 жителей / 129 зданий; интерфейс и автосохранение включены'","out.textContent='Готово: '+transport+' · 200 исходных жителей / 129 зданий; интерфейс, торговля и автосохранение включены'");
check=check.replace('let last=start,active=true;', 'let last=start,active=true;const startViewport=[innerWidth,innerHeight];let visibilityChanges=0;const visibility=()=>visibilityChanges++;document.addEventListener("visibilitychange",visibility);');
check=check.replace('active=false;observer?.disconnect();','active=false;observer?.disconnect();document.removeEventListener("visibilitychange",visibility);');
check=check.replace('transport,history,trade:app.tradeStateInfo()', `transport,history,trade:app.tradeStateInfo(),startViewport,visibilityChanges,viewportChanged:startViewport[0]!==innerWidth||startViewport[1]!==innerHeight,selectedSpeed:document.querySelector('[data-speed][aria-pressed="true"]')?.dataset.speed`);
check=check.replace('sceneStart=app.sceneInfo();','sceneStart=(app.resetTimingTotals(),app.sceneInfo());');
check=check.replace('stages:app.timings,','stages:app.timings,timingTotals:app.timingTotals,terrainCutCaching:!location.pathname.endsWith("/perf-uncached.html"),frustumProbe:new URLSearchParams(location.search).get("frustum")||"precise",roadBatching:app.roadBatchingMode(),palmBatching:app.palmBatchingMode(),');
check+=`\nconst roadToggle=document.createElement('button'),roadProof=document.createElement('pre');roadToggle.textContent='Переключить группировку дорог';roadToggle.id='toggle-road-groups';roadProof.id='road-group-proof';roadToggle.onclick=()=>{if(document.querySelector('#measurement').textContent.startsWith('Замер'))return;app.setProbeRoadBatching(!app.roadBatchingMode());requestAnimationFrame(()=>requestAnimationFrame(()=>{roadProof.textContent=JSON.stringify({batching:app.roadBatchingMode(),scene:app.sceneInfo()},null,2);}));};const controls=document.querySelector('#measure').parentElement;controls.insertBefore(roadToggle,document.querySelector('#measurement'));controls.append(roadProof);roadProof.style.maxHeight='30px';roadProof.style.overflow='auto';const fold=document.createElement('button');fold.textContent='Свернуть результаты';fold.onclick=()=>{out.hidden=!out.hidden;roadProof.hidden=out.hidden;fold.textContent=out.hidden?'Показать результаты':'Свернуть результаты';};controls.insertBefore(fold,out);\n`;
check+=`\nconst palmToggle=document.createElement('button');palmToggle.textContent='Переключить группировку пальм';palmToggle.id='toggle-palm-groups';palmToggle.onclick=()=>{if(out.textContent.startsWith('Замер'))return;app.setProbePalmBatching(!app.palmBatchingMode());requestAnimationFrame(()=>requestAnimationFrame(()=>{roadProof.hidden=false;roadProof.textContent=JSON.stringify({palmBatching:app.palmBatchingMode(),scene:app.sceneInfo()},null,2);}));};controls.insertBefore(palmToggle,out);\n`;
await writeFile(join(output,'check.js'),check);
check=check.replace(/app-check.js\?probe=[^'"\s]+/g,'app-check.js?probe='+tag);await writeFile(join(output,'check.js'),check);
const html=(await readFile(join(output,'perf.html'),'utf8')).replace(/check.js\?probe=[^'"\s]+/g,'check.js?probe='+tag);await writeFile(join(output,'perf.html'),html);
// Private matched baseline: keep all production behavior except terrain-cut reuse.
const cutCacheCheck='if(previous?.key===cutKey&&previous.colors===original.colors)continue;',landscapeSource=await readFile(join(source,'game3d/landscape.js'),'utf8');
if(!landscapeSource.includes(cutCacheCheck))throw Error('Review terrain-cut baseline after source changes');
const baselineLandscape=landscapeSource.replace(cutCacheCheck,'if(false)continue;').replace(/from ['"]\.\/([^'"]+)['"]/g,"from './repo/game3d/$1'").replace(/from ['"]\.\.\/([^'"]+)['"]/g,"from './repo/$1'");
await writeFile(join(output,'landscape-uncached.mjs'),baselineLandscape);
const baselineHtml=html.replace(/("\.\/game3d\/landscape\.js":)"[^"]+"/,`$1"../landscape-uncached.mjs?probe=${tag}"`);
if(baselineHtml===html)throw Error('Missing landscape import-map entry for baseline');
await writeFile(join(output,'perf-uncached.html'),baselineHtml);
console.log(JSON.stringify({output,page:'perf.html?transport=land or river',seconds:80,tag,warning:'Isolated origin only; measure close and overview separately, no heavy tests during measurements'}));
