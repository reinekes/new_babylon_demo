import {generateStreets} from './city-life.js';
import {footprintCells} from './footprints.js';
import {isStrictSumer} from './scenario-profiles.js';
import {RIVER_START_HOMES} from './starter-settlement.js';
export const DEFAULT_FOREST_CAPACITY=96,DEFAULT_STONE_CAPACITY=240;
export const WIDTH=40, HEIGHT=32;
// Saved dimensions belong to the world. Missing fields describe the original
// 40 × 32 valley and never expand or move a previously saved city.
export const worldWidth=s=>s?.world?.width??WIDTH;
export const worldHeight=s=>s?.world?.height??HEIGHT;
export const riverAxis=s=>s?.world?.river?.axis==='x'?'x':'y';
export const riverFlowSign=s=>s?.world?.river?.flowSign===-1?-1:1;
export const riverFlowVector=s=>riverAxis(s)==='x'?{x:riverFlowSign(s),y:0}:{x:0,y:riverFlowSign(s)};
export const riverLength=s=>riverAxis(s)==='x'?worldWidth(s):worldHeight(s);
export const riverAcrossSize=s=>riverAxis(s)==='x'?worldHeight(s):worldWidth(s);
export const riverLocal=(x,y,s)=>riverAxis(s)==='x'?{along:x,across:y}:{along:y,across:x};
export const worldFromRiver=(across,along,s)=>riverAxis(s)==='x'?{x:along,y:across}:{x:across,y:along};
export const riverPoint=(along,s,offset=0)=>worldFromRiver(river(along,s)+offset,along,s);
export function signedRiverDistance(x,y,s){const p=riverLocal(x,y,s);return p.across-river(p.along,s);}
export function river(y,s){const r=s?.world?.river;return r?r.offset+(y-8)*r.slope+Math.sin(y*r.frequency+r.phase)*r.amplitude:16-y*.27+Math.sin(y*.55)*.7;}
export function terrain(x,y,s){if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=worldWidth(s)||y>=worldHeight(s))return 'void';if(s?.world?.lakes?.some(l=>l.cells.some(c=>c.x===x&&c.y===y)))return 'water';const d=Math.abs(signedRiverDistance(x,y,s));return d<1.1?'water':d<4.5?'fertile':'sand';}
// A bridge follows the front boundary of its selected river tile.
export function bridgeSpan(row,s){const y=row+.5,c=river(y,s);return {left:Math.floor(c-.75)-.5,right:Math.ceil(c+1.75)-.5,y,keyY:row+1};}
export const bridgeSpanAt=(b,s)=>bridgeSpan(riverLocal(b.x,b.y,s).along,s);
export function onBridge(buildings,x,y,s){const q=riverLocal(x,y,s);return buildings.some(b=>{if(b.type!=='bridge'||b.construction?.kind==='new')return false;const p=bridgeSpanAt(b,s);return Math.abs(q.along-p.y)<.16&&q.across>=p.left&&q.across<=p.right;});}

// Persist explicit tiles so future generator changes cannot move a saved lake.
export function initializeWorld(s){
 if(s.world){
  ensureResourceSites(s);
  if(s.world.generationVersion===2&&isStrictSumer(s))expandResourceSites(s);
  return s.world;
 }
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
 s.world={seed:73129,lakes,deposits:deposits.filter(d=>terrain(d.x,d.y,{world:{lakes}})!=='water')};ensureResourceSites(s);return s.world;
}
export function depositSiteAt(s,x,y){return s?.world?.deposits?.find(d=>d.x===x&&d.y===y)||null;}
export function depositAt(s,x,y){return depositSiteAt(s,x,y)?.kind||null;}
export function nearDeposit(s,kind,x,y){const radius=['forest','wildlife'].includes(kind)?2:0;return !!s?.world?.deposits?.some(d=>d.kind===kind&&Math.hypot(d.x-x,d.y-y)<=radius);}
export function isShore(s,x,y){return !['water','void'].includes(terrain(x,y,s))&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>terrain(x+dx,y+dy,s)==='water');}

