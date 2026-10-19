import {cropFor} from './agriculture.js';
import {fieldWater,drawCanal} from './irrigation.js';
import {houseLightCount} from './households.js';
import {levelOf} from './definitions.js';
import {seed} from './city-life.js';

// All solid architecture is painted inside its depth-sorted scene entry.
// Details and windows therefore occlude residents exactly like the main walls.
export function drawBuilding(r, b, state, t) {
  if(b.type==='canal'){drawCanal(r,b,state);return;}
  if(b.type==='bridge'){r.bridge(b);return;}
  const level=levelOf(b);
  const p=r.point(b.x,b.y), c=r.ctx, q=r.s, x=p.x, y=p.y;
  const night=r.lighting?.night||0,occupied=b.type==='house'?(r.houseOccupancy?.get(`${b.x},${b.y}`)??state.citizens?.filter(c=>c.home===`${b.x},${b.y}`).length??0):0,lit=b.type==='house'?houseLightCount(b,occupied):Infinity;let windowIndex=1;
  const poly=(points,fill)=>r.polygon(points.map(([a,z])=>[x+a*q,y+z*q]),fill);
  const line=(points,color,width=1)=>r.line(points.map(([a,z])=>[x+a*q,y+z*q]),color,width*q);
  const box=(a,z,w,d,h,top,left,right)=>r.box(x+a*q,y+z*q,w*q,d*q,h*q,top,left,right);
  const glow=(a,z,size=22)=>r.lights.push({x:x+a*q,y:y+z*q,size:size*q});
  const pot=(a,z,size=1)=>{
    c.fillStyle='#a96e46';c.beginPath();c.ellipse(x+a*q,y+(z-3*size)*q,3.1*size*q,4*size*q,0,0,7);c.fill();
    c.fillStyle='#d1a16c';c.beginPath();c.ellipse(x+a*q,y+(z-6.3*size)*q,2.2*size*q,1*size*q,0,0,7);c.fill();
    line([[a-1.5*size,z-6.4*size],[a+1.5*size,z-6.4*size]],'#715d40',.7);
  };
  const window=(a,z,face=1)=>{const on=night>.12&&windowIndex++<lit;
    poly([[a,z],[a+5,z+2.5*face],[a+5,z+10+2.5*face],[a,z+10]],'#94794f');
    poly([[a+.8,z+1.4],[a+4.2,z+1.4+1.7*face],[a+4.2,z+8.6+1.7*face],[a+.8,z+8.6]],on?'#f5c36c':'#736b53');
    line([[a+2.5,z+2],[a+2.5,z+9.5]],on?'#ad8046':'#baa77a',.8);
    if(on)glow(a+2.5,z+5,16);
  };
  c.save();
  c.fillStyle='#5a62452e';c.beginPath();c.ellipse(x+8*q,y+6*q,30*q,11*q,.1,0,7);c.fill();

  if(b.type==='house') {
    const tall=seed(b.x,b.y)>.64, h=(tall?43:35)+(level-1)*12;
    box(0,1,27,13.5,3,'#d0b888','#b3996c','#bea575');
    box(0,0,25,12.5,h,'#e5cfa0','#b99967','#d7b883');
    for(let z=-h+5;z<-3;z+=5){
      line([[-24,z],[0,z+12],[24,z]],'#ac8e5b55',.7);
      for(let i=0;i<3;i++)line([[-22+i*8,z+(-22+i*8)*.5+12],[-22+i*8,z+(-22+i*8)*.5+16]],'#ac8e5b40',.65);
    }
    // A pale plaster band, timber lintel and recessed doorway.
    poly([[-25,-h+2],[0,-h+14],[25,-h+2],[25,-h+8],[0,-h+20],[-25,-h+8]],'#e7d2aa');
    poly([[6,-8],[15,-12.5],[15,4.5],[6,9]],'#715e43');
    poly([[7,-7],[14,-10.5],[14,4],[7,7.5]],night>.12&&lit>0?'#d3a35e':'#5e5641');
    line([[5,-9],[16,-14.5]],'#a17c4c',2);
    line([[10,6],[10,-8]],'#9b7c50',.9);
    window(-18,-h+14,1);window(14,-h+12,-1);
    if(tall)window(-8,-h+20,1);
    // Roof parapet, inner courtyard, roof steps and a drying textile.
    box(0,-h,26,13,3,'#eeddb4','#d2b989','#ddc697');
    box(0,-h-3,20,10,1,'#bea97a','#b49f73','#c8b484');
    box(-11,-h-3,6,3,3,'#ead3a1','#c9ae7b','#d7bf8a');
    box(-14,-h-3,3,1.5,6,'#e5ce9a','#c0a16c','#d3b780');
    poly([[0,-h-3],[12,-h-9],[19,-h-5],[7,-h+1]],seed(b.x,7)>.5?'#809a8b':'#b66e54');
    for(let i=0;i<4;i++)line([[1+i*2,-h-3-i],[8+i*2,-h-6-i]],'#e0cf9c',.6);
    // Linen shade and two slender supports outside the doorway.
    line([[7,8],[7,-7]],'#8c7954',1.2);line([[24,0],[24,-15]],'#8c7954',1.2);
    poly([[4,-11],[22,-20],[26,-14],[8,-5]],'#a7b28b');
    line([[7,-6],[25,-15]],'#d8d5a7',1.1);
    pot(-22,3,.9);pot(-16,7,.65);
    if(night>.12&&lit>0)glow(11,-3,25);
  }

  if(b.type==='healer') {
    const h=28+(level-1)*7;
    box(0,1,27,13.5,3,'#dccba7','#b29a74','#c5ae87');
    box(-5,-3,20,10,h,'#e8d9b6','#bda57e','#d2bd97');
    box(-5,-h-3,21,10.5,3,'#eee1bf','#c9b48c','#dcca9f');
    poly([[2,-7],[12,-12],[12,5],[2,10]],'#716950');
    line([[8,9],[8,-14]],'#8b7957',1.3);line([[27,0],[27,-23]],'#8b7957',1.3);
    poly([[0,-15],[22,-26],[28,-18],[6,-7]],'#72958b');
    for(let i=0;i<3;i++){pot(-24+i*5,3+i*2,.8);line([[-24+i*5,-4+i*2],[-27+i*5,-11+i*2]],'#65814d',2);}
    box(19,4,7,3.5,5,'#b5c4a1','#809575','#99ad89');pot(23,-5,1);
    window(-18,-h+11,1);if(level>1)window(-8,-h+16,1);
    poly([[-9,-h+2],[-2,-h+5],[-2,-h+11],[-9,-h+8]],'#72958b');
  }

  if(b.type==='market') {
    // An open court and two shaded stalls leave the central delivery passage clear.
    box(0,1,27,13.5,3,'#e2cda2','#b39a6d','#ccb584');
    for(let k=0;k<5;k++)line([[-24+k*10,-9+k*5],[-4+k*6,11-k*3]],'#c6b088',.65);
    box(-11,-4,13,6.5,17+(level-1)*4,'#ddc69b','#b29464','#c8ad7c');
    poly([[-20,-14],[-12,-10],[-12,-3],[-20,-7]],'#75654a');
    const canopy=(a,z,color)=>{
      for(const dx of [-11,11])line([[a+dx,z+8],[a+dx,z-22]],'#8a704b',1.6);
      poly([[a-13,z-23],[a+8,z-33],[a+14,z-20],[a-8,z-9]],color);
      for(let i=0;i<5;i++)line([[a-11+i*4,z-23-i*2],[a-7+i*4,z-10-i*2]],'#eddfb0',2);
      poly([[a-8,z-9],[a+14,z-20],[a+14,z-16],[a-8,z-5]],color);
      for(let i=0;i<6;i++)line([[a-7+i*4,z-9-i*2],[a-7+i*4,z-5-i*2]],'#e9d9a8',.7);
    };
    canopy(-11,-7,'#9ba98b');canopy(13,7,'#b78167');
    box(13,8,11,5.5,10,'#d5ba87','#9d8058','#b79a6a');
    for(let k=0;k<4;k++){pot(7+k*4,6-k*1.5,.5);box(-23+k*4,2+k*1.3,2,1,3,'#dbc27b','#ac9255','#c8ad69');}
    // Bales, scales and a clay tablet identify trade without relying on text.
    box(-17,8,5,2.5,7,'#c2b582','#8e865e','#aaa06e');
    line([[-17,1],[-17,8]],'#ded09f',.8);line([[-21,4],[-13,0]],'#ded09f',.8);
    line([[11,-8],[11,-19],[6,-21],[17,-16]],'#806d47',1.2);
    line([[6,-21],[4,-16],[8,-14]],'#dac483',.8);line([[17,-16],[15,-11],[19,-9]],'#dac483',.8);
    if(level>1){box(-11,-(22+(level-1)*4),14,7,3,'#ead5a9','#b99b69','#d1b786');pot(-10,-27,.65);}
    if(level>2){line([[-25,-17],[-25,-40]],'#8d7651',1.4);poly([[-25,-40],[-15,-35],[-25,-31]],'#788f82');}
    if(night>.12)glow(3,-13,34);
    r.marketCargo?.(b,state);
  }

  if(b.type==='field') {
    const crop=cropFor(state,b),water=fieldWater(state,b),dry=state.season===1&&!water.canal&&!state.rain&&!(crop.legacyYear===state.year&&water.natural);
    const density=state.season===0?crop.sown:state.season===1?crop.sown:state.season===2?(crop.total?crop.sown*crop.remaining/crop.total:0):0,height=state.season===0?2:state.season===1?2+crop.growth*5:7;
    r.tile(b.x,b.y,state.season===3||density===0?'#b69b6d':dry?'#ac935b':'#94a86a');
    for(let k=0;k<7;k++){
      const yy=-.39+k*.13;
      r.line([r.point(b.x-.42,b.y+yy),r.point(b.x+.42,b.y+yy)],dry?'#897447':'#688352',2*q);
      for(let j=0;j<7*density;j++){
        const a=r.point(b.x-.38+j*.12,b.y+yy),sway=r.reduce?0:Math.sin(t*1.5+k+j)*q;
        r.line([[a.x,a.y],[a.x+sway,a.y-height*q]],dry?'#c9b276':state.season===2?'#dfc77f':'#c1c87b',1.3*q);
        r.line([[a.x+sway,a.y-height*q],[a.x-2*q+sway,a.y-(height-2)*q]],'#d5ce87',.8*q);
      }
    }
    const floor=[r.point(b.x+.05,b.y+.1),r.point(b.x+.45,b.y+.1),r.point(b.x+.45,b.y+.45),r.point(b.x+.05,b.y+.45)];r.polygon(floor,'#c7af79','#9f8859');
    if(crop.sheaves>0)for(let k=0;k<Math.min(5,Math.ceil(crop.sheaves/7));k++){const p=r.point(b.x+.12+k*.065,b.y+.3);for(let j=0;j<3;j++)r.line([[p.x+j*q,p.y],[p.x+(j+6)*q,p.y-5*q]],'#dbbe71',1.5*q);}
    if(crop.seedStock>0){const p=r.point(b.x-.28,b.y+.34);r.box(p.x,p.y,3*q,1.5*q,4*q,'#bb9b66','#92764c','#a98c5a');}
    const a=r.point(b.x-.46,b.y-.45),z=r.point(b.x-.46,b.y+.45);
    r.line([a,z],dry?'#a6885b':'#79aaa0',2*q);
  }

  if(b.type==='clay') {
    box(0,0,26,13,3,'#c49b72','#a77c58','#b78d63');
    box(-4,1,16,8,2,'#a67d59','#906b4f','#a17a58');
    for(let k=0;k<10;k++) {
      const a=-13+seed(k,b.x)*30,z=-5+seed(k,b.y)*13;
      box(a,z,5,2.5,4+seed(k,1)*7,'#d8b27e','#a47c54','#bf9667');
      line([[a-4,z-4],[a+4,z-8]],'#ecce9d',.7);
    }
    line([[-21,-5],[-21,-30],[8,-15],[8,3]],'#816a46',2);
    poly([[-24,-32],[-4,-42],[11,-33],[-9,-23]],'#c6b17a');
    for(let i=0;i<5;i++)line([[-21+i*4,-32-i*2],[-6+i*4,-23-i*2]],'#9e8c60',.7);
    pot(19,5,1.1);
  }

  if(b.type==='reed') {
    box(0,0,25,12.5,3,'#d4c18d','#aa9869','#baaa79');
    for(let k=0;k<6;k++){
      const a=-17+k*6,z=(k%2)*3;
      for(let j=0;j<3;j++)line([[a+j,z],[a+j-3,-25-j*2]],'#b5ad70',2);
      line([[a-3,-17],[a+2,-15]],'#826b49',1.5);
    }
    line([[-23,0],[-23,-33],[3,-20],[3,11]],'#8f7950',2);
    poly([[-26,-35],[-3,-46],[13,-37],[-10,-25]],'#bca770');
    for(let i=0;i<7;i++)line([[-25+i*3,-34-i*1.5],[-10+i*3,-26-i*1.5]],'#d6c58c',1);
    box(13,6,10,5,8,'#e2d098','#af9e6b','#c7b87d');
    pot(-11,13,.8);
  }

  if(['fishing','hunting','logging','quarry'].includes(b.type)) {
    const fishing=b.type==='fishing',hunting=b.type==='hunting',logging=b.type==='logging';
    box(0,0,25,12.5,3,'#c4b385','#9c8962','#b39e71');
    if(b.type==='quarry') {
      for(let k=0;k<7;k++){const a=-18+seed(k,b.x)*37,z=-5+seed(k,b.y)*13;box(a,z,7,3.5,8+seed(k,7)*15,'#c6c4ad','#8c948a','#aab1a0');line([[a-5,z-6],[a+5,z-11]],'#e4dfc5',1);}
      line([[-19,2],[-19,-39],[7,-27]],'#7e694b',2.4);line([[-19,-37],[7,-25],[7,-8]],'#a38b5b',1.5);
      box(7,-3,5,2.5,8,'#bbb9a1','#8b9186','#a5ad9b');
    } else {
      const h=23+(level-1)*5;
      box(-3,-1,16,8,h,'#c7b080','#99825a','#b49b6d');
      poly([[-24,-h-2],[-5,-h-24],[19,-h-3],[-2,-h+8]],fishing?'#b5ba92':hunting?'#a98259':'#8d9b73');
      for(let i=0;i<7;i++)line([[-22+i*5,-h-1+i*.4],[-5+i*3,-h-22+i*2.7]],'#d4c18c',.8);
      poly([[0,-12],[8,-16],[8,4],[0,8]],'#635b43');
      if(fishing){
        for(let i=0;i<5;i++)box(17-i*3,5+i*1.5,9,1.5,2,'#cbb382','#987e53','#b29b6c');
        line([[19,4],[24,-31]],'#816f4e',1.3);line([[24,-31],[29,-4]],'#d8d4b0',.7);
        for(let i=0;i<5;i++)line([[-21+i*4,-16],[-13+i*4,3]],'#c4c7a1',.7);
        for(let i=0;i<4;i++)line([[-20,-14+i*4],[-3,-5+i*4]],'#c4c7a1',.7);
        pot(-19,7,1);
      } else if(hunting){
        line([[12,8],[12,-20],[24,-26],[24,2]],'#7e6949',1.8);
        poly([[13,-18],[17,-17],[22,-22],[23,-7],[18,-2],[14,-5]],'#b88d5b');
        line([[-20,4],[-24,-20]],'#745f44',1.8);line([[-24,-20],[-16,-17]],'#b5ab8b',2);
        line([[18,-6],[18,-16]],'#8a6747',.8);
      } else {
        for(let i=0;i<5;i++){box(10+i*2,9-i*2,10,2,4,'#b79c66','#7d6848','#9f8254');line([[3+i*2,6-i*2],[18+i*2,-1-i*2]],'#dbc48c',1);}
        box(-20,7,6,3,10,'#c4ac78','#8c754e','#a68d5d');
        line([[-20,-2],[-14,-20]],'#796348',2);poly([[-16,-22],[-8,-21],[-10,-15],[-17,-17]],'#b5b9a8');
      }
      if(night>.12)glow(4,-5,22);
    }
  }

  if(b.type==='shrine'||b.type==='ziggurat') {
    const big=b.type==='ziggurat',levels=(big?4:2)+(level-1),step=big?13:11;
    for(let l=0;l<levels;l++){
      const w=(big?29:26)-l*(big?4.5:7);
      box(0,-l*step,w,w*.5,step,l%2?'#e0c78f':'#ead3a2',l%2?'#b4925c':'#bea475',l%2?'#cfac73':'#dac18d');
      line([[-w,-(l+1)*step+3],[0,-(l+1)*step+w*.5+3],[w,-(l+1)*step+3]],'#f0ddaf',1);
      if(big&&l<3)for(let i=0;i<5-l;i++)box(-w+5+i*7,-l*step-2+(i*3.5),1.2,.6,6,'#b8a375','#9d895e','#c1af7e');
    }
    const h=levels*step;
    box(0,-h,12,6,22,'#e7d3a2','#3e7a7f','#579290');
    for(let i=0;i<4;i++)poly([[-11+i*3,-h-20+i*1.5],[-9.5+i*3,-h-19.25+i*1.5],[-9.5+i*3,-h-2+i*1.5],[-11+i*3,-h-2.75+i*1.5]],'#c8bd87');
    box(0,-h-22,14,7,4,'#edce74','#bfa35e','#d6b96b');
    poly([[2,-h-13],[8,-h-16],[8,-h+1],[2,-h+4]],night>.12?'#f0bd61':'#354e4a');
    poly([[-5,14],[5,9],[5,-h+1],[-5,-h+6]],'#ead4a1');
    for(let i=0;i<h/3;i++)line([[-5,12-i*3],[5,7-i*3]],'#b39a67',1);
    line([[0,-h-26],[0,-h-40]],'#a2894e',1.6);
    c.fillStyle='#f1cc75';c.beginPath();c.arc(x,y-(h+43)*q,4*q,0,7);c.fill();
    for(const a of [-19,19]){
      box(a,6,3,1.5,10,'#d9bd7e','#aa8e56','#bfa46c');
      poly([[a-2,-5],[a,-12-(r.reduce?0:Math.sin(t*4+a)*1.5)],[a+2,-5]],'#efb753');
      glow(a,-8,27);
    }
    if(night>.12)glow(4,-h-7,big?40:30);
  }

  if(b.type==='garden') {
    r.tile(b.x,b.y,'#9eaf75');
    box(0,0,26,13,3,'#b8c08a','#9b9e69','#a9ad76');
    box(0,-2,11,5.5,2,'#9ec1af','#b3b78b','#bbc393');
    r.palm(x-14*q,y-4*q,.85,t);r.palm(x+15*q,y-2*q,.95,t);r.palm(x-2*q,y+9*q,.72,t);
    for(let k=0;k<7;k++){c.fillStyle=k%2?'#c9b970':'#d9cda0';c.beginPath();c.arc(x+(-19+seed(k,2)*38)*q,y+(-6+seed(k,3)*16)*q,1.3*q,0,7);c.fill();}
    box(-13,8,7,3.5,4,'#d9c795','#b9a677','#c9b888');
  }

  if(b.type==='granary') {
    box(0,0,26,13,4,'#d6bf8e','#b49b68','#c5ac78');
    for(let i=-1;i<2;i++) {
      const a=i*13;
      box(a,-2,8,4,36+(level-1)*10,'#e1c99a','#b99b69','#d3b781');
      c.fillStyle='#cfb884';c.beginPath();c.ellipse(x+a*q,y-(38+(level-1)*10)*q,8*q,4*q,0,0,7);c.fill();
      c.fillStyle='#766b4b';c.beginPath();c.ellipse(x+a*q,y-(38+(level-1)*10)*q,3*q,1.6*q,0,0,7);c.fill();
      line([[a-7,-27],[a,-23.5],[a+7,-27]],'#b59664',1);
      poly([[a+1,-8],[a+5,-10],[a+5,-2],[a+1,0]],'#81724f');
    }
    box(0,8,18,6,4,'#e1c995','#b7a06b','#ccb381');
    for(let k=0;k<5;k++)box(-17+k*7,7+seed(k,2)*3,4,2,4+seed(k,3)*4,'#d1bf83','#ab9c68','#bfaf76');
    pot(23,4,1.1);
  }
  if(level>1){
    // Additional masonry and a readable tablet remain inside the tile footprint.
    if(!['house','field','garden'].includes(b.type))for(let i=0;i<level-1;i++)line([[-23,-8-i*5],[0,3.5-i*5],[23,-8-i*5]],'#eed9aa',1.6);
    if(b.type==='field')for(let i=0;i<level-1;i++)box(-18+i*8,3,3,1.5,9+i*2,'#d9c78b','#a18f59','#bba96a');
    if(b.type==='garden')box(14,-4,5,2.5,7+(level-1)*3,'#dac896','#a5a774','#c2bc89');
    box(0,11,6,3,7,'#e9d5a7','#ad8c59','#ceb17b');
    c.fillStyle='#665337';c.textAlign='center';c.font=`bold ${Math.max(6,7*q)}px Georgia`;c.fillText(level===2?'II':'III',x,y+9*q);
  }
  c.restore();
}
