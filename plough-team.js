import {buildingKey,isOperational} from './definitions.js';
import {isStrictSumer} from './scenario-profiles.js';
import {isWorkday,visibleCitizens} from './workforce.js';
import {isDryPoint} from './world.js';

// A visual pass follows actual sowing progress. Dimensions are in scene metres.
export const PLOUGH_OX_SCALE=.72;
export const PLOUGH_OX_OFFSET=.70;
export const PLOUGH_YOKE_HEIGHT=.91;
export const PLOUGH_DRIVER_OFFSET=-1.65;
export const PLOUGH_HANDLE_FORWARD=-1.44;
export const PLOUGH_HANDLE_HEIGHT=.94;
export const PLOUGH_HANDLE_SPREAD=.18;

export function ploughTeams(state,people){
 if(!isStrictSumer(state)||state.season!==0||!isWorkday(state.simTime)||state.funeral||state.festival?.phase==='feast')return [];
 const fields=new Map();
 for(const b of state.buildings){
  if(b.type==='field'&&isOperational(b)&&b.crop?.sown<1-1e-8&&b.crop.seedStock>1e-8&&!(b.crop.sheaves>1e-8))fields.set(buildingKey(b),b);
 }
 if(!fields.size)return [];
 const drivers=new Map();
 for(const c of people??visibleCitizens(state)){
  if(c.phase!=='working'||c.age<16||c.carrying||c.walking||c.guarding||c.controlled||c.eventContact||c.festivalContact||!fields.has(c.work))continue;
  if(!drivers.has(c.work)||c.id<drivers.get(c.work).id)drivers.set(c.work,c);
 }
 return [...drivers].map(([key,driver])=>{
  const field=fields.get(key),progress=Math.max(0,field.crop.sown),travel=(progress-.5)*1.5;
  const rotation=(((field.rotation||0)%4)+4)%4;
  const [dx,dy]=[[0,1],[1,0],[0,-1],[-1,0]][rotation];
  const origin={x:field.x+dx*travel/6,y:field.y+dy*travel/6};
  const at=(side,forward)=>({x:origin.x+(dy*side+dx*forward)/6,y:origin.y+(-dx*side+dy*forward)/6});
  const team={key,driverId:driver.id,...origin,yaw:rotation*Math.PI/2,progress,fieldDepth:field.x+field.y,oxen:[at(-PLOUGH_OX_OFFSET,.55),at(PLOUGH_OX_OFFSET,.55)],driver:at(0,PLOUGH_DRIVER_OFFSET),handles:{l:at(-PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD),r:at(PLOUGH_HANDLE_SPREAD,PLOUGH_HANDLE_FORWARD)}};
  // Check the full pass so the team doesn't disappear midway on a clipped bank.
  const dry=[-2.45,0,2.45].every(forward=>[-1,0,1].every(side=>
   isDryPoint(state,field.x+(dy*side+dx*forward)/6,field.y+(-dx*side+dy*forward)/6)));
  return dry?team:null;
 }).filter(Boolean);
}
