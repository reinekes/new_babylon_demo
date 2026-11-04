export function drawCatDiscoveryGround(r,v){
 const c=r.ctx,q=r.s;c.save();c.fillStyle='#715a428c';
 for(const p of v.tracks){const a=r.point(p.x,p.y);c.save();c.translate(a.x,a.y);c.rotate(p.angle);for(const [x,y,rx,ry]of [[0,0,1,.65],[-1.1,-1.2,.4,.35],[-.35,-1.55,.4,.35],[.45,-1.5,.4,.35],[1.15,-1.05,.4,.35]]){c.beginPath();c.ellipse(x*q,y*q,rx*q,ry*q,0,0,Math.PI*2);c.fill();}c.restore();}c.restore();
}
export function drawCatOffering(r,v){
 const c=r.ctx,p=r.point(v.x,v.y),q=r.s;c.save();c.fillStyle='#51453250';c.beginPath();c.ellipse(p.x,p.y+q,4*q,1.7*q,0,0,Math.PI*2);c.fill();
 c.fillStyle='#a87954';c.beginPath();c.ellipse(p.x,p.y,3.5*q,2.1*q,0,0,Math.PI*2);c.fill();c.strokeStyle='#d1a171';c.lineWidth=.6*q;c.stroke();
 c.fillStyle=v.bowl==='water'?'#617d76':'#866049';c.beginPath();c.ellipse(p.x,p.y-.4*q,2.6*q,1.2*q,0,0,Math.PI*2);c.fill();
 if(v.eyes){const eye=r.point(v.x+.048,v.y-.046,3.5);c.fillStyle='#d1bc7a';for(const dx of [-1.1,1.1]){c.beginPath();c.ellipse(eye.x+dx*q,eye.y,.5*q,.65*q,0,0,Math.PI*2);c.fill();}}
 c.restore();
}
