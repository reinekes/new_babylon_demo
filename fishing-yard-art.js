// Project the same confirmed landing onto the isometric fallback. A worker
// with an unanswered line can raise the pole, but cannot display a caught fish.
import {actorWorkActivity} from './labor-life.js';
import {schoolPositions} from './game3d/fishing-props.js';

function fish(r,x,y,scale,angle,colour){
 const c=r.ctx;c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=colour;
 c.beginPath();c.ellipse(0,0,3.4*scale,1.28*scale,0,0,Math.PI*2);c.fill();
 r.polygon([[-2.5*scale,0],[-4.5*scale,-1.65*scale],[-4.1*scale,1.65*scale]],colour);
 c.restore();
}
function basket(r,x,y,q){
 const c=r.ctx;
 r.polygon([[x-3.6*q,y-2.4*q],[x+3.6*q,y-2.4*q],[x+2.4*q,y],[x-2.4*q,y]],'#a6824e');
 c.beginPath();c.ellipse(x,y-2.4*q,3.6*q,1.1*q,0,0,Math.PI*2);c.fillStyle='#57452f';c.fill();
 for(const sign of [-1,0,1])r.line([[x+sign*2.2*q,y-1.9*q],[x+sign*1.7*q,y-.4*q]],'#d9b67c',.45*q);
 c.beginPath();c.ellipse(x,y-2.4*q,2.5*q,2.6*q,0,Math.PI,Math.PI*2);c.strokeStyle='#c9a46f';c.lineWidth=.7*q;c.stroke();
}
export function drawFishBasketLoad(r,p,q,cured){
 const x=p.x+2.45*q,y=p.y-3.2*q;
 basket(r,x,y,q);fish(r,x,y-2.5*q,.72*q,.28,cured?'#a87f4e':'#b0bba7');
 r.line([[p.x+1.3*q,p.y-7.1*q],[x-q,y-2.2*q]],'#b38a61',1.13*q);
}
export function drawFishingFrame(r,b){
 if(!(b.fishRack?.enabled||b.fishRack?.batch||b.dryFishLots?.length))return;
 const p=r.point(b.x,b.y),q=r.s,x=p.x-10*q,y=p.y+6*q;
 for(const i of [0,1]){
  const end=x+i*18*q,level=y+i*4*q;
  r.line([[end-2*q,level],[end,level-11*q],[end+2*q,level-1*q]],'#735b38',1.25*q);
 }
 r.line([[x-q,y-11*q],[x+19*q,y-7*q]],'#ad8556',1.6*q);
 if(b.fishRack?.batch)for(let i=0;i<6;i++){const xx=x+(1.7+i*2.8)*q,yy=y-(10-i*.64)*q;
  r.line([[xx,yy],[xx,yy+1.3*q]],'#c7ac7c',.47*q);fish(r,xx,yy+3.3*q,.72*q,-Math.PI/2,'#bfbc93');}
 if(b.dryFishLots?.length)basket(r,x+15*q,y+5*q,1.15*q);
}
export function drawFishingWorker(r,person,p,q){
 const a=actorWorkActivity(r.state,person,[]);
 if(a?.kind!=='fishing'||a.task==='take-rod'||a.stage==='approach')return false;
 const progress=a.progress,landing=a.task==='land-fish',hang=a.task==='hang-fish';
 const target=r.point(a.target.x,a.target.y),aim=target.x<p.x?-1:1;
 const handX=p.x+aim*1.9*q,handY=p.y-6.9*q,basketX=p.x-aim*4.2*q,basketY=p.y+.7*q;
 if(hang){
  const yy=p.y-(4+4*Math.sin(progress*Math.PI*.64))*q;
  r.line([[p.x,p.y-6.8*q],[p.x+aim*.4*q,yy],[p.x+aim*2.7*q,yy]],'#b38a61',1.3*q);
  if(progress<.88)fish(r,p.x+aim*2.7*q,yy+q,.70*q,-1.48,'#b1b3a3');return true;
 }
 const bend=landing?Math.sin(Math.min(1,Math.max(0,(progress-.20)/.55))*Math.PI):0,pull=landing?Math.min(1,Math.max(0,(progress-.25)/.40)):0;
 const tipX=handX+aim*(12-6*pull)*q,tipY=handY-(6+4*pull)*q;
 const c=r.ctx;c.strokeStyle='#8d693d';c.lineWidth=1.05*q;c.beginPath();c.moveTo(handX,handY);c.quadraticCurveTo(handX+aim*6*q,tipY-(2.2+3*bend)*q,tipX,tipY);c.stroke();
 const lower=landing?Math.min(1,Math.max(0,(progress-.66)/.29)):0;
 const endX=target.x*(1-pull)+(handX-aim*2*q)*pull,endY=target.y*(1-pull)+(handY-q)*pull;
 r.line([[tipX,tipY],[endX,endY]],'#c2bba0',.45*q);
 basket(r,basketX,basketY,q);
 if(landing&&a.firstBlessed&&progress<.39){
  schoolPositions(r.reduce?.15:progress,(i,x,h,z,heading)=>{const at=r.point(a.target.x+(x*.49+z*.32)/6,a.target.y+(z*.49-x*.32)/6);fish(r,at.x,at.y,.44*q,heading*.47,i%3?'#899f94':'#bbccc0');});
 }
 if(landing&&progress>.29)fish(r,endX*(1-lower)+basketX*lower,endY*(1-lower)+(basketY-2.4*q)*lower,.83*q,-Math.PI*(.49-.44*lower),'#b9c5af');
 r.line([[p.x,p.y-7.1*q],[handX-aim*q,handY+.6*q],[handX,handY]],'#b38a61',q);return true;
}
