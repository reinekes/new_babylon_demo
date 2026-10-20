import {constructionProgress} from '../construction.js';
import {bridgeSpan} from '../world.js';
// Original procedural adobe architecture. All vertices are local to one 6 m tile.
// Archaeological forms are a stylisation, not reconstructions of specific excavated houses.
const materialCache = new WeakMap();
const occupancyCache = new WeakMap();
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const hash = (x,y)=>{const v=Math.sin(x*127.1+y*311.7)*43758.5453;return v-Math.floor(v);};

// Quantised signature lets the integration rebuild at visible crop changes, not every frame.
export function districtCropVisual(b) {
 const c=b.crop||{},sown=clamp(c.sown||0,0,1),growth=clamp(c.growth||0,0,1);
 const standing=sown<=0?0:c.total>0?clamp((c.remaining||0)/c.total,0,1):c.harvested>0||c.spoiled>0?0:1;
 const sheaves=Math.max(0,c.sheaves||0),stage=sown<=0?'empty':standing<=0?'harvested':growth<=0?'sown':growth<.95?'growing':'ripe';
 return {sown,growth,standing,sheaves,stage,signature:[c.year||0,stage,Math.ceil(sown*5),Math.ceil(growth*6),Math.ceil(standing*6),Math.ceil(sheaves/14)].join(':')};
}

export function districtBuildingPlan(b) {
 const height=2.2+(clamp(b.level||1,1,3)-1)*.32;
 const q=b.construction,construction=!!q&&q.kind!=='upgrade';
 const progress=q?clamp(constructionProgress(b).ratio,0,1):1;
 return {position:[b.x*6,0,b.y*6],height,wallHeight:construction?.25+progress*(height-.25):height,footprint:5.5,doorWidth:.9,variant:Math.floor(hash(b.x,b.y)*4),construction,upgrading:q?.kind==='upgrade',progress};
}

// One shared pass for all homes, at most once per simulation second. No per-home frame scan.
export function districtHomeOccupancy(s) {
 if(s.districtOccupancy instanceof Map)return s.districtOccupancy;
 const stamp=`${s.tick}:${Math.floor(s.simTime||0)}:${s.citizens?.length||0}`;
 let entry=occupancyCache.get(s);
 if(!entry||entry.stamp!==stamp){
  const counts=new Map();for(const c of s.citizens||[])if(c.home!=null)counts.set(c.home,(counts.get(c.home)||0)+1);
  entry={stamp,counts};occupancyCache.set(s,entry);
 }
 return entry.counts;
}

function supplements(B,scene) {
 let mats=materialCache.get(scene);if(mats)return mats;
 const make=(name,color,emission)=>{
  const m=new B.PBRMaterial(`district-${name}`,scene);m.albedoColor=B.Color3.FromHexString(color);m.metallic=0;m.roughness=.97;
  if(emission)m.emissiveColor=B.Color3.FromHexString(emission);return m;
 };
 mats={dark:make('interior','#51483b'),edge:make('adobe-edge','#ac9678'),straw:make('dry-straw','#aa9a66'),glow:make('occupied-lamp','#b59257','#ce9a4c'),leaf:make('olive-foliage','#777653'),silt:make('wet-silt','#88775e')};
 // Four shared plaster finishes: variation without creating a material for every house.
 mats.plasters=['#fff0dc','#e6d3b4','#f5ddba','#d6c09e'].map((color,i)=>{
  const m=make(`plaster-finish-${i}`,color);m.albedoColor.scaleInPlace(2.1);return m;
 });
 materialCache.set(scene,mats);return mats;
}

