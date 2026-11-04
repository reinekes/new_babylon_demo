// Full-app, real WebGL acceptance fixture. Never open this on an origin containing
// a personal city: it deliberately replaces new-babylon-v1 on its test-only origin.
// node scripts/prepare-season-browser-check.mjs [source-checkout] [output-directory]
// Serve output on a separate localhost port, open perf.html, choose camera, run.
import {readFile,writeFile,mkdir,symlink,lstat,readlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const source=resolve(process.argv[2]||fileURLToPath(new URL('../',import.meta.url)));
const output=resolve(process.argv[3]||join(tmpdir(),'new-babylon-season-check'));
if(output===source||source.startsWith(output+'/'))throw Error('Use a separate output directory');
let html=await readFile(join(source,'index.html'),'utf8'),app=await readFile(join(source,'app.js'),'utf8');
const tag=createHash('sha256').update(app).update(html).digest('hex').slice(0,12);
if(!app.includes('advanceTime,')||!html.includes('src="app.js?'))throw Error('Application entry changed; review fixture instrumentation');
app=app.replace('advanceTime,','advanceTime as rawAdvanceTime,').replaceAll("from './","from './repo/").replaceAll("import('./","import('./repo/");
app+=`
export const timings=[];
function timed(tag,fn){const start=performance.now();try{return fn();}finally{const ms=performance.now()-start;if(ms>35)timings.push({tag,ms,simTime:state.simTime,tick:state.tick});}}
function advanceTime(...args){return timed('simulation',()=>rawAdvanceTime(...args));}
const rawDraw=renderer.draw.bind(renderer);renderer.draw=(...args)=>timed('renderer',()=>rawDraw(...args));
const rawUpdate=update;update=(...args)=>timed('HUD',()=>rawUpdate(...args));
const rawSave=save;save=(...args)=>timed('save',()=>rawSave(...args));
export async function profileLayers(){await renderer.detailsReady;await renderer.detailQueue?.idle();for(const [object,method,label]of [[renderer.buildings,'sync','buildings'],[renderer.landscape,'update','landscape'],[renderer.actors,'update','actors'],[renderer.scene,'render','scene.render']])if(object?.[method]){const original=object[method].bind(object);object[method]=(...args)=>timed(label,()=>original(...args));}}
export function sceneInfo(){return {meshes:renderer.scene?.meshes.length,skeletons:renderer.scene?.skeletons.length,quality:renderer.quality,cameraRadius:renderer.camera?.radius,canvas:[renderer.engine?.getRenderWidth(),renderer.engine?.getRenderHeight()]};}
`;
const check=`import {createGame,advanceTime,terrain,encode,decode,resolveEvent} from './repo/engine.js';
import {syncCitizens} from './repo/workforce.js';
import {housingOf} from './repo/definitions.js';
const s=createGame({start:'established',seed:137});
for(let y=2;y<62&&s.buildings.length<129;y+=5)for(let x=2;x<62&&s.buildings.length<129;x+=5)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:s.buildings.length%3?'house':terrain(x,y,s)==='fertile'?'field':'clay',x,y,level:1});
s.population=200;s.capacity=housingOf(s);syncCitizens(s);s.resources.food=2000;
for(let i=0;i<140;i++){if(s.event)resolveEvent(s,'skip');advanceTime(s,.25);}
localStorage.setItem('new-babylon-v1',encode(s));
const app=await import('./app-check.js?probe=${tag}');await app.profileLayers();
// Equal settling time for both checkouts; exclude loading and hidden-rig warmup.
await new Promise(resolve=>setTimeout(resolve,10000));
const out=document.querySelector('#measurement'),button=document.querySelector('#measure');out.textContent='Готово: 200 жителей / 129 зданий; интерфейс и автосохранение включены';
button.onclick=()=>{
 button.disabled=true;const frames=[],tasks=[],start=performance.now(),sceneStart=app.sceneInfo();let last=start,active=true;
 const observer=typeof PerformanceObserver==='function'&&PerformanceObserver.supportedEntryTypes?.includes('longtask')?new PerformanceObserver(list=>{for(const e of list.getEntries())tasks.push({at:e.startTime-start,ms:e.duration});}):null;observer?.observe({type:'longtask'});
 function sample(t){if(!active)return;frames.push(t-last);last=t;requestAnimationFrame(sample);}requestAnimationFrame(sample);
 app.timings.length=0;document.querySelector('[data-speed="4"]').click();document.querySelector('#pause').click();out.textContent='Замер 4× идёт…';
 setTimeout(()=>{active=false;observer?.disconnect();if(document.querySelector('#pause').getAttribute('aria-label')==='Приостановить время')document.querySelector('#pause').click();const end=performance.now(),saved=decode(localStorage.getItem('new-babylon-v1')),sorted=[...frames].sort((a,b)=>a-b);out.textContent=JSON.stringify({fixture:'seed137-200-residents-129-buildings-start35',wallSeconds:(end-start)/1000,frames:frames.length,fps:frames.length*1000/(end-start),frameP95:sorted[Math.floor(sorted.length*.95)],frameMax:sorted.at(-1),longTasksAvailable:!!observer,longTasks:tasks,stages:app.timings,sceneStart,sceneEnd:app.sceneInfo(),validSave:!!saved,simTime:saved?.simTime,tick:saved?.tick,population:saved?.population,buildings:saved?.buildings?.length,viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,saveStatus:document.querySelector('#save-status')?.textContent},null,2);},80000);
};
`;
html=html.replace('<head>','<head><base href="./repo/">').replace(/<script type="module" src="app.js[^\"]*"><\/script>/,`<script type="module">import '../check.js?probe=${tag}';</script>`);
if(!html.includes("import '../check.js?"))throw Error('Application script not replaced');
html=html.replace('</body>','<aside style="position:fixed;bottom:0;left:0;z-index:99999;background:white;color:black;max-width:500px;max-height:260px;overflow:auto"><button id="measure">Проверить 80 секунд на 4×</button><pre id="measurement">Подготовка · только тестовый origin</pre></aside></body>');
await mkdir(output,{recursive:true});
const link=join(output,'repo'),existing=await lstat(link).catch(error=>{if(error.code==='ENOENT')return null;throw error;});
if(existing){if(!existing.isSymbolicLink()||await readlink(link)!==source)throw Error('Output repo link points to a different checkout');}else await symlink(source,link,'dir');
await writeFile(join(output,'app-check.js'),app);await writeFile(join(output,'check.js'),check);await writeFile(join(output,'perf.html'),html);
console.log(JSON.stringify({source,output,page:'perf.html',seconds:80,warning:'Serve on an isolated origin: the fixture replaces its own city save'}));
