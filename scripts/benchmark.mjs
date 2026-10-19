import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/'):new URL('../',import.meta.url);
const {createGame,advanceTime}=await import(new URL('engine.js',root));
const {Renderer}=await import(new URL('renderer.js',root));
const {terrain}=await import(new URL('world.js',root));
for(const large of [false,true]){
const s=createGame();if(large){for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,s)!=='water'&&!s.buildings.some(b=>b.x===x&&b.y===y))s.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});s.population=200;}const gradient={addColorStop(){}};const ctx=new Proxy({}, {get(t,k){if(k==='createRadialGradient'||k==='createLinearGradient')return()=>gradient;return t[k]??(()=>{});},set(t,k,v){t[k]=v;return true;}});
const r=Object.create(Renderer.prototype);Object.assign(r,{ctx,canvas:{getBoundingClientRect:()=>({left:0,top:0})},w:1000,h:700,zoom:1.45,pan:{x:0,y:0},ambient:0,visualLast:null,lightMode:'auto',reduce:false,lights:[],effects:[],hover:null});
function measure(fn){for(let i=0;i<10;i++)fn(i);const samples=[];for(let i=0;i<100;i++){const a=performance.now();fn(i);samples.push(performance.now()-a);}samples.sort((a,b)=>a-b);return {medianMs:+samples[50].toFixed(3),p95Ms:+samples[95].toFixed(3)};}
const draw=measure(i=>r.draw(s,null,i*16.67));const simulation=measure(()=>advanceTime(s,.016));
console.log(JSON.stringify({scenario:large?'stress':'start',buildings:s.buildings.length,population:s.population,drawCpuWithoutRaster:draw,simulation}));
}
