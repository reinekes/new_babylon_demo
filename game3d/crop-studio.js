import {loadFieldCrops} from './field-crops.js';
import {fieldCropKind,CROP_NAMES,createDateClusters,createBotanicalMaterial} from './crop-varieties.js';
const B=window.BABYLON,engine=new B.Engine(document.getElementById('canvas'),true),scene=new B.Scene(engine);
scene.clearColor=new B.Color4(.34,.39,.37,1);scene.imageProcessingConfiguration.exposure=1.15;
const camera=new B.ArcRotateCamera('camera',-1.10,.86,31,new B.Vector3(8,0,4),scene);camera.attachControl(engine.getRenderingCanvas(),true);camera.lowerRadiusLimit=4;camera.upperRadiusLimit=45;camera.wheelPrecision=35;
const sky=new B.HemisphericLight('sky',new B.Vector3(.2,1,.3),scene);sky.intensity=1.0;sky.groundColor=new B.Color3(.31,.26,.18);
const sun=new B.DirectionalLight('sun',new B.Vector3(-.4,-1,.6),scene);sun.intensity=1.4;
const soil=new B.PBRMaterial('soil',scene);soil.albedoColor=B.Color3.FromHexString('#806950');soil.metallic=0;soil.roughness=1;
const plots=[],assets=await loadFieldCrops(B,scene);if(!assets)throw Error('Не удалось загрузить образцы культур');
const state={buildings:[],world:{lakes:[]}};
function focus(plot){camera.setTarget(new B.Vector3(plot.x,.5,plot.z));camera.radius=8.6;camera.beta=.83;}
function button(label,fn){const button=document.createElement('button');button.textContent=label;button.onclick=fn;document.getElementById('choices').append(button);}
for(const [kind,label]of Object.entries(CROP_NAMES)){
 const id=Array.from({length:140},(_,id)=>id).find(id=>fieldCropKind({id})===kind),index=plots.length,x=(index%4)*7,z=Math.floor(index/4)*7;
 const b={id,type:'field',x:3,y:4,crop:{growth:1,sown:1,total:100,remaining:100}},plot={x,z,b,meshes:[]};plots.push(plot);state.buildings.push(b);
 const bed=B.MeshBuilder.CreateBox('bed-'+kind,{width:5.7,height:.12,depth:5.7},scene);bed.position.set(x,.04,z);bed.material=soil;
 button(label,()=>focus(plot));
}
function rebuild(){let triangles=0;for(const plot of plots){for(const mesh of plot.meshes)mesh.dispose();plot.b.crop.growth=Number(document.getElementById('growth').value);plot.meshes=assets.create(plot.b,state);for(const mesh of plot.meshes){mesh.position.set(plot.x,0,plot.z);mesh.isVisible=true;triangles+=mesh.getIndices().length/3;}}
 document.getElementById('status').textContent=`7 культур · ${triangles.toLocaleString('ru-RU')} треугольников посадок · вращайте/приближайте мышью`;}
rebuild();document.getElementById('growth').oninput=rebuild;document.getElementById('all').onclick=()=>{camera.setTarget(new B.Vector3(10.5,0,3.5));camera.radius=31;};
const garden={x:21,z:7};for(const mesh of assets.createGarden({type:'house',id:2,x:3,y:4},state)){mesh.position.set(garden.x,0,garden.z);mesh.isVisible=true;}
button('Домашний огород',()=>focus({...garden,z:garden.z+2.3}));
const palm=await B.SceneLoader.ImportMeshAsync('','','assets/art-courtyard/models/valley-date-palm.glb',scene,undefined,'.glb');
const palmRoot=new B.TransformNode('palm-fixture',scene);palmRoot.position.set(21,0,7);for(const mesh of palm.meshes)if(!mesh.parent)mesh.parent=palmRoot;
const dates=createDateClusters(B,scene,{height:5.2,radius:.45,seed:2},createBotanicalMaterial(B,scene,'date-fruit'));dates.parent=palmRoot;
button('Финики',()=>{camera.setTarget(new B.Vector3(21,5.3,7));camera.radius=7;camera.beta=1.1;});
window.__cropStudio={scene,plots,assets,camera,engine,focus};
engine.runRenderLoop(()=>scene.render());window.addEventListener('resize',()=>engine.resize());
