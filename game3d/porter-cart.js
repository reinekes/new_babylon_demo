import {freightCartCapacity} from '../freight-carts.js';
import {buildingKey} from '../definitions.js';
import {cartParking} from '../porter-cart-art.js';

const axleZ=1.23, wheelRadius=.40, rail='#80603e', timber='#a77e50', cord='#c1a278';
export const cartGrip={width:.255,height:.84,reach:.28};

function cartGeometry(B,wheel){
 const parts=[],box=()=>B.VertexData.CreateBox({size:1}),cylinder=()=>B.VertexData.CreateCylinder({height:1,diameter:1,tessellation:32});
 function part(shape,color,x,y,z,width,height,depth,rx=0,rz=0){
  shape.transform(B.Matrix.Compose(new B.Vector3(width,height,depth),B.Quaternion.FromEulerAngles(rx,0,rz),new B.Vector3(x,y,z)));
  const {r,g,b}=B.Color3.FromHexString(color).toLinearSpace();
  shape.colors=Array.from({length:shape.positions.length/3},()=>[r,g,b,1]).flat();
  parts.push(shape);
 }
 if(wheel){
  part(cylinder(),'#89633e',0,0,0,wheelRadius*2,.092,wheelRadius*2,0,Math.PI/2);
  for(const side of [-1,1]){
   const face=side*.047;
   // Individual plank faces have slightly different colours and worn longitudinal grain.
   for(let i=0;i<19;i++){
    const y=(i-9)*.039,len=Math.sqrt(wheelRadius**2-y*y)*1.85;
    const tone=y<-.14?'#99744d':y>.14?'#a78257':'#a37a51';
    part(box(),tone,face,y,0,.0015,.039,len);
    const shade=['#977149','#aa8459','#926e48'][i%3];
    part(box(),shade,side*.049,y+.008,.08*Math.sin(i*2.3),.0015,.005,len*(.24+.23*(1+Math.sin(i))));
   }
   part(cylinder(),'#bc9261',side*.065,0,0,.17,.09,.17,0,Math.PI/2);
   // Two timber joints on each face divide the solid wheel into three planks.
   for(const y of [-.14,.14])part(box(),'#795b3c',side*.051,y,0,.003,.010,.738);
   part(box(),'#5f4834',side*.114,0,0,.016,.119,.047,.24);
  }
 }else{
  part(cylinder(),rail,0,wheelRadius,axleZ,.13,1.15,.13,0,Math.PI/2);
  for(const side of [-1,1]){
   const x=side*.34;
   part(box(),rail,x,.51,1.21,.093,.11,1.15);
   for(const z of [.85,1.59]){
    part(box(),rail,side*.384,.70,z,.048,.38,.06);
    part(box(),cord,side*.387,.77,z,.059,.055,.067);
   }
   for(const y of [.688,.817])part(box(),timber,side*.388,y,1.23,.048,.074,1.06);
   const grip=new B.Vector3(side*cartGrip.width,cartGrip.height,cartGrip.reach);
   const end=new B.Vector3(side*.337,.515,1.31),axis=end.subtract(grip);
   const shaft=cylinder();shaft.transform(B.Matrix.Compose(new B.Vector3(.058,axis.length(),.058),B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,axis.normalize(),new B.Quaternion()),B.Vector3.Center(grip,end)));
   part(shaft,rail,0,0,0,1,1,1);
  }
  for(let i=0;i<6;i++)part(box(),[timber,'#b18b5c','#957148'][i%3],(i-2.5)*.131,.594,1.23,.126,.057,1.09);
  part(box(),timber,0,.706,1.744,.81,.18,.046);
 }
 return parts[0].merge(parts.slice(1));
}

// The parked and rolling models share vertex buffers. Each disc turns about its axle.
export function createPorterCarts(B,scene,groundHeight,register,prune){
 const parked=new Map(),issued=new Set(),present=new Set();let sources,material;
 function templates(){
  if(sources)return sources;
  material=new B.PBRMaterial('porter-cart-timber',scene);material.metallic=0;material.roughness=.94;
  sources=[false,true].map(wheel=>{
   const mesh=new B.Mesh('porter-cart-'+(wheel?'wheel':'body')+'-source',scene);
   cartGeometry(B,wheel).applyToMesh(mesh);mesh.material=material;mesh.setEnabled(false);return mesh;
  });
  return sources;
 }
 function create(name,parent){
  const [bed,disc]=templates(),root=new B.TransformNode(name,scene);root.parent=parent;
  const body=bed.clone(name+'-bed',root,true);body.setEnabled(true);body.receiveShadows=true;
  const wheels=[-1,1].map(side=>{
   const mesh=disc.clone(name+'-wheel',root,true);mesh.position.set(side*.493,wheelRadius,axleZ);mesh.setEnabled(true);mesh.receiveShadows=true;return mesh;
  });
  return {root,wheels};
 }
 function syncParking(state){
  issued.clear();present.clear();
  for(const c of state.citizens||[])if(c.freightCart)issued.add(c.freightCart);
  for(const b of state.buildings||[]){
   if(!freightCartCapacity(b))continue;
   const id=buildingKey(b);
   present.add(id);let cart=parked.get(id);
   if(!cart&&issued.has(id))continue;
   if(!cart){cart=create('parked-freight-cart-'+id,null);register(cart.root);parked.set(id,cart);}
   const visible=!issued.has(id);
   if(cart.visible!==visible){cart.visible=visible;cart.root.setEnabled(visible);}
   if(cart.building===b&&cart.rotation===b.rotation&&cart.footprint===b.footprint)continue;
   cart.building=b;cart.rotation=b.rotation;cart.footprint=b.footprint;
   const p=cartParking(b);
   const parts=cart.root.getChildMeshes();cart.root.unfreezeWorldMatrix();
   for(const mesh of parts)mesh.unfreezeWorldMatrix();
   // A parked porter puts the handles down; the wheel stays in contact with the yard.
   const pitch=-.79,axleHeight=wheelRadius*Math.cos(pitch)-axleZ*Math.sin(pitch);
   cart.root.position.set(p.x*6,groundHeight(p.x,p.y,state)+wheelRadius-axleHeight,p.y*6);
   cart.root.rotation.set(pitch,p.angle,0);
   cart.root.metadata={tile:{x:b.x,y:b.y}};
   cart.root.freezeWorldMatrix();for(const mesh of parts)mesh.freezeWorldMatrix();
  }
  for(const [id,cart]of parked)if(!present.has(id)){prune(cart.root);cart.root.dispose();parked.delete(id);}
 }
 return {create,syncParking,roll(cart,distance,scale){for(const wheel of cart.wheels)wheel.rotation.x+=distance/(wheelRadius*scale);},
  dispose(){for(const cart of parked.values())cart.root.dispose();for(const mesh of sources||[])mesh.dispose();material?.dispose();}};
}
