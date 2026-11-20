import {artisanContact,artisanPose,hasArtisanContact} from './artisan-contacts.js';
import {isExtractionCourt,extractionWorkArea} from '../extraction-courts.js';
import {isDryPoint} from '../world.js';
import {insideFootprint,footprintSize} from '../footprints.js';
import {sheepfoldLayout,sheepfoldWorldPoint} from '../sheepfold-layout.js';
import {dairyMilkingLayout} from './dairy-layout.js';
import {lyreLayout,musicCourtyardLayout} from './music-courtyard.js';
// Shared metre-space equipment and palm targets. Pure view data: no production,
// inventory initializers, route edits or simulation coordinates enter this module.
const equipment={musicHouse:'lithophone',cowshed:'dairy',pottery:'wheel',brewery:'vat',weaver:'loom',tailor:'table',brickyard:'mould',kiln:'kiln',clay:'clay',reed:'reed',garden:'mortar',sheepfold:'fleece'};
export function workstationWorldPoint(b,[x,height,z]){
 const angle=((b.rotation||0)%4)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),snap=n=>Math.abs(n)<1e-12?0:n;
 const center=(footprintSize(b)-1)*3;
 return {x:b.x+(center+snap((x-center)*c+(z-center)*s))/6,y:b.y+(center+snap(-(x-center)*s+(z-center)*c))/6,height};
}
const stationContexts=new WeakMap();
// Only the dry terrain and multi-tile footprints block a street corner.
// Reuse that exact answer across templates until either of those changes.
export function workstationContext(state){
 const footprints=(state.buildings||[]).filter(b=>footprintSize(b)>1);
 const signature=JSON.stringify([state.world?.width,state.world?.height,state.world?.river,state.world?.lakes,footprints.map(b=>[b.x,b.y,footprintSize(b)])]);
 let cached=stationContexts.get(state);
 if(cached?.signature===signature)return cached;
 const dryCorners=new Map(),blocked=new Set();
 for(const b of footprints)for(let dx=1;dx<footprintSize(b);dx++)for(let dy=1;dy<footprintSize(b);dy++)blocked.add(`${b.x+dx-.5},${b.y+dy-.5}`);
 cached={signature,canUse(x,y){
  const key=`${x},${y}`;
  if(!dryCorners.has(key))dryCorners.set(key,!(Number.isInteger(x+.5)&&Number.isInteger(y+.5)?blocked.has(key):footprints.some(b=>insideFootprint(b,x,y)))&&isDryPoint(state,x,y));
  return dryCorners.get(key);
 }};
 stationContexts.set(state,cached);return cached;
}
export function workstationBuilding(b,state,context=null){
 if(!state||b.type==='granary'&&!b.construction||!equipment[b.type]&&!hasArtisanContact(b.type)&&!b.construction&&!['field','fishing','hunting'].includes(b.type))return b;
 // Same ordered dry corners as generateStreets, without rebuilding its whole graph.
 const n=footprintSize(b),port=[[b.x+n-.5,b.y+n-.5],[b.x-.5,b.y+n-.5],[b.x+n-.5,b.y-.5],[b.x-.5,b.y-.5]].map(([x,y])=>({x,y})).find(p=>context?context.canUse(p.x,p.y):isDryPoint(state,p.x,p.y)&&!(state.buildings||[]).some(v=>insideFootprint(v,p.x,p.y)));
 if(!port)return b;
 const angle=(b.rotation||0)*Math.PI/2,dx=port.x-b.x-(n-1)/2,dz=port.y-b.y-(n-1)/2,c=Math.cos(angle),s=Math.sin(angle);
 return {...b,workCorner:[Math.sign(dx*c-dz*s)||1,Math.sign(dx*s+dz*c)||1]};
}
export function workstationLayout(b){
 if(!equipment[b.type]||b.construction)return [];
 if(b.type==='cowshed')return [dairyMilkingLayout(b)];
 if(b.type==='sheepfold'&&footprintSize(b)===2){
  // The sorting table is on the street side of the pen, where wool is handed out.
  const [sx,sz]=b.workCorner||[1,1],{center,halfWidth}=sheepfoldLayout(b);
  return [{kind:'fleece',x:center+sx*(halfWidth-.05),z:center+sz*(halfWidth-.05),height:.95,sx,sz}];
 }
 if(b.type==='musicHouse')return [musicCourtyardLayout(b)];
 if(isExtractionCourt(b)){const area=extractionWorkArea(b);return [{kind:equipment[b.type],...area,height:.55,sx:area.x===0?-1:1,sz:area.z===0?-1:1}];}
 const corner=b.type==='clay'?2.23:1.94;
 return [b.workCorner||[1,1]].map(([sx,sz])=>({kind:equipment[b.type],x:sx*corner,z:sz*corner,height:b.type==='cowshed'?.72:b.type==='weaver'?1.05:b.type==='brewery'?.92:.95,sx,sz}));
}
function milkingApproach(b,c,stand){
 const {center,halfWidth}=sheepfoldLayout(b),edge=halfWidth+.5;
 const angle=(b.rotation||0)*Math.PI/2;
 const dx=(c.x-b.x)*6-center,dz=(c.y-b.y)*6-center;
 const localX=dx*Math.cos(angle)-dz*Math.sin(angle),localZ=dx*Math.sin(angle)+dz*Math.cos(angle);
 if(Math.abs(Math.abs(localX)-edge)>.25||Math.abs(Math.abs(localZ)-edge)>.25)return null;
 const point=(x,z)=>sheepfoldWorldPoint(b,0,x,z),via=[];
 if(localX<0)via.push(point(edge,Math.sign(localZ)*edge));
 const lane=Math.sign(localZ)*.86;
 via.push(point(edge,lane),point(halfWidth,lane),point(halfWidth-.65,lane),stand);
 return via;
}
export function workstationFor(b,c,index=0){
 if(!b?.type||!['working','strike'].includes(c.activity?.stage)||c.walking||c.carrying)return null;
 if(!b.construction&&hasArtisanContact(b.type))return artisanContact(b,c,index,workstationWorldPoint);
 const layout=b.construction||b.type==='field'?[{kind:b.construction?'building':'farming',x:(b.workCorner?.[0]||1)*(b.construction?2.72:2.62),z:(b.workCorner?.[1]||1)*(b.construction?2.72:2.62),height:b.construction?.95:c.activity.task==='harvesting'?.65:.12,sx:b.workCorner?.[0]||1,sz:b.workCorner?.[1]||1}]:workstationLayout(b);if(!layout.length)return null;
 const stations=layout.map(a=>({...a,world:workstationWorldPoint(b,[a.x,a.height,a.z])})).sort((a,d)=>Math.hypot(a.world.x-c.x,a.world.y-c.y)-Math.hypot(d.world.x-c.x,d.world.y-c.y));
 if(b.type==='musicHouse'&&c.activity.task==='lyre'){
  const a=lyreLayout(b),stand=workstationWorldPoint(b,[a.x,0,a.z+a.sz*.48]),target=workstationWorldPoint(b,[a.x,1.04,a.z]);
  return Math.hypot(stand.x-c.x,stand.y-c.y)>.50?null:{kind:'lyre',task:'lyre',stand,target,building:b,layout:a};
 }
 if(b.type==='musicHouse'){const a=stations[0],stand=workstationWorldPoint(b,[a.x,0,a.z]),target=workstationWorldPoint(b,[a.x+a.sx*.325,.215,a.z+a.sz*.325]);return Math.hypot(stand.x-c.x,stand.y-c.y)>.3?null:{kind:a.kind,task:'lithophone',stand,target,axis:0,building:b,layout:a};}
 const a=stations[0],axis=index%2;
 if(a.kind==='dairy'){
  const side=axis?-a.sz:a.sz,x=a.x+a.sx*.1,z=a.z+a.sz*.1+a.sx*.094;
  const stand=workstationWorldPoint(b,[x,0,z+side*.405]),target=workstationWorldPoint(b,[x,.35,z+side*.057]);
  if(footprintSize(b)===2){
   const via=milkingApproach(b,c,stand);
   return via?{kind:a.kind,task:c.activity.task,stand,target,axis,building:b,via,aisleSpeed:2.1}:null;
  }
  return Math.hypot(stand.x-c.x,stand.y-c.y)>.52?null:{kind:a.kind,task:c.activity.task,stand,target,axis,building:b};
 }
 const standOffset=a.kind==='wheel'?.46:.48,rimOffset=a.kind==='wheel'?.10:.20,rimHeight=a.height+(a.kind==='wheel'?.08:0),stand=workstationWorldPoint(b,[a.x+(axis?a.sx*standOffset:0),0,a.z+(axis?0:a.sz*standOffset)]),rim=workstationWorldPoint(b,[a.x+(axis?a.sx*rimOffset:0),rimHeight,a.z+(axis?0:a.sz*rimOffset)]),target=['building','farming'].includes(a.kind)?a.world:rim;
 if(Math.hypot(stand.x-c.x,stand.y-c.y)>.3)return null;
 if(a.kind==='fleece')return {kind:a.kind,task:c.activity.task,stand,target,axis,building:b,via:[stand]};
 return {kind:a.kind,task:c.activity.task,stand,target,axis,building:b};
}
// Targets remain ON equipment throughout the cycle: hands turn clay, feed cloth,
// knead mud or rub grain across a surface, instead of both hovering in empty air.
export function workstationPose(contact,time){
 if(contact.kind==='artisan')return artisanPose(contact,time);
 if(contact.kind==='gathering-site'){
  const lift=(1+Math.sin(time*3.1))*.5;
  const heights={quarry:[.98,1.13],logging:[.99,1.03],reed:[.76,.79],clay:[.72,.94],garden:[1.13,1.39]};
  const tools={quarry:'quarry',logging:'logging',reed:'reed-knife',clay:'clay-hoe',garden:'date-pole'};
  const [r,l]=heights[contact.task];
  return {right:[.09,r+lift*.11,.42],left:[-.11,l+lift*.09,.45],tool:tools[contact.task],bend:contact.task==='garden'?-.06:.32,twist:lift*.055};
 }
 if(contact.kind==='healing'){const lift=(1+Math.cos(time*3))*.5;return {right:[.11,contact.target.height+lift*.035,.49],left:[-.10,contact.target.height+.025,.48],tool:'care-pad',bend:.22,twist:0};}
 const wave=Math.sin(time*3.6),lift=(1-Math.cos(time*3.6))*.5;
 const height=contact.target.height;
 if(contact.kind==='study')return {right:[.07,height+.08+.025*lift,.44],left:[-.13,height,.46],tool:'scribe-stylus',bend:.14,twist:wave*.012};
 if(contact.kind==='offering')return {right:[.04,height+.035+.14*lift,.47],left:[-.13,height+.10+.08*(1-lift),.37],tool:null,bend:.44,twist:wave*.018};
 if(contact.kind==='lithophone')return {right:[.1,.50,.49],left:[-.1,.50,.49],tool:null,bend:.50,twist:wave*.012};
 if(contact.kind==='building')return {right:[.10,1.28+lift*.13,.49],left:[-.10,height,.49],tool:'building',bend:.15,twist:wave*.012};
 if(contact.kind==='farming'&&contact.task==='harvesting')return {right:[.10,.97+lift*.06,.49],left:[-.10,.93,.49],tool:'sickle',bend:.25,twist:wave*.012};
 if(contact.kind==='farming')return {right:[.10,.89+lift*.11,.49],left:[-.10,1.03+lift*.11,.20],tool:'hoe',bend:.30,twist:wave*.012};
 if(contact.kind==='dairy')return {right:[.10,.36+lift*.02,.49],left:[-.10,.36+(1-lift)*.02,.49],tool:null,bend:.155,twist:wave*.01};
 if(contact.kind==='loom')return {right:[.12,height,.49+wave*.022],left:[-.12,height,.49-wave*.022],tool:null,bend:.08,twist:wave*.012};
 // The low vat rim needs a forward lean, keeping the near palm within the
 // supplied residents' native arm reach while the workers retain their slots.
 if(contact.kind==='vat')return {right:[.08,height+.10+lift*.04,.47],left:[-.14,height+.02,.50],tool:'stirring',bend:.5,twist:wave*.018};
 return {right:[.10,height+.045,.49+wave*.018],left:[-.10,height+.045,.49-wave*.018],tool:null,bend:.3,twist:wave*.012};
}
// World targets preserve contact under identity height/width variation and yaw.
export function workstationHands(contact,time){
 if(contact.kind==='dairy'){
  const b=contact.building,a=dairyMilkingLayout(b),x=a.x+a.sx*.1,z=a.z+a.sz*.1+a.sx*.094;
  // The imported cow faces local +/-X. Each worker grips the two near teats
  // from their own side of the rail. Their alternating strokes stay on them.
  const side=contact.axis?-a.sz:a.sz;
  const picks=[[-.09,side*.057],[.09,side*.057]];
  const dx=contact.target.x-contact.stand.x,dz=contact.target.y-contact.stand.y;
  const hands=picks.map(([u,v])=>workstationWorldPoint(b,[x+u,.365,z+v]));
  hands.sort((p,q)=>(q.x-p.x)*dz-(q.y-p.y)*dx);
  const stroke=Math.sin(time*3.6)*.014;
  hands[0].height+=stroke;hands[1].height-=stroke;
  return {right:hands[0],left:hands[1],tool:null};
 }
 if(contact.kind==='lyre'){
  const a=contact.layout,near=a.z+a.sz*.045;
  return {left:workstationWorldPoint(contact.building,[a.x-.27,1.12,near]),
   right:workstationWorldPoint(contact.building,[a.x+.16*Math.sin(time*9),1.04,near+a.sz*.06*(1+Math.cos(time*9))]),tool:null};
 }
 if(contact.kind==='lithophone'){
  const a=contact.layout,b=contact.building,beat=Math.sin(time*4),rightLift=(1+beat)*.065,leftLift=(1-beat)*.065;
  const petals=[workstationWorldPoint(b,[a.x+a.sx*.55,.215,a.z]),workstationWorldPoint(b,[a.x,.215,a.z+a.sz*.55])],dx=contact.target.x-contact.stand.x,dz=contact.target.y-contact.stand.y;
  petals.sort((p,q)=>(q.x-contact.stand.x)*dz-(q.y-contact.stand.y)*dx-((p.x-contact.stand.x)*dz-(p.y-contact.stand.y)*dx));
  const strikes={right:{...petals[0],height:.215+rightLift},left:{...petals[1],height:.215+leftLift}};
  return {right:{...strikes.right,height:strikes.right.height+.28},left:{...strikes.left,height:strikes.left.height+.28},strikes,tool:null};
 }
 const p=workstationPose(contact,time),dx=contact.target.x-contact.stand.x,dy=contact.target.y-contact.stand.y,l=Math.hypot(dx,dy),tx=dy/l,tz=-dx/l;
 const toolReach=contact.kind==='building'?.32:contact.kind==='farming'?(contact.task==='harvesting'?.20:.50):0;
 return {right:{x:contact.target.x+tx*p.right[0]/6+dx/l*(p.right[2]-.49-toolReach)/6,y:contact.target.y+tz*p.right[0]/6+dy/l*(p.right[2]-.49-toolReach)/6,height:p.right[1]},left:{x:contact.target.x+tx*p.left[0]/6+dx/l*(p.left[2]-.49)/6,y:contact.target.y+tz*p.left[0]/6+dy/l*(p.left[2]-.49)/6,height:p.left[1]},tool:p.tool};
}
