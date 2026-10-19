import {river,bridgeSpan} from './world.js';
// Hand-drawn isometric forms use the same earth pigments as the rest of the city.
export function drawHarbor(r,b,state){
 const p=r.point(b.x,b.y),q=r.s,c=r.ctx,side=b.x<river(b.y)?1:-1;
 const line=(a,z,color,w=1)=>r.line(a.map(([x,y])=>[p.x+x*q,p.y+y*q]),color,w*q);
 r.box(p.x,p.y,25*q,12*q,5*q,'#d1b385','#a1845b','#b89a6a');
 // Low mudbrick store and reed canopy, never a modern industrial quay.
 r.box(p.x-8*q,p.y-7*q,12*q,6*q,19*q,'#dec79c','#b4976a','#c5a877');
 for(let i=0;i<4;i++)r.line([[p.x-20*q,p.y-(11+i*4)*q],[p.x-8*q,p.y-(5+i*4)*q],[p.x+4*q,p.y-(11+i*4)*q]],'#aa8a5e',.55*q);
 r.polygon([[p.x-12*q,p.y-19*q],[p.x-6*q,p.y-16*q],[p.x-6*q,p.y-5*q],[p.x-12*q,p.y-8*q]],'#655c43');
 for(const x of [4,22])line([[x,-1],[x,-29]],0,'#8c714b',1.8);
 r.polygon([[p.x-2*q,p.y-31*q],[p.x+15*q,p.y-37*q],[p.x+30*q,p.y-28*q],[p.x+12*q,p.y-21*q]],'#d9c595');
 for(let i=0;i<6;i++)line([[-1+i*3,-30-i],[12+i*3,-22-i]],0,i%2?'#c2ac7b':'#ead8ab',.65);
 // Mooring steps and a narrow reed-covered landing follow the actual bank.
 const edge=r.point(river(b.y)-side*.85,b.y);
 r.polygon([[p.x+side*13*q,p.y+4*q],[edge.x-5*q,edge.y-3*q],[edge.x+6*q,edge.y+3*q],[p.x+side*22*q,p.y+10*q]],'#b39a6e');
 for(let i=0;i<5;i++){const f=i/5,x=p.x+side*17*q+(edge.x-p.x-side*17*q)*f,y=p.y+7*q+(edge.y-p.y-7*q)*f;r.line([[x-4*q,y-2*q],[x+4*q,y+2*q]],'#e0c795',.9*q);}
 for(const [x,y]of [[edge.x-4*q,edge.y],[edge.x+5*q,edge.y+4*q]]){r.line([[x,y+3*q],[x,y-9*q]],'#856a46',2*q);c.strokeStyle='#c8ad79';c.lineWidth=q;c.beginPath();c.ellipse(x,y-5*q,3*q,1.4*q,0,0,7);c.stroke();}
 for(const [x,y]of [[16,3],[23,7]]){c.fillStyle='#b57950';c.beginPath();c.ellipse(p.x+x*q,p.y+y*q-4*q,3*q,4*q,0,0,7);c.fill();r.line([[p.x+(x-2)*q,p.y+(y-7)*q],[p.x+(x+2)*q,p.y+(y-7)*q]],'#edd7a5',q);}
 // A striped shelter, mooring ropes and closed jars read at the ordinary play zoom.
 r.polygon([[p.x-2*q,p.y-31*q],[p.x+15*q,p.y-37*q],[p.x+30*q,p.y-28*q],[p.x+12*q,p.y-21*q]],'#8ea79a');
 for(let i=0;i<5;i++)line([[1+i*5,-32-i*1.6],[14+i*3,-22-i*1.25]],0,'#e8dab2',1.2);
 r.polygon([[p.x-2*q,p.y-31*q],[p.x+12*q,p.y-21*q],[p.x+12*q,p.y-18*q],[p.x-2*q,p.y-28*q]],'#6e8c80');
 line([[-2,-31],[12,-21],[30,-28]],0,'#f0deb7',1.2);
 r.box(p.x-8*q,p.y-26*q,13*q,6.5*q,2*q,'#f0dfb9','#baa17c','#d5bd94');
 line([[-21,-28],[-8,-21.5],[5,-28]],0,'#f9e8c5',1.2);
 for(let i=0;i<3;i++){r.box(p.x+(-20+i*5)*q,p.y+(5+i*1.7)*q,2.7*q,1.35*q,4*q,'#c4b487','#8f825d','#af9e73');line([[-20+i*5,1+i*1.7],[-20+i*5,6+i*1.7]],0,'#e5d6ad',.7);}
 c.strokeStyle='#aa9065';c.lineWidth=.8*q;c.beginPath();c.ellipse(p.x+17*q,p.y+9*q,5*q,2*q,0,0,7);c.ellipse(p.x+17*q,p.y+9*q,3.4*q,1.3*q,0,0,7);c.stroke();
 if((r.lighting?.night||0)>.12){r.box(p.x+22*q,p.y-26*q,1.7*q,q,3*q,'#e8bd71','#9c7949','#d1a25c');r.lights.push({x:p.x+22*q,y:p.y-28*q,size:23*q});}
 r.marketCargo(b,state);
}
export function drawTradeBoat(r,e){
 const q=r.s,p=r.point(e.x,e.y),c=r.ctx,t=r.state?.simTime||0,moving=['arriving','departing'].includes(e.phase),bob=r.reduce?0:Math.sin(t*1.8)*.45*q;
 c.save();c.translate(p.x,p.y+bob);c.rotate(.43);if(e.phase==='departing')c.scale(-1,1);
 // Reflection and a quiet wake, limited to one actual vessel.
 c.fillStyle='#204b4535';c.beginPath();c.ellipse(1*q,5*q,25*q,7*q,0,0,7);c.fill();
 if(moving)for(let i=0;i<3;i++)r.line([[(-24-i*4)*q,(4+i*2)*q],[(-31-i*4)*q,(2+i*2)*q]],'#c3ddd099',.8*q);
 r.polygon([[-29*q,-5*q],[-16*q,5*q],[17*q,6*q],[31*q,-5*q],[22*q,8*q],[9*q,11*q],[-16*q,9*q]],'#65573f');
 r.polygon([[-29*q,-5*q],[-17*q,-11*q],[20*q,-10*q],[31*q,-5*q],[17*q,3*q],[-16*q,2*q]],'#ad8d5d');
 r.polygon([[-22*q,-5*q],[-14*q,-8*q],[17*q,-7*q],[24*q,-5*q],[14*q,0],[-13*q,-1*q]],'#756247');
 for(let i=-18;i<23;i+=5)r.line([[i*q,-7*q],[(i-1)*q,3*q]],'#d3b67f',.7*q);
 for(const [x,y,w,d,h]of [[-8,-3,6,3,7],[4,-3,6,3,8],[14,-4,4,2,5]]){r.box(x*q,y*q,w*q,d*q,h*q,'#c5ab79','#8b714c','#aa8e60');r.line([[x*q,(y-h)*q],[x*q,(y+2)*q]],'#e9d2a2',q);}
 // Bundled timber on deck gives the heavy cargo a recognisable silhouette.
 for(let i=0;i<3;i++)r.line([[-16*q,(-5-i*1.4)*q],[-2*q,(-5-i*1.4)*q]],i%2?'#b8915b':'#9a774b',2*q);
 const folded=r.state?.buildings.some(b=>b.type==='bridge'&&b.construction?.kind!=='new'&&Math.abs(bridgeSpan(b.y).y-e.y)<.65);
 if(!folded){r.line([[-1*q,-4*q],[-1*q,-37*q]],'#846b45',1.5*q);
 r.polygon([[1*q,-36*q],[1*q,-17*q],[18*q,-21*q],[14*q,-34*q]],'#ead9b2');
 r.line([[1*q,-29*q],[15*q,-27*q]],'#c1a87a',.65*q);r.line([[1*q,-22*q],[17*q,-21*q]],'#c1a87a',.65*q);
 }else r.line([[-15*q,-7*q],[15*q,-7*q]],'#d2bd8d',3*q);
 // Boatman with a pole; the local boat crew is not counted as city population.
 const stroke=r.reduce?0:Math.sin(t*2.5)*2;
 r.polygon([[-21*q,-15*q],[-17*q,-15*q],[-15*q,-6*q],[-22*q,-6*q]],'#748f84');
 c.fillStyle='#b68c60';c.beginPath();c.arc(-19*q,-18*q,2*q,0,7);c.fill();r.line([[-21*q,-19*q],[-17*q,-19*q]],'#eee0b9',1.5*q);
 r.line([[-18*q,-11*q],[(-12+stroke)*q,2*q]],'#725b3e',1.1*q);
 c.restore();
 if(!moving){const b=r.state?.buildings.find(b=>`${b.x},${b.y}`===e.market);if(b){const edge=r.point(b.x,b.y);r.line([[p.x-9*q,p.y],[edge.x,edge.y+5*q]],'#d1b987',.7*q);}}
}
