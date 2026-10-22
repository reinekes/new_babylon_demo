"""Extract independent static plants from user-supplied GLBs without editing sources.

Run with NumPy/Pillow: python prepare_valley_plants.py [--downloads PATH].
Bakes source world transforms into metre geometry, preserves attribution/UVs,
keeps complete reed stem+leaf pairs and all four date-palm material layers.
Standard-licensed grass is staged for inspection only; see asset metadata/report.
No New World desert shrubs or unidentified decorative palms enter the valley.
"""
from pathlib import Path
import argparse, copy, hashlib, io, json, struct
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
DT = {5126:'<f4',5125:'<u4',5123:'<u2',5122:'<i2',5121:'u1',5120:'i1'}
WIDTH = {'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
# Mesh-node indices, not mesh indices. A reed has two complementary materials.
SPECS = [
 ('date_palm','valley-date-palm',[4,6,8,10],7.34,'date palm; all four source material layers',True),
 ('dry_grass','valley-dry-grass-1',[5],.65,'generic dry grass clump; species unspecified',True),
 ('dry_grass','valley-dry-grass-2',[7],.55,'generic dry grass clump; species unspecified',True),
 ('dry_grass','valley-dry-grass-3',[11],.72,'generic dry grass clump; species unspecified',True),
 ('reed_plants_pack','valley-reed-1',[4,5],1.8,'generic river reed; stem plus leaves',True),
 ('reed_plants_pack','valley-reed-2',[7,8],1.8,'generic river reed; stem plus leaves',True),
 ('reed_plants_pack','valley-reed-3',[16,17],1.8,'generic river reed; stem plus leaves',True),
 ('wheat','valley-barley',[3],.95,'artistic barley derivative: newly authored slender ears and long awns on source card geometry; not a botanical reconstruction',True),
 ('wheat','valley-wheat',[3],.95,'wheat, not barley; future crop decoration only',False),
 ('grass','valley-river-grass',[4,5],.65,'generic river grass patch; Standard licence inspection only',False),
]

class GLB:
 def __init__(self,path):
  self.raw=Path(path).read_bytes();size=struct.unpack_from('<I',self.raw,12)[0]
  self.g=json.loads(self.raw[20:20+size]);self.binary=self.raw[28+size:]
  self.parents={c:i for i,n in enumerate(self.g['nodes']) for c in n.get('children',[])}
 def read(self,i):
  a=self.g['accessors'][i];v=self.g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);width=WIDTH[a['type']]
  return np.ndarray((a['count'],width),dtype=dt,buffer=self.binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*width),dt.itemsize)).copy()
 def world(self,i):
  n=self.g['nodes'][i]
  if 'matrix' in n:m=np.asarray(n['matrix']).reshape(4,4).T
  else:
   x,y,z,w=n.get('rotation',[0,0,0,1]);m=np.eye(4)
   m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])*n.get('scale',[1,1,1]);m[:3,3]=n.get('translation',[0,0,0])
  return self.world(self.parents[i])@m if i in self.parents else m

def barley_atlas():
 """Original vector-like barley drawing; no source wheat heads are relabelled.
 Babylon displays these cards with ground V=0 and crown V=1; the PNG
 retains upright image rows (heads at top). CPU previews must invert sampled V.
 """
 import random
 rng=random.Random(20261022)
 img=Image.new('RGBA',(1024,1024),(0,0,0,0));draw=ImageDraw.Draw(img)
 for j in range(17):
  x=104+j*49+rng.uniform(-10,10);tip=rng.uniform(150,390);base=963+rng.uniform(-15,15);lean=rng.uniform(-30,30)
  stem=(211+rng.randrange(20),181+rng.randrange(20),112,255)
  draw.line([(x+lean,base),(x,tip+95)],fill=stem,width=3)
  # Long, narrow ear with alternately staggered small grains.
  draw.line([(x,tip+95),(x-5,tip)],fill=(231,201,128,255),width=3)
  for k in range(11):
   sy=tip+15+k*7.3;cx=x-5+5*(k/11);side=-1 if k%2 else 1
   grain=[(cx,sy+6),(cx+side*6,sy-1),(cx+side*8,sy-10),(cx+side*3,sy-7)]
   draw.polygon(grain,fill=(235+rng.randrange(20),204+rng.randrange(20),137,255))
   # Awns exceed the ear length; angled fans remain visible at city zoom.
   start=(cx+side*6,sy-7);end=(cx+side*(15+(11-k)*1.2),sy-92-rng.randrange(20))
   draw.line([start,end],fill=(249,227,170,250),width=2)
  # Sparse lanceolate cereal leaves at the base of the stalk.
  for fraction,side in [(.68,-1),(.83,1)]:
   sy=tip+(base-tip)*fraction;cx=x+lean*fraction
   draw.polygon([(cx,sy),(cx+side*35,sy-60),(cx+side*14,sy-16)],fill=(214,187,115,255))
 return img

