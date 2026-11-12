// Original sculptures based on textual motifs and Early Dynastic composite figures.
export function createMythSculpture(B,scene,species){
 const material=(name,color,metallic)=>{
  const m=new B.PBRMaterial(name,scene);
  m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  m.metallic=metallic;
  m.roughness=.67;
  return m;
 };
 const stone=material('Brown-black chlorite','#5f6559',.12);
 const rim=material('Worn bronze','#ad885b',.45);
 const shadow=material('Incised detail','#3b3a2f',.13);
 const oval=(name,x,y,z,w,h,d,surface=stone)=>{
  const m=B.MeshBuilder.CreateSphere(name,{diameter:1,segments:18},scene);
  m.position.set(x,y,z);
  m.scaling.set(w,h,d);
  m.material=surface;
  return m;
 };
 const line=(name,coords,radius,end=radius,surface=stone)=>{
  const m=B.MeshBuilder.CreateTube(name,{path:coords.map(p=>new B.Vector3(...p)),
   tessellation:12,cap:B.Mesh.CAP_ALL,radiusFunction:i=>radius+(end-radius)*i/(coords.length-1)},scene);
  m.material=surface;
  return m;
 };
 const base=B.MeshBuilder.CreateCylinder('Display plinth',{height:.20,diameter:3.65,tessellation:48},scene);
 base.scaling.z=.73;
 base.position.y=-.10;
 base.material=shadow;
 const lip=B.MeshBuilder.CreateCylinder('Inlaid display rim',{height:.038,diameter:3.68,tessellation:48},scene);
 lip.scaling.z=.73;
 lip.position.y=-.033;
 lip.material=rim;
 if(species==='seven-headed-serpent'){
  const coil=Array.from({length:85},(_,i)=>{
   const t=i/84,a=t*Math.PI*4.7,r=.94-.82*t;
   return [Math.cos(a)*r,.115+t*.36,Math.sin(a)*r*.81];
  });
  line('Coiled serpent body',coil,.065,.19);
  for(let i=-3;i<=3;i++){
   const x=i*.43,y=1.16+(3-Math.abs(i))*.14,z=.28+Math.abs(i)*.092;
   line('Serpent neck',[[0,.44,0],[i*.16,.66,-.13],[x*.78,y-.28,z-.13],[x,y,z]],.11,.068);
   oval('Serpent head',x,y,z+.073,.184,.116,.30);
   oval('Lower jaw',x,y-.047,z+.137,.139,.049,.166,shadow);
   for(const side of [-1,1])oval('Inlaid serpent eye',x+side*.067,y+.022,z+.128,.035,.028,.032,rim);
  }
  return;
 }
 const bull=species==='human-headed-bull';
 oval('Animal torso',0,.83,-.12,bull?.77:.66,.69,1.89);
 oval('Chest',0,.86,.40,bull?.72:.57,.73,.72);
 for(const side of [-1,1])for(const end of [-1,1]){
  const x=side*.244,z=end*.57-.12;
  line('Weight-bearing leg',[[x,.77,z],[x,.45,z-.065*end],[x,.31,z],[x,.13,z]],.124,.070);
  oval('Hoof',x,.086,z+.044,.173,.172,.24,shadow);
 }
 line('Tail',[[0,1,-1],[.105,.73,-1.11],[.16,.39,-1.05]],.052,.031);
 if(bull){
  oval('Upright human neck',0,1.10,.52,.46,.77,.56);
  oval('Bearded human head',0,1.58,.60,.43,.55,.43);
  oval('Nose',0,1.57,.815,.10,.13,.126);
  oval('Beard',0,1.35,.76,.35,.31,.20,shadow);
  for(const side of [-1,1]){
   oval('Ear',side*.21,1.58,.61,.105,.14,.088);
   oval('Inlaid eye',side*.103,1.63,.78,.095,.046,.051,rim);
   line('Bull horn',[[side*.16,1.71,.55],[side*.31,1.82,.51],[side*.43,1.95,.60]],.073,.010,rim);
   for(let i=0;i<3;i++)oval('Beard lock',side*(.03+i*.052),1.34,.847,.065,.226-i*.024,.036);
  }
  return;
 }
 for(const side of [-1,1])for(let i=0;i<3;i++){
  const x=side*(.31+i*.09),y=1.34+(i%2)*.24,z=.59-i*.41;
  line('Ram neck',[[0,1.04,z-.08],[x*.55,y-.24,z],[x,y-.025,z]],.146,.085);
  oval('Ram head',x,y,z+.102,.24,.29,.44);
  oval('Ram nose',x,y-.084,z+.266,.16,.127,.18,rim);
  for(const hs of [-1,1]){
   const curl=Array.from({length:22},(_,j)=>{
    const t=j/21,a=.62+t*Math.PI*1.62,r=.156*(1-.58*t);
    return [x+hs*(.097+t*.045),y+.038+Math.sin(a)*r,z+Math.cos(a)*r];
   });
   line('Curled ram horn',curl,.053,.012,rim);
   oval('Ram eye',x+hs*.099,y+.045,z+.181,.035,.030,.033,shadow);
  }
 }
}
