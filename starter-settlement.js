import {MATERIALS,buildingKey} from './definitions.js';
// A founding-only dwelling flag, not a buildable catalogue type. Existing cities
// never pass through this initializer during migration.
export const STARTER_HOMES=Object.freeze([{x:6,y:7},{x:10,y:6},{x:6,y:11},{x:10,y:11},{x:3,y:9}]);
export function starterHomes(resources){return STARTER_HOMES.map((p,i)=>({type:'house',...p,level:1,starterHut:true,stock:Object.fromEntries(MATERIALS.map(k=>[k,(resources[k]||0)/5]))}));}
export function distributeFounders(s){for(const [i,c]of s.citizens.entries()){const b=s.buildings[i%s.buildings.length];c.home=buildingKey(b);c.x=b.x;c.y=b.y;c.route=[];c.routeIndex=0;c.phase='home';c.walking=false;}}
// Keep all five founding homes inside the initial map view. Established cities
// retain their existing camera home; loading a save never recentres it here.
export function foundingCameraTarget(s){const homes=s?.buildings;if(!homes?.length||homes.length>5||!homes.every(b=>b.type==='house'&&b.starterHut&&b.level===1))return null;return {x:homes.reduce((n,b)=>n+b.x,0)/homes.length,y:homes.reduce((n,b)=>n+b.y,0)/homes.length,radius:78};}
