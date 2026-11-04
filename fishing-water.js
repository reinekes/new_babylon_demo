import {worldWidth,worldHeight,isDryPoint,terrain} from './world.js';

// Productive water is independent of the small decorative fish population.
// Only an actual work trip yields goods; this cache holds no stock or rewards.
const caches=new WeakMap();
const enabled=s=>!!s.ecology&&!s.ecology.legacyFauna;
const water=(s,x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<worldWidth(s)&&y<worldHeight(s)&&!isDryPoint(s,x,y)&&terrain(Math.round(x),Math.round(y),s)==='water';
export function fishingWaterTargets(s,origin){
 if(!enabled(s)||!Number.isFinite(origin?.x)||!Number.isFinite(origin?.y))return [];
 const lakes=s.world?.lakes,river=s.world?.river,cellCount=(lakes||[]).reduce((n,l)=>n+l.cells.length,0);let cache=caches.get(s);
 if(!cache||cache.world!==s.world||cache.lakes!==lakes||cache.river!==river||cache.cellCount!==cellCount){cache={world:s.world,lakes,river,cellCount,origins:new Map()};caches.set(s,cache);}
 const key=`${origin.x},${origin.y}`;if(cache.origins.has(key))return cache.origins.get(key);
 const targets=[];for(let iy=Math.ceil((origin.y-3)*4);iy<=Math.floor((origin.y+3)*4);iy++)for(let ix=Math.ceil((origin.x-3)*4);ix<=Math.floor((origin.x+3)*4);ix++){
  const x=ix/4,y=iy/4;if(Math.hypot(x-origin.x,y-origin.y)>=3||!water(s,x,y))continue;
  targets.push({id:`fish:water:${ix}:${iy}`,kind:'fish',x,y});
 }
 targets.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y)||a.y-b.y||a.x-b.x);
 const result=targets.slice(0,128);if(cache.origins.size>=256)cache.origins.delete(cache.origins.keys().next().value);cache.origins.set(key,result);return result;
}
export function validFishingWaterTarget(s,target,origin,stand){
 if(!enabled(s)||target?.kind!=='fish'||typeof target.id!=='string'||!origin||!stand)return false;
 const m=/^fish:water:(0|[1-9]\d*):(0|[1-9]\d*)$/.exec(target.id);
 return !!m&&target.x===Number(m[1])/4&&target.y===Number(m[2])/4&&water(s,target.x,target.y)&&Math.hypot(target.x-origin.x,target.y-origin.y)<3&&Math.hypot(target.x-stand.x,target.y-stand.y)<1.7;
}
