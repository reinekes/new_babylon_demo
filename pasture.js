import {isOperational} from './definitions.js';
import {footprintCells} from './footprints.js';
import {terrain,signedRiverDistance} from './world.js';
import {floodFootprint,floodPhase} from './river-flood.js';

// Three open fertile tiles provide one unit of seasonal forage. Each tile
// belongs to at most one herd in a settlement, even where ranges overlap.
export function pastureCredits(s,season){
 const credits=new Map();
 if(season!==0&&season!==1)return credits;
 const herds=s.buildings.filter(b=>isOperational(b)&&(
  b.type==='sheepfold'&&b.flock?.adults!==undefined&&b.flock.adults+b.flock.lambs>0||
  b.type==='cowshed'&&b.dairy?.shortage!==undefined&&b.dairy.cows+b.dairy.calves>0
 )).sort((a,b)=>a.y-b.y||a.x-b.x);
 if(!herds.length)return credits;
 const used=new Set(s.buildings.flatMap(footprintCells).map(p=>`${p.x},${p.y}`));
 const flooded=floodPhase(s)==='active'?floodFootprint(s,s.riverFlood):null;
 for(const b of herds){
  const tiles=[],bank=Math.sign(signedRiverDistance(b.x,b.y,s));
  for(let y=b.y-2;y<=b.y+2;y++)for(let x=b.x-2;x<=b.x+2;x++){
   const key=`${x},${y}`;
   if(!used.has(key)&&!flooded?.has(key)&&terrain(x,y,s)==='fertile'&&Math.sign(signedRiverDistance(x,y,s))===bank)tiles.push(key);
  }
  if(tiles.length<3)continue;
  for(const key of tiles.slice(0,3))used.add(key);
  credits.set(b,1);
 }
 return credits;
}
