// The same optical response runs in the first city frame and the detailed valley.
// The two slope channels are a tileable, band-limited field of short wind waves.
import {atmosphereDeclarations,atmosphereDefines,atmosphereUniforms,bindAtmosphere} from './atmosphere.js';
import {riverAxis,riverFlowSign} from '../world.js';

const vertexShader=`
precision highp float;
attribute vec3 position;
attribute vec4 color;
uniform mat4 world,worldViewProjection;
uniform vec2 riverFlow;
uniform vec3 riverCurve;
uniform float riverGrade;
varying vec3 vWorld;
varying vec4 vWater;
varying vec2 vStream;
void main(){
 vWorld=(world*vec4(position,1.0)).xyz;
 vWater=color;
 // Flatten the meander into stream coordinates before advection. A fixed
 // world-axis translation would send wave patches through a curved bank.
 vec2 axis=abs(riverFlow);
 float along=dot(vWorld.xz,axis);
 float across=dot(vWorld.xz,axis.yx);
 float center=along*riverGrade+riverCurve.z*sin(along*riverCurve.x+riverCurve.y);
 vStream=vec2(across-center,along);
 gl_Position=worldViewProjection*vec4(position,1.0);
}`;

const fragmentShader=`
precision highp float;
varying vec3 vWorld;
varying vec4 vWater;
varying vec2 vStream;
uniform vec3 cameraPosition,sunLightDirection;
uniform vec2 riverFlow;
uniform float time,night;
uniform sampler2D waveSlopes;
#ifdef ALLUVIAL_HDR_SKY
uniform samplerCube reflectedSky;
#endif
${atmosphereDeclarations}

void main(){
 float depth=vWater.r,lake=vWater.g;
 float canalSheet=step(.10,vWater.b),channel=clamp((vWater.b-.125)/.875,0.0,1.0);
 float shelter=max(lake,channel*.84);
 float core=smoothstep(.04,.69,depth);
 vec2 wind=vec2(.84,.54),windSide=vec2(-wind.y,wind.x);
 vec2 fetch=vec2(dot(vWorld.xz,windSide),dot(vWorld.xz,wind));
 // Both travelling wave trains share the same flow but have different scales
 // and phase velocities. The sheltered pools retain only light wind ripples.
 float signOfFlow=riverFlow.x+riverFlow.y;
 vec2 stream=vec2(vStream.x,vStream.y-time*signOfFlow*.64);
 vec2 large=texture2D(waveSlopes,vStream*vec2(.029,.021)-vec2(0.0,time*.003*signOfFlow)).gb;
 vec2 bent=stream*vec2(.085,.073)+(large-.5)*.35;
 vec2 streamSlopes=texture2D(waveSlopes,bent).rg*2.0-1.0;
 // Patches of sheltered, smooth water break the wave train along both banks.
 float fetchStrength=mix(.17,1.0,smoothstep(.29,.70,large.y));
 vec2 windSlopes=texture2D(waveSlopes,fetch*vec2(.152,.125)-vec2(0.0,time*.030)).rg*2.0-1.0;
 vec2 axis=abs(riverFlow);
 vec2 slopes=(axis.yx*streamSlopes.x+axis*streamSlopes.y)*(.23*(1.0-shelter));
 slopes+=(windSide*windSlopes.x+wind*windSlopes.y)*mix(.115,.065,shelter);
 slopes*=mix(.44,1.0,core)*mix(fetchStrength,.68,shelter);
 vec3 normal=normalize(vec3(slopes.x,1.0,slopes.y));
 vec3 eye=normalize(cameraPosition-vWorld);
 float facing=clamp(dot(normal,eye),0.0,1.0);
 vec3 reflected=reflect(-eye,normal);
 float fresnel=.052+.78*pow(1.0-facing,2.85);
 float skyHeight=clamp(reflected.y,0.0,1.0);
 vec3 sky=mix(vec3(.72,.74,.70),vec3(.42,.61,.72),skyHeight);
#ifdef ALLUVIAL_HDR_SKY
 vec3 env=textureCube(reflectedSky,reflected).rgb;
 sky=mix(sky,env/(env+vec3(.55)),.44);
#endif
 // At shallow angles a longer path through suspended silt hides the bottom.
 float path=max(0.0,depth)/max(.38,facing);
 float extinction=1.0-exp(-path*mix(2.05,3.5,channel));
 float silt=mix(.42,.67,channel)+.16*(1.0-core)+.13*(large.y-.5);
 vec3 body=mix(vec3(.265,.348,.335),vec3(.45,.410,.307),silt);
 body=mix(body,vec3(.278,.362,.332),lake*.51);
 vec3 halfSun=normalize(eye-normalize(sunLightDirection));
 float sparkle=pow(max(dot(normal,halfSun),0.0),195.0);
 float roughGlow=pow(max(dot(normal,halfSun),0.0),16.0);
 vec3 color=mix(body,sky,fresnel)+vec3(.95,.88,.71)*(.16*sparkle+.028*roughGlow);
 color=mix(color,color*vec3(.28,.38,.52),night*.89);
 float coverage=extinction+(1.0-extinction)*(fresnel+.2*sparkle);
 coverage*=smoothstep(0.0,.045,depth);
 // An inlet overlaps the river sheet to avoid geometric cracks. Only its
 // riverward end fades, so two transparent surfaces cannot darken the mouth.
 coverage*=mix(1.0,channel,canalSheet);
 gl_FragColor=applyImageProcessing(vec4(valleyFog(toLinearSpace(color),vWorld,cameraPosition),clamp(coverage,0.0,.99)));
}`;

