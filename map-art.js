import {seed} from './city-life.js';
import {levelOf} from './definitions.js';
import {houseLightCount} from './households.js';
import {masonryBox} from './masonry-art.js';

// Local pigments: mineral blue-green is a textile accent, never glazed Babylonian walls.
export const EARTH={ivory:'#f0dfb7',plaster:'#e4cda3',shade:'#a88b65',clay:'#c38765',dark:'#5b5947',teal:'#739b91',reed:'#c7b582',ink:'#7d694e'};
export function houseVariant(b){return Math.min(3,Math.floor(seed(b.x,b.y)*4));}
function brush(r,b){
 const p=r.point(b.x,b.y),q=r.s,c=r.ctx;
 return {p,q,c,poly:(pts,color)=>r.polygon(pts.map(([a,z])=>[p.x+a*q,p.y+z*q]),color),line:(pts,color,width=1)=>r.line(pts.map(([a,z])=>[p.x+a*q,p.y+z*q]),color,width*q),box:(a,z,w,d,h,top=EARTH.ivory,left=EARTH.shade,right=EARTH.plaster)=>r.box(p.x+a*q,p.y+z*q,w*q,d*q,h*q,top,left,right),oval:(a,z,w,h,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(p.x+a*q,p.y+z*q,w*q,h*q,0,0,Math.PI*2);c.fill();}};
}
function vessel(a,x,z,size=1,color=EARTH.clay){a.oval(x,z-3.5*size,2.9*size,3.7*size,color);a.oval(x-.7*size,z-4,1*size,2.3*size,'#e8bc8e');a.oval(x,z-6.5*size,1.8*size,.8*size,'#695b45');a.line([[x-1.9*size,z-6.8*size],[x+1.9*size,z-6.8*size]],'#edd4a5',.65);}
function mat(a,x,z,w=10,color=EARTH.reed){a.poly([[x-w,z],[x,z-w*.5],[x+w,z],[x,z+w*.5]],color);for(let i=-w+2;i<w;i+=2)a.line([[x+i,z+(w-Math.abs(i))*.5],[x+i,z-(w-Math.abs(i))*.5]],'#edddb0',.45);}
function shade(a,x,z,w=19,color=EARTH.teal){
 for(const dx of [-w,w])a.line([[x+dx,z+8],[x+dx,z-13]],'#8b7252',1.2);
 a.poly([[x-w-2,z-14],[x,z-14-w*.5],[x+w+2,z-14],[x,z-8]],color);
 a.poly([[x-w-2,z-14],[x,z-8],[x,z-5],[x-w-2,z-11]],'#66867c');
 for(let i=-w+3;i<w;i+=5)a.line([[x+i,z-14-(w-Math.abs(i))*.45],[x+i*.8,z-8-Math.abs(i)*.25]],'#ded9ad',.65);
 a.line([[x-w-2,z-14],[x,z-8],[x+w+2,z-14]],'#f2e1b5',1);
}
function rooftop(a,x,z,w,d){
 a.box(x,z,w,d,2.3);a.poly([[x-w+3,z-1],[x,z-d+2],[x+w-3,z-1],[x,z+d-3]],'#c6b28c');
 // Continuous parapet returns keep the small roofs visibly solid.
 a.line([[x-w,z-2],[x,z-d-2],[x+w,z-2]],'#fff0cc',1.3);
}
export function drawCourtyardHouse(r,b,state){
 const a=brush(r,b),{p,q,c}=a,level=levelOf(b),variant=houseVariant(b),h=25+(level-1)*9+(variant===3?7:0),night=(r.lighting?.night||0)>.12;
 const residents=r.houseOccupancy?.get(`${b.x},${b.y}`)??state.citizens?.filter(v=>v.home===`${b.x},${b.y}`).length??0,lights=night?houseLightCount(b,residents):0;
 c.save();a.oval(4,7,28,8,'#625e4430');a.box(0,0,28,14,2.5,'#d6bf95','#ab9169','#c4aa7e');
 // A real open court in the plan replaces the former single solid tower.
 mat(a,3,5,12,'#c5ac7e');
 const wing=(x,z,w,d,height)=>{
  if(level>1)masonryBox(r,p.x+x*q,p.y+z*q,w*q,d*q,height*q,level===3?'fired':'mud',q);
  else a.box(x,z,w,d,height,'#e2cda5','#b89b73','#d6bd94');
  a.poly([[x-w,z-height+2],[x,z+d-height+2],[x+w,z-height+2],[x+w,z-height+6],[x,z+d-height+6],[x-w,z-height+6]],'#f1dfb9');rooftop(a,x,z-height,w+1,d+.5);
 };
 wing(-10,-5,16,8,h);wing(13,-5,12,6,h-7);
 // Door recesses, sculpted lintel and a foot-worn threshold on the court wall.
 a.poly([[-13,-12],[-6,-8.5],[-6,0],[-13,-3.5]],'#706047');a.line([[-14,-13],[-5,-8.5]],'#edd9af',2);a.box(-9,1,5,2.5,1,'#e8d5af');
 a.poly([[8,-10],[14,-13],[14,0],[8,3]],'#675b45');a.line([[7,-11],[15,-15]],'#e9d4a8',1.8);
 // Exactly the legacy household light count, distributed over the actual walls/court.
 const apertures=[[-21,-h+9,1],[-13,-h+13,1],[18,-h+12,-1]];
 const total=Math.max(3,lights);for(let i=0;i<total-1;i++){const [x,z,face]=apertures[i%3];a.poly([[x,z],[x+3.5,z+face*1.75],[x+3.5,z+6+face*1.75],[x,z+6]],i<lights-1?'#f5c87c':'#827356');a.line([[x+1.7,z+1],[x+1.7,z+6]],'#c4b084',.6);if(i<lights-1)r.lights.push({x:p.x+(x+1.5)*q,y:p.y+(z+3)*q,size:15*q});}
 if(lights){a.poly([[8,-9],[14,-12],[14,0],[8,3]],'#cba16a');r.lights.push({x:p.x+11*q,y:p.y-5*q,size:24*q});}
 mat(a,-11,-h-2,7,variant%2?'#b97960':'#799b8f');vessel(a,-21,-h+1,.65);
 a.box(-18,-h-2,3,1.5,3);a.box(-20,-h-2,2,1,5);a.line([[-22,-h-8],[-22,-h-16],[-9,-h-10],[-9,-h-3]],'#957b55',.8);
 if(variant!==1)shade(a,8,4,13,variant===2?'#b77e63':'#96a58a');
 else {a.line([[3,-8],[22,-18]],'#8e7756',.7);a.poly([[7,-10],[13,-13],[13,-5],[7,-2]],'#ddc99f');a.poly([[16,-14],[20,-16],[20,-9],[16,-7]],'#a6ae8b');}
 // Front court walls are drawn last: residents are still occluded by one scene entry.
 a.box(-17,7,9,4.5,7,'#eddbb4','#baa07b','#d5bd96');a.box(20,6,7,3.5,5,'#efddb7','#b89c72','#d8be93');
 vessel(a,-19,10,.85);vessel(a,21,9,.7);mat(a,1,10,5,'#c09971');
 if(level>1){vessel(a,16,-h+7,.65,'#c4936d');a.line([[-25,-6],[-25,-14]],'#8e9b71',1.4);a.line([[-25,-11],[-28,-15]],'#7c9069',1.2);}
 c.restore();
}

