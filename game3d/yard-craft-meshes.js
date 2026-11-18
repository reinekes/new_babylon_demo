// Model space is metres, with the base at y=0. Each finish occupies one padded
// chart of a shared PBR atlas so tools, wares and loose bricks batch together.
const materials = new WeakMap();
const tau = 2 * Math.PI;
const finishes = {buff:0, red:1, adobe:2, fired:3, stone:4, storage:5};

export function yardCraftMaterial(B, scene) {
 let material = materials.get(scene);
 if (material) return material;
 material = new B.PBRMaterial('handmade-yard-craft', scene);
 material.metallic = 0;
 material.roughness = .88;
 if (typeof Image !== 'undefined') {
  const texture = channel => new B.Texture('assets/3d/textures/courtyard/yard-craft-'+channel+'.jpg', scene, false, true);
  material.albedoTexture = texture('color');
  material.bumpTexture = texture('normal');
  material.bumpTexture.gammaSpace = false;
  material.bumpTexture.level = .47;
 }
 materials.set(scene, material);
 return material;
}

function meshBuilder(B, scene, name, finish) {
 const positions = [], uvs = [], colors = [], indices = [], seams = [], stride = finishes[finish];
 function point(x, y, z, u, v, shade=1) {
  positions.push(x, y, z);
  uvs.push(((stride%2) + .025 + .95*u)/2, 1-(Math.floor(stride/2) + .975 - .95*v)/4);
  colors.push(shade, shade, shade, 1);
  return positions.length/3-1;
 }
 function stripe(lower, upper) {
  for (let i=0; i<lower.length-1; i++) {
   indices.push(lower[i],lower[i+1],upper[i], lower[i+1],upper[i+1],upper[i]);
  }
 }
 function smoothLoop(loop) {
  seams.push([loop[0],loop.at(-1)]);
  return loop;
 }
 function finishMesh() {
  const normals = [];
  B.VertexData.ComputeNormals(positions, indices, normals);
  // UV-wrap vertices occupy the same point in space. Share their lighting
  // normal so daylight does not draw a dark seam across a continuous lip.
  for(const [a,b] of seams){
   const x=normals[a*3]+normals[b*3],y=normals[a*3+1]+normals[b*3+1],z=normals[a*3+2]+normals[b*3+2];
   const length=Math.hypot(x,y,z)||1;
   for(const k of [a,b]){normals[k*3]=x/length;normals[k*3+1]=y/length;normals[k*3+2]=z/length;}
  }
  const data = new B.VertexData();
  Object.assign(data,{positions,uvs,colors,indices,normals});
  const mesh = new B.Mesh(name,scene);
  data.applyToMesh(mesh);
  mesh.material = yardCraftMaterial(B,scene);
  return mesh;
 }
 return {point,stripe,smoothLoop,indices,finishMesh};
}

// The last three turning points form the rolled lip. The inner wall follows
// the shoulder and closes at a raised floor, leaving a real, lit cavity.
const forms = {
 jar: [[.16,0],[.20,.025],[.21,.065],[.25,.12],[.34,.31],[.38,.49],[.38,.60],[.35,.70],[.26,.79],[.17,.84],[.145,.90],[.15,.94],[.178,.958],[.182,.98],[.162,.993]],
 bowl: [[.21,0],[.24,.018],[.24,.052],[.30,.077],[.39,.14],[.45,.21],[.505,.30],[.517,.34],[.519,.36],[.51,.371]],
 spouted: [[.19,0],[.235,.025],[.27,.08],[.36,.14],[.46,.26],[.505,.39],[.50,.54],[.48,.63],[.42,.70],[.28,.78],[.24,.82],[.24,.88],[.268,.90],[.265,.924],[.245,.932]],
 fermenter: [[.22,0],[.25,.03],[.27,.10],[.33,.22],[.405,.41],[.445,.61],[.44,.72],[.40,.82],[.31,.90],[.24,.935],[.235,.965],[.269,.98],[.273,1.005],[.247,1.014]],
};