def extract(source,target,node_ids,height,semantic,runtime,output_dir=None):
 a=GLB(source);sg=a.g;derivative=target=='valley-barley';world={i:a.world(i) for i in node_ids}
 assert not sg.get('skins') and not sg.get('animations'),'Static sources required'
 positions=[]
 for i in node_ids:
  for p in sg['meshes'][sg['nodes'][i]['mesh']]['primitives']:
   ps=a.read(p['attributes']['POSITION']);positions.append((np.c_[ps,np.ones(len(ps))]@world[i].T)[:,:3])
 points=np.concatenate(positions);lo,hi=points.min(0),points.max(0);scale=height/(hi[1]-lo[1]);center=(lo+hi)/2;center[1]=lo[1]
 g={'asset':copy.deepcopy(sg['asset']),'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':target,'children':[]}],'meshes':[],'materials':[],'textures':[],'images':[],'samplers':copy.deepcopy(sg.get('samplers',[])),'accessors':[],'bufferViews':[],'buffers':[{}]};chunks=[]
 def blob(data,target_type=None):
  idx=len(chunks);chunks.append(data);view={'buffer':0,'byteLength':len(data)}
  if target_type:view['target']=target_type
  g['bufferViews'].append(view);return idx
 def accessor(values,typ,component=5126,target_type=34962):
  values=np.asarray(values,dtype=DT[component]).reshape(-1,WIDTH[typ]);index=len(g['accessors']);entry={'bufferView':blob(values.tobytes(),target_type),'componentType':component,'type':typ,'count':len(values)}
  if typ!='SCALAR':entry.update(min=values.min(0).tolist(),max=values.max(0).tolist())
  g['accessors'].append(entry);return index
 images={};textures={};materials={};image_stats=[]
 def image_index(old):
  if old in images:return images[old]
  entry=sg['images'][old];v=sg['bufferViews'][entry['bufferView']];data=a.binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]
  img=Image.open(io.BytesIO(data));before=img.size
  if derivative:
   img=barley_atlas() if old==0 else Image.new('RGB',(32,32),(128,128,255) if old==2 else (255,230,0))
  img.thumbnail((512,512),Image.Resampling.LANCZOS)
  # Preserve alpha, normal RGB and packed ORM channels without recolouring.
  out=io.BytesIO();img.save(out,format='PNG',optimize=True)
  index=len(g['images']);images[old]=index;g['images'].append({'name':entry.get('name',f'source-image-{old}'),'bufferView':blob(out.getvalue()),'mimeType':'image/png'})
  image_stats.append({'source_index':old,'source_size':list(before),'output_size':list(img.size),'mode':img.mode});return index
 def texture_index(old):
  if old in textures:return textures[old]
  entry=copy.deepcopy(sg['textures'][old]);entry['source']=image_index(entry['source']);index=len(g['textures']);textures[old]=index;g['textures'].append(entry);return index
 def remap_textures(obj):
  if isinstance(obj,dict):
   for k,v in obj.items():
    if k.endswith('Texture') and isinstance(v,dict) and 'index'in v:v['index']=texture_index(v['index'])
    else:remap_textures(v)
  elif isinstance(obj,list):
   for v in obj:remap_textures(v)
 def material_index(old):
  if old in materials:return materials[old]
  mat=copy.deepcopy(sg['materials'][old]);remap_textures(mat);mat.setdefault('pbrMetallicRoughness',{})['metallicFactor']=0
  # Alpha cards need both faces. MASK avoids ordering artefacts among dense plants.
  if mat.get('alphaMode') in ('MASK','BLEND'):
   mat['alphaMode']='MASK';mat.setdefault('alphaCutoff',.35);mat['doubleSided']=True
  index=len(g['materials']);materials[old]=index;g['materials'].append(mat);return index
 triangles=0;out_points=[]
 for i in node_ids:
  mesh=copy.deepcopy(sg['meshes'][sg['nodes'][i]['mesh']]);mesh.pop('weights',None)
  for p in mesh['primitives']:
   assert p.get('mode',4)==4
   attrs={};m=world[i];normal_matrix=np.linalg.inv(m[:3,:3]).T
   for name,ai in p['attributes'].items():
    entry=sg['accessors'][ai];values=a.read(ai)
    if name=='POSITION':values=((np.c_[values,np.ones(len(values))]@m.T)[:,:3]-center)*scale;out_points.append(values)
    elif name=='NORMAL':
     values=values@normal_matrix.T;values/=np.maximum(np.linalg.norm(values,axis=1,keepdims=True),1e-12)
    elif name=='TANGENT':
     values[:,:3]=values[:,:3]@m[:3,:3].T;values[:,:3]/=np.maximum(np.linalg.norm(values[:,:3],axis=1,keepdims=True),1e-12)
    attrs[name]=accessor(values,entry['type'],entry['componentType'])
   indices=a.read(p['indices']);triangles+=len(indices)//3;p['indices']=accessor(indices,'SCALAR',sg['accessors'][p['indices']]['componentType'],34963);p['attributes']=attrs;p['material']=material_index(p['material'])
  mi=len(g['meshes']);g['meshes'].append(mesh);ni=len(g['nodes']);g['nodes'].append({'name':sg['nodes'][i].get('name',str(i)),'mesh':mi});g['nodes'][0]['children'].append(ni)
 ps=np.concatenate(out_points);meta={'source_file':Path(source).name,'source_sha256':hashlib.sha256(a.raw).hexdigest(),'source_node_indices':node_ids,'semantic':semantic,'runtime_approved':runtime,'units':'metres','up':'+Y','geometry_transform_baked':True,'source_to_metres_scale':float(scale),'source_world_center_ground':center.tolist(),'bounds_min':ps.min(0).tolist(),'bounds_max':ps.max(0).tolist(),'triangles':triangles,'texture_limit':512,'images':image_stats,'changes':['selected complete plant material groups','baked source hierarchy; centered XZ and grounded Y','embedded PNG textures capped at 512; original UVs and channels preserved','vegetation metallic factor 0; alpha cards double sided MASK'],'source_asset_extras':copy.deepcopy(sg['asset'].get('extras',{}))}

 if derivative:meta['changes'].append('replaced wheat colour/normal/ORM with original long-awn barley artwork');meta['barley_derivative']={'geometry':'Wheat / ljungman card topology and UVs retained','base_color':'Original New Babylon procedural drawing: slender alternating kernels and awns longer than ear','atlas_orientation':'PNG heads at top; Babylon card ground V=0 and crown V=1; source UVs unchanged','colour':'cream-gold stems, ears and long awns for contrast against brown field soil','normal':'Original flat tangent normal','roughness':'Original high roughness, metallic zero','botanical_status':'artistic barley stand-in; not a botanical reconstruction or unchanged wheat'}
 g['asset'].setdefault('extras',{})['new_babylon_adaptation']=meta
 binary=bytearray()
 for view,data in zip(g['bufferViews'],chunks):
  binary.extend(b'\0'*((-len(binary))%4));view['byteOffset']=len(binary);binary.extend(data)
 binary.extend(b'\0'*((-len(binary))%4));g['buffers'][0]['byteLength']=len(binary);j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4)
 raw=struct.pack('<III',0x46546C67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4E4F534A)+j+struct.pack('<II',len(binary),0x004E4942)+binary
 folder=Path(output_dir) if output_dir else ROOT/'assets/art-courtyard/models';folder.mkdir(parents=True,exist_ok=True);path=folder/(target+'.glb');path.write_bytes(raw)
 return {'file':path.name,'bytes':len(raw),**meta}

if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--downloads',type=Path,default=Path.home()/'Downloads');parser.add_argument('--include-staging',action='store_true',help='write optional wheat/Standard grass to /tmp/new-babylon-plant-staging only');args=parser.parse_args()
 for src,target,nodes,height,semantic,runtime in SPECS:
  if not runtime and not args.include_staging:continue
  r=extract(args.downloads/(src+'.glb'),target,nodes,height,semantic,runtime,None if runtime else '/tmp/new-babylon-plant-staging');print(json.dumps({k:r[k]for k in ['file','bytes','triangles','bounds_min','bounds_max','runtime_approved']},ensure_ascii=False))
