// Visual crop identities only: no fields are written to saves and all harvests
// continue to use the existing barley simulation. Most fields retain barley.
export const CROP_NAMES={barley:'Ячмень',emmer:'Эммер / двузернянка',flax:'Лён',lentil:'Чечевица',pea:'Горох',chickpea:'Нут',onion:'Лук'};
export function cropSeed(b){let h=0;for(const c of String(b.id??`${b.x},${b.y}`))h=(Math.imul(h,31)+c.charCodeAt(0))>>>0;return h;}
export function fieldCropKind(b){return ['emmer','flax','lentil','pea','chickpea','onion'][cropSeed(b)%14]||'barley';}
const olive=[.30,.40,.15,1],leafGreen=[.37,.47,.20,1],greyGreen=[.43,.49,.28,1],podGreen=[.48,.53,.26,1];
const empty=()=>({positions:[],indices:[],colors:[]});
function vertex(g,p,color){const i=g.positions.length/3;g.positions.push(...p);g.colors.push(...color);return i;}
function tri(g,a,b,c,color){g.indices.push(vertex(g,a,color),vertex(g,b,color),vertex(g,c,color));}
function tube(g,points,radii,color,sides=5){
 const start=g.positions.length/3;
 for(let k=0;k<points.length;k++)for(let i=0;i<sides;i++){const a=i*Math.PI*2/sides;vertex(g,[points[k][0]+Math.cos(a)*radii[k],points[k][1],points[k][2]+Math.sin(a)*radii[k]],color);}
 for(let k=0;k<points.length-1;k++)for(let i=0;i<sides;i++){const a=start+k*sides+i,b=start+k*sides+(i+1)%sides,c=a+sides,d=b+sides;g.indices.push(a,b,c,b,d,c);}
}
function leaf(g,x,y,z,angle,length,width,color=leafGreen){
 const c=Math.cos(angle),s=Math.sin(angle),p=(u,v,w)=>[x+c*u-s*w,y+v,z+s*u+c*w];
 const a=p(0,0,0),b=p(length*.46,.035,width),d=p(length*.46,.035,-width),tip=p(length,.07,0),ridge=p(length*.46,.07,0);
 tri(g,a,b,ridge,color);tri(g,b,tip,ridge,color);tri(g,tip,d,ridge,color);tri(g,d,a,ridge,color);
}
function ellipsoid(g,x,y,z,rx,ry,rz,color,sides=6,rings=3){
 const start=g.positions.length/3;
 for(let r=0;r<=rings;r++)for(let k=0;k<sides;k++){const t=r*Math.PI/rings,a=k*Math.PI*2/sides;vertex(g,[x+rx*Math.sin(t)*Math.cos(a),y+ry*Math.cos(t),z+rz*Math.sin(t)*Math.sin(a)],color);}
 for(let r=0;r<rings;r++)for(let k=0;k<sides;k++){const a=start+r*sides+k,b=start+r*sides+(k+1)%sides;g.indices.push(a,a+sides,b,b,a+sides,b+sides);}
}
export function cropPlantGeometry(kind){
 const g=empty();
 if(kind==='onion'){
  ellipsoid(g,0,.025,0,.065,.06,.065,[.73,.64,.40,1],6,3);
  // Open tubular, blue-green leaves: bent tapers, not broad cereal ribbons.
  for(let i=0;i<6;i++){const a=i*2.4,c=Math.cos(a),s=Math.sin(a),h=.42+(i%3)*.075;tube(g,[[0,.04,0],[c*.035,h*.46,s*.035],[c*.11,h*.86,s*.11],[c*.17,h,s*.17]],[.022,.018,.012,.001],[.29,.43,.29,1],4);}
  return g;
 }
 if(kind==='flax'){
  for(let j=0;j<3;j++){
   const a=j*2.1,x=Math.cos(a)*.065,z=Math.sin(a)*.065,h=.76+j*.07;
   tube(g,[[x,0,z],[x*.7,h,z*.7]],[.009,.005],olive,4);
   for(let i=0;i<4;i++)leaf(g,x,h*(.22+i*.13),z,a+i*2.4,.13,.014,olive);
   const center=[x*.7,h,z*.7];
   for(let p=0;p<5;p++){const angle=p*Math.PI*2/5,c=Math.cos(angle),s=Math.sin(angle),tip=[center[0]+c*.065,h+.015,center[2]+s*.065];tri(g,center,[tip[0]-s*.027,tip[1],tip[2]+c*.027],[tip[0]+s*.027,tip[1],tip[2]-c*.027],[.38,.53,.68,1]);}
   ellipsoid(g,center[0],h+.006,center[2],.014,.012,.014,[.73,.64,.30,1],5,2);
  }
  return g;
 }
 const isPea=kind==='pea',isChickpea=kind==='chickpea',h=isPea?.72:isChickpea?.51:.39;
 for(let j=0;j<2;j++){
  const a=j*3.0+.3,x=Math.cos(a)*.055,z=Math.sin(a)*.055;
  tube(g,[[x,0,z],[x*.5,h,z*.5]],[.012,.004],olive,4);
  const count=isChickpea?5:4;
  for(let i=0;i<count;i++){
   const y=.12+i*(h-.16)/count,angle=a+i*1.5,length=isPea?.23:isChickpea?.16:.13,width=isPea?.065:isChickpea?.035:.035;
   for(const side of [-1,1])leaf(g,x,y,z,angle+side*.8,length,width,isChickpea?greyGreen:leafGreen);
  }
  if(isPea){
   // Curl at the top and an elongated pod with visible seed bulges.
   tube(g,[[x,h*.9,z],[x+.07,h+.04,z],[x+.10,h+.07,z+.035],[x+.07,h+.08,z+.06]],[.005,.004,.003,.001],olive,3);
   ellipsoid(g,x+.11,h*.60,z,.035,.13,.038,podGreen,6,3);
  }else if(isChickpea)ellipsoid(g,x+.10,h*.55,z,.063,.077,.048,[.60,.58,.31,1],6,3);
  else{ellipsoid(g,x+.08,h*.55,z,.045,.025,.033,podGreen,6,2);ellipsoid(g,x-.08,h*.75,z,.038,.024,.03,podGreen,6,2);}
 }
 return g;
}
export function dateClusterGeometry({height=5.2,radius=.55,seed=0}={}){
 const g=empty();
 for(let bunch=0;bunch<5;bunch++){
  const a=bunch*Math.PI*2/5+seed*.37,x=Math.cos(a)*radius,z=Math.sin(a)*radius;
  tube(g,[[x*.45,height,z*.45],[x,height-.30,z],[x,height-.52,z]],[.018,.013,.008],[.48,.34,.12,1],4);
  for(let i=0;i<14;i++){const angle=i*2.4,r=.05+(i%3)*.037,y=height-.30-Math.floor(i/3)*.065;
   ellipsoid(g,x+Math.cos(angle)*r,y,z+Math.sin(angle)*r,.032,.052,.027,i%3?[.52,.28,.10,1]:[.65,.39,.13,1],5,2);
  }
 }
 return g;
}
// One opaque vertex-coloured mesh per whole layer/field, no animated transforms.
export function createBotanicalMaterial(B,scene,name='crop-botanical'){
 const m=new B.PBRMaterial(name,scene);m.albedoColor=new B.Color3(1,1,1);m.roughness=.92;m.metallic=0;m.backFaceCulling=false;m.twoSidedLighting=true;return m;
}
export function botanicalMesh(B,scene,name,data,material){
 const mesh=new B.Mesh(name,scene),v=new B.VertexData();v.positions=data.positions;v.indices=data.indices;v.colors=data.colors;v.normals=[];B.VertexData.ComputeNormals(v.positions,v.indices,v.normals);v.applyToMesh(mesh);mesh.material=material;mesh.isPickable=false;mesh.useVertexColors=true;return mesh;
}
export function createDateClusters(B,scene,options={},material){return botanicalMesh(B,scene,'game-date-clusters',dateClusterGeometry(options),material||createBotanicalMaterial(B,scene,'date-fruit'));}
