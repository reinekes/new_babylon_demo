// Cut the outer cloth against the resident's actual tunic and skirt in their
// common bind frame. A point on a fold inherits the underlying triangle's
// skin weights, including its left/right leg influences below the hips.
const fits = new WeakMap();
const TAU = Math.PI * 2;
const outerCloth = /native upper cloth|draped wool skirt|woven wool (?:wrap|dress)|wool shoulder wrap|wool wrap|adapted skin|civilian skin/i;
const skinName = /(?:skin|inherited robe)/i;

function buildFit(B, meshes, source) {
  const surfaces=meshes.filter(m=>m.skeleton===source.skeleton && outerCloth.test(m.name));
  const hasUpper=surfaces.some(m=>/native upper cloth|wool shoulder wrap/i.test(m.name));
  const skirt=surfaces.find(m=>/draped wool skirt|woven wool (?:wrap|dress)/i.test(m.name));
  let waist=1.055;
  if(skirt){
    const p=skirt.getVerticesData(B.VertexBuffer.PositionKind);
    let top=0;
    for(let i=1;i<p.length;i+=3) top=Math.max(top,p[i]);
    waist=Math.min(1.125,Math.max(1.015,top-.012));
  }
  const levels=Array.from({length:10},()=>[]),anchors=[],parts=[];
  const yBin=y=>Math.max(0,Math.min(9,Math.floor((y-waist+.075)/.015)));
  const centre=.021;
  for (const part of surfaces) {
    const p = part.getVerticesData(B.VertexBuffer.PositionKind);
    const w = part.getVerticesData(B.VertexBuffer.MatricesWeightsKind);
    const j = part.getVerticesData(B.VertexBuffer.MatricesIndicesKind);
    const tri = part.getIndices();
    if (!p || !w || !j || !tri) continue;
    const surface = {p,w,j};
    // Native short sleeves and bare folded arms are both present in some
    // families. They must never become a fitting surface for the torso wrap.
    const arms = part.skeleton.bones.map(b=>/arm|hand|finger|thumb|index|pinky|middle|ring|head|neck/i.test(b.name));
    const deltoid = part.skeleton.bones.map(b=>/upperarm/i.test(b.name));
    const allowed = new Uint8Array(p.length/3);
    const arm=new Float32Array(allowed.length);
    for (let i=0; i<allowed.length; i++) {
      let armWeight=0;
      const x=p[i*3],y=p[i*3+1],z=p[i*3+2]-centre;
      const shoulder=y>1.29 && Math.abs(x)<.20;
      for(let k=0;k<4;k++){
        const joint=j[i*4+k];
        if(arms[joint] && !(shoulder && deltoid[joint])) armWeight+=w[i*4+k];
      }
      allowed[i]=armWeight < .42;
      arm[i]=armWeight;
      const radius=Math.hypot(x,z);
      if(allowed[i] && Math.abs(y-waist)<.09 && radius>.045 && radius<.29)
        anchors.push({surface,i,y,radius,sin:x/radius,cos:z/radius});
    }
    const lower=/draped wool skirt|woven wool (?:wrap|dress)|wool wrap/i.test(part.name);
    if(!hasUpper || !skinName.test(part.name)){
      parts.push({pos:p, normals:part.getVerticesData(B.VertexBuffer.NormalKind),tri,joints:j,weights:w,arm,lower,
        combined:!lower && !hasUpper});
    }
    for (let i=0; i<tri.length; i+=3) {
      const a=tri[i],b=tri[i+1],c=tri[i+2];
      const y0=p[a*3+1], y1=p[b*3+1], y2=p[c*3+1];
      const min=Math.min(y0,y1,y2),max=Math.max(y0,y1,y2);
      if(min>waist+.07 || max<waist-.07 || !allowed[a] || !allowed[b] || !allowed[c]) continue;
      const face={surface,a,b,c,y0,dy1:y1-y0,dy2:y2-y0,min,max};
      for (let k=yBin(min);k<=yBin(max);k++) levels[k].push(face);
    }
  }
  if (!levels.some(row=>row.length)) return null;
  function intersect(y,sin,cos) {
    let radius=0, hit=null;
    for (const face of levels[yBin(y)]) {
      if (y<face.min-.00001 || y>face.max+.00001) continue;
      const {surface:{p},a,b,c,y0,dy1,dy2}=face;
      const h=p[a*3]*cos-(p[a*3+2]-centre)*sin;
      const e=(p[b*3]-p[a*3])*cos-(p[b*3+2]-p[a*3+2])*sin;
      const f=(p[c*3]-p[a*3])*cos-(p[c*3+2]-p[a*3+2])*sin;
      const det=e*dy2-f*dy1;
      if (Math.abs(det)<1e-10) continue;
      const u=(-h*dy2-f*(y-y0))/det, v=(e*(y-y0)+h*dy1)/det;
      if (u<-.00001 || v<-.00001 || u+v>1.00001) continue;
      const t=1-u-v;
      const distance=(p[a*3]*t+p[b*3]*u+p[c*3]*v)*sin+
          (p[a*3+2]*t+p[b*3+2]*u+p[c*3+2]*v-centre)*cos;
      if (distance>radius) { radius=distance; hit={face,bary:[t,u,v],radius}; }
    }
    return hit;
  }
  function point(theta, height, clearance) {
    const sin=Math.sin(theta),cos=Math.cos(theta);
    let hit=intersect(height,sin,cos);
    if(!hit){
      // A split in the underlying waist wrap can leave a small open sector.
      // Take its stitched edge as an anchor for the continuous woven belt.
      let best,score=Infinity;
      for(const anchor of anchors){
        const error=(height-anchor.y)**2+(1-anchor.sin*sin-anchor.cos*cos)*.044;
        if(error<score){score=error;best=anchor;}
      }
      if(!best) return null;
      const {surface,i,radius}=best;
      hit={face:{surface,a:i,b:i,c:i},bary:[1,0,0],radius};
    }
    const mix=new Map(),{surface:{w,j},a,b,c}=hit.face;
    for(const [i,vertex] of [a,b,c].entries()){
      for(let k=0;k<4;k++){
        const influence=w[vertex*4+k]*hit.bary[i];
        if(influence>0){
          const joint=j[vertex*4+k];
          mix.set(joint,(mix.get(joint)||0)+influence);
        }
      }
    }
    const weights=[...mix].sort((a,b)=>b[1]-a[1]).slice(0,4);
    const total=weights.reduce((sum,entry)=>sum+entry[1],0);
    while(weights.length<4) weights.push([0,0]);
    const radius=hit.radius+clearance;
    return {xyz:[sin*radius,height,centre+cos*radius],joints:weights.map(e=>e[0]),weights:weights.map(e=>e[1]/total)};
  }
  return {point, waist, parts, patterns:new Map()};
}