export function isDryPoint(s,x,y){
 return Number.isFinite(x)&&Number.isFinite(y)&&x>=-.5&&y>=-.5&&x<=worldWidth(s)-.5&&y<=worldHeight(s)-.5&&Math.abs(signedRiverDistance(x,y,s))>=1.25&&!s?.world?.lakes?.some(l=>l.cells.some(c=>Math.abs(x-c.x)<.51&&Math.abs(y-c.y)<.51));
}
export function validateWorld(s){
 const w=s?.world,kinds=['clay','reed','stone','forest','wildlife','dates'];
 if(!w||(w.resourceVersion!==undefined&&![1,2].includes(w.resourceVersion))||!Number.isSafeInteger(w.seed)||!Array.isArray(w.lakes)||!Array.isArray(w.deposits))return false;
 const modern=w.generationVersion===2;
 if(modern?(w.width!==64||w.height!==64):(w.width!==undefined||w.height!==undefined))return false;
 const width=worldWidth(s),height=worldHeight(s);
 const origin=w.foundingCenter;
 if(origin!==undefined&&(!modern||!origin||Object.keys(origin).length!==2||!Number.isFinite(origin.x)||!Number.isFinite(origin.y)||origin.x<0||origin.y<0||origin.x>=width||origin.y>=height))return false;
 if(w.lakes.length>(modern?7:5)||w.deposits.length>width*height)return false;
 if(w.river!==undefined){
  const r=w.river,ranges=modern?{offset:[14,52],slope:[-.4,.4],amplitude:[.35,2.4],frequency:[.07,.24],phase:[0,Math.PI*2]}:{offset:[15.5,20.5],slope:[-.22,.20],amplitude:[.35,1.45],frequency:[.11,.24],phase:[0,Math.PI*2]};
  if(![1,2].includes(w.generationVersion)||!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length!==(modern?7:5)||!Object.entries(ranges).every(([key,[lo,hi]])=>Number.isFinite(r[key])&&r[key]>=lo&&r[key]<=hi)||modern&&(!['x','y'].includes(r.axis)||![-1,1].includes(r.flowSign))||w.seed<0||w.seed>0xffffffff)return false;
 }else if(w.generationVersion!==undefined)return false;
 const tile=p=>p&&Number.isInteger(p.x)&&Number.isInteger(p.y)&&p.x>=0&&p.x<width&&p.y>=0&&p.y<height,seen=new Set(),ids=new Set();
 const riverOnly={world:{...w,lakes:[]}};
 for(const l of w.lakes){
  if(typeof l.id!=='string'||ids.has(l.id)||!Array.isArray(l.cells)||!l.cells.length||l.cells.length>(modern?80:30))return false;
  ids.add(l.id);
  for(const c of l.cells){const key=`${c?.x},${c?.y}`;if(!tile(c)||seen.has(key)||terrain(c.x,c.y,riverOnly)==='water'||s.buildings?.some(b=>b.x===c.x&&b.y===c.y))return false;seen.add(key);}
  if(modern){const remaining=new Set(l.cells.map(c=>`${c.x},${c.y}`)),queue=[l.cells[0]];remaining.delete(`${queue[0].x},${queue[0].y}`);for(let i=0;i<queue.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:queue[i].x+dx,y:queue[i].y+dy};if(remaining.delete(`${p.x},${p.y}`))queue.push(p);}if(remaining.size)return false;}
 }
 const deposits=new Set();for(const d of w.deposits){const key=`${d?.x},${d?.y}`;if(!tile(d)||!kinds.includes(d.kind)||deposits.has(key)||terrain(d.x,d.y,s)==='water'||d.capacity!==undefined&&(!Number.isSafeInteger(d.capacity)||d.capacity<=0||d.capacity>(d.kind==='forest'?DEFAULT_FOREST_CAPACITY:d.kind==='stone'?DEFAULT_STONE_CAPACITY:0)))return false;deposits.add(key);}return true;
}

