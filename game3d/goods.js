import {createCopperParcel} from './copper-goods.js';

// Display-only goods. Rectangular parcels share baked geometry; amounts remain in simulation.
export const GOODS_HEIGHT=.36;
export const GOODS_KINDS=['food','wood','clay','stone','reed','pottery','wool','cloth','beer','hides','clothing','brick','firedBrick','water','milk','flax','basket','mat','copper','axe','blade','chisel','timber','joinery'];
export function cargoLayout(stock,{columns=4,layers=3,maxKinds=Infinity}={}){
 const result=[];let i=0;
 for(const kind of GOODS_KINDS){if(i>=maxKinds)break;const amount=stock?.[kind];if(!Number.isFinite(amount)||amount<=0)continue;
  for(let j=0;j<Math.min(layers,Math.ceil(amount/50));j++)result.push({kind,x:((i%columns)-(columns-1)/2)*.78,y:j*GOODS_HEIGHT,z:Math.floor(i/columns)*.66,layer:j});i++;
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
export function createGoodsSources(B,scene,materials){
 const sources=new Map(),owned=[];
 const metal=new B.StandardMaterial('goods-copper-and-wood',scene);
 metal.diffuseColor=B.Color3.White();
 metal.specularColor=new B.Color3(.25,.19,.14);
 metal.specularPower=28;
 const clayware=new B.StandardMaterial('goods-clayware',scene);
 clayware.diffuseColor=B.Color3.White();
 clayware.specularColor=new B.Color3(.11,.08,.055);
 clayware.specularPower=16;
 for(const kind of GOODS_KINDS){
  const copper=['axe','blade','chisel','copper'].includes(kind);
  const profile=vesselProfiles[kind];
  const pieces=[],mat=copper?metal:profile?clayware:['clay','firedBrick'].includes(kind)?materials.terracotta:kind==='brick'?(materials.soil||materials.terracotta):kind==='stone'?materials.stone:['wood','timber','joinery'].includes(kind)?materials.wood:['cloth','wool','hides','clothing'].includes(kind)?materials.linen:materials.reed;
  const box=(x,y,z,w,h,d)=>{const m=B.MeshBuilder.CreateBox(`goods-part-${kind}`,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);pieces.push(m);return m;};
  if(copper){
   pieces.push(...createCopperParcel(B,scene,kind));
  }else if(profile){
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
  }else if(kind==='mat'){
   for(const x of [-.2,0,.2])box(x,.105,0,.19,.21,.56);
  }else if(kind==='basket'){
   box(0,.06,0,.55,.12,.54);for(const x of [-.25,.25])box(x,.18,0,.07,.24,.54);for(const z of [-.235,.235])box(0,.18,z,.55,.24,.07);
  }else if(['wood','reed','flax','timber','joinery'].includes(kind)){
   for(const x of [-.22,0,.22])for(const y of [.08,.26])box(x,y,0,.19,.16,.56);
  }else if(['clay','stone','brick','firedBrick'].includes(kind)){
   for(const x of [-.17,.17])for(const z of [-.14,.14])box(x,.09,z,.32,.18,.26);
   box(0,.27,0,.64,.18,.52);
  }else{
   box(0,.17,0,.64,.34,.52);
   if(kind==='food')for(const y of [.07,.16,.25]){box(0,y,-.272,.66,.025,.024);box(0,y,.272,.66,.025,.024);box(-.332,y,0,.024,.025,.52);box(.332,y,0,.024,.025,.52);}
   // Folded fabric and wool bales stay block shaped, with visible folded ends.
   else for(const y of [.08,.16,.24])box(0,y,.269,.61,.018,.025);
  }
  if(!copper&&!['clay','stone','brick','firedBrick','water','beer','pottery','milk'].includes(kind))for(const z of [-.16,.16]){
   box(0,.35,z,.70,.02,.035);box(-.34,.18,z,.025,.34,.035);box(.34,.18,z,.025,.34,.035);
  }
  const mesh=B.Mesh.MergeMeshes(pieces,true,true,undefined,false,false);mesh.name=`goods-source-${kind}`;mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;mesh.setEnabled(false);sources.set(kind,mesh);owned.push(mesh);
 }
 return {sources,meshes:owned};
}
