// Run from a checkout, then serve the output on an isolated test-only origin.
// node scripts/prepare-sumer-trade-browser-check.mjs [output-directory]
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=fileURLToPath(new URL('../',import.meta.url)),output=resolve(process.argv[2]||'/tmp/babylon-sumer-trade-check');
execFileSync(process.execPath,[join(source,'scripts/prepare-season-browser-check.mjs'),source,output],{stdio:'inherit'});
const tag='sumer-trade-supplied-20261105-27';
const fixture=`import {createGame,advanceTime,canBuild,miracle,resolveEvent,encode,decode,terrain} from './repo/engine.js';
import {strictScenario,legacyScenario} from './repo/scenario-profiles.js';
import {initializeEcology,POPULATION_LIMIT} from './repo/ecology.js';
import {housingOf,capacityOf,buildingKey} from './repo/definitions.js';
import {stockStores,takeStock,syncInventory} from './repo/inventory.js';
import {waterSummary,initializeWater} from './repo/water.js';
import {syncCitizens} from './repo/workforce.js';
import {isRiverBank} from './repo/river-trade.js';
import {marketAccess,trade} from './repo/trading.js';
import {upgradeRoad} from './repo/roads.js';
import {setCitizenRole} from './repo/management.js';
export function serviceTrade(s,proof){
 if(proof.roadWork){const r=s.roads.find(r=>r.id===proof.roadWork.id),p=proof.roadWork;p.maxWork=Math.max(p.maxWork||0,r?.construction?.work||0);p.delivered={...r?.construction?.delivered||p.delivered};if(!r?.construction&&r?.level>p.fromLevel)p.completedAt??=s.simTime;}
 if(s.event){proof.skippedEvents.push(s.event.id);resolveEvent(s,'skip');}
 const rite=s.funeral?'funeral':s.miracleCelebration?.kind||(s.festival?.stage==='celebrating'?'festival':null);if(rite&&!proof.ceremonies.includes(rite))proof.ceremonies.push(rite);
 const c=s.trade.caravan;if(!c)return;
 const transport=c.transport||'land',phase=c.id+':'+c.phase;
 if(proof.phases.at(-1)?.phase!==phase)proof.phases.push({phase,transport,time:s.simTime,x:c.x,y:c.y});
 if(c.phase==='trading'&&!proof.orders.some(q=>q.visit===c.id)){
  const buy=trade(s,'stone','buy',2),sell=trade(s,'wood','sell',2);proof.orders.push({visit:c.id,transport,buy:buy.ok,sell:sell.ok,time:s.simTime});
 }
}
export function createTradeFixture(transport='land',history='strict',ecologyMode='legacy',roadWork=false){
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
 if(roadWork){const r=s.roads.filter(r=>r.level===1&&!r.construction).sort((a,b)=>Math.hypot((a.a.x+a.b.x)/2-9.5,(a.a.y+a.b.y)/2-8.5)-Math.hypot((b.a.x+b.b.x)/2-9.5,(b.a.y+b.b.y)/2-8.5))[0];if(!r||!upgradeRoad(s,r).ok)throw Error('Cannot order real road work');proof.roadWork={id:r.id,fromLevel:r.level,startedAt:s.simTime,a:r.a,b:r.b,cost:{...r.construction.required},maxWork:0};const candidates=s.citizens.filter(c=>c.age>=16&&!c.work&&!c.workplace&&!c.guardPost&&!c.manualGathering).sort((a,b)=>Math.hypot(a.x-r.x,a.y-r.y)-Math.hypot(b.x-r.x,b.y-r.y));proof.roadWork.workers=candidates.slice(0,4).map((c,i)=>{const role=i<2?'carrier':'builder';if(!setCitizenRole(s,c.id,role).ok)throw Error('Cannot assign nearby road worker');return {id:c.id,home:c.home,role,x:c.x,y:c.y};});}
 proof.measurementStart={population:s.population,buildings:s.buildings.length,simTime:s.simTime,tick:s.tick};return {state:s,proof};
}
export function auditTradeFixture(state,proof){
 const s=decode(encode(state)),p=structuredClone(proof),target=s.simTime+80;
 for(let i=0;i<400&&s.simTime<target-1e-7;i++){advanceTime(s,Math.min(.25,target-s.simTime));serviceTrade(s,p);}
 if(s.simTime<target-1e-6||s.population<200||p.ceremonies.length||!decode(encode(s)))throw Error('Supplied fixture must retain 200+ citizens without calendar-stopping ceremonies');
 if(!p.orders.some(q=>q.transport===p.transport&&q.buy&&q.sell)||s.trade.deliveries.some(q=>q.delivered!==q.amount)||s.trade.sales.some(q=>q.loaded!==q.amount))throw Error('Real trade was not completed');
 if(p.roadWork&&!p.roadWork.completedAt&&!(p.roadWork.maxWork>0))throw Error('Real road work never progressed');
 return {population:s.population,simTime:s.simTime,orders:p.orders,ceremonies:p.ceremonies,roadWork:p.roadWork};
}
`;
await writeFile(join(output,'trade-fixture.mjs'),fixture);
const helper=await import(pathToFileURL(join(output,'trade-fixture.mjs')).href+'?verify='+Date.now());
for(const ecologyMode of ['legacy','modern','modern-grown'])for(const transport of ['land','river']){const {state,proof}=helper.createTradeFixture(transport,'strict',ecologyMode);console.log(JSON.stringify({transport,ecologyMode,valid:true,start:proof.measurementStart,harbor:proof.harbor,audit:helper.auditTradeFixture(state,proof)}));}
{const {state,proof}=helper.createTradeFixture('land','strict','legacy',true);console.log(JSON.stringify({roadWork:true,audit:helper.auditTradeFixture(state,proof)}));}
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
app=app.replace('quality:renderer.quality,','quality:renderer.quality,vegetation:vegetationGPUInfo(),palms:palmStateInfo(),inventory:sceneInventory(),');
app+=`\nexport function vegetationGPUInfo(){const all=renderer.landscape?.meshes||[],batches=all.filter(m=>m.metadata?.valleyBatch);return {batches:batches.length,instances:batches.reduce((n,m)=>n+m.thinInstanceCount,0),uniqueGeometries:new Set(batches.map(m=>m.geometry)).size,geometryPayloadUpperBoundBytes:batches.reduce((n,m)=>n+m.getVerticesDataKinds().filter(k=>!k.startsWith('world')).reduce((a,k)=>a+(m.getVerticesData(k)?.length||0)*4,0)+m.getIndices().length*4,0),matrixBytes:batches.reduce((n,m)=>n+m.thinInstanceCount*16*4,0),wrongGPUBufferBindings:batches.filter(m=>[0,1,2,3].some(i=>m.getVertexBuffer('world'+i)?.getBuffer()!==m._thinInstanceDataStorage?.matrixBuffer?.getBuffer())).length,disposedRegistryMeshes:all.filter(m=>m.isDisposed()).length};}\n`;
app+=`\nexport function palmStateInfo(){const parts=(renderer.landscape?.meshes||[]).filter(m=>m.sourceMesh&&m.name.startsWith('date-palm-')),batches=(renderer.landscape?.meshes||[]).filter(m=>m.metadata?.palmBatch);return {parts:parts.length,enabledIndividuals:parts.filter(m=>m.isEnabled()).length,groups:batches.length,instances:batches.reduce((n,m)=>n+m.thinInstanceCount,0),uniqueGroupedParts:new Set(batches.flatMap(m=>m.metadata.palmBatch.parts)).size,weather:probeWeatherAt(state).type};}\n`;
await writeFile(join(output,'app-check.js'),app);
let check=await readFile(join(output,'check.js'),'utf8');const start=check.indexOf('const s=createGame('),end=check.indexOf("localStorage.setItem(");
if(start<0||end<start)throw Error('Generic fixture changed');
check=`import {createTradeFixture} from './trade-fixture.mjs?probe=${tag}';\n`+check.slice(0,start)+`const transport=new URLSearchParams(location.search).get('transport')||'land';const history=new URLSearchParams(location.search).get('history')||'strict';const ecologyMode=new URLSearchParams(location.search).get('ecology')||'legacy';const {state:s,proof}=createTradeFixture(transport,history,ecologyMode,new URLSearchParams(location.search).has('roadWork'));\n`+check.slice(end);
check=check.replace('await app.profileLayers();','await app.profileLayers();app.attachTradeProof(proof);');
check=check.replace("fixture:'seed137-200-residents-129-buildings-start35'","fixture:'sumer-supplied-real-trade-200-initial-129-v4',transport,history,trade:app.tradeStateInfo()");
check=check.replace("out.textContent='Готово: 200 жителей / 129 зданий; интерфейс и автосохранение включены'","out.textContent='Готово: '+transport+' · 200 исходных жителей / 129 зданий; интерфейс, торговля и автосохранение включены'");
check=check.replace('let last=start,active=true;', 'let last=start,active=true;const startViewport=[innerWidth,innerHeight];let visibilityChanges=0;const visibility=()=>visibilityChanges++;document.addEventListener("visibilitychange",visibility);');
check=check.replace('active=false;observer?.disconnect();','active=false;observer?.disconnect();document.removeEventListener("visibilitychange",visibility);');
check=check.replace('transport,history,trade:app.tradeStateInfo()', `transport,history,trade:app.tradeStateInfo(),startViewport,visibilityChanges,viewportChanged:startViewport[0]!==innerWidth||startViewport[1]!==innerHeight,selectedSpeed:document.querySelector('[data-speed][aria-pressed="true"]')?.dataset.speed`);
check=check.replace('sceneStart=app.sceneInfo();','sceneStart=(app.resetTimingTotals(),app.sceneInfo());');
check=check.replace('stages:app.timings,','stages:app.timings,timingTotals:app.timingTotals,terrainCutCaching:true,staticSceneryCaching:true,grassStaticAlphaCaching:true,grassColorClipCaching:!location.pathname.endsWith("/perf-uncached.html"),frustumProbe:new URLSearchParams(location.search).get("frustum")||"precise",roadBatching:app.roadBatchingMode(),palmBatching:app.palmBatchingMode(),');
check+=`\nconst roadToggle=document.createElement('button'),roadProof=document.createElement('pre');roadToggle.textContent='Переключить группировку дорог';roadToggle.id='toggle-road-groups';roadProof.id='road-group-proof';roadToggle.onclick=()=>{if(document.querySelector('#measurement').textContent.startsWith('Замер'))return;app.setProbeRoadBatching(!app.roadBatchingMode());requestAnimationFrame(()=>requestAnimationFrame(()=>{roadProof.textContent=JSON.stringify({batching:app.roadBatchingMode(),scene:app.sceneInfo()},null,2);}));};const controls=document.querySelector('#measure').parentElement;controls.insertBefore(roadToggle,document.querySelector('#measurement'));controls.append(roadProof);roadProof.style.maxHeight='30px';roadProof.style.overflow='auto';const fold=document.createElement('button');fold.textContent='Свернуть результаты';fold.onclick=()=>{out.hidden=!out.hidden;roadProof.hidden=out.hidden;fold.textContent=out.hidden?'Показать результаты':'Свернуть результаты';};controls.insertBefore(fold,out);\n`;
check+=`\nconst palmToggle=document.createElement('button');palmToggle.textContent='Переключить группировку пальм';palmToggle.id='toggle-palm-groups';palmToggle.onclick=()=>{if(out.textContent.startsWith('Замер'))return;app.setProbePalmBatching(!app.palmBatchingMode());requestAnimationFrame(()=>requestAnimationFrame(()=>{roadProof.hidden=false;roadProof.textContent=JSON.stringify({palmBatching:app.palmBatchingMode(),scene:app.sceneInfo()},null,2);}));};controls.insertBefore(palmToggle,out);\n`;
await writeFile(join(output,'check.js'),check);
check=check.replace(/app-check.js\?probe=[^'"\s]+/g,'app-check.js?probe='+tag);await writeFile(join(output,'check.js'),check);
const html=(await readFile(join(output,'perf.html'),'utf8')).replace(/check.js\?probe=[^'"\s]+/g,'check.js?probe='+tag);await writeFile(join(output,'perf.html'),html);
// Private baseline is the last verified published landscape, including its old
// scenery rebuild path; shared engine/state/assets remain the current candidate.
const baselineCommit='a69be485ece6847c018d46ce96288ae6b8aeb181';
const rewriteLandscape=code=>code.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './repo/game3d/$1'").replace(/from ['"]\.\.\/([^'"]+)['"]/g,"from './repo/$1'");
const baselineVegetationSource=execFileSync('git',['show',baselineCommit+':game3d/valley-vegetation.js'],{cwd:source,encoding:'utf8'}),candidateVegetationSource=await readFile(join(source,'game3d/valley-vegetation.js'),'utf8'),baselineVegetation=rewriteLandscape(baselineVegetationSource),candidateVegetation=rewriteLandscape(candidateVegetationSource);
await writeFile(join(output,'valley-vegetation-baseline.mjs'),baselineVegetation);await writeFile(join(output,'valley-vegetation-candidate.mjs'),candidateVegetation);
const instrumentLandscape=code=>{
 if(!code.includes('function carveChannels(s,arms){')||!code.includes(' function rebuildGeometry(s,plan){'))throw Error('Channel color probe anchor changed');
 return "export const landscapeProbe=[];\n"+code.replace('function carveChannels(s,arms){','function rawCarveChannels(s,arms){').replace(' function rebuildGeometry(s,plan){',` function carveChannels(s,arms){const grass=base?.meshes.find(m=>m.name==='soft-riparian-grass'),buffer=kind=>grass?.getVertexBuffer(kind)?.getBuffer(),before={color:buffer('color'),position:buffer('position'),normal:buffer('normal')},start=performance.now();try{return rawCarveChannels(s,arms);}finally{const ms=performance.now()-start,colorChanged=before.color!==buffer('color');if(ms>1||colorChanged)landscapeProbe.push({phase:'landscape.carveChannels',ms,simTime:s.simTime,tick:s.tick,colorChanged,positionChanged:before.position!==buffer('position'),normalChanged:before.normal!==buffer('normal')});}}\n function rebuildGeometry(s,plan){`);
};
const baselineLandscapeSource=execFileSync('git',['show',baselineCommit+':game3d/landscape.js'],{cwd:source,encoding:'utf8'}),candidateLandscapeSource=await readFile(join(source,'game3d/landscape.js'),'utf8'),baselineLandscape=instrumentLandscape(rewriteLandscape(baselineLandscapeSource).replace('./repo/game3d/valley-vegetation.js','./valley-vegetation-baseline.mjs?probe='+tag)),candidateLandscape=instrumentLandscape(rewriteLandscape(candidateLandscapeSource).replace('./repo/game3d/valley-vegetation.js','./valley-vegetation-candidate.mjs?probe='+tag)),sha=code=>createHash('sha256').update(code).digest('hex');
if(!baselineLandscape.includes('valley-vegetation-baseline.mjs?probe=')||!candidateLandscape.includes('valley-vegetation-candidate.mjs?probe='))throw Error('Vegetation baseline/candidate mapping did not apply');
await writeFile(join(output,'landscape-candidate.mjs'),candidateLandscape);
const candidateHtml=html.replace(/("\.\/game3d\/landscape\.js":)"[^"]+"/,`$1"../landscape-candidate.mjs?probe=${tag}"`);
if(candidateHtml===html)throw Error('Missing candidate landscape mapping');
await writeFile(join(output,'perf.html'),candidateHtml);
check=check.replace('terrainCutCaching:',`vegetationProductionSHA256:location.pathname.endsWith('/perf-uncached.html')?'${sha(baselineVegetationSource)}':'${sha(candidateVegetationSource)}',vegetationModuleSHA256:location.pathname.endsWith('/perf-uncached.html')?'${sha(baselineVegetation)}':'${sha(candidateVegetation)}',landscapeProductionSHA256:location.pathname.endsWith('/perf-uncached.html')?'${sha(baselineLandscapeSource)}':'${sha(candidateLandscapeSource)}',landscapeModuleSHA256:location.pathname.endsWith('/perf-uncached.html')?'${sha(baselineLandscape)}':'${sha(candidateLandscape)}',terrainCutCaching:`);
await writeFile(join(output,'check.js'),check);
await writeFile(join(output,'landscape-uncached.mjs'),baselineLandscape);
const baselineHtml=html.replace(/("\.\/game3d\/landscape\.js":)"[^"]+"/,`$1"../landscape-uncached.mjs?probe=${tag}"`);
if(baselineHtml===html)throw Error('Missing landscape import-map entry for baseline');
await writeFile(join(output,'perf-uncached.html'),baselineHtml);
// Pin and time both terrain implementations; baseline must not import the
// mutable candidate through a shared repo URL.
const terrainSources={};
for(const mode of ['baseline','candidate']){
 const code=mode==='baseline'?execFileSync('git',['show',baselineCommit+':district3d/terrain.js'],{cwd:source,encoding:'utf8'}):await readFile(join(source,'district3d/terrain.js'),'utf8');
 let rewritten=code.replace(/from ['"]\.\/([^'"]+)['"]/g,"from './repo/district3d/$1'").replace(/from ['"]\.\.\/([^'"]+)['"]/g,"from './repo/$1'");
 if(!rewritten.includes('function refreshRoadMask(s){'))throw Error('Terrain mask probe anchor changed');
 rewritten="export const terrainProbe=[];\n"+rewritten.replace('function refreshRoadMask(s){','function rawRefreshRoadMask(s){').replace("  const palmMaterial=new B.PBRMaterial",`  function refreshRoadMask(s){const start=performance.now();try{return rawRefreshRoadMask(s);}finally{terrainProbe.push({phase:'terrain.roadMask',ms:performance.now()-start,simTime:s.simTime,tick:s.tick,vertices:gp.length/3});}}\n  const palmMaterial=new B.PBRMaterial`);
 await writeFile(join(output,'terrain-'+mode+'.mjs'),rewritten);terrainSources[mode]={productionSHA256:sha(code),moduleSHA256:sha(rewritten)};
 const path=join(output,mode==='baseline'?'perf-uncached.html':'perf.html');let page=await readFile(path,'utf8');page=page.replace(/("\.\/district3d\/terrain\.js":)"[^"]+"/,`$1"../terrain-${mode}.mjs?probe=${tag}"`);if(!page.includes('terrain-'+mode+'.mjs?probe='))throw Error('Terrain mapping missing');await writeFile(path,page);
}
app="import {terrainProbe} from './repo/district3d/terrain.js';\nimport {landscapeProbe} from './repo/game3d/landscape.js';\n"+app;app=app.replace('quality:renderer.quality,','quality:renderer.quality,probeHeap:typeof performance.memory==="object"?{usedJSHeapSize:performance.memory.usedJSHeapSize,totalJSHeapSize:performance.memory.totalJSHeapSize,jsHeapSizeLimit:performance.memory.jsHeapSizeLimit}:null,terrainPhases:[...terrainProbe],landscapePhases:[...landscapeProbe],grassBuffers:grassBufferInfo(),');
app+=`\nexport async function grassGeometryProof(){const m=renderer.landscape.meshes.find(m=>m.name==='soft-riparian-grass');if(!m)return null;const values={position:m.getVerticesData('position'),normal:m.getVerticesData('normal'),color:m.getVerticesData('color'),index:m.getIndices()},out={};for(const [key,array]of Object.entries(values)){const data=key==='index'?new Uint32Array(array):new Float32Array(array),bytes=await crypto.subtle.digest('SHA-256',data);out[key]={length:data.length,sha256:[...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('')};}return out;}\n`;
app+=`\nconst grassBufferIds=new WeakMap();let grassBufferSequence=0;export function grassBufferInfo(){const m=renderer.landscape.meshes.find(m=>m.name==='soft-riparian-grass');return Object.fromEntries(['position','normal','color'].map(kind=>{const buffer=m?.getVertexBuffer(kind)?.getBuffer();if(!buffer)return [kind,null];if(!grassBufferIds.has(buffer))grassBufferIds.set(buffer,++grassBufferSequence);return [kind,grassBufferIds.get(buffer)];}));}\n`;
app+=`\nexport function riverCargoViewInfo(){const c=state.trade?.caravan,root=renderer.scene?.transformNodes.find(n=>n.metadata?.riverCraft),cargo=(renderer.scene?.meshes||[]).filter(m=>m.metadata?.riverCargo);return {caravan:c?structuredClone(c):null,rootMetadata:root?.metadata||null,rootPosition:root?.position.asArray(),expectedKinds:Object.keys(c?.stock||{}).filter(k=>Number.isFinite(c.stock[k])&&c.stock[k]>0).sort(),actualKinds:cargo.map(m=>m.metadata.goods.kind).sort(),cargo:cargo.map(m=>({name:m.name,enabled:m.isEnabled(),visible:m.isVisible,goods:m.metadata.goods,position:m.position.asArray()}))};}\nexport function focusRiverCraft(){const c=state.trade?.caravan;if(!c||c.transport!=='river')return false;renderer.focusOn(c.x,c.y);renderer.camera.radius=13;renderer.camera.alpha=.7;renderer.camera.beta=1.05;return true;}\n`;
app=app.replace('proof:tradeProof,deliveries:','proof:tradeProof,riverView:riverCargoViewInfo(),deliveries:');
await writeFile(join(output,'app-check.js'),app);
check+=`\nconst riverProofButton=document.createElement('button');riverProofButton.id='river-cargo-proof';riverProofButton.textContent='Показать настоящую лодку и груз';riverProofButton.onclick=()=>{if(out.textContent.startsWith('Замер'))return;app.focusRiverCraft();roadProof.hidden=false;roadProof.textContent=JSON.stringify({river:app.riverCargoViewInfo(),scene:app.sceneInfo()},null,2);};document.querySelector('#measurement').before(riverProofButton);\n`;
check=check.replace('terrainCutCaching:',`terrainSources:${JSON.stringify(terrainSources)},terrainBaselineCommit:'${baselineCommit}',terrainCutCaching:`);
check+=`\nconst grassProofButton=document.createElement('button');grassProofButton.id='grass-proof';grassProofButton.textContent='Проверить данные травы';grassProofButton.onclick=async()=>{roadProof.hidden=false;roadProof.textContent=JSON.stringify({grass:await app.grassGeometryProof(),scene:app.sceneInfo()},null,2);};controls.insertBefore(grassProofButton,out);\n`;
check=`const navigationKey='babylon-perf-navigation-v1';function navigationTrail(){try{return JSON.parse(sessionStorage.getItem(navigationKey)||'[]');}catch{return [];}}function recordNavigation(type,event){const trail=navigationTrail();trail.push({type,persisted:event.persisted,path:location.pathname+location.search,at:Date.now(),heap:typeof performance.memory==='object'?performance.memory.usedJSHeapSize:null});try{sessionStorage.setItem(navigationKey,JSON.stringify(trail.slice(-12)));}catch{}const out=document.querySelector('#navigation-profile');if(out)out.textContent=JSON.stringify({trail:navigationTrail(),visibility:document.visibilityState,hidden:document.hidden});}addEventListener('pagehide',e=>recordNavigation('pagehide',e));addEventListener('pageshow',e=>recordNavigation('pageshow',e));\n`+check;
check=check.replace('const startViewport=[innerWidth,innerHeight];','const startViewport=[innerWidth,innerHeight],startVisibility=document.visibilityState,startHidden=document.hidden;').replace('startViewport,visibilityChanges,','startViewport,startVisibility,startHidden,endVisibility:document.visibilityState,endHidden:document.hidden,visibilityChanges,');
check=check.replace('frames:frames.length,','frames:frames.length,frameIntervals:frames,');
check+=`\nconst navigationOutput=document.createElement('pre');navigationOutput.id='navigation-profile';navigationOutput.style.maxHeight='20px';navigationOutput.style.overflow='auto';navigationOutput.textContent=JSON.stringify({trail:navigationTrail(),visibility:document.visibilityState,hidden:document.hidden});controls.append(navigationOutput);\n`;
await writeFile(join(output,'check.js'),check);
console.log(JSON.stringify({output,page:'perf.html?transport=land or river',seconds:80,tag,warning:'Isolated origin only; measure close and overview separately, no heavy tests during measurements'}));
