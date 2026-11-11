import {atmosphereDeclarations,atmosphereDefines,atmosphereUniforms,bindAtmosphere,linearFogColor} from './atmosphere.js';
import {lightingAt} from '../city-life.js';
import {worldWidth,worldHeight,riverLength,riverAcrossSize,river,riverLocal,worldFromRiver} from '../world.js';
import {surfaceElevation,shoreDistance,alluvialNormal,TILE} from '../district3d/terrain.js';
import {RIVER_BANK_SECTION,RIVER_CROSS_SECTION,riverRows,SCENERY_MARGIN} from '../district3d/river-profile.js';

const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const smooth=n=>{n=clamp(n);return n*n*(3-2*n);};
const noise=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};
const normalize=(x,y,z)=>{const n=Math.hypot(x,y,z);return {x:x/n,y:y/n,z:z/n};};

// Presentation only: the existing simulation clock owns pause, speed and day length.
// Opposed moon/sun arcs are a readable artistic cycle, not an ephemeris.
export function celestialAt(seconds=0,mode='auto'){
 const forced={day:10,sunset:28,night:37.5},clock=lightingAt(mode==='auto'?seconds:forced[mode]??seconds),theta=(clock.hour-6)/12*Math.PI;
 const sun=normalize(Math.cos(theta),Math.sin(theta)*.8,Math.sin(theta)*.6),moon={x:-sun.x,y:-sun.y,z:-sun.z};
 const body=sun.y>=0?'sun':'moon',source=body==='sun'?sun:moon,direction=normalize(-source.x,-Math.max(.035,source.y),-source.z);
 // The opposed artistic bodies exchange the directional light at the horizon.
 // Fade its energy to zero first, so the direction change cannot flip shadows
 // with a discontinuous flash; the existing twilight fill remains continuous.
 const horizonFade=smooth(Math.max(0,source.y)/.12);
 return {...clock,sun,moon,light:{body,direction,intensity:(body==='sun'?(1-clock.night)*3.2+.06:.32*Math.max(.18,moon.y))*horizonFade}};
}

function sample(x,y,s){
 const d=shoreDistance(x,y,s),outside=Math.max(0,-.5-x,x-(worldWidth(s)-.5),-.5-y,y-(worldHeight(s)-.5));
 const h=surfaceElevation(x,y,s)+smooth(outside/8)*smooth((d-.35)/2)*(1+2.5*Math.sin(x*.09+y*.055)**2);
 const local=riverLocal(x,y,s),fertile=smooth((4.3-Math.abs(local.across-river(local.along,s)))/3),fleck=noise(x*1.3,y*1.3)*.055,wet=1-smooth((d+.05)/.7);
 return {position:[x*TILE,h,y*TILE],normal:alluvialNormal(x,y,s),color:[.92-fertile*.20-wet*.20+fleck,.83-fertile*.09-wet*.17+fleck,.64-fertile*.12-wet*.12+fleck,1]};
}

