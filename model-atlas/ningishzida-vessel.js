// An original study of the central serpent motif on Gudea's libation vessel.
export function createNingishzidaVessel(B,scene){
 const material=(name,color,roughness)=>{
  const surface=new B.PBRMaterial(name,scene);
  surface.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  surface.roughness=roughness;
  return surface;
 };
 const stone=material('Dark chlorite','#666b59',.77);
 const carving=material('Polished chlorite','#989477',.68);
 const ridge=material('Worn ridges','#a09b78',.72);
 const recess=material('Incised recess','#31362e',.86);
 const v=(x,y,z=0)=>new B.Vector3(x,y,z);
 const profile=[
  [0,.025],[.315,.025],[.34,.047],[.336,.09],[.29,.128],[.286,.2],
  [.324,.62],[.385,1.17],[.442,1.68],[.483,2.12],[.49,2.22],
  [.477,2.243],[.443,2.243],[.435,2.216],[.427,2.12],
  [.391,1.68],[.334,1.17],[.271,.62],[.236,.2],[.215,.16],[0,.16]
 ];
 const vessel=B.MeshBuilder.CreateLathe('Hollow chlorite vessel',{
  shape:profile.map(([radius,height])=>v(radius,height)),tessellation:72,sideOrientation:B.Mesh.DOUBLESIDE
 },scene);
 vessel.material=stone;
 for(const [name,diameter,height] of [['Worn lip',.953,2.235],['Foot band',.651,.061]]){
  const ring=B.MeshBuilder.CreateTorus(name,{diameter,thickness:.014,tessellation:72},scene);
  ring.position.y=height;
  ring.material=carving;
 }
 const oval=(name,point,width,height,depth,surface,angle=0)=>{
  const mesh=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:16},scene);
  mesh.position.copyFrom(point);
  mesh.scaling.set(width,height,depth);
  mesh.rotation.z=angle;
  mesh.material=surface;
  return mesh;
 };
 const tube=(name,path,radiusFunction,surface)=>{
  const mesh=B.MeshBuilder.CreateTube(name,{path,tessellation:14,cap:B.Mesh.CAP_ALL,radiusFunction},scene);
  mesh.material=surface;
  return mesh;
 };
 const shellRadius=y=>.273+.098*y;
 const snakePoint=(side,t)=>{
  const y=.175+1.86*t;
  const phase=t*5*Math.PI;
  const angle=side*Math.sin(phase)*(.41+.17*t);
  const radius=shellRadius(y)+.041+side*Math.cos(phase)*.05;
  return v(radius*Math.sin(angle),y,radius*Math.cos(angle));
 };
 for(const side of [-1,1]){
  const path=Array.from({length:141},(_,i)=>snakePoint(side,i/140));
  tube('Interwoven serpent',path,i=>.016+.027*Math.min(1,i/34),carving);
  for(let i=14;i<134;i+=4){
   const point=path[i].clone();
   point.z+=.041;
   const tangent=path[i+1].subtract(path[i-1]);
   oval('Scale ridge',point,.041,.010,.012,ridge,-Math.atan2(tangent.x,tangent.y)+side*.36);
  }
  const end=path.at(-1);
  tube('Serpent neck',[end,v(side*.073,2.083,.5),v(side*.146,2.118,.474)],()=>.05,carving);
  oval('Serpent head',v(side*.171,2.12,.47),.204,.109,.122,carving,side*.14);
  oval('Jaw line',v(side*.196,2.098,.524),.139,.014,.013,recess,side*.12);
  oval('Eye setting',v(side*.152,2.143,.529),.041,.038,.018,ridge);
  oval('Eye',v(side*.152,2.144,.538),.018,.022,.012,recess);
  oval('Nostril',v(side*.235,2.136,.498),.014,.015,.013,recess);
 }
}
