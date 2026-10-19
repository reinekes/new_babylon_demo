import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const root=process.argv[2]?pathToFileURL(resolve(process.argv[2])+'/'):new URL('../',import.meta.url);
const {createGame}=await import(new URL('engine.js',root));
const {Renderer}=await import(new URL('renderer.js',root));
const state=createGame(),renderer=Object.create(Renderer.prototype);let polygons=0;
Object.assign(renderer,{s:1,reduce:false,ctx:{save(){},restore(){}},inView:()=>true,point:(x,y)=>({x,y}),polygon(){polygons++;},line(){}});
for(const type of ['house','shrine','field','clay','reed']){
 renderer.placementLayer(state,type);const samples=[];polygons=0;
 for(let i=0;i<100;i++){const start=performance.now();renderer.placementLayer(state,type);samples.push(performance.now()-start);}
 samples.sort((a,b)=>a-b);console.log(JSON.stringify({type,tilesPerFrame:polygons/100,cpuMedianMs:+samples[50].toFixed(4),cpuP95Ms:+samples[95].toFixed(4)}));
}
