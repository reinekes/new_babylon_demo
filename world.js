import {generateStreets} from './city-life.js';
export const WIDTH=40, HEIGHT=32;
export function river(y){return 16-y*.27+Math.sin(y*.55)*.7;}
export function terrain(x,y,s){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=WIDTH||y>=HEIGHT)return 'void';if(s?.world?.lakes?.some(l=>l.cells.some(c=>c.x===x&&c.y===y)))return 'water';const d=Math.abs(x-river(y));return d<1.1?'water':d<4.5?'fertile':'sand';}
// A bridge follows the front boundary of its selected river tile.
export function bridgeSpan(row){const y=row+.5,c=river(y);return {left:Math.floor(c-.75)-.5,right:Math.ceil(c+1.75)-.5,y,keyY:row+1};}
export function onBridge(buildings,x,y){return buildings.some(b=>{if(b.type!=='bridge'||b.construction?.kind==='new')return false;const p=bridgeSpan(b.y);return Math.abs(y-p.y)<.16&&x>=p.left&&x<=p.right;});}

// Persist explicit tiles so future generator changes cannot move a saved lake.
export function initializeWorld(s){
 if(s.world)return s.world;
 const buildings=[...(s.buildings||[]),...(s.roadAnchors||[])],roads=generateStreets(buildings),blocked=new Set();
 for(const b of buildings)blocked.add(`${b.x},${b.y}`);
 const stored=(s.roads||[]).map(r=>[r.a,r.b].map(p=>typeof p==='string'?(()=>{const [x,y]=p.split(',').map(Number);return {x:x-.5,y:y-.5};})():p)).filter(pair=>pair.every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)));
 for(const [a,b]of [...roads.edges,...stored])for(let t=0;t<=1;t+=.25){const x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;for(let yy=Math.floor(y);yy<=Math.ceil(y);yy++)for(let xx=Math.floor(x);xx<=Math.ceil(x);xx++)blocked.add(`${xx},${yy}`);}
 const protectPoint=p=>{for(let yy=Math.floor(p.y);yy<=Math.ceil(p.y);yy++)for(let xx=Math.floor(p.x);xx<=Math.ceil(p.x);xx++)blocked.add(`${xx},${yy}`);};
 for(const c of s.citizens||[]){const points=[...(c.route||[]),c].filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));for(const p of points)protectPoint(p);for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],steps=Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)*4);for(let j=0;j<=steps;j++)protectPoint({x:a.x+(b.x-a.x)*j/(steps||1),y:a.y+(b.y-a.y)*j/(steps||1)});}}
 for(const [x,y]of [[7,7],[11,12],[6,10],[5,15],[5,6]])blocked.add(`${x},${y}`);
 const lakes=[],candidates=[[26,7],[31,22],[20,26],[4,23]];
 for(let y=3;y<HEIGHT-2;y+=4)for(let x=3;x<WIDTH-2;x+=4)candidates.push([x,y]);
 for(const [cx,cy]of candidates){
  if(lakes.length===4)break;
  let cells=[];
  for(let y=cy-1;y<=cy+1;y++)for(let x=cx-1;x<=cx+1;x++)if((x!==cx-1||y!==cy-1)&&terrain(x,y)!=='water'&&!blocked.has(`${x},${y}`)&&!lakes.some(l=>l.cells.some(c=>Math.hypot(c.x-x,c.y-y)<3)))cells.push({x,y});
  if(cells.length>=4)lakes.push({id:`lake-${lakes.length}`,cells});
 }
 const deposits=[{kind:'clay',x:7,y:7},{kind:'reed',x:11,y:12},{kind:'forest',x:6,y:10},{kind:'wildlife',x:5,y:15},{kind:'stone',x:5,y:6},{kind:'clay',x:24,y:13},{kind:'forest',x:28,y:15},{kind:'wildlife',x:30,y:17},{kind:'stone',x:33,y:13},{kind:'reed',x:25,y:8}];
 for(const b of buildings)if(['clay','reed'].includes(b.type)){const at=deposits.find(d=>d.x===b.x&&d.y===b.y);if(at)at.kind=b.type;else deposits.push({kind:b.type,x:b.x,y:b.y});}
 s.world={seed:73129,lakes,deposits:deposits.filter(d=>terrain(d.x,d.y,{world:{lakes}})!=='water')};return s.world;
}
export function depositAt(s,x,y){return s?.world?.deposits?.find(d=>d.x===x&&d.y===y)?.kind||null;}
export function nearDeposit(s,kind,x,y){const radius=['forest','wildlife'].includes(kind)?2:0;return !!s?.world?.deposits?.some(d=>d.kind===kind&&Math.hypot(d.x-x,d.y-y)<=radius);}
export function isShore(s,x,y){return !['water','void'].includes(terrain(x,y,s))&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>terrain(x+dx,y+dy,s)==='water');}

export function isDryPoint(s,x,y){
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=-.5&&y>=-.5&&x<=WIDTH-.5&&y<=HEIGHT-.5&&Math.abs(x-river(y))>=1.25&&!s?.world?.lakes?.some(l=>l.cells.some(c=>Math.abs(x-c.x)<.51&&Math.abs(y-c.y)<.51));
}
export function validateWorld(s){
 const w=s?.world,kinds=['clay','reed','stone','forest','wildlife'];
 if(!w||!Number.isSafeInteger(w.seed)||!Array.isArray(w.lakes)||w.lakes.length>5||!Array.isArray(w.deposits)||w.deposits.length>WIDTH*HEIGHT)return false;
 const tile=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<WIDTH&&p.y>=0&&p.y<HEIGHT,seen=new Set(),ids=new Set();
 for(const l of w.lakes){if(typeof l.id!=='string'||ids.has(l.id)||!Array.isArray(l.cells)||!l.cells.length||l.cells.length>30)return false;ids.add(l.id);for(const c of l.cells){const key=`${c?.x},${c?.y}`;if(!tile(c)||seen.has(key)||terrain(c.x,c.y)==='water'||s.buildings?.some(b=>b.x===c.x&&b.y===c.y))return false;seen.add(key);}}
 const deposits=new Set();for(const d of w.deposits){const key=`${d?.x},${d?.y}`;if(!tile(d)||!kinds.includes(d.kind)||deposits.has(key)||terrain(d.x,d.y,s)==='water')return false;deposits.add(key);}return true;
}
