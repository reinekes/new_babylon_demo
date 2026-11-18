import {footprintSize} from '../footprints.js';
import {fortificationLayout} from '../fortification-layout.js';
import {extractionWorkArea,isExtractionCourt} from '../extraction-courts.js';
import {riverAxis} from '../world.js';
import {workshopSurfaces} from './workshop-surfaces.js';

// Small fixed installations belong to a building template. They neither claim
// city stock nor occupy the point at which a resident performs their work.
function equipment(B,scene,palette){
 const groups=new Map();
 function add(mesh,finish){
  mesh.material=palette.material(finish);
  if(!groups.has(mesh.material))groups.set(mesh.material,[]);
  groups.get(mesh.material).push(mesh);return mesh;
 }
 function box(x,y,z,w,h,d,finish,angle=0){
  const mesh=B.MeshBuilder.CreateBox('work-piece',{width:w,height:h,depth:d},scene);
  mesh.position.set(x,y,z);mesh.rotation.y=angle;return add(mesh,finish);
 }
 function rod(a,b,r,finish,tip=.88){
  const start=new B.Vector3(...a),end=new B.Vector3(...b),direction=end.subtract(start);
  const mesh=B.MeshBuilder.CreateCylinder('work-pole',{height:direction.length(),diameterBottom:r*2,diameterTop:r*2*tip,tessellation:8},scene);
  mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,direction.normalize(),new B.Quaternion());
  return add(mesh,finish);
 }
 function lathe(x,y,z,profile,finish,scale=1,sides=14){
  const shape=profile.map(([r,h])=>new B.Vector3(r*scale,h*scale,0));
  const mesh=B.MeshBuilder.CreateLathe('work-vessel',{shape,tessellation:sides,sideOrientation:B.Mesh.FRONTSIDE},scene);
  mesh.position.set(x,y,z);return add(mesh,finish);
 }
 function loop(x,y,z,r,t,finish,vertical=false){
  const mesh=B.MeshBuilder.CreateTorus('work-binding',{diameter:r*2,thickness:t,tessellation:16},scene);
  mesh.position.set(x,y,z);if(vertical)mesh.rotation.x=Math.PI/2;return add(mesh,finish);
 }
 function panel(path,finish){
  const p=[],indices=[],uvs=[];
  for(const [a,b] of path){p.push(...a,...b);uvs.push(a[0]*1.25,a[1]+a[2],b[0]*1.25,b[1]+b[2]);}
  for(let i=0;i<path.length-1;i++){const j=i*2;indices.push(j,j+1,j+2,j+2,j+1,j+3,j+2,j+1,j,j+3,j+1,j+2);}
  // Duplicated backs have independent outward normals to light both faces.
  const verts=[],uv=[],idx=[],normals=[];for(const n of indices){verts.push(p[n*3],p[n*3+1],p[n*3+2]);uv.push(uvs[n*2],uvs[n*2+1]);idx.push(idx.length);}
  B.VertexData.ComputeNormals(verts,idx,normals);const data=new B.VertexData();
  Object.assign(data,{positions:verts,indices:idx,normals,uvs:uv});
  const mesh=new B.Mesh('work-hanging',scene);data.applyToMesh(mesh);add(mesh,finish);
 }
 function rack(x,z,width,height,base=.05){
  for(const side of [-1,1]){
   const px=x+side*width/2;
   rod([px-.10*side,base,z+.13],[px,base+height+.08,z],.047,'wood');
   rod([px,base+height*.67,z+.04],[px+side*.10,base,z-.32],.036,'wood');
  }
  rod([x-width/2-.075,base+height,z],[x+width/2+.075,base+height-.02,z],.048,'wood');
 }
 function vessel(x,y,z,kind,s=1,finish='pottery'){
  const shapes={
   bowl:[[.12,.012],[.18,.035],[.33,.23],[.34,.27],[.30,.28],[.15,.085],[0,.065]],
   jar:[[.14,0],[.22,.03],[.36,.32],[.34,.55],[.20,.66],[.15,.69],[.16,.77],[.13,.78],[.12,.72],[.14,.63],[0,.52]],
   bin:[[.19,0],[.30,.07],[.42,.52],[.435,.61],[.39,.61],[.32,.29],[0,.16]],
   trough:[[.12,0],[.29,.05],[.36,.20],[.35,.25],[.27,.23],[.15,.10],[0,.08]],
  };
  return lathe(x,y,z,shapes[kind],finish,s);
 }
 function screen(x,z,w,h,finish='reed',base=.05){
  rack(x,z,w,h,base);
  const path=[];
  for(let i=0;i<=9;i++){
   const dx=w*(i/9-.5),fold=.026*Math.sin(i*1.85);
   path.push([[x+dx,base+h-.025,z+fold],[x+dx,base+.19+.065*Math.cos(i*.76),z+.12+fold]]);
  }
  panel(path,finish);
 }
 function hurdle(x,z,w,h){
  rack(x,z,w,h);
  for(let i=1;i<=5;i++)rod([x-w/2,.10+h*i/7,z],[x+w/2,.12+h*i/7,z],.023,'reed');
  for(let i=1;i<=6;i++)rod([x-w/2+w*i/7,.08,z-.027],[x-w/2+w*i/7,.07+h,z+.027],.019,'reed');
 }
 function coil(x,y,z,r){
  for(let i=0;i<3;i++)loop(x+i*.007,y+.020+i*.027,z-i*.009,r-i*.022,.031,'reed');
 }
 function mortar(x,y,z,s){
  vessel(x,y,z,'trough',s,'stone');
  rod([x+.035,y+s*.14,z],[x+s*.23,y+s*.51,z-.05],s*.060,'stone');
 }
 function finish(root,type){
  const result=[];
  for(const [material,parts] of groups){
   const mesh=parts.length===1?parts[0]:B.Mesh.MergeMeshes(parts,true,true);
   mesh.name='workshop-'+type+'-'+material.name;mesh.material=material;mesh.parent=root;
   mesh.metadata={...mesh.metadata,workshopDetail:type};result.push(mesh);
  }
  return result;
 }
 return {box,rod,loop,lathe,vessel,panel,rack,screen,hurdle,coil,mortar,finish};
}

