import {footpathRibbonPoint,footpathRibbonTangent,streetCurveLookup,visibleFootpaths} from './footpaths.js';
import {navigationSegmentClear,obstacleIndex} from './navigation.js';
import {isDryPoint,onBridge} from './world.js';
import {TILE} from './district3d/terrain.js';

const smooth=t=>{const u=Math.max(0,Math.min(1,t));return u*u*(3-2*u);};

// Where two lanes turn a corner, round both halves of the turn together.
// The displacement and tangent agree at the shared cross-section.
function pointOnStreet(profile,t){
 const {a,b,control}=profile,p=footpathRibbonPoint(a,b,control,t),v=footpathRibbonTangent(a,b,control,t);
 const start=t<.5,turn=start?profile.startTurn:profile.endTurn;
 if(turn){
  const distance=(start?t:1-t)*turn.speed;
  if(distance<turn.span){
   const u=1-distance/turn.span,k=turn.span*.25*u*u;
   p.x+=turn.x*k;p.y+=turn.y*k;
   const slope=(start?-1:1)*.5*turn.speed*u;
   v.x+=turn.x*slope;v.y+=turn.y*slope;
  }
 }
 return {p,v};
}
function joinDirection(profile,start){
 const v=footpathRibbonTangent(profile.a,profile.b,profile.control,start?0:1);
 const length=Math.hypot(v.x,v.y),sign=start?1:-1;
 return {x:v.x/length*sign,y:v.y/length*sign,speed:length};
}

// Two diagonals of one block can also cross between route nodes. Find the
// actual intersection of their curved centre lines and let the wider surface
// carry through it, just as at a T. No walking node is created here.
function blendCrossedDiagonals(a,b){
 const main=a.width>b.width||(a.width===b.width&&a.id<b.id)?a:b;
 const branch=main===a?b:a;
 if(main.width<1.15)return;
 let t=.5,u=.5;
 for(let i=0;i<3;i++){
  const m=pointOnStreet(main,u),n=pointOnStreet(branch,t);
  const dx=n.p.x-m.p.x,dy=n.p.y-m.p.y,det=n.v.x*m.v.y-n.v.y*m.v.x;
  if(Math.abs(det)<1e-5)return;
  t-=(dx*m.v.y-dy*m.v.x)/det;
  u-=(dx*n.v.y-dy*n.v.x)/det;
 }
 if(t<=0||t>=1||u<=0||u>=1)return;
 branch.crossing={t,span:Math.min(.25,main.width*.56/(TILE*branch.length))};
}

