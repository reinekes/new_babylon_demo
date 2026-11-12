import { loadBabylonVendors } from '../game3d/vendor-loading.js';
import { loadModel } from '../game3d/asset-loading.js';
import { createGameBuildings } from '../game3d/buildings.js';
import { createDistrictMaterials } from '../district3d/materials.js';
import { createWildlife } from '../game3d/wildlife.js';
import { createAmbientFauna } from '../game3d/ambient-fauna.js';
import { cropPlantGeometry,createBotanicalMaterial,botanicalMesh } from '../game3d/crop-varieties.js';
import { createNatureDetails } from '../game3d/nature-details.js';
import { createBirdFlocks } from '../game3d/bird-flocks.js';
import { createGoodsSources } from '../game3d/goods.js';
import { createSumerRiverHull } from '../game3d/sumer-river-hull.js';
import { canalNetworkGeometry } from '../game3d/canal-network.js';
import { wornRoadGeometry } from '../game3d/water.js';
import { createNewCity } from '../new-game.js';
import { legacyScenario } from '../scenario-profiles.js';
import { newFootprint } from '../footprints.js';
import { riverPoint } from '../world.js';

function plainMaterial(B,scene,name,color) {
  const material=new B.PBRMaterial(name,scene);
  material.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  material.roughness=.96;
  material.metallic=0;
  material.backFaceCulling=false;
  return material;
}

const assetDirectory = new URL('../assets/art-courtyard/models/',import.meta.url).href;
const stateFor = profile => {
  const state = createNewCity({mode:'mature',seed:137});
  if (profile==='legacy') state.scenario=legacyScenario();
  state.buildings=[];
  state.citizens=[];
  return state;
};

function geometry(B,scene,name,data,material) {
  if (!data.indices.length) return null;
  const mesh=new B.Mesh(name,scene), vertices=new B.VertexData(), normals=[];
  B.VertexData.ComputeNormals(data.positions,data.indices,normals);
  Object.assign(vertices,{positions:data.positions,indices:data.indices,normals,uvs:data.uvs});
  vertices.applyToMesh(mesh);
  mesh.material=material;
  return mesh;
}

async function makeModel(B,scene,item,profile) {
  if (item.kind==='glb') {
    const container=await loadModel(B,scene,assetDirectory,item.entry.file,scene,undefined,'.glb');
    container.addAllToScene();
    for (const clip of scene.animationGroups) clip.stop();
    const first=scene.animationGroups[0];
    if (first) {
      first.start(true);
      first.pause();
      first.goToFrame(first.from);
    }
    return;
  }
  const state=stateFor(profile);
  if (item.kind==='crop') {
    const data=cropPlantGeometry(item.key);
    data.normals=[];
    B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);
    botanicalMesh(B,scene,item.key,data,createBotanicalMaterial(B,scene));
    return;
  }
  if (item.kind==='dairy') {
    state.buildings.push({type:'cowshed',x:6,y:6,level:1,footprint:2,dairy:{cows:1,calves:1}});
    const view=await createAmbientFauna(B,scene,[],{
      includeSkyBirds:false,
      warn:()=>{},
      loadAsset(file) {
        if (file!=='ambient-bull.glb') return Promise.reject(Error('Model outside dairy preview'));
        return loadModel(B,scene,assetDirectory,file,scene,undefined,'.glb');
      }
    });
    view.update(state,0,{paused:true});
    for (const root of view.roots()) {
      const metadata=root.metadata;
      root.setEnabled(Boolean(metadata.dairyBuilding)&&metadata.calf===item.calf);
    }
    return;
  }
  if (item.kind==='wildlife') {
    const view=createWildlife(B,scene);
    view.update(state,[{id:'atlas',kind:item.species,x:6,y:6,heading:0,behavior:'looking',waterLevel:0,swimDepth:.12}],0);
    return;
  }
  if (item.kind==='flock') {
    const view=createBirdFlocks(B,scene,{tier:'low',state});
    view.update(state,7);
    for (const root of view.roots().slice(1)) root.setEnabled(false);
    return;
  }
  const materials=createDistrictMaterials(B,scene);
  if (item.kind==='nature') {
    const view=createNatureDetails(B,scene,materials,{tier:'low'});
    view.update(state,7,{type:'clear'},[],'atlas');
    let found=false;
    for (const mesh of view.meshes) {
      const matches=!found&&mesh.metadata?.natureDetail?.kind===item.species;
      mesh.setEnabled(matches);
      found||=matches;
    }
    return;
  }
  if (item.kind==='goods') {
    createGoodsSources(B,scene,materials).sources.get(item.key).setEnabled(true);
    return;
  }
  if (item.kind==='boat') {
    createSumerRiverHull(B,scene,{bitumen:plainMaterial(B,scene,'bitumen','#352b20'),reed:materials.reed,wood:materials.wood});
    return;
  }
  if (item.kind==='road') {
    const road=wornRoadGeometry(state,{x:6,y:6},{x:8,y:6},1.22,.038,item.level);
    const surface=geometry(B,scene,'road',road,plainMaterial(B,scene,'road-finish',['#806443','#a18b63','#afa68b'][item.level-1]));
    surface.position.set(road.origin.x,0,road.origin.z);
    return;
  }
  if (item.type==='canal') {
    const canal={x:6,y:6,wet:true,progress:1,arms:[[-1,0],[1,0]],flowWidth:1};
    const channels=canalNetworkGeometry(state,[canal]);
    const water=new B.StandardMaterial('atlas-water',scene);
    water.diffuseColor=B.Color3.FromHexString('#56938c');
    water.backFaceCulling=false;
    geometry(B,scene,'canal-bed',channels.wetBed,plainMaterial(B,scene,'wet-mud','#4d584a'));
    geometry(B,scene,'canal-water',channels.water,water);
    return;
  }
  const site=item.type==='bridge'?riverPoint(12,state):item.type==='field'?riverPoint(12,state,3):{x:6,y:6};
  const building={type:item.type,x:Math.round(site.x),y:Math.round(site.y),level:item.level,
    footprint:newFootprint(item.type),...(item.starter?{starterHut:true}:{})};
  if (item.type==='field') building.crop={sown:1,growth:1,seed:1};
  state.buildings.push(building);
  const layer=await createGameBuildings(B,scene,materials,{deferAssets:true});
  if (item.type==='field') await layer.loadDetails();
  layer.sync(state);
  await layer.sacredReady();
  layer.sync(state);
}

