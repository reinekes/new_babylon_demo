import {roadIsBuilt} from '../roads.js';
import {footprintSize} from '../footprints.js';
import {isStrictSumer} from '../scenario-profiles.js';
import {createAlluvialWaterMaterial} from '../game3d/alluvial-water.js';
import {mineralExcavations,openMineralCells} from '../game3d/mineral-excavation.js';
import {mineralSiteView} from './mineral-sites.js';
import {refineLakeBedGrid} from './lake-bed-grid.js';
import {worldWidth,worldHeight,river,riverAxis,riverLength,riverAcrossSize,worldFromRiver,signedRiverDistance} from '../world.js';
import {generateStreets} from '../city-life.js';
import {cachedStreetsFor} from '../workforce.js';
import {RIVER_BANK_SECTION,riverRows,riverStepsPerTile,SCENERY_MARGIN} from './river-profile.js';

export const TILE = 6;
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const smooth = v => {v=clamp(v);return v*v*(3-2*v);};
const noise = (x,y) => {const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};

// Positive on dry land. Lake outlines retain the actual saved cell footprint.
export function shoreDistance(x,y,s) {
  let d=Math.abs(signedRiverDistance(x,y,s))-1.1;
  for(const lake of s?.world?.lakes||[])for(const c of lake.cells){
    const qx=Math.abs(x-c.x)-.5,qy=Math.abs(y-c.y)-.5;
    const lower=Math.max(qx,qy);
    if(lower>d)continue;
    d=Math.min(d,lower<=0?lower:Math.hypot(Math.max(qx,0),Math.max(qy,0)));
  }
  return d;
}
export function surfaceElevation(x,y,s) {
  return surfaceElevationFromShore(x,y,s,shoreDistance(x,y,s));
}
function dryRelief(x,y,s,d){
  if(d<3.4)return 0;
  const phase=((s?.world?.seed||0)%179)*.19;
  // Two long, softly broken wind-aligned ridges ride a broad low rise. Valley
  // floors next to every river or lake are continuously blended to flat.
  const along=x*.24-y*.35+phase,across=x*.53+y*.32+Math.sin(along*.65)*.64;
  const ridge=smooth((Math.sin(across)-.10)/.90),swell=smooth((Math.sin(along*.48)+.55)/1.55);
  const mound=smooth((Math.sin(x*.16+y*.23+phase*.8)*Math.cos(x*.22-y*.16)-.1)/.90);
  return (ridge*(.72+1.68*swell)+mound*.67)*smooth((d-3.4)/5.5);
}
function occupiedReliefWeight(x,y,s){
  let weight=1;
  for(const b of s?.buildings||[]){
    const size=footprintSize(b),qx=Math.max(b.x-.5-x,x-(b.x+size-.5),0),qy=Math.max(b.y-.5-y,y-(b.y+size-.5),0);
    if(qx>=1.6||qy>=1.6)continue;
    weight=Math.min(weight,smooth(Math.hypot(qx,qy)/1.6));
    if(weight===0)return 0;
  }
  return weight;
}
function surfaceElevationFromShore(x,y,s,d){
  if(d<.22)return -.88+.88*smooth((d+.35)/.57);
  const relief=dryRelief(x,y,s,d);
  return relief?relief*occupiedReliefWeight(x,y,s):0;
}
export function districtRoadEdges(s) {
  return (cachedStreetsFor(s)||generateStreets([...(s?.buildings||[]),...(s?.roadAnchors||[])],s)).edges;
}

// Grass/obstacle masks only depend on roads within .24 tiles. Keep source order
// and the exact distance test; this index only rejects distant segments.
export function indexNearbyRoads(edges){
  const cells=new Map(),size=2,padding=.24;
  for(const edge of edges){const [a,b]=edge;
    for(let y=Math.floor((Math.min(a.y,b.y)-padding)/size);y<=Math.floor((Math.max(a.y,b.y)+padding)/size);y++)for(let x=Math.floor((Math.min(a.x,b.x)-padding)/size);x<=Math.floor((Math.max(a.x,b.x)+padding)/size);x++){
      const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(edge);
    }
  }
  return (x,y)=>cells.get(`${Math.floor(x/size)},${Math.floor(y/size)}`)||[];
}