export function createCraftVessel(B, scene, form, seed=0) {
 const profile = forms[form];
 const finish = {jar:'red',bowl:'buff',spouted:'buff',fermenter:'storage'}[form];
 const builder = meshBuilder(B,scene,'yard-'+form,finish);
 const sides = 32, peak=profile.at(-1)[1], phase=seed*1.337;
 function ring(radius,height,shade) {
  return builder.smoothLoop(Array.from({length:sides+1},(_,i)=>{
   const a=tau*i/sides;
   const irregular=1+.012*Math.sin(3*a+phase+height*.9)+.006*Math.cos(5*a-phase);
   const h=height*(1+.004*Math.cos(3*a+phase)+.003*Math.sin(2*a));
   return builder.point(Math.sin(a)*radius*irregular,h,Math.cos(a)*radius*irregular,i/sides,height/peak,shade);
  }));
 }
 const outer=profile.map(([r,h])=>ring(r,h,.94+.06*h/peak));
 const inner=profile.map(([r,h])=>ring(r-.03,Math.max(.055,h-.002),.44+.45*(h/peak)**2));
 const underside=builder.point(0,0,0,.5,0,.74);
 const floor=builder.point(0,.055,0,.5,0,.43);
 for(let i=0;i<sides;i++){
  builder.indices.push(underside,outer[0][i],outer[0][i+1], floor,inner[0][i+1],inner[0][i]);
 }
 // Around the spout both skins omit a two-row patch. Its perimeter is
 // extended to the pouring lip, so daylight passes through the actual tube.
 const cols=[6,10], rows=[5,7], spouted=form==='spouted';
 for(let j=1;j<outer.length;j++){
  for(let i=0;i<sides;i++){
   if(spouted && i>=cols[0] && i<cols[1] && j>rows[0] && j<=rows[1])continue;
   const lo=outer[j-1],hi=outer[j],li=inner[j-1],ri=inner[j];
   builder.indices.push(lo[i],hi[i],lo[i+1],lo[i+1],hi[i],hi[i+1]);
   builder.indices.push(li[i],li[i+1],ri[i],li[i+1],ri[i+1],ri[i]);
  }
 }
 builder.stripe(inner.at(-1),outer.at(-1));
 if(spouted){
  const path=[];
  for(let i=cols[0];i<=cols[1];i++)path.push([rows[0],i]);
  for(let j=rows[0]+1;j<=rows[1];j++)path.push([j,cols[1]]);
  for(let i=cols[1]-1;i>=cols[0];i--)path.push([rows[1],i]);
  for(let j=rows[1]-1;j>=rows[0];j--)path.push([j,cols[0]]);
  function nozzle(x,y,r,shade){
   return builder.smoothLoop(path.map(([j,i],n)=>{
    const a=Math.atan2((j-6), (8-i)*.5);
    const z=r*Math.cos(a),up=r*Math.sin(a);
    return builder.point(x-.57*up,y+.82*up,z,n/(path.length-1),y/peak,shade);
   }));
  }
  const pipes=[path.map(([j,i])=>outer[j][i]),nozzle(.58,.58,.115,.91),nozzle(.72,.72,.087,.97),
   nozzle(.805,.81,.098,.98),nozzle(.827,.829,.092,.98),nozzle(.829,.829,.067,.73),
   nozzle(.70,.72,.054,.50),nozzle(.56,.57,.081,.46),path.map(([j,i])=>inner[j][i])];
  for(let j=1;j<pipes.length;j++)builder.stripe(pipes[j],pipes[j-1]);
 }
 return builder.finishMesh();
}

function signedPower(x, power) {
 return Math.sign(x)*Math.abs(x)**power;
}