function extractionEquipment(b,state,e){
 const {box,rod,vessel,screen,rack,hurdle,loop}=e;
 const a=isExtractionCourt(b)?extractionWorkArea(b,state):{x:0,z:0};
 const x=a.x,z=a.z;
 switch(b.type){
  case 'clay':
   // Timber mould laid across a raised settling tray, open at the top.
   for(const side of [-1,1])box(x+.65,.28,z+side*.31,1.20,.23,.07,'wood');
   for(const offset of [-.56,0,.56])box(x+.65+offset,.28,z,.07,.23,.62,'wood');
   vessel(x+.88,.06,z+.75,'bowl',.65);break;
  case 'quarry':
   // Drag sledge with runners, cross-ties and stone load.
   for(const side of [-1,1])rod([x+.36,.13,z-.85+side*.34],[x+1.55,.14,z-.85+side*.34],.075,'wood');
   for(const dx of [.51,.92,1.32])box(x+dx,.23,z-.85,.16,.12,.91,'wood');
   box(x+.89,.48,z-.85,.82,.39,.62,'stone',.10);break;
  case 'reed':
   rack(x-.25,z-.66,1.60,1.28);
   for(let i=0;i<19;i++){
    const u=i/18;rod([x-.98+u*1.46,.12,z-.39],[x-.95+u*1.42,1.24+.21*Math.sin(i*.94),z-.68],.022,'reed');
   }break;
  case 'logging':
   for(const dx of [-.52,.52])for(const s of [-1,1])rod([x+dx,.07,z+.66+s*.34],[x+dx,.70,z+.66-s*.15],.06,'wood');
   rod([x-1.08,.64,z+.66],[x+1.16,.64,z+.66],.15,'wood');break;
  case 'hunting':
   screen(x-.22,z-.90,1.35,1.24,'cloth');
   vessel(x+.85,.05,z-.50,'bin',.72,'reed');break;
  case 'garden':
   hurdle(x-.28,z-.92,1.65,.85);
   for(const dx of [-.66,.04,.76])vessel(x+dx,.06,z-.38,'bowl',.61,'earth');
   break;
 }
}

