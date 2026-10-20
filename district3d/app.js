import {advanceTime,resolveEvent,eventReason,yieldSummary} from '../engine.js';
import {BUILDINGS,RESOURCE_NAMES,citizenName,buildingKey} from '../definitions.js';
import {constructionProgress} from '../construction.js';
import {lightingAt} from '../city-life.js';
import {artisanSummary} from '../artisan.js';
import {createDistrictMaterials} from './materials.js';
import {createDistrictTerrain} from './terrain.js';
import {districtCropVisual,createDistrictBuilding} from './buildings.js';
import {createDistrictActors} from './actors.js';
import {makeDemoDistrict,makeStressDistrict,readCityCopy} from './state.js';
const $=id=>document.getElementById(id),B=globalThis.BABYLON;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roleNames={auto:'Житель',production:'Мастер',carrier:'Носильщик',builder:'Строитель',healer:'Лекарь',tailor:'Мастер одежды',watercarrier:'Водонос'};
const stageNames={idle:'Ожидание сырья',forming:'Формовка',drying:'Сушка',firing:'Обжиг',cooling:'Остывание',brewing:'Приготовление',ready:'Готово к отправке'};
const phaseName=c=>c.phase==='working'?'Работает':c.phase==='home'?'Дома':c.phase==='festival'?'На празднике':c.phase==='playing'?'Играет':c.phase==='blocked'?'Ожидает путь':'В пути';
const number=n=>new Intl.NumberFormat('ru',{maximumFractionDigits:1}).format(n||0);
let state,engine,scene,camera,terrain,actors,materials,sun,hemisphere,shadow,glow,paused=false,speed=1,light='day',views=new Map(),homeLights=new Map(),selected=null,activeSource='demo',last=0,lastUI=0,frames=0,windowStart=0,cpuSamples=[],frameSamples=[],noticeTimer,lastShadowCount=-1;
function notice(text){$('notice').textContent=text;$('notice').hidden=false;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('notice').hidden=true,4000);}
function fallback(error){$('loading').hidden=false;$('loading').querySelector('h2').textContent='Не удалось открыть 3D';$('loading').querySelector('p').textContent='Для объёмного квартала нужен работающий WebGL. Основная игра доступна по ссылке ниже. '+(error?.message||'');console.error('3D district:',error);}
function home(){camera.setTarget(new B.Vector3(8.7*6,0,9.25*6));camera.alpha=Math.PI/4;camera.beta=.91;camera.radius=window.innerWidth<600?76:59;}
function overview(){const bs=state.buildings,center=bs.reduce((p,b)=>({x:p.x+b.x/bs.length,z:p.z+b.y/bs.length}),{x:0,z:0});camera.setTarget(new B.Vector3(center.x*6,0,center.z*6));camera.radius=145;camera.beta=.7;}
function refreshBuildings(){
 const keys=new Set();for(const b of state.buildings){const key=buildingKey(b);keys.add(key);const signature=`${b.type}/${b.level}/${b.construction?.kind||''}/${b.construction?.target||''}/${Math.floor(constructionProgress(b).ratio*8)}/${b.type==='field'?districtCropVisual(b).signature:''}`;let v=views.get(key);if(v?.signature!==signature){if(v)v.dispose();v=createDistrictBuilding(B,scene,b,materials);v.signature=signature;views.set(key,v);lastShadowCount=-1;}v.update?.(state,state.simTime);}
 for(const [key,v]of views)if(!keys.has(key)){v.dispose();views.delete(key);lastShadowCount=-1;}
 const occupied=new Set(state.citizens.map(c=>c.home));const homes=state.buildings.filter(b=>b.type==='house'&&!b.construction&&occupied.has(buildingKey(b))).slice(0,6),lit=new Set(homes.map(buildingKey));for(const [key,l]of homeLights)if(!lit.has(key)){l.dispose();homeLights.delete(key);}for(const b of homes){const key=buildingKey(b);if(!homeLights.has(key)){const l=new B.PointLight('courtyard-oil-lamp',new B.Vector3(b.x*6+.7,1.6,b.y*6+.5),scene);l.diffuse=new B.Color3(1,.62,.26);l.range=9;l.intensity=0;l.includedOnlyMeshes=[...views.get(key).meshes,...terrain.meshes.filter(m=>/alluvial-valley|soft-riparian/.test(m.name))];homeLights.set(key,l);}}
}
function load(source){
 let next;if(source==='city'){let result;try{result=readCityCopy(localStorage);}catch{result={ok:false,reason:'Браузер не разрешил прочитать сохранение.'};}if(!result.ok){notice(result.reason);$('source').value=activeSource;return;}next=result.state;}else next=source==='stress'?makeStressDistrict():makeDemoDistrict();
 if(actors)actors.dispose();if(terrain)terrain.dispose();for(const v of views.values())v.dispose();views.clear();for(const l of homeLights.values())l.dispose();homeLights.clear();selected=null;$('detail').hidden=true;state=next;activeSource=source;terrain=createDistrictTerrain(B,scene,state,materials);actors=createDistrictActors(B,scene,materials);refreshBuildings();actors.update(state,state.simTime);lastShadowCount=-1;paused=!!state.event;home();last=performance.now();refreshUI();
}
function lightScene(){
 const l=lightingAt(light==='auto'?state.simTime:({day:10,sunset:22.5,night:37.5}[light]));const n=l.night||0,warm=light==='sunset'?1:l.warm||0;
 sun.direction=new B.Vector3(-.65,-.9+warm*.45,.45);sun.position=camera.target.subtract(sun.direction.normalizeToNew().scale(100));sun.shadowFrustumSize=Math.max(35,Math.min(180,camera.radius*1.3));sun.intensity=2.1*(1-n)+.22;sun.diffuse=B.Color3.Lerp(B.Color3.Lerp(new B.Color3(1,.9,.7),new B.Color3(1,.65,.32),warm),new B.Color3(.51,.63,.77),n);hemisphere.intensity=.48-.2*n;hemisphere.diffuse=B.Color3.Lerp(new B.Color3(.83,.9,.99),new B.Color3(.4,.5,.7),n);hemisphere.groundColor=new B.Color3(.38,.30,.19);scene.clearColor=B.Color4.FromHexString(n>.6?'#424e60ff':'#d8ddd5ff');scene.fogColor=B.Color3.Lerp(B.Color3.Lerp(new B.Color3(.81,.81,.72),new B.Color3(.83,.72,.57),warm),new B.Color3(.27,.32,.4),n);scene.imageProcessingConfiguration.exposure=1.12+n*.18;for(const l of homeLights.values())l.intensity=n*3.5;
}
function shadowList(){
 if(!shadow)return;const count=scene.meshes.length;if(lastShadowCount===count)return;lastShadowCount=count;
 const set=new Set();for(const v of views.values())for(const m of v.meshes)if(m.isEnabled())set.add(m);
 for(const m of actors.meshes||[])if(m.isEnabled())set.add(m.sourceMesh||m);
 // Palms share one static merged mesh. Ground and grass never cast expensive shadows.
 for(const m of terrain.meshes)if(/palm/.test(m.name))set.add(m);
 shadow.getShadowMap().renderList=[...set];
}
function detail(){if(!selected)return;let title,body,label;
 if(selected.citizenId!==undefined){const c=state.citizens.find(c=>c.id===selected.citizenId);if(!c){$('detail').hidden=true;selected=null;return;}title=citizenName(c.id);label='ЖИТЕЛЬ · РЕАЛЬНОЕ СОСТОЯНИЕ';const home=state.buildings.find(b=>buildingKey(b)===c.home),work=state.buildings.find(b=>buildingKey(b)===c.work);body=`<p>${Math.floor(c.age)} лет · ${escape(roleNames[c.role]||'Житель')} · ${phaseName(c)}</p><p>Здоровье ${number(c.health)}% · настроение ${number(c.mood)}%<br>Голод ${number(c.hunger)}% · вера ${number(c.faith)}%</p><p>Дом: ${home?`${home.x}, ${home.y}`:'нет'}<br>Работа: ${work?BUILDINGS[work.type].name:'свободен'}</p><p>Груз: ${escape(Object.entries(c.cargo||{}).filter(([,n])=>n>0).map(([k,n])=>`${number(n)} ${RESOURCE_NAMES[k]||k}`).join(', ')||'пусто')}</p>`;
 }else if(selected.buildingKey){const b=state.buildings.find(b=>buildingKey(b)===selected.buildingKey);if(!b){$('detail').hidden=true;return;}title=BUILDINGS[b.type].name;label=`УРОВЕНЬ ${b.level||1} · ${b.x}, ${b.y}`;body=`<p>${escape(yieldSummary(state,b))}</p>`;if(b.type==='house'){const residents=state.citizens.filter(c=>c.home===buildingKey(b));body+=`<p>Живут ${residents.length} · еда ${number(b.pantry)} · вода ${number(b.water)}</p><p>${residents.map(c=>`${escape(citizenName(c.id))} · ${Math.floor(c.age)} лет`).join('<br>')}</p>`;}if(b.construction)body+=`<p>Строительство ${Math.round(constructionProgress(b).ratio*100)}%</p>`;const a=artisanSummary(b);if(a)body+=`<p>Стадия: ${escape(stageNames[a.stage]||'Работа')} · готово ${number(a.ready)}</p>`;
 }else{title=({sheep:'Овца',goat:'Коза',gazelle:'Газель',bird:'Птица',jackal:'Шакал',cat:'Животное',mouse:'Мышь'})[selected.animalKind]||'Животное';label='ЖИЗНЬ ДОЛИНЫ';body='<p>Движется по тем же безопасным путям, что и в основной игре.</p>';}
 $('detail').hidden=false;$('detail').innerHTML=`<button aria-label="Закрыть описание" id="close-detail">×</button><span class="eyebrow">${label}</span><h2>${escape(title)}</h2>${body}`;$('close-detail').onclick=()=>{selected=null;$('detail').hidden=true;};
}
function refreshUI(){
 $('pause').textContent=paused?'Продолжить':'Пауза';$('pause').setAttribute('aria-pressed',String(paused));const seasons=['Весна','Лето','Осень','Зима'];$('city-stats').textContent=`Год ${state.year} · ${seasons[state.season]} · ${state.population} жителей · ${state.buildings.length} построек · еда ${Math.floor(state.resources.food)} · ${activeSource==='demo'?'демонстрационный квартал':activeSource==='stress'?'нагрузочная сцена 4×':'копия вашего города'}`;
 $('event').hidden=!state.event;if(state.event){$('event-title').textContent=state.event.title;$('event-text').textContent=state.event.text+' '+eventReason(state);$('event-accept').disabled=!!eventReason(state);}detail();
}
function quality(){const low=$('quality').value==='low';scene.shadowsEnabled=!low;glow.isEnabled=!low;engine.setHardwareScalingLevel(1/Math.min(devicePixelRatio||1,low?1:1.5));engine.resize();}
function animate(now){const start=performance.now(),dt=Math.min(.15,Math.max(0,(now-(last||now))/1000));last=now;if(document.hidden)return;if(activeSource==='stress')state.event=null;
 if(!paused&&!state.event&&(!state.lost||state.funeral))advanceTime(state,dt*speed);
 actors.update(state,state.simTime);terrain.update(state,state.simTime);lightScene();shadowList();
 if(now-lastUI>500){refreshBuildings();refreshUI();lastUI=now;}scene.render();cpuSamples.push(performance.now()-start);if(dt>0)frameSamples.push(dt*1000);frames++;
 if(!windowStart)windowStart=now;if(now-windowStart>=2000){cpuSamples.sort((a,b)=>a-b);frameSamples.sort((a,b)=>a-b);const p95=cpuSamples[Math.floor(cpuSamples.length*.95)]||0;$('metrics').dataset.simTime=state.simTime.toFixed(1);$('metrics').textContent=`${Math.round(frames*1000/(now-windowStart))} FPS · CPU кадра p95 ${p95.toFixed(1)} мс · ${scene.getActiveMeshes().length} активных мешей · ${engine.webGLVersion===2?'WebGL 2':'WebGL'}`;windowStart=now;frames=0;cpuSamples=[];frameSamples=[];}
}
async function main(){
 if(!B||!B.Engine.IsSupported)throw Error('WebGL недоступен');
 state=makeDemoDistrict();engine=new B.Engine($('district'),true,{preserveDrawingBuffer:true,stencil:true,powerPreference:'high-performance'});scene=new B.Scene(engine);scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.0035;scene.skipPointerMovePicking=true;scene.imageProcessingConfiguration.contrast=1.08;
 camera=new B.ArcRotateCamera('quarter',Math.PI/4,.91,59,new B.Vector3(52,0,55),scene);camera.attachControl($('district'),true);camera.lowerRadiusLimit=12;camera.upperRadiusLimit=270;camera.lowerBetaLimit=.35;camera.upperBetaLimit=1.3;camera.wheelDeltaPercentage=.035;camera.panningSensibility=80;camera.minZ=.15;camera.maxZ=650;
 sun=new B.DirectionalLight('late-morning-sun',new B.Vector3(-.65,-.9,.45),scene);sun.position=new B.Vector3(45,95,-25);sun.shadowMinZ=.1;sun.shadowMaxZ=350;hemisphere=new B.HemisphericLight('open-sky',new B.Vector3(0,1,0),scene);
 shadow=new B.ShadowGenerator(2048,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=B.ShadowGenerator.QUALITY_MEDIUM;shadow.bias=.0004;shadow.normalBias=.03;shadow.setDarkness(.2);glow=new B.GlowLayer('lamps',scene,{blurKernelSize:32});glow.intensity=.22;
 materials=createDistrictMaterials(B,scene);const benchmark=new URLSearchParams(location.search).has('benchmark');if(benchmark){$('source').insertAdjacentHTML('beforeend','<option value="stress">Нагрузка · 200 жителей</option>');$('source').value='stress';speed=4;document.querySelector('[data-speed="1"]').classList.remove('active');document.querySelector('[data-speed="4"]').classList.add('active');}load(benchmark?'stress':'demo');quality();
 scene.onPointerObservable.add(info=>{if(info.type!==B.PointerEventTypes.POINTERPICK||!info.pickInfo?.hit)return;let m=info.pickInfo.pickedMesh;while(m&&!m.metadata)m=m.parent;if(m?.metadata){selected={...m.metadata};detail();}});
 $('pause').onclick=()=>{paused=!paused;refreshUI();};for(const b of document.querySelectorAll('[data-speed]'))b.onclick=()=>{speed=Number(b.dataset.speed);for(const el of document.querySelectorAll('[data-speed]'))el.classList.toggle('active',el===b);};$('source').onchange=e=>load(e.target.value);$('light').onchange=e=>light=e.target.value;$('quality').onchange=quality;$('home').onclick=home;$('zoom-in').onclick=()=>camera.radius=Math.max(12,camera.radius*.82);$('zoom-out').onclick=()=>camera.radius=Math.min(270,camera.radius/ .82);$('toggle-ui').onclick=()=>{document.body.classList.toggle('clean-view');$('toggle-ui').textContent=document.body.classList.contains('clean-view')?'Показать панели':'Скрыть панели';};$('overview').onclick=overview;
 for(const choice of ['accept','skip'])$(`event-${choice}`).onclick=()=>{const result=resolveEvent(state,choice);if(!result.ok)notice(result.reason);else{paused=false;refreshUI();}};
 $('photo').onclick=()=>{scene.render();$('district').toBlob(blob=>{if(!blob){notice('Не удалось сохранить кадр');return;}const a=document.createElement('a'),url=URL.createObjectURL(blob);a.href=url;a.download=`new-babylon-3d-y${state.year}.png`;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);notice('Снимок сохранён');},'image/png');};
 document.addEventListener('keydown',e=>{if(['INPUT','SELECT','BUTTON'].includes(e.target.tagName))return;if(e.code==='Space'){e.preventDefault();paused=!paused;refreshUI();}if(e.key==='Escape'){document.body.classList.remove('clean-view');$('toggle-ui').textContent='Скрыть панели';selected=null;$('detail').hidden=true;}});window.addEventListener('resize',()=>engine.resize());document.addEventListener('visibilitychange',()=>{last=performance.now();windowStart=0;frames=0;cpuSamples=[];frameSamples=[];});
 await scene.whenReadyAsync();$('loading').hidden=true;last=performance.now();engine.runRenderLoop(()=>animate(performance.now()));
}
main().catch(fallback);
