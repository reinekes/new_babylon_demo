import {riverLocal,worldFromRiver,worldWidth,worldHeight} from '../world.js';
import {renderedRiverCenter,RIVER_HALF_WIDTH} from './shore-profile.js';
import {footprintSize} from '../footprints.js';

const trips=new WeakMap();
export function waterCarrierAtBank(s,c){
 const t=c.waterTrip;
 if(!t||t.fire||!['source','fill','deliver'].includes(t.phase)||t.phase==='deliver'&&t.elapsed<2-1e-7)return c;
 const end=t.phase==='source'?t.route.at(-1):t.phase==='deliver'?t.route[0]:c;
 if(!end)return c;
 const distance=Math.hypot(end.x-c.x,end.y-c.y);
 if(distance>.85||t.phase==='source'&&t.index<t.route.length-1||t.phase==='deliver'&&t.index>3)return c;
 let saved=trips.get(t);
 if(!saved||saved.endX!==end.x||saved.endY!==end.y){
  const p=riverLocal(end.x,end.y,s),center=renderedRiverCenter(p.along,s),side=Math.sign(p.across-center)||1;
  if(Math.abs(p.across-center)>2.6)return c;
  let stand=null,water=null;
  for(const offset of [0,.33,-.33,.67,-.67,1,-1,1.4,-1.4]){
   const along=p.along+offset,edge=renderedRiverCenter(along,s)+side*RIVER_HALF_WIDTH;
   const q=worldFromRiver(edge+side*.05,along,s),w=worldFromRiver(edge-side*.065,along,s);
   if(q.x<-.49||q.x>worldWidth(s)-.51||q.y<-.49||q.y>worldHeight(s)-.51)continue;
   const blocked=[.2,.4,.6,.8,1].some(k=>{const x=end.x+k*(q.x-end.x),y=end.y+k*(q.y-end.y);return s.buildings.some(b=>{if(['road','bridge','canal','field'].includes(b.type))return false;const n=footprintSize(b);return x>b.x-.47&&x<b.x+n-.53&&y>b.y-.47&&y<b.y+n-.53;});});
   if(!blocked){stand=q;water=w;break;}
  }
  saved={endX:end.x,endY:end.y,stand,water};trips.set(t,saved);
 }
 if(!saved.stand)return c;
 const blend=t.phase==='fill'?1:1-distance/.85;
 return {...c,x:c.x+(saved.stand.x-end.x)*blend,y:c.y+(saved.stand.y-end.y)*blend,walking:t.phase!=='fill',waterDip:saved.water};
}
export function dipWaterVessel(B,a,waterHeight){
 if(!a.fillJar)return;
 const inverse=a.root.computeWorldMatrix(true).clone().invert(),p=a.c.waterDip,hand=a.hands.r;
 hand.computeWorldMatrix(true);const grip=hand.getAbsolutePosition();
 const lower=Math.sin(Math.PI*Math.min(1,Math.max(0,a.c.activity.progress)))**.7;
 const start=grip.add(new B.Vector3(0,-.22,0)),end=p?new B.Vector3(p.x*6,waterHeight-.008,p.y*6):start;
 const jar=B.Vector3.Lerp(start,end,lower);
 a.fillJar.position.copyFrom(B.Vector3.TransformCoordinates(jar,inverse));a.fillJar.computeWorldMatrix(true);
 const top=jar.add(new B.Vector3(0,.11,0));
 B.MeshBuilder.CreateLines('water-vessel-cord',{points:[B.Vector3.TransformCoordinates(grip,inverse),B.Vector3.TransformCoordinates(top,inverse)],instance:a.fillRope},a.root.getScene());
}
