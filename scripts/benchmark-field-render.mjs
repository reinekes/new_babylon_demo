import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import path from 'node:path';

// Usage: node scripts/benchmark-field-render.mjs [result.json]
// CPU diagnostic only: it never renders a frame and cannot establish GPU cost or FPS.
// Matches tests/fixtures/scene-performance.js: 200 citizens, 129 buildings, 62 fields.
// Static GLB accessors/transforms are real; texture image decoding uses 1x1 stand-ins.
const repo=fileURLToPath(new URL('..',import.meta.url));
if(process.argv.length>3||process.argv[2]?.startsWith('-'))throw Error('Usage: node scripts/benchmark-field-render.mjs [result.json]');
const outputPath=process.argv[2]&&path.resolve(process.argv[2]);
const trackedSources=['game3d/buildings.js','district3d/buildings.js','game3d/field-shore.js','game3d/field-crops.js','game3d/shore-profile.js','world.js','engine.js','workforce.js','calendar.js','tests/fixtures/scene-performance.js'];
const fingerprints=()=>Object.fromEntries(trackedSources.map(name=>[name,createHash('sha256').update(readFileSync(path.join(repo,name))).digest('hex')]));
const sourceInfo={commit:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),workingTreeChanges:execFileSync('git',['status','--porcelain','--',...trackedSources],{cwd:repo,encoding:'utf8'}).trim().split('\n').filter(Boolean),sha256:fingerprints()};
const temporary=mkdtempSync(path.join(tmpdir(),'babylon-field-cpu-'));
const instrumentedPath=path.join(temporary,'buildings.mjs');
const previousAudit=globalThis.__fieldAudit;
let engine,scene,layer;
try{
const from=async name=>import(pathToFileURL(path.join(repo,name)).href);
const {createGame,advanceTime,terrain,encode,decode}=await from('engine.js');
const {syncCitizens,invalidateAssignments}=await from('workforce.js');
const {housingOf,buildingKey}=await from('definitions.js');
const {simulationSeconds}=await from('calendar.js');
const {foundationContext}=await from('game3d/building-foundations.js');
const {districtCropVisual}=await from('district3d/buildings.js');

const sourcePath=path.join(repo,'game3d/buildings.js'),original=readFileSync(sourcePath,'utf8');
const audit=globalThis.__fieldAudit={frame:-1,events:[]};
function replaceOnce(text,from,to){if(text.split(from).length!==2)throw Error('Instrumentation anchor not unique: '+from);return text.replace(from,to);}
let source=original.replace(/from ['"]([^'"]+)['"]/g,(_all,p)=>`from '${pathToFileURL(path.resolve(path.dirname(sourcePath),p)).href}'`);
source=replaceOnce(source,'{clippedFieldGeometry,','{clippedFieldGeometry as originalClippedFieldGeometry,');
source=replaceOnce(source,'{createDistrictBuilding, districtCropVisual}','{createDistrictBuilding as originalCreateDistrictBuilding, districtCropVisual}');
source=replaceOnce(source,'let t=templates.get(key);if(t){t.users++;return t;}','let t=templates.get(key);if(t){t.users++;return t;} const auditStart=performance.now();');
source=replaceOnce(source,'t={root,sources,users:1};templates.set(key,t);return t;',`t={root,sources,users:1};templates.set(key,t);globalThis.__fieldAudit.events.push({kind:'acquire',frame:globalThis.__fieldAudit.frame,id:buildingKey(b),type:b.type,x:b.x,y:b.y,ms:performance.now()-auditStart,vertices:sources.reduce((n,m)=>n+m.getTotalVertices(),0),meshes:sources.length});return t;`);
source+=`
function clippedFieldGeometry(data,b,state){const t=performance.now();const result=originalClippedFieldGeometry(data,b,state);globalThis.__fieldAudit.events.push({kind:'clip',frame:globalThis.__fieldAudit.frame,id:buildingKey(b),type:b.type,x:b.x,y:b.y,ms:performance.now()-t,inputVertices:data.positions.length/3,outputVertices:result.positions.length/3,sameData:result===data});return result;}
function createDistrictBuilding(B,scene,b,materials){const t=performance.now();const result=originalCreateDistrictBuilding(B,scene,b,materials);globalThis.__fieldAudit.events.push({kind:'procedural',frame:globalThis.__fieldAudit.frame,id:buildingKey(b),type:b.type,x:b.x,y:b.y,ms:performance.now()-t,meshes:result.meshes.map(m=>({name:m.name,vertices:m.getTotalVertices(),indices:m.getTotalIndices()}))});return result;}
`;
writeFileSync(instrumentedPath,source);
const {createGameBuildings,gameBuildingSignature}=await import(pathToFileURL(instrumentedPath).href);

const sandbox={console,setTimeout,clearTimeout,performance,self:{}};
vm.runInNewContext(readFileSync(path.join(repo,'assets/vendor/babylon-9.31.0.js'),'utf8'),sandbox);
const B=sandbox.BABYLON;B.Logger.LogLevels=0;engine=new B.NullEngine();scene=new B.Scene(engine);
const materials=Object.fromEntries(['plaster','brick','wood','linen','reed','terracotta','soil','grass','stone'].map(n=>[n,new B.PBRMaterial(n,scene)]));
const loads=[];
// Existing field-crops.test.js transport: actual local GLB accessors/transforms,
// 1x1 texture stand-ins; no browser, HTTP transport, render call or GPU timing.
function loadGeometry(assetPath){
 const bytes=readFileSync(path.join(repo,assetPath)),size=bytes.readUInt32LE(12),g=JSON.parse(bytes.subarray(20,20+size)),binary=bytes.subarray(28+size),container=new B.AssetContainer(scene),root=new B.TransformNode('gltf-reflection',scene);root.scaling.z=-1;container.transformNodes.push(root);
 const mats=g.materials.map(info=>{const m=new B.PBRMaterial(info.name,scene);if(info.pbrMetallicRoughness?.baseColorTexture){m.albedoTexture=B.RawTexture.CreateRGBATexture(new Uint8Array([210,180,100,255]),1,1,scene);container.textures.push(m.albedoTexture);}return m;});container.materials.push(...mats);
 function data(index){const a=g.accessors[index],v=g.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],out=[];for(let k=0;k<a.count;k++)for(let j=0;j<n;j++){const p=(v.byteOffset||0)+(a.byteOffset||0)+k*(v.byteStride||n*bytes)+j*bytes;out.push(a.componentType===5126?binary.readFloatLE(p):a.componentType===5125?binary.readUInt32LE(p):a.componentType===5123?binary.readUInt16LE(p):binary.readUInt8(p));}return out;}
 for(const node of g.nodes)if(node.mesh!==undefined)for(const p of g.meshes[node.mesh].primitives){const mesh=new B.Mesh(node.name,scene),v=new B.VertexData();v.positions=data(p.attributes.POSITION);v.normals=data(p.attributes.NORMAL);if(p.attributes.TEXCOORD_0!==undefined)v.uvs=data(p.attributes.TEXCOORD_0);v.indices=data(p.indices);v.applyToMesh(mesh);mesh.position.set(...(node.translation||[0,0,0]));mesh.scaling.set(...(node.scale||[1,1,1]));if(node.rotation)mesh.rotationQuaternion=B.Quaternion.FromArray(node.rotation);mesh.parent=root;mesh.material=mats[p.material];container.meshes.push(mesh);}
 container.removeAllFromScene();return container;
}
B.SceneLoader.LoadAssetContainerAsync=async(root,asset)=>{const relative=root+asset.split('?')[0];loads.push(relative);return loadGeometry(relative);};
const initial=createGame({start:'established'});
for(let y=2;y<22;y+=2)for(let x=2;x<30;x+=2)if(terrain(x,y,initial)!=='water'&&!initial.buildings.some(b=>b.x===x&&b.y===y))initial.buildings.push({type:(x+y)%4?'house':'field',x,y,level:1});
initial.population=200;initial.capacity=housingOf(initial);syncCitizens(initial);invalidateAssignments(initial);syncCitizens(initial);
const state=decode(encode(initial));
if(!state)throw Error('Fixture decode failed');
const shape={residents:state.citizens.length,buildings:state.buildings.length,fields:state.buildings.filter(b=>b.type==='field').length,construction:state.buildings.filter(b=>b.construction).length,startSim:state.simTime,startSeasonElapsed:state.seasonElapsed};
if(shape.residents!==200||shape.buildings!==129||shape.fields!==62)throw Error('Fixture shape changed; refresh the benchmark baseline.');
layer=await createGameBuildings(B,scene,materials);layer.sync(state);await layer.sacredReady();layer.sync(state);
const initialEvents=audit.events.splice(0),transitions=[],frames=[],counts={};
const signatureFields=['workCorner','type','footprint','level','constructionKind','constructionTarget','constructionProgress','crop','position','lakes','houseVariant','foundation'];
function signatures(){const context=foundationContext(state);return new Map(state.buildings.map(b=>[buildingKey(b),{signature:gameBuildingSignature(b,state,context),type:b.type,x:b.x,y:b.y,crop:b.type==='field'?{...b.crop,visual:districtCropVisual(b)}:undefined}]));}
let previous=signatures();
for(let frame=0;frame<900;frame++){
 audit.frame=frame;const simStart=performance.now();if(!state.event)advanceTime(state,simulationSeconds(1/60,4));const simMs=performance.now()-simStart;
 const next=signatures(),changed=[];
 for(const [id,n]of next){const old=previous.get(id);if(old?.signature===n.signature)continue;const a=old?.signature.split('|')||[],b=n.signature.split('|'),fields=b.flatMap((v,i)=>v===a[i]?[]:[signatureFields[i]||i]);const change={frame,simTime:state.simTime,id,type:n.type,x:n.x,y:n.y,fields,before:old?.crop,after:n.crop};changed.push(change);transitions.push(change);for(const field of fields)counts[`${n.type}.${field}`]=(counts[`${n.type}.${field}`]||0)+1;}
 const eventStart=audit.events.length,t=performance.now();layer.sync(state);const syncMs=performance.now()-t;
 frames.push({frame,simTime:state.simTime,syncMs,simMs,changed:changed.map(v=>v.id),eventStart,eventEnd:audit.events.length});previous=next;
}
const round=n=>Math.round(n*1000)/1000;
function stats(list){if(!list.length)return null;const a=[...list].sort((a,b)=>a-b);return {n:a.length,totalMs:round(a.reduce((a,b)=>a+b,0)),meanMs:round(a.reduce((a,b)=>a+b,0)/a.length),medianMs:round(a[Math.floor(a.length*.5)]),p95Ms:round(a[Math.min(a.length-1,Math.floor(a.length*.95))]),maxMs:round(a.at(-1))};}
const phases={};for(const kind of ['acquire','clip','procedural'])phases[kind]=stats(audit.events.filter(e=>e.kind===kind).map(e=>e.ms));
const profileFrames=frames.filter(f=>f.frame>=180),byField={};
for(const e of audit.events.filter(e=>e.kind==='acquire')){const key=`${e.type}:${e.x},${e.y}`,row=byField[key]??={n:0,totalMs:0,maxMs:0};row.n++;row.totalMs+=e.ms;row.maxMs=Math.max(row.maxMs,e.ms);}
const before=JSON.stringify(state);layer.sync(state);const readOnly=JSON.stringify(state)===before;
const sceneCounts={meshes:scene.meshes.length,visibleBuildingParts:layer.meshes.length,retainedFieldBeds:scene.meshes.filter(mesh=>mesh.metadata?.fieldBedCache).length};
const report={method:'Node NullEngine CPU only; dt=1/60 real, speed4,calendarRate.25;900steps;first180warmup;actual static GLB geometry,1x1textures;no scene.render',shape,end:{simTime:state.simTime,seasonElapsed:state.seasonElapsed,residents:state.citizens.length,event:state.event?.id||null},loads,readOnly,source:sourceInfo,sourceUnmodifiedDuringBenchmark:JSON.stringify(fingerprints())===JSON.stringify(sourceInfo.sha256),signatureChangeCounts:counts,signatureTransitionCount:transitions.length,changedFrameCount:frames.filter(f=>f.changed.length).length,syncAll:stats(frames.map(f=>f.syncMs)),syncMeasured:stats(profileFrames.map(f=>f.syncMs)),syncMeasuredUnchanged:stats(profileFrames.filter(f=>!f.changed.length).map(f=>f.syncMs)),syncMeasuredChanged:stats(profileFrames.filter(f=>f.changed.length).map(f=>f.syncMs)),simulation:stats(frames.map(f=>f.simMs)),phases,initialPhases:Object.fromEntries(['acquire','clip','procedural'].map(kind=>[kind,stats(initialEvents.filter(e=>e.kind===kind).map(e=>e.ms))])),slowFrames:[...frames].sort((a,b)=>b.syncMs-a.syncMs).slice(0,15).map(f=>({...f,events:audit.events.slice(f.eventStart,f.eventEnd)})),byField:Object.fromEntries(Object.entries(byField).sort((a,b)=>b[1].totalMs-a[1].totalMs)),transitions,events:audit.events,initialEvents};
report.scene=sceneCounts;
if(outputPath)writeFileSync(outputPath,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,events:undefined,initialEvents:undefined,transitions:transitions.slice(0,12),slowFrames:report.slowFrames.slice(0,5),byField:Object.fromEntries(Object.entries(report.byField).slice(0,8))},null,2));
}finally{
 layer?.dispose();scene?.dispose();engine?.dispose();
 if(previousAudit===undefined)delete globalThis.__fieldAudit;else globalThis.__fieldAudit=previousAudit;
 rmSync(temporary,{recursive:true,force:true});
}
