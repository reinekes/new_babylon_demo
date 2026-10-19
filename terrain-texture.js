import {river} from './world.js';
import {seed} from './city-life.js';
// Soil detail is rasterized into the existing terrain cache, never painted per actor/frame.
export function drawGroundTexture(r,s,x,y,type){
 if(type==='water'||type==='void')return;const q=r.s,wet=Math.abs(x-river(y))<3.5&&!s.drought,origin=s.world?.seed||0,noise=k=>seed(x*19+k*7.3+origin,y*23+k*3.1);
 const line=(points,color,width=.65)=>r.line(points.map(([a,b])=>r.point(a,b)),color,width*q);
 const patch=[];for(let k=0;k<7;k++){const a=k*Math.PI*2/7,rad=.14+noise(k)*.14;patch.push(r.point(x+Math.cos(a)*rad,y+Math.sin(a)*rad));}r.polygon(patch,wet?'#85985b22':'#af976b18');
 for(let k=0;k<9;k++){const px=x+(noise(k+10)-.5)*.86,py=y+(noise(k+30)-.5)*.86;line([[px,py],[px+.025+noise(k+50)*.065,py-.015]],k%3===0?'#eee0b03d':wet?'#71895329':'#a28b5f30',k%3===0?.8:.55);}
 if(wet){for(let k=0;k<4;k++){const px=x+(noise(k+70)-.5)*.8,py=y+(noise(k+90)-.5)*.8,p=r.point(px,py);r.line([[p.x-1.6*q,p.y-.2*q],[p.x-.5*q,p.y-3.4*q],[p.x+.4*q,p.y-.4*q],[p.x+2*q,p.y-2.5*q]],s.season===3?'#8c95634a':'#74894e59',.65*q);}}
 else if(noise(110)>.55){const px=x+(noise(111)-.5)*.35,py=y+(noise(112)-.5)*.35;line([[px-.23,py+.08],[px-.05,py],[px+.12,py+.04],[px+.3,py-.03]],'#9e855b30');line([[px-.05,py],[px-.08,py-.16]],'#9e855b26');}
}
