import {createReferenceWorkshop,isReferenceWorkshop,workshopAngle,turnWorkshopParts} from './reference-workshops.js';
import {drawReferenceYard} from './reference-yards.js';
import {visualSurfaceElevation} from './shore-profile.js';
import {riverAxis} from '../world.js';
import {footprintSize} from '../footprints.js';
import {fortificationLayout} from '../fortification-layout.js';
import {isStrictSumer} from '../scenario-profiles.js';
import {isReedShrine} from '../building-presentation.js';
import {workstationLayout} from './workstations.js';
import {constructionProgress} from '../construction.js';
import {batteredAdobe,civicArchitecture} from './reference-civic.js';
import {createReedRoof} from './reed-roof.js';
import {dressSumerYard} from './sumer-yard-details.js';
import {createMusicCourtyard} from './music-courtyard.js';
import {createIshtarGateFallback,createSumerGate} from './sacred-models.js';
// Original Sumerian-inspired silhouettes; specific workshops are artistic models,
// not reconstructions. One merged mesh per shared material and building template.
export const ARCHITECTURE_TYPES=Object.freeze(['communalHouse','cowshed','pottery','brewery','bakery','dairyStore','coppersmith','levee','cityWall','cityGate','harbor','kiln','brickyard','waterpoint','watchHouse','tailor','sheepfold','weaver','linenYard','basketry','matYard','joineryYard','clay','reed','shrine','garden','depot','granary','ziggurat','fishing','hunting','logging','quarry','healer','market','musicHouse','ishtarGate']);
export function createArchitecture(B,scene,b,m,state){
 if(b.type==='musicHouse')return createMusicCourtyard(B,scene,b,m);
 if(b.type==='ishtarGate')return isStrictSumer(state)?createSumerGate(B,scene,m,b):createIshtarGateFallback(B,scene,m,null,b);
 const canopies=[],groups=new Map(),moving=[],level=Math.max(1,Math.min(3,b.level||1)),wall=level===3?m.fired:level===2?m.raw:m.plaster;
 let serial=0;const add=(mesh,mat)=>{mesh.material=mat||wall;if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);return mesh;};
 // Bevelled corners, a slightly bowed middle and a battered top: this breaks
 // razor-sharp cube edges without random per-instance geometry or tiny bricks.
 const block=(x,y,z,w,h,d,mat=wall,angle=0)=>{
  const bevel=Math.min(.08,w*.13,d*.13),ring=[[-w/2+bevel,-d/2],[w/2-bevel,-d/2],[w/2,-d/2+bevel],[w/2,d/2-bevel],[w/2-bevel,d/2],[-w/2+bevel,d/2],[-w/2,d/2-bevel],[-w/2,-d/2+bevel]],p=[],indices=[],uv=[];
  // Give every vertical face its own chart. Sharing a projected U across
  // corners collapses bevel UVs and lets brick rows smear into coloured bands.
  for(let k=0;k<8;k++){
   const edge=[ring[k],ring[(k+1)%8]],alongX=Math.abs(edge[1][0]-edge[0][0])>=Math.abs(edge[1][1]-edge[0][1]),base=p.length/3;
   for(let j=0;j<3;j++)for(const [xx,zz]of edge){const bulge=j===1?1.014:j===2?.985:1;p.push(xx*bulge,(j/2-.5)*h,zz*bulge);uv.push((alongX?xx:zz)*bulge/2,j*h/4);}
   for(let j=0;j<2;j++){const a=base+j*2,c=a+1;indices.push(a,a+2,c,c,a+2,c+2);}
  }
  const cap=p.length/3;
  for(const j of [0,2])for(const [xx,zz]of ring){const factor=j===2?.985:1;p.push(xx*factor,(j/2-.5)*h,zz*factor);uv.push(xx*factor/2,zz*factor/2);}
  for(let k=1;k<7;k++){indices.push(cap,cap+k,cap+k+1,cap+8,cap+8+k+1,cap+8+k);}
  for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  if((mat===wall||mat===m.raw||mat===m.fired)&&h>.26){
   // Keep the wall feet and the support planes fixed; hand-formed edges and
   // bowed solids share the same displacement across their separate UV charts.
   for(let i=0;i<p.length;i+=3){
    const rise=p[i+1]/h+.5,weather=rise*Math.min(h,.9);
    const warp=.022*Math.sin((x+p[i])*2.9+(z+p[i+2])*3.4+y);
    p[i]+=weather*warp;
    p[i+2]+=weather*.016*Math.sin((z+p[i+2])*3.1-(x+p[i])*2.3);
   }
  }
  const normals=[];B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals,uvs:uv});const mesh=new B.Mesh(`handmade-${serial++}`,scene);data.applyToMesh(mesh);mesh.position.set(x,y,z);mesh.rotation.y=angle;return add(mesh,mat);
 };
 const cylinder=(x,y,z,r,h,mat=m.wood,top=r)=>{const a=B.MeshBuilder.CreateCylinder(`round-${serial++}`,{height:h,diameterBottom:r*2,diameterTop:top*2,tessellation:12},scene);a.position.set(x,y,z);return add(a,mat);};
 const beam=(a,c,r=.045,mat=m.wood)=>{const start=new B.Vector3(...a),end=new B.Vector3(...c),v=end.subtract(start),mesh=B.MeshBuilder.CreateCylinder(`beam-${serial++}`,{height:v.length(),diameter:r*2,tessellation:7},scene);mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());return add(mesh,mat);};
 const jar=(x,z,s=1,y=0)=>{const shape=[[0,0],[.18,.03],[.34,.21],[.38,.53],[.25,.83],[.16,.9],[.17,1],[.12,1],[.12,.89],[.2,.77],[.3,.51],[.26,.22],[.1,.09],[0,.09]].map(([r,h])=>new B.Vector3(r*s,h*s,0));const mesh=B.MeshBuilder.CreateLathe(`storage-jar-${serial++}`,{shape,tessellation:12,sideOrientation:B.Mesh.DOUBLESIDE},scene);mesh.position.set(x,y,z);return add(mesh,m.terracotta);};
 const cloth=(x,z,w,d,y=1.9,mat=m.linen)=>{const before=new Set([...groups.values()].flat());for(const a of [-1,1])for(const c of [-1,1])cylinder(x+a*(w/2-.08),y/2,z+c*(d/2-.08),.045,y);if(mat===m.reed)add(createReedRoof(B,scene,'reed-canopy',m.reedRoof||m.reed,{x,y,z,width:w,depth:d,sag:.065}),m.reedRoof||m.reed);else for(let i=0;i<8;i++){const q=block(x-w/2+w*(i+.5)/8,y-.1*Math.sin(i/7*Math.PI),z,w/8+.02,.045,d,mat);q.rotation.z=-.12*Math.cos(i/7*Math.PI);}beam([x-w/2,y,z-d/2],[x+w/2,y,z-d/2]);beam([x-w/2,y,z+d/2],[x+w/2,y,z+d/2]);canopies.push({x,z,w,d,y,mat,parts:[...groups.values()].flat().filter(p=>!before.has(p))});};
 // A rotated road port can put the active bay at a back corner. Reserve that
 // real volume in the room, rather than reaching through an intact wall/roof.
 const workBay=workstationLayout(b)[0];
 const roomBlock=(x,y,z,w,h,d,mat=wall)=>{
  const x0=x-w/2,x1=x+w/2,z0=z-d/2,z1=z+d/2,bay=workBay;
  if(!bay||x1<=bay.x-.80||x0>=bay.x+.80||z1<=bay.z-.80||z0>=bay.z+.80)return block(x,y,z,w,h,d,mat);
  const lx=Math.max(x0,bay.x-.80),rx=Math.min(x1,bay.x+.80),lz=Math.max(z0,bay.z-.80),rz=Math.min(z1,bay.z+.80);
  const part=(a,c,e,f)=>{if(c-a>.015&&f-e>.015)block((a+c)/2,y,(e+f)/2,c-a,h,f-e,mat);};
  part(x0,lx,z0,z1);part(rx,x1,z0,z1);part(lx,rx,z0,lz);part(lx,rx,rz,z1);
 };
 const room=(x,z,w,d,h=2.1)=>{const t=.23,door=Math.min(.8,w*.45),side=(w-door)/2;roomBlock(x,h/2,z-d/2,w,h,t);for(const s of [-1,1]){roomBlock(x+s*(w-t)/2,h/2,z,t,h,d);roomBlock(x+s*(door+side)/2,h/2,z+d/2,side,h,t);}roomBlock(x,h-.22,z+d/2,door,.44,t);roomBlock(x,.76,z+d/2-.19,door,1.5,.07,m.shade);roomBlock(x,1.6,z+d/2,door+.22,.12,.34,m.wood);if(m.warm&&h>1.85)roomBlock(x,h-.34,z+d/2+.012,.28,.16,.025,m.warm);roomBlock(x,h+.04,z,w+.14,.14,d+.14,m.soil);for(let i=0;i<Math.ceil(w/.55);i++){const bx=x-w/2+i*.55+.15;if(!workBay||Math.abs(bx-workBay.x)>.86||z+d/2<workBay.z-.80||z-d/2>workBay.z+.80)beam([bx,h-.08,z-d/2-.18],[bx,h-.08,z+d/2+.18],.055);}for(const s of [-1,1])roomBlock(x+s*w/2,h+.24,z,.16,.32,d+.12);roomBlock(x,h+.24,z-d/2,w,.32,.17);};
 const stack=(x,z,n=8,mat=m.raw)=>{for(let i=0;i<n;i++)block(x+(i%3)*.42,.12+Math.floor(i/6)*.23,z+Math.floor(i%6/3)*.43,.39,.21,.37,mat);};
 const bench=(x,z,w=1.5)=>{block(x,.77,z,w,.12,.65,m.wood);for(const s of [-1,1])block(x+s*w*.4,.38,z,.1,.76,.5,m.wood);};
 const basin=(x,z,w,d)=>{block(x,.1,z,w,.2,d,m.raw);for(const s of [-1,1]){block(x+s*w/2,.3,z,.16,.5,d,m.raw);block(x,.3,z+s*d/2,w,.5,.16,m.raw);}block(x,.22,z,w-.16,.025,d-.16,m.shade);};
 const ground=()=>block(0,.025,0,5.3,.05,5.3,m.soil);
 const reedSanctuary=()=>{
  ground();
  const back=-2.18,front=1.58,center=(back+front)/2,depth=front-back;
  const base=.18,eave=1.43;
  const profile=[[-2.02,eave],[-1.82,1.87],[-1.36,2.30],[-.71,2.55],[0,2.63],[.71,2.55],[1.36,2.30],[1.82,1.87],[2.02,eave]];
  const endMat=(x0,y0,x1,y1,bottom,z)=>{
   const face=[x0,bottom,z,x1,bottom,z,x1,y1,z,x0,y0,z];
   const positions=[...face,...face],indices=[0,1,2,0,2,3,4,6,5,4,7,6],normals=[];
   const uv=[x0/2,bottom/2,x1/2,bottom/2,x1/2,y1/2,x0/2,y0/2];
   B.VertexData.ComputeNormals(positions,indices,normals);
   const data=new B.VertexData(),mesh=new B.Mesh(`reed-end-mat-${serial++}`,scene);
   Object.assign(data,{positions,indices,normals,uvs:[...uv,...uv]});
   data.applyToMesh(mesh);
   add(mesh,m.reed);
  };
  block(0,base/2,center,4.18,base,depth+.08,m.raw);
  for(const side of [-1,1]){
   block(side*1.97,(base+eave)/2,center,.22,eave-base,depth,m.reed);
   block(side*2.00,.32,center,.24,.31,depth,m.raw);
   for(const y of [.42,1.12])beam([side*2.05,y,back],[side*2.05,y,front],.025,m.wood);
   for(const z of [back,center,front])beam([side*2.04,base,z],[side*2.04,eave,z],.055,m.reed);
  }
  add(createReedRoof(B,scene,'reed-sanctuary-roof',m.reedRoof||m.reed,{z:center,width:4.04,depth:depth+.19,profile}),m.reedRoof||m.reed);
  for(let i=1;i<profile.length;i++){
   const [x0,y0]=profile[i-1],[x1,y1]=profile[i],x=(x0+x1)/2;
   for(const z of [back-.07,center,front+.07])beam([x0,y0+.052,z],[x1,y1+.052,z],.043,m.reed);
   endMat(x0,y0,x1,y1,base,back);
   endMat(x0,y0,x1,y1,Math.abs(x)<1.36?1.79:base,front);
  }
  for(const x of [-1.34,1.34])beam([x,base,front+.1],[x,1.83,front+.1],.075,m.reed);
  beam([-1.41,1.79,front+.1],[1.41,1.79,front+.1],.069,m.wood);
  // Individual ties cross the reed gable; a dark altar sits deep inside
  // behind the full-width opening, and the offering tables flank the sill.
  for(const side of [-1,1]){
   for(let i=0;i<4;i++){
    const y=1.89+i*.12;
    beam([side*.04,y,front+.09],[side*(.64-i*.11),y+.26,front+.09],.026,m.reed);
   }
   block(side*1.44,.25,1.95,1.06,.47,.67,m.raw);
   block(side*1.44,.51,1.95,1.10,.07,.70,m.trim);
   jar(side*1.45,1.98,.65,.56);jar(side*1.04,2.08,.31,.55);
  }
  block(0,.42,-1.23,1.36,.48,.69,m.raw);jar(0,-1.26,.53,.68);
  block(0,.207,1.50,1.30,.043,1.24,m.reed);

 };
 const referenceYard=drawReferenceYard(B,scene,b,state,{groups,add,block,beam,cylinder,jar,m});
 if(!referenceYard)switch(b.type){
 case 'communalHouse':{
  const size=footprintSize(b),scale=size/2,center=(size-1)*3;
  const adobe=(x,z,w,d,base,top,material=m.plaster)=>block(center+x*scale,(base+top)*scale/2,center+z*scale,w*scale,(top-base)*scale,d*scale,material);
  adobe(0,0,11.0,10.9,0,.065,m.soil);
  adobe(0,-4.05,4.80,2.45,.065,3.87);
  for(const side of [-1,1]){
   adobe(side*1.56,-2.51,1.72,.56,.065,3.87);
   adobe(side*3.94,-3.78,3.02,3.02,.065,2.70);
   adobe(side*4.52,1.45,1.76,7.35,.065,2.525);
   adobe(side*3.08,5.22,4.59,.34,.065,1.52);
   adobe(side*.94,5.22,.4,.51,.065,1.95);
  }
  adobe(0,-2.51,1.50,.56,2.11,3.87);
  adobe(0,5.22,2.02,.16,1.75,1.94,m.wood);
  adobe(3.21,2.0,.69,3.10,.065,.495,m.raw);
  for(let i=0;i<12;i++)adobe(-3.06,3.50-i*.28,.94,.30,.065,.065+(2.525-.065)*(i+1)/12,m.raw);
  adobe(-3.33,-.02,1.43,.58,.065,2.525);
  break;
 }
 case 'pottery':case 'bakery':case 'coppersmith':case 'dairyStore':case 'brewery':case 'granary':case 'depot':
 case 'brickyard':case 'kiln':case 'joineryYard':case 'matYard':case 'basketry':case 'linenYard':case 'weaver':case 'tailor':
  createReferenceWorkshop(b,{B,scene,add,block,beam,cylinder,jar,ground,m,wall});
  turnWorkshopParts(B,[...groups.values()].flat(),workshopAngle(b.workCorner));
  break;
 case 'shrine':if(isReedShrine(state,b)){reedSanctuary();break;}ground();block(0,.25,0,5.2,.5,4.8,m.fired);room(0,-.8,3.5,2.8,3.3);for(const x of [-1.75,-1.05,1.05,1.75]){block(x,1.6,.8,.26,3.2,.43,m.raw);block(x,3.3,.8,.37,.15,.52,m.trim);}for(let i=0;i<4;i++)block(0,.08+i*.12,2.4-i*.26,1.6,.17,.55,m.fired);block(0,.72,1.45,1.1,.65,.55,m.stone);jar(-1.25,1.65,.6);jar(1.3,1.6,.65);break;
 case 'ziggurat':{
  const large=b.footprint===2,s=large?2.04:1,ox=large?3:0,oz=large?3:0;
  if(large){
   // Three front flights meet the first stage, as at Ur. Higher flights start
   // on the preceding terrace; every tread has a solid riser down to that deck.
   const stages=[{z:1.6,w:10.8,d:8.4,base:0,h:3.25},{z:1.15,w:7.6,d:5.7,base:3.25,h:2.45},{z:.65,w:4.9,d:3.6,base:5.7,h:1.8}].slice(0,isStrictSumer(state)?level:3);
   for(const [j,a]of stages.entries()){
    const ix=a.w*.055,iz=a.d*.064;
    const core=batteredAdobe(B,scene,'terrace-'+j,{x:3,y:a.base,z:a.z,w:a.w,h:a.h,d:a.d,insetX:ix,insetZ:iz},m.fired);
    add(core,m.fired);
    const topWidth=a.w-ix*2,topDepth=a.d-iz*2;
    // The exposed floor is fired brick. Only the narrow edge course takes
    // the lighter finish, so a single-stage sanctuary does not look slab-capped.
    block(3,a.base+a.h-.055,a.z,topWidth+.13,.13,topDepth+.13,m.fired);
    for(const side of [-1,1]){
     block(3,a.base+a.h-.12,a.z+side*topDepth/2,topWidth+.13,.11,.13,m.raw);
     block(3+side*topWidth/2,a.base+a.h-.12,a.z,.13,.11,topDepth+.13,m.raw);
     for(let k=0;k<5-j;k++){
      const x=3-a.w/2+.54+k*(a.w-1.08)/(4-j);
      const rib=block(x,a.base+a.h*.47,a.z+side*(a.d/2-iz*.47-.09),.39,a.h*.92,.31,m.raw);
      rib.rotation.x=-side*Math.atan2(iz,a.h);
     }
     for(let k=0;k<4-j;k++){
      const z=a.z-a.d/2+.55+k*(a.d-1.10)/(3-j);
      const rib=block(3+side*(a.w/2-ix*.47),a.base+a.h*.47,z,.36,a.h*.92,.40,m.raw);
      rib.rotation.z=side*Math.atan2(ix,a.h);
     }
    }
   }
   const flight=(x0,z0,x1,z1,base,rise,width,count)=>{
    const dx=x1-x0,dz=z1-z0,alongX=Math.abs(dx)>Math.abs(dz),run=Math.hypot(dx,dz),step=run/count;
    for(let i=0;i<count;i++){const t=(i+.5)/count,h=rise*(i+1)/count;block(x0+dx*t,base+h/2,z0+dz*t,alongX?step+.025:width,h,alongX?width:step+.025,m.fired);}
   };
   flight(3,8.4,3,5.9,0,3.25,1.75,16);
   flight(-2.15,6.02,2.05,6.02,0,3.25,.8,16);
   flight(8.15,6.02,3.95,6.02,0,3.25,.8,16);
   block(3,3.125,5.94,2.2,.25,.65,m.fired);
   if(stages.length>1)flight(3,5.8,3,4.0,3.25,2.45,1.45,13);
   if(stages.length>2)flight(3,4.0,3,2.45,5.7,1.8,1.15,11);
   const top=stages.at(-1),before=new Set([...groups.values()].flat());room(3,.48,2.7,2.4,2.9);
   for(const parts of groups.values())for(const mesh of parts)if(!before.has(mesh))mesh.position.y+=top.base+top.h;
   const crown=top.base+top.h+2.89;
   block(3,crown,.48,2.94,.16,2.64,m.fired);
   for(let i=0;i<8;i++)block(1.82+i*.34,crown-.14,1.69,.17,.19,.16,m.raw);
   break;
  }

  const brick=level===2?m.raw:m.fired;for(let j=0;j<3;j++){const w=(5.35-j*1.25)*s,d=(4.76-j*1.08)*s,h=large?[3.25,2.45,1.8][j]:.85,y=large?[1.625,4.475,6.6][j]:.425+j*.85;block(ox,y,oz-.35*s,w,h,d,brick);for(const sign of [-1,1])for(let k=0;k<7-j;k++)block(ox-w/2+.32*s+k*(w-.64*s)/(6-j),y,oz-.35*s+sign*d/2,.18*s,h*.84,.09*s,m.raw);}
  const top=large?7.5:2.55,before=new Set([...groups.values()].flat());room(ox,oz-.35*s,1.45*s,1.4*s,1.5*s);
  for(const parts of groups.values())for(const mesh of parts)if(!before.has(mesh))mesh.position.y+=top;
  // Wide central stair and two diagonal lateral flights evoke Ur's monumental approach.
  for(let i=0;i<(large?20:10);i++){const count=large?20:10,t=(i+.5)/count;block(ox,.06+t*(large?5.75:2.3),oz+(large?5.25:2.35)-t*(large?4.6:2.7),large?1.8:1.05,.14,large?.58:.55,brick);}
  for(const sign of [-1,1])for(let i=0;i<12;i++){const t=(i+.5)/12;block(ox+sign*(large?4.65:2.25)*(1-t),.08+t*(large?3.15:.85),oz+(large?3.9:1.9),large?.65:.35,.15,large?1.1:.6,brick);}
  break;}
 case 'levee':{
  const angle=(riverAxis(state)==='x'?0:Math.PI/2)-(b.rotation||0)*Math.PI/2;
  const profile=[[-1.83,-.09],[-1.58,.10],[-.72,.81],[-.58,.89],[.58,.89],[.72,.82],[1.61,.10],[1.83,-.09]];
  const positions=[],indices=[],uvs=[];
  const endHeight=adjacent=>adjacent?.type==='levee'&&!adjacent.construction?1:.62;
  const alongX=riverAxis(state)==='x';
  const neighbor=side=>state?.buildings?.find(other=>other.x===b.x+(alongX?side:0)&&other.y===b.y+(alongX?0:side));
  for(const [i,x] of [-3,-2.46,0,2.46,3].entries()){
   const height=i===0?endHeight(neighbor(-1)):i===4?endHeight(neighbor(1)):1;
   for(const [z,y] of profile){
    const ground=state?.world?visualSurfaceElevation(b.x+(alongX?x:z)/6,b.y+(alongX?z:-x)/6,state):0;
    const elevation=y>0?y*height+ground*Math.max(0,1-y/.89):ground-.055;
    positions.push(x*Math.cos(angle)+z*Math.sin(angle),elevation,-x*Math.sin(angle)+z*Math.cos(angle));
    uvs.push(x*.45,z*.45);
   }
   if(i)for(let j=0;j<profile.length-1;j++){
    const k=(i-1)*profile.length+j,n=k+profile.length;
    indices.push(k,n,k+1,k+1,n,n+1);
   }
  }
  const normals=[];
  B.VertexData.ComputeNormals(positions,indices,normals);
  const data=new B.VertexData();
  Object.assign(data,{positions,indices,normals,uvs});
  const bank=new B.Mesh('earthen-levee',scene);
  data.applyToMesh(bank);
  add(bank,m.soil);
  break;
 }
 case 'healer':case 'harbor':case 'market':case 'waterpoint':case 'watchHouse':case 'cityWall':case 'cityGate':
  civicArchitecture(b.type,b,{B,scene,add,block,beam,cylinder,jar,ground,m},
   b.type==='cityGate'||b.type==='cityWall'?fortificationLayout(b,state):[]);
  break;
 default:throw Error(`Missing original architecture for ${b.type}`);
 }
 if(!referenceYard&&!isReferenceWorkshop(b.type))dressSumerYard(b.type,{block,beam,cylinder,jar,m});
 // Expansion occupies the yard away from the existing palm targets.
 if(level>=2&&b.type==='fishing'){
  const rackX=-1.36,rackZ=1.08;
  for(const x of [-2.06,-.66])beam([x,.08,rackZ],[x,1.28,rackZ],.048,m.wood);
  beam([-2.06,1.28,rackZ],[-.66,1.28,rackZ],.043,m.wood);
  for(const x of [rackX-.32,rackX,rackX+.32]){
   const fish=block(x,1.01,rackZ,.11,.33,.052,m.linen);
   fish.rotation.z=.18;
  }
 }
 // An inset work bay shares coordinates with palm IK; both residents stand
 // inside the production yard instead of on the adjoining street.
 for(const a of workstationLayout(b)){
  const {x,z,height:h,kind}=a;
  // The active equipment belongs to an attached open work bay. Its edge
  // shades the tools while leaving both front/side working bodies readable.
  if(!referenceYard&&!isReferenceWorkshop(b.type)){
   const bx=x-a.sx*.28,bz=z-a.sz*.28,shade=canopies.find(c=>Math.abs(c.x-bx)<(c.w+1.72)/2-.05&&Math.abs(c.z-bz)<(c.d+1.72)/2-.05);
   if(shade){const x0=Math.min(shade.x-shade.w/2,bx-.86),x1=Math.max(shade.x+shade.w/2,bx+.86),z0=Math.min(shade.z-shade.d/2,bz-.86),z1=Math.max(shade.z+shade.d/2,bz+.86);for(const part of shade.parts){const parts=groups.get(part.material),i=parts.indexOf(part);if(i>=0)parts.splice(i,1);part.dispose();}canopies.splice(canopies.indexOf(shade),1);cloth((x0+x1)/2,(z0+z1)/2,x1-x0,z1-z0,Math.max(2.18,shade.y),shade.mat);}
   else cloth(bx,bz,1.72,1.72,2.18,m.reed);
  }
  if(kind==='loom'){
   for(const side of [-1,1])beam([x+side*.30,.08,z],[x+side*.30,1.38,z],.035);
   beam([x-.30,1.38,z+a.sz*.20],[x+.30,1.38,z+a.sz*.20],.035);block(x,1.05,z+a.sz*.20,.54,.62,.035,m.linen);
   for(const side of [-1,1])beam([x+a.sx*.20,.08,z+side*.30],[x+a.sx*.20,1.38,z+side*.30],.035);beam([x+a.sx*.20,1.38,z-.30],[x+a.sx*.20,1.38,z+.30],.035);block(x+a.sx*.20,1.05,z,.035,.62,.54,m.linen);
  }else if(kind==='vat'){jar(x,z,.91);cylinder(x,.91,z,.12,.035,m.shade);}
  else if(kind==='dairy'){jar(x-a.sx*.38,z-a.sz*.38,.28);cylinder(x-a.sx*.38,.25,z-a.sz*.38,.055,.012,m.linen);}
  else if(kind==='kiln'){block(x,.4,z,.62,.8,.62,m.fired);block(x,h,z,.5,.035,.5,m.raw);block(x,h+.06,z,.38,.10,.32,m.raw);}
  else {
   block(x,h-.065,z,.65,.13,.65,m.wood);for(const dx of [-.24,.24])for(const dz of [-.24,.24])block(x+dx,(h-.13)/2,z+dz,.055,h-.13,.055,m.wood);
   if(kind==='wheel'){
    // A hand-driven turntable, without a modern treadle or motor. Support/table
    // dimensions are a readable reconstruction, not an excavated complete rig.
    cylinder(x,h+.025,z,.10,.05,m.stone);
    const disc=B.MeshBuilder.CreateCylinder('potter-turntable',{height:.055,diameter:.64,tessellation:32},scene);
    const mark=B.MeshBuilder.CreateBox('potter-turntable-incision',{width:.16,height:.003,depth:.012},scene);mark.position.set(.20,.029,0);
    const wheel=B.Mesh.MergeMeshes([disc,mark],true,true);wheel.name='potter-turntable';wheel.position.set(x,h+.055,z);wheel.material=m.stone;wheel.metadata={potterWheel:true};moving.push(wheel);
    const clay=B.MeshBuilder.CreateCylinder('potter-forming-clay',{height:.09,diameterBottom:.24,diameterTop:.20,tessellation:20},scene);clay.position.set(x,h+.125,z);clay.material=m.terracotta;clay.metadata={formingClay:true};moving.push(clay);
   }
   else if(kind==='mould'){for(const dx of [-.20,.20])block(x+dx,h+.035,z,.035,.07,.4,m.wood);for(const dz of [-.20,.20])block(x,h+.035,z+dz,.4,.07,.035,m.wood);block(x,h+.025,z,.36,.05,.36,m.raw);}
   else if(kind==='fleece')block(x,h+.025,z,.48,.05,.45,m.linen);
   else if(kind==='reed')for(const dx of [-.16,-.08,0,.08,.16])beam([x+dx,h+.025,z-.23],[x+dx,h+.025,z+.23],.018,m.reed);
   else if(kind==='mortar')cylinder(x,h+.035,z,.22,.07,m.stone);
   else if(kind==='clay')block(x,h+.025,z,.45,.05,.45,m.raw);
   else block(x,h+.025,z,.50,.05,.50,m.linen);
  }
 }
 const meshes=[];for(const [material,parts]of groups){for(const mesh of parts)mesh.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);if(mesh){mesh.name=`original-${b.type}-${material.name}`;mesh.material=material;meshes.push(mesh);}}
 return meshes.concat(moving);
}
