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
 const tracks=visibleFootpaths(s),wear=new Map(tracks.map(p=>[p.id,p.traffic]));
 const builtIds=new Set(paved.map(p=>p.id)),curve=streetCurveLookup(s),surfaces=new Map(),junctions=new Map(),diagonals=new Map(),crossings=[];
 let obstacles;
 function add(edge,built){
  const {id,a,b}=edge,length=Math.hypot(b.x-a.x,b.y-a.y);
  if(!length)return;
  const traffic=Math.round((wear.get(id)||0)*16)/16;
  const width=built ? .90+(edge.level||1)*.10+traffic*2.22 : .32+traffic*2.66;
  const control=built?curve(a,b,id):edge.control;
  const cover=built?1:.30+.67*traffic;
  const profile={id,a,b,built,control,traffic,width,length,start:width,end:width,
   startTraffic:traffic,endTraffic:traffic,cover,startCover:cover,endCover:cover};
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
   const score=-dot+.32*Math.min(a.profile.width,b.profile.width);
   if(score>best){best=score;pair=[a,b];}
  }
  const [a,b]=pair,jointWidth=(a.profile.width+b.profile.width)/2;
  a.profile[a.side]=b.profile[b.side]=jointWidth;
  a.profile[a.side+'Traffic']=b.profile[b.side+'Traffic']=(a.profile.traffic+b.profile.traffic)/2;
  a.profile[a.side+'Cover']=b.profile[b.side+'Cover']=(a.profile.cover+b.profile.cover)/2;
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
  if(!legal){delete a.profile[a.side+'Turn'];delete b.profile[b.side+'Turn'];}
 }
 for(const [a,b] of crossings)blendCrossedDiagonals(a,b);
 for(const p of surfaces.values()){
  p.shapeKey=['start','end'].map(side=>{
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

// Both views trim the very same cross-sections against real plots and shores.
// reach has a small margin for the frayed edge of the WebGL mesh.
export function streetCrossSections(s,a,b,width,control,obstacles,steps,progress=1){
 const origin={x:(a.x+b.x)*TILE/2,z:(a.y+b.y)*TILE/2},len=Math.hypot(a.x-b.x,a.y-b.y);
 const rows=[];
 if(!len||progress<=0||!isDryPoint(s,a.x,a.y)||!isDryPoint(s,b.x,b.y)||onBridge(s.buildings||[],origin.x/TILE,origin.z/TILE,s)||!navigationSegmentClear(s,a,b,obstacles))return [];
 for(let j=0;j<=steps;j++){
  const t=j/steps*progress;
  const {p,v}=typeof width==='number'?{p:footpathRibbonPoint(a,b,control,t),v:footpathRibbonTangent(a,b,control,t)}:pointOnStreet(width,t);
  const {x:vx,y:vz}=v;
  const tangent=Math.hypot(vx,vz)||1,nx=-vz/tangent,nz=vx/tangent;
  const x=p.x*TILE,z=p.y*TILE;
  const half=streetWidthAt(width,t)*.5*(.98+.035*Math.sin(x*.7+z*.34)+.022*Math.sin(x*1.03-z*.58)),reach=half*1.045/TILE;
  const row={t,p,x,z,nx,nz,half,reach,trimLeft:1,trimRight:1};
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