const unique=values=>[...new Set(values.map(x=>Math.round(x*1e9)/1e9))].sort((a,b)=>a-b);
export function sceneryColumns(size){
 return [-36.5,-24.5,-12.5,-6.5,-4.5,-2.5,-1.5,-.5,size-.5,size+.5,size+1.5,size+3.5,size+5.5,size+11.5,size+23.5,size+35.5];
}
const sectionCache=new Map();
function sectionCoordinates(s){
 const size=riverAcrossSize(s),steps=riverStepsPerTile(s),key=`${size}/${steps}`;
 if(!sectionCache.has(key))sectionCache.set(key,{inner:Array.from({length:size*steps+1},(_,i)=>-.5+i/steps),outer:sceneryColumns(size)});
 return sectionCache.get(key);
}
function terrainRowXs(y,dense,min,max,s){
 const bank=RIVER_BANK_SECTION.map(x=>river(y,s)+x),sections=sectionCoordinates(s);
 // The top/bottom rim touches both dense playable ground and coarse side dunes.
 // Keep both sets there so adjacent strips share segments, not T-junctions.
 return unique([...sections.outer,...(dense?sections.inner:[]),...bank,min,max].filter(x=>x>=min&&x<=max));
}
// Keep the near crest and river bed at the rim, then flatten the dry crest
// into broad relief that the coarser exterior grid can actually represent.
export function alluvialHeight(x,y,s,d=shoreDistance(x,y,s)){
 const near=surfaceElevationFromShore(x,y,s,d);
 const outside=Math.max(0,-.5-x,x-(worldWidth(s)-.5),-.5-y,y-(worldHeight(s)-.5));
 if(!outside||d<.22)return near;
 // Keep dune crests through the near background and soften them toward the
 // outer grid, where only the largest landforms can be represented.
 const plain=(.21+.72*(.5+.5*Math.sin(x*.037+y*.026)*Math.sin(y*.044-x*.021)))*smooth((d-3.4)/5.5);
 const blend=smooth((outside-8)/23);
 return near+(plain-near)*blend;
}
export function alluvialNormal(x,y,s){const e=.02,dx=(alluvialHeight(x+e,y,s)-alluvialHeight(x-e,y,s))/(2*e*TILE),dz=(alluvialHeight(x,y+e,s)-alluvialHeight(x,y-e,s))/(2*e*TILE),length=Math.hypot(dx,1,dz);return [-dx/length,1/length,-dz/length];}
export function alluvialColor(x,y,s,d=shoreDistance(x,y,s)){
 // Moisture darkens the same sediment through the river and lake margins.
 // Dune slopes already catch directional light through their surface normals.
 const moisture=1-smooth((d+.12)/2.6),wet=1-smooth((d+.10)/.60);
 // Silt beds can extend across several plots. Interpolate one world-locked
 // field so the small repeat of the grain atlas cannot stamp out the bed.
 const u=x*.29+y*.11,v=y*.29-x*.11,i=Math.floor(u),j=Math.floor(v);
 const a=smooth(u-i),b=smooth(v-j);
 const near=noise(i,j)*(1-a)+noise(i+1,j)*a,far=noise(i,j+1)*(1-a)+noise(i+1,j+1)*a;
 const tone=.066*((1-b)*near+b*far-.5);
 return [.94-.09*moisture-.11*wet+tone,.90-.06*moisture-.10*wet+tone*.89,.80-.04*moisture-.08*wet+tone*.73,1];
}
function terrainVertex(g,x,y,s,scenery){
 const d=shoreDistance(x,y,s);
 const h=scenery?alluvialHeight(x,y,s,d):surfaceElevationFromShore(x,y,s,d);
 g.positions.push(x*TILE,h,y*TILE);
 g.normals??=[];
 g.normals.push(...alluvialNormal(x,y,s));
 g.colors.push(...alluvialColor(x,y,s,d));
}
function stripGeometry(g,rows,xs,s,scenery){
 // Produce upward Babylon winding at the source. Both the refined bed and
 // road-masked grass can now derive independent topologies from the same strip.
 let previous=null;const triangle=(a,b,c)=>riverAxis(s)==='x'?g.indices.push(a,b,c):g.indices.push(a,c,b);
 for(const y of rows){const coordinates=xs(y),start=g.positions.length/3;for(const across of coordinates){const p=worldFromRiver(across,y,s);terrainVertex(g,p.x,p.y,s,scenery);}
  const row={coordinates,start};if(previous){let a=0,b=0;while(a<previous.coordinates.length-1||b<coordinates.length-1){
   if(a===previous.coordinates.length-1||(b<coordinates.length-1&&coordinates[b+1]<previous.coordinates[a+1])){triangle(previous.start+a,start+b,start+b+1);b++;}
   else{triangle(previous.start+a,start+b,previous.start+a+1);a++;}
  }}previous=row;
 }
}
export function alluvialTerrainGeometry(s){
 const g={positions:[],indices:[],colors:[]};stripGeometry(g,riverRows(false,s),y=>terrainRowXs(y,true,-.5,riverAcrossSize(s)-.5,s),s,false);
 return g;
}
export function alluvialSceneryGeometry(s){
 const g={positions:[],indices:[],colors:[]},rows=riverRows(true,s),main=riverRows(false,s);
 const min=-.5-SCENERY_MARGIN,max=riverAcrossSize(s)-.5+SCENERY_MARGIN;
 const rim=y=>y===-.5||y===riverLength(s)-.5;
 const xs=y=>terrainRowXs(y,rim(y),min,max,s);
 stripGeometry(g,rows.filter(y=>y<=-.5),xs,s,true);
 stripGeometry(g,rows.filter(y=>y>=riverLength(s)-.5),xs,s,true);
 for(const [a,b]of [[min,-.5],[riverAcrossSize(s)-.5,max]])stripGeometry(g,main,y=>terrainRowXs(y,false,a,b,s),s,true);
 return g;
}

