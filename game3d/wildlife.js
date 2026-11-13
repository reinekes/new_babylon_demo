import {createOnager,onagerDistanceGeometry,poseOnager} from './onager.js?v=valley-seam-herds-20261112';
import {createPelican,posePelican} from './pelican.js?v=audit-fixes-20261113';
import {regionalBirds,createRegionalBird,createRegionalFrog,poseRegionalBird} from './regional-wildlife.js';
import {onBridge} from '../world.js';
import {surfaceElevation} from '../district3d/terrain.js';
import {WATER_HEIGHT} from './water.js';
import {closedAnimalLoft,animalFootPose} from './animal-anatomy.js';
import {coatVariant,hasHairCoat,createCoatTextures} from './animal-coats.js';

// Dimensions are metres. Author-created anatomy, not archaeological reconstructions.
const species={
 fish:{height:0,length:.68,width:.085,depth:.17,stride:.64,fish:true,color:'#888f75',light:'#d0cdb0'},
 goat:{height:.67,length:.91,width:.19,depth:.22,neck:.22,head:.17,muzzle:.15,leg:.63,color:'#b29a77',light:'#e3d5b8',stride:.78,horns:true},
 gazelle:{height:.97,length:1.03,width:.23,depth:.30,neck:.42,head:.19,muzzle:.25,leg:.92,color:'#bc9464',light:'#ece0bf',stride:1.12,horns:true},
 cat:{height:.31,length:.58,width:.105,depth:.105,neck:.07,head:.125,muzzle:.065,leg:.29,color:'#a79c7a',light:'#d6cdb4',stride:.53,cat:true},
 jackal:{height:.53,length:.96,width:.22,depth:.28,neck:.20,head:.21,muzzle:.32,leg:.50,color:'#a38965',light:'#cfbc93',stride:.85,jackal:true},
 bird:{height:.23,length:.38,width:.16,depth:.24,neck:.15,head:.13,muzzle:.10,leg:.20,color:'#928d77',light:'#c8c4aa',stride:.29,bird:true},
 pig:{height:.39,length:.88,width:.25,depth:.26,neck:.05,head:.19,muzzle:.13,leg:.37,color:'#a67c6d',light:'#cb9a87',stride:.56,pig:true},
 mouse:{height:.095,length:.22,width:.075,depth:.12,neck:.025,head:.095,muzzle:.07,leg:.08,color:'#9b8a73',light:'#cabaa2',stride:.17,mouse:true}
};

