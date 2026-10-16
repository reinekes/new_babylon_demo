import {WIDTH,HEIGHT,terrain,isShore} from './world.js';
import {seed} from './city-life.js';
export function weatherAt(s){
 const time=Math.max(0,s.simTime||0),worldSeed=s.world?.seed||73129;
 const choose=(i,start)=>{const season=Math.floor(start/45)%4,n=seed(worldSeed+i*17,season+13);return n<.36?'sunny':n<.64?'cloudy':n<([.82,.73,.89,.84][season])?'rain':'wind';};
 let start=0,index=0,duration=30+Math.floor(seed(worldSeed,0)*31),type=choose(0,0),previous=type;
 while(start+duration<=time){start+=duration;index++;duration=30+Math.floor(seed(worldSeed,index)*31);previous=type;type=choose(index,start);if(type===previous){const types=['sunny','cloudy','rain','wind'];type=types[(types.indexOf(type)+1+Math.floor(seed(index,worldSeed)*3))%4];}}

 const override=t=>s.rain>0||s.buffs?.rain?'rain':s.drought>0&&t==='rain'?'cloudy':t;
 return {type:override(type),previous:override(previous),blend:Math.min(1,(time-start)/3),start,duration,index};
}
export function vegetationFor(s,network){
 const result=[],weather=weatherAt(s),vigor=s.drought>0?.25:weather.type==='rain'?1:(s.season===1?.65:.85);
 for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
  if(terrain(x,y,s)==='water'||s.buildings.some(b=>b.x===x&&b.y===y))continue;
  const n=seed(x+731,y+29);if(n>.24)continue;
  const px=x+(seed(x,y)-.5)*.36,py=y+(seed(y,x+2)-.5)*.36;
  if(network?.edges?.some(([a,b])=>{const t=Math.max(0,Math.min(1,((px-a.x)*(b.x-a.x)+(py-a.y)*(b.y-a.y))/((b.x-a.x)**2+(b.y-a.y)**2)));return Math.hypot(px-a.x-(b.x-a.x)*t,py-a.y-(b.y-a.y)*t)<.22;}))continue;
  result.push({id:y*WIDTH+x,kind:isShore(s,x,y)?'reed':n<.035?'palm':n<.1?'shrub':'grass',x:px,y:py,vigor,growth:.65+.35*(.5-.5*Math.cos(Math.PI*2*((s.simTime||0)/360+seed(x,y))))});
 }
 return result;
}