// Versioned supplementation leaves a saved valley's terrain and existing sites in place.
export function ensureResourceSites(s){
 const w=s.world;if(!w||w.resourceVersion!==undefined)return w;
 const types={clay:'clay',reed:'reed',dates:'garden'},buildings=s.buildings||[];
 for(const b of buildings){const kind=b.type==='garden'?'dates':['clay','reed'].includes(b.type)?b.type:null;if(!kind)continue;const existing=w.deposits.find(d=>d.x===b.x&&d.y===b.y);if(existing)existing.kind=kind;else w.deposits.push({kind,x:b.x,y:b.y});}
 const usable=(d,kind)=>terrain(d.x,d.y,s)!=='water'&&!buildings.some(b=>b.x===d.x&&b.y===d.y&&b.type!==types[kind]);
 const candidates=[];for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++)if(terrain(x,y,s)!=='water')candidates.push({x,y});
 for(const left of [true,false])for(const kind of ['clay','reed','dates']){
  const nearby=p=>p.x>=5&&p.x<=24&&p.y>=4&&p.y<=14;
  let count=w.deposits.filter(d=>d.kind===kind&&(d.x<river(d.y,s))===left&&nearby(d)&&usable(d,kind)).length;
  const ordered=candidates.filter(p=>(p.x<river(p.y,s))===left&&usable(p,kind)&&!w.deposits.some(d=>d.x===p.x&&d.y===p.y)).sort((a,b)=>Number(nearby(b))-Number(nearby(a))||((kind==='reed'?Number(isShore(s,b.x,b.y))-Number(isShore(s,a.x,a.y)):0))||Math.hypot(a.x-(left?9:18),a.y-9)-Math.hypot(b.x-(left?9:18),b.y-9)||a.y-b.y||a.x-b.x);
  for(const p of ordered){if(count>=2)break;w.deposits.push({kind,...p});count++;}
 }
 w.resourceVersion=1;return w;
}

/** Additive migration. Existing sites (including empty ones) remain authoritative. */
export function expandResourceSites(s){
 const world=s.world;
 if(!world||world.resourceVersion!==1)return;
 const key=({x,y})=>`${x},${y}`;
 const occupied=new Set([...world.deposits,...(s.buildings||[]).flatMap(footprintCells),...(s.roadAnchors||[])].map(key));
 const home=(s.buildings||[]).find(b=>b.type==='house')||{x:8,y:8};
 const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const candidates=[];
 for(let y=2;y<worldHeight(s)-2;y++)for(let x=2;x<worldWidth(s)-2;x++){
  if(occupied.has(`${x},${y}`)||terrain(x,y,s)==='water')continue;
  const cell={x,y},side=Math.sign(signedRiverDistance(x,y,s));
  candidates.push({cell,side,shore:isShore(s,x,y),distance:distance(cell,home)});
 }
 const bands=worldWidth(s)>=64?[9,17,25,34]:[9,17,24];
 for(const side of [-1,1])for(const kind of ['reed','clay']){
  const existing=world.deposits.filter(d=>d.kind===kind);
  const bank=candidates.filter(p=>p.side===side&&(kind!=='reed'||p.shore));
  for(const band of bands){
   let best=null,bestScore=Infinity;
   for(const p of bank){
    if(occupied.has(key(p.cell))||existing.some(d=>distance(d,p.cell)<3))continue;
    const score=Math.abs(p.distance-band)+(kind==='clay'&&!p.shore?2:0);
    if(score<bestScore){best=p.cell;bestScore=score;}
   }
   if(!best)continue;
   const site={kind,...best};world.deposits.push(site);existing.push(site);occupied.add(key(site));
  }
 }
 world.resourceVersion=2;
}

