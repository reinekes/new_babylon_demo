import {createScenery} from './scenery.js';
const B=globalThis.BABYLON,$=id=>document.getElementById(id),release='art-courtyard-20261020-1';
let engine,scene,camera,sun,shadow,ao,scenery,paused=false,speed=1,time=0,last=0,focus='court',human,sheep=[],crowd=[],staticMeshes=[],frames=0,windowStart=0,cpu=[];
const clamps=(v,a,b)=>Math.max(a,Math.min(b,v));
function status(s){$('load-status').textContent=s;}
async function model(name){return B.SceneLoader.LoadAssetContainerAsync('assets/art-courtyard/models/',`${name}.glb?v=${release}`,scene,undefined,'.glb');}
function instance(container,name){
 const copy=container.instantiateModelsToScene(n=>`${name}-${n}`,false,{doNotInstantiate:true});
 const root=new B.TransformNode(name,scene);for(const n of copy.rootNodes)n.parent=root;
 const groups=new Map(copy.animationGroups.map(g=>[g.name.replace(`${name}-`,''),g]));
 for(const g of copy.animationGroups){g.stop();}
 for(const m of root.getChildMeshes()){m.receiveShadows=true;m.isPickable=false;}
 return {root,groups,meshes:root.getChildMeshes(),blend:0};
}
function play(a,name,loop=true){const g=a.groups.get(name);if(!g)throw Error(`В модели отсутствует анимация ${name}`);g.start(loop,1,g.from,g.to,false);g.setWeightForAllAnimatables(1);return g;}
function buildStatic(container,name,positions){
 container.addAllToScene();const mats=new Map();for(const mesh of container.meshes)if(mesh.getTotalVertices()>0){mesh.computeWorldMatrix(true);if(!mats.has(mesh.material))mats.set(mesh.material,[]);mats.get(mesh.material).push(mesh);}
 const merged=[];for(const [material,parts]of mats){if(material.name.includes('raw-brick'))material.albedoColor=B.Color3.FromHexString('#806447').toLinearSpace();if(/woven-reed|unbleached/.test(material.name))material.albedoColor=B.Color3.FromHexString('#c4b28b').toLinearSpace();const mesh=B.Mesh.MergeMeshes(parts,true,true,undefined,false,false);mesh.material=material;mesh.overrideMaterialSideOrientation=B.Material.ClockWiseSideOrientation;mesh.receiveShadows=true;mesh.isPickable=false;mesh.name=`${name}-${material.name}`;merged.push(mesh);}
 positions.forEach((p,i)=>{const root=new B.TransformNode(`${name}-${i}`,scene);root.position.set(p[0],0,p[1]);root.rotation.y=p[2]||0;root.scaling.setAll(p[3]||1);for(const src of merged){const m=i?src.createInstance(`${src.name}-${i}`):src;m.parent=root;m.receiveShadows=true;staticMeshes.push(m);}root.computeWorldMatrix(true);for(const m of root.getChildMeshes()){m.computeWorldMatrix(true);m.freezeWorldMatrix();}});
}
function setFocus(next){focus=next;for(const el of document.querySelectorAll('[data-camera]'))el.classList.toggle('active',el.dataset.camera===focus);
 if(next==='court'){camera.setTarget(new B.Vector3(-.5,2.0,-2));camera.radius=29;camera.alpha=Math.PI/3;camera.beta=1.03;}
 if(next==='human'){camera.setTarget(new B.Vector3(human.root.position.x,1,human.root.position.z));camera.radius=4.4;camera.beta=1.25;camera.alpha=Math.PI/2-human.root.rotation.y+.35;}
 if(next==='sheep'){camera.setTarget(new B.Vector3(sheep[0].root.position.x,.55,sheep[0].root.position.z));camera.radius=4.3;camera.beta=1.15;camera.alpha=-.45;}
 if(next==='palm'){camera.setTarget(new B.Vector3(-10,4,-7));camera.radius=17;camera.beta=.97;camera.alpha=Math.PI/3;}
}
function quality(){const low=$('quality').value==='low';engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,low?1:1.5));scene.shadowsEnabled=!low;
 if(low&&ao){ao.dispose(true);ao=null;}if(!low&&!ao&&engine.webGLVersion>1){ao=new B.SSAO2RenderingPipeline('courtyard-contact',scene,{ssaoRatio:.65,blurRatio:1},[camera]);ao.radius=.55;ao.totalStrength=.65;ao.samples=16;ao.expensiveBlur=true;ao.maxZ=80;}
 engine.resize();}
