import {generateStreets} from './city-life.js';
import {terrain,onBridge,isDryPoint} from './world.js';
import {createOrder,nextOrder} from './construction.js';
export const roadKey=(a,b)=>`road:${[a.key||`${a.x},${a.y}`,b.key||`${b.x},${b.y}`].sort().join('|')}`;
export function ensureRoads(s,network){
 s.roads??=[];const net=network||generateStreets([...s.buildings,...s.roadAnchors||[]],s);
 for(const [a,b]of net.edges){if(onBridge(s.buildings,(a.x+b.x)/2,(a.y+b.y)/2)||[.25,.5,.75].some(t=>!isDryPoint(s,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)))continue;const id=roadKey(a,b);if(!s.roads.some(r=>r.id===id))s.roads.push({type:'road',id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,a:{x:a.x,y:a.y,key:a.key},b:{x:b.x,y:b.y,key:b.key},level:1});}
 return s.roads;
}
export function roadAt(s,x,y){return ensureRoads(s).map(r=>({r,d:Math.hypot(r.x-x,r.y-y)})).filter(v=>v.d<.8).sort((a,b)=>a.d-b.d)[0]?.r;}
export const roadUpgradeCost=r=>r.level===1?{clay:3,reed:1}:{clay:6,reed:2,stone:2};
export function upgradeRoad(s,roadOrId){const r=typeof roadOrId==='string'?ensureRoads(s).find(r=>r.id===roadOrId):roadOrId;let reason=s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':!r||!ensureRoads(s).includes(r)?'Выбери существующую дорогу':r.construction?'Улучшение уже идёт':r.level>=3?'Достигнут третий уровень':'';if(reason)return {ok:false,reason};const cost=roadUpgradeCost(r);if(Object.entries(cost).some(([k,n])=>(s.resources[k]||0)<n))return {ok:false,reason:'Не хватает материалов'};for(const [k,n]of Object.entries(cost))s.resources[k]-=n;r.construction={...createOrder(cost,r.level+1,'upgrade'),order:nextOrder(s)};return {ok:true};}
export function roadSpeed(s,a,b){const r=(s.roads||[]).find(r=>{const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y;return Math.abs((a.x-r.a.x)*dy-(a.y-r.a.y)*dx)<1e-7&&Math.abs((b.x-r.a.x)*dy-(b.y-r.a.y)*dx)<1e-7&&[a,b].every(p=>p.x>=Math.min(r.a.x,r.b.x)-1e-7&&p.x<=Math.max(r.a.x,r.b.x)+1e-7&&p.y>=Math.min(r.a.y,r.b.y)-1e-7&&p.y<=Math.max(r.a.y,r.b.y)+1e-7);});return 1+((r?.level||1)-1)*.2;}
