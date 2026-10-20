import {WIDTH, HEIGHT, river} from '../world.js';
import {generateStreets} from '../city-life.js';

export const TILE = 6;
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
const noise = (x,y) => {const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};

// Positive on dry land. Lake outlines retain the actual saved cell footprint.
export function shoreDistance(x,y,s) {
  let d=Math.abs(x-river(y))-1.1;
  for(const lake of s?.world?.lakes||[])for(const c of lake.cells){
    const qx=Math.abs(x-c.x)-.5,qy=Math.abs(y-c.y)-.5;
    d=Math.min(d,Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0));
  }
  return d;
}
export function surfaceElevation(x,y,s) {
  const d=shoreDistance(x,y,s);
  if(d<.22)return -.88+.88*smooth((d+.35)/.57);
  // Only the uninhabited edges rise; all occupied tiles retain a level foundation.
  const edge=Math.min(x+.5,WIDTH-.5-x,y+.5,HEIGHT-.5-y);
  const dune=smooth((3.4-edge)/3.4)*(.18+.30*Math.sin(x*.52+y*.26)**2);
  const nearBuilding=(s?.buildings||[]).some(b=>Math.abs(b.x-x)<1.2&&Math.abs(b.y-y)<1.2);
  return nearBuilding?0:dune;
}
export function districtRoadEdges(s) {
  return generateStreets([...(s?.buildings||[]),...(s?.roadAnchors||[])],s).edges;
}

