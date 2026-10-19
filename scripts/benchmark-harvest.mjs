import {performance} from 'node:perf_hooks';
import {createGame,advanceTime,terrain} from '../engine.js';
import {syncCitizens} from '../workforce.js';
import {housingOf} from '../definitions.js';
import {irrigationFor} from '../irrigation.js';
const s=createGame();
for(const y of [4,6,10,12,16,20])for(let x=3;x<18;x++)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:'canal',x,y,level:1});
for(let y=2;y<25;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:irrigationFor(s).irrigated.has(`${x},${y}`)||terrain(x,y,s)==='fertile'?'field':'house',x,y,level:3});
s.population=200;s.capacity=housingOf(s);syncCitizens(s);const samples=[];s.resources.food=100000;for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;}
for(let i=0;i<2700;i++){s.event=null;const a=performance.now();advanceTime(s,4/60);samples.push(performance.now()-a);}samples.sort((a,b)=>a-b);
console.log(JSON.stringify({population:s.population,buildings:s.buildings.length,canals:s.buildings.filter(b=>b.type==='canal').length,wet:irrigationFor(s).wet.size,fullYear4x:{medianMs:samples[1350],p95Ms:samples[2565],maxMs:samples[2699]}}));