function furnishings(b,state,e){
 const {box,rod,loop,lathe,vessel,panel,rack,screen,hurdle,coil,mortar}=e;
 const hearth=(x,z,scale)=>{
  vessel(x,.055,z,'trough',scale,'fired');
  for(let i=0;i<3;i++)rod([x-.22*scale,.15*scale,z+(i-1)*.10],[x+.19*scale,.17*scale,z+(i-1)*.10+.03],.045*scale,'char');
 };
 switch(b.type){
  case 'pottery':
   rack(.05,.84,1.20,1.33);
   box(.05,.78,.84,1.31,.075,.48,'wood');
   for(let i=0;i<3;i++)vessel(-.37+i*.39,.82,.84,'bowl',.52+i*.04);break;
  case 'bakery':
   mortar(1.56,.055,1.69,1.15);
   rod([1.06,.13,.69],[1.28,.20,1.56],.035,'wood');
   box(1.02,.14,.63,.32,.045,.38,'wood',.24);break;
  case 'brewery':
   // Suspended mash strainer and the receiving vessel underneath.
   rack(.85,1.82,1.0,1.43);vessel(.85,.06,1.82,'jar',.92);
   vessel(.85,.88,1.82,'bin',.60,'reed');
   for(const dx of [-.2,.2])rod([.85+dx,1.18,1.82],[.85+dx*.54,1.49,1.82],.017,'reed');break;
  case 'coppersmith':
   hearth(-1.81,1.85,1.20);
   vessel(-1.12,.07,1.81,'bowl',.64,'fired');
   for(let i=0;i<3;i++)box(-1.10+i*.14,.16,1.85,.096,.078,.35,'copper',i*.1);break;
  case 'kiln':
   // A stepped stack of unfired ware waits on the dry side of the kiln.
   for(let i=0;i<5;i++)vessel(1.28+(i%3)*.43,.055+Math.floor(i/3)*.24,-1.28+Math.floor(i/3)*.18,'bowl',.72,'raw');break;
  case 'brickyard':
   for(const dz of [-.31,.31])box(.72,.18,1.97+dz,1.40,.22,.08,'wood');
   for(const dx of [-.66,-.22,.22,.66])box(.72+dx,.18,1.97,.065,.22,.63,'wood');
   vessel(-.25,.055,2.03,'bowl',.74,'earth');break;
  case 'joineryYard':
   // Split trunk on two trestles with a rough-sawn board alongside.
   for(const x of [-.82,.33])for(const s of [-1,1])rod([x,.06,1.78+s*.26],[x,.62,1.78-s*.13],.053,'wood');
   rod([-1.22,.63,1.80],[.81,.67,1.78],.125,'wood');
   box(-.19,.76,1.76,1.75,.055,.21,'wood',.025);break;
  case 'basketry':
   for(let i=0;i<12;i++){
    const a=i*Math.PI/6;rod([-.73+.17*Math.cos(a),.11,1.88+.17*Math.sin(a)],[-.73+.39*Math.cos(a),.87+.08*Math.sin(i),1.88+.39*Math.sin(a)],.022,'reed');
   }for(const [y,r] of [[.24,.21],[.31,.24],[.38,.26],[.45,.27]])loop(-.73,y,1.88,r,.042,'reed');break;
  case 'matYard':
   for(let i=0;i<3;i++){const y=.19+(i===2?.19:0),z=1.90+(i%2)*.27;
    rod([-1.50,y,z],[-.06,y,z],.135,'reed',1);for(const x of [-1.28,-.27])box(x,y,z,.027,.27,.27,'cloth');}break;
  case 'weaver':
   for(let i=0;i<5;i++){const x=-.33+i*.17;rod([x,1.38,.98],[x+.035,.47,.97],.012,'cloth');lathe(x+.035,.32,.97,[[.028,0],[.083,.055],[.068,.13],[.023,.16]],'raw',1,8);}
   rack(.01,.98,.96,1.33);break;
  case 'linenYard':
   rack(.12,1.83,2.22,1.66);
   for(let i=0;i<5;i++){
    const x=-.9+i*.44;panel([[[x,1.68,1.83],[x-.04,.42+.05*Math.cos(i),1.95]],[[x+.16,1.72,1.80],[x+.19,.35,1.91]],[[x+.32,1.66,1.84],[x+.30,.43,1.93]]],'cloth');
   }break;
  case 'tailor':
   for(const dx of [-.43,.43])rod([-.77+dx,.07,1.90],[-.77+dx,1.36,1.90],.044,'wood');
   for(const y of [.39,1.31])rod([-1.32,y,1.90],[-.20,y,1.90],.037,'wood');
   panel([[[-1.14,1.30,1.90],[-1.12,.39,1.90]],[[-.83,1.26,1.93],[-.81,.42,1.92]],[[-.40,1.30,1.90],[-.42,.39,1.90]]],'cloth');break;
  case 'dairyStore':
   rack(.10,1.84,1.32,1.45);
   for(const dx of [-.30,.28]){const x=.10+dx;vessel(x,.06,1.84,'bowl',.65);vessel(x,.81,1.84,'bin',.46,'cloth');rod([x,.99,1.84],[x,1.50,1.84],.018,'reed');}
   break;
  case 'cowshed':
   // Raised feed crib at the inner rear edge of the pen.
   for(const x of [-1.74,-.56])for(const z of [-1.86,-1.42])rod([x,.05,z],[x,.77,z],.055,'wood');
   for(const z of [-1.86,-1.42])for(const h of [.28,.61])rod([ -1.84,h,z],[-.46,h,z],.043,'wood');
   for(let i=0;i<12;i++)rod([-1.65+i*.096,.31,-1.83],[-1.62+i*.096,.78+.10*Math.sin(i),-1.52],.025,'reed');break;
  case 'sheepfold':
   hurdle(.10,-1.75,1.62,.91);
   vessel(1.28,.055,-1.52,'trough',1.12,'stone');break;
  case 'granary':
   vessel(1.72,.055,1.58,'bin',1.46,'reed');
   for(const y of [.24,.68,.86])loop(1.72,y,1.58,y>.4?.59:.44,.045,'reed');
   vessel(.89,.055,2.06,'bowl',.70,'wood');break;
  case 'depot':
   // Lashing passes over the lid of a sealed storage jar.
   for(const [x,z,s] of [[-.81,1.58,1.28],[-.24,2.12,.85]]){
    vessel(x,.055,z,'jar',s);box(x,.055+s*.766,z,s*.32,.046,s*.31,'raw',.08);loop(x,.055+s*.68,z,s*.16,.026,'reed');}break;
  case 'waterpoint':
   rack(.03,1.46,1.15,1.60);rod([-.37,1.62,1.46],[-.37,.52,1.46],.021,'reed');
   vessel(-.37,.28,1.46,'bowl',.77,'pottery');coil(.61,.07,1.54,.23);break;
  case 'fishing':
   // Tapered, open wicker fish trap. Hoops and longitudinal rods enclose it.
   for(const dx of [-.61,-.28,.04,.34,.56]){
    const r=.28*(1-(dx+.61)*.57);loop(dx+.65,.38,1.82,r,.035,'reed',true).rotation.y=Math.PI/2;
   }
   for(let i=0;i<9;i++){const a=i*2*Math.PI/9;rod([.04,.38+.28*Math.sin(a),1.82+.28*Math.cos(a)],[1.22,.38+.09*Math.sin(a),1.82+.09*Math.cos(a)],.018,'reed');}
   break;
  case 'harbor':
   for(const [x,z] of [[-2.16,1.31],[2.18,-1.41]]){
    rod([x,.39,z],[x+.03,1.14,z],.14,'wood');coil(x,.97,z,.17);coil(x+.38,.46,z+.05,.24);
   }break;
  case 'healer':
   screen(.73,1.68,1.36,1.22,'reed');
   mortar(-.51,.06,1.66,.95);vessel(-1.09,.06,1.80,'bowl',.56);break;
  case 'market':{
   const k=(footprintSize(b)-1)*3;
   rack(k-.58,k+2.03,1.82,1.72);
   panel([[[k-1.36,1.76,k+2.03],[k-1.36,1.56,k+2.40]],[[k-.67,1.73,k+2.02],[k-.67,1.48,k+2.44]],[[k+.19,1.74,k+2.04],[k+.19,1.53,k+2.41]]],'cloth');
   for(const x of [-.99,-.42,.16])vessel(k+x,.07,k+2.19,'bin',.63,'reed');break;
  }
  case 'musicHouse':
   // A resting frame drum and a second hide awaiting tensioning.
   rack(-1.53,.81,.95,1.10);loop(-1.53,.72,.80,.31,.072,'wood',true);
   rod([-1.53,.72,.76],[-1.53,.72,.80],.29,'cloth',1);
   loop(-.94,.43,.84,.23,.046,'wood',true);break;
  case 'shrine':
   vessel(-1.57,.07,1.94,'trough',1.24,'stone');
   vessel(-1.57,.36,1.94,'bowl',.60);break;
  case 'ziggurat':{
   const large=footprintSize(b)===2,x=large?5.25:1.72,z=large?7.55:2.16;
   for(const dx of [-.30,.30]){box(x+dx,.16,z,.46,.3,.47,'raw');vessel(x+dx,.31,z,'bowl',.79,'pottery');}break;
  }
  case 'ishtarGate':{
   const size=footprintSize(b),c=(size-1)*3;
   for(const sign of [-1,1]){const x=c+sign*(size===3?5.9:size===2?3.0:1.86),z=c+1.55;
    box(x,.15,z,.57,.29,.65,'raw');vessel(x,.3,z,'bin',.91,'fired');}break;
  }
  case 'watchHouse':
   rack(-1.49,1.73,1.10,1.57);
   for(let i=0;i<3;i++)rod([-1.88+i*.30,.05,1.88],[-1.78+i*.30,1.83+.06*i,1.70],.039,'wood');
   vessel(-.63,.06,1.98,'jar',.72);break;
  case 'cityGate':{
   const c=(footprintSize(b)-1)*3,s=footprintSize(b)===2?2.29:1.62;
   for(const sign of [-1,1]){
    const z=c+sign*s;rod([c+1.80,.04,z],[c+1.80,.59,z],.10,'wood');coil(c+1.80,.38,z,.105);
   }break;
  }
  case 'cityWall':
   // Small rain spout through a masonry segment, oriented by the actual wall.
   {const part=fortificationLayout(b,state)[0],across=part.w>part.d;
    for(const offset of [-.084,.084]){
     box(part.x+(across?offset:part.w*.5),part.bottom+part.h-.22,part.z+(across?part.d*.5:offset),across?.045:.49,.15,across?.49:.045,'fired');
    }
    box(part.x+(across?0:part.w*.5),part.bottom+part.h-.3,part.z+(across?part.d*.5:0),across?.2:.49,.06,across?.49:.2,'fired');}break;
  case 'levee':{
   const alongX=riverAxis(state)==='x',reverse=(b.rotation||0)%2===1;
   const point=(u,h,v)=>alongX!==reverse?[u,h,v]:[v,h,u];
   for(const u of [-1.36,-.51,.38,1.19])rod(point(u,.16,1.12),point(u,.55,1.08),.042,'wood');
   for(const v of [1.10,1.16,1.22])rod(point(-1.63,.29,v),point(1.43,.30,v+.02),.046,'reed');
   break;
  }
  case 'clay':case 'quarry':case 'logging':case 'reed':case 'garden':case 'hunting':
   extractionEquipment(b,state,e);break;
 }
}

