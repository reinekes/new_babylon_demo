export function createWatchHouseFire(B,scene){
 const houses=new Map();
 let materials;
 function fireMaterial(name,color,alpha=1){
  const material=new B.StandardMaterial(name,scene);
  material.emissiveColor=B.Color3.FromHexString(color);
  material.disableLighting=true;
  material.backFaceCulling=false;
  material.alpha=alpha;
  return material;
 }
 function flame(name,parent,material,size,lean){
  const positions=[],indices=[],sides=9;
  const profile=[[0,.055],[.06,.088],[.13,.073],[.23,.037],[.34,.002]];
  for(const [height,radius] of profile)for(let i=0;i<sides;i++){
   const angle=i*Math.PI*2/sides;
   positions.push(size*(Math.cos(angle)*radius+lean*height*height),size*height,size*Math.sin(angle)*radius);
  }
  for(let j=0;j<profile.length-1;j++)for(let i=0;i<sides;i++){
   const a=j*sides+i,b=j*sides+(i+1)%sides;
   indices.push(a,a+sides,b,b,a+sides,b+sides);
  }
  const mesh=new B.Mesh(name,scene),data=new B.VertexData();
  data.positions=positions;data.indices=indices;data.applyToMesh(mesh);
  mesh.material=material;mesh.parent=parent;mesh.isPickable=false;
  return mesh;
 }
 function add(key,parent,meshes){
  const wicks=meshes.filter(mesh=>mesh.name.includes('watch-wick-')||mesh.name.includes('gate-wick-'));
  if(!wicks.length)return;
  materials??=[
   fireMaterial('watch-flame-amber','#ff7816',.83),
   fireMaterial('watch-flame-core','#ffdf8a'),
   fireMaterial('watch-flame-tip','#ffac31',.68)
  ];
  const inverse=parent.computeWorldMatrix(true).clone().invert();
  const torches=wicks.map((wick,index)=>{
   const box=wick.getBoundingInfo().boundingBox;
   const centre=box.centerWorld.clone();
   centre.y=box.maximumWorld.y-.018;
   const anchor=new B.TransformNode(`watch-fire-${key}-${index}`,scene);
   anchor.parent=parent;
   anchor.position=B.Vector3.TransformCoordinates(centre,inverse);
   const outer=flame('watch-flame-outer',anchor,materials[0],1,.46);
   const core=flame('watch-flame-core',anchor,materials[1],.69,.22);
   const tongue=flame('watch-flame-tongue',anchor,materials[2],.60,-.46);
   tongue.position.set(.035,.09,0);
   const light=new B.PointLight(`watch-fire-light-${key}-${index}`,new B.Vector3(0,.17,.08),scene);
   light.parent=anchor;
   light.diffuse=B.Color3.FromHexString('#ffad55');
   light.intensity=0;light.range=2.8;
   light.includedOnlyMeshes=meshes;
   light.setEnabled(false);
   return {anchor,outer,core,tongue,light,phase:index*2.31+centre.x*.33+centre.z*.29};
  });
  houses.set(key,torches);
 }
 function update(night,seconds=0,camera=null){
  if(!houses.size)return;
  const limit=night>.12?4:0;
  const lit=[];
  for(const torches of houses.values())for(const torch of torches){
   const {anchor,phase,outer,core,tongue,light}=torch;
   anchor.setEnabled(night>.07);
   if(night>.07){
    const t=seconds+phase,f=.96+.13*Math.sin(t*18)+.07*Math.sin(t*29);
    outer.scaling.set(1+.12*Math.sin(t*16),f,1+.08*Math.sin(t*23));
    outer.rotation.z=.16*Math.sin(t*11);core.scaling.y=.90+.12*Math.sin(t*21);
    tongue.rotation.z=.34*Math.sin(t*15);tongue.scaling.y=f;
    light.intensity=(.62+.38*night)*f;
    const distance=camera?B.Vector3.DistanceSquared(camera,anchor.getAbsolutePosition()):0;
    if(limit&&distance<48**2)lit.push({light,distance});
   }
  }
  const active=new Set(lit.sort((a,b)=>a.distance-b.distance).slice(0,limit).map(v=>v.light));
  for(const torches of houses.values())for(const {light} of torches){
   const enabled=active.has(light);
   if(light.isEnabled(false)!==enabled)light.setEnabled(enabled);
  }
 }
 function remove(key){
  for(const {anchor,light} of houses.get(key)||[]){light.dispose();anchor.dispose();}
  houses.delete(key);
 }
 return {add,update,remove,dispose(){for(const key of houses.keys())remove(key);for(const material of materials||[])material.dispose();}};
}
