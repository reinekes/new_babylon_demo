// Free-roaming and pack donkeys clone the same source within a city.
export const DONKEY_MODELS=Object.freeze({
 pasture:{file:'pasture-donkey.glb',stride:.905},
 previous:{file:'ambient-donkey.glb',stride:1.17}
});
const scenes=new WeakMap();

async function loadSource(load){
 let model=DONKEY_MODELS.pasture;
 try{return {asset:await load(model.file),model};}
 catch{model=DONKEY_MODELS.previous;return {asset:await load(model.file),model};}
}

export async function acquireDonkey(scene,load){
 let entry=scenes.get(scene);
 if(!entry){entry={ready:loadSource(load),users:0};scenes.set(scene,entry);}
 entry.users++;
 let source;
 try{source=await entry.ready;}
 catch(error){if(scenes.get(scene)===entry)scenes.delete(scene);throw error;}
 let released=false;
 return {...source,release(){
  if(released)return;
  released=true;
  if(--entry.users===0){scenes.delete(scene);source.asset.dispose();}
 }};
}

// Metres in the donkey's bind pose. The pad and the panniers move with its back.
export function createDonkeyPack(B,scene,root,index,materials,register){
 const pack=new B.TransformNode(`donkey-${index}-pack`,scene);
 pack.parent=root;
 const nodes=root.getDescendants(),bone=name=>nodes.find(n=>n.name.endsWith(name));
 const spine=bone('Spine_01_05'),withers=bone('Spine_02_06'),hipL=bone('L_Hip_027'),hipR=bone('R_Hip_036');
 function back(){
  const inverse=root.computeWorldMatrix(true).clone().invert();
  function local(node){node.computeWorldMatrix(true);return B.Vector3.TransformCoordinates(node.getAbsolutePosition(),inverse);}
  const center=local(spine),axis=local(withers).subtract(center),across=local(hipR).subtract(local(hipL));
  return {center,pitch:Math.atan(axis.y/axis.z),roll:Math.atan(across.y/across.x)};
 }
 const rest=back();
 function mount(mesh,material){mesh.parent=pack;mesh.material=material;register(mesh);return mesh;}
 const crossSection=[[-.245,.748],[-.216,.821],[-.166,.882],[-.096,.948],[0,.978],[.096,.948],[.166,.882],[.216,.821],[.245,.748]];
 const height=(x,z)=>Math.abs(z+.16)*.125*(1-Math.abs(x)*2.5);
 const pathArray=[-.39,-.32,-.18,-.04,.075].map(z=>
  crossSection.map(([x,y])=>new B.Vector3(x,y+height(x,z),z)));
 mount(B.MeshBuilder.CreateRibbon(`donkey-${index}-woven-saddle`,{pathArray,sideOrientation:B.Mesh.DOUBLESIDE},scene),materials.wool);
 // Rings narrow towards the seam and turn inward around an open, gathered mouth.
 const bagRings=[[.62,.022,.048],[.646,.061,.143],[.703,.096,.2],[.817,.102,.217],[.877,.088,.195],[.907,.073,.172],[.913,.068,.166],[.893,.061,.156],[.788,.056,.144]];
 for(const side of [-1,1]){
  const rings=bagRings.map(([y,w,d])=>Array.from({length:24},(_,i)=>{
   const angle=i*Math.PI/12,c=Math.cos(angle),s=Math.sin(angle);
   const pleat=1+(.014+.04*Math.max(0,(y-.75)/.17))*Math.sin(7*angle+.4);
   return new B.Vector3(side*(.266+(y-.78)*.09+w*Math.sign(c)*Math.abs(c)**.77*pleat),
    y+.004*Math.sin(3*angle),-.158+d*Math.sign(s)*Math.abs(s)**.72*pleat);
  }));
  mount(B.MeshBuilder.CreateRibbon(`donkey-${index}-cloth-pannier`,{pathArray:rings,closePath:true,sideOrientation:B.Mesh.DOUBLESIDE},scene),materials.linen);
 }
 for(const z of [-.293,-.025]){
  const sections=[[-.325,.69],[-.367,.78],[-.34,.875],[-.285,.922],[-.19,.91],[-.095,.954],[0,.984],[.095,.954],[.19,.91],[.285,.922],[.34,.875],[.367,.78],[.325,.69]];
  const path=sections.map(([x,y])=>new B.Vector3(x,y+height(x,z),z));
  mount(B.MeshBuilder.CreateTube(`donkey-${index}-pannier-rope`,{path,radius:.007,tessellation:6},scene),materials.rope);
 }
 return {root:pack,update(){
  const p=back();pack.position.copyFrom(p.center.subtract(rest.center));
  pack.rotation.set(rest.pitch-p.pitch,0,p.roll-rest.roll);
 }};
}
