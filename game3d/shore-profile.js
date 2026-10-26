import {RIVER_HALF_WIDTH,RIVER_STEPS_PER_TILE,riverProfileCenter} from '../district3d/river-profile.js';
import {lakeContours,lakeDistance,visualSurfaceElevation} from './lake-shore.js';

// The actual main-view sheet, including its row interpolation. Keep clipping
// aligned with the rendered surface instead of a separate simulation cell margin.
export {RIVER_HALF_WIDTH,RIVER_STEPS_PER_TILE};
export const renderedRiverCenter=riverProfileCenter;
export function renderedShoreDistance(x,y,s,contours=lakeContours(s)){
 return Math.min(Math.abs(x-renderedRiverCenter(y))-RIVER_HALF_WIDTH,lakeDistance(x,y,s,contours));
}
export {visualSurfaceElevation};
