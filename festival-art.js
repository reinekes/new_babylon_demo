export function drawFestivalCourt(r,s,view){
 if(!view||!Number.isFinite(view.x)||!Number.isFinite(view.y))return;
 const q=r.s,p=r.point(view.court?.x??view.x+.25,view.court?.y??view.y+.35),c=r.ctx,t=(s.simTime||0)+(view.elapsed||0);
 const food=s.festival?.delivered.food||0,beer=s.festival?.delivered.beer||0;if(!food&&!beer)return;
 r.polygon([[p.x-19*q,p.y],[p.x,p.y-9*q],[p.x+19*q,p.y],[p.x,p.y+9*q]],'#b1936c');
 for(let i=-12;i<=12;i+=4)r.line([[p.x+i*q,p.y+(15-Math.abs(i))*.45*q],[p.x+i*q,p.y-(15-Math.abs(i))*.45*q]],'#ddc79d',.55*q);
 r.box(p.x,p.y,11*q,5.5*q,3*q,'#d2b184','#92714e','#ba9466');
 for(let k=0;k<Math.min(4,Math.ceil(food/3));k++){const x=p.x+(-7+k*4)*q,y=p.y-3*q;c.fillStyle='#e3c68c';c.beginPath();c.ellipse(x,y,2.5*q,1.3*q,0,0,7);c.fill();c.fillStyle='#b39154';c.beginPath();c.ellipse(x,y-.6*q,1.5*q,.7*q,0,0,7);c.fill();}
 for(let k=0;k<Math.min(3,Math.ceil(beer/2));k++){const x=p.x+(9+k*4)*q,y=p.y+(k%2)*3*q;c.fillStyle='#b47b53';c.beginPath();c.ellipse(x,y-3*q,2*q,3*q,0,0,7);c.fill();r.line([[x-1.6*q,y-5.5*q],[x+1.6*q,y-5.5*q]],'#ebd7ac',.8*q);}
 if(view.stage==='celebrating')for(const side of [-1,1]){const x=p.x+side*21*q,y=p.y+4*q;r.box(x,y,2.5*q,1.3*q,6*q,'#a78457','#725d43','#927149');r.polygon([[x-1.5*q,y-6*q],[x,y-(10+(r.reduce?0:Math.sin(t*5)*.5))*q],[x+1.5*q,y-6*q]],'#f3c271');r.lights.push({x,y:y-8*q,size:27*q});}
}
