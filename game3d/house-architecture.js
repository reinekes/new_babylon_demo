import {organicHousePoint,organicHouseVariant} from './field-shore.js';

// Starter beehives are an artistic opening, not a reconstruction of a typical
// third-millennium Sumerian house. Levels II/III use mudbrick courtyard masses.
export const houseVisualKind=b=>b.starterHut&&Number(b.level||1)===1?'hut':`courtyard-${Math.max(1,Math.min(3,b.level||1))}`;
export function createHouseArchitecture(B,scene,b,m){
 const groups=new Map(),variant=organicHouseVariant(b),kind=houseVisualKind(b);let serial=0;
 const add=(mesh,mat,name)=>{mesh.material=mat||m.plaster;mesh.metadata={housePart:name};if(!groups.has(mesh.material))groups.set(mesh.material,[]);groups.get(mesh.material).push(mesh);return mesh;};
 const block=(name,x,y,z,w,h,d,mat=m.plaster)=>{
  const r=Math.min(.075,w*.15,d*.15),ring=[[-w/2+r,-d/2],[w/2-r,-d/2],[w/2,-d/2+r],[w/2,d/2-r],[w/2-r,d/2],[-w/2+r,d/2],[-w/2,d/2-r],[-w/2,-d/2+r]],p=[],indices=[],uv=[];
  for(let k=0;k<8;k++){const edge=[ring[k],ring[(k+1)%8]],base=p.length/3;for(let j=0;j<3;j++)for(const [xx,zz]of edge){const f=j===1?1.012:j===2?.98:1;p.push(xx*f,(j/2-.5)*h,zz*f);uv.push((Math.abs(edge[1][0]-edge[0][0])>.01?xx:zz)*f/2,j*h/4);}for(let j=0;j<2;j++){const a=base+j*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}}
  const cap=p.length/3;for(const j of [0,2])for(const [xx,zz]of ring){const f=j===2?.98:1;p.push(xx*f,(j/2-.5)*h,zz*f);uv.push(xx/2,zz/2);}for(let k=1;k<7;k++)indices.push(cap,cap+k+1,cap+k,cap+8,cap+8+k,cap+8+k+1);
  const normals=[];B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals,uvs:uv});const mesh=new B.Mesh(`house-${name}-${serial++}`,scene);data.applyToMesh(mesh);mesh.position.set(x,y,z);return add(mesh,mat,name);
 };
 const pole=(name,x,z,y,h,r=.045,mat=m.wood)=>{const mesh=B.MeshBuilder.CreateCylinder(`house-${name}-${serial++}`,{height:h,diameter:r*2,tessellation:8},scene);mesh.position.set(x,y+h/2,z);return add(mesh,mat,name);};
 const canopy=(name,x,z,w,d,y,base=0)=>{for(const sx of [-1,1])for(const sz of [-1,1])pole(`${name}-post`,x+sx*(w/2-.08),z+sz*(d/2-.08),base,y-base);for(const sz of [-1,1])block(`${name}-beam`,x,y-.025,z+sz*(d/2-.07),w+.08,.09,.09,m.wood);for(let i=0;i<12;i++){const f=i/11,part=block(name,x-w/2+w*(i+.5)/12,y-.075*Math.sin(f*Math.PI),z,w/12+.015,.055,d,m.reed);part.rotation.z=-.065*Math.cos(f*Math.PI);}};
 const jar=(name,x,z,s=.55,y=0,green=false)=>{const shape=[[0,0],[.18,.035],[.34,.2],[.37,.5],[.25,.77],[.18,.84],[.19,.92],[.13,.92],[.13,.83],[.2,.73],[.29,.48],[.26,.23],[.1,.09],[0,.09]].map(([r,h])=>new B.Vector3(r*s,h*s,0)),mesh=B.MeshBuilder.CreateLathe(`house-${name}-${serial++}`,{shape,tessellation:14,sideOrientation:B.Mesh.DOUBLESIDE},scene);mesh.position.set(x,y,z);add(mesh,m.terracotta,name);if(green){block('pot-soil',x,y+s*.78,z,.22*s,.025,.22*s,m.soil);for(let i=0;i<5;i++){const leaf=B.MeshBuilder.CreateSphere('house-pot-leaf',{diameter:1,segments:5},scene),a=i*Math.PI*2/5;leaf.scaling.set(.07,.25,.1);leaf.position.set(x+Math.cos(a)*.09,y+s*.85+.13,z+Math.sin(a)*.09);leaf.rotation.z=Math.cos(a)*.6;leaf.rotation.x=Math.sin(a)*.6;add(leaf,m.grass,'container-green');}}};
 const room=(name,x,z,w,d,h,base=0)=>{
  const t=.22,door=.72,side=(w-door)/2;block(name,x,base+h/2,z-d/2,w,h,t);for(const s of [-1,1]){block(name,x+s*(w-t)/2,base+h/2,z,t,h,d);block(name,x+s*(door+side)/2,base+h/2,z+d/2,side,h,t);}block(name,x,base+h-.18,z+d/2,door,.36,t);block('door-recess',x,base+.72,z+d/2-.14,door,1.44,.03,m.shade);block('timber-lintel',x,base+h-.36,z+d/2+.04,door+.2,.1,.3,m.wood);block('earth-roof',x,base+h+.05,z,w+.12,.15,d+.12,m.soil);for(const s of [-1,1])block('roof-parapet',x+s*w/2,base+h+.22,z,.16,.3,d+.14);block('roof-parapet',x,base+h+.22,z-d/2,w,.3,.16);
 };
 block('court-ground',0,.035,0,5.1,.07,5.1,m.soil);
 if(kind==='hut'){
  const profile=[[0,1.58],[.18,1.61],[.38,1.6],[.58,1.57],[.78,1.53],[.98,1.48],[1.18,1.41],[1.38,1.33],[1.58,1.24],[1.78,1.13],[1.98,1.01],[2.18,.87],[2.36,.71],[2.52,.54],[2.66,.37],[2.77,.2],[2.83,.08],[2.85,0]],p=[],indices=[],uv=[],segments=64;
  for(const [y,r]of profile)for(let k=0;k<=segments;k++){const a=k/segments*Math.PI*2,ripple=1+.012*Math.cos(a*3)*Math.sin(y*1.7);p.push(Math.sin(a)*r*ripple,y,Math.cos(a)*r*ripple-.35);uv.push(k/segments*4,y/2);}
  for(let j=0;j<profile.length-1;j++)for(let k=0;k<segments;k++){const a=(k+.5)/segments*Math.PI*2,angle=Math.min(a,Math.PI*2-a),height=(profile[j][0]+profile[j+1][0])/2,opening=height<.8?.29:height<1?.24:height<1.2?.17:height<1.38?.07:0;if(angle<opening)continue;const q=j*(segments+1)+k;indices.push(q,q+segments+1,q+1,q+1,q+segments+1,q+segments+2);}
  const normals=[];B.VertexData.ComputeNormals(p,indices,normals);const data=new B.VertexData();Object.assign(data,{positions:p,indices,normals,uvs:uv});const shell=new B.Mesh('house-beehive-shell',scene);data.applyToMesh(shell);add(shell,m.plaster,'beehive-shell');shell.metadata.openDoor=true;
  // A recessed dark arch remains visible through the real gap in the shell.
  const shape=[new B.Vector3(-.43,.08,0),new B.Vector3(.43,.08,0),new B.Vector3(.43,.82,0),new B.Vector3(.32,1.1,0),new B.Vector3(0,1.32,0),new B.Vector3(-.32,1.1,0),new B.Vector3(-.43,.82,0)];
  // Solid dark inset (fan), behind the cut shell rather than a black surface pasted on it.
  const dp=[0,.6,1.03],di=[];for(const v of shape)dp.push(v.x,v.y,1.03);for(let i=0;i<shape.length;i++)di.push(0,1+i,1+(i+1)%shape.length);const dn=[];B.VertexData.ComputeNormals(dp,di,dn);const dd=new B.VertexData();Object.assign(dd,{positions:dp,indices:di,normals:dn,uvs:dp.filter((_,i)=>i%3!==2)});const inset=new B.Mesh('hut-entry-shadow',scene);dd.applyToMesh(inset);add(inset,m.shade,'entry-shadow');
  block('threshold',0,.07,1.21,.9,.14,.55,m.trim);canopy('reed-porch',0,1.76,1.6,1.42,1.52);
  block('small-vent',0,2.13,.54,.19,.12,.035,m.shade);jar('water-jar',1.05,1.63,.63);jar('door-planter',-1.03,1.7,.54,0,true);
 }else if(kind==='courtyard-2'){
  room('court-back-room',.2,-1.55,4.35,1.6,2.05);room('court-west-wing',-1.62,.28,1.45,1.9,1.84);
  block('court-east-wall',2.34,.66,.57,.2,1.32,2.7);block('court-front-wall',-1.43,.58,2.23,1.9,1.16,.2);block('court-front-wall',1.45,.58,2.23,1.9,1.16,.2);
  canopy('court-reed-awning',.9,.28,2.45,1.75,1.9);block('court-bench',1.92,.27,1.48,.46,.54,1.03,m.trim);block('woven-mat',.12,.09,1.35,1.15,.025,.72,m.reed);
  jar('water-jar',-1.94,1.65,.72);jar('small-pot',-1.27,1.75,.43);jar('court-planter',1.91,-.56,.59,0,true);
 }else{
  room('terrace-lower-hall',-.75,-1.48,3.4,1.83,2.28);room('terrace-west-wing',-1.73,.3,1.22,1.77,2.28);room('terrace-upper-room',-1.2,-1.43,2.05,1.7,1.55,2.43);
  block('terrace-deck',.6,-.02+2.43,-1.43,1.5,.16,1.82,m.soil);block('terrace-balustrade',1.35,2.77,-1.49,.17,.62,1.97);block('terrace-balustrade',.62,2.77,-2.4,1.62,.62,.17);
  // Eleven solid risers climb along the east wall and meet the terrace deck.
  for(let i=0;i<11;i++){const h=2.48*(i+1)/11;block('terrace-stair',1.96,h/2,1.42-i*.27,.75,h,.285,m.plaster);}block('stair-landing',1.73,2.4,-1.51,.82,.16,.74,m.soil);
  canopy('terrace-loggia',.45,-1.39,1.65,1.72,3.91,2.51);
  canopy('courtyard-shade',-.05,.48,2.5,1.48,2.17);
  block('court-front-wall',-1.46,.72,2.23,1.92,1.44,.22);block('court-front-wall',1.25,.72,2.23,1.5,1.44,.22);
  block('court-bench',-1.58,.28,1.49,.55,.56,.95,m.trim);jar('water-jar',.89,-.11,.68);jar('terrace-planter',.38,-1.55,.54,2.51,true);jar('court-planter',-1.8,1.82,.53,0,true);block('courtyard-mat',-.06,.09,1.42,1.05,.025,.65,m.reed);
 }
 const meshes=[];for(const [material,parts]of groups){const names=[...new Set(parts.map(p=>p.metadata.housePart))],openDoor=parts.some(p=>p.metadata.openDoor);for(const p of parts)p.computeWorldMatrix(true);const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.name=`game-house-${kind}-${material.name}`;mesh.material=material;mesh.overrideMaterialSideOrientation=B.Material.CounterClockWiseSideOrientation;mesh.metadata={houseParts:names,openDoor,houseVisual:kind};
  if(variant){const positions=Array.from(mesh.getVerticesData(B.VertexBuffer.PositionKind));for(let i=0;i<positions.length;i+=3){const q=organicHousePoint(positions[i],positions[i+1],positions[i+2],variant);positions[i]=q[0];positions[i+1]=q[1];positions[i+2]=q[2];}mesh.setVerticesData(B.VertexBuffer.PositionKind,positions);const normals=[];B.VertexData.ComputeNormals(positions,mesh.getIndices(),normals);mesh.setVerticesData(B.VertexBuffer.NormalKind,normals);}meshes.push(mesh);
 }return meshes;
}
