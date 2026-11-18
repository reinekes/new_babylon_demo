import {createCraftVessel,createYardBrick} from './yard-craft-meshes.js';
import {workshopSurfaces} from './workshop-surfaces.js';
// Dimensions in metres. The open front corner is reserved for the animated
// workstation. Rotating the entire yard keeps that corner accessible on any road.
const workshopTypes = new Set([
 'pottery', 'bakery', 'coppersmith', 'dairyStore', 'brewery', 'granary', 'depot',
 'brickyard', 'kiln', 'joineryYard', 'matYard', 'basketry', 'linenYard', 'weaver', 'tailor',
]);
export const isReferenceWorkshop = type => workshopTypes.has(type);

export function workshopAngle(workCorner) {
 const [x, z] = workCorner || [1, 1];
 return x > 0 ? (z > 0 ? 0 : Math.PI / 2) : (z > 0 ? -Math.PI / 2 : Math.PI);
}

// Rotate even meshes whose local origins are model-space zero (woven panels and
// the oven shell). This happens once when the building template is generated.
export function turnWorkshopParts(B, parts, angle) {
 if (!angle) return;
 const c = Math.cos(angle), s = Math.sin(angle), q = B.Quaternion.RotationAxis(B.Axis.Y, angle);
 for (const part of parts) {
  const {x, z} = part.position;
  part.position.x = x * c + z * s;
  part.position.z = -x * s + z * c;
  if (part.rotationQuaternion) part.rotationQuaternion = q.multiply(part.rotationQuaternion);
  else part.rotationQuaternion = q.multiply(B.Quaternion.FromEulerAngles(part.rotation.x, part.rotation.y, part.rotation.z));
 }
}

