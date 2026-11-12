import {closedAnimalLoft} from '../game3d/animal-anatomy.js';

// An original atlas study. Bronze and inlay evoke Early Dynastic lyre fittings.
export function createHeavenlyBull(B,scene){
 const material=(name,color,metallic,roughness)=>{
  const surface=new B.PBRMaterial(name,scene);
  surface.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  surface.metallic=metallic;
  surface.roughness=roughness;
  return surface;
 };
 const bronze=material('Hammered bronze','#a77849',.52,.54);
 const rim=material('Polished bronze','#bd9260',.48,.49);
 const lapis=material('Lapis lazuli','#284b88',.1,.52);
 const shell=material('Shell inlay','#ddd0a9',.07,.45);
 const shadow=material('Recess','#2c211b',.08,.74);
 const stone=material('Dark stone','#494039',0,.85);
 const v=([x,y,z])=>new B.Vector3(x,y,z);
 const place=(mesh,surface,x=0,y=0,z=0)=>{
  mesh.material=surface;
  mesh.position.set(x,y,z);
  return mesh;
 };
 const oval=(name,surface,position,size)=>{
  const mesh=place(B.MeshBuilder.CreateSphere(name,{diameter:1,segments:24},scene),surface,...position);
  mesh.scaling.set(...size);
  return mesh;
 };
 const loft=(name,surface,sections)=>{
  const mesh=new B.Mesh(name,scene),data=new B.VertexData();
  Object.assign(data,closedAnimalLoft(B,sections));
  data.applyToMesh(mesh);
  return place(mesh,surface);
 };
 const curve=(name,surface,coordinates,radius,tip=1)=>{
  const points=coordinates.map(v),path=[];
  for(let i=0;i<points.length-1;i++){
   for(let step=0;step<6;step++)path.push(B.Vector3.CatmullRom(points[Math.max(0,i-1)],points[i],points[i+1],points[Math.min(i+2,points.length-1)],step/6));
  }
  path.push(points.at(-1));
  return place(B.MeshBuilder.CreateTube(name,{path,tessellation:16,cap:B.Mesh.CAP_ALL,
   radiusFunction:i=>radius*(1-(1-tip)*i/(path.length-1))},scene),surface);
 };

 place(B.MeshBuilder.CreateBox('Stone base',{width:2.32,height:.22,depth:1.45},scene),stone,0,.11,0);
 place(B.MeshBuilder.CreateBox('Bronze mounting plate',{width:1.61,height:.09,depth:1.11},scene),rim,0,.252,0);
 oval('Neck',bronze,[0,.68,-.22],[1.12,.86,.91]).rotation.x=-.26;
 loft('Bull head',bronze,[
  [-.43,1.15,.28,.3],[-.30,1.22,.49,.42],[-.12,1.22,.47,.45],[.10,1.14,.405,.43],
  [.29,1.01,.321,.365],[.49,.85,.273,.268],[.69,.71,.299,.19],[.8,.695,.224,.13]
 ]);
 oval('Muzzle',rim,[0,.69,.735],[.57,.287,.252]);
 oval('Lower jaw',bronze,[0,.56,.57],[.446,.215,.435]);
 curve('Mouth seam',shadow,[[-.228,.62,.802],[0,.589,.853],[.228,.62,.802]],.011);
 for(const side of [-1,1]){
  const ear=oval('Ear',bronze,[side*.493,1.277,-.092],[.403,.158,.244]);
  ear.rotation.z=side*.32;
  oval('Ear inset',shadow,[side*.574,1.3,.002],[.176,.064,.086]).rotation.z=side*.34;
  curve('Horn',rim,[[side*.335,1.53,-.20],[side*.53,1.59,-.25],[side*.753,1.71,-.19],
   [side*.916,1.91,-.072],[side*.984,2.12,.084],[side*.961,2.29,.194]],.129,.035);
  oval('Horn base',bronze,[side*.392,1.56,-.206],[.306,.248,.282]).rotation.z=side*.5;
  oval('Brow',bronze,[side*.334,1.274,.253],[.245,.126,.23]).rotation.z=-side*.3;
  oval('Shell eye',shell,[side*.349,1.2,.29],[.167,.091,.118]).rotation.y=side*.49;
  oval('Lapis pupil',lapis,[side*.367,1.199,.331],[.075,.064,.065]);
  oval('Nostril',shadow,[side*.15,.731,.845],[.105,.055,.028]).rotation.z=side*.27;
 }
 for(let row=0;row<3;row++){
  for(let column=-2;column<=2;column++){
   const x=column*.095;
   oval('Forehead inlay',row===1?rim:lapis,[x,1.458-row*.069,.249+row*.028],[.069,.057,.042]);
  }
 }
 curve('Lapis tether',lapis,[[0,.642,.857],[.088,.5,.947],[.31,.374,.83],[.64,.328,.597],[.83,.313,.31],[.924,.302,.11]],.027);
 oval('Tether fitting',rim,[0,.648,.861],[.066,.072,.043]);
}
