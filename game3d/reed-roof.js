// Thin thatch on a shaped frame. The source roof's photographic stem tips are
// cut out at the eaves. No meshes per stalk, and no transparent render pass.
export function createReedRoof(B,scene,name,mat,{x=0,z=0,y=0,width,depth,sag=.055,profile}){
 const half=width/2;
 const levels=profile||[[-half,0],[-half*.55,-sag*.7],[0,-sag],[half*.55,-sag*.7],[half,0]];
 const middle=levels.findIndex(([u])=>u>=0),span=Math.max(.01,levels.at(-1)[0]-levels[0][0]);
 const positions=[],indices=[],uvs=[],normals=[];
 const sections=Math.max(2,Math.min(7,Math.ceil(depth/1.3)));
 const repeat=Math.max(1,Math.round(depth/1.75));
 for(let row=0;row<levels.length;row++){
  const [dx,h]=levels[row],end=row===0||row===levels.length-1;
  const dist=middle<0?Math.abs(dx)/half:row<middle?(levels[middle][0]-dx)/(levels[middle][0]-levels[0][0]):(dx-levels[middle][0])/(levels.at(-1)[0]-levels[middle][0]||1);
  for(let i=0;i<=sections;i++){
   const t=i/sections,irregular=Math.sin(t*16.9+row*.34),lip=end?(Math.min(.09,span*.038)+.024*irregular):0;
   positions.push(dx+(row===0?-lip:lip),h+(end?.021*irregular:0),(t-.5)*depth);
   uvs.push(t*repeat+.021,Math.min(.996,.032+.964*dist));
   if(row>0&&i>0){
    const d=row*(sections+1)+i,c=d-1,b=d-sections-1,a=b-1;
    indices.push(a,c,b,b,c,d);
   }
  }
 }
 B.VertexData.ComputeNormals(positions,indices,normals);
 const mesh=new B.Mesh(name,scene),data=new B.VertexData();
 Object.assign(data,{positions,indices,normals,uvs});data.applyToMesh(mesh);
 mesh.position.set(x,y,z);mesh.material=mat;return mesh;
}
