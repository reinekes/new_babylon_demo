// Chamber dimensions and the mouth of the firebox are shared with the workshop model.
import {ovenHeat} from '../kilns.js';
import {ovenChambers,workshopAngle} from './reference-workshops.js';

// Hot gas and soot form one translucent sheet just behind the loading arch.
// The rising noise field bends and splits the bright interior into changing tongues.
const flameVertex=`
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world,worldViewProjection;
varying vec2 vUV;
varying float seed;
void main(){
 vUV=uv;seed=dot(world[3].xz,vec2(.43,.29));
 gl_Position=worldViewProjection*vec4(position,1.);
}`;
const flameFragment=`
precision highp float;
varying vec2 vUV;
varying float seed;
uniform float seconds;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise2(vec2 p){vec2 i=floor(p),u=fract(p);u=u*u*(3.-2.*u);
 return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),u.x),u.y);}
void main(){
 float t=seconds*1.65+seed,y=vUV.y,x=(vUV.x-.5)*2.;
 float n=noise2(vec2(x*3.+seed,y*4.-t*1.8));
 float bend=x+y*(.095*sin(t*1.14+y*5.)+.18*(n-.5));
 float height=.28+.44*noise2(vec2(bend*3.6+seed,t*.57))
              +.21*sin(bend*12.3+1.5*n+t*.67)+.10*sin(bend*21.5-t*.48);
 float rim=(height-y)*4.-pow(abs(bend),2.)*2.2+.75*(n-.5);
 float flame=smoothstep(-.28,.19,rim)*(1.-smoothstep(.62,1.,abs(x)));
 float hot=clamp(rim*.58+(.56-y)*.46,0.,1.);
 vec3 col=mix(vec3(.86,.19,.035),vec3(1.,.61,.13),smoothstep(.02,.49,hot));
 col=mix(col,vec3(1.,.89,.53),smoothstep(.47,1.,hot));
 float glow=.32*exp(-3.4*(x*x+y*y*1.8));
 float alpha=max(glow,.94*flame)*smoothstep(0.,.045,y)*(1.-smoothstep(.88,1.,y));
 gl_FragColor=vec4(mix(vec3(.76,.22,.055),col,flame),alpha);
}`;

export function createOvenFires(B,scene){
 const ovens=new Map(),materials=[];let flameMat;
 function material(name,hex){
  const m=new B.StandardMaterial(name,scene);m.emissiveColor=B.Color3.FromHexString(hex);m.disableLighting=true;materials.push(m);return m;
 }
 function create(key,record){
  if(!materials.length){
   material('oven-charcoal-glow','#ab4121');material('oven-ember-tip','#ffc979');
   flameMat=new B.ShaderMaterial('oven-hot-gas',scene,{vertexSource:flameVertex,fragmentSource:flameFragment},{
    attributes:['position','uv'],uniforms:['world','worldViewProjection','seconds'],needAlphaBlending:true
   });
   flameMat.disableDepthWrite=true;flameMat.backFaceCulling=false;materials.push(flameMat);
  }
  const root=new B.TransformNode('oven-fire-'+key,scene),[x,z,width,depth]=ovenChambers[record.b.type];
  const angle=record.angle,front=z+depth*.5-.15,scale=width/2.15;
  root.parent=record.parent;root.rotation.y=angle;root.position.set(x*Math.cos(angle)+front*Math.sin(angle),.164+record.lift,front*Math.cos(angle)-x*Math.sin(angle));root.scaling.setAll(scale);
  const part=(mesh,mat)=>{mesh.material=materials[mat];mesh.parent=root;mesh.isPickable=false;mesh.receiveShadows=false;return mesh;};
  const coals=part(B.MeshBuilder.CreateIcoSphere('oven-bed-of-coals',{radius:1,subdivisions:1},scene),0);coals.scaling.set(.42,.046,.14);
  const flame=part(B.MeshBuilder.CreatePlane('oven-flame',{width:1.03,height:.75},scene),2);
  flame.position.set(0,.375,.019);
  const sparks=Array.from({length:5},()=>part(B.MeshBuilder.CreateIcoSphere('oven-flying-spark',{radius:1,subdivisions:0},scene),1));
  return {root,coals,flame,sparks};
 }
 function update(seconds){
  for(const [key,r] of ovens){
   const heat=ovenHeat(r.b);
   if(!heat){if(r.fire?.root.isEnabled())r.fire.root.setEnabled(false);continue;}
   const f=r.fire??=create(key,r);if(!f.root.isEnabled())f.root.setEnabled(true);
   const t=seconds+r.phase;f.coals.scaling.y=.012+.034*heat.coal;f.coals.scaling.x=.15+.27*heat.coal;f.coals.visibility=.18+.82*heat.coal;
   f.flame.isVisible=!!heat.flame;
   f.flame.scaling.y=heat.flame;f.flame.position.y=.375*heat.flame;
   for(const [i,spark] of f.sparks.entries()){
    const age=(t*(.46+i*.061)+i*.373)%1;spark.isVisible=heat.flame>.26&&age<.68;if(!spark.isVisible)continue;
    const rise=age/.68;spark.position.set(.22*Math.sin(i*5)+rise*.11*Math.sin(t*3+i),.075+heat.flame*(.12+rise*.83),.07+rise*.31);
    const size=.013*(1-rise*.74)*heat.flame;spark.scaling.set(size,size*1.8,size);
   }
  }
  flameMat?.setFloat('seconds',seconds);
 }
 return {add(key,b,parent,lift,workCorner){if(ovenChambers[b.type]&&b.construction?.kind!=='new')ovens.set(key,{b,parent,lift,angle:workshopAngle(workCorner),phase:(b.x*3+b.y)*.43});},
 sync(key,b){const r=ovens.get(key);if(r)r.b=b;},update,
 remove(key){ovens.get(key)?.fire?.root.dispose();ovens.delete(key);},dispose(){for(const r of ovens.values())r.fire?.root.dispose();ovens.clear();for(const m of materials)m.dispose();}};
}