export function createDistrictTerrain(B,scene,initialState,materials) {
  const meshes=[],ownedMaterials=[],textures=[];
  let state=initialState,roadMeshes=[],roadSignature='',waterTime=0;
  const C=(r,g,b)=>new B.Color3(r,g,b);
  const geometry=(name,positions,indices,material,colors)=>{
    const mesh=new B.Mesh(name,scene),data=new B.VertexData();
    data.positions=positions;data.indices=indices;data.uvs=[];data.normals=[];
    for(let i=0;i<positions.length;i+=3)data.uvs.push(positions[i]/(name.includes('grass')?8:4.5),positions[i+2]/(name.includes('grass')?8:4.5));
    B.VertexData.ComputeNormals(positions,indices,data.normals);
    // Babylon's left-handed front winding differs from a right-handed cross product.
    // All meshes made here are ground/water ribbons whose visible side must face up.
    if(data.normals.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0){
      for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      B.VertexData.ComputeNormals(positions,indices,data.normals);
    }
    if(colors)data.colors=colors;
    data.applyToMesh(mesh);mesh.material=material;mesh.isPickable=false;mesh.receiveShadows=true;
    if(colors)mesh.useVertexColors=true;
    meshes.push(mesh);return mesh;
  };
  const merge=(name,parts,material)=>{
    if(!parts.length)return null;
    const merged=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);
    merged.name=name;merged.material=material;merged.isPickable=false;merged.receiveShadows=true;
    merged.freezeWorldMatrix();meshes.push(merged);return merged;
  };
  // Dense enough to soften banks without exposing the logical tile boundaries.
  const nx=WIDTH*4,ny=HEIGHT*4,p=[],idx=[],colors=[];
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=-.5+WIDTH*i/nx,y=-.5+HEIGHT*j/ny,h=surfaceElevation(x,y,state),d=shoreDistance(x,y,state);
    p.push(x*TILE,h,y*TILE);
    const fertile=smooth((4.3-Math.abs(x-river(y)))/3),fleck=noise(x*1.3,y*1.3)*.055;
    const wet=1-smooth((d+.05)/.7);
    colors.push(.92-fertile*.20-wet*.20+fleck,.83-fertile*.09-wet*.17+fleck,.64-fertile*.12-wet*.12+fleck,1);
    if(i<nx&&j<ny){const a=j*(nx+1)+i;idx.push(a,a+nx+1,a+1,a+1,a+nx+1,a+nx+2);}
  }
  geometry('alluvial-valley',p,idx,materials.soil,colors).freezeWorldMatrix();
  const water=new B.PBRMaterial('river-water',scene);ownedMaterials.push(water);
  water.albedoColor=C(.16,.32,.30);water.metallic=.08;water.roughness=.3;
  water.alpha=.94;water.backFaceCulling=false;water.environmentIntensity=.8;
  // A shared small procedural normal map gives quiet moving ripples, no geometry rebuild.
  if(B.DynamicTexture&&typeof document!=='undefined'){
    const tex=new B.DynamicTexture('water-ripple-normal',{width:128,height:128},scene,false);
    const ctx=tex.getContext(),pixels=ctx.createImageData(128,128);
    for(let y=0;y<128;y++)for(let x=0;x<128;x++){
      const i=(y*128+x)*4;
      pixels.data[i]=128+Math.round(13*Math.cos(y*Math.PI/8+x*Math.PI/32));
      pixels.data[i+1]=128+Math.round(18*Math.cos(x*Math.PI/16+y*Math.PI/8));
      pixels.data[i+2]=253;pixels.data[i+3]=255;
    }
    ctx.putImageData(pixels,0,0);tex.update();tex.uScale=16;tex.vScale=20;
    water.bumpTexture=tex;tex.level=.22;textures.push(tex);
  }
  const wp=[],wi=[],uv=[];
  for(let j=0;j<=HEIGHT*12;j++){
    const y=-.5+j/12,c=river(y);
    for(const x of [c-1.1,c+1.1]){wp.push(x*TILE,-.18,y*TILE);uv.push(x/WIDTH,(y+.5)/HEIGHT);}
    if(j<HEIGHT*12){const a=j*2;wi.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const riverMesh=geometry('living-river',wp,wi,water);
  riverMesh.setVerticesData(B.VertexBuffer.UVKind,uv);riverMesh.receiveShadows=false;
  const lp=[],li=[],lu=[];
  for(const lake of state?.world?.lakes||[])for(const c of lake.cells){
    const a=lp.length/3;
    for(const [dx,dy]of [[-.5,-.5],[-.5,.5],[.5,-.5],[.5,.5]]){const x=c.x+dx,y=c.y+dy;lp.push(x*TILE,-.18,y*TILE);lu.push(x/WIDTH,y/HEIGHT);}
    li.push(a,a+1,a+2,a+2,a+1,a+3);
  }
  if(li.length){const lake=geometry('saved-lakes',lp,li,water);lake.setVerticesData(B.VertexBuffer.UVKind,lu);lake.receiveShadows=false;}
  const trunks=[],fronds=[],reeds=[],stones=[],scrub=[];
  const initialRoads=districtRoadEdges(state);
  const occupied=(x,y)=>state.buildings?.some(b=>Math.abs(b.x-x)<.7&&Math.abs(b.y-y)<.7)||initialRoads.some(([a,b])=>{
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy));
    return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<.22;
  });
  // A continuous riparian mantle: alpha follows distance, never the logical cell grid.
  // It fades around real plots and paths, leaving their baked-earth foundations clear.
  const grassMaterial=materials.grass.clone('riparian-grass-cover');ownedMaterials.push(grassMaterial);
  grassMaterial.albedoColor=C(.79,.90,.56);grassMaterial.roughness=1;grassMaterial.metallic=0;
  grassMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  grassMaterial.alpha=.96;grassMaterial.forceDepthWrite=false;
  const gp=[],gi=[],gc=[];
  const grassAlpha=(x,y)=>{
    const d=shoreDistance(x,y,state);
    let alpha=smooth((d-.22)/.38)*(1-smooth((d-2.7)/1.3));
    for(const b of state.buildings||[]){
      const qx=Math.abs(x-b.x)-.56,qy=Math.abs(y-b.y)-.56;
      const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);
      alpha*=smooth(distance/.28);
    }
    for(const [a,b] of initialRoads){
      const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy));
      alpha*=smooth((Math.hypot(x-a.x-dx*t,y-a.y-dy*t)-.12)/.12);
    }
    return alpha;
  };
  for(let j=0;j<=ny;j++)for(let i=0;i<=nx;i++){
    const x=-.5+WIDTH*i/nx,y=-.5+HEIGHT*j/ny,variation=.93+noise(x*.3,y*.3)*.07;
    gp.push(x*TILE,surfaceElevation(x,y,state)+.018,y*TILE);
    gc.push(variation*.88,variation,variation*.79,grassAlpha(x,y));
  }
  for(let j=0;j<ny;j++)for(let i=0;i<nx;i++){
    const a=j*(nx+1)+i,b=a+nx+1;
    if([a,b,a+1,b+1].every(k=>gc[k*4+3]===0))continue;
    gi.push(a,b,a+1,a+1,b,b+1);
  }
  if(gi.length){const grass=geometry('soft-riparian-grass',gp,gi,grassMaterial,gc);grass.hasVertexAlpha=true;grass.freezeWorldMatrix();}
  const palmMaterial=new B.PBRMaterial('living-date-palm-leaves',scene);ownedMaterials.push(palmMaterial);
  palmMaterial.albedoColor=C(.16,.25,.075);palmMaterial.roughness=.88;palmMaterial.metallic=0;
  const cylinder=(name,x,y,z,h,r1,r2,parts)=>{
    const m=B.MeshBuilder.CreateCylinder(name,{height:h,diameterTop:r1*2,diameterBottom:r2*2,tessellation:6},scene);
    m.position.set(x,y+h/2,z);parts.push(m);return m;
  };
  const leaf=(name,points,width,parts)=>{
    const positions=[],indices=[],dx=points.at(-1)[0]-points[0][0],dz=points.at(-1)[2]-points[0][2];
    const length=Math.hypot(dx,dz)||1,px=-dz/length,pz=dx/length;
    for(let i=0;i<points.length;i++){
      const q=points[i],w=width*Math.max(.04,Math.sin(Math.PI*i/(points.length-1)));
      positions.push(q[0]-px*w,q[1],q[2]-pz*w,q[0]+px*w,q[1],q[2]+pz*w);
      if(i<points.length-1){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
    }
    const normals=[];B.VertexData.ComputeNormals(positions,indices,normals);
    // Separate vertices on the back prevent cancelling normals on thin leaves.
    const vertexCount=positions.length/3,backIndices=[];
    for(let i=0;i<indices.length;i+=3)backIndices.push(indices[i]+vertexCount,indices[i+2]+vertexCount,indices[i+1]+vertexCount);
    positions.push(...positions);normals.push(...normals.map(n=>-n));indices.push(...backIndices);
    const mesh=new B.Mesh(name,scene),data=new B.VertexData();
    data.positions=positions;data.indices=indices;data.uvs=new Array(positions.length/3*2).fill(0);data.normals=normals;data.applyToMesh(mesh);parts.push(mesh);
  };
  // Date palms, tamarisk-like scrub and marsh reeds; no temperate conifers.
  for(let y=0;y<HEIGHT;y++)for(let x=0;x<WIDTH;x++){
    const xx=x+(noise(x,y)-.5)*.65,yy=y+(noise(y,x+6)-.5)*.65,d=shoreDistance(xx,yy,state),r=noise(x+3,y+7);
    if(d<.24||occupied(xx,yy))continue;
    const X=xx*TILE,Z=yy*TILE,Y=surfaceElevation(xx,yy,state);
    const nearQuarter=xx>=5.5&&xx<=12.5&&yy>=6.5&&yy<=11.5;
    if((d<6&&r>.92)||(nearQuarter&&r>.68)){
      const h=5+noise(x+7,y)*3;
      cylinder('date-palm-trunk',X,Y,Z,h,.14,.28,trunks);
      for(let n=0;n<10;n++){
        const a=n*Math.PI*.2+noise(x,y),len=2.6+noise(n+x,y)*1.1,pts=[];
        for(let k=0;k<6;k++){const t=k/5;pts.push([X+Math.cos(a)*len*t,Y+h+.85*Math.sin(t*Math.PI)-.9*t*t,Z+Math.sin(a)*len*t]);}
        leaf('date-palm-frond',pts,.32,fronds);
      }
    }else if(d<1.25&&r>.24){
      for(let n=0;n<7;n++){
        const a=n*2.4,dx=Math.cos(a)*noise(x+n,y)*.7,dz=Math.sin(a)*.65,h=.8+noise(x,y+n)*1.2;
        cylinder('marsh-reed',X+dx,Y,Z+dz,h,.025,.045,reeds);
        leaf('reed-leaf',[[X+dx,Y+h*.4,Z+dz],[X+dx+.3,Y+h*.85,Z+dz+.15],[X+dx+.55,Y+h*.75,Z+dz+.25]],.07,reeds);
      }
    }else if(r>.88&&r<.94){
      const m=B.MeshBuilder.CreateIcoSphere('alluvial-stone',{radius:.22+noise(x,y)*.24,subdivisions:1},scene);
      m.position.set(X,Y+.07,Z);m.scaling.set(1.6,.55,1);m.rotation.y=r*30;stones.push(m);
    }else if(d<5&&r>.64&&r<.73){
      for(let n=0;n<4;n++){
        const a=n*2.4,h=.35+noise(x+n,y)*.45;
        leaf('dry-grass',[[X,Y,Z],[X+Math.cos(a)*.22,Y+h,Z+Math.sin(a)*.22],[X+Math.cos(a)*.5,Y+h*.6,Z+Math.sin(a)*.5]],.11,scrub);
      }
    }
  }
  merge('date-palm-trunks',trunks,materials.wood);
  merge('date-palm-crowns',fronds,palmMaterial);
  merge('river-reed-beds',reeds,materials.reed);
  merge('alluvial-stones',stones,materials.stone);
  merge('valley-scrub',scrub,materials.grass);
  const roadMaterial=new B.PBRMaterial('worn-earth-streets',scene);ownedMaterials.push(roadMaterial);
  roadMaterial.albedoColor=C(.53,.39,.25);roadMaterial.roughness=1;roadMaterial.metallic=0;
  if(materials.soil?.albedoTexture)roadMaterial.albedoTexture=materials.soil.albedoTexture;
  function updateRoads(s){
    const signature=JSON.stringify([s.buildings?.map(b=>[b.type,b.x,b.y,!!b.construction]),s.roadAnchors,s.roads?.map(r=>[r.id,r.level,!!r.construction])]);
    if(signature===roadSignature)return;roadSignature=signature;
    for(const m of roadMeshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}roadMeshes=[];
    const pos=[],inds=[];
    for(const [a,b]of districtRoadEdges(s)){
      // The bridge module owns the elevated crossing itself.
      if(shoreDistance((a.x+b.x)/2,(a.y+b.y)/2,s)<.08)continue;
      const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),w=.52,nx=-dy/len*w,nz=dx/len*w;
      const k=pos.length/3;
      for(const [t,side]of [[0,-1],[0,1],[1,-1],[1,1]]){
        const x=(a.x+dx*t)*TILE+nx*side,y=(a.y+dy*t)*TILE+nz*side;
        pos.push(x,Math.max(.026,surfaceElevation(x/TILE,y/TILE,s)+.026),y);
      }
      inds.push(k,k+2,k+1,k+1,k+2,k+3);
    }
    if(inds.length)roadMeshes.push(geometry('connected-earth-streets',pos,inds,roadMaterial));
  }
  updateRoads(state);
  return {meshes,update(s,t){state=s;updateRoads(s);const time=Number.isFinite(t)?t:waterTime+.016;waterTime=time;if(water.bumpTexture){water.bumpTexture.uOffset=time*.002;water.bumpTexture.vOffset=time*.001;}},dispose(){for(const m of meshes)m.dispose();for(const m of ownedMaterials)m.dispose(false,false);for(const t of textures)t.dispose();meshes.length=0;}};
}
