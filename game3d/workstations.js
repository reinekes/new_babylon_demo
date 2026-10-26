import {isDryPoint} from '../world.js';
import {insideFootprint,footprintSize} from '../footprints.js';
import {dairyMilkingLayout} from './dairy-layout.js';
// Shared metre-space equipment and palm targets. Pure view data: no production,
// inventory initializers, route edits or simulation coordinates enter this module.
const equipment={cowshed:'dairy',pottery:'wheel',brewery:'vat',weaver:'loom',tailor:'table',brickyard:'mould',kiln:'kiln',clay:'clay',reed:'reed',garden:'mortar',sheepfold:'fleece'};
export function workstationWorldPoint(b,[x,height,z]){
 const angle=((b.rotation||0)%4)*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),snap=n=>Math.abs(n)<1e-12?0:n;
 return {x:b.x+snap(x*c+z*s)/6,y:b.y+snap(-x*s+z*c)/6,height};
}
export function workstationBuilding(b,state){
 if(!state||!equipment[b.type]&&!b.construction&&b.type!=='field')return b;
 // Same ordered dry corners as generateStreets, without rebuilding its whole graph.
 const n=footprintSize(b),port=[[b.x+n-.5,b.y+n-.5],[b.x-.5,b.y+n-.5],[b.x+n-.5,b.y-.5],[b.x-.5,b.y-.5]].map(([x,y])=>({x,y})).find(p=>isDryPoint(state,p.x,p.y)&&!(state.buildings||[]).some(v=>insideFootprint(v,p.x,p.y)));
 if(!port)return b;
 const angle=(b.rotation||0)*Math.PI/2,dx=port.x-b.x,dz=port.y-b.y,c=Math.cos(angle),s=Math.sin(angle);
 return {...b,workCorner:[Math.sign(dx*c-dz*s)||1,Math.sign(dx*s+dz*c)||1]};
}
export function workstationLayout(b){
 if(!equipment[b.type]||b.construction)return [];
 if(b.type==='cowshed')return [dairyMilkingLayout(b)];
 return [b.workCorner||[1,1]].map(([sx,sz])=>({kind:equipment[b.type],x:sx*1.94,z:sz*1.94,height:b.type==='cowshed'?.72:b.type==='weaver'?1.05:b.type==='brewery'?.92:.95,sx,sz}));
}
export function workstationFor(b,c,index=0){
 if(!b?.type||!['working','strike'].includes(c.activity?.stage)||c.walking||c.carrying)return null;
 const layout=b.construction||b.type==='field'?[{kind:b.construction?'building':'farming',x:(b.workCorner?.[0]||1)*(b.construction?2.72:2.62),z:(b.workCorner?.[1]||1)*(b.construction?2.72:2.62),height:b.construction?.95:c.activity.task==='harvesting'?.65:.12,sx:b.workCorner?.[0]||1,sz:b.workCorner?.[1]||1}]:workstationLayout(b);if(!layout.length)return null;
 const stations=layout.map(a=>({...a,world:workstationWorldPoint(b,[a.x,a.height,a.z])})).sort((a,d)=>Math.hypot(a.world.x-c.x,a.world.y-c.y)-Math.hypot(d.world.x-c.x,d.world.y-c.y));
 const a=stations[0],axis=index%2,stand=workstationWorldPoint(b,[a.x+(axis?a.sx*.48:0),0,a.z+(axis?0:a.sz*.48)]),rim=workstationWorldPoint(b,[a.x+(axis?a.sx*.20:0),a.height,a.z+(axis?0:a.sz*.20)]),target=['building','farming'].includes(a.kind)?a.world:rim;
 if(Math.hypot(stand.x-c.x,stand.y-c.y)>.3)return null;
 return {kind:a.kind,task:c.activity.task,stand,target,axis,building:b};
}
// Targets remain ON equipment throughout the cycle: hands turn clay, feed cloth,
// knead mud or rub grain across a surface, instead of both hovering in empty air.
export function workstationPose(contact,time){
 const wave=Math.sin(time*3.6),lift=(1-Math.cos(time*3.6))*.5;
 const height=contact.target.height;
 if(contact.kind==='building')return {right:[.10,1.28+lift*.13,.49],left:[-.10,height,.49],tool:'building',bend:.15,twist:wave*.012};
 if(contact.kind==='farming'&&contact.task==='harvesting')return {right:[.10,.97+lift*.06,.49],left:[-.10,.93,.49],tool:'sickle',bend:.25,twist:wave*.012};
 if(contact.kind==='farming')return {right:[.10,.89+lift*.11,.49],left:[-.10,1.03+lift*.11,.20],tool:'hoe',bend:.30,twist:wave*.012};
 if(contact.kind==='dairy')return {right:[.10,.45+lift*.035,.49],left:[-.10,.45+(1-lift)*.035,.49],tool:null,bend:.5,twist:wave*.01};
 if(contact.kind==='loom')return {right:[.12,height,.49+wave*.022],left:[-.12,height,.49-wave*.022],tool:null,bend:.08,twist:wave*.012};
 // The low vat rim needs a forward lean, keeping the near palm within the
 // supplied residents' native arm reach while the workers retain their slots.
 if(contact.kind==='vat')return {right:[.08,height+.10+lift*.04,.47],left:[-.14,height+.02,.50],tool:'stirring',bend:.5,twist:wave*.018};
 return {right:[.10,height+.045,.49+wave*.018],left:[-.10,height+.045,.49-wave*.018],tool:null,bend:.3,twist:wave*.012};
}
// World targets preserve contact under identity height/width variation and yaw.
export function workstationHands(contact,time){
 const p=workstationPose(contact,time),dx=contact.target.x-contact.stand.x,dy=contact.target.y-contact.stand.y,l=Math.hypot(dx,dy),tx=dy/l,tz=-dx/l;
 const toolReach=contact.kind==='building'?.32:contact.kind==='farming'?(contact.task==='harvesting'?.20:.50):0;
 return {right:{x:contact.target.x+tx*p.right[0]/6+dx/l*(p.right[2]-.49-toolReach)/6,y:contact.target.y+tz*p.right[0]/6+dy/l*(p.right[2]-.49-toolReach)/6,height:p.right[1]},left:{x:contact.target.x+tx*p.left[0]/6+dx/l*(p.left[2]-.49)/6,y:contact.target.y+tz*p.left[0]/6+dy/l*(p.left[2]-.49)/6,height:p.left[1]},tool:p.tool};
}