export function createDistrictBuilding(B,scene,b,materials) {
 const plan=districtBuildingPlan(b), extra=supplements(B,scene),m={...extra,...materials};
 const finish=extra.plasters[plan.variant];
 if(!finish.albedoTexture){finish.albedoTexture=materials.plaster?.albedoTexture;finish.bumpTexture=materials.plaster?.bumpTexture;}
 m.plaster=finish;
 if(!extra.silt.albedoTexture){extra.silt.albedoTexture=materials.soil?.albedoTexture;extra.silt.bumpTexture=materials.soil?.bumpTexture;}
 const root=new B.TransformNode(`building-${b.id||`${b.x},${b.y}`}`,scene);
 root.metadata={buildingKey:b.id||`${b.x},${b.y}`,type:b.type};
 const groups=new Map();let serial=0;const lights=[];
 const add=(mesh,mat)=>{mesh.material=typeof mat==='string'?m[mat]:mat;const material=mesh.material||m.plaster;if(!groups.has(material))groups.set(material,[]);groups.get(material).push(mesh);return mesh;};
 const box=(x,y,z,w,h,d,mat='plaster',angle=0)=>{
  const mesh=B.MeshBuilder.CreateBox(`part${serial++}`,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.rotation.y=angle;return add(mesh,mat);
 };
 const cyl=(x,y,z,r,h,mat='wood',top=r)=>{
  const mesh=B.MeshBuilder.CreateCylinder(`part${serial++}`,{height:h,diameterBottom:r*2,diameterTop:top*2,tessellation:10},scene);mesh.position.set(x,y,z);return add(mesh,mat);
 };
 const beam=(a,c,r=.055,mat='wood')=>{
  const start=new B.Vector3(...a),end=new B.Vector3(...c),delta=end.subtract(start);
  const mesh=B.MeshBuilder.CreateCylinder(`part${serial++}`,{height:delta.length(),diameter:r*2,tessellation:7},scene);
  mesh.position=start.add(end).scale(.5);mesh.rotationQuaternion=B.Quaternion.FromUnitVectorsToRef(B.Axis.Y,delta.normalize(),new B.Quaternion());return add(mesh,mat);
 };
 const pot=(x,z,size=.6,y=0)=>{
  const shape=[[0,0],[.17,.02],[.28,.18],[.3,.43],[.22,.63],[.14,.7],[.14,.78],[.18,.79],[.18,.84],[.12,.84],[.11,.74],[.16,.67],[.22,.43],[.18,.18],[.08,.08],[0,.08]].map(([r,h])=>new B.Vector3(r*size,h*size,0));
  const mesh=B.MeshBuilder.CreateLathe(`vessel${serial++}`,{shape,tessellation:12,sideOrientation:B.Mesh.DOUBLESIDE},scene);mesh.position.set(x,y,z);add(mesh,'terracotta');
 };
 const mat=(x,z,w=1.2,d=.8,y=.055)=>{
  box(x,y,z,w,.035,d,'reed');for(let i=0;i<Math.floor(w/.13);i++)box(x-w/2+i*.13,y+.022,z,.024,.014,d*.94,'straw');
  box(x,y+.025,z-d*.43,w*.96,.017,.04,'wood');box(x,y+.025,z+d*.43,w*.96,.017,.04,'wood');
 };
 const awning=(x,z,w=2,d=1.6,y=1.85)=>{
  for(const dx of [-1,1])for(const dz of [-1,1])cyl(x+dx*(w/2-.09),y/2,z+dz*(d/2-.09),.055,y,'wood');
  for(let i=0;i<9;i++){
   const px=x-w/2+w/9*(i+.5),mesh=box(px,y-.07*Math.sin(i/8*Math.PI),z,w/9+.018,.055,d,'linen');mesh.rotation.z=-.09*Math.cos(i/8*Math.PI);
  }
  beam([x-w/2,y,z-d/2],[x+w/2,y,z-d/2]);beam([x-w/2,y,z+d/2],[x+w/2,y,z+d/2]);
 };
 const ladder=(x,z,height)=>{
  beam([x-.23,.08,z+.48],[x-.23,height+.25,z]);beam([x+.23,.08,z+.48],[x+.23,height+.25,z]);
  for(let i=0;i<9;i++){const t=(i+1)/10;beam([x-.26,height*t,z+.48*(1-t)],[x+.26,height*t,z+.48*(1-t)],.035);}
 };
 const lamp=(x,y,z)=>{
  // A material switch, never a per-building point light.
  const mesh=B.MeshBuilder.CreateBox(`home-lamp${serial++}`,{width:.28,height:.24,depth:.025},scene);mesh.position.set(x,y,z);mesh.parent=root;mesh.material=m.dark;lights.push(mesh);
  box(x,y+.15,z,.43,.08,.22,'wood');box(x,y-.15,z,.43,.08,.22,'wood');
 };
 const room=(x,z,w,d,h=plan.height,door=true)=>{
  const t=.25;
  box(x,.065,z,w,.13,d,'brick');box(x,h/2,z-d/2+t/2,w,h,t);
  box(x-w/2+t/2,h/2,z,t,h,d);box(x+w/2-t/2,h/2,z,t,h,d);
  if(door){
   const dw=plan.doorWidth,dh=1.6,side=(w-dw)/2;
   box(x-(dw+side)/2,h/2,z+d/2-t/2,side,h,t);box(x+(dw+side)/2,h/2,z+d/2-t/2,side,h,t);
   box(x,dh+(h-dh)/2,z+d/2-t/2,dw,h-dh,t);box(x,dh+.035,z+d/2,dw+.24,.12,t+.14,'wood');
   box(x,.075,z+d/2,.98,.15,.5,'stone');
   // Door is set back, leaving the thickness of the wall visible.
   box(x,.76,z+d/2-.24,.69,1.45,.075,'wood');
   for(let i=0;i<4;i++)box(x-.25+i*.17,.77,z+d/2-.196,.018,1.35,.012,'dark');
  }else box(x,h/2,z+d/2-t/2,w,h,t);
  box(x,h+.075,z,w+.08,.15,d+.08,'soil');
  for(let i=0;i<Math.ceil(w/.6);i++)beam([x-w/2+i*.6+.12,h-.03,z-d/2-.16],[x-w/2+i*.6+.12,h-.03,z+d/2+.16],.068);
  box(x,h+.27,z-d/2,w+.08,.33,.19);box(x,h+.27,z+d/2,w+.08,.33,.19);
  box(x-w/2,h+.27,z,.19,.33,d);box(x+w/2,h+.27,z,.19,.33,d);
  // Raised, irregular repair patches suggest hand plastering, kept tonal.
  for(let i=0;i<3;i++)box(x-w*.38+i*w*.35,.32+i*.14,z+d/2+.004,.22,.11,.018,'edge');
 };
 const courtyard=()=>{
  box(0,.025,0,5.3,.05,5.2,'soil');
  room(0,-1.65,5.05,1.65);
  room(-1.8,.23,1.46,2.4,plan.height-.16);
  box(.95,.4,2.44,3.15,.8,.24);box(2.45,.4,.83,.24,.8,3.45);
  // Courtyard gate is an opening; no solid box fills the perimeter.
  box(-2.1,.4,2.44,.8,.8,.24);box(-1.65,.58,2.44,.16,1.16,.28);
  box(-.88,.58,2.44,.16,1.16,.28);
  mat(.6,.6,1.7,1.1);pot(1.9,1.85,.8);pot(1.43,1.95,.54);pot(-.65,-.55,.6);
  awning(.8,-.12,2.3,1.35,1.92);ladder(-2.26,1.3,plan.height);
  box(-1.75,.27,1.65,.95,.34,.45,'brick');mat(-1.75,1.65,.9,.42,.45);
  mat(.4,-1.65,1.5,.72,plan.height+.17);pot(1.5,-1.5,.6,plan.height+.16);
  if(plan.variant%2)pot(-1.6,-1.45,.55,plan.height+.16);
  if(plan.variant>=2){box(2.52,.72,1.35,.06,.5,.8,'reed');box(.6,.07,1.5,.68,.08,.63,'stone');}
  if((b.level||1)>1){room(-1.68,-1.62,1.58,1.55,plan.height+.85,false);ladder(-.65,-1.46,plan.height+.85);}
  lamp(.8,1.45,-.804);
 };
 const kiln=(x,z,size=1)=>{
  cyl(x,.58*size,z,.64*size,1.16*size,'brick',.49*size);
  cyl(x,1.19*size,z,.5*size,.14*size,'terracotta',.36*size);
  box(x,.31*size,z+.61*size,.36*size,.5*size,.025,'dark');
  for(let k=0;k<3;k++)cyl(x,(.18+k*.28)*size,z,.65*size,.035*size,'edge');
  cyl(x+.35*size,1.46*size,z-.26*size,.13*size,.62*size,'brick');
 };
 const sacks=(x,z,count=4)=>{
  for(let i=0;i<count;i++){
   const xx=x+i%2*.43,zz=z+Math.floor(i/2)*.46;
   const mesh=B.MeshBuilder.CreateSphere(`grain-sack${serial++}`,{diameter:1,segments:6},scene);mesh.scaling.set(.42,.56,.38);mesh.position.set(xx,.3,zz);add(mesh,'reed');cyl(xx,.59,zz,.09,.12,'linen',.055);
  }
 };
 const fence=(x,z,w,d)=>{
  for(const dz of [-d/2,d/2]){for(let i=0;i<=Math.ceil(w/.65);i++)cyl(x-w/2+i*w/Math.ceil(w/.65),.57,z+dz,.05,1.14);for(const y of [.35,.82])beam([x-w/2,y,z+dz],[x+w/2,y,z+dz],.045,'reed');}
  for(const dx of [-w/2,w/2]){for(let i=1;i<Math.ceil(d/.65);i++)cyl(x+dx,.57,z-d/2+i*d/Math.ceil(d/.65),.05,1.14);for(const y of [.35,.82])beam([x+dx,y,z-d/2],[x+dx,y,z+d/2],.045,'reed');}
 };
 const workshop=()=>{
  box(0,.025,0,5.3,.05,5.2,'soil');room(-.3,-1.65,4.5,1.65);
  box(-2.45,.4,.8,.25,.8,3.3);box(0,.32,2.43,5.1,.64,.24);box(2.45,.4,.8,.25,.8,3.3);
  awning(-.6,.55,2.7,1.8,1.85);ladder(-2.12,.6,plan.height);mat(-.4,.5,1.7,1.15);
 };
 const field=()=>{
  const visual=districtCropVisual(b);
  box(0,.02,0,5.35,.09,5.35,'silt');
  const h=.08+visual.growth*.75;
  for(let row=0;row<8;row++){
   box(-2.2+row*.62,.09,0,.29,.14,5.02,'silt');
   for(let i=0;i<13;i++){
    // Fixed positions keep crop loss stable between quantised harvest stages.
    if((row*13+i+.5)/104>visual.sown*visual.standing)continue;
    const x=-2.2+row*.62+(hash(row+i,b.x)*.1),z=-2.3+i*.37;
    beam([x,.16,z],[x+.06,h+.14,z+.035],.018,visual.growth>.7?'straw':'grass');
    const leaf=box(x+.07,.16+h*.6,z,.22,.022,.055,'grass',.3);leaf.rotation.z=.6;
    if(visual.growth>.65){const ear=box(x+.06,h+.14,z+.035,.075,.18,.06,'straw');ear.rotation.z=-.18;}
   }
  }
  for(let n=0;n<Math.min(6,Math.ceil(visual.sheaves/14));n++){
   const x=1.3+(n%2)*.45,z=1.15+Math.floor(n/2)*.46;
   for(let j=0;j<5;j++)beam([x-.13+j*.065,.09,z-.3],[x-.1+j*.05,.32,z+.3],.027,'straw');
   box(x,.24,z,.35,.04,.07,'reed');
  }
 };

 if(plan.construction){
  box(0,.06,0,5.3,.12,5.2,'brick');
  const h=plan.wallHeight;box(0,h/2,-2.35,4.9,h,.35,'brick');box(-2.28,h/2,0,.35,h,4.8,'brick');box(2.28,h/2,0,.35,h,4.8,'brick');
  for(let i=0;i<8;i++)box(-1.7+i%4*.48,.18+Math.floor(i/4)*.19,1.4,.42,.18,.62,'brick');
  for(let x=-2.5;x<=2.5;x+=1.25){cyl(x,1.55,-2.6,.055,3.1);beam([x,2.5,-2.6],[x,2.5,-1.9],.045);}
  beam([-2.5,1.6,-2.6],[2.5,1.6,-2.6],.05);ladder(1.8,.5,2.6);pot(-1,0,.8);
 }else switch(b.type){
  case 'house':courtyard();break;
  case 'pottery':
   workshop();kiln(1.55,.7,.92);box(-.7,.75,.75,1.65,.15,.7,'wood');
   for(let i=0;i<5;i++)pot(-1.25+i*.3,.75,.43,.83);
   for(let i=0;i<7;i++)pot(-1.8+i*.56,1.85,.55+(i%2)*.2);pot(.8,-1.5,.9,plan.height+.17);break;
  case 'weaver':case 'tailor':
   workshop();
   for(const x of [-1.3,.1])beam([x,.1,.4],[x,1.6,-.03],.06);
   beam([-1.3,1.6,-.03],[.1,1.6,-.03],.065);beam([-1.3,.3,.33],[.1,.3,.33],.05);
   for(let i=0;i<13;i++)beam([-1.23+i*.1,.32,.32],[-1.23+i*.1,1.55,-.02],.012,'linen');
   box(-.6,.68,.2,1.22,.53,.04,'linen');sacks(1.1,.6,4);mat(.4,1.8,2,.65);pot(-1.8,1.5,.7);break;
  case 'shrine':
   box(0,.17,0,5.25,.34,5.25,'brick');box(0,.41,-.65,4.4,.15,3.6,'stone');room(0,-.9,3.7,2.9,3.1);
   for(let i=0;i<3;i++)box(0,.09+i*.12,2.35-i*.4,1.9,.18,.8,'brick');
   for(const x of [-1.3,1.3]){box(x,1.52,.63,.3,2.7,.4,'brick');for(let i=0;i<4;i++)box(x,1.3+i*.38,.86,.32,.08,.06,'edge');}
   box(0,.67,1.1,1.15,.6,.55,'stone');pot(-.88,1.2,.7);pot(.9,1.1,.58);break;
  case 'granary':case 'depot':
   box(0,.11,0,5.2,.22,5,'brick');room(0,-1.1,4.9,2.65,2.65);
   for(const x of [-2,-1,1,2])box(x,1.35,.27,.2,2.7,.42,'brick');
   awning(.1,1.35,3.9,1.65,2.05);sacks(-1.2,.8,8);pot(1.55,1.5,1.1);pot(1.95,.85,.8);ladder(-2.25,.9,2.65);break;
  case 'brickyard':
   box(0,.04,0,5.3,.08,5.3,'soil');room(-1.35,-1.7,2.4,1.55,1.75);awning(-1.35,-.12,2.1,1.4,1.68);
   box(-1.35,.15,.2,1.5,.22,.9,'silt');pot(-2.2,1.9,.9);
   for(let row=0;row<4;row++)for(let i=0;i<5;i++)box(-.45+i*.56,.13,.3+row*.52,.45,.2,.33,'brick');
   for(let i=0;i<6;i++)box(.8+i%3*.52,.15+Math.floor(i/3)*.24,-1.85,.48,.22,.8,'brick');break;
  case 'kiln':
   box(0,.04,0,5.2,.08,5.2,'soil');kiln(-.8,-.6,1.7);awning(1.55,.1,1.7,2.6,1.8);
   for(let i=0;i<12;i++)box(.95+i%3*.4,.15+Math.floor(i/6)*.22,1.5+Math.floor(i%6/3)*.45,.37,.21,.4,'brick');break;
  case 'sheepfold':
   box(0,.02,0,5.3,.04,5.3,'soil');fence(0,0,5.1,5.1);awning(-1.1,-1.4,2.65,1.85,1.7);
   box(1.8,.28,-1.65,.55,.44,1.4,'wood');box(1.8,.51,-1.65,.4,.06,1.25,'straw');
   for(let i=0;i<4;i++)mat(-1.8+i*.7,-1.55,.6,.85);pot(1.9,1.8,.9);break;
  case 'field':field();break;
  case 'bridge':{
   const span=bridgeSpan(b.y),left=(span.left-b.x)*6,right=(span.right-b.x)*6,z=(span.y-b.y)*6;
   const pieces=Math.ceil((right-left)/.32),step=(right-left)/pieces;
   for(let i=0;i<pieces;i++)box(left+step*(i+.5),.14,z,step-.02,.16,1.65,'wood');
   for(let x=left+.14;x<=right;x+=Math.max(1,(right-left-.28)/6))for(const side of [-1,1]){
    cyl(x,-.12,z+side*.8,.09,.68,'wood');cyl(x,.46,z+side*.8,.055,.78,'wood');
   }
   for(const side of [-1,1])beam([left,.75,z+side*.8],[right,.75,z+side*.8],.045,'wood');
   break;
  }
  case 'harbor':
   for(let i=0;i<16;i++)box(0,.36,-2.55+i*.34,5.2,.16,.29,'wood');
   for(const x of [-2.35,2.35])for(const z of [-2.35,0,2.35]){cyl(x,.15,z,.115,1.55);cyl(x,.92,z,.14,.12,'wood');}
   if(b.type==='harbor'){awning(-1.2,-1.3,2,1.8,2);sacks(-1.6,-1.6,3);pot(-.5,-1.2,.85,.48);box(1.4,.63,1.7,.85,.4,.8,'wood');}
   break;
  case 'ziggurat':
   for(let i=0;i<4;i++)box(0,.4+i*.75,-.3,5.3-i*1.05,.8,4.6-i*.85,i===0?'brick':'plaster');
   for(let i=0;i<10;i++)box(0,.08+i*.3,2.4-i*.32,1.1,.17,.7,'brick');
   room(0,-.3,1.65,1.65,3.9);break;
  case 'canal':
   for(const x of [-2.2,2.2]){box(x,.12,0,.55,.3,5.5,'soil');for(let i=0;i<7;i++)box(x,.29,-2.4+i*.75,.6,.08,.68,'brick');}break;
  case 'clay':case 'quarry':
   box(.4,.015,.45,4.3,.1,4.15,'silt');awning(-1.45,-1.55,2.1,1.7,1.65);
   for(let i=0;i<8;i++){const mesh=box(.3+hash(i,b.x)*1.9,.16+hash(i,4)*.25,-1.1+hash(i,b.y)*3, .5+hash(i,3)*.6,.3+hash(i,5)*.35,.5,b.type==='clay'?'soil':'stone',i*.6);mesh.rotation.z=.15;}
   pot(-1.7,.3,.9);break;
  case 'reed':
   workshop();for(let i=0;i<7;i++){const bundle=box(-1.5+i*.47,.42,.7,.28,.5,1.45,'reed',.16);for(let j=0;j<3;j++)box(bundle.position.x,.69,.3+j*.4,.31,.035,.04,'wood');}break;
  case 'garden':
   box(0,.03,0,5.3,.06,5.2,'soil');for(let i=0;i<5;i++){mat(-1.8+i*.85,.8,.65,1.25);pot(-1.8+i*.85,-.3,.6);}awning(0,-1.5,3.7,1.5,1.8);break;
  case 'waterpoint':
   box(0,.1,0,4.9,.2,4.7,'brick');awning(-.7,-.7,3.4,2.6,1.85);
   for(let i=0;i<8;i++)pot(-1.8+i%4*.72,.2+Math.floor(i/4)*.8, .85);beam([1.7,.4,-1.8],[1.7,.4,1.8],.095);break;
  case 'market':
   box(0,.025,0,5.3,.05,5.3,'soil');awning(0,-1.4,4.5,1.75,2);awning(-1.5,1,1.6,2.5,1.9);
   box(0,.75,-1.4,3.8,.17,.85,'wood');sacks(-1,-1.5,4);for(let i=0;i<5;i++)pot(.1+i*.38,-1.4,.48,.85);mat(.6,1.1,1.8,1.3);break;
  case 'brewery':
   workshop();for(let i=0;i<6;i++)pot(-1.4+i%3*1.15,.1+Math.floor(i/3)*1.25,1.15);box(1.7,.35,-.1,.65,.5,.65,'stone');break;
  case 'logging':case 'hunting':case 'fishing':
   room(-.7,-1,3.5,2.7,1.9);awning(.4,1.25,2.8,1.5,1.65);pot(-1.8,1.5,.8);
   if(b.type==='logging')for(let i=0;i<5;i++)beam([.5+i*.25,.2,1],[.5+i*.25,.2,2.4],.12);
   if(b.type==='fishing')for(let i=0;i<8;i++){beam([-1+i*.24,.1,.7],[-1+i*.24,1.6,.35],.012,'linen');beam([-1,.2+i*.18,.7-i*.04],[.7,.2+i*.18,.7-i*.04],.012,'linen');}
   if(b.type==='hunting'){beam([-1.6,.1,1.8],[-1.6,1.6,1.4],.04);beam([-.6,.1,1.8],[-.6,1.6,1.4],.04);box(-1.1,.95,1.55,.85,.95,.03,'linen');}break;
  case 'healer':
   courtyard();box(1.5,.65,.6,.7,.1,1.4,'wood');mat(1.5,.6,.65,1.3,.72);for(let i=0;i<4;i++)pot(-.8+i*.35,-.72,.3);break;
  default:workshop();pot(1.6,1.5,1);mat(.6,1.6);break;
 }
 if(plan.upgrading){for(const x of [-2.6,2.6]){cyl(x,1.6,-2.6,.055,3.2);beam([x,1.8,-2.6],[x,1.8,2.4],.05);}for(let i=0;i<5;i++)box(-1+i*.43,.12,2.62,.39,.18,.24,'brick');}

 // Merge while unparented and at local origin: otherwise translation would be baked twice.
 const meshes=[];
 for(const [material,parts] of groups){
  for(const mesh of parts)mesh.computeWorldMatrix(true);
  const mesh=parts.length===1?parts[0]:B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
  if(!mesh)continue;mesh.name=`${b.type}-${material?.name||'surface'}`;mesh.material=material;mesh.parent=root;mesh.receiveShadows=true;mesh.isPickable=true;meshes.push(mesh);
 }
 for(const mesh of lights){mesh.receiveShadows=true;meshes.push(mesh);}
 root.position.set(...plan.position);root.computeWorldMatrix(true);for(const mesh of meshes){mesh.computeWorldMatrix(true);mesh.freezeWorldMatrix();}
 let previousOccupied;
 const update=(s)=>{
  if(!lights.length)return;
  const occupied=!plan.construction&&(districtHomeOccupancy(s).get(root.metadata.buildingKey)||0)>0;
  if(occupied===previousOccupied)return;previousOccupied=occupied;
  for(const light of lights)light.material=occupied?m.glow:m.dark;
 };
 return {root,meshes,update,dispose(){root.dispose(false);}};
}
