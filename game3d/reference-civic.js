// Local metres, +Z towards the street. Layouts use the same 6 m tile frame
// as the agents, including the connected wall pieces passed in by the city.
import {createReedRoof} from './reed-roof.js';

export function batteredAdobe(B,scene,name,{x,y,z,w,h,d,insetX,insetZ},material){
 const points=[],indices=[],uvs=[];
 const lower=[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]];
 const upper=lower.map(([u,v])=>[u-Math.sign(u)*insetX,v-Math.sign(v)*insetZ]);
 function face(corners,tex){
  const k=points.length/3;
  for(const p of corners)points.push(...p);
  uvs.push(...tex.flat());
  indices.push(k,k+1,k+2,k,k+2,k+3);
 }
 for(let i=0;i<4;i++){
  const j=(i+1)%4,axis=i%2,u=lower[i][axis],v=lower[j][axis];
  face([[lower[i][0],0,lower[i][1]],[lower[j][0],0,lower[j][1]],
        [upper[j][0],h,upper[j][1]],[upper[i][0],h,upper[i][1]]],
       [[u/2,0],[v/2,0],[upper[j][axis]/2,h/2],[upper[i][axis]/2,h/2]]);
 }
 face(upper.map(([u,v])=>[u,h,v]),
      upper.map(([u,v])=>[u/2,v/2]));
 const underside=lower.slice().reverse();
 face(underside.map(([u,v])=>[u,0,v]),underside.map(([u,v])=>[u/2,v/2]));
 const normals=[],data=new B.VertexData(),mesh=new B.Mesh(name,scene);
 B.VertexData.ComputeNormals(points,indices,normals);
 Object.assign(data,{positions:points,indices,uvs,normals});data.applyToMesh(mesh);
 mesh.position.set(x,y,z);mesh.material=material;return mesh;
}

