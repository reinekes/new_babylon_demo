// Game interpretation of simple bitumen/reed boats represented at Ur, 2400–2200 BC.
// British Museum: https://artsandculture.google.com/asset/bitumen-boat-model/VAEkkmAeHi7ysA
// Size, cargo capacity and construction details are artistic, not a reconstruction.
export function createSumerRiverHull(B,scene,m){
 const parts=[],positions=[],indices=[],sections=24,edge=[],deck=[],deckIndices=[];
 for(let i=0;i<=sections;i++){
  const t=i/sections,u=Math.abs(2*t-1),z=(t-.5)*6.4,w=Math.max(.035,.90*Math.sin(Math.PI*t)**.55),top=.44+.40*u**5,bottom=-.29+.65*u**4;
  const ring=[[-w,top],[-w*.85,Math.max(bottom,-.04)],[0,bottom],[w*.85,Math.max(bottom,-.04)],[w,top]];
  for(const [x,y]of ring)positions.push(x,y,z);
  edge.push({z,w,top});const d=Math.max(.015,w*.88),height=.18+.25*u**6;deck.push(-d,height,z,d,height,z);
  if(i<sections){for(let k=0;k<4;k++){const a=i*5+k,b=a+5;indices.push(a,a+1,b,a+1,b+1,b);}const a=i*2;deckIndices.push(a,a+2,a+1,a+1,a+2,a+3);}
 }
 const geometry=(name,p,i,material,metadata)=>{
  // Babylon's default left-handed front faces: deck up, hull normals out.
  for(let k=0;k<i.length;k+=3)[i[k+1],i[k+2]]=[i[k+2],i[k+1]];
  const mesh=new B.Mesh(name,scene),data=new B.VertexData(),normals=[],uvs=[];B.VertexData.ComputeNormals(p,i,normals);for(let k=0;k<p.length;k+=3)uvs.push(p[k]*2,p[k+2]);Object.assign(data,{positions:p,indices:i,normals,uvs});data.applyToMesh(mesh);mesh.material=material;mesh.metadata=metadata;parts.push(mesh);return mesh;};
 geometry('sumer-river-bitumen-hull',positions,indices,m.bitumen,{sumerHull:true});
 geometry('sumer-river-reed-deck',deck,deckIndices,m.reed,{sumerDeck:true});
 for(const side of [-1,1]){const rim=B.MeshBuilder.CreateTube('sumer-river-reed-gunwale',{path:edge.map(p=>new B.Vector3(side*p.w,p.top,p.z)),radius:.055,tessellation:8},scene);rim.material=m.reed;parts.push(rim);}
 for(const z of [-2.12,2.12]){const seat=B.MeshBuilder.CreateBox('sumer-river-cross-seat',{width:1.18,height:.09,depth:.20},scene);seat.position.set(0,.28,z);seat.material=m.wood;parts.push(seat);}
 const from=new B.Vector3(.54,.52,-2.22),to=new B.Vector3(.98,-.06,-4.3),delta=to.subtract(from),pole=B.MeshBuilder.CreateCylinder('sumer-river-punt-pole',{height:delta.length(),diameter:.045,tessellation:8},scene);pole.position=from.add(to).scale(.5);pole.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),new B.Quaternion());pole.material=m.wood;parts.push(pole);
 return parts;
}
