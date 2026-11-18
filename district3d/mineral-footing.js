// Sample the same ledges, ladder and shrinking outcrop that are drawn in the pit.
// Most residents never enter a cut cell. Only those inside it need a ground ray.
export function mineralFooting(B,pits,meshes,tile){
 const cells=new Map(),heights=new Map();
 for(const p of pits){
  const parts=meshes.filter(mesh=>{
   const site=mesh.metadata?.mineralCut||(mesh.metadata?.mineralExposure==='excavated'&&mesh.metadata.resourceSite);
   return site&&site.x===p.x&&site.y===p.y;
  });
  cells.set(`${p.x},${p.y}`,parts);
  if(p.extensionX||p.extensionY)cells.set(`${p.x+(p.extensionX||0)},${p.y+(p.extensionY||0)}`,parts);
 }
 const down=new B.Ray(new B.Vector3(),new B.Vector3(0,-1,0));
 function heightAt(x,y,ground){
  if(!cells.size)return ground;
  const parts=cells.get(`${Math.floor(x+.5)},${Math.floor(y+.5)}`);if(!parts)return ground;
  const key=`${x},${y}`;
  if(heights.has(key))return heights.get(key);
  down.origin.set(x*tile,ground+8,y*tile);
  let top=-Infinity;
  for(const mesh of parts){
   if(!mesh.isEnabled())continue;
   const hit=down.intersectsMesh(mesh);
   if(hit.hit)top=Math.max(top,hit.pickedPoint.y);
  }
  const support=Number.isFinite(top)?top:ground;
  if(heights.size>=256)heights.clear();
  heights.set(key,support);return support;
 }
 return {heightAt,changed:()=>heights.clear()};
}