// Width is measured across the worn area and both shoulders, in metres.
export function streetSurfaceLayout(s,paved){
 const tracks=visibleFootpaths(s),wear=new Map(tracks.map(p=>[p.id,p]));
 const builtIds=new Set(paved.map(p=>p.id)),curve=streetCurveLookup(s),surfaces=new Map(),junctions=new Map(),diagonals=new Map(),crossings=[];
 let obstacles;
 function add(edge,built){
  const {id,a,b}=edge,length=Math.hypot(b.x-a.x,b.y-a.y);
  if(!length)return;
  const track=wear.get(id),traffic=Math.round((track?.traffic||0)*16)/16;
  const cartTraffic=built&&edge.level>=3?0:Math.round((track?.cartTraffic||0)*8)/8;
  const wornWidth=built ? .65+(edge.level||1)*.08+traffic*1.50 : .24+traffic*1.67;
  const width=cartTraffic?Math.max(wornWidth,1.54+.90*cartTraffic):wornWidth;
  const control=built?curve(a,b,id):edge.control;
  // Even sustained walking compacts patches of the existing silt. A laid
  // surface or a wheel track exposes a much more continuous strip of earth.
  const cover=built?1:cartTraffic?Math.max(.30+.67*traffic,.70+.24*cartTraffic):.10+.14*traffic;
  const profile={id,a,b,built,control,traffic,width,length,start:width,end:width,
   cartTraffic,startCart:0,endCart:0,startTraffic:traffic,endTraffic:traffic,cover,startCover:cover,endCover:cover};
  surfaces.set(id,profile);
  if(Math.abs(a.x-b.x)===1&&Math.abs(a.y-b.y)===1){
   const cell=Math.min(a.x,b.x)+','+Math.min(a.y,b.y);
   const first=diagonals.get(cell);
   if(first)crossings.push([first,profile]);else diagonals.set(cell,profile);
  }
  for(const [point,side] of [[a,'start'],[b,'end']]){
   const key=point.x+','+point.y;
   let at=junctions.get(key);if(!at){at=[];junctions.set(key,at);}
   at.push({profile,side,direction:joinDirection(profile,side==='start')});
  }
 }
 for(const r of paved)add(r,true);
 for(const r of tracks)if(!builtIds.has(r.id))add(r,false);
 for(const arms of junctions.values()){
  if(arms.length===1){
   const {profile,side}=arms[0];profile[side+'Tip']=true;continue;
  }
  // Opposing approaches carry through the junction. Weigh alignment first,
  // then favour a visibly established street at a four-way crossing.
  let best=-Infinity,pair;
  for(let i=0;i<arms.length;i++)for(let j=i+1;j<arms.length;j++){
   const a=arms[i],b=arms[j],dot=a.direction.x*b.direction.x+a.direction.y*b.direction.y;
   const wheelTurn=Math.min(a.profile.cartTraffic,b.profile.cartTraffic);
   const score=-dot+.32*Math.min(a.profile.width,b.profile.width)+(wheelTurn?1.25+.3*wheelTurn:0);
   if(score>best){best=score;pair=[a,b];}
  }
  const [a,b]=pair,jointWidth=(a.profile.width+b.profile.width)/2;
  a.profile[a.side]=b.profile[b.side]=jointWidth;
  a.profile[a.side+'Traffic']=b.profile[b.side+'Traffic']=(a.profile.traffic+b.profile.traffic)/2;
  a.profile[a.side+'Cover']=b.profile[b.side+'Cover']=(a.profile.cover+b.profile.cover)/2;
  if(a.profile.cartTraffic&&b.profile.cartTraffic){
   a.profile[a.side+'Cart']=b.profile[b.side+'Cart']=(a.profile.cartTraffic+b.profile.cartTraffic)/2;
  }
  if(arms.length>2){
   for(const arm of arms)if(arm!==a&&arm!==b){
    // The main street already covers the ground at the meeting point.
    arm.profile[arm.side+'Blend']=Math.min(.38,.80*jointWidth/(TILE*arm.profile.length));
   }
  }
  const x=a.direction.x+b.direction.x,y=a.direction.y+b.direction.y,magnitude=Math.hypot(x,y);
  if(magnitude<.14)continue;
  const turn={x,y,span:Math.min(.39*Math.min(a.direction.speed,b.direction.speed),
   (.70+jointWidth*.63)/TILE,1.37*jointWidth/(magnitude*TILE))};
  a.profile[a.side+'Turn']={...turn,speed:a.direction.speed};
  b.profile[b.side+'Turn']={...turn,speed:b.direction.speed};
  obstacles??=obstacleIndex(s.buildings||[]);
  // A corner can only round off if its inside shoulder is on accessible land.
  const legal=pair.every(({profile,side,direction})=>{
   let last;
   for(let i=0;i<=4;i++){
    const d=turn.span/direction.speed*i/4,t=side==='start'?d:1-d;
    const {p}=pointOnStreet(profile,t);
    if(!dryClearance(s,last||p,p,obstacles)||onBridge(s.buildings||[],p.x,p.y,s))return false;
    last=p;
   }
   return true;
  });
  if(!legal){
   // A rounded corner would cut through this plot. Let both arms disappear
   // into its bare earth before their mismatched cross-sections meet.
   for(const arm of pair){
    delete arm.profile[arm.side+'Turn'];
    arm.profile[arm.side+'Blend']=Math.min(.32,jointWidth*.65/(TILE*arm.profile.length));
   }
  }
 }
 for(const [a,b] of crossings)blendCrossedDiagonals(a,b);
 for(const p of surfaces.values()){
  p.shapeKey=[p.cartTraffic,p.startCart,p.endCart].join(',')+'/'+['start','end'].map(side=>{
   const turn=p[side+'Turn'];return [p[side],p[side+'Traffic'],p[side+'Cover'],p[side+'Tip']?1:0,p[side+'Blend']||0,turn?.x,turn?.y,turn?.span,turn?.speed].join(',');
  }).join('/')+(p.crossing?'/'+p.crossing.t+','+p.crossing.span:'');
 }
 return surfaces;
}