export function civicArchitecture(type,b,{B,scene,add,block,beam,cylinder,jar,ground,m},wallPieces=[]){
 const reedMat=m.reedRoof||m.reed;
 const slope=(x,y,z,w,h,d,ix,iz,mat=m.raw)=>add(batteredAdobe(B,scene,'battered-'+type,
  {x,y,z,w,h,d,insetX:ix,insetZ:iz},mat),mat);
 function awning(x,z,w,d,rear,front,cloth=false){
  const backZ=z-d/2,frontZ=z+d/2,centerHeight=(rear+front)/2;
  const slopeAngle=Math.atan2(rear-front,d);
  for(const side of [-1,1]){
   const u=x+side*(w/2-.12);
   for(const [v,h] of [[backZ+.10,rear],[frontZ-.10,front]]){
    cylinder(u,h/2,v,.085,h,m.wood,.065);
    cylinder(u,h-.14,v,.089,.12,m.reed);
   }
   beam([u,rear,backZ],[u,front,frontZ],.074,m.wood);
   beam([u,front-.45,frontZ-.10],[u,front+.02,frontZ-.58],.057,m.wood);
  }
  for(const [v,h] of [[backZ,rear],[frontZ,front]])beam([x-w/2-.05,h,v],[x+w/2+.05,h,v],.07,m.wood);
  if(cloth){
   for(let i=0;i<8;i++){
    const u=(i+.5)/8,strip=block(x-w/2+w*u,centerHeight-.10*Math.sin(Math.PI*u)+.07,z,w/8+.018,.052,d,m.linen);
    strip.rotation.x=slopeAngle;strip.rotation.z=-.105*Math.cos(Math.PI*u);
   }
  }else{
   const mesh=createReedRoof(B,scene,'tied-reed-awning',reedMat,{x,y:centerHeight+.065,z,width:w,depth:d+.14,sag:.052});
   mesh.rotation.x=slopeAngle;add(mesh,reedMat);
   for(let u=x-w*.37;u<=x+w*.39;u+=Math.max(.48,w*.24))
    beam([u,rear+.085,backZ-.07],[u,front+.085,frontZ+.07],.023,m.wood);
  }
 }
 function chamber(x,z,w,d,h,door=.92){
  const front=z+d/2,back=z-d/2;
  block(x,h/2,back,w,h,.23,m.plaster);
  for(const side of [-1,1]){
   block(x+side*(w-.22)/2,h/2,z,.22,h,d,m.plaster);
   block(x+side*(door+(w-door)/2)/2,h/2,front,(w-door)/2,h,.28,m.plaster);
   block(x+side*w/2,h+.13,z,.16,.27,d+.13,m.raw);
  }
  const opening=Math.min(h-.3,1.70);
  block(x,(h+opening)/2,front,door,h-opening,.29,m.plaster);
  block(x,opening-.01,front+.065,door+.23,.115,.30,m.wood);
  block(x,.06,front+.05,door,.12,.49,m.raw);
  block(x,h+.01,z,w+.10,.15,d+.08,m.soil);
  block(x,h+.13,back,w,.27,.18,m.raw);
  block(x,.81,back+.16,door,1.5,.065,m.shade);
  for(let u=x-w/2+.19;u<x+w/2-.02;u+=.56)beam([u,h-.11,front+.22],[u,h-.11,front-.23],.066,m.wood);
 }
 function herbSprays(clumps){
  const positions=[],indices=[],uvs=[],normals=[];
  // A leaf narrows to two points, curls along its length and folds around
  // its midrib. Each plant is a fan; hanging sprigs point towards the shelf.
  for(const [cx,y,cz,rise,spread,phase] of clumps)for(let i=0;i<9;i++){
   const angle=phase+i*2.40,reach=spread*(.48+.49*((i*7)%9)/8);
   const dx=Math.cos(angle),dz=Math.sin(angle),height=rise*(.60+.39*((i*5)%9)/8);
   const width=Math.max(.037,spread*.25),k=positions.length/3;
   const leaf=[
    [cx,y,cz],
    [cx+dx*reach*.37-dz*width,y+height*.56,cz+dz*reach*.37+dx*width],
    [cx+dx*reach*.32,y+height*.65,cz+dz*reach*.32],
    [cx+dx*reach*.37+dz*width,y+height*.56,cz+dz*reach*.37-dx*width],
    [cx+dx*reach,y+height,cz+dz*reach],
   ];
   for(const p of leaf)positions.push(...p);
   uvs.push(.5,0,0,.5,.5,.55,1,.5,.5,1);
   for(const [a,b,c] of [[0,1,2],[0,2,3],[1,4,2],[2,4,3]])indices.push(k+a,k+b,k+c,k+c,k+b,k+a);
  }
  const mesh=new B.Mesh('herb-sprigs',scene),data=new B.VertexData();
  // Opposing triangle sides share positions. Use a soft, upward-biased
  // botanical normal so the folded blades stay legible on both faces.
  for(let i=0;i<positions.length;i+=3)normals.push(.12,.98,.14);
  Object.assign(data,{positions,indices,uvs,normals});data.applyToMesh(mesh);add(mesh,m.grass||m.reed);
 }
 function basket(x,y,z,r,fill=m.reed){
  cylinder(x,y+r*.47,z,r*.80,r*.94,m.reed,r);
  for(const h of [.19,.75,.96])cylinder(x,y+r*h,z,r*(.81+.19*h)+.018,.039,m.wood);
  cylinder(x,y+r*.94,z,r*.91,.055,fill,r*.70);
 }
 function lowWall(x,z,w,d,h=.67){
  block(x,h/2,z,w,h,d,m.raw);
  block(x,h+.025,z,w+.025,.065,d+.025,m.plaster);
 }
 switch(type){
  case 'healer':{
   ground();chamber(-.22,-1.19,3.91,2.41,2.43,1.05);
   awning(-.34,.82,3.90,1.74,2.27,1.94);
   lowWall(-2.32,.83,.25,3.38);lowWall(2.36,.16,.23,4.78);
   for(const x of [-1.71,1.65])lowWall(x,2.36,1.38,.23);
   // Raised growing bed beyond the east wall of the reception room.
   block(1.99,.32,-1.08,.42,.64,2.18,m.soil);
   const herbs=Array.from({length:10},(_,i)=>[1.99+.035*Math.sin(i*4),.64,-1.95+i*.195,
    .28+.17*(i%3)/2,.19+.03*(i%2),i*1.16]);
   herbSprays(herbs);
   block(-1.53,.24,.81,.84,.48,1.34,m.raw);
   block(-1.53,.51,.81,.91,.08,1.39,m.linen);
   for(const x of [-1.56,-1.20,-.87])beam([x,2.04,.16],[x,1.80,.16],.018,m.reed);
   herbSprays([-1.56,-1.20,-.87].map((x,i)=>[x,1.82,.16,-.47,.16,.78*i]));
   for(const y of [.78,1.33]){
    block(1.12,y,.18,.91,.09,.32,m.wood);
    for(const dx of [-.27,0,.29])jar(1.12+dx,.20,.26,y+.05);
   }
   jar(1.48,.90,.85);jar(1.04,1.10,.50);
   break;
  }
  case 'market':{
   const large=b.footprint===2,c=large?3:0;
   if(large)block(c,.025,c,11.38,.05,11.38,m.soil);else ground();
   const edge=large?5.47:2.49,stall=large?3.92:1.48;
   for(const side of [-1,1]){
    lowWall(c+side*edge,c,.31,edge*2,large?.96:.80);
    lowWall(c+side*(edge*.61),c+edge,edge*.80,.31,large?.98:.73);
    if(!large)lowWall(c+side*(edge*.61),c-edge,edge*.80,.31,.87);
    const positions=large?[-1.49,.89,3.38]:[0];
    for(const [i,v] of positions.entries()){
     const x=c+side*stall,z=c+v;
     awning(x,z,large?2.39:1.71,large?2.11:3.17,large?2.34:1.98,large?2.09:1.69,large&&(side>0?i===1:i===2));
     block(x,.25,z,large?1.8:1.23,.50,large?1.51:2.15,m.raw);
     const y=.51;
     if(i===0&&side<0){
      for(const [dx,dz,size] of [[-.30,-.33,.85],[.25,.10,.58],[-.25,.46,.47]])jar(x+dx,z+dz,size,y);
     }else if(i===2&&side>0){
      for(let j=0;j<4;j++)block(x+(j%2-.5)*.68,y+.07+(j>>1)*.11,z+.07,.64,.12,.91,j%2?m.linen:m.reed);
     }else{
      basket(x-.20,y,z+.31,.35,m.reed);basket(x+.23,y,z-.35,.27,m.terracotta);
     }
    }
   }
   if(large){
    chamber(c,c-3.9,8.3,2.40,2.52,1.38);
    for(const side of [-1,1]){
     const x=c+side*2.37;awning(x,c-2.25,1.84,.89,2.04,1.87);
     for(const dx of [-.38,.27])jar(x+dx,c-2.49,.59+dx*.22);
    }
   }
   break;
  }
  case 'harbor':{
   // The store sits on the landward edge. The slatted ramp reaches water on
   // the east side, leaving a distinct lower quay and a clear mooring face.
   slope(-.48,-.24,-.49,4.25,.90,4.10,.14,.09,m.raw);
   for(let i=0;i<13;i++)block(-.47,.69,-1.96+i*.27,4.02,.105,.255,m.wood);
   chamber(1.30,-1.44,2.36,1.88,2.85,1.04);
   awning(-1.13,-.60,2.73,2.56,2.54,2.24);
   for(const [x,z,r] of [[-1.77,-.96,.38],[-1.17,-1.26,.31],[-.65,-.81,.43]])basket(x,.77,z,r);
   jar(.12,-.61,.88,.75);
   for(let i=0;i<12;i++){const h=.72-i*.056;block(1.65,h-.06,.28+i*.197,1.46,.12,.216,m.wood);}
   for(const x of [-2.17,-.71,.39]){
    cylinder(x,.53,1.56,.115,1.68,m.wood);
    for(const y of [.81,.88,.96])cylinder(x,y,1.56,.15,.048,m.reed);
   }
   break;
  }
  case 'waterpoint':{
   slope(0,-.11,-.62,4.94,.73,3.83,.12,.1,m.raw);
   chamber(.89,-1.45,2.53,1.95,2.70,.93);
   awning(-1.15,-.50,2.30,2.63,2.45,2.11);
   for(const [x,z,s] of [[-1.60,-.49,.91],[-1.01,-.70,1.09],[-.57,-.29,.71],[-1.83,.03,.56],[1.81,.45,.76]])jar(x,z,s,.63);
   for(let i=0;i<5;i++){const h=.61-i*.11;block(-.17,h/2,1.06+i*.29,2.49,h,.32,m.raw);}
   for(const x of [-1.98,1.98])slope(x,-.06,1.30,1.05,.66,1.92,.04,.12,m.raw);
   break;
  }
  case 'watchHouse':{
   ground();
   slope(-1.34,0,-1.21,2.10,4.18,2.06,.22,.20,m.raw);
   for(const s of [-1,1]){
    block(-1.34+s*.80,4.34,-1.21,.16,.35,1.69,m.raw);
    block(-1.34,4.34,-1.21+s*.77,1.72,.35,.16,m.raw);
   }
   chamber(.95,-1.29,2.27,1.93,2.11,.81);
   awning(1.18,-.06,1.81,1.16,1.95,1.69);
   block(1.38,.30,-.03,.98,.59,.46,m.wood);jar(.70,.38,.65);
   lowWall(-2.45,.70,.24,3.61,.75);lowWall(2.45,.70,.24,3.61,.75);
   for(const x of [-1.69,1.69])lowWall(x,2.42,1.61,.26,.76);
   const ladderX=-.91,topZ=-.20,footZ=.80;
   for(const dx of [-.21,.21])beam([ladderX+dx,.07,footZ],[ladderX+dx,4.39,topZ],.053,m.wood);
   for(let i=1;i<15;i++){const t=i/15;beam([ladderX-.24,.07+t*4.32,footZ-t],[ladderX+.24,.07+t*4.32,footZ-t],.033,m.wood);}
   break;
  }
  case 'cityWall':case 'cityGate':{
   for(const p of wallPieces.filter(p=>!p.gateBody)){
    const alongX=p.w>=p.d,ix=alongX?0:.105,iz=alongX?.105:0;
    slope(p.x,p.bottom,p.z,p.w,p.h-.12,p.d,ix,iz,m.plaster);
    block(p.x,p.bottom+p.h-.09,p.z,p.w-1.6*ix,.18,p.d-1.6*iz,m.raw);
    const run=alongX?p.w:p.d,span=alongX?p.d:p.w;
    if(run>2){
     for(const side of [-1,1]){
      const u=run*.17,v=side*(span*.5-.025);
      for(let i=0;i<3;i++)block(p.x+(alongX?u+(i-1)*.30:v),.22+(i%2)*.14,p.z+(alongX?v:u+(i-1)*.30),alongX?.29:.032,.13,alongX?.032:.29,m.raw);
     }
    }
   }
   if(type==='cityWall')break;
   const large=b.footprint===2,c=large?3:0,width=large?1.73:1.28,offset=large?2.04:1.57,depth=large?3.20:2.75;
   for(const side of [-1,1]){
    const z=c+side*offset;
    slope(c,-.14,z,depth,3.14,width,.18,.14,m.plaster);
    for(const end of [-1,1]){
     const x=c+end*(depth/2-.16);
     for(let i=0;i<3;i++)block(x,2.77,z+(i-1)*width*.24,.065,.29,.104,m.shade);
    }
    block(c,3.03,z,depth-.21,.16,width-.18,m.raw);
    for(const end of [-1,1]){
     block(c+end*(depth/2-.24),3.14,z,.15,.26,width-.24,m.raw);
     block(c,3.15,z+end*(width/2-.15),depth-.32,.24,.15,m.raw);
    }
   }
   block(c,2.68,c,depth*.83,.26,offset*2,m.wood);
   block(c,2.96,c,depth*.91,.36,offset*2,m.raw);
   break;
  }
 }
}