export function createReferenceWorkshop(b, kit) {
 const {B, scene, add, block, beam, cylinder, jar, ground, m, wall} = kit;
 const groundY = .055;
 function room(x, z, w, d, h, doorX = x, doorWidth = .83) {
  const left = x - w/2, right = x + w/2, rear = z - d/2, front = z + d/2;
  block(x,h/2,rear,w,h,.23,wall);
  for (const edge of [left,right]) block(edge,h/2,z,.22,h,d,wall);
  const doorL = doorX - doorWidth/2, doorR = doorX + doorWidth/2, doorH = Math.min(1.79,h-.25);
  for (const [lo,hi] of [[left,doorL],[doorR,right]]) {
   if (hi <= lo) continue;
   block((lo+hi)/2,h/2,front,hi-lo,h,.23,wall);
   block((lo+hi)/2,.27,front+.10,hi-lo,.41,.055,m.fired);
  }
  block(doorX,(doorH+h)/2,front,doorWidth,h-doorH,.23,wall);
  block(doorX,doorH,front+.015,doorWidth+.28,.13,.31,m.wood);
  block(doorX,doorH/2,front-.36,doorWidth+.06,doorH,.06,m.shade);
  for(const side of [-1,1])block(doorX+side*(doorWidth/2-.036),doorH/2,front-.09,.10,doorH,.34,m.wood);
  const openLeaf=block(doorL+.107,doorH*.48,front-.10,.12,doorH*.93,.47,m.wood);
  openLeaf.rotation.y=-.28;
  if(b.type!=='pottery'){
   for(const edge of [left,right])block(edge,.235,z,.265,.34,d-.05,m.fired);
  }
  // On these workshops the cut reed-clay ends are visible above the doorway.
  if(['pottery','dairyStore','tailor','depot','joineryYard'].includes(b.type)){
   const n=Math.floor((right-left-.32)/.45);
   for(let i=0;i<n;i++){
    const px=left+.31+i*.45;
    if(Math.abs(px-doorX)<doorWidth*.53)continue;
    for(const side of [-1,1]){
     const mark=block(px+side*.058,h-.23,front+.124,.045,.17,.035,m.fired);
     mark.rotation.z=-side*.67;
    }
   }
  }

  block(x,h+.02,z,w+.23,.16,d+.27,m.raw);
  // Lashed palm beams extend just beyond the plaster eave.
  const n = Math.max(3,Math.round(w/.69));
  for (let j=0;j<n;j++) {
   const px=left+.15+(w-.30)*j/(n-1);
   beam([px,h-.045,front-.19],[px,h-.038,front+.21],.057,m.wood);
  }
  for (const edge of [left,right]) block(edge,h+.14,z,.14,.19,d+.15,wall);
  block(x,h+.14,rear,w,.19,.16,wall);
  if(['pottery','granary','tailor','basketry','weaver'].includes(b.type)){
   lowMat(x+w*.16,z,Math.min(1.39,w*.62),Math.min(.89,d*.74),h+.109);
  }
  if(b.type==='tailor'||b.type==='weaver')jar(x-w*.29,z,.42,h+.11);

 }
 function bound(leftHeight, rightHeight, front=0) {
  const lo=-2.46, hi=2.46;
  if (leftHeight) block(lo,leftHeight/2,0,.19,leftHeight,4.83,wall);
  if (rightHeight) block(hi,rightHeight/2,-.32,.19,rightHeight,4.21,wall);
  if (front) block(-1.53,front*.5,2.36,1.99,front,.22,wall);
 }
 function roofMat(x,z,w,d,y,drop=.18) {
  // Split mats in shallow sagging bays with separate rope edges.
  const bays=Math.max(2,Math.round(w/1.05)),bw=w/bays,back=z-d/2,front=z+d/2;
  for (let i=0;i<bays;i++) {
   const q=x-w/2+(i+.5)*bw, lip=front+.025*Math.sin(i*3.07);
   const path=[[q-bw/2,y,back],[q-bw/2,y-drop,lip],[q,y-.040,back],[q,y-drop-.072,lip+.035],[q+bw/2,y,back],[q+bw/2,y-drop,lip]];
   panel(path,m.reed);
   // Bound stem ends add thickness and give the front edge a soft irregular fringe.
   const count=Math.max(5,Math.round(bw/.088));
   for(let j=0;j<count;j++){
    const u=(j+.5)/count,px=q+(u-.5)*bw,sag=.079*Math.sin(Math.PI*u);
    const tip=lip+.088+.034*Math.sin(j*1.7+i);
    beam([px,y-drop+.059-sag,lip-.36],[px,y-drop-.021-sag,tip],.027,m.reed);
   }

   beam([q-bw/2+.024,y+.015,back],[q-bw/2+.024,y-drop+.018,lip],.022,m.wood);
  }
  for (const edge of [x-w/2+.09,x+w/2-.09]) {
   beam([edge,groundY,front-.16],[edge,y-drop,front-.19],.076,m.wood);
   beam([edge,groundY,back+.12],[edge,y,back+.12],.063,m.wood);
   beam([edge,y-drop-.41,front-.16],[edge,y-drop+.02,front-.61],.043,m.wood);
   cylinder(edge,y-drop-.14,front-.17,.087,.10,m.reed);
  }
  beam([x-w/2-.04,y-drop-.08,front-.16],[x+w/2+.04,y-drop-.08,front-.16],.075,m.wood);
  beam([x-w/2-.04,y-.07,back+.12],[x+w/2+.04,y-.07,back+.12],.068,m.wood);
 }
 function panel(points,mat) {
  // Three or more pairs across the surface. Independent normals on the back
  // keep folded fabrics readable in the GLB even with back-face culling.
  const p=[],uv=[],ix=[],normals=[];
  const emit=(i,j,k)=>{
   for (const idx of [i,j,k]) { const pt=points[idx];p.push(...pt);uv.push(idx>>1,idx%2);ix.push(ix.length); }
  };
  for (let i=0;i<points.length-2;i+=2) {
   emit(i,i+1,i+2);emit(i+2,i+1,i+3);emit(i+2,i+1,i);emit(i+3,i+1,i+2);
  }
  const data=new B.VertexData();B.VertexData.ComputeNormals(p,ix,normals);
  Object.assign(data,{positions:p,indices:ix,uvs:uv,normals});
  const mesh=new B.Mesh('woven-panel',scene);data.applyToMesh(mesh);return add(mesh,mat);
 }
 function lowMat(x,z,w,d,y=.086) {
  panel([[x-w/2,y,z-d/2],[x-w/2,y+.012,z+d/2],[x,y+.016,z-d/2],[x,y,z+d/2+.026],[x+w/2,y,z-d/2],[x+w/2,y+.019,z+d/2]],m.reed);
  for(const side of [-1,1]) beam([x+side*w*.48,y+.024,z-d/2],[x+side*w*.48,y+.024,z+d/2],.018,m.wood);
 }
 function firingChamber(x,z,w,d,h) {
  // Barrel-vault section with a tapered rounded rear and an actual deep
  // loading recess. Each brick around the mouth has its own visible joint.
  const r=w/2,ri=r*.57,spring=h*.27,rise=h-spring,front=z+d/2;
  for (const side of [-1,1]) block(x+side*(r+ri)/2,spring/2,z,r-ri,spring,d,m.raw);
  const ang=16,rows=4,profiles=[
   [z-d/2,.71,.78],[z-d*.40,.94,.94],[z-d*.04,1,1],[front,1,.98],
  ];
  const p=[],ix=[],uv=[],normals=[];
  // Continuous skin with metres mapped along the vault surface and its depth.
  for (let j=0;j<rows;j++) for(let i=0;i<=ang;i++){
   const [pz,rs,hs]=profiles[j],a=Math.PI*i/ang;
   p.push(x+r*rs*Math.cos(a),spring+rise*hs*Math.sin(a),pz);
   uv.push(i/ang*2,pz*.5);
   if(i&&j){const q=j*(ang+1)+i;ix.push(q-ang-2,q-1,q,q-ang-2,q,q-ang-1);}
  }
  B.VertexData.ComputeNormals(p,ix,normals);
  const data=new B.VertexData();Object.assign(data,{positions:p,indices:ix,uvs:uv,normals});
  const mesh=new B.Mesh('plastered-oven-vault',scene);data.applyToMesh(mesh);add(mesh,m.raw);
  // Each face strip closes the shell around the opening; at the back the
  // opening reduces to a slit hidden inside the chamber.
  for(const [pz,rs,hs,inner,imat] of [[front,1,.98,ri,m.raw],[z-d/2,.71,.78,.001,m.raw]]){
   const points=[];
   for(let i=0;i<=ang;i++){
    const a=Math.PI*i/ang;
    points.push([x+r*rs*Math.cos(a),spring+rise*hs*Math.sin(a),pz],[x+inner*Math.cos(a),spring+inner*Math.sin(a),pz]);
   }
   panel(points,imat);
  }
  for(let i=0;i<13;i++) {
   const a=Math.PI*(i+.5)/13,br=ri+.088;
   const unit=block(x+br*Math.cos(a),spring+br*Math.sin(a),front+.042,.18,2*br*Math.sin(Math.PI/26)*.89,.15,m.fired);
   unit.rotation.z=a;
  }
  block(x,.075,z,ri*2,.15,d,m.fired);
  // Recessed near-black lining prevents the unlit chamber from showing the
  // pale floor or the exterior shell through the arched loading hole.
  const lining=[];
  for(let i=0;i<=ang;i++){
   const a=Math.PI*i/ang;
   lining.push([x+ri*.99*Math.cos(a),spring+ri*.99*Math.sin(a),front-.43],[x+ri*.99*Math.cos(a),.095,front-.43]);
  }
  panel(lining,m.shade);
  for(const side of [-1,1])block(x+side*(ri+.035),spring/2,front-.18,.095,spring,.42,m.fired);

 }
 function shelf(x,z,w,base,y) {
  for(const sx of [-1,1]) beam([x+sx*w*.46,base,z],[x+sx*w*.46,y+.07,z],.047,m.wood);
  for(const h of [base+(y-base)*.45,y]) block(x,h,z,w,.075,.50,m.wood);
 }
 function craftVessel(form,x,z,scale,y=groundY,turn=0) {
  const mesh=createCraftVessel(B,scene,form,x*2.1+z);
  mesh.position.set(x,y,z);
  mesh.scaling.setAll(scale);
  mesh.rotation.y=turn;
  return add(mesh,mesh.material);
 }
 function looseBrick(x,y,z,width,height,depth,fired,seed) {
  const mesh=createYardBrick(B,scene,{width,height,depth,fired,seed});
  mesh.position.set(x,y,z);
  mesh.rotation.y=.031*Math.sin(seed*1.7);
  return add(mesh,mesh.material);
 }
 function bricks(x,z,columns,rows,levels,fired,width=.40,depth=.30) {
  const height=fired?.135:.14;
  for(let j=0;j<levels;j++)for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){
   looseBrick(x+c*(width+.019)+(j%2)*.022,groundY+j*height*.95,z+r*(depth+.021),
    width,height,depth,fired,c+columns*(r+j*rows));
  }
 }
 function basin(x,z,w,d) {
  block(x,.13,z,w,.19,d,m.raw);
  for(const dx of [-1,1]) block(x+dx*w/2,.31,z,.13,.43,d,m.raw);
  for(const dz of [-1,1]) block(x,.31,z+dz*d/2,w,.43,.13,m.raw);
  block(x,.22,z,w-.12,.025,d-.10,m.soil);
 }
 function weaveFrame(x,z,w,h) {
  for(const s of [-1,1]) beam([x+s*w/2,.10,z+.20],[x+s*w/2,h+.06,z-.14],.057,m.wood);
  for(const [y,dz] of [[h,-.13],[.43,.14]]) beam([x-w*.55,y,z+dz],[x+w*.55,y,z+dz],.055,m.wood);
  for(let i=0;i<16;i++) {
   const px=x+w*(i/15-.5)*.88;
   beam([px,.43,z+.14],[px,h-.04,z-.12],.012,m.linen);
  }
  const blanket=block(x,.69,z+.095,w*.89,.46,.055,m.linen);blanket.rotation.x=-.14;
  for(const y of [.53,.61])block(x,y,z+.14,w*.88,.039,.022,m.fired);
 }
 function table(x,z,w,d,h=.79) {
  block(x,h,z,w,.10,d,m.wood);
  for(const s of [-1,1])for(const t of [-1,1])beam([x+s*(w/2-.10),.06,z+t*(d/2-.075)],[x+s*(w/2-.10),h,z+t*(d/2-.075)],.051,m.wood);
 }
 function grainJars() {
  // Terracotta fermenters have lower, wider shoulders than ordinary jars.
  for(const [x,z,s] of [[-1.68,-.50,1.06],[-.63,-.52,1.0],[.39,-.50,.93],[-1.55,.64,.92]]){
   craftVessel('fermenter',x,z,1.35*s);
  }
 }
 ground();
 switch (b.type) {
 case 'brickyard':
  block(0,.44,-2.40,5.04,.87,.21,wall);
  // The covered moulding and tempering bay is confined to the rear left.
  block(-1.64,.84,-1.70,1.48,1.66,1.30,m.raw);
  roofMat(-1.56,-.83,1.94,2.35,1.81,.11);
  basin(-1.66,1.04,1.27,.80);
  for(let row=0;row<5;row++)for(let col=0;col<7;col++){
   const seed=col+row*7;
   const x=-.53+row*.55+.023*Math.sin(seed),z=-1.81+col*.409;
   looseBrick(x,groundY,z,.392,.129,.286,false,seed);
  }
  craftVessel('spouted',-2.04,1.83,.64,groundY,-.63);break;
 case 'kiln':
  firingChamber(-.60,-.40,2.79,2.82,2.39);
  roofMat(1.64,-1.21,1.39,2.12,1.76,.16);
  bricks(-2.18,1.40,3,2,2,false);
  bricks(1.09,-1.98,3,2,3,true,.38,.30);
  break;
 case 'pottery': {
  room(-1.29,-1.51,2.12,1.65,2.03,-1.50);
  bound(.47,0,.43);roofMat(-1.29,-.40,2.18,1.04,2.12);
  shelf(-1.19,.43,1.91,.12,1.01);
  craftVessel('jar',-1.82,.43,.44,.562);
  for(let i=0;i<3;i++)craftVessel('bowl',-1.20,.43,.53,.562+i*.065);
  craftVessel('spouted',-.58,.43,.44,.562,-.62);
  craftVessel('spouted',-1.79,.43,.57,1.05,-.83);
  craftVessel('jar',-1.11,.43,.55,1.05);
  craftVessel('bowl',-.55,.43,.51,1.05);
  firingChamber(.84,-1.30,1.41,1.45,1.42);
  craftVessel('jar',-.15,1.48,.94);
  if ((b.level||1)>=2) {
   shelf(.44,-.42,1.15,.16,.95);
   craftVessel('bowl',.13,-.41,.49,1);
   craftVessel('spouted',.68,-.41,.44,1,-.76);
  }
  break;
 }
 case 'bakery':
  bound(1.06,.83,.71);
  block(0,.86,-2.35,4.89,1.71,.21,wall);
  roofMat(.25,-1.22,4.07,2.33,2.17,.16);
  firingChamber(.83,-.78,1.79,1.84,1.50);
  lowMat(-.52,1.12,1.69,.99);
  for(const [x,z,r] of [[-.95,.97,.25],[-.38,.94,.26],[-.68,1.39,.23]]){
   cylinder(x,.14,z,r,.07,m.raw,r*.94);
   for(const off of [-.095,.04])beam([x+off-.035,.181,z-.08],[x+off+.035,.181,z+.09],.013,m.fired);
  }
  break;
 case 'brewery':
  room(.17,-1.61,4.15,1.48,2.25,1.16,.92);
  bound(.79,0,.65);roofMat(-.82,-.10,2.84,1.94,2.03,.17);
  grainJars();break;
 case 'dairyStore':
  room(.12,-1.65,4.42,1.29,2.20,1.56,.84);
  bound(.88,.67,.52);roofMat(-.40,-.48,3.23,1.43,2.07);
  shelf(-.77,-.20,2.18,.12,1.31);
  for(const base of [.70,1.35])for(let i=0;i<3;i++)cylinder(-1.48+i*.70,base+.115,-.19,.26,.22,m.linen,.265);
  table(-.63,.88,1.97,.81);
  jar(-1.27,.86,.70,.84);
  for(const x of [-.61,-.17]) cylinder(x,.91,.92,.19,.13,m.raw,.20);
  panel([[-.61,.87,.96],[-.61,.87,1.31],[-.13,.87,.96],[-.13,.87,1.31]],m.linen);
  panel([[-.61,.87,1.31],[-.61,.49,1.34],[-.13,.87,1.31],[-.13,.51,1.35]],m.linen);
  break;
 case 'granary':
  room(-.04,-.86,4.51,2.83,2.76,.21,1.17);
  block(-.03,.27,1.04,4.50,.53,1.02,m.raw);
  for(let i=0;i<3;i++)block(.21,.09*(i+1),2.08-i*.245,1.31,.18*(i+1),.36,m.raw);
  for(let i=0;i<6;i++)block(-1.89+i*.67,2.12,.576,.14,.20,.045,m.shade);
  for(let i=0;i<3;i++)block(-1.57+i*.43,.84,1.38,.17,.66,.075,m.wood,.04);
  for(let i=0;i<6;i++)beam([-2.09+i*.79,2.90,-2.13],[-2.09+i*.79,2.90,.47],.048,m.wood);
  break;
 case 'depot':
  room(-.055,-1.55,4.57,1.70,2.45,1.51,.68);
  bound(.81,.82,.51);roofMat(-.43,-.10,3.46,1.99,2.17,.22);
  block(-.39,.42,.45,3.42,.81,.81,m.raw);
  block(-.39,.85,.44,3.57,.09,.89,wall);
  shelf(-.89,-.72,1.95,.15,1.35);jar(-1.41,-.72,.47,.72);jar(-.83,-.72,.46,.72);
  if(b.commonMeals){table(.17,1.55,1.43,.57,.57);cylinder(.16,.66,1.55,.18,.08,m.fired,.24);}
  break;
 case 'coppersmith':
  room(-1.38,-1.26,1.87,2.12,2.26,-1.26);
  bound(.72,.83,.77);roofMat(1.05,-.92,2.22,2.10,2.16,.16);
  firingChamber(.89,-.67,1.40,1.37,1.62);
  table(-.96,.47,2.14,.67,.64);
  for(const x of [-1.54,-.91,-.28]){
   block(x,.74,.47,.51,.14,.30,m.stone);
   block(x,.814,.48,.33,.02,.13,m.shade);
  }
  jar(1.85,.38,.66,groundY);
  break;
 case 'joineryYard':
  room(.09,-1.65,4.56,1.34,2.15,.80);
  bound(.72,.74,.67);roofMat(-1.56,-.12,1.54,2.23,1.96);
  for(let i=0;i<5;i++)block(-1.77+(i%2)*.27,.17+Math.floor(i/2)*.155,-.18,.25,.15,2.04,m.wood);
  // Boat mould on two cradles, with open ribs and sweeping gunwales.
  for(const z of [-.48,.86]) block(1.30,.25,z,.94,.42,.15,m.wood);
  for(let i=0;i<7;i++){
   const t=i/6,z=-1.04+t*2.65,w=.14+.53*Math.sin(Math.PI*t),y=.51+.24*Math.abs(2*t-1);
   for(const side of [-1,1]) {
    beam([1.30,y,z],[1.30+side*w*.66,y+.16,z],.052,m.wood);
    beam([1.30+side*w*.66,y+.16,z],[1.30+side*w,y+.55,z],.049,m.wood);
    if(i){const prev=(i-1)/6,pw=.14+.53*Math.sin(Math.PI*prev),py=.51+.24*Math.abs(2*prev-1);
     beam([1.30+side*pw,py+.55,z-2.65/6],[1.30+side*w,y+.55,z],.046,m.wood);
     panel([[1.30+side*pw*.55,py+.12,z-2.65/6],[1.30,py-.01,z-2.65/6],[1.30+side*w*.55,y+.12,z],[1.30,y-.01,z]],m.wood);
    }
   }
  }
  break;
 case 'matYard':
  block(0,.68,-2.35,4.94,1.36,.24,wall);bound(1.01,1.0,.83);
  roofMat(-1.21,-1.39,2.26,1.72,1.70,.13);
  lowMat(.29,.38,2.25,2.20);
  for(let i=0;i<15;i++)beam([-.77,.116,-.63+i*.14],[1.33,.116,-.63+i*.14],.013,m.reed);
  jar(-1.64,-1.25,.85,groundY);break;
 case 'basketry':
  room(.13,-1.62,4.46,1.44,2.0,.12);
  bound(.55,.49,.53);roofMat(-.75,-.35,2.94,1.51,1.88,.20);
  table(-.42,.13,1.5,.48,.60);jar(-1.83,-.20,.60,groundY);
  for(let i=0;i<16;i++){
   const a=2.4*i,px=-1.68+.14*Math.cos(a),pz=.10+.14*Math.sin(a);
   beam([px,.10,pz],[px+.16*Math.cos(a),1.27+.24*Math.sin(i*5),pz+.17*Math.sin(a)],.024,m.reed);
  }
  break;
 case 'linenYard':
  room(.24,-1.66,4.29,1.39,2.11,1.42);
  bound(.62,.55,.42);roofMat(-.61,-.67,1.97,1.42,1.99);
  weaveFrame(-.57,-.35,1.33,1.61);basin(-1.40,1.09,1.49,.73);
  for(let j=0;j<3;j++){
   const x=.69+j*.44,z=.60+j*.12;
   for(let i=0;i<10;i++){const a=i*2.4;beam([x+.10*Math.cos(a),.10,z+.11*Math.sin(a)],[x+.25*Math.cos(a),1.53+.21*Math.sin(i),z+.22*Math.sin(a)],.035,m.reed);
    beam([x+.25*Math.cos(a),1.53+.21*Math.sin(i),z+.22*Math.sin(a)],[x+.29*Math.cos(a),1.62+.21*Math.sin(i),z+.26*Math.sin(a)],.056,m.reed);
   }
   cylinder(x,.79,z,.112,.060,m.wood);
  }
  break;
 case 'weaver':
  room(-.26,-1.56,4.09,1.69,2.03,.96);
  roofMat(-1.04,-.27,2.45,1.51,1.99);
  weaveFrame(-.71,-.07,1.54,1.74);
  // Finished cloth is draped over a bar: an unbroken textile face with two
  // selvedges and broad stepped bands, distinct from the exposed working warp.
  {
   const dye=workshopSurfaces(B,scene).material('dyed-weft'),x=-1.59,z=1.39,w=1.09,h=1.68;
   const depth=y=>z+.24*(1-y/h);
   for(const side of [-1,1])beam([x+side*.55,.08,z+.23],[x+side*.52,h+.05,z-.03],.043,m.wood);
   beam([x-.62,h,z],[x+.62,h,z],.049,m.wood);
   const point=(u,y,lift=0)=>[x+u,y,depth(y)+lift];
   function stripe(vertices,width){
    // The pattern sits on both sides of the hanging sample, including when
    // its nearest road turns this front away from the camera.
    for(const lift of [-.014,.014])panel(vertices.flatMap(([u,y])=>[point(u,y+width/2,lift),point(u,y-width/2,lift)]),dye);
   }
   panel([point(-w/2,h),point(-w/2,.17),point(0,h+.018),point(0,.15),point(w/2,h),point(w/2,.17)],m.linen);
   for(const y of [.28,1.50])stripe([[-.54,y],[.54,y]],.082);
   for(const band of [.50,.99]){
    const zig=Array.from({length:7},(_,i)=>[-.54+i*.18,band+(i%2)*.14]);
    stripe(zig,.094);
   }
   for(let i=0;i<9;i++)beam(point(-.45+i*.114,.18),point(-.45+i*.114,.075),.018,m.linen);
  }
  break;
 case 'tailor':
  room(.02,-1.56,4.30,1.70,2.36,-.83);
  roofMat(-.33,-.59,3.22,1.02,2.12,.13);
  table(.09,.43,2.06,.69,.69);
  for(let i=0;i<4;i++)block(-.29,.78+i*.066,.43,.71,.062,.51,i%2?m.fired:m.linen,.02*i);
  table(-1.48,.79,.67,.64,.58);
  // The garment hangs past the canopy, its sleeves free of the wall.
  // A folded centre, a cut neck and a contrasting woven border survive the
  // overhead game camera. The lower folds stop above the basket and table.
  {
   const dye=workshopSurfaces(B,scene).material('dyed-weft');
   const x=1.02,z=1.19;
   beam([1.19,1.99,-.19],[1.52,1.94,z],.047,m.wood);
   beam([-.21,2.05,-.24],[.25,1.94,z],.045,m.wood);
   beam([.08,1.97,z],[1.91,1.97,z],.055,m.wood);
   const panelAt=(path,material)=>panel(path.map(([dx,y,dz])=>[x+dx,y,z+dz]),material);
   for(const side of [-1,1]){
    panelAt([[side*.71,1.90,.015],[side*.83,1.57,.085],[side*.49,1.96,.015],[side*.54,1.53,.13],[side*.29,1.97,.035],[side*.33,1.56,.075]],m.linen);
    panelAt([[side*.81,1.64,.08],[side*.83,1.57,.102],[side*.55,1.60,.15],[side*.54,1.53,.155]],dye);
   }
   panelAt([[-.33,1.96,.04],[-.38,.72,.13],[-.13,1.96,.075],[-.17,.65,.22],[0,1.82,.14],[.01,.65,.29],[.14,1.96,.075],[.17,.68,.21],[.33,1.96,.04],[.38,.73,.12]],m.linen);
   for(const side of [-1,1])panelAt([[0,1.85,.157],[0,1.79,.161],[side*.14,1.98,.086],[side*.19,1.96,.082]],dye);
   for(const [y,width] of [[.78,.095],[.91,.040]]){
    const hem=[[-.38,.05,.15],[-.17,-.005,.245],[.01,-.015,.303],[.17,.018,.236],[.38,.052,.141]];
    panelAt(hem.flatMap(([u,dy,v])=>[[u,y+dy+width/2,v],[u,y+dy-width/2,v]]),dye);
   }
  }
  break;
 }
}
