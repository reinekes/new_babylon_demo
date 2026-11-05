import {PLOUGH_HANDLE_FORWARD,PLOUGH_HANDLE_HEIGHT,PLOUGH_HANDLE_SPREAD,PLOUGH_OX_OFFSET,PLOUGH_YOKE_HEIGHT} from './plough-team.js';

export function drawPloughTeam(r,team){
 const c=r.ctx,q=r.s;
 const dx=Math.sin(team.yaw),dy=Math.cos(team.yaw);
 const at=(side,forward,height=0)=>{
  const p=r.point(team.x+(side*dy+forward*dx)/6,team.y+(-side*dx+forward*dy)/6);
  return [p.x,p.y-height*9*q];
 };
 const line=(from,to,color,width)=>r.line([from,to],color,width*q);
 const oval=(point,w,h,color)=>{
  c.fillStyle=color;c.beginPath();
  c.ellipse(...point,w*q,h*q,0,0,Math.PI*2);c.fill();
 };
 c.save();
 line(at(0,1.02,PLOUGH_YOKE_HEIGHT),at(0,-1.33,.13),'#715038',1.7);
 line(at(0,-1.39,.13),at(0,-.92,.035),'#6a4830',2.6);
 for(const side of [-PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_SPREAD])line(at(0,-1.3,.1),at(side,PLOUGH_HANDLE_FORWARD,PLOUGH_HANDLE_HEIGHT),'#795537',1.3);
 const sides=[-PLOUGH_OX_OFFSET,PLOUGH_OX_OFFSET].sort((a,b)=>at(a,.55)[1]-at(b,.55)[1]);
 for(const [index,side] of sides.entries()){
  const body=at(side,.51,.63),head=at(side,1.35,.79),tail=at(side,-.24,.54);
  const gait=Math.sin(team.progress*13+index*.6)*.15;
  oval(at(side,.55),5.9,2.6,'#48372334');
  for(const leg of [-.42,.40])for(const offset of [-.18,.18]){
   line(at(side+offset,.50+leg,.52),at(side+offset,.50+leg+(offset<0?gait:-gait)),'#60452f',1.05);
  }
  const other=at(side,.95,.63);
  c.fillStyle=index?'#a6774f':'#8e6243';c.beginPath();
  c.ellipse(...body,6.5*q,3.15*q,Math.atan2(other[1]-body[1],other[0]-body[0]),0,Math.PI*2);c.fill();
  line(tail,at(side,-.47,.30),'#6b4c36',.9);
  oval(head,2.6,2.1,index?'#9c704b':'#80573d');
  for(const horn of [-.24,.24])line(head,at(side+horn,1.40,1.01),'#ead5ad',.85);
 }
 line(at(-1.01,1.02,PLOUGH_YOKE_HEIGHT),at(1.01,1.02,PLOUGH_YOKE_HEIGHT),'#754e31',1.8);
 for(const side of sides)line(at(side-.18,1.02,PLOUGH_YOKE_HEIGHT),at(side+.18,1.04,.71),'#ddbd78',.85);
 c.restore();
}
