// CPU/regression harness. Does not render or access user saves.
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
// Usage: node scripts/benchmark-season-transitions.mjs [checkout] [--natural]
const rootPath=process.argv.slice(2).find(arg=>!arg.startsWith('--'))||new URL('../',import.meta.url).pathname;
const root=pathToFileURL(resolve(rootPath)+'/');
const {createGame,advanceTime,terrain,encode,decode,resolveEvent}=await import(new URL('engine.js',root));
const {syncCitizens}=await import(new URL('workforce.js',root));
const {housingOf}=await import(new URL('definitions.js',root));
const {createSeasonJump}=await import(new URL('season-jump.js',root));
const s=createGame({start:'established',seed:137});
for(let y=2;y<62&&s.buildings.length<129;y+=5)for(let x=2;x<62&&s.buildings.length<129;x+=5)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:s.buildings.length%3?'house':terrain(x,y,s)==='fertile'?'field':'clay',x,y,level:1});
s.population=200;s.capacity=housingOf(s);syncCitizens(s);
// A full pantry isolates repeated seasonal processing from starvation endings.
s.resources.food=2000;
const mode=process.argv.includes('--natural')?'natural':'jump',samples=[],boundaries=[],slowSteps=[],presentations=[],start=performance.now();
let lastPresentation=null;
function step(fn){const tick=s.tick,time=s.simTime,a=performance.now();fn();const ms=performance.now()-a;if(s.miracleCelebration&&s.miracleCelebration!==lastPresentation){lastPresentation=s.miracleCelebration;presentations.push(createHash('sha256').update(JSON.stringify(s.miracleCelebration)).digest('hex'));}samples.push(ms);if(ms>40)slowSteps.push({step:samples.length-1,before:time,after:s.simTime,tick:s.tick,ms,startMs:a,endMs:performance.now()});if(s.tick!==tick)boundaries.push({tick:s.tick,simTime:s.simTime,ms,validSave:!!decode(encode(s))});}
if(mode==='jump')for(let i=0;i<3;i++){
 const jump=createSeasonJump(s);let frame;
 do{step(()=>{frame=jump.step(.25);});}while(!frame.done);
 if(!frame.result.ok)throw Error(frame.result.reason);
}else for(let i=0;i<15000&&s.tick<3;i++){
 if(s.event)resolveEvent(s,'skip');
 step(()=>advanceTime(s,s.miracleCelebration?60:1/60));
}
if(s.tick!==3||!decode(encode(s)))throw Error('Incomplete or invalid seasonal run');
const ordered=[...samples].sort((a,b)=>a-b),raw=encode(s);
console.log(JSON.stringify({mode,fixture:'world64-seed137-200-residents-129-buildings',note:'CPU only, not FPS; stocked fixture; automatic miracle presentations fast-forwarded in natural mode',steps:samples.length,cpuTotalMs:performance.now()-start,stepCpuMs:{median:ordered[Math.floor(ordered.length*.5)],p95:ordered[Math.floor(ordered.length*.95)],max:ordered.at(-1)},boundaries,slowSteps,presentations,population:s.population,stateSHA256:createHash('sha256').update(raw).digest('hex')},null,2));
