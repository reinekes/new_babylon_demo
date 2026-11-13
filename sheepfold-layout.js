import {footprintSize} from './footprints.js';
import {isDryPoint} from './world.js';

// Metres from the pen centre, with side zero at local +X.
export function sheepfoldLayout(building){
 const large=footprintSize(building)===2;
 return large?{center:3,halfWidth:5.5,gateHalfWidth:2.42,spacing:1.68}:{center:0,halfWidth:2.5,gateHalfWidth:1.56,spacing:1.20};
}

export function sheepfoldWorldPoint(building,side,x,z){
 const {center}=sheepfoldLayout(building),angle=((building.rotation||0)+side)*Math.PI/2;
 const c=Math.cos(angle),s=Math.sin(angle);
 return {x:building.x+(center+x*c+z*s)/6,y:building.y+(center-x*s+z*c)/6};
}

export function sheepfoldGateSide(building,state){
 if(!state?.world)return 0;
 const {halfWidth,gateHalfWidth,spacing}=sheepfoldLayout(building);
 const nearby=(state.buildings||[]).filter(site=>(site.x!==building.x||site.y!==building.y)&&Math.abs(site.x-building.x)<=3&&Math.abs(site.y-building.y)<=3);
 const clear=p=>isDryPoint(state,p.x,p.y)&&!nearby.some(site=>
  p.x>site.x-.54&&p.x<site.x+footprintSize(site)-.46&&
  p.y>site.y-.54&&p.y<site.y+footprintSize(site)-.46);
 for(const side of [0,1,3,2]){
  const reach=halfWidth+2*spacing+.52;
  if([halfWidth-.25,halfWidth+.25,reach].every(x=>[-gateHalfWidth+.32,0,gateHalfWidth-.32].every(z=>clear(sheepfoldWorldPoint(building,side,x,z)))))return side;
 }
 return 0;
}
