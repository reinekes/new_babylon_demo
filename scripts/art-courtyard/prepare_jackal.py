"""Noncommercial artistic golden-jackal adaptation of OLEKSO's Wolf (CC BY-NC 4.0).
Run with Python, numpy and Pillow; optional first argument selects untouched source GLB.
Keeps topology, UVs, weights, inverse binds and original source animation. No Blender required.
"""
from pathlib import Path
import copy, hashlib, io, json, struct, sys
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
SOURCE=Path(sys.argv[1]) if len(sys.argv)>1 else Path('/Users/back/Downloads/wolf.glb')
TARGET=ROOT/'assets/art-courtyard/models/jackal.glb'

def prepare():
 raw=SOURCE.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:]
 chunks=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']]
 def read(i):
  a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];d=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']]);w={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
  return np.ndarray((a['count'],w),dtype=d,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',d.itemsize*w),d.itemsize)).copy()
 def append(v,kind):
  a=np.asarray(v,dtype='<f4');g['bufferViews'].append({'buffer':0,'byteLength':a.nbytes});chunks.append(a.tobytes());g['accessors'].append({'bufferView':len(chunks)-1,'componentType':5126,'count':len(a),'type':kind,'min':a.min(0).tolist(),'max':a.max(0).tolist()});return len(g['accessors'])-1
 def qm(q):
  x,y,z,w=q/np.linalg.norm(q);return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 nodes=g['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};cache={}
 def world(i):
  if i in cache:return cache[i]
  n=nodes[i];m=np.array(n['matrix']).reshape(4,4).T if 'matrix'in n else np.eye(4)
  if 'matrix'not in n:m[:3,:3]=qm(np.array(n.get('rotation',[0,0,0,1])))*n.get('scale',[1,1,1]);m[:3,3]=n.get('translation',[0,0,0])
  cache[i]=world(parents[i])@m if i in parents else m;return cache[i]
 p=g['meshes'][0]['primitives'][0];pos=read(p['attributes']['POSITION']);j=read(p['attributes']['JOINTS_0']).astype(int);weights=read(p['attributes']['WEIGHTS_0']);skin=g['skins'][0];ib=read(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);mat=np.asarray([world(i) for i in skin['joints']])@ib;h=np.c_[pos,np.ones(len(pos))];out=sum(np.einsum('nij,nj->ni',mat[j[:,c]],h)*weights[:,c,None] for c in range(4));lo=out[:,:3].min(0);hi=out[:,:3].max(0)
 # Mouth seam is inside closed-jaw muzzle, ahead of the jaw-tip joint, never at the neck.
 muzzle=np.array([0.,.704,1.006,1.]);head=38;mouth_local=(np.linalg.inv(world(head))@muzzle)[:3]
 nodes.append({'name':'JackalMouthContact','translation':mouth_local.tolist(),'extras':{'purpose':'White shroud contact at teeth; follows source head skeleton'}});nodes[head].setdefault('children',[]).append(len(nodes)-1)
 source=copy.deepcopy(g['animations'][0]);source['name']='SourceTake001';source['extras']={'provenance':'OLEKSO original Take 001, all sampler values retained'}
 walk=copy.deepcopy(source);walk['name']='Walk';walk['extras']={'provenance':'New Babylon in-place adaptation of OLEKSO Take 001; horizontal pelvis and detached jaw drift removed'}
 for ch in walk['channels']:
  if ch['target']['path']=='translation' and ch['target']['node'] in (8,49):
   sampler=walk['samplers'][ch['sampler']];v=read(sampler['output']);v[:,0]=v[0,0];v[:,2]=v[0,2];sampler['output']=append(v,'VEC3')
 # Static first pose avoids the original walking cycle masquerading as idle.
 idle={'name':'Idle','samplers':[],'channels':[],'extras':{'provenance':'New Babylon held first pose of source take'}};time=append([[0.],[1.]],'SCALAR')
 for ch in walk['channels']:
  old=walk['samplers'][ch['sampler']];index=old['output'];a=g['accessors'][index]
  if index>=len(json.loads(raw[20:20+size])['accessors']):v=np.frombuffer(chunks[a['bufferView']],dtype='<f4').reshape(a['count'],-1)[0]
  else:v=read(index)[0]
  si=len(idle['samplers']);idle['samplers'].append({'input':time,'output':append([v,v],a['type']),'interpolation':'LINEAR'});idle['channels'].append({'sampler':si,'target':copy.deepcopy(ch['target'])})
 # Lower the neck for a teeth grip while keeping the original leg cycle. The jaw
 # is a separate source branch: move it with the neck rather than leaving it behind.
 pull=copy.deepcopy(walk);pull['name']='Pull';pull['extras']={'provenance':'New Babylon neck-lowered grip; source gait reversed by renderer for backing away'}
 angle=.65;qx=np.array([np.sin(angle/2),0.,0.,np.cos(angle/2)]);rot=qm(qx);pivot=world(35)[:3,3];axis=np.linalg.inv(world(parents[35])[:3,:3])@np.array([1.,0,0]);axis/=np.linalg.norm(axis)
 def mul(a,b):return np.r_[a[3]*b[:3]+b[3]*a[:3]+np.cross(a[:3],b[:3]),a[3]*b[3]-np.dot(a[:3],b[:3])]
 for ch in pull['channels']:
  ni=ch['target']['node'];path=ch['target']['path'];sampler=pull['samplers'][ch['sampler']];ai=sampler['output'];a=g['accessors'][ai]
  v=np.frombuffer(chunks[a['bufferView']],dtype='<f4').reshape(a['count'],-1).copy() if ai>=len(json.loads(raw[20:20+size])['accessors']) else read(ai)
  if ni==35 and path=='rotation':v=np.array([mul(np.r_[axis*np.sin(angle/2),np.cos(angle/2)],q) for q in v])
  elif ni==49 and path=='rotation':v=np.array([mul(qx,q) for q in v])
  elif ni==49 and path=='translation':v=(v-pivot)@rot.T+pivot
  else:continue
  sampler['output']=append(v,a['type'])
 g['animations']=[idle,walk,pull,source]
 scale=np.array([.65*.78,.65,.65]);origin=np.array([0.,-lo[1]*scale[1],-.16]);idx=len(nodes);nodes.append({'name':'GoldenJackalMetres','children':g['scenes'][g.get('scene',0)]['nodes'],'scale':scale.tolist(),'translation':origin.tolist(),'extras':{'forward_gltf':'+Z','artistic_species':'golden jackal; slimmed wolf source, not zoological reconstruction'}});g['scenes'][g.get('scene',0)]['nodes']=[idx]
 # Recolour only base-colour pixels; normal/roughness maps stay physically meaningful.
 color_textures={m.get('pbrMetallicRoughness',{}).get('baseColorTexture',{}).get('index') for m in g.get('materials',[])}
 for ti in color_textures-{None}:
  im=g['images'][g['textures'][ti]['source']];vi=im['bufferView'];image=Image.open(io.BytesIO(chunks[vi])).convert('RGBA');image.thumbnail((1024,1024),Image.Resampling.LANCZOS);pixels=np.array(image).astype(float);rgb=pixels[:,:,:3]/255;luma=rgb@np.array([.2126,.7152,.0722]);earth=np.stack([luma*1.10+.035,luma*.94+.020,luma*.73+.012],-1);pixels[:,:,:3]=np.clip(.35*rgb+.65*earth,0,1)*255;image=Image.fromarray(pixels.astype('uint8'),'RGBA');f=io.BytesIO();image.save(f,format='PNG',optimize=True);chunks[vi]=f.getvalue();im['mimeType']='image/png'
 report={'source_sha256':hashlib.sha256(raw).hexdigest(),'source':g['asset']['extras']['source'],'author':g['asset']['extras']['author'],'license':g['asset']['extras']['license'],'usage':'Noncommercial prototype only; adaptation retains CC BY-NC 4.0','triangles':g['accessors'][p['indices']]['count']//3,'joints':len(skin['joints']),'source_clip_seconds':float(max(read(s['input'])[-1,0] for s in source['samplers'])),'source_bounds_metres':{'min':lo.tolist(),'max':hi.tolist()},'adapted_bounds_size_metres':((hi-lo)*scale).tolist(),'muzzle_metres':(muzzle[:3]*scale+origin).tolist(),'muzzle_head_local':mouth_local.tolist(),'forward_gltf':'+Z','walk_stride_metres':.61,'original_channels':len(source['channels']),'rootmotion_removed_nodes':[8,49],'adaptation':'slimmer body; natural muted gold/earth coat; in-place gait; source skin and geometry retained'}
 g['asset']['extras']['new_babylon_adaptation']=report
 output=bytearray()
 for v,c in zip(g['bufferViews'],chunks):output.extend(b'\0'*((-len(output))%4));v['byteOffset']=len(output);v['byteLength']=len(c);output.extend(c)
 g['buffers']=[{'byteLength':len(output)}];output.extend(b'\0'*((-len(output))%4));js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data=struct.pack('<III',0x46546c67,2,28+len(js)+len(output))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(output),0x004e4942)+output;TARGET.write_bytes(data);print(json.dumps(report,indent=2))
if __name__=='__main__':prepare()
