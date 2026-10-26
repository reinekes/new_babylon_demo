import {buildingKey} from '../definitions.js';
import {houseLightCount} from '../households.js';

export const HOUSE_LIGHT_LIMIT=6;

// Only presentation data: household identities, buildings and simulation time
// remain untouched. Count residents once before choosing the nearest homes.
function nearestOccupiedHomes(state,focus,limit){
 const occupancy=new Map();for(const c of state.citizens||[]){const home=c.home;occupancy.set(home,(occupancy.get(home)||0)+1);}
 const x=Number.isFinite(focus?.x)?focus.x:0,z=Number.isFinite(focus?.z)?focus.z:0,homes=[];
 for(const b of state.buildings||[]){
  if(b.type!=='house'||b.construction?.kind==='new')continue;
  const key=buildingKey(b),count=houseLightCount(b,occupancy.get(key)||0);if(!count)continue;
  const px=b.x*6,pz=b.y*6+1.2;homes.push({key,count,x:px,z:pz,distance:(px-x)**2+(pz-z)**2});
 }
 homes.sort((a,b)=>a.distance-b.distance||(a.key<b.key?-1:a.key>b.key?1:0));return homes.slice(0,limit);
}

export function createHouseLights(B,scene,{limit=HOUSE_LIGHT_LIMIT,lamps=new Map()}={}){
 const pool=[];let disposed=false;
 function disable(lamp){
  // Babylon Light.setEnabled calls _resyncMeshes even if its value is unchanged.
  // Guard transitions so daylight never adds a repeated full-scene pass.
  if(lamp.isEnabled())lamp.setEnabled(false);if(lamp.intensity!==0)lamp.intensity=0;
 }
 function update(state,night,focus){
  if(disposed)return;
  lamps.clear();if(!(night>0)){for(const lamp of pool)disable(lamp);return;}
  const homes=nearestOccupiedHomes(state,focus,limit),used=new Set(),assigned=new Map();
  // Keep each retained home on its existing light. Camera pans only move the
  // free slots; the pool never grows beyond the original six-light budget.
  for(const home of homes){const lamp=pool.find(l=>l.metadata?.houseKey===home.key);if(lamp){assigned.set(home.key,lamp);used.add(lamp);}}
  for(const home of homes){
   let lamp=assigned.get(home.key)||pool.find(l=>!used.has(l));
   if(!lamp){lamp=new B.PointLight(`occupied-house-pool-${pool.length}`,new B.Vector3(home.x,1.5,home.z),scene);lamp.diffuse=new B.Color3(1,.60,.22);lamp.range=7;pool.push(lamp);}
   used.add(lamp);lamp.metadata={houseKey:home.key};
   if(lamp.position.x!==home.x||lamp.position.y!==1.5||lamp.position.z!==home.z)lamp.position.set(home.x,1.5,home.z);
   const intensity=night*home.count*3.5;if(lamp.intensity!==intensity)lamp.intensity=intensity;if(!lamp.isEnabled())lamp.setEnabled(true);lamps.set(home.key,lamp);
  }
  for(const lamp of pool)if(!used.has(lamp))disable(lamp);
 }
 function dispose(){if(disposed)return;disposed=true;for(const lamp of pool)lamp.dispose();pool.length=0;lamps.clear();}
 return {update,dispose,lamps};
}
