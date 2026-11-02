import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const args=process.argv.slice(2),large=args.includes('--world64'),rootPath=args.find(v=>!v.startsWith('--'));
const root=rootPath?pathToFileURL(resolve(rootPath)+'/'):new URL('../',import.meta.url);
const {createGame,advanceTime,terrain,encode}=await import(new URL('engine.js',root));
const {syncCitizens,invalidateAssignments}=await import(new URL('workforce.js',root));
const {housingOf}=await import(new URL('definitions.js',root));
const s=createGame({start:'established',...(large?{seed:137}: {})});
// Keep the published legacy fixture byte-for-byte; scatter the new fixture over
// the enlarged valley, with the same population and building count for context.
if(large){for(let y=2;y<62&&s.buildings.length<129;y+=5)for(let x=2;x<62&&s.buildings.length<129;x+=5)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:s.buildings.length%3?'house':terrain(x,y,s)==='fertile'?'field':'clay',x,y,level:1});}
else for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});s.population=200;s.capacity=housingOf(s);syncCitizens(s);
invalidateAssignments(s);let a=performance.now();syncCitizens(s);const assignmentMs=performance.now()-a;
const samples=[];for(let i=0;i<900;i++){a=performance.now();advanceTime(s,4/60);samples.push(performance.now()-a);}samples.sort((a,b)=>a-b);
const saves=[];let raw='';for(let i=0;i<100;i++){a=performance.now();raw=encode(s);saves.push(performance.now()-a);}saves.sort((a,b)=>a-b);
console.log(JSON.stringify({fixture:large?'world64-seed137':'legacy',width:s.world?.width||40,height:s.world?.height||32,buildings:s.buildings.length,population:s.population,assignmentMs,simulation4x:{medianMs:samples[450],p95Ms:samples[855],maxMs:samples[899]},encode:{medianMs:saves[50],maxMs:saves[99],bytes:Buffer.byteLength(raw)},stateSHA256:createHash('sha256').update(raw).digest('hex')}));
