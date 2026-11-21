import {naturalPalmCells} from './environment.js';
import {occupiesCell} from './footprints.js';
import {resourceDisplayLayout} from './resource-layout.js';
import {isShore,terrain} from './world.js';
import {isStrictSumer} from './scenario-profiles.js';
import {extractionOwner} from './extraction-courts.js';
import {sceneryClear} from './game3d/nature.js';
import {vegetationBankDistance} from './game3d/valley-vegetation.js';
import {lakeContours} from './game3d/lake-shore.js';
import {shoreDistance,roadsideBoulders} from './district3d/terrain.js';

const natureSnapshots=new WeakMap();
const none=[];
export function sceneryObstacleKey(s){
 const features=s.gathering?.features||none,deposits=s.world?.deposits||none;
 let cache=natureSnapshots.get(s);
 if(!cache){cache={rows:[],revision:0};natureSnapshots.set(s,cache);}
 const strict=isStrictSumer(s);
 let changed=cache.strict!==strict||cache.seed!==s.world?.seed,count=0;
 function compare(kind,p,empty=false){
  const row=cache.rows[count++];
  if(!row||row.kind!==kind||row.x!==p.x||row.y!==p.y||row.empty!==empty){
   cache.rows[count-1]={kind,x:p.x,y:p.y,empty};changed=true;
  }
 }
 for(const f of features)compare(f.kind,f);
 for(const d of deposits){
  if(d.kind==='stone')compare(d.kind,d,(s.stonePits?.[d.x+','+d.y]??1)<=1e-8);
  else if(d.kind==='clay')compare(d.kind,d,(s.clayPits?.[d.x+','+d.y]??1)<=1e-8);
  else if(d.kind==='forest'||d.kind==='dates')compare(d.kind,d);
 }
 if(cache.rows.length!==count){cache.rows.length=count;changed=true;}
 if(changed)cache.revision++;
 cache.seed=s.world?.seed;cache.strict=strict;
 return cache.revision;
}

// A shared list of *visible solids*. Reserve full working clearance while a
// deposit remains open, so every load of material need not move the street.
export function roadsideNature(s){
 const boulders=roadsideBoulders(s);
 const trees=[],solids=[...boulders],features=[],buildings=s.buildings||[],contours=lakeContours(s);
 const bank=p=>vegetationBankDistance(p.x,p.y,s,contours);
 for(const f of s.gathering?.features||[])if((f.kind==='tree'||f.kind==='rock')&&sceneryClear(s,f,.2)&&bank(f)>=.2){
  features.push(f);
  solids.push({x:f.x,y:f.y,radius:f.kind==='tree'?.075:.13});
 }
 const addPalm=p=>{
  if(features.some(f=>f.kind==='tree'&&Math.hypot(f.x-p.x,f.y-p.y)<.85))return;
  trees.push(p);solids.push({x:p.x,y:p.y,radius:.075});
 };
 for(const p of naturalPalmCells(s)){
  if(terrain(p.cellX,p.cellY,s)==='water'||isShore(s,p.cellX,p.cellY)||shoreDistance(p.x,p.y,s)<=.4||!sceneryClear(s,p,.2))continue;
  if(!isStrictSumer(s)||bank(p)<5.2)addPalm(p);
 }
 for(const d of s.world?.deposits||[]){
  if(!['forest','dates','stone','clay'].includes(d.kind)||terrain(d.x,d.y,s)==='water')continue;
  if(d.kind==='stone'||d.kind==='clay'){
   const ledger=d.kind==='stone'?s.stonePits:s.clayPits;
   if((!isStrictSumer(s)||(ledger?.[d.x+','+d.y]??1)>1e-8)&&!buildings.some(b=>occupiesCell(b,d.x,d.y))&&!extractionOwner(s,d))solids.push({x:d.x,y:d.y,radius:d.kind==='stone'?.425:.395});
   continue;
  }
  const court=extractionOwner(s,d);
  for(const [i,p] of resourceDisplayLayout(d).entries()){
   if(bank(p)<=.22||!court&&!sceneryClear(s,p,.2))continue;
   if(court&&d.kind==='forest')solids.push({x:p.x,y:p.y,radius:.075});
   else addPalm({id:`resource-${d.kind}-${d.x}-${d.y}-${i}`,x:p.x,y:p.y,kind:'palm',resource:d.kind,...court?{workingDates:true}:{}});
  }
 }
 return {trees,features,boulders,solids};
}

export function solidIndex(solids){
 const cells=new Map();
 for(const p of solids){
  const key=Math.floor(p.x)+','+Math.floor(p.y);
  if(!cells.has(key))cells.set(key,[]);
  cells.get(key).push(p);
 }
 return (a,b=a)=>{
  const found=[];
  for(let y=Math.floor(Math.min(a.y,b.y)-1);y<=Math.floor(Math.max(a.y,b.y)+1);y++)
   for(let x=Math.floor(Math.min(a.x,b.x)-1);x<=Math.floor(Math.max(a.x,b.x)+1);x++){
    const bin=cells.get(x+','+y);if(bin)found.push(...bin);
   }
  return found;
 };
}
export function solidClearance(solid,a,b){
 const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((solid.x-a.x)*dx+(solid.y-a.y)*dy)/(dx*dx+dy*dy||1)));
 return Math.hypot(solid.x-a.x-dx*t,solid.y-a.y-dy*t)-solid.radius;
}
