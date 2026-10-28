import {createGame,advanceTime,terrain,encode,decode} from '../../engine.js';
import {syncCitizens,invalidateAssignments} from '../../workforce.js';
import {housingOf} from '../../definitions.js';
import {simulationSeconds} from '../../calendar.js';
import {createGameRenderer} from '../../game3d/renderer.js';

const output=document.querySelector('#result'),history=document.querySelector('#history'),status=document.querySelector('#status');
const bootStarted=performance.now(),startup={};
const controls=[...document.querySelectorAll('[data-scenario]')],stop=document.querySelector('#stop');
const results=[],errors=[];
window.addEventListener('error',e=>{errors.push(e.message);status.textContent=`Ошибка: ${e.message}`;});
window.addEventListener('unhandledrejection',e=>{errors.push(String(e.reason));status.textContent=`Ошибка: ${e.reason}`;});
const initial=createGame({start:'established'});
for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,initial)!=='water'&&!initial.buildings.some(b=>b.x===x&&b.y===y))initial.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});
initial.population=200;initial.capacity=housingOf(initial);syncCitizens(initial);invalidateAssignments(initial);syncCitizens(initial);
const seed=encode(initial);let state=initial;
const renderer=await createGameRenderer(document.querySelector('canvas'),()=>{},{initialState:state});
startup.interactiveMs=Math.round(performance.now()-bootStarted);
if(renderer.mode!=='3d')throw Error('Для измерения нужен WebGL 3D; fallback 2D не является результатом.');
renderer.lightMode='day';
let running=null,last=performance.now(),ready=false,stage={};
const originalDraw=renderer.draw.bind(renderer);
function wrap(object,key,label){const original=object[key].bind(object);object[key]=(...args)=>{const t=performance.now();try{return original(...args);}finally{stage[label]=(stage[label]||0)+performance.now()-t;}};}
const rounded=value=>Math.round(value*100)/100;
function summary(values){if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b);return {medianMs:rounded(sorted[Math.floor(sorted.length*.5)]),p95Ms:rounded(sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]),meanMs:rounded(sorted.reduce((a,b)=>a+b,0)/sorted.length)};}
function finish(cancelled=false){
 const run=running;if(!run)return;running=null;controls.forEach(b=>b.disabled=false);stop.disabled=true;
 if(cancelled){status.textContent='Замер отменён; результат не записан.';return;}
 const viewport=renderer.canvas.getBoundingClientRect(),scene=renderer.scene;
 const models=performance.getEntriesByType('resource').filter(r=>new URL(r.name).pathname.endsWith('.glb'));
 const report={scenario:run.scenario,frames:run.intervals.length,wallSeconds:rounded(run.intervals.reduce((a,b)=>a+b,0)/1000),fps:rounded(1000*run.intervals.length/run.intervals.reduce((a,b)=>a+b,0)),frameIntervals:summary(run.intervals),simulationCPU:summary(run.simulation),drawCPU:summary(run.draw),stages:Object.fromEntries(Object.entries(run.stages).map(([k,v])=>[k,summary(v)])),drawCalls:summary(run.calls),scene:{totalMeshes:scene.meshes.length,enabledMeshes:scene.meshes.filter(m=>m.isEnabled()).length,activeMeshes:scene.getActiveMeshes().length,skeletons:scene.skeletons.length,materials:scene.materials.length,actorMeshes:renderer.actors.meshes.length,buildingMeshes:renderer.buildings.meshes.length,landscapeMeshes:renderer.landscape.meshes.length},world:{residents:state.citizens.length,buildings:state.buildings.length,speed:4,event:state.event?.id||null,simTime:state.simTime},screen:{width:viewport.width,height:viewport.height,renderWidth:renderer.engine.getRenderWidth(),renderHeight:renderer.engine.getRenderHeight(),devicePixelRatio,hardwareScaling:renderer.engine.getHardwareScalingLevel(),visibility:document.visibilityState},startup:{...startup,modelRequests:models.length,modelDecodedBytes:models.reduce((sum,r)=>sum+r.decodedBodySize,0),modelTransferredBytes:models.reduce((sum,r)=>sum+r.transferSize,0)},detailsReady:renderer.detailQueue?.errors?.length===0,errors:[...errors]};
 // Draw calls are counts, not milliseconds; keep their names explicit.
 if(report.drawCalls)report.drawCalls={median:report.drawCalls.medianMs,p95:report.drawCalls.p95Ms,mean:report.drawCalls.meanMs};
 results.push(report);output.textContent=JSON.stringify(report,null,2);history.textContent=JSON.stringify(results,null,2);status.textContent=`Готово: ${run.scenario} · ${report.fps} FPS · кадр p95 ${report.frameIntervals.p95Ms} мс. CPU ниже указан отдельно.`;
}
function start(scenario){
 state=decode(seed);if(!state)throw Error('Не восстановился проверочный город.');
 renderer.resetPresentation();renderer.lastTime=null;renderer.lastSim=null;renderer.home();
 renderer.camera.setTarget(new BABYLON.Vector3(53,0,55));renderer.camera.alpha=Math.PI/3;renderer.camera.beta=scenario==='far'?.68:.96;renderer.camera.radius=scenario==='far'?240:62;
 const low=scenario==='low';renderer.scene.shadowsEnabled=!low&&scenario!=='shadows';renderer.quality=low?'low':'high';renderer.landscape.setQuality(low?'low':'high');renderer.engine.setHardwareScalingLevel((low||scenario==='resolution')?1:1/Math.min(devicePixelRatio||1,1.5));renderer.resize();
 controls.forEach(b=>b.disabled=true);stop.disabled=false;output.textContent='';last=performance.now();running={scenario,start:last,measureStart:null,previous:null,intervals:[],simulation:[],draw:[],stages:{},calls:[]};status.textContent=`${scenario}: прогрев…`;
}
controls.forEach(b=>b.onclick=()=>start(b.dataset.scenario));stop.onclick=()=>finish(true);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)finish(true);});
function frame(now){
 const dt=Math.max(0,Math.min(.25,(now-last)/1000));last=now;stage={};
 const simStart=performance.now();if(running&&!state.event)advanceTime(state,simulationSeconds(dt,4));const simCPU=performance.now()-simStart;
 const drawStart=performance.now();originalDraw(state,null,now,{paused:!running,speed:4});const drawCPU=performance.now()-drawStart;
 if(running&&now-running.start>=3000){
  const run=running;if(run.measureStart===null){run.measureStart=now;status.textContent=`${run.scenario}: измерение 12 секунд…`;}
  if(run.previous!==null){run.intervals.push(now-run.previous);run.simulation.push(simCPU);run.draw.push(drawCPU);for(const [k,v]of Object.entries(stage))(run.stages[k]??=[]).push(v);run.calls.push(instrument.drawCallsCounter.current);}
  run.previous=now;if(now-run.measureStart>=12000)finish();
 }
 if(!ready||running)requestAnimationFrame(frame);
 else{last=performance.now();setTimeout(()=>requestAnimationFrame(frame),200);}
}
let instrument;
requestAnimationFrame(frame);
await renderer.detailsReady;await renderer.actors.residentDetailsReady?.();await renderer.buildings.sacredReady?.();
startup.detailsMs=Math.round(performance.now()-bootStarted);
wrap(renderer.buildings,'sync','buildings');wrap(renderer.landscape,'update','landscape');wrap(renderer.actors,'update','actors');wrap(renderer,'updateLight','light');wrap(renderer.scene,'render','sceneRender');
instrument=new BABYLON.SceneInstrumentation(renderer.scene);instrument.captureActiveMeshesEvaluationTime=true;instrument.captureAnimationsTime=true;instrument.captureRenderTargetsRenderTime=true;
// The existing actor IK is inside scene.render/onAfterAnimations; it therefore
// belongs to sceneRender CPU, not exclusively to the actors.update stage.
renderer.scene.onAfterRenderObservable.add(()=>{stage.activeMeshesEvaluation=instrument.activeMeshesEvaluationTimeCounter.current;stage.animation=instrument.animationsTimeCounter.current;stage.renderTargets=instrument.renderTargetsRenderTimeCounter.current;});
ready=true;controls.forEach(b=>b.disabled=false);status.textContent='Подробности загружены. Выберите замер; между замерами сцена почти не нагружает процессор.';