function clipCloth(poly, distance) {
  if(!poly.length) return poly;
  const result=[];
  let previous=poly[poly.length-1], a=distance(previous);
  for(const current of poly){
    const b=distance(current);
    if((a>=0)!==(b>=0)){
      const t=a/(a-b);
      result.push(previous.map((value,k)=>value+(current[k]-value)*t));
    }
    if(b>=0) result.push(current);
    previous=current;a=b;
  }
  return result;
}

// The skirt folds move in different directions at the same height. Cutting
// each original triangle is essential: a quadrilateral spanning two moving
// pleats can pass behind a leg even when all four corners fit in the rest pose.
function tailoredPanels(fit,style,output) {
  const {positions,indices,uvs,colors,matricesIndices,matricesWeights,authoredNormals}=output;
  const waist=fit.waist, edge=.009;
  const at=(p)=>Math.atan2(p[0],p[2]-.021);
  for(const part of fit.parts){
    const {pos,normals,tri,joints,weights,arm,lower,combined}=part;
    const cuts=[];
    const shirt=!lower && !combined;
    if(style==='apron'){
      if(shirt) continue;
      // The return of the pleat swings forward as the knee rises. Continue
      // around each hip and down past that return, with hem ease for the knee.
      cuts.push(p=>waist+.020-p[1],p=>p[1]-(waist-.515+.024*(p[0]*p[0]/.047)+.013*p[0]),
                p=>p[2]+.016+.16*Math.abs(p[0]),p=>.224+.045*(waist-p[1])-Math.abs(p[0]-.008));
    } else if(style==='short'){
      if(shirt) continue;
      cuts.push(p=>waist+.018-p[1],p=>p[1]-(waist-.279+.056*Math.sin(at(p)+.35)));
    } else if(style==='sash'){
      const strip=p=>(p[0]-(.135-(p[1]-waist)*.70));
      if(shirt || combined) {
        cuts.push(p=>p[1]-waist+.005,p=>.039-strip(p),p=>.048+strip(p));
      } else {
        cuts.push(p=>waist+.01-p[1],p=>p[1]-waist+.245,p=>.16-p[0],p=>p[0]-.071,p=>p[2]-.047);
      }
    } else if(style==='mantle'){
      cuts.push(p=>1.366-.47*p[0]-p[1],p=>p[1]-(waist-.030+.30*p[0]));
    } else {
      cuts.push(p=>1.318-.63*p[0]-p[1],p=>p[1]-(waist-.112+.19*p[0]));
    }
    if(shirt || combined){
      // Keep the working arm free. At the top the sewn edge can legitimately
      // share weights with the deltoid where its surface turns over the shoulder.
      cuts.push(p=>.202-Math.abs(p[0]),p=>(p[1]>1.28 ? .80 : .35)-p[3]);
    }
    if(!combined && style!=='apron' && style!=='short'){
      if(lower) cuts.push(p=>waist+.009-p[1]);
      else cuts.push(p=>p[1]-(waist-.016));
    }
    const shared=new Map();
    for(let k=0;k<tri.length;k+=3){
      const corners=[tri[k],tri[k+1],tri[k+2]];
      let poly=corners.map((i,j)=>[pos[3*i],pos[3*i+1],pos[3*i+2],arm[i],Number(j===0),Number(j===1),Number(j===2)]);
      for(const rule of cuts){poly=clipCloth(poly,rule);if(!poly.length)break;}
      if(poly.length<3) continue;
      const loop=[];
      for(const p of poly){
        // UV islands and adjacent panels keep independent normals and shading.
        const full=p[4]>.99999?corners[0]:p[5]>.99999?corners[1]:p[6]>.99999?corners[2]:-1;
        if(full>=0&&shared.has(full)){loop.push(shared.get(full));continue;}
        const index=positions.length/3;
        loop.push(index);
        if(full>=0) shared.set(full,index);
        const n=[0,0,0], palette=new Map();
        for(let v=0;v<3;v++){
          const vertex=corners[v],blend=p[4+v];
          for(let axis=0;axis<3;axis++) n[axis]+=normals[vertex*3+axis]*blend;
          for(let influence=0;influence<4;influence++){
            const id=joints[vertex*4+influence],share=weights[vertex*4+influence]*blend;
            if(share>0) palette.set(id,(palette.get(id)||0)+share);
          }
        }
        const length=Math.hypot(...n)||1;
        for(let d=0;d<3;d++) n[d]/=length;
        const hem=Math.min(...cuts.slice(0,2).map(rule=>Math.abs(rule(p))));
        const along=at(p);
        const lining=.014+.005*(.5+.5*Math.cos(along*16+p[1]*2))*(lower?1:.4);
        const rolled=.003*Math.exp(-((hem-edge)**2)/.000036);
        // On shell boundaries source normals can belong to the horizontal
        // cut end; a radial component keeps the cloth just proud of that edge.
        const r=Math.hypot(p[0],p[2]-.021)||1;
        const ease=style==='apron' ? .016*Math.max(0,Math.min(1,(waist-p[1])/.30)) : 0;
        positions.push(p[0]+n[0]*(lining+rolled)*.72+p[0]/r*(.005+ease),
                       p[1]+n[1]*(lining+rolled)*.72,
                       p[2]+n[2]*(lining+rolled)*.72+(p[2]-.021)/r*(.005+ease));
        authoredNormals.set(index,n);
        const swatch=hem<.009 ? .75 : hem<.023 ? .89 : .98;
        colors.push(swatch,swatch,swatch,1);uvs.push(along*.93,p[1]*5);
        const top=[...palette].sort((a,b)=>b[1]-a[1]).slice(0,4);
        const total=top.reduce((sum,entry)=>sum+entry[1],0);
        while(top.length<4) top.push([0,0]);
        matricesIndices.push(...top.map(e=>e[0]));matricesWeights.push(...top.map(e=>e[1]/total));
      }
      for(let v=1;v<loop.length-1;v++) indices.push(loop[0],loop[v],loop[v+1]);
    }
  }
}

