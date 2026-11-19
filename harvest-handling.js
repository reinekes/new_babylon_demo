// Metres from the street-side corner. The same layout locates the rack/table
// in the building and the worker's hands in the city, including rotated yards.
export function harvestApron(cx,cy,port,id=0){
 const length=Math.hypot(cx-port.x,cy-port.y)||1,dx=(cx-port.x)/length,dy=(cy-port.y)/length;
 const lane=(id%2?-.32:.32)/6;
 const point=(along,side)=>({x:port.x+dx*along/6+dy*side,y:port.y+dy*along/6-dx*side});
 return {dx,dy,stand:point(.88,lane),surface:point(1.36,lane),middle:point(1.36,0)};
}
export const dressingSeconds=2.8;
export function dressingClaim(s,c){
 if(!c.cargo?.hides||c.phase!=='toWorkshop'&&c.phase!=='blocked')return null;
 return s.gathering?.kills.find(k=>k.hauler===c.id)||null;
}
export function carcassPosition(c,kill){
 const next=c.route?.[c.routeIndex],previous=c.route?.[Math.min(c.route.length-1,c.routeIndex)-1];
 let dx=(next?.x??c.x)-(previous?.x??c.x),dy=(next?.y??c.y)-(previous?.y??c.y);
 if(Math.hypot(dx,dy)<.001){dx=c.x-kill.x;dy=c.y-kill.y;}
 const length=Math.hypot(dx,dy)||1;
 // The animal slides behind its hauler; the leading end and hands share a rope.
 const trailing=Math.min(.20,Math.hypot(c.x-kill.x,c.y-kill.y));
 return {x:c.x-dx/length*trailing,y:c.y-dy/length*trailing,yaw:Math.atan2(dx,dy)};
}