function frame(B,scene,camera) {
  const meshes=scene.meshes.filter(mesh=>mesh.isVisible&&mesh.isEnabled()&&mesh.getTotalVertices()>0);
  if (!meshes.length) throw Error('В этой сцене нет видимой геометрии');
  const min=new B.Vector3(Infinity,Infinity,Infinity),max=new B.Vector3(-Infinity,-Infinity,-Infinity);
  for (const mesh of meshes) {
    mesh.computeWorldMatrix(true);
    const {minimumWorld,maximumWorld}=mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(minimumWorld);
    max.maximizeInPlace(maximumWorld);
  }
  const diameter=max.subtract(min).length();
  if (!Number.isFinite(diameter)||diameter<=0) throw Error('Не удалось определить размер модели');
  const {alpha,beta}=camera;
  camera.setTarget(min.add(max).scale(.5));
  camera.alpha=alpha;
  camera.beta=beta;
  camera.radius=diameter*1.28;
  camera.lowerRadiusLimit=diameter*.27;
  camera.upperRadiusLimit=diameter*4;
  camera.minZ=diameter*.005;
  camera.maxZ=diameter*15;
  camera.wheelDeltaPercentage=.025;
  return {min,max,diameter};
}

export async function createPreview(canvas) {
  const B=await loadBabylonVendors();
  const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true,stencil:true});
  let scene=null,camera=null;
  const render=()=>scene?.render();
  function close() {
    engine.stopRenderLoop(render);
    camera?.detachControl();
    scene?.dispose();
    scene=null;
    camera=null;
  }
  async function open(item,profile) {
    close();
    scene=new B.Scene(engine);
    scene.clearColor=B.Color4.FromHexString('#c2ac87ff');
    scene.imageProcessingConfiguration.toneMappingEnabled=true;
    scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    camera=new B.ArcRotateCamera('atlas',item.kind==='building'?1.08:.94,item.kind==='glb'?1.26:.86,10,B.Vector3.Zero(),scene);
    const sun=new B.DirectionalLight('sun',new B.Vector3(-.65,-1,-.45),scene);
    sun.intensity=2.15;
    const sky=new B.HemisphericLight('sky',B.Axis.Y,scene);
    sky.intensity=1.18;
    try {
      await makeModel(B,scene,item,profile);
      await scene.whenReadyAsync();
      frame(B,scene,camera);
      engine.resize();
      render();
      render();
      return scene.animationGroups.map(g=>g.name);
    } catch (error) {
      close();
      throw error;
    }
  }
  return {
    open,close,
    capture:()=>canvas.toDataURL('image/jpeg',.82),
    interactive(){engine.resize();camera.attachControl(canvas,true);engine.runRenderLoop(render);},
    rotate(value){if(camera)camera.useAutoRotationBehavior=value;},
    play(index){for(const clip of scene?.animationGroups??[])clip.stop();scene?.animationGroups[index]?.start(true);}
  };
}