function cut(B, fit, style) {
  const data=new B.VertexData();
  const positions=[],indices=[],uvs=[],colors=[],matricesIndices=[],matricesWeights=[];
  const waist=fit.waist;
  function panel(columns, rows, profile, patterned=false) {
    const start=positions.length/3;
    for(let row=0;row<rows.length;row++) {
      const v=rows[row];
      for(let col=0;col<=columns;col++) {
        const u=col/columns;
        const {theta,y,lift,tone=1}=profile(u,v);
        const stitch=patterned && (row===1 || row===rows.length-2);
        const pt=fit.point(theta,y,lift);
        if (!pt) return false;
        positions.push(...pt.xyz); matricesIndices.push(...pt.joints); matricesWeights.push(...pt.weights);
        const shade=tone*(stitch ? .68 : 1);
        colors.push(shade,shade,shade,1);
        uvs.push(theta*.92, y*5);
        if (row && col) {
          const i=start+row*(columns+1)+col, a=i-columns-2, b=a+1, c=i-1;
          indices.push(a,c,b,b,c,i);
        }
      }
    }
    return true;
  }
  const authoredNormals=new Map();
  tailoredPanels(fit,style,{positions,indices,uvs,colors,matricesIndices,matricesWeights,authoredNormals});
  const firstBandIndex=indices.length;
  const belt=(u,v)=>{
    const theta=TAU*u-.45;
    const level=waist+.014*Math.sin(theta-.5)+.004*Math.cos(2*theta);
    const cord=.003*Math.cos(v*Math.PI*4);
    return {theta,y:level+(v-.5)*.061,lift:.022+cord,tone:.72+.19*v};
  };
  if(style!=='mantle' && !panel(46,[0,.075,.18,.42,.64,.83,.92,1],belt,true)) return null;
  const normals=[];
  B.VertexData.ComputeNormals(positions,indices,normals);
  // Babylon uses clockwise front faces. Keep the hand-cut pattern facing
  // outward in the same local frame as its source mesh.
  let direction=0;
  for(let i=authoredNormals.size*3;i<positions.length;i+=3)
    direction+=normals[i]*positions[i]+normals[i+2]*(positions[i+2]-.021);
  if(direction<0) {
    for(let i=firstBandIndex;i<indices.length;i+=3) [indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
    for(let i=authoredNormals.size*3;i<normals.length;i++) normals[i]*=-1;
  }
  for(const [i,n] of authoredNormals) for(let k=0;k<3;k++) normals[i*3+k]=n[k];
  Object.assign(data,{positions,normals,indices,uvs,colors,matricesIndices,matricesWeights});
  return data;
}

export function createProfessionClothing(B,scene,model,spec,material) {
  const meshes=model.getChildMeshes();
  const source=meshes.find(m=>m.skeleton && /native upper cloth/i.test(m.name))||
    meshes.find(m=>m.skeleton && outerCloth.test(m.name) && skinName.test(m.name))||
    meshes.find(m=>m.skeleton && outerCloth.test(m.name));
  if(!source?.geometry) return [];
  let fit=fits.get(source.geometry);
  if(!fit) {
    fit=buildFit(B,meshes,source);
    if(!fit) return [];
    fits.set(source.geometry,fit);
  }
  let cached=fit.patterns.get(spec.shape);
  if(!cached) {
    const data=cut(B,fit,spec.shape);
    if(!data) return [];
    cached={data,geometry:null};
    fit.patterns.set(spec.shape,cached);
  }
  const mesh=new B.Mesh('profession-upper-wrap-'+spec.id,scene);
  if(cached.geometry && !cached.geometry.isDisposed()) cached.geometry.applyToMesh(mesh);
  else { cached.data.applyToMesh(mesh); cached.geometry=mesh.geometry; }
  mesh.parent=source.parent;
  mesh.position.copyFrom(source.position);
  mesh.rotationQuaternion=source.rotationQuaternion?.clone()||null;
  mesh.rotation.copyFrom(source.rotation);
  mesh.scaling.copyFrom(source.scaling);
  mesh.skeleton=source.skeleton;
  mesh.material=material;
  material.backFaceCulling=false;
  mesh.receiveShadows=true;
  mesh.isPickable=true;
  mesh.metadata={profession:spec.id,clothShape:spec.shape,skinnedUpperCloth:true};
  return [mesh];
}

// The walking source includes separate folded collar facings in the shirt's
// UV islands. Lay only those islands into a narrow binding around their
// original sewn neckline. Full and reduced index buffers remain compatible.
export function openResidentNeckline(B, container) {
  const shirt=container?.meshes?.find?.(m=>m && /native upper cloth/i.test(m.name));
  if(!B?.VertexBuffer || typeof shirt?.getVerticesData!=='function' || typeof shirt.getIndices!=='function' || typeof shirt.setVerticesData!=='function') return;
  const positionKind=B.VertexBuffer.PositionKind, normalKind=B.VertexBuffer.NormalKind;
  const positions=shirt.getVerticesData(positionKind)?.slice(), normals=shirt.getVerticesData(normalKind)?.slice();
  const indices=shirt.getIndices(), joints=shirt.getVerticesData(B.VertexBuffer.MatricesIndicesKind)?.slice();
  const weights=shirt.getVerticesData(B.VertexBuffer.MatricesWeightsKind)?.slice();
  if(!positions?.length || positions.length%3 || normals?.length!==positions.length ||
     !indices?.length || indices.length%3 || joints?.length!==positions.length/3*4 || weights?.length!==joints.length) return;
  const count=positions.length/3, roots=Int32Array.from({length:count},(_,i)=>i);
  function root(i){while(roots[i]!==i){roots[i]=roots[roots[i]];i=roots[i];}return i;}
  for(let i=0;i<indices.length;i+=3){
    const parent=root(indices[i]);roots[root(indices[i+1])]=parent;roots[root(indices[i+2])]=parent;
  }
  const groups=new Map();
  for(let i=0;i<count;i++){
    const key=root(i);
    if(!groups.has(key)) groups.set(key,[]);
    groups.get(key).push(i);
  }
  const collar=new Set();
  for(const group of groups.values()){
    if(group.every(i=>Math.abs(positions[i*3])<.08 && positions[i*3+1]>1.344))
      for(const i of group) collar.add(i);
  }
  if(!collar.size) return;
  // Paired UV seam vertices on the uncut bodice identify the opening on both
  // adult bodies, including the lower tip of the notched front.
  const seam=[];
  for(const i of collar){
    let match=-1, nearest=.0015**2;
    for(let k=0;k<count;k++){
      if(collar.has(k)) continue;
      const d=(positions[i*3]-positions[k*3])**2+(positions[i*3+1]-positions[k*3+1])**2+(positions[i*3+2]-positions[k*3+2])**2;
      if(d<nearest){match=k;nearest=d;}
    }
    if(match>=0 && !seam.includes(match)) seam.push(match);
  }
  if(seam.length<8) return;
  const zValues=seam.map(i=>positions[i*3+2]);
  const centre=(Math.max(...zValues)+Math.min(...zValues))*.5;
  const angle=i=>Math.atan2(positions[i*3],positions[i*3+2]-centre);
  const ring=seam.map(i=>({i,theta:angle(i)})).sort((a,b)=>a.theta-b.theta);
  ring.push({...ring[0],theta:ring[0].theta+TAU});
  for(const i of collar){
    let theta=angle(i);
    if(theta<ring[0].theta) theta+=TAU;
    const hi=ring.findIndex(v=>v.theta>=theta);
    const a=ring[Math.max(0,hi-1)],b=ring[Math.max(0,hi)];
    const blend=b.theta===a.theta?0:(theta-a.theta)/(b.theta-a.theta);
    const p=[0,1,2].map(k=>positions[a.i*3+k]*(1-blend)+positions[b.i*3+k]*blend);
    const d=Math.hypot(p[0]-positions[i*3],p[1]-positions[i*3+1],p[2]-positions[i*3+2]);
    const turn=Math.min(1,d/.032);
    positions[i*3]=p[0]*(1-.08*turn);positions[i*3+1]=p[1]+.0038*turn;
    positions[i*3+2]=centre+(p[2]-centre)*(1-.08*turn);
    for(let k=0;k<3;k++) normals[i*3+k]=normals[a.i*3+k]*(1-blend)+normals[b.i*3+k]*blend;
    // The nearest side of this small hem supplies its existing neck weights.
    const anchor=blend<.5?a.i:b.i;
    for(let k=0;k<4;k++){joints[i*4+k]=joints[anchor*4+k];weights[i*4+k]=weights[anchor*4+k];}
  }
  shirt.setVerticesData(positionKind,positions);
  shirt.setVerticesData(normalKind,normals);
  shirt.setVerticesData(B.VertexBuffer.MatricesIndicesKind,joints);
  shirt.setVerticesData(B.VertexBuffer.MatricesWeightsKind,weights);
}
