import {fieldCalendar} from './crop-calendar.js';
import {fieldResting} from './field-soil.js';
import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {isWorkday,visibleCitizens} from './workforce.js';
import {isDryPoint} from './world.js';
import {fieldPatches} from './field-patches.js';

// A visual pass follows actual sowing progress. Dimensions are in scene metres.
export const PLOUGH_OX_SCALE=.72;
export const PLOUGH_OX_OFFSET=.70;
export const PLOUGH_YOKE_HEIGHT=.91;
export const PLOUGH_DRIVER_OFFSET=-1.65;
export const PLOUGH_HANDLE_FORWARD=-1.44;
export const PLOUGH_HANDLE_HEIGHT=.94;
export const PLOUGH_HANDLE_SPREAD=.18;

export function ploughTeams(state,people){
 if(!isStrictSumer(state)||!isWorkday(state.simTime)||state.funeral||state.festival?.phase==='feast')return [];
 const fields=new Map(),patches=fieldPatches(state.buildings);
 const eligible=b=>state.season===fieldCalendar(state,b).sow&&isOperational(b)&&!fieldResting(state,b)&&b.crop&&!(b.crop.sheaves>1e-8);
 for(const b of patches.keys())if(eligible(b)&&b.crop.sown<1-1e-8&&b.crop.seedStock>1e-8)fields.set(buildingKey(b),b);
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
  const line=group.plots.filter(b=>eligible(b)&&(b.crop.seedStock>1e-8||b.crop.sown>=1-1e-8)&&(!dx?b.x===field.x:b.y===field.y));
  const projection=b=>b.x*dx+b.y*dy;
  const along=new Map(line.map(b=>[projection(b),b])),seed=projection(field);
  let start=seed,end=seed;
  while(along.has(start-1))start--;
  while(along.has(end+1))end++;
  const run=[];for(let n=start;n<=end;n++)run.push(along.get(n));
  const driver=run.map(b=>drivers.get(buildingKey(b))).filter(Boolean).sort((a,b)=>a.id-b.id)[0];
  const team=ploughPass(state,run,driver,rotation);
  if(team){teams.push(team);for(const plot of run)seen.add(plot);}
  else if(run.length>1){const solo=ploughPass(state,[field],drivers.get(buildingKey(field)),rotation);if(solo)teams.push(solo);}
 }
 return teams;
}

function ploughPass(state,run,driver,rotation){
 if(!driver)return null;
 const [first]=run,[dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][rotation];
 const progress=run.reduce((n,b)=>n+Math.max(0,b.crop.sown),0)/run.length;
 const span=run.length-1+.25,offset=-.125;
 // Check the whole sweep, including the trailing driver, yoke and oxen. A
 // clipped bank uses the existing narrow pass if the long one has no room.
 const point=(distance,side=0)=>({x:first.x+dx*distance+dy*side,y:first.y+dy*distance-dx*side});
 const samples=Math.max(2,Math.ceil(span*5));
 for(let i=0;i<=samples;i++)for(const side of [-1/6,0,1/6]){
  const p=point(offset-.283+(span+.54)*i/samples,side);
  if(!isDryPoint(state,p.x,p.y))return null;
 }
 const distance=offset+progress*span,origin=point(distance),ground=run[Math.max(0,Math.min(run.length-1,Math.round(distance)))];
 const at=(side,forward)=>point(distance+forward/6,side/6);
 return {key:buildingKey(first),driverId:driver.id,...origin,yaw:rotation*Math.PI/2,progress,travelMetres:progress*span*6,fieldDepth:ground.x+ground.y,oxen:[at(-PLOUGH_OX_OFFSET,.55),at(PLOUGH_OX_OFFSET,.55)],driver:at(0,PLOUGH_DRIVER_OFFSET),handles:{l:at(-PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD),r:at(PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD)}};
}
