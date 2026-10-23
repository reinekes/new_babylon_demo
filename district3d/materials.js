// Local CC0 photographs, plus original repeating brick/reed/cloth detail maps.
export function createDistrictMaterials(B,scene,{deferPhotos=false}={}){
 const pendingPhotos=[],photoReady=[];let photosEnabled=!deferPhotos;
 const make=(name,color,roughness=1)=>{const m=new B.PBRMaterial(name,scene);m.albedoColor=B.Color3.FromHexString(color);m.metallic=0;m.roughness=roughness;return m;};
 const photo=(m,name,repeat=1,relief=.35)=>{
  if(!photosEnabled){pendingPhotos.push([m,name,repeat,relief]);return m;}
  let failed=false,done=0,resolve;const ready=new Promise(r=>resolve=r),loaded=()=>{if(++done===2)resolve();},error=()=>{failed=true;loaded();};
  const a=new B.Texture(`assets/3d/textures/${name}_color.jpg`,scene,false,true,undefined,loaded,error),n=new B.Texture(`assets/3d/textures/${name}_normal.jpg`,scene,false,true,undefined,loaded,error);a.uScale=a.vScale=n.uScale=n.vScale=repeat;n.level=relief;
  if(deferPhotos)photoReady.push(ready.then(()=>{if(!failed&&!scene.isDisposed){m.albedoTexture=a;m.bumpTexture=n;}else{a.dispose();n.dispose();}}));else{m.albedoTexture=a;m.bumpTexture=n;}return m;
 };
 const mats={plaster:photo(make('warm-clay-plaster','#fff0da'),'clay_plaster',1,.38),soil:photo(make('alluvial-earth','#ead6b7'),'dry_ground_01',1,.25),grass:photo(make('dry-river-grass','#dcdfb2'),'sparse_grass',1,.3),wood:photo(make('worn-timber','#c1a886'),'wood_table_worn',1,.45),stone:photo(make('bank-stone','#b0a68e'),'dry_ground_01',1,.7),terracotta:make('fired-pottery','#a56b43',.98),brick:make('exposed-mudbrick','#d3ad82'),reed:make('reed-mat','#c0ad78'),linen:make('woven-linen','#ddd0af')};
 // PBR albedo is linear: an sRGB brown assigned directly turns pale pink in
 // the tone-mapped sun. Keep all procedural jars/cargo/goods matte earth clay.
 mats.terracotta.albedoColor=mats.terracotta.albedoColor.toLinearSpace();
 const pattern=(name,draw)=>{const tex=new B.DynamicTexture(name,{width:512,height:512},scene,false),c=tex.getContext();draw(c);tex.wrapU=tex.wrapV=B.Texture.WRAP_ADDRESSMODE;tex.update();return tex;};
 const random=(i)=>{const n=Math.sin(i*12.9898)*43758.5453;return n-Math.floor(n);};
 mats.brick.albedoTexture=pattern('mudbrick-courses',c=>{c.fillStyle='#958366';c.fillRect(0,0,512,512);for(let row=0;row<12;row++)for(let col=-1;col<7;col++){const x=col*85+(row%2?42:0),y=row*43,v=Math.floor(random(row*17+col)*20);c.fillStyle=`rgb(${173+v},${144+v},${105+v})`;c.fillRect(x+2,y+2,81,39);c.fillStyle='#d7bd9438';c.fillRect(x+3,y+2,79,2);}for(let i=0;i<12000;i++){const v=random(i)*60+110;c.fillStyle=`rgba(${v+35},${v+15},${v},.08)`;c.fillRect(random(i+1)*512,random(i+2)*512,2,1);}});
 mats.reed.albedoTexture=pattern('woven-reed',c=>{c.fillStyle='#af9b6c';c.fillRect(0,0,512,512);for(let i=0;i<100;i++){c.fillStyle=i%3?'#c7b787':'#9f8b60';c.fillRect(i*6,0,3,512);}for(let i=0;i<20;i++){c.fillStyle='#8b785655';c.fillRect(0,i*28,512,2);}});
 mats.linen.albedoTexture=pattern('linen-weave',c=>{c.fillStyle='#d2c5a7';c.fillRect(0,0,512,512);for(let i=0;i<512;i+=3){c.fillStyle=i%2?'#e8ddbf66':'#ab9b7b55';c.fillRect(i,0,1,512);c.fillRect(0,i,512,1);}});
 Object.defineProperty(mats,'loadPhotos',{value:()=>{photosEnabled=true;for(const args of pendingPhotos.splice(0))photo(...args);return Promise.all(photoReady);}});
 return mats;
}