// Explicit geometry is generated only for a new game. Loading never rerolls a
// seed, so edits to this algorithm cannot move a saved river or resource site.
export function initializeGeneratedWorld(s,seed,{version=2,centeredStart=false}={}){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('World seed must be a uint32');
 if(![1,2].includes(version))throw new RangeError('Unsupported world generation version');
 if(s.world)return s.world;
 return version===1?initializeGeneratedWorldV1(s,seed):initializeGeneratedWorldV2(s,seed,centeredStart);
}
function initializeGeneratedWorldV1(s,seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw new RangeError('World seed must be a uint32');
 if(s.world)return s.world;
 let value=seed>>>0;const random=()=>{value=(value+0x6D2B79F5)>>>0;let n=value;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
 const w=s.world={generationVersion:1,seed,river:{offset:15.5+random()*5,slope:-.22+random()*.42,amplitude:.35+random()*1.1,frequency:.11+random()*.13,phase:random()*Math.PI*2},lakes:[],deposits:[],resourceVersion:1};
 const buildings=s.buildings||[];
 // Established test/scenario starts include a field: retain its fertile bank
 // instead of stranding an already-built farm in the dry desert.
 if(buildings.some(b=>b.type==='field'))for(let attempt=0;attempt<1000&&buildings.some(b=>b.type==='field'&&terrain(b.x,b.y,s)!=='fertile');attempt++)w.river={offset:15.5+random()*5,slope:-.22+random()*.42,amplitude:.35+random()*1.1,frequency:.11+random()*.13,phase:random()*Math.PI*2};
 if(buildings.some(b=>b.type==='field'&&terrain(b.x,b.y,s)!=='fertile'))w.river={offset:16,slope:0,amplitude:.35,frequency:.2,phase:0};
 const protectedTile=(x,y)=>buildings.some(b=>Math.abs(b.x-x)<2&&Math.abs(b.y-y)<2);
 const dryRiver=(x,y)=>terrain(x,y,{world:{river:w.river}})!=='water';
 const centers=[];
 // The first oasis lies on the founders' bank; subsequent basins vary across
 // the valley. Each outline stays connected and leaves walkable shores.
 for(let i=0;i<24;i++)centers.push({x:3+Math.floor(random()*5),y:16+Math.floor(random()*6)});
 for(let i=0;i<240;i++)centers.push({x:3+Math.floor(random()*(WIDTH-6)),y:3+Math.floor(random()*(HEIGHT-6))});
 const count=3+Math.floor(random()*3);
 for(const center of centers){
  if(w.lakes.length>=count)break;
  const cut=Math.floor(random()*4),cells=[];
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   if(Math.abs(dx)+Math.abs(dy)===2&&((dx>0?1:0)+(dy>0?2:0)===cut||random()<.22))continue;
   cells.push({x:center.x+dx,y:center.y+dy});
  }
  if(cells.some(p=>!dryRiver(p.x,p.y)||protectedTile(p.x,p.y)||Math.abs(p.x-river(p.y,s))<2.7||w.lakes.some(l=>l.cells.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<4))))continue;
  w.lakes.push({id:`lake-${w.lakes.length}`,cells});
 }
 const occupied=(x,y)=>buildings.some(b=>b.x===x&&b.y===y),used=new Set();
 const put=(kind,p)=>{w.deposits.push({kind,x:p.x,y:p.y});used.add(`${p.x},${p.y}`);};
 for(const b of buildings)if(['clay','reed','garden'].includes(b.type))put(b.type==='garden'?'dates':b.type,b);
 const tiles=[];for(let y=2;y<HEIGHT-2;y++)for(let x=2;x<WIDTH-2;x++)if(isDryPoint(s,x,y)&&!occupied(x,y))tiles.push({x,y,noise:random()});
 for(const left of [true,false])for(const kind of ['reed','clay','dates','forest','wildlife','stone']){
  const target=['reed','clay','dates'].includes(kind)?2:1;
  let existing=w.deposits.filter(d=>d.kind===kind&&(d.x<river(d.y,s))===left).length;
  const ranked=tiles.filter(p=>(p.x<river(p.y,s))===left&&!used.has(`${p.x},${p.y}`)&&(kind!=='reed'||isShore(s,p.x,p.y))).sort((a,b)=>{
   const score=p=>Math.hypot(p.x-(left?7:river(p.y,s)+4),p.y-10)+p.noise*10+(kind==='dates'&&terrain(p.x,p.y,s)!=='fertile'?8:0)+(kind==='clay'&&!isShore(s,p.x,p.y)?3:0);
   return score(a)-score(b)||a.y-b.y||a.x-b.x;
  });
  for(const p of ranked){if(existing>=target)break;put(kind,p);existing++;}
 }
 return w;
}