export function streetEndFade(profile,t){
 if(typeof profile==='number')return 1;
 const crossing=profile.crossing;
 let opacity=crossing? .18+.82*smooth(Math.abs(t-crossing.t)/crossing.span) : 1;
 for(const side of ['start','end']){
  const distance=side==='start'?t:1-t;
  const blend=profile[side+'Blend'];
  if(blend)opacity*=smooth((distance/blend-.18)/.82);
  else if(profile[side+'Tip'])opacity*=smooth(distance/(.14+.07*Math.min(2,profile.width)));
 }
 return opacity;
}

// Carry wear and visibility through the same length of ground as the width.
function blendAlongStreet(value,start,end,t){
 const first=t<.5,distance=first?t:1-t,joint=first?start:end;
 return joint+(value-joint)*smooth(distance/.46);
}
export function streetTrafficAt(profile,t){
 return typeof profile==='number'?0:blendAlongStreet(profile.traffic,profile.startTraffic??profile.traffic,profile.endTraffic??profile.traffic,t);
}
export function streetCoverAt(profile,t){
 return typeof profile==='number'?1:blendAlongStreet(profile.cover??1,profile.startCover??1,profile.endCover??1,t);
}

// One metre between wheel centres, in world metres. The grooves shallow and
// disappear on harder patches. Their position and pressure agree across joins
// even when neighbouring edges were saved in opposite directions.
export function streetWheelSection(profile,row){
 if(!profile.cartTraffic)return null;
 const {x,z,half,t}=row;
 const cart=blendAlongStreet(profile.cartTraffic,profile.startCart,profile.endCart,t);
 const softness=smooth(.66+.45*Math.sin(.49*x+.33*z)+.23*Math.sin(.73*z-.19*x));
 const gauge=Math.min(.505+.018*Math.sin(.24*x-.32*z),half*.65)/half;
 const rim=Math.min(.13,half*.145)/half;
 return {gauge,rim,depth:(.45+.55*cart)*softness*smooth(cart/.18)};
}

export function streetWidthAt(profile,t){
 if(typeof profile==='number')return profile;
 const start=t<.5,distance=start?t:1-t,side=start?'start':'end';
 const width=blendAlongStreet(profile.width,profile.start,profile.end,t);
 return profile[side+'Tip']?width*(.35+.65*smooth(distance/.23)):width;
}

function dryClearance(s,a,b,index){
 return isDryPoint(s,a.x,a.y)&&isDryPoint(s,b.x,b.y)&&navigationSegmentClear(s,a,b,index);
}
function safeFraction(clear){
 if(clear(1))return 1;
 let lo=0,hi=1;
 for(let i=0;i<7;i++){const mid=(lo+hi)/2;if(clear(mid))lo=mid;else hi=mid;}
 return lo;
}
function shoulderPoint(row,side,t){
 const d=row.reach*side*t;
 return {x:row.p.x+row.nx*d,y:row.p.y+row.nz*d};
}

// A grid lane can run only 18 cm from a legal building boundary. Its visible
// pressure falls off in metres, even where collision clipping pinches a whole
// shoulder into a few centimetres. Both renderers use the same sample.
export function streetSoilCoverage(row,side,x,z,cover=1){
 const radius=Math.abs(side);
 if(radius>=1)return 0;
 const fleck=Math.sin(x*.83+z*.46)*Math.sin(z*.69-x*.27);
 const shoulder=1-smooth((radius-.08-.065*fleck)/.92);
 // World-space patches meet across segment and camera boundaries. The
 // mottling fades away where feet merge into a denser cart or paving finish.
 const packed=cover>=.70?1:1-(1-smooth(cover/.70))*(.55-.43*fleck);
 let distanceSquared=1;
 for(const box of row.plots){
  const dx=Math.max(box.minX-x,0,x-box.maxX),dz=Math.max(box.minZ-z,0,z-box.maxZ);
  distanceSquared=Math.min(distanceSquared,dx*dx+dz*dz);
 }
 return packed*(.85+.045*fleck)*shoulder*smooth((Math.sqrt(distanceSquared)-.22)/.78);
}

