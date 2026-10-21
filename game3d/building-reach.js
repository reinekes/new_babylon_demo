import {buildingKey,isOperational,BUILDINGS} from '../definitions.js';
import {generateStreets} from '../city-life.js';
import {footprintSize} from '../footprints.js';
// Circles are a readable envelope; the graph remains authoritative for deliveries.
export function buildingReach(s,b){
 if(!b)return null;
 const local={logging:[.62,'Лесоруб: деревья до 0,62 клетки от входа'],quarry:[.62,'Каменотёс: камни до 0,62 клетки от входа'],hunting:[6,'Охотник: поиск дичи до 6 клеток от входа'],fishing:[3,'Рыбак: поиск рыбы до 3 клеток от входа']};
 if(!local[b.type]&&!['market','harbor','depot','granary','shrine','healer','waterpoint'].includes(b.type))return null;
 const buildings=s.buildings.some(v=>buildingKey(v)===buildingKey(b))?s.buildings:[...s.buildings,b],net=generateStreets(buildings,s),ports=new Map(net.ports.map(p=>[buildingKey(p.building),p])),port=ports.get(buildingKey(b)),component=port&&net.components.get(port.key);
 if(local[b.type]){const job=s.gathering?.jobs.find(j=>j.work===buildingKey(b));return {radius:local[b.type][0],origin:job?.origin||port||b,text:local[b.type][1]+' · нужен доступный сухой подход',kind:'local',edges:[]};}
 if(!['market','harbor','depot','granary','shrine','healer','waterpoint'].includes(b.type))return null;
 const targets=buildings.filter(v=>v!==b&&isOperational(v)&&net.components.get(ports.get(buildingKey(v))?.key)===component&&component!==undefined),radius=Math.max(1,...targets.map(v=>Math.hypot(v.x-b.x,v.y-b.y)+.6));
 return {radius,text:`${BUILDINGS[b.type]?.name}: ${targets.length} зданий в дорожном квартале · круг — габарит сети, не дальность услуги; доставка только по дорогам`,kind:'network',edges:net.edges.filter(([a])=>component!==undefined&&net.components.get(a.key)===component)};
}
export function nearbySimilar(s,b,limit=12){return s.buildings.filter(v=>v.type===b.type&&Math.hypot(v.x-b.x,v.y-b.y)<=8).sort((a,c)=>Math.hypot(a.x-b.x,a.y-b.y)-Math.hypot(c.x-b.x,c.y-b.y)).slice(0,limit).map(buildingKey);}
export function createBuildingReach(B,scene){
 let signature='',lines=[],description='';
 const clear=()=>{for(const l of lines)l.dispose();lines=[];};
 return {update(s,b){const key=b?`${b.type}:${b.x},${b.y}:${b.footprint||1}|${s.buildings.map(v=>`${buildingKey(v)}:${v.type}:${v.construction?.kind||''}`).join(';')}|${(s.roads||[]).map(v=>v.id||`${v.a?.key}:${v.b?.key}`).join(';')}`:'';if(key===signature)return description;signature=key;clear();description='';if(!b)return description;
 const info=buildingReach(s,b),offset=(footprintSize(b)-1)/2,cx=(b.x+offset)*6,cz=(b.y+offset)*6;
 if(info){description=info.text;const points=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*2;points.push(new B.Vector3((info.origin?info.origin.x*6:cx)+Math.cos(a)*info.radius*6,.15,(info.origin?info.origin.y*6:cz)+Math.sin(a)*info.radius*6));}const ring=B.MeshBuilder.CreateLines('building-radius',{points},scene);ring.color=B.Color3.FromHexString('#e2c981');ring.alpha=.8;ring.isPickable=false;lines.push(ring);
 if(info.edges.length){const segments=info.edges.map(([a,c])=>[new B.Vector3(a.x*6,.12,a.y*6),new B.Vector3(c.x*6,.12,c.y*6)]);const net=B.MeshBuilder.CreateLineSystem('building-service-roads',{lines:segments},scene);net.color=B.Color3.FromHexString('#a9c9b4');net.alpha=.55;net.isPickable=false;lines.push(net);}}
 return description;},clear(){signature='';description='';clear();},get meshes(){return lines;},dispose:clear};
}