function initializeGeneratedWorldV2(s,seed,centeredStart){
 let value=seed>>>0;const random=()=>{value=(value+0x6D2B79F5)>>>0;let n=value;n=Math.imul(n^(n>>>15),n|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
 const buildings=s.buildings||[],established=buildings.some(b=>b.type==='field');
 const centered=centeredStart&&!established&&buildings.length===RIVER_START_HOMES.length;
 const w=s.world={generationVersion:2,width:64,height:64,seed,river:null,lakes:[],deposits:[],resourceVersion:1};
 const axis=established?'y':random()<.5?'y':'x',flowSign=random()<.5?-1:1;
 const candidate=()=>established?{offset:15.5+random()*5,slope:-.22+random()*.42,amplitude:.35+random()*1.1,frequency:.11+random()*.13,phase:random()*Math.PI*2,axis,flowSign}:{offset:18+random()*31,slope:-.34+random()*.68,amplitude:.5+random()*1.8,frequency:.075+random()*.13,phase:random()*Math.PI*2,axis,flowSign};
 const center=32,bankCell=(along,across)=>worldFromRiver(Math.floor(river(along,s))+across,along,s);
 const safeCourse=()=>{
  if(w.river.offset<14||w.river.offset>52)return false;
  // Reserve the founders' whole neighbourhood, not merely house centres, so
  // their doors and diagonal approaches never start on the opposite bank.
  if(!centered&&!established)for(const along of [1,5,10,15])if(river(along,s)<16)return false;
  for(let along=0;along<64;along+=2)if(river(along,s)<5||river(along,s)>59)return false;
  if(centered)return true;
  return buildings.every(b=>isDryPoint(s,b.x,b.y)&&(b.type!=='field'||terrain(b.x,b.y,s)==='fertile'));
 };
 for(let attempt=0;attempt<1000;attempt++){
  w.river=candidate();
  if(centered)w.river.offset+=center+4-river(center,s);
  if(safeCourse())break;
 }
 if(!safeCourse())w.river={offset:established?16:centered?36:32,slope:0,amplitude:.35,frequency:.2,phase:0,axis,flowSign};
 const localSites=centered?[
  {kind:'forest',...bankCell(center-5,-6),capacity:24},
  {kind:'stone',...bankCell(center+4,-6),capacity:30},
 ]:[];
 if(centered){
  for(const [i,{along,across}] of RIVER_START_HOMES.entries())Object.assign(buildings[i],bankCell(center+along,across));
  w.foundingCenter={x:buildings.reduce((n,b)=>n+b.x,0)/buildings.length,y:buildings.reduce((n,b)=>n+b.y,0)/buildings.length};
 }
 const reserved=[...buildings,...localSites];
 const protectedTile=(x,y)=>reserved.some(b=>Math.abs(b.x-x)<2.2&&Math.abs(b.y-y)<2.2);
 const centers=[];
 // A nearby basin on the founders' bank guarantees water and a reachable relic
 // even when the main river is on the far side of this larger valley.
 for(let i=0;i<80;i++){
  const across=4+Math.floor(random()*4),along=17+Math.floor(random()*7);
  centers.push(centered?bankCell(center+along-9,-across-6):worldFromRiver(across,along,s));
 }
 for(let i=0;i<500;i++)centers.push({x:4+Math.floor(random()*56),y:4+Math.floor(random()*56)});
 const lakeCount=4+Math.floor(random()*3);
 for(const center of centers){
  if(w.lakes.length>=lakeCount)break;
  const rx=1.4+random()*2.1,ry=1.4+random()*2.1,angle=random()*Math.PI,phase=random()*Math.PI*2,rough=.11+random()*.18;
  const cells=[],radius=Math.ceil(Math.max(rx,ry)*1.35),cs=Math.cos(angle),sn=Math.sin(angle);
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const u=(dx*cs+dy*sn)/rx,v=(-dx*sn+dy*cs)/ry,theta=Math.atan2(v,u),outline=1+rough*Math.sin(theta*3+phase)+.09*Math.cos(theta*2-phase);
   if(Math.hypot(u,v)<=outline)cells.push({x:center.x+dx,y:center.y+dy});
  }
  if(cells.length<6||cells.length>65||cells.some(p=>p.x<2||p.y<2||p.x>61||p.y>61||protectedTile(p.x,p.y)||Math.abs(signedRiverDistance(p.x,p.y,s))<3||w.lakes.some(l=>l.cells.some(c=>Math.hypot(c.x-p.x,c.y-p.y)<4))))continue;
  // Keep only the centre-connected shoreline; narrow diagonal tips would make
  // visually separate puddles and cannot hold a traversable relic approach.
  const pool=new Set(cells.map(p=>`${p.x},${p.y}`)),connected=[center];pool.delete(`${center.x},${center.y}`);
  for(let i=0;i<connected.length;i++)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const p={x:connected[i].x+dx,y:connected[i].y+dy};if(pool.delete(`${p.x},${p.y}`))connected.push(p);}
  if(connected.length>=6)w.lakes.push({id:`lake-${w.lakes.length}`,cells:connected.sort((a,b)=>a.y-b.y||a.x-b.x)});
 }
 const occupied=(x,y)=>buildings.some(b=>b.x===x&&b.y===y),used=new Set();
 const put=(kind,p)=>{w.deposits.push({kind,x:p.x,y:p.y,...p.capacity===undefined?{}:{capacity:p.capacity}});used.add(`${p.x},${p.y}`);};
 for(const site of localSites)put(site.kind,site);
 for(const b of buildings)if(['clay','reed','garden'].includes(b.type))put(b.type==='garden'?'dates':b.type,b);
 const tiles=[];for(let y=2;y<62;y++)for(let x=2;x<62;x++)if(isDryPoint(s,x,y)&&!occupied(x,y))tiles.push({x,y,noise:random()});
 const home=buildings.filter(b=>b.type==='house'),origin=home.length?{x:home.reduce((n,p)=>n+p.x,0)/home.length,y:home.reduce((n,p)=>n+p.y,0)/home.length}:{x:7,y:9};
 for(const negative of [true,false])for(const kind of ['reed','clay','dates','forest','wildlife','stone']){
  if(centered&&(kind==='forest'||kind==='stone'))continue;
  const target=['reed','clay','dates'].includes(kind)?2:1;
  let existing=w.deposits.filter(d=>d.kind===kind&&(signedRiverDistance(d.x,d.y,s)<0)===negative).length;
  const ranked=tiles.filter(p=>(signedRiverDistance(p.x,p.y,s)<0)===negative&&!used.has(`${p.x},${p.y}`)&&(kind!=='reed'||isShore(s,p.x,p.y))).sort((a,b)=>{
   const score=p=>Math.hypot(p.x-origin.x,p.y-origin.y)+p.noise*5+(kind==='dates'&&terrain(p.x,p.y,s)!=='fertile'?5:0)+(kind==='clay'&&!isShore(s,p.x,p.y)?2:0);
   return score(a)-score(b)||a.y-b.y||a.x-b.x;
  });
  for(const p of ranked){if(existing>=target)break;put(kind,p);existing++;}
  // One remote outcrop of each kind gives the enlarged map useful discoveries.
  const distant=ranked.filter(p=>!used.has(`${p.x},${p.y}`)&&Math.hypot(p.x-origin.x,p.y-origin.y)>22).sort((a,b)=>b.noise-a.noise)[0];if(distant)put(kind,distant);
 }
 return w;
}
