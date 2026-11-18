import { loadBabylonVendors } from '../game3d/vendor-loading.js';

function plainMaterial(B,scene,name,color) {
  const material=new B.PBRMaterial(name,scene);
  material.albedoColor=B.Color3.FromHexString(color).toLinearSpace();
  material.roughness=.96;
  material.metallic=0;
  material.backFaceCulling=false;
  return material;
}

const assetDirectory = new URL('../assets/art-courtyard/models/',import.meta.url).href;
const stateFor = async profile => {
  const {createNewCity}=await import('../new-game.js');
  const state = createNewCity({mode:'mature',seed:137});
  if (profile==='legacy') {
    const {legacyScenario}=await import('../scenario-profiles.js');
    state.scenario=legacyScenario();
  }
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
    const {loadModel}=await import('../game3d/asset-loading.js');
    const container=await loadModel(B,scene,assetDirectory,item.entry.file,scene,undefined,'.glb');
    container.addAllToScene();
    // Both cobra files include visible Blender rig guides alongside the skin.
    // Keep their transforms for the source animation, but show just the body.
    if (/^supplied-cobra-(?:base|head-up)\.glb$/.test(item.entry.file)) {
      for (const mesh of container.meshes) if (mesh.getTotalVertices()>0&&!mesh.skeleton) mesh.setEnabled(false);
    }
    for (const clip of scene.animationGroups) clip.stop();
    const first=scene.animationGroups[0];
    if (first) {
      first.start(true);
      first.pause();
      first.goToFrame(first.from);
    }
    return;
  }
  if(item.kind==='relief'){
    const {createAnzudRelief}=await import('./anzud-relief.js');
    createAnzudRelief(B,scene);
    return;
  }
  if(item.kind==='bust'){
    const {createHeavenlyBull}=await import('./heavenly-bull.js');
    createHeavenlyBull(B,scene);
    return;
  }
  if(item.kind==='myth-sculpture'){
    const {createMythSculpture}=await import('./ninurta-sculptures.js');
    createMythSculpture(B,scene,item.species);
    return;
  }
  if(item.kind==='vessel'){
    const {createNingishzidaVessel}=await import('./ningishzida-vessel.js');
    createNingishzidaVessel(B,scene);
    return;
  }
  if (item.kind==='crop') {
    const {cropPlantGeometry,createBotanicalMaterial,botanicalMesh}=await import('../game3d/crop-varieties.js');
    const data=cropPlantGeometry(item.key);
    data.normals=[];
    B.VertexData.ComputeNormals(data.positions,data.indices,data.normals);
    botanicalMesh(B,scene,item.key,data,createBotanicalMaterial(B,scene));
    return;
  }
  if (item.kind==='lamp') {
    const {createShellLamp}=await import('../game3d/shell-lamp.js');
    createShellLamp(B,scene).isVisible=true;
    return;
  }
  if (item.kind==='dairy') {
    const [state,{createAmbientFauna},{loadModel}]=await Promise.all([
      stateFor(profile),import('../game3d/ambient-fauna.js'),import('../game3d/asset-loading.js')
    ]);
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
    const [state,{createWildlife}]=await Promise.all([stateFor(profile),import('../game3d/wildlife.js')]);
    const view=createWildlife(B,scene);
    const animal={id:'atlas',kind:item.species,x:6,y:6,heading:0,
      behavior:item.species==='marsh-harrier'?'flying':'looking',waterLevel:0,swimDepth:.12};
    view.update(state,[animal],0);
    if(item.species==='white-pelican'||item.species==='onager'){
      const pelican=item.species==='white-pelican';
      return {
        names:pelican?['Плавание','Добыча рыбы','Взлёт']:['Шаг','Выпас'],
        update(index,time,dt){
          const behavior=pelican?(index===2?'taking-off':'swimming'):
            (index===0?'walking':index===1?'grazing':'looking');
          view.update(state,[{...animal,behavior,flight:pelican&&index===2?Math.min(1,time*.9):0,
            scoop:pelican&&index===1?Math.max(0,Math.sin(time*2))**3:0,
            resetPose:index<0,previewGait:!pelican&&index===0?time*6:undefined}],dt);
        }
      };
    }
    return;
  }
  if (item.kind==='flock') {
    const [state,{createBirdFlocks}]=await Promise.all([stateFor(profile),import('../game3d/bird-flocks.js')]);
    const view=createBirdFlocks(B,scene,{tier:'low',state});
    view.update(state,7);
    for (const root of view.roots().slice(1)) root.setEnabled(false);
    return;
  }
  if (item.kind==='road') {
    const [state,{wornRoadGeometry}]=await Promise.all([stateFor(profile),import('../game3d/water.js')]);
    const road=wornRoadGeometry(state,{x:6,y:6},{x:8,y:6},1.22,.038,item.level);
    const surface=geometry(B,scene,'road',road,plainMaterial(B,scene,'road-finish',['#806443','#a18b63','#afa68b'][item.level-1]));
    surface.position.set(road.origin.x,0,road.origin.z);
    return;
  }
  if (item.type==='canal') {
    const [state,{canalNetworkGeometry}]=await Promise.all([stateFor(profile),import('../game3d/canal-network.js')]);
    const canal={x:6,y:6,wet:true,progress:1,arms:[[-1,0],[1,0]],flowWidth:1};
    const channels=canalNetworkGeometry(state,[canal]);
    const water=new B.StandardMaterial('atlas-water',scene);
    water.diffuseColor=B.Color3.FromHexString('#56938c');
    water.backFaceCulling=false;
    geometry(B,scene,'canal-bed',channels.wetBed,plainMaterial(B,scene,'wet-mud','#4d584a'));
    geometry(B,scene,'canal-water',channels.water,water);
    return;
  }
  const {createDistrictMaterials}=await import('../district3d/materials.js');
  const materials=createDistrictMaterials(B,scene);
  if (item.kind==='goods') {
    const {createGoodsSources}=await import('../game3d/goods.js');
    createGoodsSources(B,scene,materials,[item.key]).sources.get(item.key).setEnabled(true);
    return;
  }
  if (item.kind==='boat') {
    const {createSumerRiverHull}=await import('../game3d/sumer-river-hull.js');
    createSumerRiverHull(B,scene,{bitumen:plainMaterial(B,scene,'bitumen','#352b20'),reed:materials.reed,wood:materials.wood});
    return;
  }
  if (item.kind==='nature') {
    const [state,{createNatureDetails}]=await Promise.all([stateFor(profile),import('../game3d/nature-details.js')]);
    const view=createNatureDetails(B,scene,materials,{tier:'low',loadSnake:null});
    view.update(state,7,{type:'clear'},[],'atlas');
    let found=false;
    for (const mesh of view.meshes) {
      const matches=!found&&mesh.metadata?.natureDetail?.kind===item.species;
      mesh.setEnabled(matches);
      found||=matches;
    }
    return;
  }
  const [state,{createGameBuildings},{extractionKinds},{newFootprint},{riverPoint}]=await Promise.all([
    stateFor(profile),import('../game3d/buildings.js'),import('../extraction-courts.js'),import('../footprints.js'),import('../world.js')
  ]);
  const site=item.type==='bridge'?riverPoint(12,state):item.type==='field'?riverPoint(12,state,3):{x:6,y:6};
  const building={type:item.type,x:Math.round(site.x),y:Math.round(site.y),level:item.level,
    footprint:newFootprint(item.type),...(item.starter?{starterHut:true}:{})};
  if(extractionKinds[item.type])building.deposit={x:building.x,y:building.y};
  if (item.type==='field') building.crop={sown:1,growth:1,seed:1};
  state.buildings.push(building);
  if(item.type==='quarry'||item.type==='clay'){
    const [{mineralSiteView},{mineralExcavations}]=await Promise.all([import('../district3d/mineral-sites.js'),import('../game3d/mineral-excavation.js')]);
    const d={kind:extractionKinds[item.type],...building.deposit};state.world.deposits=[d];
    const pits=mineralExcavations(state);mineralSiteView(B,scene,state,materials,pits,6,()=>0,()=>[.90,.84,.73,1]);
    for(const [dx,dz] of [[1,0],[0,1],[1,1]]){
      if(pits.some(p=>dx===p.extensionX&&dz===p.extensionY))continue;
      const bank=B.MeshBuilder.CreateGround('mineral-loading-bank',{width:6,height:6},scene);
      bank.position.set((building.x+dx)*6,0,(building.y+dz)*6);bank.material=materials.soil;
    }
  }
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
  let motion=null,playing=-1,elapsed=0;
  const render=()=>{
    if(motion&&playing>=0){
      const dt=Math.min(.05,engine.getDeltaTime()/1000);
      elapsed+=dt;
      motion.update(playing,elapsed,dt);
    }
    scene?.render();
  };
  function close() {
    engine.stopRenderLoop(render);
    camera?.detachControl();
    scene?.dispose();
    scene=null;
    camera=null;
    motion=null;
    playing=-1;
  }
  async function open(item,profile) {
    close();
    scene=new B.Scene(engine);
    scene.clearColor=B.Color4.FromHexString('#c2ac87ff');
    scene.imageProcessingConfiguration.toneMappingEnabled=true;
    scene.imageProcessingConfiguration.toneMappingType=B.ImageProcessingConfiguration.TONEMAPPING_ACES;
    camera=new B.ArcRotateCamera('atlas',item.kind==='building'?1.08:.94,item.kind==='glb'?1.26:.86,10,B.Vector3.Zero(),scene);
    if(item.kind==='relief'){camera.alpha=1.48;camera.beta=1.43;}
    if(item.kind==='bust'){camera.alpha=1.12;camera.beta=1.24;}
    if(item.kind==='wildlife'&&item.sources?.length){camera.alpha=.67;camera.beta=1.22;}
    if(item.kind==='myth-sculpture'){camera.alpha=1.16;camera.beta=1.19;}
    if(item.kind==='vessel'){
      camera.alpha=1.47;
      camera.beta=1.15;
      const fill=new B.DirectionalLight('relief fill',new B.Vector3(.4,-.35,-1),scene);
      fill.intensity=.7;
    }
    const sun=new B.DirectionalLight('sun',new B.Vector3(-.65,-1,-.45),scene);
    sun.intensity=2.15;
    const sky=new B.HemisphericLight('sky',B.Axis.Y,scene);
    sky.intensity=1.18;
    try {
      motion=await makeModel(B,scene,item,profile);
      await scene.whenReadyAsync();
      frame(B,scene,camera);
      if(item.species==='white-pelican')camera.radius*=1.12;
      engine.resize();
      render();
      render();
      return motion?.names??scene.animationGroups.map(g=>g.name);
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
    play(index){
      if(motion){
        playing=index;
        elapsed=0;
        if(index<0)motion.update(-1,0,.1);
        return;
      }
      for(const clip of scene?.animationGroups??[])clip.stop();
      scene?.animationGroups[index]?.start(true);
    }
  };
}