/** A shared, smooth anatomical animal layer; state and routes remain read-only. */
export function createWildlife(B,scene,meshes=[]){
 const actors=new Map(),sources=new Map(),geometrySources=new Map(),materials=new Map(),coatTextures=[],seen=new Set();let disposed=false,time=0,blend=1;
 const ease=(from,to)=>from+(to-from)*blend;
 const v=(x=0,y=0,z=0)=>new B.Vector3(x,y,z);
 function material(key,color){if(materials.has(key))return materials.get(key);const m=new B.PBRMaterial(`wildlife-${key}`,scene);m.albedoColor=B.Color3.FromHexString(color).toLinearSpace();m.metallic=0;m.roughness=.97;materials.set(key,m);return m;}
 function coatMaterial(kind,id){const variant=coatVariant(id),key=`${kind}-coat-${variant}`;if(materials.has(key))return materials.get(key);const m=material(key,'#ffffff'),textures=createCoatTextures(B,scene,kind,variant);m.albedoTexture=textures.albedo;m.bumpTexture=textures.bump;m.roughness=kind==='goat'?.98:.94;coatTextures.push(textures.albedo,textures.bump);return m;}
 const black=material('eyes','#27231e'),horn=material('horn','#625545'),glint=material('eye-glint','#eee5c8');
 function node(name,parent,x=0,y=0,z=0){const n=new B.TransformNode(name,scene);n.parent=parent;n.position.set(x,y,z);return n;}
 // Elliptical rings form a continuous softly curved surface with rounded ends.
 // Each ring is [z, centreY, radiusX, radiusY]. No box geometry is used.
 function loft(name,rings){const mesh=new B.Mesh(name,scene),data=new B.VertexData();Object.assign(data,closedAnimalLoft(B,rings));data.applyToMesh(mesh);return mesh;}
 function part(key,parent,mat,build,x=0,y=0,z=0){const materialKey=`${key}@${mat.name}`;let source=sources.get(materialKey);if(!source){const geometry=geometrySources.get(key);source=geometry?geometry.clone(`wildlife-source-${materialKey}`,null,true):build(`wildlife-source-${key}`);if(!geometry)geometrySources.set(key,source);source.material=mat;source.isVisible=false;source.isPickable=false;source.receiveShadows=true;sources.set(materialKey,source);}
  const m=source.createInstance(`${parent.name}-${key.split(':').at(-1)}`);m.parent=parent;m.position.set(x,y,z);m.isVisible=true;m.isPickable=true;meshes.push(m);return m;
 }
 function ball(key,parent,mat,x,y,z,sx,sy,sz){const m=part(key,parent,mat,name=>B.MeshBuilder.CreateSphere(name,{diameter:1,segments:12},scene),x,y,z);m.scaling.set(sx,sy,sz);return m;}
 function tube(key,parent,mat,points,radius,endRatio=.06){return part(key,parent,mat,name=>B.MeshBuilder.CreateTube(name,{path:points.map(p=>v(...p)),radius,tessellation:8,cap:B.Mesh.CAP_ALL,radiusFunction:i=>radius*(1-(1-endRatio)*i/(points.length-1))},scene));}
 function buildFish(c){
  const d=species.fish,root=node(`wildlife-${c.id}`);root.metadata={animalId:c.id,animalKind:c.kind,gait:0};
  const silver=material('fish-scales',d.color),belly=material('fish-belly',d.light),fin=material('fish-fin','#777e62'),eye=material('fish-iris','#c4b263');
  const body=node(`${c.id}-body-pivot`,root),L=d.length,W=d.width,D=d.depth;
  part('fish:torso',body,silver,name=>loft(name,[[-L*.52,0,.004,.009],[-L*.40,0,W*.42,D*.50],[-L*.2,.01,W*.88,D*.92],[0,.015,W,D],[L*.22,.004,W*.85,D*.83],[L*.38,-.005,W*.56,D*.55],[L*.49,-.01,.004,.006]]));
  ball('fish:belly',body,belly,0,-D*.44,.035,W*1.60,D*.89,L*.62);
  for(const side of [-1,1]){
   ball('fish:iris',body,eye,side*W*.66,.045,L*.31,.04,.042,.045);
   ball('fish:eye',body,black,side*W*.81,.047,L*.32,.021,.025,.026);
   const gill=ball('fish:gill',body,fin,side*W*.94,.005,L*.18,.008,D*1.34,.017);gill.rotation.z=side*.12;
   const pectoral=ball('fish:pectoral-fin',body,fin,side*W*1.1,-.075,.045,.14,.016,.17);pectoral.rotation.z=-side*.35;pectoral.rotation.y=-side*.40;
  }
  const dorsal=ball('fish:dorsal-fin',body,fin,0,D*.95,-.025,.012,.18,.31);dorsal.rotation.x=.18;
  ball('fish:mouth',body,fin,0,-.01,L*.485,.025,.012,.015);
  const tail=node(`${c.id}-tail`,body,0,0,-L*.48);
  for(const side of [-1,1]){const lobe=ball(`fish:caudal-fin-${side}`,tail,fin,0,side*.055,-.085,.016,.17,.22);lobe.rotation.x=side*.53;}
  // Small lateral scale marks follow the flanks, shared between every fish.
  for(const side of [-1,1])for(let i=0;i<5;i++)ball('fish:scale',body,belly,side*W*(.91-Math.abs(i-2)*.08),.005,-.16+i*.065,.009,.036,.011);
  return {root,body,tail,d,lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:[...String(c.id)].reduce((n,ch)=>n+ch.charCodeAt(0),0)*.37};
 }
 function buildTurtle(c){
  const root=node(`wildlife-${c.id}`),body=node(`${c.id}-shell-pivot`,root);
  const shell=material('turtle-shell','#51513a'),edge=material('turtle-shell-edge','#77745a'),skin=material('turtle-skin','#68694f');
  ball('turtle:shell-edge',body,edge,0,.105,-.025,.385,.051,.49);
  ball('turtle:carapace',body,shell,0,.12,-.035,.353,.104,.465);
  ball('turtle:plastron',body,edge,0,.08,-.032,.307,.066,.402);
  const head=node(c.id+'-neck',body,0,.092,.14);
  part('turtle:neck-and-head',head,skin,name=>loft(name,[
   [-.025,0,.036,.034],[.025,.002,.033,.026],[.075,.008,.027,.023],
   [.124,.014,.033,.029],[.153,.016,.028,.023],[.172,.014,.016,.014],
   [.197,.013,.009,.009],[.204,.012,.007,.007]
  ]));
  for(const side of [-1,1]){
   ball('turtle:eye',head,black,side*.025,.036,.143,.012,.013,.012);
   ball('turtle:nostril',head,black,side*.004,.014,.204,.003,.004,.003);
  }
  tube('turtle:tail',body,skin,[[0,.086,-.207],[.006,.069,-.268],[.012,.055,-.302]],.022);
  const feet=[];
  for(const side of [-1,1])for(const end of [-1,1]){
   const foot=node(c.id+'-limb-'+side+'-'+end,body,side*.111,.073,end*.134);
   const leg=ball('turtle:leg',foot,skin,side*.038,-.015,0,.124,.051,.069);
   leg.rotation.z=-side*.32;
   const web=ball('turtle:web',foot,skin,side*.096,-.044,.017,.081,.031,.085);
   web.rotation.y=side*.36;
   for(let digit=-1;digit<=1;digit++){
    const claw=ball('turtle:claw',foot,edge,side*.095+digit*.017,-.046,.052-Math.abs(digit)*.009,.007,.008,.025);
    claw.rotation.y=side*.32+digit*.21;
   }
   feet.push({foot,side,end});
  }
  return {root,body,head,feet,d:{turtle:true,stride:.18},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
 }
 function buildEgret(c){
  const root=node(`wildlife-${c.id}`),body=node(`${c.id}-body`,root,0,.43,0);
  const white=material('egret-feathers','#f2eee1'),wing=material('egret-wing','#dedcd0');
  const bill=material('egret-bill','#252828'),foot=material('egret-foot','#bba138');
  ball('egret:body',body,white,0,0,-.036,.144,.164,.335);
  for(const side of [-1,1]){
   const cover=ball('egret:wing',body,wing,side*.055,-.008,-.079,.067,.119,.284);
   cover.rotation.x=-.14;
   for(let i=0;i<3;i++){
    const feather=ball('egret:folded-feather',body,white,side*(.055+i*.008),-.021-i*.018,-.122,.035,.038,.235);
    feather.rotation.x=-.15;
   }
   const leg=node(`${c.id}-leg-${side}`,root,side*.035,0,-.025);
   tube('egret:leg',leg,bill,[[0,.385,0],[0,.222,-.04],[0,.009,0]],.010,.67);
   for(const digit of [-1,0,1])tube(`egret:toe-${digit}`,leg,foot,[[0,.01,0],[digit*.02,.009,.029],[digit*.027,.006,.047]],.005,.45);
  }
  const neck=node(`${c.id}-neck`,body,0,.04,.069);
  part('egret:s-neck',neck,white,name=>{
   const controls=[[0,-.04,-.032],[0,.037,.014],[0,.09,.052],[0,.153,.028],[0,.216,-.009],[0,.273,.024],[0,.31,.048]];
   const points=controls.map(p=>v(...p)),path=[];
   for(let i=0;i<points.length-1;i++){
    for(let step=0;step<5;step++)path.push(B.Vector3.CatmullRom(points[Math.max(0,i-1)],points[i],points[i+1],points[Math.min(i+2,points.length-1)],step/5));
   }
   path.push(points.at(-1));
   return B.MeshBuilder.CreateTube(name,{path,tessellation:16,cap:B.Mesh.CAP_ALL,
    radiusFunction:i=>.043-.021*i/(path.length-1)},scene);
  });
  ball('egret:head',neck,white,0,.315,.065,.059,.056,.099);
  part('egret:bill',neck,bill,name=>loft(name,[[0,0,.019,.013],[.043,-.004,.012,.008],[.118,-.011,.001,.001]]),0,.302,.103);
  for(const side of [-1,1])ball('egret:eye',neck,black,side*.024,.324,.09,.009,.009,.009);
  return {root,body,neck,d:{egret:true,stride:.4},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
 }
 function buildOtter(c){
  const root=node(`wildlife-${c.id}`),body=node(`${c.id}-body`,root);
  const coat=material('otter-coat','#40342b'),throat=material('otter-throat','#9e8b74');
  coat.roughness=.64;
  part('otter:torso',body,coat,name=>loft(name,[
   [-.39,-.014,.021,.025],[-.3,-.004,.091,.069],[-.15,.008,.126,.092],
   [.055,.023,.112,.078],[.18,.038,.083,.066],[.31,.059,.055,.046]
  ]));
  const head=node(`${c.id}-head`,body,0,.049,.24);
  ball('otter:head',head,coat,0,.039,.066,.163,.128,.174);
  ball('otter:throat',head,throat,0,-.01,.055,.107,.07,.161);
  ball('otter:muzzle',head,throat,0,.015,.137,.115,.075,.096);
  ball('otter:nose',head,black,0,.034,.181,.055,.031,.032);
  for(const side of [-1,1]){
   ball('otter:ear',head,coat,side*.067,.077,.035,.035,.037,.026);
   ball('otter:eye',head,black,side*.061,.055,.122,.016,.018,.016);
   for(let i=0;i<2;i++)tube(`otter:whisker-${side}-${i}`,head,throat,
    [[side*.04,.016+i*.012,.152],[side*.076,.012+i*.016,.166],[side*.105,.008+i*.016,.18]],.0018,.35);
  }
  const paddles=[];
  for(const side of [-1,1])for(const end of [-1,1]){
   const paddle=node(`${c.id}-paddle-${side}-${end}`,body,side*.087,-.036,end*.165);
   ball('otter:short-leg',paddle,coat,side*.029,-.024,-.018,.078,.073,.109);
   ball('otter:webbed-foot',paddle,coat,side*.045,-.051,-.063,.059,.031,.093);
   paddles.push({paddle,side,end});
  }
  const tail=node(`${c.id}-tail`,body,0,-.01,-.35);
  part('otter:tail',tail,coat,name=>loft(name,[[-.43,-.043,.006,.006],[-.32,-.032,.024,.012],
   [-.2,-.015,.042,.021],[-.09,0,.061,.035],[.031,.004,.071,.046]]));
  return {root,body,head,tail,paddles,d:{otter:true,stride:.44},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
 }
 function skin(key,parent,mat,rings,tint){
  return part(key,parent,mat,name=>{
   const mesh=loft(name,rings);
   if(tint){
    const positions=mesh.getVerticesData(B.VertexBuffer.PositionKind),colors=[],palette=new Map();
    for(let i=0;i<positions.length;i+=3){
     const color=tint(positions.slice(i,i+3));
     if(!palette.has(color))palette.set(color,B.Color3.FromHexString(color).toLinearSpace());
     const {r,g,b}=palette.get(color);
     colors.push(r,g,b,1);
    }
    mesh.setVerticesData(B.VertexBuffer.ColorKind,colors);
   }
   return mesh;
  });
 }
 function hoof(key,parent,mat){
  const mesh=part(key,parent,mat,name=>B.MeshBuilder.CreateCylinder(name,{
   height:.088,diameterTop:.071,diameterBottom:.092,tessellation:12
  },scene),0,-.016,.017);
  mesh.scaling.z=1.23;
  return mesh;
 }
 const onagerHelpers={node,ball,tube,material,skin,black,hoof};
 function buildOnager(c){
  const root=node('wildlife-'+c.id);
  root.scaling.setAll(c.scale??1);
  const distant=part('onager-distance',root,material('onager-skin','#ffffff'),name=>{
   const mesh=new B.Mesh(name,scene);
   onagerDistanceGeometry(B).applyToMesh(mesh);
   return mesh;
  });
  return {root,distant,detail:null,d:{onager:true,stride:1.1},lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:0};
 }
 function updateOnagerDetail(a,c){
  const camera=scene.activeCamera;
  const position=camera?.globalPosition||camera?.position;
  const radius=a.detail?.root.isEnabled()?76:68;
  const near=!position||B.Vector3.DistanceSquared(position,a.root.position)<radius*radius;
  if(near&&!a.detail){
   const detail=createOnager({...c,id:c.id+'-detail'},onagerHelpers);
   detail.root.parent=a.root;
   for(const mesh of detail.root.getChildMeshes())mesh.isPickable=false;
   a.detail=detail;
  }
  a.distant.setEnabled(!near);
  a.detail?.root.setEnabled(near);
  return near;
 }
 function build(c){
  const helpers={node,ball,tube,material,skin,black,hoof};
  if(c.kind==='onager')return buildOnager(c);
  if(c.kind==='white-pelican')return createPelican(c,helpers);
  if(Object.hasOwn(regionalBirds,c.kind))return createRegionalBird(c,regionalBirds[c.kind],helpers);
  if(c.kind==='savigny-tree-frog')return createRegionalFrog(c,helpers);if(c.kind==='fish')return buildFish(c);if(c.kind==='turtle')return buildTurtle(c);if(c.kind==='egret')return buildEgret(c);if(c.kind==='otter')return buildOtter(c);const d=species[c.kind==='rat'?'mouse':c.kind]||species.goat,kind=c.kind,root=node(`wildlife-${c.id}`);root.metadata={animalId:c.id,animalKind:kind,gait:0};if(d.mouse)root.scaling.setAll(c.decorative?.83:.55);if(d.cat)root.scaling.setAll(.85);
  const fur=hasHairCoat(kind==='rat'?'mouse':kind)?coatMaterial(kind==='rat'?'mouse':kind,c.id):material(`${kind}-fur`,d.color),pale=material(`${kind}-pale`,d.light),body=node(`${c.id}-body-pivot`,root,0,d.height,0);
  if(fur.bumpTexture&&!pale.bumpTexture)pale.bumpTexture=fur.bumpTexture;
  const L=d.length,W=d.width,D=d.depth;
  part(`${kind}:torso`,body,fur,name=>loft(name,[[-L*.55,0,.003,.003],[-L*.49,.005,W*.45,D*.65],[-L*.36,.015,W*.84,D*.98],[-L*.15,0,W,D],[L*.06,-.015,W*.91,D*.91],[L*.27,.035,W*.79,D*.98],[L*.42,.05,W*.53,D*.78],[L*.49,.04,.003,.003]]));
  // Underside pigment belongs to the closed torso skin, avoiding an intersecting belly shell.
  // Shoulders and the neck/head follow one articulated chain, rather than a head cube.
  const head=node(`${c.id}-head-pivot`,body,0,D*.23,L*.32),N=d.neck,H=d.head,M=d.muzzle;
  // One skin runs from the chest inside the torso through the neck to the muzzle.
  // No pointed neck cap intersects a second pointed face (the old visible back hole).
  part(`${kind}:face`,head,fur,name=>loft(name,[[-.12,-.08,W*.56,D*.59],[0,.015,W*.57,D*.61],[.09,N*.60,W*.43,D*.49],[.16,N+.045,H*.62,H*.68],[.235,N+.04,H*.70,H*.68],[.30,N+.005,H*.52,H*.46],[.33+M*.55,N-.018,H*.33,H*.28],[.35+M,N-.025,H*.24,H*.22]]));
  if(d.cat||d.mouse||d.pig){head.scaling.z=d.mouse?.37:d.pig?.73:.64;head.position.z=L*.23;}
  if(d.pig){
   ball('pig:snout',head,pale,0,N-.025,.46,.18,.10,.07);
   for(const side of [-1,1])ball('pig:nostril',head,black,side*.039,N-.025,.495,.023,.023,.014);
  }
  ball(`${kind}:chin`,head,pale,0,N-H*.24,.29+M*.26,H*.80,H*.40,H*.80);
  if(!d.bird&&!d.pig)ball(`${kind}:nose`,head,black,0,N-.025,.345+M,H*(d.cat?.24:.40),H*(d.cat?.17:.24),H*(d.cat?.14:.20));
  else if(d.bird)tube(`${kind}:beak`,head,horn,[[0,N+.02,.28],[0,N,.36],[0,N-.018,.42]],.045);
  const ears=[];for(const side of [-1,1]){
   if(d.cat||d.jackal)ball(`${kind}:iris`,head,material(`${kind}-iris`,d.cat?'#979b72':'#b49155'),side*H*.62,N+H*.23,.275,H*.23,H*.22,H*.22);
   ball(`${kind}:eye`,head,black,side*H*.67,N+H*.23,.284,H*(d.cat?.055:.14),H*.15,H*.14);
   ball(`${kind}:eye-glint`,head,glint,side*H*.70,N+H*.27,.294,H*.045,H*.045,H*.045);
   const ear=node(`${c.id}-ear-${side}`,head,side*H*.66,N+H*.49,.17);
   if(!d.bird){
    const earSize=d.cat?.095:d.jackal?.15:d.mouse?.10:d.pig?.12:kind==='goat'?.17:.22;
    const leaf=part(`${kind}:ear`,ear,fur,name=>loft(name,[[0,0,.015,.01],[.005,earSize*.35,earSize*.26,.025],[.015,earSize*.72,earSize*.20,.018],[.028,earSize,.002,.002]]));
    ear.rotation.z=side*(d.cat||d.jackal?-.17:d.mouse?-.7:-.90);ears.push({node:ear,base:ear.rotation.z,side});leaf.rotation.y=side*.32;
    const inner=ball(`${kind}:ear-inner`,ear,pale,0,earSize*.48,.025,earSize*.27,earSize*.60,.012);inner.rotation.x=.1;
   }
   if(d.horns){const tall=kind==='gazelle'?.48:.24;const points=Array.from({length:13},(_,i)=>{const t=i/12;return [side*(H*.50+.035*t),N+H*.64+t*tall,.15-.11*t*t+(kind==='gazelle'?.06:0)*Math.sin(t*Math.PI)];});tube(`${kind}:horn-${side}`,head,horn,points,kind==='gazelle'?.029:.038);}
  }
  if(d.cat||d.mouse||d.jackal)for(const side of [-1,1]){
   ball(`${kind}:muzzle-pad`,head,pale,side*H*.23,N-.03,.325+M*.65,H*.46,H*.32,H*.48);
   for(let i=0;i<3;i++)tube(`${kind}:whisker-${side}-${i}`,head,pale,[[side*H*.27,N-.015,.34+M*.60],[side*(H*.55+.035),N+(i-1)*.022,.35+M*.59],[side*(H*.8+.055),N+(i-1)*.035,.32+M*.57]],d.mouse?.0015:.0024,.12);
  }
  if(d.pig)tube('pig:curled-tail',body,pale,[[0,.055,-L*.49],[0,.09,-L*.57],[.03,.14,-L*.61],[.072,.135,-L*.62],[.075,.10,-L*.62]],.022,.4);
  if(kind==='goat')tube(`${kind}:beard`,head,pale,[[0,N-.035,.34],[0,N-.11,.33],[0,N-.19,.31]],.025);
  // Jackal saddle is pigment in its coat; there is no raised dark back plate.
  // Tabby markings belong to the shared coat texture; raised dark meshes
  // looked like separate objects sitting on the short-haired back.

  const legs=[];
  for(const side of [-1,1])for(const end of d.bird?[0]:[-1,1]){
   const leg=d.leg,hip=node(`${c.id}-hip-${side}-${end}`,body,side*W*.67,-D*.16,end*L*.30),upper=leg*.48,lower=leg*.49;
   const limbMat=d.bird?horn:fur,r=d.bird?.018:d.mouse?.018:d.cat?.024:kind==='gazelle'?.032:kind==='goat'?.043:.049;
   part(`${kind}:upper-leg`,hip,limbMat,name=>B.MeshBuilder.CreateTube(name,{path:Array.from({length:9},(_,i)=>v(0,-upper*i/8,Math.sin(i/8*Math.PI)*r*.6)),radius:r,tessellation:12,cap:B.Mesh.CAP_ALL,radiusFunction:i=>r*(1.28-.68*i/8+.10*Math.sin(i/8*Math.PI))},scene));
   const knee=node(`${c.id}-knee-${side}-${end}`,hip,0,-upper,r*.3);
   part(`${kind}:lower-leg`,knee,limbMat,name=>B.MeshBuilder.CreateTube(name,{path:Array.from({length:9},(_,i)=>v(0,-lower*i/8,Math.sin(i/8*Math.PI)*r*.35)),radius:r,tessellation:12,cap:B.Mesh.CAP_ALL,radiusFunction:i=>r*(.53-.15*i/8)},scene));
   const foot=ball(`${kind}:foot`,knee,d.cat||d.mouse?fur:horn,0,-lower,.03,r*(d.bird?1.4:1.7),r*.8,r*(d.bird?4:2.7));
   if(d.horns){ball(`${kind}:hoof-cleft`,knee,black,0,-lower+.008,.03+r*1.18,.009,r*.68,.018);}
   if(d.cat)for(let toe=0;toe<3;toe++)ball(`${kind}:toe`,knee,pale,(toe-1)*r*.45,-lower+.008,r*1.45,r*.48,r*.43,r*.70);
   legs.push({hip,knee,foot,side,end,upper,lower});
  }
  const tail=node(`${c.id}-tail`,body,0,D*.33,-L*.48),tailJoints=[];
  const tailLength=d.cat?.48:d.jackal?.49:d.mouse?.25:d.bird?.20:.12;
  let previous=tail;for(let i=0;i<(d.pig?0:3);i++){const joint=node(`${c.id}-tail-${i}`,previous,0,i?0:0,i?-tailLength/3:0);const r=(d.jackal?.085:d.cat?.024:d.mouse?.012:.045)*(1-i*.25);tube(`${kind}:tail-${i}`,joint,d.mouse?pale:fur,[[0,0,0],[0,-.015,-tailLength/6],[0,-.025,-tailLength/3]],r,i===2?.08:.75);tailJoints.push(joint);previous=joint;}
  const wings=[];if(d.bird)for(const side of [-1,1]){const wing=node(`${c.id}-wing-${side}`,body,side*W*.60,.015,-.02);wing.rotation.z=side*.12;
   const cover=ball(`${kind}:wing-cover`,wing,pale,side*.08,0,-.015,.12,.16,.34);cover.rotation.z=side*.3;
   for(let i=0;i<6;i++){const feather=part(`${kind}:flight-feather-${i}`,wing,fur,name=>loft(name,[[-.23-i*.014,0,.002,.002],[-.15,0,.027,.012],[.01,0,.035,.018],[.10-i*.008,0,.015,.012],[.14-i*.01,0,.002,.002]]),side*(.035+i*.027),0,-i*.006);feather.rotation.y=-side*(.15+i*.09);}
   wings.push({node:wing,side});}
  return {root,body,head,tail,tailJoints,legs,wings,ears,d,lastX:c.x,lastY:c.y,gait:0,move:0,yaw:null,idPhase:[...String(c.id)].reduce((n,ch)=>n+ch.charCodeAt(0),0)*.37};
 }
 function remove(a){for(const m of a.root.getChildMeshes()){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);}a.root.dispose();}
 function update(state,animals,dt=1/60,{paused=false,speed=1}={}){
  if(disposed)return;dt=Math.max(0,Math.min(.1,dt));paused=paused||!dt||!speed;if(!paused)time+=dt*speed;
  seen.clear();for(const c of animals){if(c.kind==='sheep')continue;seen.add(c.id);let a=actors.get(c.id);if(a&&a.root.metadata.animalKind!==c.kind){remove(a);actors.delete(c.id);a=null;}let fresh=false;if(!a){a=build(c);a.root.metadata??={animalKind:c.kind};if(c.decorative){delete a.root.metadata.animalId;for(const mesh of a.root.getChildMeshes())mesh.isPickable=false;}actors.set(c.id,a);fresh=true;}
   const {d}=a,dx=c.x-a.lastX,dz=c.y-a.lastY,distance=Math.hypot(dx,dz)*6;
   // Include the dorsal fin and its small animated roll, not just the body centre.
   a.root.position.set(c.x*6,Number.isFinite(c.elevation)&&(d.otter||d.regional||d.frog||d.pelican)?c.elevation:d.fish?Math.min(WATER_HEIGHT-.32,(Number.isFinite(c.waterLevel)?c.waterLevel:WATER_HEIGHT)-(Number.isFinite(c.swimDepth)?c.swimDepth:.28)):onBridge(state.buildings,c.x,c.y,state)?.22:surfaceElevation(c.x,c.y,state),c.y*6);
   a.lastX=c.x;a.lastY=c.y;
   const newDetail=d.onager&&!a.detail;
   const nearOnager=d.onager&&updateOnagerDetail(a,c);
   if(paused&&!fresh&&!(newDetail&&nearOnager))continue;
   const delta=fresh?1:1-Math.exp(-dt*9);blend=delta;
   if(distance>.00001&&distance<3){a.yaw=Math.atan2(dx,dz);a.gait+=distance/d.stride*Math.PI*2;}
   a.root.metadata.gait=a.gait;
   if(a.yaw!==null&&Number.isFinite(a.yaw)){const angle=Math.atan2(Math.sin(a.yaw-a.root.rotation.y),Math.cos(a.yaw-a.root.rotation.y));a.root.rotation.y+=angle*delta;}
   a.move=ease(a.move,distance>.00001&&distance<3?1:0);
   const t=time+a.idPhase;
   if(d.onager){
    if(Number.isFinite(c.yaw))a.root.rotation.y=c.yaw;
    if(nearOnager){
     a.detail.move=a.move;
     a.detail.gait=a.gait+(c.phase??0);
     poseOnager(a.detail,c,t+(c.phase??0),ease);
    }
    continue;
   }
   if(c.dead||c.behavior==='dead'){
    // The simulation owns corpse lifetime and coordinates. Only the pose changes here.
    const progress=Number.isFinite(c.deathProgress)?Math.max(0,Math.min(1,c.deathProgress)):1;
    a.body.position.y=d.fish?0:d.depth*.52;a.body.scaling.y=1;a.body.rotation.set(0,0,progress*Math.PI*.49);
    if(a.head){a.head.rotation.set(.15,0,0);a.head.position.y=d.depth*.23;}
    if(a.legs)for(const leg of a.legs){leg.hip.rotation.x=-.50;leg.knee.rotation.x=.76;leg.foot.rotation.x=-.26;}
    if(a.ears)for(const ear of a.ears)ear.node.rotation.z=ear.base;
    a.tail.rotation.set(0,0,0);if(a.tailJoints)for(const joint of a.tailJoints)joint.rotation.set(0,0,0);
    if(a.wings)for(const wing of a.wings)wing.node.rotation.set(0,0,wing.side*.12);
    a.move=0;continue;
   }
   if(d.pelican){
    if(Number.isFinite(c.yaw))a.root.rotation.y=c.yaw;
    posePelican(a,c,t);
    continue;
   }
   if(d.regional||d.frog){
    if(Number.isFinite(c.yaw))a.root.rotation.y=c.yaw;
    if(d.regional)poseRegionalBird(a,c,t);
    else a.body.scaling.y=1+(c.hop??0)*.14+Math.sin(t*3)*.028;
    continue;
   }
   if(d.otter){
    if(Number.isFinite(c.yaw))a.root.rotation.y=c.yaw;
    const dive=c.dive??0,stroke=t*6.1;
    a.body.rotation.x=Math.sin(stroke)*.044;
    a.body.rotation.z=Math.sin(stroke*.5)*.062;
    a.head.rotation.x=-.13*(1-dive);
    a.tail.rotation.y=Math.sin(stroke-.65)*.22;
    a.tail.rotation.x=Math.sin(stroke-.7)*.24;
    for(const {paddle,side,end} of a.paddles){
     paddle.rotation.x=Math.sin(stroke+end*.9+side*.6)*.34;
     paddle.rotation.y=side*Math.sin(stroke+end*.9)*.25;
    }
    continue;
   }
   if(d.egret){
    a.root.rotation.y=c.yaw??0;
    const phase=t%12;
    const strike=Math.max(0,Math.min(1,(phase-8.2)/.19,(9.25-phase)/.65));
    const waterAboveFoot=WATER_HEIGHT-a.root.position.y;
    const contactAngle=Math.acos(Math.max(-1,Math.min(1,(waterAboveFoot-.47)/Math.hypot(.291,.221))))-Math.atan2(.221,.291);
    a.neck.rotation.x=contactAngle*strike+Math.sin(t*1.4)*.027*(1-strike);
    a.neck.rotation.y=Math.sin(t*.7)*.13*(1-strike);
    continue;
   }
   if(d.turtle){
    for(const {foot,side,end} of a.feet){
     const step=Math.sin(a.gait+side*end*Math.PI/2);
     foot.rotation.y=step*.43*a.move;
     foot.position.y=.073+Math.max(0,step)*.018*a.move;
    }
    a.head.rotation.y=Math.sin(t*.9)*.16*(1-a.move);
    a.head.position.z=.14+Math.sin(t*1.7)*.012;
    continue;
   }
   if(d.fish){
    if(Number.isFinite(c.yaw))a.root.rotation.y=c.yaw;
    a.body.position.y=Math.sin(t*1.4)*.012;a.body.rotation.z=Math.sin(t*1.6)*.055;
    a.body.rotation.y=Math.sin(t*3.2)*.035;a.tail.rotation.y=Math.sin(t*3.2-.8)*(.24+a.move*.14);
    continue;
   }
   const rest=c.behavior==='resting',graze=c.behavior==='grazing'||c.behavior==='drinking',flying=d.bird&&c.behavior==='flying';
   a.body.position.y=ease(a.body.position.y,rest?d.height*.49:d.height+(flying?.23:0)+Math.cos(a.gait*2)*d.depth*.028*a.move);
   a.body.scaling.y=1+Math.sin(t*1.7)*.003;
   a.body.rotation.z=Math.sin(a.gait)*.016*a.move;
   a.head.rotation.x=ease(a.head.rotation.x,graze?(d.bird?.7:1.42)+Math.sin(t*2.3)*.035:rest?.25:Math.sin(t*.65)*.035);
   a.head.position.y=ease(a.head.position.y,d.depth*.23-(graze?(c.kind==='gazelle'?.30:c.kind==='goat'?.08:0):0));
   for(const ear of a.ears)ear.node.rotation.z=ease(ear.node.rotation.z,ear.base+ear.side*Math.max(0,Math.sin(t*2.1+ear.side)-.90)*.18);
   a.head.rotation.y=ease(a.head.rotation.y,c.headTurn??Math.sin(t*(d.cat?.8:.4))*(d.cat?.19:.07));
   a.head.rotation.z=ease(a.head.rotation.z,d.cat?Math.sin(t*.53)*.045:0);
   for(const leg of a.legs){const offset=d.bird?(leg.side>0?0:Math.PI):leg.end>0?(leg.side>0?0:Math.PI):(leg.side>0?Math.PI*.62:Math.PI*1.62);
    const step=Math.sin(a.gait+offset),pose=d.bird?{hip:step*.46*a.move,knee:Math.max(0,-step)*.52*a.move}:animalFootPose(a.gait+offset,leg.upper,leg.lower,a.move,leg.end);
    leg.hip.rotation.x=ease(leg.hip.rotation.x,rest?-1.02:pose.hip);
    leg.knee.rotation.x=ease(leg.knee.rotation.x,rest?1.82:pose.knee);
    leg.foot.rotation.x=-leg.hip.rotation.x-leg.knee.rotation.x;
   }
   a.tail.rotation.x=ease(a.tail.rotation.x,d.cat?(c.behavior==='petting'?-1.25:-.93):d.jackal?.32:d.bird?.2:0);
   for(let i=0;i<a.tailJoints.length;i++){const joint=a.tailJoints[i];joint.rotation.y=Math.sin(t*(d.cat?1.0:1.6)-i*.7)*.12;joint.rotation.x=d.cat?-.24+Math.sin(t*.8-i*.5)*.07:Math.sin(t*1.1-i*.6)*.035;}
   for(const {node,side}of a.wings){node.rotation.z=ease(node.rotation.z,side*(flying?1.05+Math.sin(t*7)*.45:.12));node.rotation.y=side*(flying?.28:.03+Math.sin(t*1.7)*.015);}
  }
  for(const [id,a]of actors)if(!seen.has(id)){remove(a);actors.delete(id);}
 }
 function dispose(){if(disposed)return;disposed=true;for(const a of actors.values())remove(a);actors.clear();for(const source of sources.values())source.dispose();for(const mat of materials.values())mat.dispose();for(const texture of coatTextures)texture.dispose();coatTextures.length=0;sources.clear();geometrySources.clear();materials.clear();}
 return {update,dispose,meshes,rootFor:selection=>actors.get(selection.animalId)?.root};
}