export function createAlluvialWaterMaterial(B,scene,name){
 B.Effect.ShadersStore.alluvialWaterVertexShader=vertexShader;
 B.Effect.ShadersStore.alluvialWaterFragmentShader=fragmentShader;
 const material=new B.ShaderMaterial(name,scene,{vertex:'alluvialWater',fragment:'alluvialWater'},{
  attributes:['position','color'],samplers:['waveSlopes','reflectedSky'],needAlphaBlending:true,
  uniforms:['world','worldViewProjection','cameraPosition','sunLightDirection','riverFlow','riverGrade','riverCurve','time','night',...atmosphereUniforms],
  defines:atmosphereDefines(scene)
 });
 const waves=new B.Texture(new URL('../assets/3d/textures/alluvial-water-slopes.webp',import.meta.url).href,scene,false,false,B.Texture.TRILINEAR_SAMPLINGMODE);
 waves.gammaSpace=false;
 material.setTexture('waveSlopes',waves);
 material.backFaceCulling=false;
 material.disableDepthWrite=true;
 material.transparencyMode=B.Material.MATERIAL_ALPHABLEND;
 material.setFloat('night',0);
 material.setFloat('time',0);
 const flow=new B.Vector2(0,1),curve=new B.Vector3(.55/6,0,.7*6),fallbackSun=new B.Vector3(-.6,-.9,.4);
 material.setVector2('riverFlow',flow);
 material.setVector3('riverCurve',curve);
 material.setFloat('riverGrade',-.27);
 material.onBindObservable.add(()=>{
  const effect=material.getEffect()||material;
  if(scene.activeCamera)effect.setVector3('cameraPosition',scene.activeCamera.globalPosition);
  effect.setVector3('sunLightDirection',scene.getLightByName('city-sun')?.direction||fallbackSun);
  bindAtmosphere(scene,effect);
 });
 let environment=null;
 function update(state,time){
  material.setFloat('time',time);
  const xAxis=riverAxis(state)==='x',sign=riverFlowSign(state);
  const fx=xAxis?sign:0,fy=xAxis?0:sign;
  if(flow.x!==fx||flow.y!==fy){flow.set(fx,fy);material.setVector2('riverFlow',flow);}
  const river=state?.world?.river;
  const frequency=(river?.frequency??.55)/6,phase=river?.phase??0,amplitude=(river?.amplitude??.7)*6;
  if(curve.x!==frequency||curve.y!==phase||curve.z!==amplitude){curve.set(frequency,phase,amplitude);material.setVector3('riverCurve',curve);}
  material.setFloat('riverGrade',river?.slope??-.27);
  const sky=scene.environmentTexture?.isReady()?scene.environmentTexture:null;
  if(sky!==environment){
   if(sky)material.setTexture('reflectedSky',sky);
   else material.removeTexture('reflectedSky');
   // Until the city's HDR is ready the linked program contains only its 2D
   // sampler. WebGL rejects an active, unbound cube sharing texture unit zero.
   material.setDefine('ALLUVIAL_HDR_SKY',!!sky);
   environment=sky;
  }
 }
 return {material,update,dispose(){material.dispose(false,false);waves.dispose();}};
}
