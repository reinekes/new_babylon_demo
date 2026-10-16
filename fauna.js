import {WIDTH,HEIGHT,terrain,isShore,isDryPoint} from './world.js';
import {seed} from './city-life.js';
export function animalsFor(s){
 const result=[],time=s.simTime||0,worldSeed=s.world?.seed||73129;
 const free=(x,y)=>isDryPoint(s,x,y)&&!['water','void'].includes(terrain(x,y,s))&&!s.buildings.some(b=>b.x===x&&b.y===y);
 const candidates=[];for(let y=1;y<HEIGHT-1;y++)for(let x=1;x<WIDTH-1;x++)if(free(x,y))candidates.push({x,y});
 const wildlife=s.world?.deposits?.filter(d=>d.kind==='wildlife')||[],homes=s.buildings.filter(b=>b.type==='house');
 for(const [kind,count,predicate]of [['goat',4,p=>homes.some(h=>Math.hypot(h.x-p.x,h.y-p.y)<5)],['gazelle',5,p=>wildlife.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<4)],['bird',5,p=>isShore(s,p.x,p.y)],['jackal',3,p=>p.x<3||p.x>WIDTH-4]]){
  const choices=candidates.filter(predicate).sort((a,b)=>seed(a.x+worldSeed,a.y+kind.length*13)-seed(b.x+worldSeed,b.y+kind.length*13));
  for(let i=0;i<Math.min(count,choices.length);i++){const p=choices[i],phase=time*(kind==='bird'?.8:.35)+seed(p.x,p.y)*6.28;const dx=Math.sin(phase)*.16,dy=Math.cos(phase*.7)*.12,dry=isDryPoint(s,p.x+dx,p.y+dy);result.push({id:`${kind}-${i}`,kind,x:p.x+(dry?dx:0),y:p.y+(dry?dy:0),heading:Math.cos(phase)>=0?1:-1,step:phase});}
 }
 return result;
}
