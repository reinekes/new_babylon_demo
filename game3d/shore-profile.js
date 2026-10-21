import {river} from '../world.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';

// The actual main-view sheet, including its row interpolation. Keep clipping
// aligned with the rendered surface instead of a separate simulation cell margin.
export const RIVER_HALF_WIDTH=1.145;
export const RIVER_STEPS_PER_TILE=10;
export function renderedRiverCenter(y){
 const start=-.5+Math.floor((y+.5)*RIVER_STEPS_PER_TILE)/RIVER_STEPS_PER_TILE,t=(y-start)*RIVER_STEPS_PER_TILE;
 return river(start)*(1-t)+river(start+1/RIVER_STEPS_PER_TILE)*t;
}
export function renderedShoreDistance(x,y,s,contours=lakeContours(s)){
 return Math.min(Math.abs(x-renderedRiverCenter(y))-RIVER_HALF_WIDTH,lakeDistance(x,y,s,contours));
}
export {visualSurfaceElevation};
