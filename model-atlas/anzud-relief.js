// Original game relief inspired by the lion-headed bird on Enmetena's vessel.
export function createAnzudRelief(B,scene){
 const material=(name,color,metallic,roughness)=>{
  const surface=new B.PBRMaterial(name,scene);
  surface.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  surface.metallic=metallic;
  surface.roughness=roughness;
  return surface;
 };
 const plaque=material('Patinated bronze','#624b31',.32,.68);
 const border=material('Bronze rim','#98734b',.43,.62);
 const relief=material('Warm silver','#baaf92',.42,.58);
 const raised=material('Polished silver','#d5c6a7',.48,.51);
 const dark=material('Incised recess','#44382a',.12,.79);
 const box=(name,width,height,depth,z,surface)=>{
  const mesh=B.MeshBuilder.CreateBox(name,{width,height,depth},scene);
  mesh.position.z=z;
  mesh.material=surface;
  return mesh;
 };
 const oval=(name,x,y,z,width,height,depth,surface,angle=0)=>{
  const mesh=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:16},scene);
  mesh.position.set(x,y,z);
  mesh.scaling.set(width,height,depth);
  mesh.rotation.z=angle;
  mesh.material=surface;
  return mesh;
 };
 const stroke=(name,x1,y1,x2,y2,width,depth,surface,z=.19)=>{
  const dx=x2-x1,dy=y2-y1;
  return oval(name,(x1+x2)/2,(y1+y2)/2,z,width,Math.hypot(dx,dy)+width,depth,surface,-Math.atan2(dx,dy));
 };

 box('Cast bronze plaque',4.35,2.78,.22,0,plaque);
 box('Raised rim',4.22,2.65,.07,.105,border);
 box('Inset field',4.08,2.51,.06,.13,plaque);
 for(const side of [-1,1]){
  stroke('Wing cover',side*.22,.47,side*1.83,.62,.34,.13,relief);
  for(let i=0;i<10;i++){
   const x=.37+i*.15;
   stroke('Flight feather',side*x,.49+i*.012,side*(x+.17),-.1+i*.04,.123,.12,i%3===0?raised:relief);
   stroke('Feather shaft',side*x,.4+i*.012,side*(x+.135),-.058+i*.04,.014,.027,dark,.249);
  }
  for(let i=0;i<7;i++){
   const x=.41+i*.204;
   oval('Wing covert',side*x,.59+i*.014,.229,.205,.142,.092,raised,-side*.32);
  }
  stroke('Eagle leg',side*.19,-.35,side*.69,-.84,.13,.13,relief);
  for(let i=0;i<3;i++){
   const x=.64+i*.12;
   stroke('Taloned toe',side*.67,-.81,side*x,-.95,.062,.085,raised,.204);
   stroke('Taloned tip',side*x,-.94,side*(x+.035),-1.06,.043,.063,relief,.209);
  }
  for(const y of [-1.13,1.13])for(let i=0;i<9;i++){
   oval('Punched border',side*(.12+i*.22),y,.168,.061,.061,.025,border);
  }
 }
 for(let i=-2;i<=2;i++){
  stroke('Tail feather',i*.053,-.36,i*.13,-.97,.117,.12,relief);
 }
 oval('Eagle breast',0,.03,.194,.59,.98,.19,relief);
 for(let i=-2;i<=2;i++){
  oval('Breast plumage',i*.096,-.21+Math.abs(i)*.02,.277,.108,.25,.055,raised,-i*.12);
 }
 oval('Lion mane',0,.555,.22,.7,.68,.17,dark);
 for(let i=0;i<13;i++){
  const a=i*Math.PI*2/13;
  oval('Mane lock',Math.cos(a)*.265,.565+Math.sin(a)*.253,.258,.14,.224,.13,relief,a-Math.PI/2);
 }
 oval('Lion face',0,.583,.287,.45,.42,.2,relief);
 for(const side of [-1,1]){
  oval('Rounded lion ear',side*.212,.798,.298,.139,.144,.13,raised);
  oval('Lion inner ear',side*.215,.809,.358,.066,.071,.035,dark);
  oval('Lion brow',side*.105,.654,.371,.156,.083,.076,raised,side*.12);
  oval('Lion eye',side*.104,.631,.409,.06,.045,.025,dark);
  oval('Lion muzzle pad',side*.075,.511,.397,.183,.118,.114,raised);
 }
 oval('Lion chin',0,.444,.356,.18,.087,.084,relief);
 oval('Lion nose',0,.559,.452,.118,.072,.064,dark);
 stroke('Mouth line',-.073,.47,.073,.47,.02,.027,dark,.42);
}