export function createDistrictTerrain(B,scene,initialState,materials,{renderRoads=true,finishedRoadsOnly=false,curvedLakeBeds=false}={}) {
  const meshes=[],ownedMaterials=[],textures=[];
  let state=initialState,roadMeshes=[],roadSignature='',waterTime=0;
  const leafBatches=new Map();
  const C=(r,g,b)=>new B.Color3(r,g,b);
  const geometry=(name,positions,indices,material,colors,sharedNormals)=>{
    const mesh=new B.Mesh(name,scene),data=new B.VertexData();
    data.positions=positions;data.indices=indices;data.uvs=[];data.normals=[];
    const floodplain=name==='alluvial-valley'||name==='distant-alluvial-plain',tileScale=name.includes('grass')?8:4.5;
    for(let i=0;i<positions.length;i+=3){
      const x=positions[i],z=positions[i+2];
      // A single, metric projection keeps grains the same size across both
      // meshes, even on distant triangles with very different edge lengths.
      if(floodplain)data.uvs.push((.93*x+.37*z)/3.4,(.93*z-.37*x)/3.4);
      else data.uvs.push(x/tileScale,z/tileScale);
    }
    B.VertexData.ComputeNormals(positions,indices,data.normals);
    // Babylon's left-handed front winding differs from a right-handed cross product.
    // All meshes made here are ground/water ribbons whose visible side must face up.
    if(data.normals.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0){
      for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
      B.VertexData.ComputeNormals(positions,indices,data.normals);
    }
    if(sharedNormals)data.normals=sharedNormals;
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
  // Extra columns follow the exact water cross-section, so coarse land triangles
  // cannot poke through the separate transparent river as angular dry patches.
  const ground=alluvialTerrainGeometry(state),background=alluvialSceneryGeometry(state);
  let bed=ground;
  if(curvedLakeBeds&&state.world?.lakes?.length){
    // Only the detailed soil is carved to the organic contour. Grass retains
    // its original fixed topology so a later wet/dry mask can reuse its mesh.
    bed={positions:ground.positions.slice(),normals:ground.normals.slice(),colors:ground.colors.slice(),indices:ground.indices};
    refineLakeBedGrid(bed,state,TILE,worldWidth(state),worldHeight(state));
  }
  const pits=mineralExcavations(state);
  const mineralView=mineralSiteView(B,scene,state,materials,pits,TILE,surfaceElevation,alluvialColor);
  meshes.push(...mineralView.meshes);ownedMaterials.push(mineralView.material);
  geometry('alluvial-valley',bed.positions,openMineralCells(bed,pits,TILE),materials.soil,bed.colors,bed.normals).freezeWorldMatrix();
  geometry('distant-alluvial-plain',background.positions,background.indices,materials.soil,background.colors,background.normals).freezeWorldMatrix();
  const surface=createAlluvialWaterMaterial(B,scene,'river-water'),water=surface.material;
  surface.update(state,0);
  const wp=[],wi=[],wc=[];
  const waterRows=riverRows(true,state),cross=[-1.145,-.94,0,.94,1.145];
  for(let j=0;j<waterRows.length;j++){
    const along=waterRows[j],center=river(along,state);
    for(let col=0;col<cross.length;col++){
      const p=worldFromRiver(center+cross[col],along,state);
      wp.push(p.x*TILE,-.18,p.y*TILE);
      wc.push(Math.max(0,-.18-surfaceElevationFromShore(p.x,p.y,state,Math.abs(cross[col])-1.1)),0,0,1);
      if(j<waterRows.length-1&&col<cross.length-1){
        const i=j*cross.length+col;wi.push(i,i+cross.length,i+1,i+1,i+cross.length,i+cross.length+1);
      }
    }
  }
  geometry('living-river',wp,wi,water,wc).receiveShadows=false;
  const lp=[],li=[],lc=[];
  for(const lake of state?.world?.lakes||[]){
    const cells=new Set(lake.cells.map(c=>c.x+','+c.y));
    for(const {x,y} of lake.cells){
      const center=lp.length/3;
      lp.push(x*TILE,-.18,y*TILE);lc.push(.7,1,0,1);
      for(const [dx,dy]of [[-.5,-.5],[-.5,0],[-.5,.5],[0,.5],[.5,.5],[.5,0],[.5,-.5],[0,-.5]]){
        const adjacent=cells.has((x+dx*2)+','+y)&&cells.has(x+','+(y+dy*2))&&cells.has((x+dx*2)+','+(y+dy*2));
        lp.push((x+dx)*TILE,-.18,(y+dy)*TILE);
        lc.push(adjacent?.7:0,1,0,1);
      }
      for(let i=0;i<8;i++)li.push(center,center+1+i,center+1+(i+1)%8);
    }
  }
  if(li.length)geometry('saved-lakes',lp,li,water,lc).receiveShadows=false;
  const trunks=[],fronds=[],reeds=[],stones=[],scrub=[];
  let initialRoads=districtRoadEdges(state),nearbyRoads=indexNearbyRoads(initialRoads);
  const occupied=(x,y)=>state.buildings?.some(b=>Math.abs(b.x-x)<.7&&Math.abs(b.y-y)<.7)||nearbyRoads(x,y).some(([a,b])=>{
    const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy));
    return Math.hypot(x-a.x-dx*t,y-a.y-dy*t)<.22;
  });
  // A continuous riparian mantle: alpha follows distance, never the logical cell grid.
  // It fades around real plots and paths, leaving their baked-earth foundations clear.
  const grassMaterial=materials.grass.clone('riparian-grass-cover');ownedMaterials.push(grassMaterial);
  grassMaterial.albedoColor=C(.79,.90,.56);grassMaterial.roughness=1;grassMaterial.metallic=0;
  grassMaterial.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
  // The ground below already darkens with moisture. Give the living stems
  // their own silhouettes and leave only a faint ground tint between them.
  grassMaterial.alpha=.29;grassMaterial.forceDepthWrite=false;
  const gp=[],gi=[],gc=[],staticGrassAlpha=[];
  const grassStaticSignature=s=>JSON.stringify([worldWidth(s),worldHeight(s),s.world?.river,s.world?.lakes,(s.buildings||[]).map(b=>[b.x,b.y])]);
  const grassGroundAlpha=(x,y)=>{
    const d=shoreDistance(x,y,state);
    // The grass cover sits above two terrain meshes with different tessellation.
    // Let the shared soil carry their seam, and blend the cover back on both sides.
    const edge=Math.min(x+.5,worldWidth(state)-.5-x,y+.5,worldHeight(state)-.5-y);
    const grassReach=2.2+.45*Math.sin(x*.39+y*.28)+.22*Math.sin(y*.63-x*.24);
    let alpha=smooth((d-.22)/.64)*(1-smooth((d-grassReach)/1.65))*smooth(Math.abs(edge)/2);
    for(const b of state.buildings||[]){
      const qx=Math.abs(x-b.x)-.56,qy=Math.abs(y-b.y)-.56;
      const distance=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0);
      alpha*=smooth(distance/.28);
    }
    return alpha;
  };
  const grassAlpha=(x,y,alpha)=>{
    for(const [a,b] of nearbyRoads(x,y)){
      const dx=b.x-a.x,dy=b.y-a.y,t=clamp(((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy));
      alpha*=smooth((Math.hypot(x-a.x-dx*t,y-a.y-dy*t)-.12)/.12);
    }
    return alpha;
  };
  const grassGround={positions:[...ground.positions,...background.positions],indices:[...openMineralCells(ground,pits,TILE),...background.indices.map(i=>i+ground.positions.length/3)]};
  for(let i=0;i<grassGround.positions.length;i+=3){
    const x=grassGround.positions[i]/TILE,y=grassGround.positions[i+2]/TILE,variation=.93+noise(x*.3,y*.3)*.07;
    gp.push(x*TILE,grassGround.positions[i+1]+.018,y*TILE);
    const alpha=grassGroundAlpha(x,y),px=gp[gp.length-3]/TILE,py=gp[gp.length-1]/TILE;
    // Refresh samples the stored positions. Retain its exact double-precision
    // static factor even if the multiply/divide round trip shifts one ULP.
    staticGrassAlpha.push(px===x&&py===y?alpha:grassGroundAlpha(px,py));
    gc.push(variation*.88,variation,variation*.79,grassAlpha(x,y,alpha));
  }
  for(let i=0;i<grassGround.indices.length;i+=3){
    const tri=grassGround.indices.slice(i,i+3);if(tri.every(k=>gc[k*4+3]===0))continue;
    gi.push(...tri);
  }
  let staticGrassSignature=grassStaticSignature(state);
  let grassMesh=null;
  if(gi.length){const grass=geometry('soft-riparian-grass',gp,gi,grassMaterial,gc,[...ground.normals,...background.normals]);grassMesh=grass;grass.hasVertexAlpha=true;grass.freezeWorldMatrix();}
  function refreshRoadMask(s){
    if(!grassMesh)return null;state=s;initialRoads=districtRoadEdges(s);nearbyRoads=indexNearbyRoads(initialRoads);
    const nextStatic=grassStaticSignature(s);
    if(nextStatic!==staticGrassSignature){for(let i=0;i<gp.length;i+=3)staticGrassAlpha[i/3]=grassGroundAlpha(gp[i]/TILE,gp[i+2]/TILE);staticGrassSignature=nextStatic;}
    const colors=gc.slice(),indices=[];
    for(let i=0;i<gp.length;i+=3)colors[i/3*4+3]=grassAlpha(gp[i]/TILE,gp[i+2]/TILE,staticGrassAlpha[i/3]);
    for(let i=0;i<grassGround.indices.length;i+=3){const tri=grassGround.indices.slice(i,i+3);if(!tri.every(k=>colors[k*4+3]===0))indices.push(...tri);}
    grassMesh.setVerticesData(B.VertexBuffer.ColorKind,colors,true);grassMesh.setIndices(indices);
    // Match the initial mesh's Float32 quantization before main-game tinting.
    return {mesh:grassMesh,colors:grassMesh.getVerticesData(B.VertexBuffer.ColorKind).slice()};
  }
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
    let batch=leafBatches.get(parts);
    if(!batch){batch={positions:[],indices:[],normals:[]};leafBatches.set(parts,batch);}
    const offset=batch.positions.length/3;
    batch.positions.push(...positions);batch.normals.push(...normals);
    for(const index of indices)batch.indices.push(index+offset);
  };
  // Date palms, tamarisk-like scrub and marsh reeds; no temperate conifers.
  for(let y=0;y<worldHeight(state);y++)for(let x=0;x<worldWidth(state);x++){
    const xx=x+(noise(x,y)-.5)*.65,yy=y+(noise(y,x+6)-.5)*.65,d=shoreDistance(xx,yy,state),r=noise(x+3,y+7);
    if(d<.24||occupied(xx,yy))continue;
    const X=xx*TILE,Z=yy*TILE,Y=surfaceElevation(xx,yy,state);
    const nearQuarter=xx>=5.5&&xx<=12.5&&yy>=6.5&&yy<=11.5;
    if((d<6&&r>.92)||(nearQuarter&&r>.68&&(!isStrictSumer(state)||d<5))){
      const h=5+noise(x+7,y)*3;
      cylinder('date-palm-trunk',X,Y,Z,h,.14,.28,trunks);
      for(let n=0;n<11;n++){
        const a=n*Math.PI*2/11+noise(x,y),len=2.7+noise(n+x,y)*1.2,pts=[];
        for(let k=0;k<6;k++){const t=k/5;pts.push([X+Math.cos(a)*len*t,Y+h+.85*Math.sin(t*Math.PI)-.9*t*t,Z+Math.sin(a)*len*t]);}
        leaf('date-palm-rib',pts,.025,fronds);
        // Pinnate date-palm silhouette: paired narrow leaflets, never broad tropical paddles.
        for(let j=1;j<=9;j++){
          const t=j/11,q=[X+Math.cos(a)*len*t,Y+h+.85*Math.sin(t*Math.PI)-.9*t*t,Z+Math.sin(a)*len*t];
          const reach=(.24+.58*Math.sin(t*Math.PI))*(1-t*.45);
          for(const side of [-1,1]){
            const dx=Math.cos(a)*.22-Math.sin(a)*reach*side,dz=Math.sin(a)*.22+Math.cos(a)*reach*side;
            leaf('date-palm-leaflet',[q,[q[0]+dx*.55,q[1]+.07,q[2]+dz*.55],[q[0]+dx,q[1]-.2-t*.12,q[2]+dz]],.105,fronds);
          }
        }
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
    }else if(d<5&&r>.52&&r<.76){
      for(let n=0;n<12;n++){
        const a=n*2.4,h=.28+noise(x+n,y)*.45,dx=(noise(x+n*2,y)-.5)*1.5,dz=(noise(x,y+n*2)-.5)*1.5;
        leaf('dry-grass',[[X+dx,Y,Z+dz],[X+dx+Math.cos(a)*.22,Y+h,Z+dz+Math.sin(a)*.22],[X+dx+Math.cos(a)*.5,Y+h*.6,Z+dz+Math.sin(a)*.5]],.065,scrub);
      }
    }
  }
  for(const [parts,batch] of leafBatches){
    const mesh=new B.Mesh('batched-foliage',scene),data=new B.VertexData();
    data.positions=batch.positions;data.indices=batch.indices;data.normals=batch.normals;
    data.uvs=new Array(batch.positions.length/3*2).fill(0);data.applyToMesh(mesh);parts.push(mesh);
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
    if(!renderRoads)return;
    const signature=JSON.stringify([s.world?.river,s.world?.lakes,s.buildings?.map(b=>[b.type,b.x,b.y,!!b.construction]),s.roadAnchors,s.roads?.map(r=>[r.id,r.level,r.built,!!r.construction])]);
    if(signature===roadSignature)return;roadSignature=signature;
    for(const m of roadMeshes){const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1);m.dispose();}roadMeshes=[];
    const pos=[],inds=[];
    const edges=finishedRoadsOnly?(s.roads||[]).filter(r=>r.construction||roadIsBuilt(r)).map(r=>[r.a,r.b]):districtRoadEdges(s);
    for(const [a,b]of edges){
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
  return {meshes,refreshRoadMask,mineralHeightAt:mineralView.heightAt,light(n){water.setFloat('night',n);},update(s,t){state=s;mineralView.update(s);updateRoads(s);waterTime=Number.isFinite(t)?t:waterTime+.016;surface.update(s,waterTime);},dispose(){surface.dispose();for(const m of meshes)m.dispose();for(const m of ownedMaterials)m.dispose(false,false);for(const t of textures)t.dispose();meshes.length=0;}};
}
