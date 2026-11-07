// Display-only goods. Rectangular parcels share baked geometry; amounts remain in simulation.
export const GOODS_HEIGHT=.36;
export const GOODS_KINDS=['food','wood','clay','stone','reed','pottery','wool','cloth','beer','hides','clothing','brick','firedBrick','water','milk','flax','basket','mat','copper','axe'];
export function cargoLayout(stock,{columns=4,layers=3,maxKinds=Infinity}={}){
 const result=[];let i=0;
 for(const kind of GOODS_KINDS){if(i>=maxKinds)break;const amount=stock?.[kind];if(!Number.isFinite(amount)||amount<=0)continue;
  for(let j=0;j<Math.min(layers,Math.ceil(amount/50));j++)result.push({kind,x:((i%columns)-(columns-1)/2)*.78,y:j*GOODS_HEIGHT,z:Math.floor(i/columns)*.66,layer:j});i++;
 }return result;
}
export function createGoodsSources(B,scene,materials){
 const sources=new Map(),owned=[];
 for(const kind of GOODS_KINDS){
  const pieces=[],mat=['milk','water','beer','pottery','clay','firedBrick','copper'].includes(kind)?materials.terracotta:kind==='brick'?(materials.soil||materials.terracotta):kind==='stone'?materials.stone:kind==='wood'?materials.wood:['cloth','wool','hides','clothing'].includes(kind)?materials.linen:materials.reed;
  const box=(x,y,z,w,h,d)=>{const m=B.MeshBuilder.CreateBox(`goods-part-${kind}`,{width:w,height:h,depth:d},scene);m.position.set(x,y,z);pieces.push(m);return m;};
  if(['milk','water','beer','pottery','milk'].includes(kind)){
   // Clay vessels retain their functional shape, resting in a rectangular carrier.
   box(0,.035,0,.68,.07,.56);
   for(const x of [-.16,.16]){const m=B.MeshBuilder.CreateCylinder('goods-clay-vessel',{height:.29,diameterTop:.15,diameterBottom:.21,tessellation:8},scene);m.position.set(x,.215,0);pieces.push(m);}
  }else if(kind==='axe'){
   box(0,.05,0,.64,.10,.53);box(-.03,.155,0,.54,.11,.09);box(.18,.17,0,.22,.13,.41);
  }else if(kind==='mat'){
   for(const x of [-.2,0,.2])box(x,.105,0,.19,.21,.56);
  }else if(kind==='basket'){
   box(0,.06,0,.55,.12,.54);for(const x of [-.25,.25])box(x,.18,0,.07,.24,.54);for(const z of [-.235,.235])box(0,.18,z,.55,.24,.07);
  }else if(['wood','reed','flax'].includes(kind)){
   for(const x of [-.22,0,.22])for(const y of [.08,.26])box(x,y,0,.19,.16,.56);
  }else if(['clay','stone','brick','firedBrick','copper'].includes(kind)){
   for(const x of [-.17,.17])for(const z of [-.14,.14])box(x,.09,z,.32,.18,.26);
   box(0,.27,0,.64,.18,.52);
  }else{
   box(0,.17,0,.64,.34,.52);
   if(kind==='food')for(const y of [.07,.16,.25]){box(0,y,-.272,.66,.025,.024);box(0,y,.272,.66,.025,.024);box(-.332,y,0,.024,.025,.52);box(.332,y,0,.024,.025,.52);}
   // Folded fabric and wool bales stay block shaped, with visible folded ends.
   else for(const y of [.08,.16,.24])box(0,y,.269,.61,.018,.025);
  }
  if(!['clay','stone','brick','firedBrick','copper','water','beer','pottery','milk'].includes(kind))for(const z of [-.16,.16]){
   box(0,.35,z,.70,.02,.035);box(-.34,.18,z,.025,.34,.035);box(.34,.18,z,.025,.34,.035);
  }
  const mesh=B.Mesh.MergeMeshes(pieces,true,true,undefined,false,false);mesh.name=`goods-source-${kind}`;mesh.material=mat;mesh.isPickable=false;mesh.receiveShadows=true;mesh.setEnabled(false);sources.set(kind,mesh);owned.push(mesh);
 }
 return {sources,meshes:owned};
}