export function horizonGeometry(s){
 // Every vertex lies at least 36 tiles outside the playable rectangle: local
 // lakes and buildings cannot affect it. Do not scan them for every far sample.
 s={buildings:[],world:{...s?.world,lakes:[]}};
 const length=riverLength(s),width=riverAcrossSize(s),min=-.5-SCENERY_MARGIN,max=width-.5+SCENERY_MARGIN,end=length-.5+SCENERY_MARGIN;
 const middle={across:(width-1)/2,along:(length-1)/2},points=new Map(),add=(across,along)=>{const p=worldFromRiver(across,along,s);points.set(`${p.x},${p.y}`,{...sample(p.x,p.y,s),across,along});};
 const columns=[-36.5,-24.5,-12.5,-6.5,-2.5,-.5,width-.5,width+1.5,width+5.5,width+11.5,width+23.5,width+35.5];
 for(const along of [min,end])for(const across of [...columns,...RIVER_BANK_SECTION.map(x=>river(along,s)+x)].filter(x=>x>=min&&x<=max))add(Math.round(across*1e9)/1e9,along);
 for(const along of riverRows(true,s)){add(min,along);add(max,along);}
 const rim=[...points.values()].sort((a,b)=>Math.atan2(a.along-middle.along,a.across-middle.across)-Math.atan2(b.along-middle.along,b.across-middle.across));
 const g={positions:[],indices:[],normals:[],colors:[],uvs:[],innerRim:rim,water:{positions:[],indices:[],colors:[],uvs:[]}},scales=[1,1.3,2.2,6,64],count=rim.length;
 for(const scale of scales)for(const p of rim){
  let across=middle.across+(p.across-middle.across)*scale,along=middle.along+(p.along-middle.along)*scale;
  // Continue both river mouths through the distant plain, keeping a narrow bed.
  if(scale!==1&&(p.along===min||p.along===end)){const oldCenter=river(p.along,s),center=river(along,s),offset=p.across-oldCenter,bank=1.7;
   if(offset<-bank){const t=(p.across-min)/(oldCenter-bank-min),left=middle.across+(min-middle.across)*scale;across=left+(center-bank-left)*t;}
   else if(offset>bank){const t=(p.across-oldCenter-bank)/(max-oldCenter-bank),right=middle.across+(max-middle.across)*scale;across=center+bank+(right-center-bank)*t;}
   else across=center+offset;
  }
  const xy=worldFromRiver(across,along,s),v=scale===1?p:sample(xy.x,xy.y,s);
  g.positions.push(...v.position);g.normals.push(...v.normal);g.colors.push(...v.color);g.uvs.push(xy.x*TILE/4.5,xy.y*TILE/4.5);
 }
 for(let ring=1;ring<scales.length;ring++)for(let i=0;i<count;i++){const next=(i+1)%count,a=(ring-1)*count+i,b=(ring-1)*count+next,c=ring*count+i,d=ring*count+next;g.indices.push(a,c,b,b,c,d);}
 // A separate, inexpensive continuation meets the existing water at y=-.18.
 for(const side of [-1,1]){const first=side<0?min:end,start=g.water.positions.length/3,columns=RIVER_CROSS_SECTION.length;for(let ring=0;ring<scales.length;ring++){const along=middle.along+(first-middle.along)*scales[ring];for(const offset of RIVER_CROSS_SECTION){const xy=worldFromRiver(river(along,s)+offset,along,s),bed=sample(xy.x,xy.y,s).position[1];g.water.positions.push(xy.x*TILE,-.18,xy.y*TILE);g.water.colors.push(Math.max(0,-.18-bed),0,0,1);g.water.uvs.push(xy.x,xy.y);}if(ring)for(let col=0;col<columns-1;col++){const a=start+(ring-1)*columns+col,b=a+columns;g.water.indices.push(a,b,a+1,a+1,b,b+1);}}}
 return g;
}

