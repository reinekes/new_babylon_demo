import {extractionWorkArea,isExtractionCourt} from '../extraction-courts.js';
import {footprintSize} from '../footprints.js';
import {mineralWorkBay} from './mineral-excavation.js';
import {sheepfoldGateSide} from '../sheepfold-layout.js';

const yardFinishes=new WeakMap();
function specialFinish(B,scene,name,color,roughness){
 let finishes=yardFinishes.get(scene);if(!finishes){finishes=new Map();yardFinishes.set(scene,finishes);}
 if(!finishes.has(name)){
  const material=new B.PBRMaterial('courtyard-'+name,scene);
  material.albedoColor=B.Color3.FromHexString(color).toLinearSpace();material.metallic=0;material.roughness=roughness;
  finishes.set(name,material);
 }
 return finishes.get(name);
}
const builders={clay:clayPit,quarry:stoneYard,reed:reedYard,logging:woodcutters,
 hunting:hunters,garden:orchard,fishing:fishers,cowshed:cattle,sheepfold:sheep};

// The bay, entrance and roof ladder must rotate and scale together.
export function referenceYardFrame(b,state){
 const large=footprintSize(b)===2,center=large?3:0;
 let angle=0;
 if(isExtractionCourt(b)){
  const {x,z}=extractionWorkArea(b,state);
  angle=x<3?(z<3?Math.PI/2:Math.PI):z>3?-Math.PI/2:0;
 }
 if(!large&&b.type==='clay'){
  const [sx,sz]=b.workCorner||[1,1];
  angle=sx>0?(sz>0?0:Math.PI/2):sz>0?-Math.PI/2:Math.PI;
 }
 if(b.type==='cowshed'||b.type==='sheepfold')
  angle=Math.PI/2+(b.type==='sheepfold'?sheepfoldGateSide(b,state):0)*Math.PI/2;
 return {large,center,angle,span:large?2.03:1,rise:large?1.22:1};
}
export function referenceYardLadder(b,state){
 if(b.type==='clay'){const bay=mineralWorkBay(b,state);return {x:bay.x-(bay.compact?.49:.86),z:bay.z+.1,height:1.58,side:-1,angle:0,width:.40,lean:.22,ground:.06};}
 const sideWall={logging:[2.37,-1.32,2.18,1],hunting:[2.40,-1.36,2.17,1],
  fishing:[1.96,-.59,1.40,1]}[b.type];
 if(!sideWall)return null;
 const {center,angle,span,rise}=referenceYardFrame(b,state),[x,z,h,side]=sideWall;
 return {x:center+span*(x*Math.cos(angle)+z*Math.sin(angle)),z:center+span*(-x*Math.sin(angle)+z*Math.cos(angle)),
  height:h*rise,side,angle,width:.40,lean:.30,ground:.06};
}
// The same composition fits old single-tile saves and the larger production
// courts. Place the store in the working quadrant and leave the deposit live.
export function drawReferenceYard(B,scene,b,state,kit){
 const build=builders[b.type];if(!build)return false;
 const {groups,add,block,beam,cylinder,jar}=kit,m={...kit.m};
 if(b.type==='garden'){
  m.rill=specialFinish(B,scene,'irrigation-water','#68705a',.65);
  m.silt=specialFinish(B,scene,'wet-alluvial-silt','#625246',.97);m.shade=m.silt;
  m.dates=specialFinish(B,scene,'dried-date-skin','#6b3621',.80);
 }
 if(b.type==='hunting')m.hide=specialFinish(B,scene,'tanned-hide','#a56936',.92);
 const start=new Set([...groups.values()].flat());
 const {large,center,angle,span,rise}=referenceYardFrame(b,state);
 // A two-sided cut sheet with real folds, full normals and tiled material.
 function sheet(name,rows,material,tint,project){
  const pos=[],uv=[],idx=[],normals=[],colors=[],columns=rows[0].length;
  for(let j=0;j<rows.length;j++)for(let k=0;k<columns;k++){
   const point=rows[j][k];pos.push(...point);uv.push(...(project?project(point):[k/(columns-1),1-j/(rows.length-1)]));
   if(tint)colors.push(...tint(j,k),1);
   if(j&&k){const d=j*columns+k,c=d-1,a=c-columns;idx.push(a,c,a+1,a+1,c,d);}
  }
  const count=pos.length/3;pos.push(...pos.slice());uv.push(...uv.slice());if(tint)colors.push(...colors.slice());
  for(const [a,c,d]of Array.from({length:idx.length/3},(_,i)=>idx.slice(3*i,3*i+3)))idx.push(count+d,count+c,count+a);
  B.VertexData.ComputeNormals(pos,idx,normals);const geo=new B.VertexData();
  Object.assign(geo,{positions:pos,uvs:uv,indices:idx,normals,...(tint?{colors}:{})});const mesh=new B.Mesh(name,scene);geo.applyToMesh(mesh);return add(mesh,material);
 }
 function hoop(x,y,z,r,t,material){
  const mesh=B.MeshBuilder.CreateTorus('bound-rim',{diameter:r*2,thickness:t,tessellation:14},scene);
  mesh.position.set(x,y,z);return add(mesh,material);
 }
 function basket(x,z,r,h,full=false){
  const profile=[[0,0],[.57,.015],[.75,.08],[.94,.31],[1,.61],[.91,.91],[.9,1],[.79,1],[.73,.86],[.63,.41],[0,.33]];
  const mesh=B.MeshBuilder.CreateLathe('coiled-reed-bin',{shape:profile.map(([u,v])=>new B.Vector3(u*r,v*h,0)),tessellation:16,sideOrientation:B.Mesh.DOUBLESIDE},scene);
  mesh.position.set(x,.045,z);add(mesh,m.reed);
  for(const [rad,y]of [[.9,.22],[1,.60],[.92,.96]])hoop(x,.045+h*y,z,r*rad,r*.115,m.wood);
  if(full){
   const pile=B.MeshBuilder.CreateSphere('heaped-dates',{diameter:1,segments:6},scene);
   pile.position.set(x,h-.016,z);pile.scaling.set(r*1.53,.14,r*1.53);
   pile.setVerticesData(B.VertexBuffer.ColorKind,new Float32Array(pile.getTotalVertices()*4).fill(1));add(pile,m.dates);
   const positions=[],indices=[],uvs=[],normals=[],colors=[];
   for(let i=0;i<65;i++){
    const a=i*2.39996,t=Math.sqrt((i+.3)/65),radial=t*r*.76,spin=i*1.83;
    const cx=x+radial*Math.cos(a),cz=z+radial*Math.sin(a),cy=h+.008+.063*Math.sqrt(1-t*t);
    const offset=positions.length/3,scale=.83+.16*Math.sin(i*3.14+.6);
    for(const [length,round]of [[-.046,.08],[-.026,.9],[.015,1],[.039,.48],[.046,.08]]){
     for(let k=0;k<5;k++){
      const angle=k*Math.PI*2/5,w=.018*round*Math.cos(angle)*scale,along=length*scale;
      positions.push(cx+w*Math.cos(spin)+along*Math.sin(spin),cy+.014*round*Math.sin(angle),cz-w*Math.sin(spin)+along*Math.cos(spin));
      uvs.push(k/5,length*10+.5);const skin=.80+.23*Math.sin(i*2.7);colors.push(1.04*skin,.93*skin,.85*skin,1);
     }
    }
    for(let j=0;j<4;j++)for(let k=0;k<5;k++){
     const n=offset+j*5+k,next=offset+j*5+(k+1)%5;indices.push(n,next,n+5,next,next+5,n+5);
    }
   }
   B.VertexData.ComputeNormals(positions,indices,normals);const data=new B.VertexData(),dates=new B.Mesh('basket-of-elongated-dates',scene);
   Object.assign(data,{positions,indices,uvs,normals,colors});data.applyToMesh(dates);add(dates,m.dates);
  }
 }
 function canopy(x,z,w,d,h,fall=.20){
  const rows=[],count=Math.max(3,Math.ceil(w/.85));const y=(u,v)=>h+fall*(.5-v)-.070*Math.sin(Math.PI*u);
  for(const v of [0,.5,1]){
   const row=[];
   for(let i=0;i<=count;i++){const u=i/count;row.push([x+(u-.5)*w,y(u,v),z+(v-.5)*d+(v===1?.025*Math.sin(i*2.4):0)]);}
   rows.push(row);
  }
  sheet('lapped-reed-mat',rows,m.reedRoof||m.reed);
  for(const v of [0,1]){
   const zz=z+(v-.5)*d,yy=y(0,v)-.06;
   beam([x-w*.51,yy,zz],[x+w*.51,yy,zz],.066,m.wood);
   for(const side of [-1,1]){const px=x+side*w*.46;beam([px,.04,zz],[px,yy,zz],.069,m.wood);
    hoop(px,yy-.12,zz,.081,.032,m.reed);beam([px,yy-.46,zz],[px-side*.29,yy-.075,zz],.037,m.wood);}
  }
  for(let i=0;i<=count;i++){const u=i/count,xx=x+(u-.5)*w;beam([xx,y(u,0)+.021,z-d*.5],[xx,y(u,1)+.021,z+d*.5],.021,m.wood);}
 }
 function hut(x,z,w,d,h){
  const thick=.18,front=z+d/2,door=w*.38,side=(w-door)/2;
  block(x,h/2,z-d/2,w,h,thick,m.plaster);
  for(const k of [-1,1]){
   block(x+k*(w-thick)/2,h/2,z,thick,h,d,m.plaster);
   block(x+k*(w+door)/4,h/2,front,side,h,thick,m.plaster);
  }
  block(x,h-.17,front,door,.34,thick,m.plaster);
  block(x,h-.32,front+.04,door+.18,.12,.22,m.wood);
  block(x,h*.46,z-.16,w*.81,h*.91,.075,m.shade);
  block(x,.065,front+.12,door+.13,.13,.48,m.raw);
  block(x,h+.045,z,w+.08,.125,d+.1,m.raw);
  for(let i=0;i<5;i++){const xx=x+(i/4-.5)*w*.85;beam([xx,h-.015,z-d*.53],[xx,h-.015,front+.12],.057,m.wood);}
  const parapet=.14;for(const side of [-1,1])block(x+side*(w-parapet)/2,h+.16,z,parapet,.18,d,m.plaster);
 }
 function fence(x0,z0,x1,z1,high=.72){
  const dx=x1-x0,dz=z1-z0,len=Math.hypot(dx,dz),count=Math.ceil(len/1.32),yaw=Math.atan2(-dz,dx);
  for(let i=0;i<count;i++){
   const t=(i+.5)/count,x=x0+t*dx,z=z0+t*dz;
   block(x,.10,z,len/count+.04,.20,.17,m.raw,yaw);
   block(x,high*.53,z,len/count-.03,high*.59,.07,m.reed,yaw);
   for(const f of [.26,.8])beam([x0+dx*i/count,high*f,z0+dz*i/count],[x0+dx*(i+1)/count,high*f,z0+dz*(i+1)/count],.026,m.wood);
  }
  for(let i=0;i<=count;i++)block(x0+dx*i/count,high*.53,z0+dz*i/count,.18,high*1.06,.18,m.raw);
 }
 function trough(x,z,w,d,base=0){
  block(x,base+.10,z,w,.18,d,m.raw);
  for(const side of [-1,1]){block(x+side*w*.48,base+.25,z,.09,.37,d,m.raw);block(x,base+.25,z+side*d*.48,w,.37,.09,m.raw);}
  block(x,base+.20,z,w-.12,.045,d-.12,m.shade);
 }
 if(b.type==='clay'||b.type==='quarry'){
  const bay=mineralWorkBay(b,state);
  build({block,beam,canopy,basket,hut,jar,trough,m,bay});
  return true;
 }
 if(isExtractionCourt(b)||['reed','logging','hunting','garden','fishing'].includes(b.type)){
  // Compact the earth inside the yard; real surface deposits stay above it.
  block(0,-.015,0,5.23,.06,5.23,m.soil);
 }
 if(isExtractionCourt(b)&&b.type!=='clay'){
  // A low compound perimeter frames the work and leaves the corners and the
  // central entrance open to residents, including multi-source courtyards.
  for(const x of [-2.51,2.51])block(x,.24,-.04,.12,.52,4.30,m.raw);
  block(0,.26,-2.51,4.22,.54,.16,m.raw);
 }
 build({block,beam,cylinder,jar,sheet,hoop,basket,canopy,hut,fence,trough,m,large,b});
 const frame=B.Matrix.Compose(new B.Vector3(span,rise,span),B.Quaternion.RotationAxis(B.Axis.Y,angle),new B.Vector3(center,0,center));
 for(const group of groups.values())for(const mesh of group)if(!start.has(mesh)){
  mesh.bakeTransformIntoVertices(mesh.computeWorldMatrix(true).multiply(frame));
  mesh.position.setAll(0);mesh.rotationQuaternion=null;mesh.rotation.setAll(0);mesh.scaling.setAll(1);
 }
 return true;
}
function clayPit({block,canopy,basket,hut,jar,trough,m,bay}){
 const {x,z,compact}=bay;
 hut(x,z,compact?.98:1.72,compact?.83:1.40,1.47);
 if(compact)return;
 canopy(x+1.48,z+.31,1.24,1.50,1.58);
 trough(x+1.44,z+.32,.84,.58);basket(x+.86,z+1.18,.27,.41);
 basket(x+1.46,z+1.35,.23,.38);jar(x-.91,z+.59,.46);
 block(x-1.25,.12,z+.14,.62,.24,1.28,m.raw,.08);
}
function stoneYard({block,beam,canopy,hut,m,bay}){
 const {x,z,compact}=bay;
 if(compact){canopy(x,z,.95,.88,1.52);return;}
 hut(x-.76,z-.71,1.61,1.54,1.66);canopy(x+.87,z-.60,1.49,1.48,1.76);
 // Two dressed limestone blocks stand on separate sledges on the loading bank.
 for(const [ox,oz,angle] of [[-.95,1.15,.07],[.58,1.32,-.11]]){
  for(const side of [-1,1])beam([x+ox+side*.31,.10,z+oz-.59],[x+ox+side*.31,.10,z+oz+.62],.083,m.wood);
  block(x+ox,.37,z+oz,.87,.42,.76,m.stone,angle);
 }
}
function reedYard({hut,beam,block,canopy,basket,hoop,fence,m}){
 hut(1.31,-1.55,1.92,1.65,1.77);canopy(1.24,-.27,1.78,1.02,1.63);
 for(const x of [-2.21,-.46]){
  beam([x,.07,-.64],[x,1.84,-1.03],.06,m.wood);
  beam([x,.06,-1.62],[x,1.83,-1.03],.051,m.wood);
 }
 beam([-2.32,1.77,-1.01],[-.37,1.77,-1.01],.064,m.wood);
 for(let i=0;i<22;i++){
  const x=-2.15+i*.078;beam([x,.22+.16*(i%4)/4,-.64],[x+.013*Math.sin(i),1.71+.10*Math.sin(i*4.6),-1.03],.035,m.reed);
 }
 for(const [x,z]of [[-1.61,.64],[-1.56,1.14],[-1.65,1.62]]){
  for(let i=0;i<7;i++){const a=i*2.4,r=.105*Math.sqrt(i/7);beam([x-.66,.24+r*Math.sin(a),z+r*Math.cos(a)],[x+.62+i*.012,.24+r*Math.sin(a),z+r*Math.cos(a)],.051,m.reed);}
  for(const dx of [-.37,.36]){const ring=hoop(x+dx,.24,z,.145,.032,m.wood);ring.rotation.z=Math.PI/2;}
 }
 basket(.48,-.62,.27,.49);fence(-2.46,2.38,-.63,2.38);
 block(-1.58,.58,2.42,.85,.50,.08,m.reed);
}
function woodcutters({hut,canopy,beam,block,cylinder,basket,jar,fence,m}){
 hut(1.26,-1.32,2.17,2.03,2.06);canopy(-.97,-1.19,2.05,2.09,1.92,.32);
 for(const [x,y]of [[-1.60,.24],[-1.20,.24],[-.81,.24],[-1.40,.54],[-1,.54],[-1.18,.82]]){
  beam([x,y,-1.92],[x+.03,y+.045,-.12],.18,m.wood);
  const end=cylinder(x+.03,y+.045,-.105,.133,.03,m.raw);end.rotation.x=Math.PI/2;
 }
 cylinder(-.48,.27,.58,.32,.52,m.wood,.29);cylinder(-.48,.54,.58,.29,.03,m.raw);
 for(let i=0;i<7;i++)block(-.69+.12*i,.052,.91+.16*Math.sin(i*2.6),.13,.034,.047,m.wood,.5*i);
 basket(-1.51,.49,.22,.39);jar(1.76,.16,.68);
 fence(-2.42,2.30,-.56,2.30);fence(1.19,2.30,2.42,2.30);
}
function hunters({hut,canopy,beam,sheet,basket,jar,m}){
 hut(1.20,-1.36,2.35,2.0,2.05);canopy(-1.01,-.84,2.11,2.62,1.92,.24);
 const x=-1.15,z=.49,w=1.38;
 for(const side of [-1,1])beam([x+side*w*.5,.06,z+.06],[x+side*w*.5,1.70,z],.049,m.wood);
 for(const y of [.28,1.60])beam([x-w*.53,y,z],[x+w*.53,y,z],.045,m.wood);
 const pts=[[-.57,1.50],[-.28,1.35],[-.06,1.43],[.25,1.38],[.55,1.53],[.41,1.22],[.50,1.03],[.42,.83],[.54,.56],[.32,.63],[.18,.43],[-.06,.51],[-.27,.41],[-.38,.65],[-.55,.55],[-.49,.85],[-.54,1.07],[-.43,1.22]];
 const ring=pts.map(([u,y])=>[x+u,y,z+.045+.035*Math.sin(u*16+y*8)]);
 sheet('hide-stretched-on-cords',[[...ring,ring[0]],Array(ring.length+1).fill([x,.96,z+.15])],m.hide);
 for(const [i,dx,y]of [[0,-w/2,1.6],[4,w/2,1.6],[8,w/2,.39],[10,.25,.28],[12,-.27,.28],[14,-w/2,.4]])beam(ring[i],[x+dx,y,z],.014,m.reed);
 for(let i=0;i<3;i++){
  const px=-.31+i*.14;
  beam([px,.08,.33],[px+.08,1.39+i*.11,.23],.025,m.wood);
 }
 basket(-1.79,.61,.27,.47);jar(1.89,.02,.65);
}
function smoothBank(guides){
 const points=[];
 for(let i=0;i<guides.length-1;i++){
  const a=guides[Math.max(0,i-1)],b=guides[i],c=guides[i+1],d=guides[Math.min(i+2,guides.length-1)];
  for(const t of [0,.33,.67])points.push(b.map((v,j)=>.5*((2*v)+(-a[j]+c[j])*t+
   (2*a[j]-5*v+4*c[j]-d[j])*t*t+(-a[j]+3*v-3*c[j]+d[j])*t*t*t)));
 }
 return [...points,guides.at(-1)];
}
function orchard({hut,canopy,sheet,block,cylinder,hoop,basket,fence,jar,m}){
 hut(1.42,-1.73,1.84,1.27,1.69);canopy(1.27,-.64,2.00,1.09,1.63);
 // The orchard trees and their harvest clusters come from the live landscape.
 // Locate the workers and sorting vessels on the far side of the water.
 const guides=[[-.65,-2.36,.025],[-.67,-2.04,.10],[-.63,-1.68,.15],[-.52,-1.32,.125],[-.57,-.91,.10],[-.48,-.50,.16],[-.42,-.13,.12],[-.43,.21,.09],[-.36,.59,.145],[-.38,.97,.165],[-.30,1.36,.11],[-.34,1.72,.13],[-.27,2.03,.075],[-.23,2.28,.018]];
 // Rounded cuts in soft alluvium, with a thin silt shelf at the waterline.
 const banks=smoothBank(guides);
 const edges=[[],[]];
 for(const [index,side]of [-1,1].entries()){
  const wet=[],dry=[];
  for(const [i,[cx,z,width]]of banks.entries()){
   const uneven=.008*Math.sin(i*.85+side*.86)+.005*Math.sin(i*2.72+side*.86),edge=cx+side*(width+uneven);
   edges[index].push([edge,.030,z]);
   wet.push([edge+side*(.046+.027*Math.sin(i*.63+side)),.038,z]);
   dry.push([edge+side*(.115+.057*Math.sin(i*.52+side)),.065+.023*Math.sin(i*1.03+side),z]);
  }
  sheet('dark-silt-waterline',[edges[index],wet],m.silt);
  sheet('crumbling-earth-bank',[wet,dry],m.soil);
 }
 const waterRows=[edges[0],...[-.46,0,.46].map(t=>banks.map(([x,z,w],i)=>
  [x+t*w,.029+.003*Math.sin(i*.91+t*1.43),z])),edges[1]];
 sheet('shallow-orchard-rill',waterRows,m.rill,(j,i)=>{
  const shallow=Math.abs(j-2)/2,glint=.055*Math.sin(i*.83+j*.72)+.042*Math.cos(i*.29-j*.98);
  return [.87+.09*shallow+glint,.94-.10*shallow+glint,.88-.13*shallow+glint];
 });
 basket(.66,-.63,.42,.70);basket(1.58,-.59,.37,.57);basket(.86,.55,.40,.49,true);
 for(const [x,z,r,h]of [[.66,-.63,.38,.764],[1.58,-.59,.34,.635]]){
  cylinder(x,h,z,r,.042,m.reed,r*.93);
  hoop(x,h+.025,z,r*.56,.026,m.wood);
 }
 block(1.47,.066,1.28,1.02,.05,.62,m.reed);jar(2.02,-.03,.46);
 fence(-2.44,2.34,-.84,2.34);fence(1.4,2.34,2.42,2.34);
}
// The curved thatch cannot carry festival oil bowls. Two low earthen
// benches beside the doorway provide level fireproof supports.
export const fishingLampSeats=[[-.30,.48,.94],[1.34,.48,.94]];
function fishers({sheet,beam,block,jar,basket,cylinder,m}){
 const x=.50,z=-.76,w=2.93,d=2.82,front=z+d/2;
 const profile=[[-.5,1.18],[-.42,1.53],[-.26,1.91],[0,2.05],[.25,1.92],[.43,1.54],[.5,1.18]];
 const roof=[];
 for(const dz of [-d*.55,0,d*.55]){
  const row=profile.map(([t,y])=>[x+t*w,y,z+dz]);roof.push(row);
  for(let i=1;i<row.length;i++)beam(row[i-1],row[i],.048,m.wood);
 }
 sheet('bent-reed-fishing-hut',roof,m.reedRoof||m.reed);
 for(const sign of [-1,1]){
  block(x+sign*w*.48,.60,z,.13,1.20,d,m.plaster);
  block(x+sign*.99,.60,front,.82,1.20,.15,m.plaster);
 }
 block(x,.60,z-d/2,w,1.20,.14,m.plaster);
 const end=roof[0].map(([px,y])=>[px,y,z-d/2]);
 sheet('fishing-rear-gable',[end,end.map(([px])=>[px,1.12,z-d/2])],m.reed);
 const gable=roof.at(-1).map(([px,y])=>[px,y,front]);
 sheet('fishing-entry-gable',[gable,gable.map(([px])=>[px,1.20,front])],m.reed);
 block(x+.33,.64,front+.09,.54,1.28,.09,m.reed);
 for(const px of [x-.65,x+.65])beam([px,.05,front],[px,1.35,front],.055,m.wood);
 beam([x-.70,1.32,front],[x+.70,1.32,front],.062,m.wood);
 // Knotted net over a drying rail. Its belly and heavier hem fall below the two fastenings.
 for(const px of [-2.28,-.70])beam([px,.06,1.08],[px,1.67,1.01],.048,m.wood);
 beam([-2.39,1.62,1.01],[-.62,1.62,1.01],.051,m.wood);
 const node=(i,j)=>{
  const u=i/8,v=j/4,curve=Math.sin(u*Math.PI);return [-2.24+1.47*u,1.55-.80*v-curve*(.19+.29*v),1.01+.13*v+.11*v*curve];
 };
 for(let j=0;j<4;j++)for(let i=0;i<8;i++){
  beam(node(i,j),node(i+1,j+1),.013,m.reed);
  beam(node(i+1,j),node(i,j+1),.013,m.reed);
 }
 for(let i=0;i<=8;i+=2){const [px,y,pz]=node(i,4);cylinder(px,y-.053,pz,.046,.10,m.stone,.039);}
 for(const [px,height,pz]of fishingLampSeats)block(px,height/2,pz,.48,height,.48,m.raw);
 basket(-.30,1.57,.23,.28);jar(1.94,1.04,.67);
}
function animalPen({block,beam,canopy,fence,trough,basket,cylinder,m,large},cows){
 // Scale the entrance to the movement model. The local front rotates to the
 // existing livestock gate (+X), including the safe side chosen at the shore.
 const front=2.56,back=-2.48,far=2.54;
 const opening=cows?(large?.70:1.15):(large?1.24:1.62);
 block(0,.025,0,5.16,.05,5.16,m.soil);
 fence(-far,back,-far,front,.86);fence(far,back,far,front,.86);
 fence(-far,front,-opening,front,.83);fence(opening,front,far,front,.83);
 block(0,.75,back,4.98,1.5,.19,m.raw);
 for(const x of [-2.33,2.33])block(x,.64,-1.77,.19,1.28,1.39,m.raw);
 canopy(0,-1.65,4.74,1.68,cows?2.24:1.81,cows?.29:.24);
 if(cows){
  block(0,.45,-1.69,.17,.90,1.44,m.raw);
  for(const x of [-1.16,1.16]){
   block(x,.077,-1.78,1.78,.095,.92,m.reed);
   for(let i=0;i<4;i++)beam([x-.65+i*.31,.139,-2.11],[x-.48+i*.31,.15,-1.43],.026,m.reed);
  }
  trough(1.98,.26,.47,1.82);
 }else{
  trough(-.98,-1.68,1.52,.55);
  basket(1.13,-1.64,.47,.67);
  for(let i=0;i<9;i++){
   const angle=i*2.4,r=.25*Math.sqrt(i/9);
   cylinder(1.13+r*Math.cos(angle),.75+.08*(1-i/9),-1.64+r*Math.sin(angle),.145,.15,m.linen,.095);
  }
 }
 for(const sign of [-1,1]){
  const x=sign*(opening+.035);
  // Both leaves stand open inward, leaving the centreline accessible.
  const tip=[x+sign*.28,front-.69];
  for(const h of [.25,.69])beam([x,h,front],[tip[0],h,tip[1]],.037,m.wood);
  for(let i=0;i<6;i++){const t=i/5,px=x+(tip[0]-x)*t,pz=front+(tip[1]-front)*t;beam([px,.13,pz],[px,.80,pz],.035,m.reed);}
 }
}
function cattle(kit){animalPen(kit,true);}
function sheep(kit){animalPen(kit,false);}
