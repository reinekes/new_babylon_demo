import {loadBabylonVendors} from '../../game3d/vendor-loading.js';
import {createGameBuildings} from '../../game3d/buildings.js';
import {createGameActors} from '../../game3d/actors.js';
import {createDistrictMaterials} from '../../district3d/materials.js';
import {createGame} from '../../engine.js';
import {generateStreets} from '../../city-life.js';
import {workArtisan,advanceArtisans} from '../../artisan.js';
import {potterWheelView} from '../../potter-wheel.js';
import {workstationBuilding,workstationLayout,workstationWorldPoint} from '../../game3d/workstations.js';
import {surfaceElevation} from '../../district3d/terrain.js';
import {Renderer} from '../../renderer.js';
import {drawArtisan} from '../../artisan-art.js';
const B=await loadBabylonVendors(),canvas=document.querySelector('#world'),engine=new B.Engine(canvas,true),scene=new B.Scene(engine);
scene.clearColor=B.Color4.FromHexString('#c8b99eff');
const camera=new B.ArcRotateCamera('qa',Math.PI/2-.62,.95,11,new B.Vector3(36,1,60),scene);camera.attachControl(canvas,true);camera.minZ=.05;
new B.HemisphericLight('ambient',new B.Vector3(0,1,0),scene).intensity=.9;new B.DirectionalLight('sun',new B.Vector3(-.7,-1,.4),scene).intensity=2;
const mats=createDistrictMaterials(B,scene),ground=B.MeshBuilder.CreateGround('ground',{width:160,height:160},scene);ground.material=mats.soil;ground.position.set(36,-.05,60);
const layer=await createGameBuildings(B,scene,mats,{deferAssets:true}),actors=await createGameActors(B,scene,mats,{includeFauna:false});
let state=createGame({start:'established'}),playing=false,close=false,pure=true,records=[];
const b={id:'potter-qa',type:'pottery',x:6,y:10,level:1,artisan:{stage:'idle',elapsed:0,ready:0,clay:4,reed:2,water:2,food:0,pottery:0,vesselUses:0}};
const citizen=state.citizens.find(c=>c.age>=16);state.buildings=[b];const port=generateStreets(state.buildings,state).ports[0];state.citizens=[{...citizen,id:9901,age:30,phase:'working',x:port.x,y:port.y,work:'potter-qa',cargo:{},buildCargo:{},guardPost:null,site:null}];
const flat=Object.create(Renderer.prototype);Object.assign(flat,{ctx:document.querySelector('#flat').getContext('2d'),point:()=>({x:260,y:265}),s:3.5,reduce:true,lights:[]});
function sync(dt=0){const before=JSON.stringify(state);layer.sync(state);actors.update(state,dt,{paused:!playing});pure&&=before===JSON.stringify(state);const q=state.buildings[0];flat.ctx.clearRect(0,0,520,440);flat.lights=[];drawArtisan(flat,q,state,state.simTime);document.querySelector('#status').textContent=`Стадия: ${q.artisan.stage} · труд ${q.artisan.elapsed.toFixed(3)} с · угол ${potterWheelView(q).angle.toFixed(4)} · ${playing?'идёт':'пауза'} · входы ${pure?'не изменены':'ИЗМЕНЕНЫ'}`;}
function step(dt){const q=state.buildings[0];workArtisan(q,dt,state);advanceArtisans(state,dt);state.simTime+=dt;sync(dt);}
function capture(label){const q=state.buildings[0],wheel=layer.meshes.find(m=>m.metadata.potterWheel);records.push({label,stage:q.artisan.stage,elapsed:q.artisan.elapsed,angle:wheel.rotation.y,formingClay:layer.meshes.find(m=>m.metadata.formingClay).isVisible,pure,saved:JSON.stringify(state)});document.querySelector('#proof').textContent=JSON.stringify(records,null,2);}
document.querySelector('#step').onclick=()=>{playing=false;step(.2);capture('step');};document.querySelector('#play').onclick=()=>{playing=!playing;sync();capture(playing?'play':'pause');};document.querySelector('#capture').onclick=()=>capture('capture');
document.querySelector('#reload').onclick=()=>{playing=false;const saved=JSON.stringify(state);state=JSON.parse(saved);sync();capture('reload');};
document.querySelector('#close').onclick=()=>{close=!close;const q=state.buildings[0],a=workstationLayout(workstationBuilding(q,state))[0],p=workstationWorldPoint(q,[a.x,a.height,a.z]);camera.setTarget(close?new B.Vector3(p.x*6,surfaceElevation(p.x,p.y,state)+.9,p.y*6):new B.Vector3(36,1,60));camera.radius=close?3.3:11;};
for(const button of document.querySelectorAll('button'))button.disabled=false;sync();capture('initial');engine.runRenderLoop(()=>{if(playing)step(Math.min(.05,engine.getDeltaTime()/1000));scene.render();});window.onresize=()=>engine.resize();