function light(){const mode=$('light').value,e=mode==='evening',n=mode==='noon';sun.direction.set(e?-.8:-.6,e?-.45:n?-1.1:-.7,-.55);sun.position=camera.target.subtract(sun.direction.normalizeToNew().scale(60));sun.diffuse=B.Color3.FromHexString(e?'#ffd2a2':n?'#fff9ea':'#fff0d4');sun.diffuse=sun.diffuse.toLinearSpace();sun.intensity=e?2.5:n?3.1:2.9;scene.environmentIntensity=e?.35:n?.45:.35;scene.imageProcessingConfiguration.exposure=e?1.05:1.1;}
function animate(now){const start=performance.now(),dt=Math.min(.1,Math.max(0,(now-(last||now))/1000));last=now;if(document.hidden)return;if(!paused)time+=dt*speed;
 const mode=$('motion').value,walk=mode==='walk'||mode==='life'&&time%20<12;
 const phase=time*.29,x=-1.2+Math.sin(phase)*3,z=3.2+Math.cos(phase)*1.4;
 if(walk&&!paused){human.root.position.set(x,0,z);human.root.rotation.y=Math.atan2(Math.cos(phase)*3,-Math.sin(phase)*1.4);}
 if(!paused)human.blend+=(Number(walk)-human.blend)*(1-Math.exp(-dt*7));
 human.walk.setWeightForAllAnimatables(human.blend);human.idle.setWeightForAllAnimatables(1-human.blend);
 for(const g of [human.walk,human.idle])g.speedRatio=paused?0:speed*(g===human.walk?.85:1);
 for(let i=0;i<sheep.length;i++){const a=sheep[i],active=mode==='walk';
  const target=active?1:0;if(!paused)a.blend+=(target-a.blend)*(1-Math.exp(-dt*5));
  a.walk.setWeightForAllAnimatables(a.blend);a.graze.setWeightForAllAnimatables(1-a.blend);
  a.walk.speedRatio=paused?0:speed;a.graze.speedRatio=paused?0:speed;
  if(active&&!paused){const t=time*.22+i*2;a.root.position.set(3.9+Math.sin(t)*1.7,0,4+Math.cos(t)*1.2+i*.75);a.root.rotation.y=Math.atan2(Math.cos(t)*1.7,-Math.sin(t)*1.2);}
 }
 for(let i=0;i<crowd.length;i++){const a=crowd[i];a.walk.speedRatio=paused?0:speed;if(!paused){a.root.position.x=-18+(i%20)*1.8+Math.sin(time*.3+i)*.45;a.root.rotation.y=Math.cos(time*.3+i)>0?Math.PI/2:-Math.PI/2;}}
 if(focus==='human')camera.target.set(human.root.position.x,1,human.root.position.z);if(focus==='sheep')camera.target.set(sheep[0].root.position.x,.5,sheep[0].root.position.z);
 scenery.update(time);light();scene.render();cpu.push(performance.now()-start);frames++;if(!windowStart)windowStart=now;
 if(now-windowStart>2000){cpu.sort((a,b)=>a-b);$('metrics').dataset.time=time.toFixed(1);$('metrics').textContent=`${Math.round(frames*1000/(now-windowStart))} FPS · CPU кадра p95 ${(cpu[Math.floor(cpu.length*.95)]||0).toFixed(1)} мс · ${crowd.length?crowd.length+' жителей · 4×':'скелетные модели'} · ${engine.webGLVersion===2?'WebGL 2':'WebGL'}`;frames=0;windowStart=now;cpu=[];}
}
async function main(){
 if(!B?.Engine.IsSupported)throw Error('WebGL недоступен');engine=new B.Engine($('view'),true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});scene=new B.Scene(engine);scene.clearColor=B.Color4.FromHexString('#d2c6a5ff');scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.0065;scene.fogColor=B.Color3.FromHexString('#c7bea5');scene.skipPointerMovePicking=true;
 const ip=scene.imageProcessingConfiguration;ip.toneMappingEnabled=true;ip.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;ip.contrast=1.15;ip.exposure=1.08;
 camera=new B.ArcRotateCamera('art-camera',Math.PI/3,1.03,29,new B.Vector3(-.5,2,-2),scene);camera.attachControl($('view'),true);camera.minZ=.04;camera.maxZ=400;camera.lowerRadiusLimit=2.2;camera.upperRadiusLimit=100;camera.lowerBetaLimit=.4;camera.upperBetaLimit=1.5;camera.wheelDeltaPercentage=.035;camera.panningSensibility=100;
 sun=new B.DirectionalLight('morning-sun',new B.Vector3(-.6,-.7,.55),scene);sun.shadowMinZ=.1;sun.shadowMaxZ=150;sun.shadowFrustumSize=65;
 const fill=new B.HemisphericLight('soft-sky',new B.Vector3(0,1,0),scene);fill.intensity=.4;fill.diffuse=B.Color3.FromHexString('#e7e5de');fill.groundColor=B.Color3.FromHexString('#74624a');
 shadow=new B.ShadowGenerator(2048,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=B.ShadowGenerator.QUALITY_MEDIUM;shadow.bias=.0003;shadow.normalBias=.025;shadow.setDarkness(.12);
 scene.environmentTexture=new B.HDRCubeTexture('assets/art-courtyard/textures/kiara_1_dawn_1k.hdr',scene,128,false,true,false,true);
 scenery=createScenery(B,scene);status('Загружаем человека, овцу, пальму и архитектуру…');
 const stress=new URLSearchParams(location.search).has('benchmark');
 const [person,flock,palms,houses,lod]=await Promise.all([model('resident'),model('sheep'),model('date-palm'),model('adobe-courtyard'),stress?model('resident-lod'):null]);
 buildStatic(houses,'adobe-house',[[-4.3,-4.7,0,1],[6,-6,-.28,.82]]);buildStatic(palms,'date-palm',[[-10,-7,0,.82],[9.5,-10,.7,.75]]);
 human=instance(person,'resident');human.root.position.set(-1.2,0,4.6);human.walk=play(human,'Walk_Loop');human.idle=play(human,'Idle_Loop');human.walk.setWeightForAllAnimatables(0);
 for(let i=0;i<2;i++){const a=instance(flock,`sheep-${i}`);a.root.position.set(4+i*.85,0,3.2+i*1.05);a.root.rotation.y=1+i*.9;a.walk=play(a,'Walk');a.graze=play(a,'Graze');a.walk.setWeightForAllAnimatables(0);sheep.push(a);}
 if(stress){speed=4;$('motion').value='walk';$('caption').textContent='Нагрузочная проба · 200 скелетных фигур · 4× · облегчённые модели';for(let i=0;i<200;i++){const a=instance(lod,`crowd-${i}`);a.root.position.set(-18+(i%20)*1.8,0,8+Math.floor(i/20)*1.8);a.walk=play(a,'Walk_Loop');crowd.push(a);}camera.setTarget(new B.Vector3(0,1,12));camera.radius=54;focus='stress';}
 shadow.getShadowMap().renderList=[...staticMeshes,...human.meshes,...sheep.flatMap(a=>a.meshes),...crowd.flatMap(a=>a.meshes)];
 quality();light();
 for(const b of document.querySelectorAll('[data-camera]'))b.onclick=()=>setFocus(b.dataset.camera);
 $('pause').onclick=()=>{paused=!paused;$('pause').textContent=paused?'Продолжить':'Пауза';$('pause').setAttribute('aria-pressed',String(paused));};$('quality').onchange=quality;
 $('clean').onclick=()=>document.body.classList.add('clean');document.addEventListener('keydown',e=>{if(e.key==='Escape')document.body.classList.remove('clean');if(e.code==='Space'&&!['SELECT','BUTTON'].includes(e.target.tagName)){e.preventDefault();$('pause').click();}});
 $('photo').onclick=()=>{$('view').toBlob(blob=>{if(!blob)return;const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='new-babylon-art-courtyard.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);});};
 window.addEventListener('resize',()=>{engine.resize();});document.addEventListener('visibilitychange',()=>{last=performance.now();frames=0;windowStart=0;cpu=[];});
 await scene.whenReadyAsync();$('loading').hidden=true;last=performance.now();engine.runRenderLoop(()=>animate(performance.now()));
}
main().catch(e=>{console.error('Art courtyard',e);$('loading').hidden=false;$('loading').querySelector('h2').textContent='Не удалось открыть двор';status(e.message+' Основная игра доступна по ссылке ниже.');});