// These details are inside each building's existing sorted sprite, not a foreground overlay.
export function drawBuildingFinish(r,b,state){
 const a=brush(r,b),level=levelOf(b);
 if(b.type==='brickyard'){
  shade(a,-10,-2,15,'#cab587');mat(a,14,5,9,'#aa8865');
  for(let k=0;k<5;k++)a.line([[-7+k*5,8],[-5+k*5,9],[-5+k*5,6],[-7+k*5,5],[-7+k*5,8]],'#7e684c',.6);
  vessel(a,-24,7,.75);a.line([[-18,7],[-11,2],[-7,3]],'#79664d',1.2);
 }else if(b.type==='weaver'){
  shade(a,-7,-17,18,'#91a393');rooftop(a,-7,-28,19,9.5);
  mat(a,-7,-31,7,'#bc7f62');a.poly([[7,-18],[21,-25],[21,-6],[7,1]],'#c7b488');
  for(let i=0;i<8;i++)a.line([[8+i*1.7,-18-i*.5],[8+i*1.7,-1-i*.5]],i%2?'#e9d9af':'#8aa296',.6);
  for(let z=0;z<3;z++)a.line([[7,-14+z*5],[21,-21+z*5]],'#9d6854',1.8);
  for(let k=0;k<3;k++)a.oval(-21+k*4,5+k*1.4,2,2.7,['#dfd7b6','#9bb4a2','#bc8b6d'][k]);
 }else if(b.type==='market'){
  mat(a,0,10,8,'#b8a174');a.oval(-17,2,3,1.3,'#6f674d');
  for(let k=0;k<6;k++)a.oval(7+k*2.8,5-k*1.3,.85,1.1,k%2?'#d7bc70':'#a88658');
  a.line([[-24,-20],[-24,-29]],'#957a53',1.3);a.poly([[-24,-29],[-17,-25],[-24,-21]],'#d4be8a');
 }else if(b.type==='granary'){
  // Ventilated mudbrick magazines and reed hatch caps; no ornamental glazed silos.
  for(let i=-1;i<2;i++){const x=i*13,h=38+(level-1)*10;a.oval(x,-h,7.7,3.7,'#dac49b');a.oval(x,-h,3.4,1.6,'#75694e');a.line([[x-8,-h],[x,-h+4],[x+8,-h]],'#f4e3ba',1);for(let z=0;z<3;z++)a.line([[x-6,-h+9+z*6],[x,-h+12+z*6],[x+6,-h+9+z*6]],'#b69c7555',.7);a.line([[x-5,-h-1],[x+4,-h-4]],'#a89468',1.3);}
  a.line([[-22,6],[-22,-25],[-17,-28],[-17,3]],'#8b7552',1);for(let z=-21;z<3;z+=4)a.line([[-22,z],[-17,z-2.5]],'#b49a6c',1);
  mat(a,1,10,9);vessel(a,24,8,.65);
 }else if(b.type==='shrine'||b.type==='ziggurat'){
  const big=b.type==='ziggurat',levels=(big?4:2)+level-1,step=big?13:11,h=levels*step;
  // Ivory sanctuary with recessed buttresses. Teal is a small cloth at the entry.
  a.box(0,-h,12,6,22,'#f0e1bd','#c1a580','#e4cfaa');
  for(const x of [-10,-4])a.poly([[x,-h-20],[x+2,-h-19],[x+2,-h+3],[x,-h+2]],'#f0dfb8');
  a.poly([[3,-h-13],[8,-h-15.5],[8,-h+1],[3,-h+3.5]],'#675b49');a.poly([[3,-h-13],[8,-h-15.5],[8,-h-12],[3,-h-9.5]],'#7b9d90');
  rooftop(a,0,-h-22,13,6.5);a.line([[-12,-h-19],[0,-h-13],[12,-h-19]],'#c5a47a',.9);
  for(const side of [-1,1]){vessel(a,side*24,7,.75);a.box(side*21,3,3,1.5,4,'#e5c89c','#b68a61','#ccaa7e');}
 }
}