// Drying bricks have a flat bed and a domed, hand-smoothed face; firing and
// stacking flatten the crown. Coarse temper is in the atlas, not tiny meshes.
export function createYardBrick(B,scene,{width=.32,height=.105,depth=.23,fired=false,seed=0}={}) {
 const builder=meshBuilder(B,scene,fired?'yard-fired-brick':'yard-plano-convex-brick',fired?'fired':'adobe');
 const phase=.89*seed,crown=fired?.065:.14;
 const damaged=Math.abs(Math.floor(seed))%4;
 const outline=[];
 // Starting on an edge and walking around the mould gives four planar sides.
 // One bruised corner breaks early into a broad, asymmetric fracture face.
 for(let side=0;side<4;side++){
  const chip=side===damaged?.29+.045*Math.sin(phase):.066;
  const a=side*Math.PI/2,ca=Math.cos(a),sa=Math.sin(a);
  for(const [u,v] of [[1,-.49],[1,.46],[1,1-chip*1.22],[1-chip*.83,1]]){
   const x=u*ca-v*sa,z=u*sa+v*ca;
   outline.push([x*(1+.006*Math.sin(phase+z*2)),z*(1+.009*Math.cos(phase+x*1.5))]);
  }
 }
 outline.push(outline[0]);
 const levels=[[.981,0],[1,.075],[1,.73],[.987,1-crown]];
 const shade=.95+.035*Math.cos(phase);
 function vertex(k,scale,rise,u,v,tint=shade){
  const [x,z]=outline[k];
  const uneven=rise*.012*Math.sin(phase+.8*x+1.7*z);
  return builder.point(width*x*scale*.5,height*(rise+uneven),depth*z*scale*.5,u,v,tint);
 }
 for(let k=0;k<outline.length-1;k++){
  let lower;
  for(const [scale,h] of levels){
   const upper=[vertex(k,scale,h,.16,.09+h*.75),vertex(k+1,scale,h,.83,.09+h*.75)];
   if(lower)builder.stripe(lower,upper);
   lower=upper;
  }
 }
 // An independent chart gives the arris a grazing highlight while the
 // broad top keeps its shallow, plano-convex cross-section.
 const bands=[[.987,1-crown],[.91,1-crown*.53],[.71,1-crown*.20],[.36,1-crown*.04]];
 const roof=bands.map(([r,h])=>outline.map(([x,z],k)=>vertex(k,r,h,.50+.45*r*x,.50+.45*r*z)));
 for(let i=1;i<roof.length;i++)builder.stripe(roof[i-1],roof[i]);
 const underside=outline.map(([x,z],k)=>vertex(k,.981,0,.5+.45*x,.5+.45*z,.81));
 const bed=builder.point(0,0,0,.5,.5,.8),top=builder.point(width*.015,height,depth*.012,.51,.51,shade);
 for(let i=0;i<outline.length-1;i++)builder.indices.push(bed,underside[i+1],underside[i],top,roof.at(-1)[i],roof.at(-1)[i+1]);
 return builder.finishMesh();
}

// An oval saddle quern with a dished grinding track, and its worn, detachable
// handstone. The paler track and lower shoulders are carved into the same mesh.
export function createGrindingStone(B,scene,handstone=false){
 const builder=meshBuilder(B,scene,handstone?'yard-quern-handstone':'yard-saddle-quern','stone');
 const profile=handstone?[[.77,0],[.98,.033],[1,.077],[.88,.112],[.58,.142],[.05,.151]]:
  [[.78,0],[.94,.045],[1,.129],[.96,.197],[.85,.233],[.66,.192],[.41,.148],[.09,.135]];
 const width=handstone?.55:1.14, depth=handstone?.22:.66, count=32;
 const band=(j,side)=>Array.from({length:count+1},(_,k)=>{
  const [r,h]=profile[j];
  const a=tau*k/count;
  const eroded=1+.024*Math.cos(3*a)+.022*Math.sin(5*a+.7);
  const x=r*signedPower(Math.cos(a),.77)*eroded,z=r*Math.sin(a)*eroded;
  const saddle=handstone?0:Math.max(0,j-2)*.005*x*x;
  const tint=handstone?.77: j>4?1.14:.86;
  const u=side?.04+.92*k/count:.5+.46*x,v=side?.12+h*2.7:.5+.46*z;
  return builder.point(x*width*.5,h+saddle,z*depth*.5,u,v,tint);
 });
 const chartEdge=handstone?2:3;
 const rows=profile.map((_,j)=>band(j,j<=chartEdge));
 const upperEdge=band(chartEdge,false);
 for(let j=1;j<rows.length;j++)builder.stripe(j===chartEdge+1?upperEdge:rows[j-1],rows[j]);
 const bottom=builder.point(0,0,0,.5,.5,.73),top=builder.point(0,profile.at(-1)[1],0,.5,.5,1);
 for(let i=0;i<count;i++)builder.indices.push(bottom,rows[0][i+1],rows[0][i],top,rows.at(-1)[i],rows.at(-1)[i+1]);
 return builder.finishMesh();
}
