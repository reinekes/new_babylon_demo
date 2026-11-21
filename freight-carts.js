import {buildingKey,isOperational} from './definitions.js';
import {serviceStation} from './service-court.js';

const depots=new Set(['granary','depot','market']);
export const MIN_CART_LOAD=4;
export const freightCartCapacity=b=>b&&depots.has(b.type)&&isOperational(b)?1:0;
export function availableFreightCarts(s,b){
 if(!freightCartCapacity(b))return 0;
 const key=buildingKey(b);
 return s.citizens?.some(c=>c.freightCart===key)?0:1;
}
export function atFreightCartStand(c,b,port){
 const stand=serviceStation(b,'collect').stand;
 return Math.hypot(c.x-stand.x,c.y-stand.y)<.004||
  !!port&&Math.hypot(c.x-port.x,c.y-port.y)<.004;
}
// Ownership lives on the person. A cart cannot be in two places, and a saved
// mid-trip loan needs no separate count to reconcile with the depot.
export function borrowFreightCart(s,c,b,port){
 if(c.age<16||c.freightCart||!availableFreightCarts(s,b)||!atFreightCartStand(c,b,port))return false;
 c.freightCart=buildingKey(b);return true;
}
export function validateFreightCarts(s,buildings){
 const used=new Set();
 for(const c of s.citizens){
  if(c.phase==='toCollectCart'){
   const order=s.district?.jobs?.find(q=>q.id===c.districtJob);
   if(c.freightCart!==undefined||!freightCartCapacity(buildings.get(order?.target)))return false;
  }
  if(c.freightCart===undefined){if(c.phase==='toReturnCart')return false;continue;}
  if(c.age<16||!freightCartCapacity(buildings.get(c.freightCart))||used.has(c.freightCart))return false;
  if(c.phase==='toReturnCart'&&[...Object.values(c.cargo||{}),...Object.values(c.buildCargo||{})].some(n=>n>0))return false;
  used.add(c.freightCart);
 }
 return true;
}
