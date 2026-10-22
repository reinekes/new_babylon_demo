"""Normalize downloaded cats/gazelle with intact source credits, topology and rigs.
Uses NumPy/Pillow. Source files default to ~/Downloads; never overwritten.
Gazelle Walk is an explicit procedural addition; cat rigs are unrelated.
"""
import json,struct,numpy as np
from PIL import Image,ImageDraw
from pathlib import Path
DT={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1',5122:'<i2'};W={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def qm(q):
 x,y,z,w=q/np.linalg.norm(q);return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
class GLB:
 def __init__(self,p):
  b=Path(p).read_bytes();n=struct.unpack_from('<I',b,12)[0];self.g=json.loads(b[20:20+n]);self.b=b[28+n:];self.parents={c:i for i,n in enumerate(self.g['nodes']) for c in n.get('children',[])}
 def read(self,i):
  a=self.g['accessors'][i];v=self.g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);w=W[a['type']];return np.ndarray((a['count'],w),dtype=dt,buffer=self.b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*w),dt.itemsize)).copy()
 def pose(self,t):
  pose={}
  for ch in self.g['animations'][0]['channels']:
   s=self.g['animations'][0]['samplers'][ch['sampler']];ts=self.read(s['input'])[:,0];vs=self.read(s['output']).reshape(len(ts),-1);j=np.clip(np.searchsorted(ts,t)-1,0,len(ts)-2);a=np.clip((t-ts[j])/max(1e-9,ts[j+1]-ts[j]),0,1);v=vs[j]*(1-a)+vs[j+1]*a
   if ch['target']['path']=='rotation':
    if np.dot(vs[j],vs[j+1])<0:v=vs[j]*(1-a)-vs[j+1]*a
    v=v/np.linalg.norm(v)
   pose[ch['target']['node'],ch['target']['path']]=v
  return pose
 def world(self,pose):
  cache={}
  def at(i):
   if i in cache:return cache[i]
   n=self.g['nodes'][i]
   if 'matrix'in n:m=np.array(n['matrix']).reshape(4,4).T
   else:
    m=np.eye(4);m[:3,:3]=qm(pose.get((i,'rotation'),np.array(n.get('rotation',[0,0,0,1]))))*pose.get((i,'scale'),n.get('scale',[1,1,1]));m[:3,3]=pose.get((i,'translation'),n.get('translation',[0,0,0]))
   cache[i]=at(self.parents[i])@m if i in self.parents else m;return cache[i]
  for i in range(len(self.g['nodes'])):at(i)
  return cache
 def vertices(self,t=None,pose=None):
  pose=self.pose(t) if pose is None else pose;world=self.world(pose);all=[]
  for n in self.g['nodes']:
   if 'mesh'not in n:continue
   skin=self.g['skins'][n['skin']];mats=np.asarray([world[i]for i in skin['joints']])@self.read(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
   for p in self.g['meshes'][n['mesh']]['primitives']:
    a=p['attributes'];ps=self.read(a['POSITION']);weights=pose.get((self.g['nodes'].index(n),'weights'),self.g['meshes'][n['mesh']].get('weights',[]))
    for target,weight in zip(p.get('targets',[]),weights):
     if 'POSITION'in target:ps+=self.read(target['POSITION'])*weight
    js=self.read(a['JOINTS_0']).astype(int);ws=self.read(a['WEIGHTS_0']);ps=np.c_[ps,np.ones(len(ps))];pts=np.zeros((len(ps),3))
    for c in range(4):pts+=np.einsum('nij,nj->ni',mats[js[:,c],:3,:],ps)*ws[:,c,None]
    all.append(pts)
  return np.concatenate(all)

def qmul(a,b):
 av,bv=np.asarray(a[:3]),np.asarray(b[:3]);return np.r_[a[3]*bv+b[3]*av+np.cross(av,bv),a[3]*b[3]-np.dot(av,bv)]

def prepare(source,target,kind):
 import copy,hashlib,io,math
 a=GLB(source);g=a.g;binary=a.b;chunks=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]for v in g['bufferViews']]
 images=[]
 for im in g.get('images',[]):
  vi=im['bufferView'];img=Image.open(io.BytesIO(chunks[vi]));before=img.size;img.thumbnail((1024,1024),Image.Resampling.LANCZOS)
  image_index=len(images)
  if kind in ('walk','sit') and ((kind=='sit' and image_index!=1) or (kind=='walk' and image_index==0)):
   # UV-preserving deterministic colour treatment; eye atlases retain their hue.
   rgba=np.array(img.convert('RGBA'));rgb=rgba[:,:,:3].astype(float);luma=rgb@np.array([.2126,.7152,.0722]);coat=(40+36*luma/255)[:,:,None]*np.array([1.,.98,.95]);coat=np.clip(coat,0,255).astype('uint8')
   if kind=='sit' and image_index==0:
    h,w=luma.shape;coat[int(h*.74):,int(w*.70):]=rgb[int(h*.74):,int(w*.70):].astype('uint8')
   rgba[:,:,:3]=coat;img=Image.fromarray(rgba)
  out=io.BytesIO();img.save(out,format='PNG',optimize=True);chunks[vi]=out.getvalue();im['mimeType']='image/png';images.append({'source':before,'output':img.size})
 def append(v,typ):
  v=np.asarray(v,dtype='<f4').reshape(-1,W[typ]);vi=len(chunks);chunks.append(v.tobytes());g['bufferViews'].append({'buffer':0,'byteLength':v.nbytes});ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(v),'type':typ,'min':v.min(0).tolist(),'max':v.max(0).tolist()});return ai
 if kind in ('walk','sit'):
  for material in g['materials']:
   pbr=material.setdefault('pbrMetallicRoughness',{});pbr['metallicFactor']=0;pbr['roughnessFactor']=.9
   if 'eye'not in material.get('name','').lower():pbr['baseColorFactor']=[1,1,1,1]
 source_anim=copy.deepcopy(g['animations'][0]);source_anim['name']='SourceOriginal';source_anim['extras']={'semantic':{'walk':'Original in-place cat walking cycle','sit':'Original seated grooming/paw raising; not a sit-down transition','gazelle':'Original stationary look-around; not walking'}[kind]}
 scale={'walk':.0086,'sit':.026,'gazelle':.25}[kind];yaw=-math.pi/2 if kind=='sit'else 0;rot=qm(np.array([0,math.sin(yaw/2),0,math.cos(yaw/2)]));basepose=a.pose(0);baseworld=a.world(basepose);baseverts=a.vertices(pose=basepose)@rot.T*scale;lo=baseverts.min(0);hi=baseverts.max(0);center=(lo+hi)/2;center[1]=0
 wrapper=len(g['nodes']);g['nodes'].append({'name':'NewBabylonMetresForwardZ','children':g['scenes'][g.get('scene',0)]['nodes'],'scale':[scale]*3,'rotation':[0,math.sin(yaw/2),0,math.cos(yaw/2)],'translation':[-float(center[0]),-float(lo[1]),-float(center[2])],'extras':{'forward_gltf':'+Z','metres_per_source_unit':scale}});g['scenes'][g.get('scene',0)]['nodes']=[wrapper]
 # Evaluation uses original hierarchy: the new wrapper is applied explicitly below.
 a.parents={c:i for i,n in enumerate(g['nodes'][:wrapper])for c in n.get('children',[])}
 rootmotion={'walk':18,'sit':17,'gazelle':10}[kind];base_root=baseworld[rootmotion][:3,3]
 def newclip(name,duration,pose_at,semantic):
  times=np.linspace(0,duration,round(duration*30)+1);frames=[];translations=[]
  for t in times:
   pose=pose_at(t);world=a.world(pose);verts=a.vertices(pose=pose)@rot.T*scale;drift=(world[rootmotion][:3,3]-base_root)@rot.T*scale
   translation=-center.copy();translation[[0,2]]-=drift[[0,2]];translation[1]=-verts[:,1].min();translations.append(translation);frames.append(pose)
  keys=set(basepose).union(*(f.keys()for f in frames));ai=append(times,'SCALAR');anim={'name':name,'samplers':[],'channels':[],'extras':{'semantic':semantic,'provenance':'New Babylon resampling/grounding; original mesh, textures and skin preserved'}}
  for node,path in sorted(keys):
   vals=[f.get((node,path),basepose.get((node,path),g['nodes'][node].get(path,{'translation':[0,0,0],'scale':[1,1,1],'rotation':[0,0,0,1],'weights':g['meshes'][g['nodes'][node].get('mesh',0)].get('weights',[])}[path])))for f in frames]
   oi=append(vals,'VEC4'if path=='rotation'else'SCALAR'if path=='weights'else'VEC3');si=len(anim['samplers']);anim['samplers'].append({'input':ai,'output':oi,'interpolation':'LINEAR'});anim['channels'].append({'sampler':si,'target':{'node':node,'path':path}})
  oi=append(translations,'VEC3');anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':wrapper,'path':'translation'}});anim['samplers'].append({'input':ai,'output':oi,'interpolation':'LINEAR'});return anim
 if kind=='walk':
  duration=max(float(a.read(s['input'])[-1,0])for s in source_anim['samplers']);clips=[newclip('Walk',duration,a.pose,'Source-authored walk, grounded and horizontal root displacement removed'),newclip('Idle',1,lambda t:basepose,'Frozen first walking pose for stationary fallback')]
 elif kind=='sit':
  clips=[newclip('Sit',2,lambda t:a.pose(.20*(1-math.cos(math.pi*t))),'Quiet seated source segment 0–0.4 seconds, ping-pong; no retargeting'),newclip('Groom',6,a.pose,'Full source seated grooming, grounded')]
 else:
  # Source uses detached foot controls: move them with the lower-leg endpoints
  # to retain the authored ankle/hoof connection instead of stretching weights.
  feet=[9,36,35,37];hips=[12,18,15,21];knees=[13,19,16,22]
  for foot in feet:
   basepose[foot,'translation']=np.array(g['nodes'][foot]['translation'],float)
   basepose[foot,'rotation']=np.array(g['nodes'][foot]['rotation'],float)
  axes={i:baseworld[a.parents[i]][:3,:3].T@np.array([1.,0,0])for i in hips+knees}
  def walk(t):
   frame={k:v.copy()for k,v in basepose.items()};p=t/1.1*2*math.pi
   for hip,knee,offset in zip(hips,knees,[0,math.pi,math.pi,0]):
    wave=math.sin(p+offset)
    for i,angle in [(hip,.38*wave),(knee,-.30*max(0,wave))]:
     axis=axes[i]/np.linalg.norm(axes[i]);q=basepose.get((i,'rotation'),np.array(g['nodes'][i].get('rotation',[0,0,0,1])));frame[i,'rotation']=qmul(np.r_[axis*math.sin(angle/2),math.cos(angle/2)],q)
   world=a.world(frame)
   for foot,knee in zip(feet,knees):
    desired=world[knee]@np.linalg.inv(baseworld[knee])@baseworld[foot]
    local=np.linalg.inv(world[a.parents[foot]])@desired
    frame[foot,'translation']=local[:3,3]
    # All custom leg flexion is about world X; use the same total ankle flex.
    offset=[0,math.pi,math.pi,0][feet.index(foot)];wave=math.sin(p+offset);angle=.38*wave-.30*max(0,wave)
    axis=baseworld[a.parents[foot]][:3,:3].T@np.array([1.,0,0]);axis/=np.linalg.norm(axis)
    frame[foot,'rotation']=qmul(np.r_[axis*math.sin(angle/2),math.cos(angle/2)],basepose[foot,'rotation'])
   return frame
  clips=[newclip('Idle',12.04,a.pose,'Source stationary look-around, grounded; not a walking clip'),newclip('Walk',1.1,walk,'New Babylon procedural in-place diagonal gait; not supplied by source author'),newclip('Rest',1,lambda t:basepose,'Standing still, not a lying pose')]
 g['animations']=[*clips,source_anim]
 report={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'source_bytes':Path(source).stat().st_size,'author':g['asset']['extras']['author'],'license':g['asset']['extras']['license'],'source':g['asset']['extras']['source'],'forward_gltf':'+Z','scale':scale,'base_bounds_metres':{'min':(lo-center-np.array([0,lo[1],0])).tolist(),'max':(hi-center-np.array([0,lo[1],0])).tolist()},'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes']for p in m['primitives']),'vertices':sum(g['accessors'][p['attributes']['POSITION']]['count']for m in g['meshes']for p in m['primitives']),'bones':len(g['skins'][0]['joints']),'images':images,'clips':{c['name']:c['extras']['semantic']for c in g['animations']},'coat_profile':{'name':'charcoal','treatment':'UV-preserving luminance compressed to RGB 40–76; walking and sitting eye textures plus sitting eye atlas region retain source colours; identical material roughness .9 and zero metallic'}if kind in ('walk','sit')else None,'limitations':'Cats are different authors, silhouettes and rigs, with a matched charcoal coat adaptation. Crossfade is visual replacement, not a shared skeleton. Gazelle walk is a procedural adaptation.'}
 g['asset']['extras']['new_babylon_adaptation']=report;out=bytearray()
 for view,chunk in zip(g['bufferViews'],chunks):
  out.extend(b'\0'*((-len(out))%4));view['byteOffset']=len(out);view['byteLength']=len(chunk);out.extend(chunk)
 g['buffers']=[{'byteLength':len(out)}];out.extend(b'\0'*((-len(out))%4));js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);glb=struct.pack('<III',0x46546c67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out;Path(target).write_bytes(glb);report['output_bytes']=len(glb);print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser(description='Preserve credits and skins; resample grounded, metre-scale fauna. Requires numpy and Pillow.');parser.add_argument('--source-directory',type=Path,default=Path.home()/'Downloads');args=parser.parse_args();dest=Path(__file__).resolve().parents[2]/'assets/art-courtyard/models'
 for source,out,kind in [('cat_walk.glb','cat-walk.glb','walk'),('an_animated_cat.glb','cat-sitting.glb','sit'),('gazella.glb','gazelle-downloaded.glb','gazelle')]:prepare(args.source_directory/source,dest/out,kind)
