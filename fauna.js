import {safeLoop,loopMotion} from './local-motion.js';
import {WIDTH,HEIGHT,terrain,isShore,isDryPoint} from './world.js';
import {seed} from './city-life.js';
const habitats=new WeakMap();
function habitatsFor(s){
 const worldSeed=s.world?.seed||73129;
 const signature=JSON.stringify([worldSeed,s.buildings.map(b=>[b.type,b.x,b.y]),s.world?.deposits,s.world?.lakes]);
 const cached=habitats.get(s);if(cached?.signature===signature)return cached.places;
 const places=[];
 const free=(x,y)=>isDryPoint(s,x,y)&&!['water','void'].includes(terrain(x,y,s))&&!s.buildings.some(b=>b.x===x&&b.y===y);
 const candidates=[];for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)if(free(x,y))candidates.push({x,y});
 const wildlife=s.world?.deposits?.filter(d=>d.kind==='wildlife')||[],homes=s.buildings.filter(b=>b.type==='house');
 for(const [kind,count,predicate]of [['goat',4,p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<5)],['gazelle',5,p=>wildlife.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<4)],['bird',5,p=>isShore(s,p.x,p.y)],['jackal',3,p=>p.x<3||p.x>WIDTH-4]]){
  const choices=candidates.filter(predicate).sort((a,b)=>seed(a.x+worldSeed,a.y+kind.length*13)-seed(b.x+worldSeed,b.y+kind.length*13));
  for(let i=0;i<Math.min(count,choices.length);i++)places.push({id:`${kind}-${i}`,kind,...choices[i],route:safeLoop(s,choices[i],kind==='bird'?.4:.7,true)});
 }
 habitats.set(s,{signature,places});return places;
}
export function animalsFor(s){
 const time=s.simTime||0,result=[];
 for(const {id,kind,route,...p} of habitatsFor(s)){const phase=time+seed(p.x,p.y)*17,motion=loopMotion(route,phase,kind==='bird'?.65:.32,kind==='jackal'?2:3.5);result.push({id,kind,...motion,step:phase*5,behavior:motion.walking?'walking':kind==='bird'?'perched':'grazing'});}
 return result;
}
