import {foodWarnings} from '../food-planning.js';
import {performance} from 'node:perf_hooks';
import {createGame,advanceTime,terrain} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {housingOf} from '../definitions.js';
import {irrigationFor} from '../irrigation.js';
const {syncPestSites,bringCat}=await import('../pests.js');const {assignGuard}=await import('../management.js');
const s=createGame();
for(const y of [4,6,10,12,16,20])for(let x=3;x<18;x++)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:'canal',x,y,level:1});
for(let y=2;y<25;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:irrigationFor(s).irrigated.has(`${x},${y}`)||terrain(x,y,s)==='fertile'?'field':'house',x,y,level:3});
for(let y=3;y<25;y+=2)for(let x=3;x<29;x+=2)if(s.buildings.filter(b=>b.type==='granary').length<20&&terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:'granary',x,y,level:1});
syncPestSites(s);for(let i=0;i<10;i++)bringCat(s);
s.population=200;s.capacity=housingOf(s);syncCitizens(s);for(const [i,q]of s.pests.sites.slice(10).entries())assignGuard(s,i,q.key);const samples=[],warnings=[];s.resources.food=100000;for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;}
for(let i=0;i<2700;i++){s.event=null;const a=performance.now();advanceTime(s,4/60);samples.push(performance.now()-a);if(i%20===0){const start=performance.now();foodWarnings(s);warnings.push(performance.now()-start);}}samples.sort((a,b)=>a-b);
warnings.sort((a,b)=>a-b);
console.log(JSON.stringify({population:s.population,buildings:s.buildings.length,canals:s.buildings.filter(b=>b.type==='canal').length,wet:irrigationFor(s).wet.size,cats:s.pests.cats.length,guardPosts:s.citizens.filter(c=>c.guardPost).length,warningsCpu:{calls:warnings.length,medianMs:warnings[Math.floor(warnings.length/2)],p95Ms:warnings[Math.floor(warnings.length*.95)],maxMs:warnings.at(-1)},fullYear4x:{medianMs:samples[1350],p95Ms:samples[2565],maxMs:samples[2699]}}));
