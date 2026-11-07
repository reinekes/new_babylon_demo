import {isStrictSumer} from '../scenario-profiles.js';
import {isReedShrine} from '../building-presentation.js';
import {workstationLayout} from './workstations.js';
import {constructionProgress} from '../construction.js';
import {createMusicCourtyard} from './music-courtyard.js';
import {createIshtarGateFallback,createSumerGate} from './sacred-models.js';
// Original Sumerian-inspired silhouettes; specific workshops are artistic models,
// not reconstructions. One merged mesh per shared material and building template.
export const ARCHITECTURE_TYPES=Object.freeze(['cowshed','pottery','brewery','bakery','levee','cityWall','cityGate','harbor','kiln','brickyard','waterpoint','tailor','sheepfold','weaver','clay','reed','shrine','garden','depot','granary','ziggurat','fishing','hunting','logging','quarry','healer','market','musicHouse','ishtarGate']);
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
  const normals=[];B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals,uvs:uv});const mesh=new B.Mesh(`handmade-${serial++}`,scene);data.applyToMesh(mesh);mesh.position.set(x,y,z);mesh.rotation.y=angle;return add(mesh,mat);
 };
 const cylinder=(x,y,z,r,h,mat=m.wood,top=r)=>{const a=B.MeshBuilder.CreateCylinder(`round-${serial++}`,{height:h,diameterBottom:r*2,diameterTop:top*2,tessellation:12},scene);a.position.set(x,y,z);return add(a,mat);};
 const beam=(a,c,r=.045,mat=m.wood)=>{const start=new B.Vector3(...a),end=new B.Vector3(...c),v=end.subtract(start),mesh=B.MeshBuilder.CreateCylinder(`beam-${serial++}`,{height:v.length(),diameter:r*2,tessellation:7},scene);mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,v.normalize(),new B.Quaternion());return add(mesh,mat);};
 const jar=(x,z,s=1,y=0)=>{const shape=[[0,0],[.18,.03],[.34,.21],[.38,.53],[.25,.83],[.16,.9],[.17,1],[.12,1],[.12,.89],[.2,.77],[.3,.51],[.26,.22],[.1,.09],[0,.09]].map(([r,h])=>new B.Vector3(r*s,h*s,0));const mesh=B.MeshBuilder.CreateLathe(`storage-jar-${serial++}`,{shape,tessellation:12,sideOrientation:B.Mesh.DOUBLESIDE},scene);mesh.position.set(x,y,z);return add(mesh,m.terracotta);};
 const cloth=(x,z,w,d,y=1.9,mat=m.linen)=>{const before=new Set([...groups.values()].flat());for(const a of [-1,1])for(const c of [-1,1])cylinder(x+a*(w/2-.08),y/2,z+c*(d/2-.08),.045,y);for(let i=0;i<8;i++){const q=block(x-w/2+w*(i+.5)/8,y-.1*Math.sin(i/7*Math.PI),z,w/8+.02,.045,d,mat);q.rotation.z=-.12*Math.cos(i/7*Math.PI);}beam([x-w/2,y,z-d/2],[x+w/2,y,z-d/2]);beam([x-w/2,y,z+d/2],[x+w/2,y,z+d/2]);canopies.push({x,z,w,d,y,mat,parts:[...groups.values()].flat().filter(p=>!before.has(p))});};
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
 const fence=(x,z,w,d)=>{for(const s of [-1,1]){for(let i=0;i<8;i++)cylinder(x-w/2+i*w/7,.52,z+s*d/2,.035,1.04);for(const h of [.25,.7])beam([x-w/2,h,z+s*d/2],[x+w/2,h,z+s*d/2],.035,m.reed);for(let i=0;i<6;i++)cylinder(x+s*w/2,.52,z-d/2+i*d/5,.035,1.04);for(const h of [.25,.7])beam([x+s*w/2,h,z-d/2],[x+s*w/2,h,z+d/2],.035,m.reed);}};
 const loom=(x,z)=>{for(const s of [-1,1])beam([x+s*.65,.08,z+.35],[x+s*.65,1.75,z-.12],.06);beam([x-.7,1.75,z-.12],[x+.7,1.75,z-.12],.06);for(let i=0;i<13;i++)beam([x-.6+i*.1,.23,z+.31],[x-.6+i*.1,1.7,z-.1],.01,m.linen);block(x,.82,z+.13,1.17,.72,.035,m.linen);};
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
   block(side*1.97,(base+eave)/2,center,.15,eave-base,depth,m.reed);
   for(const y of [.42,1.12])beam([side*2.05,y,back],[side*2.05,y,front],.025,m.wood);
   for(const z of [back,center,front])beam([side*2.04,base,z],[side*2.04,eave,z],.055,m.reed);
  }
  for(let i=1;i<profile.length;i++){
   const [x0,y0]=profile[i-1],[x1,y1]=profile[i],x=(x0+x1)/2,y=(y0+y1)/2;
   const roof=block(x,y,center,Math.hypot(x1-x0,y1-y0)+.065,.09,depth+.19,m.reed);
   roof.rotation.z=Math.atan2(y1-y0,x1-x0);
   for(const z of [back-.07,center,front+.07])beam([x0,y0+.052,z],[x1,y1+.052,z],.043,m.reed);
   endMat(x0,y0,x1,y1,base,back);
   endMat(x0,y0,x1,y1,Math.abs(x)<.71?1.85:base,front);
  }
  for(const x of [-.72,.72])beam([x,base,front+.1],[x,1.88,front+.1],.067,m.reed);
  beam([-.78,1.85,front+.1],[.78,1.85,front+.1],.057,m.wood);
  block(-1.29,.29,2.03,.92,.52,.46,m.raw);
  jar(-1.29,2.03,.38,.55);
  jar(1.31,2.02,.53);
 };
 switch(b.type){
 case 'pottery':ground();room(-1.3,-1.45,2.2,1.8,2);cloth(-1.15,.65,2.4,1.6);cylinder(1.4,.65,-.7,.85,1.3,m.fired,.6);cylinder(1.4,1.4,-.7,.6,.3,m.terracotta,.34);block(1.4,.35,.14,.47,.58,.04,m.shade);bench(-1.2,.7);for(let i=0;i<5;i++)jar(-1.85+i*.34,.7,.37,.84);for(let i=0;i<7;i++)jar(-1.9+i*.61,1.9,.52+i%2*.18);break;
 case 'bakery':ground();room(0,-1.55,4.6,1.5,2.2);cloth(-.75,.65,3.3,2.2,2.05,m.reed);cylinder(1.6,.55,.45,.9,1.1,m.raw);block(1.6,.34,1.33,.55,.36,.06,m.shade);block(-1.2,.25,1.2,1.1,.35,.7,m.shade);beam([-1.55,.52,1.1],[-.85,.52,1.3]);break
 case 'brewery':ground();room(0,-1.55,4.6,1.5,2.2);cloth(-.75,.65,3.3,2.2,2.05,m.reed);for(let i=0;i<6;i++)jar(-1.7+(i%3)*.95,.1+Math.floor(i/3)*1.35,1.05);basin(1.8,.45,.7,1.3);beam([1.6,.8,.1],[2,1.25,-.1]);break;
 case 'granary':ground();for(const x of [-1.6,0,1.6]){block(x,.3,-.6,1.45,.6,3.8,m.raw);room(x,-.6,1.25,3.5,2.8);for(const z of [-1.9,-1,.1])block(x,.57,z,1.5,.13,.12,m.shade);}for(let i=0;i<5;i++)jar(-1.7+i*.8,1.8,.65);break;
 case 'depot':ground();room(-1.55,-.25,1.7,4.3,2.45);room(.6,-1.65,2.5,1.5,2.7);cloth(.9,.5,2.8,2.5,1.9,m.reed);stack(.3,.2,14);for(let i=0;i<4;i++)block(.2+i*.52,.32,1.8,.45,.6,.55,m.wood);jar(1.9,-1.5,.85,2.8);break;
 case 'shrine':if(isReedShrine(state,b)){reedSanctuary();break;}ground();block(0,.25,0,5.2,.5,4.8,m.fired);room(0,-.8,3.5,2.8,3.3);for(const x of [-1.75,-1.05,1.05,1.75]){block(x,1.6,.8,.26,3.2,.43,m.raw);block(x,3.3,.8,.37,.15,.52,m.trim);}for(let i=0;i<4;i++)block(0,.08+i*.12,2.4-i*.26,1.6,.17,.55,m.fired);block(0,.72,1.45,1.1,.65,.55,m.stone);jar(-1.25,1.65,.6);jar(1.3,1.6,.65);break;
 case 'ziggurat':{
  const large=b.footprint===2,s=large?2.04:1,ox=large?3:0,oz=large?3:0;
  if(large){
   // Three front flights meet the first stage, as at Ur. Higher flights start
   // on the preceding terrace; every tread has a solid riser down to that deck.
   const stages=[{z:1.6,w:10.8,d:8.4,base:0,h:3.25},{z:1.15,w:7.6,d:5.7,base:3.25,h:2.45},{z:.65,w:4.9,d:3.6,base:5.7,h:1.8}].slice(0,isStrictSumer(state)?level:3);
   for(const [j,a]of stages.entries()){
    block(3,a.base+a.h/2,a.z,a.w,a.h,a.d,m.fired);
    for(const sign of [-1,1])for(let k=0;k<8-j;k++)block(3-a.w/2+.35+k*(a.w-.7)/(7-j),a.base+a.h/2,a.z+sign*a.d/2,.21,a.h*.86,.12,m.raw);
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
   break;
  }

  const brick=level===2?m.raw:m.fired;for(let j=0;j<3;j++){const w=(5.35-j*1.25)*s,d=(4.76-j*1.08)*s,h=large?[3.25,2.45,1.8][j]:.85,y=large?[1.625,4.475,6.6][j]:.425+j*.85;block(ox,y,oz-.35*s,w,h,d,brick);for(const sign of [-1,1])for(let k=0;k<7-j;k++)block(ox-w/2+.32*s+k*(w-.64*s)/(6-j),y,oz-.35*s+sign*d/2,.18*s,h*.84,.09*s,m.raw);}
  const top=large?7.5:2.55,before=new Set([...groups.values()].flat());room(ox,oz-.35*s,1.45*s,1.4*s,1.5*s);
  for(const parts of groups.values())for(const mesh of parts)if(!before.has(mesh))mesh.position.y+=top;
  // Wide central stair and two diagonal lateral flights evoke Ur's monumental approach.
  for(let i=0;i<(large?20:10);i++){const count=large?20:10,t=(i+.5)/count;block(ox,.06+t*(large?5.75:2.3),oz+(large?5.25:2.35)-t*(large?4.6:2.7),large?1.8:1.05,.14,large?.58:.55,brick);}
  for(const sign of [-1,1])for(let i=0;i<12;i++){const t=(i+.5)/12;block(ox+sign*(large?4.65:2.25)*(1-t),.08+t*(large?3.15:.85),oz+(large?3.9:1.9),large?.65:.35,.15,large?1.1:.6,brick);}
  break;}
 case 'brickyard':ground();room(-1.6,-1.7,1.8,1.5,1.65);basin(-1.45,.05,1.65,1.35);cloth(-1.4,-.25,2,1.6,1.65,m.reed);for(let r=0;r<5;r++)for(let k=0;k<5;k++)block(-.1+k*.5,.13,-1.8+r*.88,.4,.2,.57,m.raw);bench(-1.5,1.6,1.5);block(-1.5,.86,1.6,.6,.08,.34,m.wood);break;
 case 'kiln':ground();block(-.6,1.05,-.55,2.75,2.1,2.8,m.fired);block(-.6,2.14,-.55,2.4,.18,2.45,m.raw);for(const x of [-1.3,.1]){block(x,.5,.87,.47,.67,.04,m.shade);cylinder(x,2.4,-.95,.19,.65,m.fired,.15);}cloth(1.8,.2,1.25,3.2,1.65,m.reed);stack(.95,.2,17,m.fired);stack(-1.8,1.7,9);break;
 case 'waterpoint':ground();basin(0,.4,2.6,2.1);cloth(-.25,-.8,3.6,1.5,2.1,m.reed);for(let i=0;i<6;i++)jar(-2.1+i*.8,1.95,.55);beam([-1.8,.3,-2],[1.8,.3,-2],.13,m.reed);block(0,.26,-1.7,.55,.1,.6,m.shade);break;
 case 'weaver':ground();room(-1.5,-.4,1.7,3.8,2);cloth(.65,.05,3,3.6,2.25,m.reed);loom(.3,-.9);loom(.5,1.1);for(let i=0;i<5;i++)cylinder(1.8,.28,-1.4+i*.66,.24,.52,m.linen,.18);break;
 case 'tailor':ground();room(0,-1.55,4.3,1.65,2.35);cloth(-.5,.55,3.3,2,2.05);bench(-.7,.5,2.5);for(let i=0;i<3;i++)block(-1.4+i*.65,.86,.5,.55,.06,.58,m.linen);for(let i=0;i<4;i++){beam([1.65,.1,-.5+i*.65],[1.65,1.7,-.5+i*.65]);block(1.65,1.27,-.5+i*.65,.6,.8,.07,m.linen);}break;
 case 'cowshed':ground();fence(0,0,5,5);cloth(-.5,-1.15,3.6,2.4,2.35,m.reed);basin(1.9,-.8,.5,2);for(let i=0;i<4;i++)block(-1.65+i*.78,.05,.8,.62,.13,1.25,m.reed);for(let i=0;i<3;i++)jar(-1.7+i*.48,-1.35,.38);bench(-1.8,1.65,.5);break;
 case 'sheepfold':ground();fence(0,0,5,5);cloth(-1,-1.3,2.8,2,1.55,m.reed);basin(1.8,-1,.6,2);for(let i=0;i<6;i++)block(-1.9+i*.65,-.01,1.3,.54,.15,1.4,m.reed,.1);break;
 case 'cityWall':block(0,1.05,0,5.70,2.1,5.70,m.raw);block(0,2.17,0,5.68,.14,5.68,m.plaster);break;
 case 'cityGate':{
  const scale=b.footprint===2?2:1,centre=(scale-1)*3;
  for(const side of [-1,1]){
   const z=centre+side*1.82*scale;
   block(centre,1.68,z,5.7*scale,3.36,2*scale,m.raw);
   block(centre,3.45,z,5.55*scale,.18,1.98*scale,m.plaster);
  }
  block(centre,3.08,centre,.58*scale,.34,3.75*scale,m.wood);break;
 }
 case 'levee':block(0,.22,0,5.7,.44,5.7,m.raw);block(0,.61,0,4.7,.4,4.7,m.raw);block(0,.92,0,3.55,.22,3.55,m.plaster);break;
 case 'harbor':for(let i=0;i<17;i++)block(0,.35,-2.55+i*.32,5.2,.15,.29,m.wood);for(const x of [-2.3,2.3])for(const z of [-2.3,0,2.3])cylinder(x,.3,z,.13,1.55);cloth(-1.2,-1.3,2.4,1.8,2.1,m.reed);stack(-1.9,-1.7,7);jar(-.5,-1.2,.7,.45);for(let i=0;i<4;i++)beam([.3+i*.42,.6,.4],[.3+i*.42,.6,2.2],.12,m.reed);break;
 case 'market':ground();cloth(0,-1.55,4.5,1.6,2.15);cloth(-1.6,.8,1.65,2.6,1.9,m.reed);cloth(1.65,.8,1.5,2.6,2.35);bench(0,-1.55,3.8);for(let i=0;i<6;i++)jar(-1.5+i*.6,-1.55,.4,.85);for(let i=0;i<3;i++)block(1.65,.3,.1+i*.75,.8,.5,.6,m.reed);break;
 case 'clay':ground();basin(.8,.7,3,2.7);room(-1.65,-1.6,1.7,1.5,1.45);cloth(-1.5,.3,1.9,1.5,1.5,m.reed);for(let i=0;i<4;i++)jar(-2+i*.45,1.9,.5);break;
 case 'quarry':ground();for(let i=0;i<7;i++){const mesh=block(.2+i%3*.85,.25+Math.floor(i/3)*.25,-1.4+Math.floor(i/3)*1.1,.85,.7,.9,m.stone,i*.39);mesh.rotation.z=.11;}cloth(-1.5,-1.5,1.7,1.8,1.5,m.reed);bench(-1.2,1.5);beam([.4,.1,1.6],[1.9,1.6,1.6],.075);break;
 case 'reed':ground();cloth(-.65,-1.15,3.8,2.2,2.1,m.reed);for(let i=0;i<7;i++){const a=cylinder(-1.8+i*.58,.65,.75,.19,1.3,m.reed,.13);a.rotation.z=.12*(i%2?1:-1);}for(let i=0;i<4;i++)block(-1.6+i, .09,1.85,.85,.08,1,m.reed);bench(1.5,-.9);break;
 case 'garden':ground();for(let i=0;i<4;i++){block(-1.85+i*1.2,.12,.6,.78,.2,3.7,m.soil);for(let j=0;j<6;j++){const a=cylinder(-1.85+i*1.2,.26,-.9+j*.57,.18,.32,m.grass,.25);a.rotation.z=.15;}}cloth(0,-1.95,4.2,1.1,1.65,m.reed);for(let i=0;i<4;i++)jar(-1.5+i,-1.95,.55);break;
 case 'logging':ground();room(-1.5,-1.45,1.9,2,1.9);cloth(.8,-.8,2.9,2.6,1.9,m.reed);for(let i=0;i<7;i++){beam([-.8+i*.44,.2,1.0],[-.8+i*.44,.2,2.3],.15);beam([-.8+i*.44,.47,1],[-.8+i*.44,.47,2.3],.13);}bench(.9,-1);break;
 case 'hunting':ground();room(-1.35,-1.4,2.1,1.9,1.7);for(const z of [-.2,1.6]){for(const x of [-1.6,.1])beam([x,.1,z+.3],[x,2,z],.055);beam([-1.6,2,z],[.1,2,z]);block(-.75,1.15,z+.12,1.3,1.35,.05,m.linen);}cloth(1.55,-.3,1.6,2.7,1.55,m.reed);jar(1.7,1.7,.75);break;
 case 'fishing':ground();room(-1.3,-1.65,2.1,1.4,1.8);for(const x of [-2.1,1.2])beam([x,.1,-.2],[x,2,-.4],.06);beam([-2.1,2,-.4],[1.2,2,-.4]);for(let i=0;i<17;i++)beam([-2+i*.19,.4,-.2],[-2+i*.19,1.95,-.4],.009,m.linen);for(let i=0;i<9;i++)beam([-2,.4+i*.18,-.2-i*.024],[1.1,.4+i*.18,-.2-i*.024],.009,m.linen);for(let i=0;i<4;i++)jar(-1.6+i*.8,1.6,.6);cloth(1.65,-1.15,1.5,2,1.6,m.reed);break;
 case 'healer':ground();room(-1.6,-.5,1.6,3.8,2.1);room(.5,-1.65,2.55,1.5,2.4);cloth(.65,.75,2.6,2,1.95);for(const x of [0,1.3]){bench(x,.75,.8);block(x,.88,.75,.7,.06,1.5,m.linen);}for(let i=0;i<5;i++)jar(-1.9+i*.32,-1.5,.25,2.2);basin(-1.9,1.7,.6,.55);break;
 default:throw Error(`Missing original architecture for ${b.type}`);
 }
 // An inset work bay shares coordinates with palm IK; both residents stand
 // inside the production yard instead of on the adjoining street.
 for(const a of workstationLayout(b)){
  const {x,z,height:h,kind}=a;
  // The active equipment belongs to an attached open work bay. Its edge
  // shades the tools while leaving both front/side working bodies readable.
  if(!['garden','sheepfold','cowshed'].includes(b.type)){
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
