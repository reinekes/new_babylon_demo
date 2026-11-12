// Game-sized parcels. The sharpened profiles are distinct even at city scale.
const COPPER='#b7754b',EDGE='#d79b69',WOOD='#785030',CORD='#ba9766',REED='#8f7351';

export function createCopperParcel(B,scene,kind){
 const parts=[];
 function add(mesh,hex){
  const color=B.Color3.FromHexString(hex),values=[];
  for(let i=0;i<mesh.getTotalVertices();i++)values.push(color.r,color.g,color.b,1);
  mesh.setVerticesData(B.VertexBuffer.ColorKind,values);
  parts.push(mesh);
  return mesh;
 }
 function cylinder(name,x,y,z,length,radius,hex){
  const mesh=add(B.MeshBuilder.CreateCylinder(name,{height:length,diameter:2*radius,tessellation:8},scene),hex);
  mesh.rotation.z=Math.PI/2;
  mesh.position.set(x,y,z);
  return mesh;
 }
 function blade(name,y,z,sections){
  const positions=[],indices=[],colors=[],normals=[],uvs=[];
  const faces=[[0,1],[1,2],[2,3],[3,0]];
  // Each section is x, two outline coordinates, and half thickness.
  const corners=([x,lo,hi,h])=>[[x,y-h,z+lo],[x,y+h,z+lo],[x,y+h,z+hi],[x,y-h,z+hi]];
  function face(a,b,c,d,hex){
   const i=positions.length/3,color=B.Color3.FromHexString(hex);
   positions.push(...a,...b,...c,...d);
   indices.push(i,i+2,i+1,i,i+3,i+2);
   uvs.push(0,0,1,0,1,1,0,1);
   for(let j=0;j<4;j++)colors.push(color.r,color.g,color.b,1);
  }
  let previous=corners(sections[0]);
  face(previous[3],previous[2],previous[1],previous[0],COPPER);
  for(const section of sections.slice(1)){
   const next=corners(section);
   for(const [a,b] of faces)face(previous[a],previous[b],next[b],next[a],section[3]<.006?EDGE:COPPER);
   previous=next;
  }
  face(...previous,COPPER);
  B.VertexData.ComputeNormals(positions,indices,normals);
  const data=new B.VertexData(),mesh=new B.Mesh(name,scene);
  Object.assign(data,{positions,indices,normals,colors,uvs});
  data.applyToMesh(mesh);
  parts.push(mesh);
  return mesh;
 }
 for(const x of [-.22,.22]){
  const rail=add(B.MeshBuilder.CreateBox('parcel-reed-batten',{width:.06,height:.05,depth:.52},scene),REED);
  rail.position.set(x,.025,0);
 }
 for(const z of [-.18,-.12,-.06,0,.06,.12,.18])cylinder('parcel-reed-stem',0,.069,z,.65,.026,REED);
 if(kind==='axe'){
  cylinder('axe-haft',-.066,.141,.10,.47,.039,WOOD);
  for(const x of [.112,.137,.162])cylinder('axe-binding',x,.141,.10,.014,.046,CORD);
  const head=blade('axe-head',.156,0,[[-.018,-.044,.042,.019],[.062,-.061,.052,.024],
   [.161,-.104,.080,.016],[.205,-.111,.085,.005],[.215,-.085,.065,.002]]);
  head.rotation.y=Math.PI/2;
  head.position.set(.133,0,.101);
 }else if(kind==='blade'){
  for(const z of [-.099,.099]){
   cylinder('knife-grip',-.208,.126,z,.19,.032,WOOD);
   for(const x of [-.151,-.127])cylinder('knife-binding',x,.126,z,.012,.035,CORD);
   blade('knife-edge',.131,z,[[-.13,-.028,.027,.013],[.014,-.043,.039,.014],
    [.177,-.036,.026,.010],[.253,-.004,.012,.003],[.271,.005,.006,.001]]);
  }
 }else if(kind==='chisel'){
  for(const z of [-.087,.087]){
   cylinder('chisel-grip',-.178,.133,z,.24,.035,WOOD);
   cylinder('chisel-binding',-.081,.133,z,.026,.039,CORD);
   blade('chisel-bit',.137,z,[[-.079,-.017,.017,.017],[.174,-.017,.017,.015],
    [.236,-.025,.025,.011],[.277,-.026,.026,.003]]);
  }
 }else{
  for(const z of [-.132,0,.132])blade('copper-cake',.12,z,[
   [-.23,-.026,.026,.028],[-.18,-.045,.045,.047],[.16,-.047,.047,.049],[.22,-.029,.029,.029]
  ]);
  blade('copper-cake-stacked',.195,.025,[
   [-.17,-.021,.024,.019],[-.13,-.043,.044,.038],[.159,-.046,.045,.040],[.211,-.028,.027,.025]
  ]);
 }
 return parts;
}
