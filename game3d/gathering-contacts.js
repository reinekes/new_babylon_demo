import {resourceDisplayLayout} from './nature-details.js';
import {extractionStockFraction} from '../extraction-stock.js';
import {mineralWorkingPoint} from './mineral-excavation.js';
import {vegetationBankDistance} from './valley-vegetation.js';

const stands=new WeakMap();
const resources={logging:'forest',garden:'dates',reed:'reed',clay:'clay',quarry:'stone'};
export function gatheringContact(s,c){
 const a=c.activity,kind=resources[a?.task];
 if(!kind||a.target?.type||!a.target||c.carrying||c.walking||!['working','strike'].includes(a.stage))return null;
 const t=a.target,site={...t,kind},scale=['dates','clay','stone'].includes(kind)?Math.cbrt(extractionStockFraction(s,site)):1;
 const key=c.id+':'+c.x+','+c.y+':'+scale,cached=stands.get(t);
 if(cached?.key===key)return cached.value;
 let target=t;
 if(!t.id||t.id.startsWith('deposit:')){
  if(['dates','forest','reed'].includes(kind)){
   const choices=resourceDisplayLayout(site).filter(p=>kind!=='dates'||vegetationBankDistance(p.x,p.y,s)>.22);
   if(choices.length)target=choices.reduce((best,p)=>Math.hypot(p.x-c.x,p.y-c.y)<Math.hypot(best.x-c.x,best.y-c.y)?p:best);
  }
 }
 const dx=target.x-c.x,dy=target.y-c.y,len=Math.hypot(dx,dy)||1,ux=dx/len,uy=dy/len;
 let contact;
 if(kind==='stone'||kind==='clay'){
  // Strike the exposed material just in front of the planted feet; its height
  // is sampled from the same rendered pit and outcrop as the worker's footing.
  const distance=Math.min(len,kind==='stone'?.09:.12);
  contact=mineralWorkingPoint(s,site,c,scale)||{stand:{x:c.x,y:c.y},target:{x:c.x+ux*distance,y:c.y+uy*distance,height:.035}};
 }else if(kind==='dates'&&target!==t){
  // Select a fruit on the side facing into the orchard. The rim is kept free
  // for passage, and the picker can reach the actual bunch from inside.
  const garden=s.buildings?.find(b=>b.type==='garden'&&b.x+','+b.y===c.work);
  const centre=garden?{x:garden.x+((garden.footprint||1)-1)/2,y:garden.y+((garden.footprint||1)-1)/2}:c;
  const angle=Math.atan2(centre.y-target.y,centre.x-target.x),yaw=(target.x+target.y)*2.399;
  const bunch=Math.round((angle+yaw)/(Math.PI*2/5))*Math.PI*2/5-yaw;
  const radius=.5*.72*scale,hookDistance=radius+.68;
  const stand={x:target.x+Math.cos(bunch)*hookDistance/6,y:target.y+Math.sin(bunch)*hookDistance/6};
  contact={stand,target:{x:target.x+Math.cos(bunch)*radius/6,y:target.y+Math.sin(bunch)*radius/6,height:5.15*.72-.43*.72*scale},via:[{x:c.x,y:c.y},stand]};
 }else{
  const gap={forest:.86,reed:.44,dates:1.14}[kind]/6;
  const stand={x:target.x-ux*gap,y:target.y-uy*gap};
  contact={stand,target:{x:target.x-ux*(kind==='forest'?.012:0),y:target.y-uy*(kind==='forest'?.012:0),height:{forest:.92,reed:.74,dates:3.38}[kind]}};
 }
 const value={...contact,kind:'gathering-site',task:a.task,building:null,seatHeight:kind==='stone'?.46:kind==='clay'?.58:undefined};
 stands.set(t,{key,value});return value;
}

export const gatheringToolLength={quarry:.83,logging:.46,reed:.15,clay:.89,garden:2.47};
