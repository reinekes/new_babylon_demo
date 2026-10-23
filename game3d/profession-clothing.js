import {professionRole} from '../professions.js';
// Dyed wool/linen wraps are a readable artistic vocabulary, not a claim that
// Sumerian professions wore standardized uniforms. Save identities stay intact.
const CLOTH={
 farmer:['#8a7850','short'],lumberjack:['#73533c','sash'],clayworker:['#947154','apron'],reedcutter:['#7a8656','sash'],quarrier:['#8b8374','short'],
 potter:['#a56537','apron'],brewer:['#936d32','apron'],weaver:['#537f79','wrap'],shepherd:['#9d906d','sash'],fisher:['#5d7b78','short'],hunter:['#7b6748','sash'],
 brickmaker:['#987549','apron'],kilnworker:['#81543c','apron'],gardener:['#6e8251','wrap'],priest:['#bda45e','wrap'],
 production:['#948259','wrap'],builder:['#9c7d4c','short'],carrier:['#8e7651','sash'],watercarrier:['#5b8080','sash'],healer:['#7a8868','apron'],tailor:['#ac833f','wrap']
};
export function professionClothing(c){
 if(c.age<16||!c.calling||c.calling==='auto'||c.phase==='mourning')return null;
 // A newly proposed calling appears only after the resident has adopted its role.
 if(c.pendingRole||c.role!==professionRole(c.calling))return null;
 const spec=CLOTH[c.calling];return spec?{id:c.calling,color:spec[0],shape:spec[1]}:null;
}
// Derive a real fitted shell from the authored torso surface. It keeps the exact
// skin weights and inverse bind pose, bends with work, and leaves arms uncovered.
// No rigid rectangles, floating patches or cylinders over moving upper arms.
export function createProfessionClothing(B,scene,model,spec,material){
 const source=model.getChildMeshes().find(m=>m.skeleton&&/civilian skin|adapted skin/i.test(m.name));if(!source)return [];
 const positions=source.getVerticesData(B.VertexBuffer.PositionKind),normals=source.getVerticesData(B.VertexBuffer.NormalKind),joints=source.getVerticesData(B.VertexBuffer.MatricesIndicesKind),weights=source.getVerticesData(B.VertexBuffer.MatricesWeightsKind),sourceIndices=source.getIndices();if(!positions||!joints||!weights)return [];
 const p=[],n=[],uv=[],ji=[],we=[],indices=[],mapping=new Map(),isTorso=i=>{let torso=0;for(let k=0;k<4;k++){const bone=source.skeleton.bones[Math.round(joints[i*4+k])];if(bone&&!/arm|hand|finger|clavicle|neck|head/i.test(bone.name))torso+=weights[i*4+k];}return torso>.78;};
 const include=i=>{const x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2],side=Math.min(1,Math.abs(x)/.16),top=spec.shape==='sash'?1.405+(x<0?.055:-.015):1.445-side*.095;
  return y>1.005&&y<top&&Math.abs(x)<.215&&z<.125&&isTorso(i);};
 const add=i=>{if(mapping.has(i))return mapping.get(i);const index=p.length/3,x=positions[i*3],y=positions[i*3+1],z=positions[i*3+2];
  // A loose cloth shell clears the torso while sharing all of its deformation.
  p.push(x*1.075,y+.002,(z+.025)*1.08-.025);n.push(normals?.[i*3]||0,normals?.[i*3+1]||0,normals?.[i*3+2]||1);uv.push(x*3+.5,y*3);for(let k=0;k<4;k++){ji.push(joints[i*4+k]);we.push(weights[i*4+k]);}mapping.set(i,index);return index;};
 for(let i=0;i<sourceIndices.length;i+=3){const face=sourceIndices.slice(i,i+3);if(face.every(include))indices.push(...face.map(add));}
 if(!indices.length)return [];
 const mesh=new B.Mesh(`profession-upper-wrap-${spec.id}`,scene),data=new B.VertexData();Object.assign(data,{positions:p,normals:n,uvs:uv,indices,matricesIndices:ji,matricesWeights:we});data.applyToMesh(mesh);mesh.parent=source.parent;mesh.position.copyFrom(source.position);mesh.scaling.copyFrom(source.scaling);mesh.rotationQuaternion=source.rotationQuaternion?.clone()||null;mesh.rotation.copyFrom(source.rotation);mesh.skeleton=source.skeleton;mesh.material=material;material.backFaceCulling=false;mesh.receiveShadows=true;mesh.isPickable=true;mesh.metadata={profession:spec.id,clothShape:spec.shape,skinnedUpperCloth:true};return [mesh];
}
