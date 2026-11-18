import {fieldCalendar} from './crop-calendar.js';
import {fieldResting} from './field-soil.js';
import {buildingKey,isOperational} from './definitions.js';
import {tillageSeason} from './agriculture.js';
import {bankFieldLayout} from './game3d/field-shore.js';
import {isWorkday,visibleCitizens} from './workforce.js';
import {worldWidth,worldHeight} from './world.js';
import {renderedShoreDistance} from './game3d/shore-profile.js';
import {lakeContours} from './game3d/lake-shore.js';
import {fieldPatches} from './field-patches.js';

// A visual pass follows actual sowing progress. Dimensions are in scene metres.
export const PLOUGH_OX_SCALE=.95;
export const PLOUGH_OX_OFFSET=.70;
export const PLOUGH_YOKE_HEIGHT=1.17;
export const PLOUGH_DRIVER_OFFSET=-1.65;
export const PLOUGH_HANDLE_FORWARD=-1.44;
export const PLOUGH_HANDLE_HEIGHT=.94;
export const PLOUGH_HANDLE_SPREAD=.18;

export function ploughTeams(state,people){
 if(!isWorkday(state.simTime)||state.funeral||state.festival?.phase==='feast')return [];
 const fields=new Map(),patches=fieldPatches(state.buildings),activities=new Map();
 for(const b of patches.keys()){
  if(!b.crop)continue;
  const preparing=tillageSeason(state,b);
  const sowing=state.season===fieldCalendar(state,b).sow&&isOperational(b)&&!fieldResting(state,b)&&
   !(b.crop.sheaves>1e-8)&&(b.crop.seedStock>1e-8||b.crop.sown>=1-1e-8);
  if(!preparing&&!sowing)continue;
  activities.set(b,preparing?'preparing':'sowing');
  if((preparing?(b.crop.tilled||0):b.crop.sown)<1-1e-8)fields.set(buildingKey(b),b);
 }
 if(!fields.size)return [];
 const drivers=new Map();
 for(const c of people??visibleCitizens(state)){
  if(c.phase!=='working'||c.age<16||c.carrying||c.walking||c.guarding||c.controlled||c.eventContact||c.festivalContact||!fields.has(c.work))continue;
  if(!drivers.has(c.work)||c.id<drivers.get(c.work).id)drivers.set(c.work,c);
 }
 const teams=[],seen=new Set();
 for(const field of fields.values()){
  if(seen.has(field)||!drivers.has(buildingKey(field)))continue;
  const {group}=patches.get(field),rotation=group.rotation;
  const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][rotation];
  const operation=activities.get(field);
  const line=group.plots.filter(b=>activities.get(b)===operation&&(!dx?b.x===field.x:b.y===field.y));
  const projection=b=>b.x*dx+b.y*dy;
  const along=new Map(line.map(b=>[projection(b),b])),seed=projection(field);
  let start=seed,end=seed;
  while(along.has(start-1))start--;
  while(along.has(end+1))end++;
  const run=[];for(let n=start;n<=end;n++)run.push(along.get(n));
  const driver=run.map(b=>drivers.get(buildingKey(b))).filter(Boolean).sort((a,b)=>a.id-b.id)[0];
  const team=ploughPass(state,run,driver,rotation,operation);
  if(team){teams.push(team);for(const plot of run)seen.add(plot);}
  else if(run.length>1){const solo=ploughPass(state,[field],drivers.get(buildingKey(field)),rotation,operation);if(solo)teams.push(solo);}
 }
 return teams;
}

