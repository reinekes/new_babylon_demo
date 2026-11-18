// Only the bed near a saved lake outline needs fine triangles. The detailed
// landscape then samples its curved bank on these shared vertices. A coarse
// half-tile triangle otherwise cuts through the water on convex corners.
export function refineLakeBedGrid(grid,state,tile,width,height){
 const lakes=state?.world?.lakes;
 if(!lakes?.length)return;
 const resolution=4,stride=width*resolution+12;
 const key=(x,y)=>(y+5)*stride+x+5;
 const band=new Set();
 for(const lake of lakes){
  const cells=new Set(lake.cells.map(p=>p.x+','+p.y));
  for(const {x,y} of lake.cells)for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
   if(cells.has((x+dx)+','+(y+dy)))continue;
   const sx=resolution*(x+dx*.5),sy=resolution*(y+dy*.5);
   for(let across=-2;across<=2;across++)for(let along=-2;along<2;along++){
    band.add(key(sx+dx*across+dy*along,sy+dy*across+dx*along));
   }
  }
 }
 const {positions,normals,colors}=grid;
 for(let pass=0;pass<2;pass++){
  const vertices=positions.length/3,midpoints=new Map(),next=[];
  function midpoint(a,b){
   const ia=a*3,ib=b*3,dx=(positions[ia]-positions[ib])/tile,dz=(positions[ia+2]-positions[ib+2])/tile;
   if(dx*dx+dz*dz<=.13**2)return -1;
   const x=(positions[ia]+positions[ib])/(2*tile),z=(positions[ia+2]+positions[ib+2])/(2*tile);
   if(x<=-.5||z<=-.5||x>=width-.5||z>=height-.5||!band.has(key(Math.floor(x*resolution),Math.floor(z*resolution))))return -1;
   const edge=Math.min(a,b)*vertices+Math.max(a,b);
   if(midpoints.has(edge))return midpoints.get(edge);
   const id=positions.length/3;
   for(let i=0;i<3;i++){
    positions.push((positions[ia+i]+positions[ib+i])*.5);
    normals.push((normals[ia+i]+normals[ib+i])*.5);
   }
   for(let i=0;i<4;i++)colors.push((colors[a*4+i]+colors[b*4+i])*.5);
   midpoints.set(edge,id);
   return id;
  }
  for(let i=0;i<grid.indices.length;i+=3){
   const a=grid.indices[i],b=grid.indices[i+1],c=grid.indices[i+2];
   const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
   if(ab<0&&bc<0&&ca<0){next.push(a,b,c);continue;}
   if(ab>=0&&bc>=0&&ca>=0){next.push(a,ab,ca,ab,b,bc,ca,bc,c,ab,bc,ca);continue;}
   // Rotate the partly refined triangle until its one split or one intact edge
   // is first. Every adjacent triangle uses exactly the same edge midpoint.
   const ids=[a,b,c],mids=[ab,bc,ca];
   const splits=Number(ab>=0)+Number(bc>=0)+Number(ca>=0);
   const start=mids.findIndex(m=>splits===1?m>=0:m<0);
   const j=(start+1)%3,k=(start+2)%3;
   if(splits===1)next.push(ids[start],mids[start],ids[k],mids[start],ids[j],ids[k]);
   else next.push(ids[k],mids[k],mids[j],ids[start],ids[j],mids[j],ids[start],mids[j],mids[k]);
  }
  if(!midpoints.size)break;
  grid.indices=next;
 }
}