export function createSkyHorizon(B,scene,{soil}={}){
 const owned=[],meshes=[],vector=new B.Vector3(),sunVector=new B.Vector3(),moonVector=new B.Vector3();let worldKey='',disposed=false,ground=null,water=null,stats={triangles:0};
 B.Effect.ShadersStore.valleySkyVertexShader=`precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 ray;void main(){ray=position;gl_Position=worldViewProjection*vec4(position,1.0);}`;
 B.Effect.ShadersStore.valleySkyFragmentShader=`precision highp float;varying vec3 ray;uniform vec3 sunDirection,moonDirection,horizonColor;uniform float night,warm;
 ${atmosphereDeclarations}
 void main(){vec3 d=normalize(ray);float elevation=clamp(d.y,0.0,1.0);vec3 zenith=mix(vec3(.30,.52,.67),vec3(.018,.028,.065),night);vec3 color=mix(horizonColor,zenith,pow(elevation,.45));float sunset=pow(max(0.0,dot(d,normalize(vec3(sunDirection.x,0.,sunDirection.z)))),8.0)*exp(-elevation*7.0)*warm;color+=vec3(.25,.075,.012)*sunset;
 float sd=dot(d,sunDirection),md=dot(d,moonDirection);float sun=smoothstep(.99978,.99986,sd)*smoothstep(-.025,.025,d.y);float halo=pow(max(0.0,sd),150.0)*.32;vec3 sunColor=mix(vec3(1.,.84,.42),vec3(1.,.34,.08),warm);color+=sunColor*(sun*2.0+halo)*(1.-night);
 float moon=smoothstep(.99975,.99984,md)*smoothstep(-.025,.02,d.y);float crater=.86+.09*sin(d.x*1700.)*sin(d.z*1400.);color=mix(color,vec3(.77,.84,.93)*crater,moon*night);color+=vec3(.14,.19,.28)*pow(max(0.0,md),260.)*night;
 // The distant land and river are fully fogged at the horizon. Fade the
 // directional sky colours into that same fog before joining the terrain.
 color=mix(horizonColor,color,smoothstep(0.0,.045,elevation));
 gl_FragColor=applyImageProcessing(vec4(color,1.));}`;
 const skyMat=new B.ShaderMaterial('valley-sky-material',scene,{vertex:'valleySky',fragment:'valleySky'},{attributes:['position'],uniforms:['worldViewProjection','sunDirection','moonDirection','horizonColor','night','warm',...atmosphereUniforms],defines:atmosphereDefines(scene)});skyMat.backFaceCulling=false;skyMat.disableDepthWrite=true;skyMat.fogEnabled=false;owned.push(skyMat);
 const dome=B.MeshBuilder.CreateSphere('valley-sky-dome',{diameter:2,segments:16},scene);dome.material=skyMat;dome.isPickable=false;dome.alwaysSelectAsActiveMesh=true;dome.infiniteDistance=false;meshes.push(dome);
 const landMat=soil||new B.StandardMaterial('horizon-alluvial-soil',scene);if(!soil){landMat.backFaceCulling=false;landMat.diffuseColor=B.Color3.FromHexString('#b6a184');owned.push(landMat);}
 const waterMat=new B.StandardMaterial('horizon-river-water',scene);waterMat.diffuseColor=B.Color3.FromHexString('#607c77');waterMat.specularColor=B.Color3.Black();waterMat.backFaceCulling=false;owned.push(waterMat);
 const geometry=(name,g,mat)=>{const m=new B.Mesh(name,scene),v=new B.VertexData();v.positions=g.positions;v.indices=g.indices;const winding=[];B.VertexData.ComputeNormals(g.positions,g.indices,winding);if(winding.find((v,i)=>i%3===1&&Math.abs(v)>.01)<0)for(let i=0;i<v.indices.length;i+=3)[v.indices[i+1],v.indices[i+2]]=[v.indices[i+2],v.indices[i+1]];v.normals=g.normals||[];if(!g.normals)B.VertexData.ComputeNormals(g.positions,g.indices,v.normals);if(g.colors)v.colors=g.colors;if(g.uvs)v.uvs=g.uvs;v.applyToMesh(m);m.material=mat;m.isPickable=false;m.receiveShadows=false;m.useVertexColors=true;m.freezeWorldMatrix();meshes.push(m);return m;};
 return {meshes,dome,get stats(){return stats;},update(s,camera,mode='auto',waterMaterial=null){
  if(disposed)return;const key=JSON.stringify([worldWidth(s),worldHeight(s),s?.world?.river||null]);if(key!==worldKey){for(const m of [ground,water])if(m){meshes.splice(meshes.indexOf(m),1);m.dispose();}const g=horizonGeometry(s);ground=geometry('horizon-dunes',g,landMat);water=geometry('horizon-river',g.water,waterMat);stats={triangles:(g.indices.length+g.water.indices.length)/3};worldKey=key;}
  if(waterMaterial)water.material=waterMaterial;bindAtmosphere(scene,skyMat);camera.getViewMatrix?.(true);const c=celestialAt(s?.simTime||0,mode),position=camera.globalPosition||camera.position||camera.target;dome.position.copyFrom(position);dome.scaling.setAll(Math.max(100,(camera.maxZ||20000)*.90));
  sunVector.set(c.sun.x,c.sun.y,c.sun.z);moonVector.set(c.moon.x,c.moon.y,c.moon.z);skyMat.setVector3('sunDirection',sunVector);skyMat.setVector3('moonDirection',moonVector);skyMat.setFloat('night',c.night);skyMat.setFloat('warm',c.warm);const fog=linearFogColor(scene);vector.set(fog.r,fog.g,fog.b);skyMat.setVector3('horizonColor',vector);
 },dispose(){if(disposed)return;disposed=true;for(const m of meshes)m.dispose();for(const m of owned)m.dispose(false,false);meshes.length=0;}};
}
