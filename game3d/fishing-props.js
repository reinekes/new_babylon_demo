// One coloured mesh per prop. The same fish silhouette hangs from a cord,
// turns at the river surface and sits inside a porter's reed basket.
function meshData(B,scene,name,positions,indices,colors,material){
 const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
 const mesh=new B.Mesh(name,scene),data=new B.VertexData();
 Object.assign(data,{positions,indices,normals,colors});data.applyToMesh(mesh);
 mesh.material=material;mesh.isPickable=false;return mesh;
}

export function fishMesh(B,scene,name,material){
 const pos=[],idx=[],colors=[];
 const vertex=(x,y,z,r,g,b)=>{pos.push(x,y,z);colors.push(r,g,b,1);return pos.length/3-1;};
 // Head points along +X. The dark dorsal band breaks at a silver lateral line.
 const rings=[[-.21,.022,.019],[-.14,.067,.041],[-.05,.105,.061],[.065,.112,.061],[.145,.085,.044],[.217,.035,.029],[.237,.015,.014]],sides=10;
 for(const [x,h,w] of rings)for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides,v=Math.cos(a),z=Math.sin(a);
  const tint=v>.43?[.46,.55,.48]:v>-.34?[.96,.94,.78]:[.73,.70,.54];
  vertex(x,h*v,w*z,...tint);
 }
 for(let j=1;j<rings.length;j++)for(let i=0;i<sides;i++){const a=(j-1)*sides+i,b=(j-1)*sides+(i+1)%sides;idx.push(a,a+sides,b,b,a+sides,b+sides);}
 function fin(points,tint){const first=pos.length/3;for(const p of points)vertex(...p,...tint);for(let i=2;i<points.length;i++){idx.push(first,first+i-1,first+i,first,first+i,first+i-1);}}
 fin([[-.18,.017,0],[-.33,.107,0],[-.293,.013,0],[-.335,-.094,0],[-.18,-.018,0]],[.52,.55,.42]);
 fin([[.055,.091,0],[-.048,.158,0],[-.118,.074,0]],[.47,.51,.40]);
 for(const side of [-1,1]){
  fin([[.08,-.018,.060*side],[-.006,-.078,.079*side],[.013,-.015,.058*side]],[.60,.62,.46]);
  const z=side*.040;fin([[.124,.021,z],[.14,.040,z],[.159,.022,z],[.14,.006,z]],[.07,.09,.068]);
 }
 return meshData(B,scene,name,pos,idx,colors,material);
}

export function catchBasket(B,scene,material){
 const positions=[],indices=[],colors=[],sides=64,rows=17;
 for(let row=0;row<=rows;row++){
  const v=row/rows,radius=.225+.148*Math.sin(v*1.65),h=.025+v*.39;
  for(let i=0;i<sides;i++){
   const a=i*2*Math.PI/sides,over=(row+i)%2,lip=row>=rows-1;
   const r=radius+(lip?.014:over?.007:-.004);
   positions.push(Math.cos(a)*r,h,Math.sin(a)*r*.78);
   const shade=lip?.85:over?.91:.60;colors.push(shade,shade*.90,shade*.69,1);
  }
 }
 for(let j=1;j<=rows;j++)for(let i=0;i<sides;i++){const a=(j-1)*sides+i,b=(j-1)*sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
 // Turn the weave inside the rim, past the hollow mouth to the flat basket floor.
 for(const [r,h] of [[.348,.405],[.21,.05],[.008,.048]]){
  const row=positions.length/3;
  for(let i=0;i<sides;i++){const a=i*2*Math.PI/sides;positions.push(r*Math.cos(a),h,r*.78*Math.sin(a));colors.push(.47,.39,.27,1);}
  for(let i=0;i<sides;i++){const a=row-sides+i,b=row-sides+(i+1)%sides;indices.push(a,b,a+sides,b,b+sides,a+sides);}
 }
 // Raised stakes catch the grazing light. The lashed arch is set to the
 // back half of the mouth, leaving space to lower a fish into the opening.
 const cord=(points,r,shade)=>{
  const start=positions.length/3,segments=6;
  for(let j=0;j<points.length;j++){
   const path=points[Math.min(j+1,points.length-1)].subtract(points[Math.max(j-1,0)]).normalize();
   const normal=B.Vector3.Cross(path,Math.abs(path.y)>.92?B.Axis.X:B.Axis.Y).normalize(),side=B.Vector3.Cross(path,normal).normalize();
   for(let k=0;k<segments;k++){
    const angle=k*Math.PI*2/segments,offset=normal.scale(Math.cos(angle)*r).add(side.scale(Math.sin(angle)*r));
    const p=points[j].add(offset);positions.push(p.x,p.y,p.z);colors.push(shade,shade*.92,shade*.79,1);
   }
  }
  for(let j=1;j<points.length;j++)for(let k=0;k<segments;k++){const a=start+(j-1)*segments+k,b=start+(j-1)*segments+(k+1)%segments;indices.push(a,a+segments,b,b,a+segments,b+segments);}
 };
 for(let i=0;i<18;i++){
  const angle=i*Math.PI/9,points=[];
  for(let j=0;j<=8;j++){
   const v=j/8,r=.226+.15*Math.sin(v*1.65)+.007*Math.cos(j*Math.PI);
   points.push(new B.Vector3(r*Math.cos(angle),.025+v*.387,r*.78*Math.sin(angle)));
  }
  cord(points,.009,.90);
 }
 const rim=Array.from({length:49},(_,i)=>new B.Vector3(Math.cos(i*Math.PI/24)*.374,.411,.292*Math.sin(i*Math.PI/24)));
 cord(rim,.021,.98);
 const handle=Array.from({length:23},(_,i)=>{const a=i*Math.PI/22;return new B.Vector3(.357*Math.cos(a),.40+.30*Math.sin(a),.024+.07*Math.sin(a));});
 cord(handle,.024,.90);
 return meshData(B,scene,'catch-basket',positions,indices,colors,material);
}

// Static offsets are in metres. The opening of the V and the synchronous
// turn read from the overview without spray particles or additional lights.
const schoolLayout=[
 [-1.23,1.43,.028,.30,-.050],[-.62,1.16,.04,.61,-.038],[-.17,1.58,.028,1.18,.018],
 [.34,1.23,.016,.50,-.049],[1.10,1.37,.050,.56,-.068],[-1.06,.78,.014,.95,-.004],
 [-.46,.58,.017,1.21,.027],[.05,.91,.005,.38,-.068],[.71,.69,.032,.98,.014],
 [-.70,.26,.030,.45,-.062],[-.16,.13,.010,1.26,.035],[.31,.40,.013,.87,.002],[1.08,.32,.044,.58,-.030]
];
export function schoolPositions(progress,visit){
 // A trailing cluster and two outriders share the turn but keep different
 // spacing, depth and bank angle; only a few flanks break the surface.
 const school=schoolLayout;
 for(let i=0;i<school.length;i++){
  const [across,along,delay,bank,depth]=school[i];
  const local=Math.min(1,Math.max(0,(progress-.066-delay)/.17)),sweep=Math.sin(local*Math.PI);
  const x=across+.70*sweep+.70*(local-.5);
  const z=along+.29*local+.07*Math.sin(i+progress*14);
  const height=-.18+(.16+depth)*Math.sin(Math.min(1,progress/.089)*Math.PI/2)-Math.max(0,progress-.25-delay)*1.65;
  visit(i,x,height,z,.83-local*1.73+Math.sin(i*1.67)*.28,bank*sweep);
 }
}
