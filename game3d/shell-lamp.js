// A shell bowl inspired by the Ur III find from Nippur (Met 51.25.18).
// The oil, wick and the use of the vessel in the procession are reconstructed.
export function createShellLamp(B,scene){
 const shape=[[0,-.016],[.086,-.016],[.112,.006],[.139,.053],[.151,.105],[.144,.130],
  [.131,.132],[.122,.111],[.112,.071],[.083,.047],[0,.047]];
 const bowl=B.MeshBuilder.CreateLathe('shell-lamp-source',{
  shape:shape.map(([r,y])=>new B.Vector3(r,y,0)),tessellation:40
 },scene);
 const points=bowl.getVerticesData(B.VertexBuffer.PositionKind),indices=bowl.getIndices(),normals=[],colors=[];
 const shell=B.Color3.FromHexString('#e2c6a1'),soot=B.Color3.FromHexString('#493025');
 for(let i=0;i<points.length;i+=3){
  const x=points[i],y=points[i+1],z=points[i+2],r=Math.hypot(x,z);
  const nose=r?Math.pow(Math.max(0,x/r),24):0;
  points[i]=x+(.095*nose*Math.min(1,r/.13));
  points[i+2]=z*.87*(1+.045*Math.sin(31*x+8*y));
  points[i+1]=y-.020*nose*Math.max(0,(y-.04)/.092);
  const burnt=nose*Math.max(0,(y-.07)/.062)*.77;
  const shade=1+.025*Math.sin(x*67+y*111)*Math.cos(z*81)-.045*Math.sin(y*230+x*19);
  colors.push((shell.r+(soot.r-shell.r)*burnt)*shade,
   (shell.g+(soot.g-shell.g)*burnt)*shade,
   (shell.b+(soot.b-shell.b)*burnt)*shade,1);
 }
 B.VertexData.ComputeNormals(points,indices,normals);
 bowl.setVerticesData(B.VertexBuffer.PositionKind,points);
 bowl.setVerticesData(B.VertexBuffer.NormalKind,normals);
 bowl.setVerticesData(B.VertexBuffer.ColorKind,colors);
 const oil=B.MeshBuilder.CreateCylinder('lamp-oil',{height:.005,diameter:.19,tessellation:24},scene);
 oil.position.y=.063;
 const wick=B.MeshBuilder.CreateTube('lamp-wick',{path:[
  new B.Vector3(.096,.061,0),new B.Vector3(.15,.078,0),new B.Vector3(.202,.113,0)
 ],radius:.009,tessellation:6,cap:B.Mesh.CAP_ALL},scene);
 for(const [mesh,hex] of [[oil,'#514023'],[wick,'#2c2119']]){
  const color=B.Color3.FromHexString(hex),values=[];
  for(let i=0;i<mesh.getTotalVertices();i++)values.push(color.r,color.g,color.b,1);
  mesh.setVerticesData(B.VertexBuffer.ColorKind,values);
 }
 const lamp=B.Mesh.MergeMeshes([bowl,oil,wick],true,true);
 lamp.name='shell-lamp-source';
 const material=new B.StandardMaterial('shell-lamp-material',scene);
 material.diffuseColor=B.Color3.White();
 material.specularColor=new B.Color3(.18,.15,.10);
 material.specularPower=18;
 lamp.material=material;
 lamp.isPickable=false;
 lamp.isVisible=false;
 return lamp;
}
