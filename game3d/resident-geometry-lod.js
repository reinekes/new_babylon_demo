import {residentLodIndices} from './resident-lod-indices.js';
import {MODEL_VERSIONS} from './model-versions.js';

// Each source geometry owns one reduced index buffer. Actor clones retain their
// own skeleton, material, transform, picking metadata and full vertex attributes.
export function createResidentGeometryLOD(){
 const sources=new WeakMap(),copies=new Set();
 function parts(source,meshes){
  const definitions=residentLodIndices[source.modelName];
  if(!definitions||definitions.hash!==MODEL_VERSIONS[source.modelName+'.glb'])return [];
  if(!sources.has(source)){
   const records=new Map();
   for(const mesh of source.meshes){
    const spec=definitions.meshes[mesh.name];
    if(!spec||!mesh.geometry||mesh.subMeshes.length!==1||mesh.getTotalVertices()!==spec[0]||mesh.getTotalIndices()!==spec[1])continue;
    const bytes=atob(spec[2]),indices=new Uint16Array(bytes.length/2);
    for(let i=0;i<indices.length;i++)indices[i]=bytes.charCodeAt(i*2)|(bytes.charCodeAt(i*2+1)<<8);
    records.set(mesh.geometry,{full:mesh.geometry,indices,low:null});
   }
   sources.set(source,records);
  }
  const records=sources.get(source);
  return meshes.flatMap(mesh=>{const record=records.get(mesh.geometry);return record?[[mesh,record]]:[];});
 }
 function apply(parts,reduced){
  for(const [mesh,record] of parts){
   if(reduced&&(!record.low||record.low.isDisposed())){
    copies.delete(record.low);
    record.low=record.full.copy(record.full.id+'-resident-lod');
    record.low.setIndices(record.indices);
    copies.add(record.low);
   }
   const geometry=reduced?record.low:record.full;
   if(mesh.geometry===geometry)continue;
   // Babylon otherwise keeps the old shorter submesh on the return to full.
   mesh.releaseSubMeshes();
   geometry.applyToMesh(mesh);
  }
 }
 function dispose(){for(const copy of copies)if(!copy.isDisposed())copy.dispose();copies.clear();}
 return {parts,apply,dispose};
}
