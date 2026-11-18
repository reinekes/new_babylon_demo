import {createHandmadeParcel} from './craft-parcels.js';
import {createYardBrick,yardCraftMaterial} from './yard-craft-meshes.js';
import {createCopperParcel} from './copper-goods.js';

// Display-only goods. Rectangular parcels share baked geometry; amounts remain in simulation.
export const GOODS_HEIGHT=.36;
// The next layer sits on the rim, binding or top brick of its own kind.
export const CRAFT_PARCEL_HEIGHT=Object.freeze({basket:.34,mat:.28,clay:.235,brick:.34,firedBrick:.34});
export const GOODS_KINDS=['food','wood','clay','stone','reed','pottery','wool','cloth','beer','hides','clothing','brick','firedBrick','water','milk','flax','basket','mat','copper','axe','blade','chisel','timber','joinery'];
export function cargoLayout(stock,{columns=4,layers=3,maxKinds=Infinity}={}){
 const result=[];let i=0;
 for(const kind of GOODS_KINDS){if(i>=maxKinds)break;const amount=stock?.[kind];if(!Number.isFinite(amount)||amount<=0)continue;
  for(let j=0;j<Math.min(layers,Math.ceil(amount/50));j++)result.push({kind,x:((i%columns)-(columns-1)/2)*.78,y:j*(CRAFT_PARCEL_HEIGHT[kind]??GOODS_HEIGHT),z:Math.floor(i/columns)*.66,layer:j});i++;
 }return result;
}
// Radius/height profiles for transport jars and open pottery, including inner walls.
const vesselProfiles={
 water:[[0,0],[.058,0],[.079,.028],[.113,.092],[.112,.159],[.094,.203],[.052,.239],
  [.040,.268],[.052,.274],[.051,.286],[.034,.286],[.031,.254],[.033,.230],[0,.218]],
 beer:[[0,0],[.078,0],[.108,.026],[.121,.093],[.111,.177],[.081,.225],[.066,.237],
  [.060,.259],[.069,.265],[.068,.280],[.049,.281],[.047,.251],[0,.230]],
 milk:[[0,0],[.062,0],[.098,.025],[.120,.075],[.118,.146],[.091,.197],[.075,.211],
  [.073,.236],[.084,.239],[.082,.255],[.061,.255],[.059,.232],[0,.204]],
 pottery:[[0,0],[.072,0],[.077,.016],[.077,.031],[.107,.043],[.132,.086],[.145,.127],
  [.145,.142],[.131,.146],[.126,.132],[.115,.096],[.093,.065],[.060,.046],[0,.042]],
};
export function createGoodsSources(B,scene,materials,kinds=GOODS_KINDS){
 const sources=new Map(),owned=[];
 const parcelMaterials={stone:materials.stone,wood:materials.wood,timber:materials.wood,joinery:materials.wood,
  cloth:materials.linen,wool:materials.linen,hides:materials.linen,clothing:materials.linen};
 const metal=new B.StandardMaterial('goods-copper-and-wood',scene);
 metal.diffuseColor=B.Color3.White();
 metal.specularColor=new B.Color3(.25,.19,.14);
 metal.specularPower=28;
 const clayware=new B.StandardMaterial('goods-clayware',scene);
 clayware.diffuseColor=B.Color3.White();
 clayware.specularColor=new B.Color3(.11,.08,.055);
 clayware.specularPower=16;
 for(const kind of kinds){
  const copper=['axe','blade','chisel','copper'].includes(kind);
  const profile=vesselProfiles[kind];
  const handmade=kind==='basket'||kind==='mat'||kind==='clay';
  const brickParcel=kind==='brick'||kind==='firedBrick';
  const pieces=[];
  let mat=parcelMaterials[kind]||materials.reed;
  const box=(x,y,z,w,h,d)=>{const m=B.MeshBuilder.CreateBox(`goods-part-${kind}`,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);pieces.push(m);return m;};
  if(copper){
   mat=metal;
   pieces.push(...createCopperParcel(B,scene,kind));
  }else if(profile){
   mat=clayware;
   function tint(mesh,hex,variation=0){
    const color=B.Color3.FromHexString(hex),values=[];
    const points=mesh.getVerticesData(B.VertexBuffer.PositionKind);
    for(let i=0;i<points.length;i+=3){
     const tone=1+variation*Math.sin(160*points[i+1]+9*points[i])*Math.cos(8*points[i+2]);
     values.push(color.r*tone,color.g*tone,color.b*tone,1);
    }
    mesh.setVerticesData(B.VertexBuffer.ColorKind,values);
   }
   for(const z of [-.225,.225])tint(box(0,.019,z,.65,.038,.063),'#826749');
   for(const x of [-.28,-.20,-.12,-.04,.04,.12,.20,.28]){
    const reed=B.MeshBuilder.CreateCylinder('vessel-tray-reed',{height:.53,diameter:.041,tessellation:6},scene);
    reed.rotation.x=Math.PI/2;
    reed.position.set(x,.041,0);
    tint(reed,'#a58761');
    pieces.push(reed);
   }
   for(const x of [-.163,.163]){
    const vessel=B.MeshBuilder.CreateLathe(`goods-${kind}-vessel`,{
     shape:profile.map(([r,y])=>new B.Vector3(r,y,0)),tessellation:16
    },scene);
    vessel.position.set(x,.058,0);
    tint(vessel,{water:'#a7805d',beer:'#ab643e',milk:'#c39870',pottery:'#a9704b'}[kind],.11);
    pieces.push(vessel);
    if(kind==='beer'||kind==='milk'){
     const milk=kind==='milk';
     const stopper=B.MeshBuilder.CreateCylinder('goods-jar-stopper',{
      height:.021,diameterTop:milk ? .127 : .110,diameterBottom:milk ? .146 : .122,tessellation:12
     },scene);
     stopper.position.set(x,milk ? .314 : .342,0);
     tint(stopper,'#936547',.06);
     pieces.push(stopper);
    }
   }
  }else if(handmade){
   mat=kind==='clay'?yardCraftMaterial(B,scene):clayware;
   pieces.push(createHandmadeParcel(B,scene,kind));
  }else if(brickParcel){
   const fired=kind==='firedBrick';
   for(let level=0;level<3;level++)for(let col=0;col<2;col++)for(let row=0;row<2;row++){
    const seed=1+level*4+col*2+row;
    const brick=createYardBrick(B,scene,{width:.288,height:.112,depth:.223,fired,seed});
    brick.position.set((col-.5)*.298+.008*Math.sin(seed),level*.110,(row-.5)*.236);
    brick.rotation.y=.018*Math.cos(seed*2);
    pieces.push(brick);
   }
   mat=pieces[0].material;
  }else if(['wood','reed','flax','timber','joinery'].includes(kind)){
   for(const x of [-.22,0,.22])for(const y of [.08,.26])box(x,y,0,.19,.16,.56);
  }else if(kind==='stone'){
   for(const x of [-.17,.17])for(const z of [-.14,.14])box(x,.09,z,.32,.18,.26);
   box(0,.27,0,.64,.18,.52);
  }else{
   box(0,.17,0,.64,.34,.52);
   if(kind==='food')for(const y of [.07,.16,.25]){box(0,y,-.272,.66,.025,.024);box(0,y,.272,.66,.025,.024);box(-.332,y,0,.024,.025,.52);box(.332,y,0,.024,.025,.52);}
   // Folded fabric and wool bales stay block shaped, with visible folded ends.
   else for(const y of [.08,.16,.24])box(0,y,.269,.61,.018,.025);
  }
  if(!copper&&!handmade&&!brickParcel&&!profile&&kind!=='stone')for(const z of [-.16,.16]){
   box(0,.35,z,.70,.02,.035);box(-.34,.18,z,.025,.34,.035);box(.34,.18,z,.025,.34,.035);
  }
  const mesh=pieces.length===1?pieces[0]:B.Mesh.MergeMeshes(pieces,true,true,undefined,false,false);
  if(CRAFT_PARCEL_HEIGHT[kind]){
   const bounds=mesh.getBoundingInfo().boundingBox;
   const scale=CRAFT_PARCEL_HEIGHT[kind]/(bounds.maximum.y-bounds.minimum.y);
   const fit=B.Matrix.Scaling(1,scale,1).multiply(B.Matrix.Translation(0,-bounds.minimum.y*scale,0));
   mesh.bakeTransformIntoVertices(fit);
  }
  mesh.name=`goods-source-${kind}`;mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;mesh.setEnabled(false);sources.set(kind,mesh);owned.push(mesh);
 }
 return {sources,meshes:owned};
}