// Construct an out-and-back furrow with a semicircular headland. Distances are
// in metres from the centre of the first tile; the yoke and driver turn together.
function furrows(low,high,center,radius){
 const straight=high-low,arc=Math.PI*radius,length=2*straight+arc;
 return {length,at(d){
  if(d<=straight)return {side:center-radius,along:low+d,angle:0};
  if(d<straight+arc){const angle=(d-straight)/radius;return {side:center-radius*Math.cos(angle),along:high+radius*Math.sin(angle),angle};}
  return {side:center+radius,along:high-(d-straight-arc),angle:Math.PI};
 }};
}
const runLayouts=new WeakMap();
function layoutFor(state,run,rotation){
 const first=run[0],reach=(run.length-1)*6,cache=runLayouts.get(first);
 if(cache&&cache.world===state.world&&cache.rotation===rotation&&cache.length===run.length&&cache.x===first.x&&cache.y===first.y&&cache.count===state.buildings?.length&&cache.lakes===state.world?.lakes)return cache.path;
 const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][rotation];
 const contours=lakeContours(state);
 const bank=run.length===1?bankFieldLayout({...first,rotation},state):null;
 const rim=2.65;
 const left=bank?bank(-rim,0).x:-rim,right=bank?bank(rim,0).x:rim;
 const near=bank?bank(0,-rim).z:-rim,far=bank?bank(0,rim).z:rim+reach;
 const middle=(left+right)/2;

 const sizeX=worldWidth(state),sizeY=worldHeight(state);
 const safe=(side,along)=>{
  if(!bank&&(Math.abs(side)>2.91||along< -2.91||along>reach+2.91))return false;
  if(bank&&(side<bank(-rim,along).x-.07||side>bank(rim,along).x+.07||
    along<bank(side,-rim).z-.07||along>bank(side,rim).z+.07))return false;
  const x=first.x+(dx*along+dy*side)/6,y=first.y+(dy*along-dx*side)/6;
  return x>=-.5&&y>=-.5&&x<=sizeX-.5&&y<=sizeY-.5&&renderedShoreDistance(x,y,state,contours)>.025;
 };
 // Include muzzle, outer hooves and driver. A wet outer row can still leave a
 // complete working corridor on a narrower dry strip of the same plot.
 const footprint=[[ -1.05,1],[1.05,1],[-1.05,-.97],[1.05,-.97],[-.23,-2.39],[.23,-2.39]];
 const fitsAt=({side,along,angle})=>{
  const c=Math.cos(angle),s=Math.sin(angle);
  return footprint.every(([l,f])=>safe(side+c*l+s*f,along+c*f-s*l));
 };
 const fits=path=>{
  const steps=Math.ceil(path.length/.22);
  for(let i=0;i<=steps;i++)if(!fitsAt(path.at(path.length*i/steps)))return false;
  return true;
 };
 let path=furrows(Math.max(-.43,near+2.40),Math.min(reach+.22,far-2.40),middle,.96);
 if(path.length<=Math.PI*.96||!fits(path)){
  path=null;
  // Walk along the centre of the cropped bank in either direction. The oxen
  // are wider than the driver, so reversing can fit a tapering headland.
  const centerZ=(far+near)/2;
  const rowAngle=bank?Math.atan2(bank(0,1).x-bank(0,-1).x,2):0;
  const bankAngle=bank&&right-left>far-near?Math.atan2(2,bank(1,0).z-bank(-1,0).z):rowAngle;
  for(const angle of new Set([rowAngle,rowAngle+Math.PI,bankAngle,bankAngle+Math.PI])){
   const cs=Math.cos(angle),sn=Math.sin(angle);
   for(const shift of [0,-.35,.35,-.75,.75,-1.1,1.1]){
    const alongLine=d=>({side:middle+shift*cs+d*sn,along:centerZ-shift*sn+d*cs,angle,bend:0});
    const extent=3+reach/2;let start=null;
    for(let d=-extent;d<=extent+.05;d+=.1){
     if(!fitsAt(alongLine(d))){start=null;continue;}
     if(start===null)start=d;
     const length=d-start;
     if(length>=.40&&length>(path?.length||0)){const begin=start;path={length,at:travel=>alongLine(begin+travel)};}
    }
   }
   // On a broad dry lane, favour the furrow direction over a cross-field pass.
   if(path?.length>=1.25+reach)break;
  }
 }
 runLayouts.set(first,{world:state.world,rotation,length:run.length,x:first.x,y:first.y,count:state.buildings?.length,lakes:state.world?.lakes,path});
 return path;
}

function ploughPass(state,run,driver,rotation,operation){
 if(!driver)return null;
 const path=layoutFor(state,run,rotation);if(!path)return null;
 const progress=run.reduce((n,b)=>n+(operation==='preparing'?(b.crop.tilled||0):b.crop.sown),0)/run.length;
 const travelMetres=progress*path.length,{side,along,angle,bend=angle}=path.at(travelMetres);
 const [first]=run,[dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][rotation];
 const yaw=rotation*Math.PI/2+angle,s=Math.sin(yaw),c=Math.cos(yaw);
 // Track the midpoint between the oxen: each animal follows its own arc in its forward direction.
 const x=first.x+(dx*along+dy*side-s*.55)/6,y=first.y+(dy*along-dx*side-c*.55)/6;
 const at=(l,f)=>({x:x+(c*l+s*f)/6,y:y+(c*f-s*l)/6});
 const ground=run[Math.max(0,Math.min(run.length-1,Math.round(along/6)))];
 return {key:buildingKey(first),driverId:driver.id,x,y,yaw,progress,travelMetres,operation,oxTravel:[travelMetres+bend*PLOUGH_OX_OFFSET,travelMetres-bend*PLOUGH_OX_OFFSET],fieldDepth:ground.x+ground.y,oxen:[at(-PLOUGH_OX_OFFSET,.55),at(PLOUGH_OX_OFFSET,.55)],driver:at(0,PLOUGH_DRIVER_OFFSET),handles:{l:at(-PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD),r:at(PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD)}};
}
