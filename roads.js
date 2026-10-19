import {generateStreets} from './city-life.js';
import {terrain,onBridge,isDryPoint} from './world.js';
import {createOrder,nextOrder} from './construction.js';
export const roadKey=(a,b)=>`road:${[a.key||`${a.x},${a.y}`,b.key||`${b.x},${b.y}`].sort().join('|')}`;
export function ensureRoads(s,network){
 s.roads??=[];const net=network||generateStreets([...s.buildings,...s.roadAnchors||[]],s);
 const existing=new Set(s.roads.map(r=>r.id));
 for(const [a,b]of net.edges){const id=roadKey(a,b);if(existing.has(id))continue;if(onBridge(s.buildings,(a.x+b.x)/2,(a.y+b.y)/2)||[.25,.5,.75].some(t=>!isDryPoint(s,a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t)))continue;existing.add(id);s.roads.push({type:'road',id,x:(a.x+b.x)/2,y:(a.y+b.y)/2,a:{x:a.x,y:a.y,key:a.key},b:{x:b.x,y:b.y,key:b.key},level:1});}
 return s.roads;
}
export function roadAt(s,x,y){return ensureRoads(s).map(r=>({r,d:Math.hypot(r.x-x,r.y-y)})).filter(v=>v.d<.8).sort((a,b)=>a.d-b.d)[0]?.r;}
export const roadUpgradeCost=r=>r.level===1?{clay:3,reed:1}:{clay:6,reed:2,stone:2};
export function upgradeRoad(s,roadOrId){const r=typeof roadOrId==='string'?ensureRoads(s).find(r=>r.id===roadOrId):roadOrId;let reason=s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':!r||!ensureRoads(s).includes(r)?'Выбери существующую дорогу':r.construction?'Улучшение уже идёт':r.level>=3?'Достигнут третий уровень':'';if(reason)return {ok:false,reason};const cost=roadUpgradeCost(r);if(Object.entries(cost).some(([k,n])=>(s.resources[k]||0)<n))return {ok:false,reason:'Не хватает материалов'};for(const [k,n]of Object.entries(cost))s.resources[k]-=n;r.construction={...createOrder(cost,r.level+1,'upgrade'),order:nextOrder(s)};return {ok:true};}
export function roadSpeed(s,a,b){const r=(s.roads||[]).find(r=>{const dx=r.b.x-r.a.x,dy=r.b.y-r.a.y;return Math.abs((a.x-r.a.x)*dy-(a.y-r.a.y)*dx)<1e-7&&Math.abs((b.x-r.a.x)*dy-(b.y-r.a.y)*dx)<1e-7&&[a,b].every(p=>p.x>=Math.min(r.a.x,r.b.x)-1e-7&&p.x<=Math.max(r.a.x,r.b.x)+1e-7&&p.y>=Math.min(r.a.y,r.b.y)-1e-7&&p.y<=Math.max(r.a.y,r.b.y)+1e-7);});return 1+((r?.level||1)-1)*.2;}

// Preview traverses the existing network; a bridge is traversable but has no road order.
export function planRoadRoute(s,fromId,toId,target=2){
 const roads=ensureRoads(s),lookup=new Map(roads.map(r=>[r.id,r])),from=lookup.get(fromId),to=lookup.get(toId),empty=reason=>({roads:[],pending:[],cost:{},reason});
 if(!from||!to)return empty('Выбери начало и конец существующей дороги');if(![2,3].includes(target))return empty('Выбери уровень II или III');
 const net=generateStreets([...s.buildings,...s.roadAnchors||[]],s),graph=new Map([...net.graph].map(([k,v])=>[k,new Set(v)]));
 for(const r of roads){for(const [a,b]of [[r.a,r.b],[r.b,r.a]]){if(!graph.has(a.key))graph.set(a.key,new Set());graph.get(a.key).add(b.key);}}
 const queue=[from.a.key,from.b.key],prev=new Map(queue.map(k=>[k,null])),goals=new Set([to.a.key,to.b.key]);let end=null;
 for(let i=0;i<queue.length;i++){const p=queue[i];if(goals.has(p)){end=p;break;}for(const next of graph.get(p)||[])if(!prev.has(next)){prev.set(next,p);queue.push(next);}}
 if(end===null)return empty('Нет связного пути между участками: проверь мост');
 const middle=[];for(let p=end;prev.get(p)!==null;p=prev.get(p)){const r=lookup.get(`road:${[p,prev.get(p)].sort().join('|')}`);if(r)middle.push(r);}
 const route=[...new Map([from,...middle.reverse(),to].map(r=>[r.id,r])).values()],pending=route.filter(r=>!r.construction&&r.level<target);
 const cost={};for(const r of pending)for(const [k,n]of Object.entries(roadUpgradeCost(r)))cost[k]=(cost[k]||0)+n;
 const reason=s.funeral?'Жители провожают умерших':s.event?'Сначала заверши событие':s.lost?'Поселение покинуто':route.some(r=>r.level<target-1)?'Сначала доведи весь путь до уровня II':!pending.length?'Все участки готовы или уже заказаны':Object.entries(cost).some(([k,n])=>(s.resources[k]||0)<n)?'Не хватает материалов на весь маршрут':'';
 return {roads:route,pending,cost,reason};
}
export function upgradeRoadRoute(s,from,to,target=2){const plan=planRoadRoute(s,from,to,target);if(plan.reason)return {ok:false,reason:plan.reason};const group=nextOrder(s);for(const [k,n]of Object.entries(plan.cost))s.resources[k]-=n;for(const [i,r]of plan.pending.entries())r.construction={...createOrder(roadUpgradeCost(r),target,'upgrade'),order:group+i,routeOrder:group};s.news.unshift({title:'Заказан дорожный маршрут',text:`Уровень ${target}: ${plan.pending.length} участков. Материалы зарезервированы, работы выполнят жители.`,kind:'build',tick:s.tick,year:s.year,season:s.season});s.news=s.news.slice(0,80);return {ok:true,count:plan.pending.length,group};}
