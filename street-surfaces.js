import {footpathRibbonPoint,footpathRibbonTangent,streetCurveLookup,visibleFootpaths} from './footpaths.js';
import {navigationSegmentClear} from './navigation.js';
import {isDryPoint,onBridge} from './world.js';
import {TILE} from './district3d/terrain.js';

// Widths include the faded shoulders, in metres. Recent walking changes the
// width of either surface; permanent paving retains its own minimum width.
export function streetSurfaceLayout(s,paved){
 const tracks=visibleFootpaths(s),wear=new Map(tracks.map(p=>[p.id,p.traffic]));
 const builtIds=new Set(paved.map(p=>p.id)),curve=streetCurveLookup(s),surfaces=new Map(),joins=new Map(),ends=new Map();
 function add(edge,built){
  const {id,a,b}=edge,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
  if(!length)return;
  const traffic=Math.round((wear.get(id)||0)*16)/16;
  const width=built ? .90+(edge.level||1)*.10+traffic*2.22 : .32+traffic*2.66;
  const control=built?curve(a,b,id):edge.control;
  // At a crossing a narrow branch keeps its own shoulders. Only successive
  // sections of the same street share a width, irrespective of edge direction.
  const direction=dx<0||(!dx&&dy<0)?-1:1;
  const axis=Math.round(dx/length*direction*1000)+','+Math.round(dy/length*direction*1000);
  const profile={id,a,b,built,control,traffic,width,start:width,end:width};
  surfaces.set(id,profile);
  for(const [point,side] of [[a,'start'],[b,'end']]){
   const corner=point.x+','+point.y,key=corner+'/'+axis;
   const first=ends.get(corner);
   if(!first){ends.set(corner,{profile,side});profile[side+'Tip']=true;}
   else first.profile[first.side+'Tip']=false;
   let junction=joins.get(key);if(!junction){junction=[];joins.set(key,junction);}
   junction.push({profile,side});
  }
 }
 for(const r of paved)add(r,true);
 for(const r of tracks)if(!builtIds.has(r.id))add(r,false);
 for(const entries of joins.values()){
  if(entries.length<2)continue;
  const width=entries.reduce((n,e)=>n+e.profile.width,0)/entries.length;
  for(const {profile,side} of entries)profile[side]=width;
 }
 return surfaces;
}

export function streetEndFade(profile,t){
 if(typeof profile==='number')return 1;
 const distance=Math.min(profile.startTip?t:1,profile.endTip?1-t:1);
 const u=Math.min(1,distance/.16);
 return u*u*(3-2*u);
}

export function streetWidthAt(profile,t){
 if(typeof profile==='number')return profile;
 const ease=Math.min(1,Math.min(t,1-t)/.38),mix=ease*ease*(3-2*ease),joint=t<.5?profile.start:profile.end;
 return (joint+(profile.width-joint)*mix)*(.38+.62*streetEndFade(profile,t));
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
  const t=j/steps*progress,p=footpathRibbonPoint(a,b,control,t);
  const {x:vx,y:vz}=footpathRibbonTangent(a,b,control,t);
  const tangent=Math.hypot(vx,vz)||1,nx=-vz/tangent,nz=vx/tangent;
  const x=p.x*TILE,z=p.y*TILE;
  const half=streetWidthAt(width,t)*.5*(.98+.035*Math.sin(x*.7+z*.34)+.022*Math.sin(x*1.03-z*.58)),reach=half*1.045/TILE;
  const row={t,p,x,z,nx,nz,half,reach,trimLeft:1,trimRight:1};
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   row[key]=safeFraction(k=>dryClearance(s,p,shoulderPoint(row,side,k),obstacles));
  }
  rows.push(row);
 }
 // The outer edge between two legal samples can still nick a courtyard corner.
 // Limit the whole span, sharing the most restrictive width at each junction.
 for(let j=1;j<=steps;j++){
  const a=rows[j-1],b=rows[j];
  for(const side of [-1,1]){
   const key=side<0?'left':'right';
   const scale=safeFraction(k=>dryClearance(s,shoulderPoint(a,side,a[key]*k),shoulderPoint(b,side,b[key]*k),obstacles));
   const trim=side<0?'trimLeft':'trimRight';
   a[trim]=Math.min(a[trim],scale);b[trim]=Math.min(b[trim],scale);
  }
 }
 return rows;
}
