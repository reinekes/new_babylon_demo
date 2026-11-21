import {footprintSize} from './footprints.js';

// Local +Z is the direction the porter pushes; the cart is ahead of both hands.
export function cartHeading(c){
 const next=c.route?.[c.routeIndex],previous=c.route?.[c.routeIndex-1];
 if(next&&(next.x!==c.x||next.y!==c.y))return Math.atan2(next.x-c.x,next.y-c.y);
 return previous?Math.atan2(c.x-previous.x,c.y-previous.y):0;
}
export function cartParking(b){
 const n=footprintSize(b),angle=(b.rotation||0)*Math.PI/2,mid=(n-1)*3;
 const dx=-n*3+.52,dz=n*3-.26;
 return {x:b.x+(mid+dx*Math.cos(angle)+dz*Math.sin(angle))/6,y:b.y+(mid-dx*Math.sin(angle)+dz*Math.cos(angle))/6,angle:angle+Math.PI/2};
}

export function drawFreightCart(r,x,y,angle,resource,bridge=0){
 const ctx=r.ctx,co=Math.cos(angle),si=Math.sin(angle);
 const at=(l,h,z)=>r.point(x+(l*co+z*si)/6,y+(-l*si+z*co)/6,bridge+h*9);
 function polygon(points,fill){r.polygon(points.map(p=>at(...p)),fill);}
 function wheel(l){
  const round=[];for(let i=0;i<16;i++){const t=i*Math.PI/8;round.push([l,.40+Math.sin(t)*.40,1.23+Math.cos(t)*.40]);}
  polygon(round,'#785332');const hub=at(l,.40,1.23);ctx.fillStyle='#b39064';ctx.beginPath();ctx.arc(hub.x,hub.y,Math.max(.55,r.s*.84),0,Math.PI*2);ctx.fill();
 }
 const near=co-si>=0?.493:-.493;
 wheel(-near);
 for(const side of [-1,1]){
  const a=at(side*.255,.84,.28),b=at(side*.34,.51,1.31);r.line([[a.x,a.y],[b.x,b.y]],'#785b3c',r.s*.9);
 }
 polygon([[-.4,.59,.68],[.4,.59,.68],[.4,.59,1.78],[-.4,.59,1.78]],'#ac8a5c');
 if(resource){const p=at(0,.66,1.23);r.box(p.x,p.y,2.7*r.s,1.6*r.s,2.7*r.s,['brick','clay','firedBrick'].includes(resource)?'#b47b50':resource==='stone'?'#aaa797':'#b8986f','#937453','#b09a78');}
 polygon([[near*.8,.61,.70],[near*.8,.82,.70],[near*.8,.82,1.77],[near*.8,.61,1.77]],'#997447');
 wheel(near);
}