// Both views trim the very same cross-sections against real plots and shores.
// reach has a small margin for the frayed edge of the WebGL mesh.
export function streetCrossSections(s,a,b,width,control,obstacles=obstacleIndex(s.buildings||[]),steps,progress=1){
 const origin={x:(a.x+b.x)*TILE/2,z:(a.y+b.y)*TILE/2},len=Math.hypot(a.x-b.x,a.y-b.y);
 const rows=[];
 if(!len||progress<=0||!isDryPoint(s,a.x,a.y)||!isDryPoint(s,b.x,b.y)||onBridge(s.buildings||[],origin.x/TILE,origin.z/TILE,s)||!navigationSegmentClear(s,a,b,obstacles))return [];
 const nearby=new Set();
 for(let y=Math.floor(Math.min(a.y,b.y)-1);y<=Math.ceil(Math.max(a.y,b.y)+1);y++){
  for(let x=Math.floor(Math.min(a.x,b.x)-1);x<=Math.ceil(Math.max(a.x,b.x)+1);x++){
   for(const box of obstacles.get(x+','+y)||[])nearby.add(box);
  }
 }
 const plots=Array.from(nearby,box=>({minX:box.minX*TILE,maxX:box.maxX*TILE,minZ:box.minY*TILE,maxZ:box.maxY*TILE}));
 for(let j=0;j<=steps;j++){
  const t=j/steps*progress;
  const {p,v}=typeof width==='number'?{p:footpathRibbonPoint(a,b,control,t),v:footpathRibbonTangent(a,b,control,t)}:pointOnStreet(width,t);
  const {x:vx,y:vz}=v;
  const tangent=Math.hypot(vx,vz)||1,nx=-vz/tangent,nz=vx/tangent;
  const x=p.x*TILE,z=p.y*TILE;
  const half=streetWidthAt(width,t)*.5*(.98+.035*Math.sin(x*.7+z*.34)+.022*Math.sin(x*1.03-z*.58)),reach=half*1.045/TILE;
  const row={t,p,x,z,nx,nz,half,reach,plots,trimLeft:1,trimRight:1};
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   const X=x+side*nx*half,Z=z+side*nz*half;
   const verge=typeof width==='number'?1:.966+.033*Math.sin(.59*X+.28*Z+1.3*Math.sin(.25*Z))+.022*Math.sin(1.03*Z-.39*X);
   row[key]=verge*safeFraction(k=>dryClearance(s,p,shoulderPoint(row,side,k*verge),obstacles));
  }
  rows.push(row);
 }
 // The outer edge between two legal samples can still nick a courtyard corner.
 // Limit the whole span, sharing the most restrictive width at each junction.
 for(let j=1;j<=steps;j++){
  const a=rows[j-1],b=rows[j];
  // On a very tight turn neighbouring inward normals can meet before the
  // full shoulder width. End both cross-sections short of that intersection.
  if(width.startTurn||width.endTurn){
   const det=a.nx*b.nz-a.nz*b.nx;
   if(Math.abs(det)>1e-6){
    const dx=b.p.x-a.p.x,dy=b.p.y-a.p.y;
    const da=(dx*b.nz-dy*b.nx)/det,db=(dx*a.nz-dy*a.nx)/det;
    if(da*db>0){
     const side=da<0?'left':'right';
     a[side]=Math.min(a[side],.94*Math.abs(da)/a.reach);
     b[side]=Math.min(b[side],.94*Math.abs(db)/b.reach);
    }
   }
  }
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   const scale=safeFraction(k=>dryClearance(s,shoulderPoint(a,side,a[key]*k),shoulderPoint(b,side,b[key]*k),obstacles));
   const trim=side<0?'trimLeft':'trimRight';
   a[trim]=Math.min(a[trim],scale);b[trim]=Math.min(b[trim],scale);
  }
 }
 return rows;
}
