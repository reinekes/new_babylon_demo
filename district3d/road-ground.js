// Streets are decals with a thin crown or wheel imprint. On a hill their
// support is the rendered terrain triangle, including its creases.
export function createRoadGround({positions,indices}){
 const bins=new Map(),facesByIndex=[],size=6,stride=2048;
 const binKey=(x,z)=>z*stride+x;
 let west=Infinity,east=-Infinity,north=Infinity,south=-Infinity;
 for(let i=0;i<positions.length;i+=3){
  west=Math.min(west,positions[i]);east=Math.max(east,positions[i]);
  north=Math.min(north,positions[i+2]);south=Math.max(south,positions[i+2]);
 }
 const bounds=[{x:west,z:north},{x:east,z:north},{x:east,z:south},{x:west,z:south}];
 function visitBins(minX,maxX,minZ,maxZ,visit){
  for(let z=Math.floor(minZ/size);z<=Math.floor(maxZ/size);z++)
   for(let x=Math.floor(minX/size);x<=Math.floor(maxX/size);x++)visit(binKey(x,z));
 }
 // Keep all face ids across a hillside's transition to the floodplain.
 // Coefficients are only needed for faces actually touched by streets.
 for(let i=0;i<indices.length;i+=3){
  const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
  const raised=positions[a+1]>0||positions[b+1]>0||positions[c+1]>0;
  visitBins(Math.min(positions[a],positions[b],positions[c]),Math.max(positions[a],positions[b],positions[c]),
   Math.min(positions[a+2],positions[b+2],positions[c+2]),Math.max(positions[a+2],positions[b+2],positions[c+2]),key=>{
    let bin=bins.get(key);if(!bin){bin={raised:false,ids:[]};bins.set(key,bin);}
    bin.ids.push(i);if(raised)bin.raised=true;
   });
 }
 function faceAt(i){
  if(facesByIndex[i/3])return facesByIndex[i/3];
  const points=[indices[i],indices[i+1],indices[i+2]].map(id=>({x:positions[id*3],z:positions[id*3+2],h:Math.max(0,positions[id*3+1])}));
  const [a,b,c]=points,area=side(a,b,c);
  const minX=Math.min(a.x,b.x,c.x),maxX=Math.max(a.x,b.x,c.x),minZ=Math.min(a.z,b.z,c.z),maxZ=Math.max(a.z,b.z,c.z);
  // inside() accepts a tiny barycentric margin along shared edges. Include it
  // in these cheap bounds before rejecting a candidate support triangle.
  const margin=area?3e-8*Math.max(maxX-minX,maxZ-minZ)/Math.abs(area):0;
  const face={points,sign:Math.sign(area),area,minX:minX-margin,maxX:maxX+margin,minZ:minZ-margin,maxZ:maxZ+margin};
  facesByIndex[i/3]=face;
  return face;
 }
 function side(a,b,p){return (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);}
 function inside(face,p){
  if(p.x<face.minX||p.x>face.maxX||p.z<face.minZ||p.z>face.maxZ)return false;
  const [a,b,c]=face.points,s=face.sign;
  return side(a,b,p)*s>=-1e-8&&side(b,c,p)*s>=-1e-8&&side(c,a,p)*s>=-1e-8;
 }
 function faceHeight(face,p){
  const [a,b,c]=face.points;
  return a.h+((b.h-a.h)*side(c,a,p)+(c.h-a.h)*side(a,b,p))/face.area;
 }
 function heightAt(x,z){
  x=Math.max(west,Math.min(east,x));z=Math.max(north,Math.min(south,z));
  const bin=bins.get(binKey(Math.floor(x/size),Math.floor(z/size)));
  if(!bin?.raised)return 0;
  const p={x,z};
  for(const i of bin.ids){const f=faceAt(i);if(f.area&&inside(f,p))return faceHeight(f,p);}
  return 0;
 }
 function clip(points,a,b,sign){
  const result=[];
  let prev=points.at(-1),d=side(a,b,prev)*sign;
  for(const p of points){
   const e=side(a,b,p)*sign;
   if(d*e<0){
    const t=d/(d-e);result.push({x:prev.x+t*(p.x-prev.x),z:prev.z+t*(p.z-prev.z)});
   }
   if(e>=0)result.push(p);
   prev=p;d=e;
  }
  return result;
 }
 function fit(g){
  if(!g.indices.length)return g;
  const origin=g.origin||{x:0,z:0},points=[],added=new Map();
  const x0=origin.x,z0=origin.z,neighbours=new Set(),faces=[];
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,raised=false;
  for(let i=0;i<g.positions.length;i+=3){
   const x=g.positions[i]+x0,z=g.positions[i+2]+z0;
   minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);
  }
  visitBins(minX,maxX,minZ,maxZ,key=>{if(bins.get(key)?.raised)raised=true;});
  if(!raised)return g;
  for(let i=0;i<g.positions.length;i+=3){
   const x=g.positions[i]+x0,z=g.positions[i+2]+z0,h=g.positions[i+1];
   points.push({x,z,h,id:i/3});g.positions[i+1]+=heightAt(x,z);
  }
  const output=[];
  for(let i=0;i<g.indices.length;i+=3){
   const ia=g.indices[i],ib=g.indices[i+1],ic=g.indices[i+2],a=points[ia],b=points[ib],c=points[ic],area=side(a,b,c);
   const minX=Math.min(a.x,b.x,c.x),maxX=Math.max(a.x,b.x,c.x),minZ=Math.min(a.z,b.z,c.z),maxZ=Math.max(a.z,b.z,c.z);
   const left=Math.floor(minX/size),right=Math.floor(maxX/size),top=Math.floor(minZ/size),bottom=Math.floor(maxZ/size);
   let candidates;
   if(left===right&&top===bottom){
    const bin=bins.get(binKey(left,top));if(bin?.raised)candidates=bin.ids;
   }else{
    neighbours.clear();let raised=false;
    for(let z=top;z<=bottom;z++)for(let x=left;x<=right;x++){
     const bin=bins.get(binKey(x,z));if(!bin)continue;
     if(bin.raised)raised=true;
     for(const id of bin.ids)neighbours.add(id);
    }
    if(raised)candidates=neighbours;
   }
   if(!candidates||Math.abs(area)<1e-10){output.push(ia,ib,ic);continue;}
   faces.length=0;
   for(const id of candidates){
    const f=faceAt(id);
    if(f.area&&f.maxX>=minX&&f.minX<=maxX&&f.maxZ>=minZ&&f.minZ<=maxZ)faces.push(f);
   }
   let contained=false;
   for(const f of faces)if(inside(f,a)&&inside(f,b)&&inside(f,c)){contained=true;break;}
   if(contained){output.push(ia,ib,ic);continue;}
   const vertex=(p,face)=>{
    if(p.id!==undefined)return p.id;
    const key=Math.round(p.x*1e7)+','+Math.round(p.z*1e7);
    if(added.has(key))return added.get(key);
    const u=side(b,c,p)/area,v=side(c,a,p)/area,w=1-u-v;
    const id=g.positions.length/3;added.set(key,id);
    g.positions.push(p.x-x0,u*a.h+v*b.h+w*c.h+(face?faceHeight(face,p):heightAt(p.x,p.z)),p.z-z0);
    for(const [channel,count] of [[g.colors,4],[g.uvs,2]])if(channel){
     for(let k=0;k<count;k++)channel.push(u*channel[a.id*count+k]+v*channel[b.id*count+k]+w*channel[c.id*count+k]);
    }
    return id;
   };
   function append(polygon,face){
    for(let j=1;j+1<polygon.length;j++){
     if(Math.abs(side(polygon[0],polygon[j],polygon[j+1]))<1e-10)continue;
     output.push(vertex(polygon[0],face),vertex(polygon[j],face),vertex(polygon[j+1],face));
    }
   }
   // The bootstrap street's shoulder may extend just past the playable rim.
   // Keep that sliver, supported by the last available elevation on the rim.
   if([a,b,c].some(p=>p.x<west||p.x>east||p.z<north||p.z>south)){
    let within=[a,b,c];
    for(let k=0;k<4&&within.length;k++){
     const start=bounds[k],end=bounds[(k+1)%4];
     append(clip(within,start,end,-1),null);within=clip(within,start,end,1);
    }
   }
   for(const face of faces){
    let polygon=[a,b,c];
    for(let k=0;k<3&&polygon.length;k++)polygon=clip(polygon,face.points[k],face.points[(k+1)%3],face.sign);
    append(polygon,face);
   }
  }
  g.indices=output;
  return g;
 }
 return {heightAt,fit};
}
