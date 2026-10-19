import {artisanSummary} from './artisan.js';
import {levelOf} from './definitions.js';
import {masonryBox} from './masonry-art.js';
import {EARTH} from './map-art.js';

// Only valid production buffers become visible goods. Tools and empty vats are permanent architecture.
const EMPTY=Object.freeze({stage:'idle',elapsed:0,ready:0,clay:0,reed:0,water:0,food:0,pottery:0,vesselUses:0});
export function artisanArtState(b){return artisanSummary(b)||EMPTY;}
export function drawArtisan(r,b,s,t=0){
 if(!['pottery','brewery'].includes(b.type))return;
 const p=r.point(b.x,b.y),q=r.s,c=r.ctx,level=levelOf(b),v=artisanArtState(b),pottery=b.type==='pottery';
 const poly=(pts,color)=>r.polygon(pts.map(([x,y])=>[p.x+x*q,p.y+y*q]),color),line=(pts,color,w=1)=>r.line(pts.map(([x,y])=>[p.x+x*q,p.y+y*q]),color,w*q),box=(x,y,w,d,h,top=EARTH.ivory,left=EARTH.shade,right=EARTH.plaster)=>r.box(p.x+x*q,p.y+y*q,w*q,d*q,h*q,top,left,right),oval=(x,y,w,h,color)=>{c.fillStyle=color;c.beginPath();c.ellipse(p.x+x*q,p.y+y*q,w*q,h*q,0,0,Math.PI*2);c.fill();};
 const jar=(x,y,size=1,color='#bd825f',sealed=false)=>{oval(x,y-3.8*size,2.8*size,3.8*size,color);oval(x-.7*size,y-4*size,.7*size,2.5*size,'#e3b58a');oval(x,y-7*size,1.8*size,.8*size,sealed?'#d7c495':'#695a43');line([[x-1.9*size,y-7*size],[x+1.9*size,y-7*size]],'#ecd2a5',.7);};
 c.save();oval(3,5,28,9,'#625b4130');box(0,0,28,14,3,'#d8c19b','#a98f68','#c4aa7f');
 // The back magazine is low enough to leave the working court readable.
 const h=21+(level-1)*5;
 if(level>1)masonryBox(r,p.x-12*q,p.y-6*q,14*q,7*q,h*q,level===3?'fired':'mud',q);else box(-12,-6,14,7,h,'#e0c49b','#b1946d','#d4b78a');
 box(-12,-6-h,15,7.5,2.5,'#efdfb9','#bfa783','#ddc6a0');poly([[-23,-h-8],[-12,-h-13],[0,-h-7],[-12,-h-1]],'#c1ab85');line([[-27,-h-8],[-12,-h-15],[3,-h-8]],'#f7e7c4',1.2);
 poly([[-20,-17],[-14,-14],[-14,-1],[-20,-4]],'#766248');line([[-21,-18],[-13,-14]],'#f1ddb6',1.6);poly([[-8,-h+2],[-4,-h],[ -4,-h+7],[-8,-h+9]],'#7c7155');
 // Reed shelter: a shared silhouette, distinct woven colour for each craft.
 for(const x of [4,25])line([[x,7],[x,-21]],'#917952',1.5);
 poly([[0,-24],[17,-32],[28,-24],[11,-16]],pottery?'#c2aa7b':'#8fa69a');poly([[0,-24],[11,-16],[11,-13],[0,-21]],pottery?'#aa9068':'#6d8d80');
 for(let k=0;k<6;k++)line([[2+k*3.7,-24-k*1.1],[12+k*2.4,-16-k*1.15]],k%2?'#e6d7b0':pottery?'#aa9269':'#b6c6ad',.7);line([[0,-24],[11,-16],[28,-24]],'#f1e0b6',1);
 // Court mat, shallow water bowl and actual incoming material parcels.
 poly([[-5,5],[10,-2],[24,5],[9,12]],'#c8af83');for(let k=0;k<6;k++)line([[-2+k*4,5-k*.3],[8+k*2,10-k*.6]],'#ead6a9',.55);
 oval(-23,6,4,2,'#9d8865');oval(-23,5.5,3,1.25,v.water>0?'#79aaa0':'#c3ad86');
 if(v.clay>0)for(let k=0;k<Math.min(2,Math.ceil(v.clay/2));k++)box(-19+k*5,10,3,1.5,3,'#be9270','#967255','#ac805c');
 if(v.reed>0)for(let k=0;k<4;k++)line([[-24+k,0],[-20+k,-8]],'#ab9d69',1.5);
 if(v.food>0){box(-18,8,4,2,6,'#c5b183','#96815b','#b09b6d');line([[-21,4],[-15,1]],'#e1c998',.8);}
 if(pottery){
  // A compact, unglazed firing chamber. Flames follow an actual firing stage only.
  box(-7,2,9,4.5,13,'#bb8a62','#906549','#ad7d56');poly([[-16,-11],[-13,-22],[-7,-27],[0,-22],[2,-11],[-7,-6]],'#c99b72');
  for(let k=0;k<3;k++)line([[-14+k,-13-k*4],[-7,-9-k*5],[k,-13-k*4]],'#a77b59',.65);
  poly([[-11,1],[-11,-5],[-8,-9],[-4,-7],[-3,-3],[-3,4]],'#5e4c3c');
  if(v.stage==='firing'||v.stage==='cooling')poly([[-10,0],[-9,-4],[-5,-3],[-4,2]],v.stage==='firing'?'#df9150':'#aa6443');
  if(v.stage==='firing'){
   const flicker=r.reduce?0:Math.sin(t*8)*1.2;poly([[-9,0],[-8,-5],[-6,-9-flicker],[-4,-3],[-4,2]],'#f4c478');r.lights.push({x:p.x-7*q,y:p.y-4*q,size:17*q});
   for(let k=0;k<2;k++){const lift=r.reduce?5+k*5:(t*2+k*7)%14;oval(-7+Math.sin(lift*.2),-29-lift,1.5+lift*.07,2+lift*.12,'#77695525');}
  }
  // Hand forming rather than an unverified modern-looking wheel.
  box(15,4,7,3.5,3,'#debf93','#a58a62','#c7a87b');
  if(v.stage==='forming'){oval(13,1,2.1,1.3,'#b49876');jar(18,2,.65,'#b49a7b');}
  if(v.stage==='drying')for(let k=0;k<2;k++)jar(11+k*8,6-k*2,.9,'#c5b08b');
  if(v.stage==='ready'&&v.ready>0)for(let k=0;k<Math.min(2,v.ready);k++)jar(12+k*9,9-k*1.7,1,'#bd7d57');
 }else{
  // Two large clay brewing vessels are equipment; their surfaces show actual contents.
  for(const [x,y,size]of [[8,3,1.35],[21,3,1.1]]){
   oval(x,y-4*size,4.3*size,5.4*size,'#b7815d');oval(x-1.3*size,y-4.7*size,.85*size,3.2*size,'#dbaf7d');oval(x,y-8*size,3.6*size,1.7*size,'#dec69a');oval(x,y-8*size,2.9*size,1.15*size,v.stage==='brewing'?'#bda36c':'#74624b');
   line([[x-3.3*size,y-4*size],[x+3.3*size,y-4*size]],'#dbc08c',.7);
  }
  line([[8,-15],[12,-3]],'#8a714e',1.3);
  if(v.stage==='brewing'){for(let k=0;k<3;k++)oval(6+k*1.8,-8+(k%2)*.6,.55,.3,'#ede1b5');line([[9,-13],[11,-7]],'#dac39a',.7);}
  if(v.pottery>0||v.vesselUses>0)jar(-3,9,.75,'#b17b55',true);
  if(v.stage==='ready'&&v.ready>0)for(let k=0;k<Math.min(3,v.ready);k++)jar(1+k*8,11-k*1.5,.85,'#b77d56',true);
 }
 // A clay sign has a craft motif rather than a modern lettered shopfront.
 box(-23,0,3,1.5,6,'#e2c696','#ad8d61','#c6a676');if(pottery)line([[-24,-4],[-23,-2],[-22,-4]],'#8e6b4c',.8);else line([[-24,-4],[-22,-3]],'#738d7a',1);
 c.restore();
}