export function applyWorkshopArchitecture(B,scene,b,state,base,sources,root){
 if(b.type==='house'||b.reedCamp||b.construction?.kind==='new')return;
 const palette=workshopSurfaces(B,scene);
 const roles=new Map([[base.plaster,'plaster'],[base.raw,'raw'],[base.fired,'fired'],[base.trim,'trim'],[base.terracotta,'pottery'],
  [base.wood,'wood'],[base.linen,'cloth'],[base.reed,'reed'],[base.stone,'stone'],[base.soil,'earth']]);
 for(const mesh of sources){
  const role=roles.get(mesh.material);
  if(role&&mesh.material)mesh.material=palette.material(role);
 }
 const tools=equipment(B,scene,palette);
 furnishings(b,state,tools);
 for(const detail of tools.finish(root,b.type)){
  // Common props and a static wall can share their existing instanced draw.
  // Imported originals and moving workstations keep their individual transforms.
  const index=sources.findIndex(mesh=>mesh.material===detail.material&&
   (mesh.name.startsWith('original-')||mesh.name.startsWith('music-courtyard-'))&&
   !mesh.metadata?.potterWheel&&!mesh.metadata?.formingClay);
  if(index<0){sources.push(detail);continue;}
  const original=sources[index],name=original.name,metadata=original.metadata;
  const merged=B.Mesh.MergeMeshes([original,detail],true,true);
  merged.name=name;merged.parent=root;merged.metadata={...metadata,workshopDetail:b.type};
  sources[index]=merged;
 }
}
