import {isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';

// Two compact rows communicate a managed mixed garden. Spacing is a game-scale
// convention, not a claim that all ancient orchards followed a measured grid.
export function orchardPalms(b,state){
 if(b?.type!=='garden'||!isOperational(b)||!isStrictSumer(state))return [];
 const rotation=((Math.trunc(Number(b.rotation)||0)%4)+4)%4;
 const turn=([x,y])=>rotation===1?[y,-x]:rotation===2?[-x,-y]:rotation===3?[-y,x]:[x,y];
 return [[-.26,-.18],[.26,-.18],[-.26,.18],[.26,.18]].map((point,i)=>{
  const [dx,dy]=turn(point);return {id:`garden-${b.x}-${b.y}-${i}`,x:b.x+dx,y:b.y+dy,managed:true,resource:'dates'};
 });
}
