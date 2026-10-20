// Authored seamless hair maps. The same finite three coats per species serve every
// animal; textures are generated at material creation, never during animation.
const palettes={
 goat:[['#75513a','#ded0aa','#302922'],['#b49971','#f0e3c4','#554130'],['#98775b','#e2c99f','#614b39']],
 gazelle:[['#b48147','#f0dfba','#57402b'],['#c69b61','#f5e8cd','#6b4b2c'],['#94704a','#ddc89e','#403529']],
 jackal:[['#9e7546','#d9c194','#39372e'],['#b29362','#e5d4ad','#46443b'],['#7d694b','#cbb58e','#2c2d29']],
 cat:[['#99876a','#ddcfad','#3c352b'],['#c29c66','#efe0bd','#685036'],['#746d60','#c7bfaa','#302e28']],
 mouse:[['#837260','#cbb89b','#51483c'],['#9b8266','#ddc6a3','#69533e'],['#69635a','#bcb4a1','#3b3832']]
};
const rgb=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const mix=(a,b,t)=>a.map((n,i)=>n+(b[i]-n)*Math.max(0,Math.min(1,t)));
export function coatVariant(id){let h=2166136261;for(const c of String(id)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return (h>>>0)%3;}
export function hasHairCoat(kind){return Object.hasOwn(palettes,kind);}
export function createCoatPixels(kind,variant,size=256){
 const [base,belly,dark]=palettes[kind][variant].map(rgb),color=new Uint8Array(size*size*4),normal=new Uint8Array(size*size*4),heights=new Float32Array(size*size);
 const coarse=kind==='goat',cat=kind==='cat',jackal=kind==='jackal';
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,around=Math.sin(u*Math.PI*2),seed=Math.sin(x*127.1+y*311.7+variant*73.7)*43758.5453,noise=seed-Math.floor(seed);
  // Angular UV: dorsal centre is u=.25, pale underside is u=.75.
  let tint=mix(base,belly,Math.pow(Math.max(0,-around),.7)*.96);
  tint=mix(tint,dark,Math.pow(Math.max(0,around),coarse?2:3)*(jackal?.82:coarse?.38:.30));
  if(coarse){
   const patch=Math.sin(u*12.566+Math.sin(v*8)*1.6)+Math.cos(v*13+variant*2);
   if(variant!==1)tint=mix(tint,belly,Math.max(0,patch-.38)*.77);
   if(variant===1)tint=mix(tint,dark,Math.max(0,patch-.35)*.65);
   // Every coat keeps a broad cream shoulder/flank patch, including dark coats.
   const shoulder=Math.exp(-(((v-.65)/.19)**2))*(.80-.18*Math.max(0,around));
   tint=mix(tint,belly,shoulder);
  }
  // Short gazelle coat has an anatomical lateral stripe, never wool curls.
  if(kind==='gazelle')tint=mix(tint,dark,Math.exp(-(((around+.12)/.13)**2))*.86);
  if(cat){const stripes=Math.pow(Math.max(0,Math.cos(v*Math.PI*14+Math.sin(u*18.85)*.9)),9);tint=mix(tint,dark,stripes*(.55+.38*Math.max(0,around)));}
  if(jackal){const fleck=Math.max(0,Math.sin(x*1.7+y*.67)*Math.sin(x*.43-y*1.1));tint=mix(tint,dark,fleck*.40*Math.max(0,around+.3));}
  // Broken, long tapered streaks read as coarse goat hair; other species have
  // finer, low relief grain. Cyclic x preserves the longitudinal seam.
  const strands=Math.sin(u*Math.PI*(coarse?112:192)+Math.sin(v*31+u*12.566)*.75),breaks=.55+.45*Math.sin(v*93+u*37.699);
  const grain=strands*breaks,shade=1+grain*(coarse?.17:.105)+(noise-.5)*(coarse?.13:.10),i=(y*size+x)*4;
  for(let c=0;c<3;c++)color[i+c]=Math.max(0,Math.min(255,tint[c]*shade));color[i+3]=255;
  heights[y*size+x]=grain*(coarse?.80:.32)+(noise-.5)*.16;
 }
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
  const strength=coarse?.55:.65,nx=-dx*strength,ny=-dy*strength,len=Math.hypot(nx,ny,1),i=(y*size+x)*4;
  normal[i]=(nx/len*.5+.5)*255;normal[i+1]=(ny/len*.5+.5)*255;normal[i+2]=(1/len*.5+.5)*255;normal[i+3]=255;
 }
 return {color,normal,size};
}
export function createCoatTextures(B,scene,kind,variant){
 const pixels=createCoatPixels(kind,variant),make=(data,suffix)=>{const t=B.RawTexture.CreateRGBATexture(data,pixels.size,pixels.size,scene,true,false,B.Texture.TRILINEAR_SAMPLINGMODE);t.name=`wildlife-coat-${kind}-${variant}-${suffix}`;t.wrapU=B.Texture.WRAP_ADDRESSMODE;t.wrapV=B.Texture.WRAP_ADDRESSMODE;return t;};
 const albedo=make(pixels.color,'hair'),bump=make(pixels.normal,'normal');albedo.gammaSpace=true;bump.gammaSpace=false;bump.level=kind==='goat'?.45:.48;
 return {albedo,bump};
}
