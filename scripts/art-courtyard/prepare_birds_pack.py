"""Extract supplied animals without executing source code. Python 3 + numpy/Pillow.
python prepare_birds_pack.py --sources ~/Downloads
Static pack animals remain stationary; no invented source rig or walking claims.
Source author/license/source metadata is retained in every derived GLB.
"""
from pathlib import Path
import argparse, copy, hashlib, io, json, struct
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/art-courtyard/models'
DT={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2',5120:'i1'}
WIDTH={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);return g,raw[28+n:],hashlib.sha256(raw).hexdigest()
def read(g,b,index):
 a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);w=WIDTH[a['type']]
 return np.ndarray((a['count'],w),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*w),dt.itemsize)).copy()
def matrix(n):
 if 'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m

def bounds(g,b):
 parents={c:i for i,n in enumerate(g['nodes'])for c in n.get('children',[])};cache={}
 def world(i):
  if i not in cache:cache[i]=(world(parents[i])if i in parents else np.eye(4))@matrix(g['nodes'][i])
  return cache[i]
 points=[]
 for i,n in enumerate(g['nodes']):
  if 'mesh'not in n:continue
  for p in g['meshes'][n['mesh']]['primitives']:
   a=p['attributes'];v=read(g,b,a['POSITION']);v=np.c_[v,np.ones(len(v))]
   if 'skin'in n:
    s=g['skins'][n['skin']];ibm=read(g,b,s['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);mat=np.array([world(j)for j in s['joints']])@ibm;j=read(g,b,a['JOINTS_0']).astype(int);weights=read(g,b,a['WEIGHTS_0']);transformed=np.zeros_like(v)
    for c in range(4):transformed+=np.einsum('nij,nj->ni',mat[j[:,c]],v)*weights[:,c,None]
   else:transformed=v@world(i).T
   points.append(transformed[:,:3])
 p=np.concatenate(points);return p.min(axis=0),p.max(axis=0)

def save(g,b,path):
 """Compact only referenced data, preserving all original sampler values."""
 chunks=[];views=[];accessors=[];maps={k:{}for k in ['accessor','view','material','texture','image','sampler']};materials=[];textures=[];images=[];samplers=[]
 def view(old):
  if old in maps['view']:return maps['view'][old]
  v=copy.deepcopy(g['bufferViews'][old]);start=v.get('byteOffset',0);data=b[start:start+v['byteLength']];new=len(views);maps['view'][old]=new;v.pop('byteOffset',None);v['buffer']=0;views.append(v);chunks.append(data);return new
 def accessor(old):
  if old in maps['accessor']:return maps['accessor'][old]
  a=copy.deepcopy(g['accessors'][old]);data=read(g,b,old).tobytes();a['bufferView']=len(views);a.pop('byteOffset',None);views.append({'buffer':0,'byteLength':len(data)});chunks.append(data);new=len(accessors);maps['accessor'][old]=new;accessors.append(a);return new
 def texture(old):
  if old in maps['texture']:return maps['texture'][old]
  t=copy.deepcopy(g['textures'][old]);src=t['source']
  if src not in maps['image']:
   im=copy.deepcopy(g['images'][src]);vi=view(im['bufferView']);im['bufferView']=vi
   image=Image.open(io.BytesIO(chunks[vi]));image.thumbnail((512,512),Image.Resampling.LANCZOS);out=io.BytesIO();image.save(out,'PNG',optimize=True);chunks[vi]=out.getvalue();views[vi]['byteLength']=len(chunks[vi]);im['mimeType']='image/png';maps['image'][src]=len(images);images.append(im)
  t['source']=maps['image'][src]
  if 'sampler'in t:
   oldsam=t['sampler']
   if oldsam not in maps['sampler']:maps['sampler'][oldsam]=len(samplers);samplers.append(g['samplers'][oldsam])
   t['sampler']=maps['sampler'][oldsam]
  new=len(textures);maps['texture'][old]=new;textures.append(t);return new
 def material(old):
  if old in maps['material']:return maps['material'][old]
  m=copy.deepcopy(g['materials'][old])
  def scan(o):
   if isinstance(o,dict):
    for k,v in o.items():
     if k.endswith('Texture')and isinstance(v,dict)and 'index'in v:v['index']=texture(v['index'])
     else:scan(v)
   elif isinstance(o,list):
    for v in o:scan(v)
  scan(m);new=len(materials);maps['material'][old]=new;materials.append(m);return new
 for mesh in g['meshes']:
  for p in mesh['primitives']:
   p['attributes']={k:accessor(v)for k,v in p['attributes'].items()}
   if 'indices'in p:p['indices']=accessor(p['indices'])
   if 'material'in p:p['material']=material(p['material'])
 for s in g.get('skins',[]):s['inverseBindMatrices']=accessor(s['inverseBindMatrices'])
 for a in g.get('animations',[]):
  for s in a['samplers']:s['input']=accessor(s['input']);s['output']=accessor(s['output'])
 binary=bytearray()
 for v,data in zip(views,chunks):
  binary.extend(b'\0'*((-len(binary))%4));v['byteOffset']=len(binary);binary.extend(data)
 g.update(bufferViews=views,accessors=accessors,materials=materials,textures=textures,images=images,samplers=samplers,buffers=[{'byteLength':len(binary)}]);j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);binary.extend(b'\0'*((-len(binary))%4));raw=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary;path.write_bytes(raw);return len(raw)
def run(source,restricted_preview=False):
 report=[]
 for filename,label,height in [('birds','sky-birds',None),('bird_orange','orange-bird',.38)]:
  g,b,sha=load(source/(filename+'.glb'));lo,hi=bounds(g,b);scale=(6/max(hi[0]-lo[0],hi[2]-lo[2]))if height is None else height/(hi[1]-lo[1]);center=(lo+hi)/2;center[1]=lo[1];idx=len(g['nodes']);g['nodes'].append({'name':'NewBabylonMetres','children':g['scenes'][g.get('scene',0)]['nodes'],'scale':[float(scale)]*3,'translation':(-center*scale).tolist()});g['scenes'][g.get('scene',0)]['nodes']=[idx];g['asset']['extras']['adaptation']='New Babylon: metres normalization, textures <=512px; source clips unchanged';g['asset']['extras']['source_sha256']=sha
  target=(OUT/f'imported-{label}.glb') if label!='sky-birds' or restricted_preview else Path('/tmp/new-babylon-imported-sky-birds.glb')
  size=save(g,b,target);report.append({'asset':label,'bytes':size,'bounds_metres':((hi-lo)*scale).tolist(),'source_sha256':sha,'source_clips':[a.get('name')for a in g.get('animations',[])]})
 g,b,sha=load(source/'ultimate_animal_pack_100_animals__50_off.glb');inventory=[m.get('name','')for m in g['meshes']]
 for name,mesh_id,height in [('boar',7,.85),('fox',12,.48),('goose',15,.62),('lioness',24,.95)]:
  h=copy.deepcopy(g);h['meshes']=[h['meshes'][mesh_id]];original=next(i for i,n in enumerate(h['nodes'])if n.get('mesh')==mesh_id);parents={c:i for i,n in enumerate(h['nodes'])for c in n.get('children',[])};chain=[];i=original
  while True:
   node=copy.deepcopy(h['nodes'][i]);node.pop('children',None);node.pop('mesh',None);chain.append(node)
   if i not in parents:break
   i=parents[i]
  chain.reverse()
  for i,n in enumerate(chain[:-1]):n['children']=[i+1]
  chain[-1]['mesh']=0;h['nodes']=chain;h['scenes']=[{'nodes':[0]}];h['scene']=0;h.pop('skins',None);h.pop('animations',None);lo,hi=bounds(h,b);scale=height/(hi[1]-lo[1]);center=(lo+hi)/2;center[1]=lo[1];h['nodes'].append({'name':f'{name}-metres','children':[0],'scale':[float(scale)]*3,'translation':(-center*scale).tolist()});h['scenes'][0]['nodes']=[len(h['nodes'])-1];h['asset']['extras'].update(source_sha256=sha,adaptation=f'New Babylon extracted {inventory[mesh_id]}; normalized height {height}m; textures <=512px; stationary unrigged visual')
  size=save(h,b,OUT/f'imported-{name}.glb');report.append({'asset':name,'bytes':size,'source_mesh':inventory[mesh_id],'bounds_metres':((hi-lo)*scale).tolist(),'source_sha256':sha,'source_clips':[]})
 print(json.dumps({'source_pack_meshes':inventory,'outputs':report},ensure_ascii=False,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,default=Path.home()/'Downloads');p.add_argument('--restricted-preview',action='store_true',help='Local only: emit Standard-licensed sky bird derivative into models directory; exclude from public Git');a=p.parse_args();run(a.sources,a.restricted_preview)
