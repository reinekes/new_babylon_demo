import {HEIGHT,river} from '../world.js';

// The main bed, terrain and water share these rows and bank vertices. A dense
// cross-section matters more than excess rows following the very gentle curve.
export const RIVER_HALF_WIDTH=1.145;
export const RIVER_STEPS_PER_TILE=4;
export const SCENERY_MARGIN=36;
export const RIVER_CROSS_SECTION=Array.from({length:25},(_,i)=>(i/24*2-1)*RIVER_HALF_WIDTH);
export const RIVER_BANK_SECTION=[-1.65,-1.4,-1.25,...RIVER_CROSS_SECTION,1.25,1.4,1.65];
export function riverRows(scenery=false){
 const main=Array.from({length:HEIGHT*RIVER_STEPS_PER_TILE+1},(_,i)=>-.5+i/RIVER_STEPS_PER_TILE);
 if(!scenery)return main;
 const distances=[];for(let d=.25;d<=SCENERY_MARGIN;d+=d<2?.25:d<8?.5:2)distances.push(d);
 if(distances.at(-1)!==SCENERY_MARGIN)distances.push(SCENERY_MARGIN);
 return [...distances.map(d=>-.5-d).reverse(),...main,...distances.map(d=>HEIGHT-.5+d)];
}
export function riverProfileCenter(y){
 if(y<-.5||y>HEIGHT-.5){const rows=riverRows(true);let lo=0,hi=rows.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(rows[mid]<=y)lo=mid;else hi=mid;}const a=rows[lo],b=rows[hi],t=(y-a)/(b-a);return river(a)*(1-t)+river(b)*t;}
 const start=-.5+Math.floor((y+.5)*RIVER_STEPS_PER_TILE)/RIVER_STEPS_PER_TILE,t=(y-start)*RIVER_STEPS_PER_TILE;
 return river(start)*(1-t)+river(start+1/RIVER_STEPS_PER_TILE)*t;
}
