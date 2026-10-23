"""Animal motion adapters. Source credits survive; added Walk clips state provenance.
Python + NumPy/Pillow. No Blender/source code execution. Downloads stay unchanged.
"""
from pathlib import Path
import argparse,copy,hashlib,io,json,math,struct
import numpy as np
from PIL import Image
from prepare_birds_pack import load,read,matrix,bounds,save,OUT
from prepare_city_fauna import GLB,qm,qmul

class Writer:
 def __init__(self,g,b):
  self.g=g;self.chunks=[b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]for v in g['bufferViews']]
 def add(self,values,kind):
  width={'SCALAR':1,'VEC3':3,'VEC4':4}[kind];a=np.asarray(values,dtype='<f4').reshape(-1,width);vi=len(self.chunks);self.chunks.append(a.tobytes());self.g['bufferViews'].append({'buffer':0,'byteLength':a.nbytes});idx=len(self.g['accessors']);self.g['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(a),'type':kind,'min':a.min(0).tolist(),'max':a.max(0).tolist()});return idx
 def save(self,path):
  for im in self.g.get('images',[]):
   vi=im['bufferView'];image=Image.open(io.BytesIO(self.chunks[vi]));image.thumbnail((512,512),Image.Resampling.LANCZOS);o=io.BytesIO();image.save(o,'PNG',optimize=True);self.chunks[vi]=o.getvalue();im['mimeType']='image/png'
  out=bytearray()
  for v,chunk in zip(self.g['bufferViews'],self.chunks):
   out.extend(b'\0'*((-len(out))%4));v['byteOffset']=len(out);v['byteLength']=len(chunk);out.extend(chunk)
  self.g['buffers']=[{'byteLength':len(out)}];out.extend(b'\0'*((-len(out))%4));j=json.dumps(self.g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);raw=struct.pack('<III',0x46546c67,2,28+len(j)+len(out))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(out),0x004e4942)+out;path.write_bytes(raw);return len(raw)

def clip(writer,name,times,tracks,semantic):
 a={'name':name,'channels':[],'samplers':[],'extras':{'provenance':'New Babylon adaptation','semantic':semantic}};ti=writer.add(times,'SCALAR')
 for node,path,values in tracks:
  vi=writer.add(values,'VEC4'if path=='rotation'else 'SCALAR'if path=='weights'else'VEC3');a['channels'].append({'sampler':len(a['samplers']),'target':{'node':node,'path':path}});a['samplers'].append({'input':ti,'output':vi,'interpolation':'LINEAR'})
 return a

def pack(species):
 path=OUT/f'imported-{species}.glb';g,b,sha=load(path)
 # Idempotent: adapt original source extract, not a previous morph derivative.
 if g['asset']['extras'].get('animal_motion'):return
 writer=Writer(g,b);parents={c:i for i,n in enumerate(g['nodes'])for c in n.get('children',[])}
 def world(i):return (world(parents[i])if i in parents else np.eye(4))@matrix(g['nodes'][i])
 ni=next(i for i,n in enumerate(g['nodes'])if 'mesh'in n);m=world(ni)
 # All pack silhouettes face +X; convert baked metre vertices to +Z.
 yaw=qm(np.array([0,-math.sin(math.pi/4),0,math.cos(math.pi/4)]));transform=yaw@m[:3,:3];translation=yaw@m[:3,3];mesh=g['meshes'][0];height={'goose':.62,'fox':.48,'boar':.85,'lioness':.95}[species];stride={'goose':.16,'fox':.23,'boar':.32,'lioness':.42}[species]
 for p in mesh['primitives']:
  points=read(g,b,p['attributes']['POSITION'])@transform.T+translation;p['attributes']['POSITION']=writer.add(points,'VEC3')
  if 'NORMAL'in p['attributes']:
   normals=read(g,b,p['attributes']['NORMAL'])@np.linalg.inv(transform);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-9);p['attributes']['NORMAL']=writer.add(normals,'VEC3')
  y=points[:,1];z=points[:,2];x=points[:,0];p['targets']=[]
  # Smooth lower-limb masks leave torso and neck connected. This is mesh deformation,
  # not a recovered source rig. Each limb has fore/aft and lifted swing morphs.
  low=np.clip((height*.51-y)/(height*.26),0,1);low=low*low*(3-2*low)
  groups=[np.ones(len(x))]if species=='goose'else[np.clip((z/height+.05)*6,0,1),np.clip((-.05-z/height)*6,0,1)]
  for group in groups:
   for side in [-1,1]:
    mask=group*low*np.clip(side*x/height*18,0,1);forward=np.zeros_like(points);forward[:,2]=stride*.25*mask;lift=np.zeros_like(points);lift[:,1]=height*.09*mask;p['targets'].extend([{'POSITION':writer.add(forward,'VEC3')},{'POSITION':writer.add(lift,'VEC3')}])
  nod=np.zeros_like(points);head=np.clip((z/height-.18)*3,0,1)*np.clip((y/height-.5)*4,0,1);nod[:,1]=-height*.035*head;p['targets'].append({'POSITION':writer.add(nod,'VEC3')})
 targetcount=len(mesh['primitives'][0]['targets']);mesh['weights']=[0]*targetcount;g['nodes']=[{'name':f'{species}-procedural-skin','mesh':0,'weights':[0]*targetcount}];g['scenes']=[{'nodes':[0]}];g['scene']=0;duration=1.2;times=np.linspace(0,duration,49);walk=[];idle=[]
 for t in times:
  weights=[]
  for leg in range((targetcount-1)//2):
   phase=(t/duration+([0,.5,.5,0][leg]))%1
   # stance: foot travels backwards at constant velocity; swing: returns and lifts.
   forward=1-4*phase if phase<.5 else -1+4*(phase-.5);lift=0 if phase<.5 else math.sin((phase-.5)*2*math.pi);weights.extend([forward,lift])
  walk.extend([*weights,.35*math.sin(t/duration*2*math.pi)]);idle.extend([0]*(targetcount-1)+[math.sin(t/duration*2*math.pi)])
 g['animations']=[clip(writer,'Walk',times,[(0,'weights',walk)],'Original New Babylon smooth limb morph gait on unrigged source mesh; stance/swing, stride matched by ambient controller'),clip(writer,'Idle',times,[(0,'weights',idle)],'Original New Babylon subtle head motion, feet stationary')]
 g['asset']['extras']['animal_motion']={'kind':'New Babylon morph gait, not source-authored animation','stride_metres':stride,'forward_gltf':'+Z','source_extracted_sha256':sha,'targets':targetcount};size=writer.save(path);return {'species':species,'bytes':size,'stride':stride,'motion':'added morph gait'}

class Animal(GLB):
 def pose(self,t,index=0):
  anim=self.g['animations'][index];pose={}
  for ch in anim['channels']:
   s=anim['samplers'][ch['sampler']];ts=self.read(s['input'])[:,0];vs=self.read(s['output']).reshape(len(ts),-1);j=int(np.clip(np.searchsorted(ts,t)-1,0,max(0,len(ts)-2)));k=min(j+1,len(ts)-1);a=float(np.clip((t-ts[j])/max(1e-9,ts[k]-ts[j]),0,1));v=vs[j]*(1-a)+vs[k]*a
   if ch['target']['path']=='rotation':
    if np.dot(vs[j],vs[k])<0:v=vs[j]*(1-a)-vs[k]*a
    v/=max(np.linalg.norm(v),1e-9)
   pose[ch['target']['node'],ch['target']['path']]=v
  return pose

def downloaded(source,species,height,walkname=None,legs=None,root=0):
 a=Animal(source);g=a.g;original_animations=copy.deepcopy(g['animations']);writer=Writer(g,a.b);idle_index=next((i for i,c in enumerate(g['animations'])if 'idle'in c['name'].lower()),0);base=a.pose(0,idle_index);baseworld=a.world(base);verts=a.vertices(pose=base);lo,hi=verts.min(0),verts.max(0);scale=height/(hi[1]-lo[1]);center=(lo+hi)/2;center[1]=lo[1];wrapper=len(g['nodes']);wrapped={'name':f'{species}-metres-forwardZ','children':g['scenes'][g.get('scene',0)]['nodes'],'scale':[float(scale)]*3,'translation':(-center*scale).tolist()}
 # Sample before adding wrapper: GLB.vertices already uses world skin matrices.
 if legs:
  for chain in legs:
   for node in chain:base.setdefault((node,'rotation'),np.array(g['nodes'][node].get('rotation',[0,0,0,1]),float))
 def resample(name,index,duration,procedural=False,quiet=False):
  times=np.linspace(0,duration,round(duration*30)+1);poses=[];ground=[];reference=a.world(a.pose(0,index))[root][:3,3]
  for t in times:
   pose=a.pose(t,index)if not procedural and not quiet else {k:v.copy()for k,v in base.items()}
   if quiet:
    node={'dog':13,'duck':26,'sheep-kenchoo':32}[species];q=base.get((node,'rotation'),np.array(g['nodes'][node].get('rotation',[0,0,0,1])));angle=.025*math.sin(t/duration*2*math.pi);pose[node,'rotation']=qmul(np.array([math.sin(angle/2),0,0,math.cos(angle/2)]),q)
   if procedural:
    for leg,(hip,knee)in enumerate(legs):
     wave=math.sin(t/duration*math.pi*2+[0,math.pi,math.pi,0][leg]);bend=-.3*max(0,wave)
     for node,angle in [(hip,.36*wave),(knee,bend)]:
      axis=np.linalg.inv(baseworld[a.parents[node]][:3,:3])@np.array([1.,0,0]);axis/=np.linalg.norm(axis);q=base.get((node,'rotation'),np.array(g['nodes'][node].get('rotation',[0,0,0,1])));pose[node,'rotation']=qmul(np.r_[axis*math.sin(angle/2),math.cos(angle/2)],q)
   world=a.world(pose);vs=a.vertices(pose=pose);drift=(world[root][:3,3]-reference)*scale;translation=-center*scale;translation[[0,2]]-=drift[[0,2]];translation[1]=-float(vs[:,1].min())*scale;ground.append(translation);poses.append(pose)
  keys=set().union(*(p.keys()for p in poses));tracks=[]
  for node,path in sorted(keys):
   default=base.get((node,path),g['nodes'][node].get(path,{'rotation':[0,0,0,1],'translation':[0,0,0],'scale':[1,1,1]}.get(path,[0])))
   tracks.append((node,path,[p.get((node,path),default)for p in poses]))
  tracks.append((wrapper,'translation',ground));return clip(writer,name,times,tracks,'New Babylon quiet standing head movement; feet stationary'if quiet else 'New Babylon procedural limb articulation; not supplied source walk'if procedural else f'Source {original_animations[index]["name"]}, grounded with horizontal root motion removed')
 wi=next((i for i,c in enumerate(original_animations)if c['name']==walkname),0);duration=max(float(a.read(s['input'])[-1,0])for s in original_animations[wi]['samplers']);newwalk=resample('Walk',wi,1.2 if legs else duration,bool(legs));idleduration=max(float(a.read(s['input'])[-1,0])for s in original_animations[idle_index]['samplers']);idle=resample('Idle',idle_index,3 if legs else idleduration,quiet=bool(legs))
 g['nodes'].append(wrapped);g['scenes'][g.get('scene',0)]['nodes']=[wrapper]
 for i,anim in enumerate(original_animations):anim['name']='SourceOriginal-'+anim['name']
 g['animations']=[newwalk,idle,*original_animations];g['asset']['extras']['animal_motion']={'forward_gltf':'+Z','source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),'height_metres':height,'walk':'New Babylon procedural adaptation'if legs else f'Source {walkname}','source_clips_preserved':len(original_animations),'textures_max':512};size=writer.save(OUT/f'ambient-{species}.glb');return {'species':species,'bytes':size,'height':height,'source':g['asset']['extras']}

def extract_pack(sources):
 g,b,sha=load(sources/'ultimate_animal_pack_100_animals__50_off.glb')
 for species,mesh_id,height in [('boar',7,.85),('fox',12,.48),('goose',15,.62),('lioness',24,.95)]:
  h=copy.deepcopy(g);h['meshes']=[h['meshes'][mesh_id]];i=next(i for i,n in enumerate(h['nodes'])if n.get('mesh')==mesh_id);parents={c:i for i,n in enumerate(h['nodes'])for c in n.get('children',[])};chain=[]
  while True:
   n=copy.deepcopy(h['nodes'][i]);n.pop('children',None);n.pop('mesh',None);chain.append(n)
   if i not in parents:break
   i=parents[i]
  chain.reverse()
  for i,n in enumerate(chain[:-1]):n['children']=[i+1]
  chain[-1]['mesh']=0;h['nodes']=chain;h['scenes']=[{'nodes':[0]}];h['scene']=0;h.pop('skins',None);h.pop('animations',None);lo,hi=bounds(h,b);scale=height/(hi[1]-lo[1]);center=(lo+hi)/2;center[1]=lo[1];h['nodes'].append({'name':f'{species}-metres','children':[0],'scale':[float(scale)]*3,'translation':(-center*scale).tolist()});h['scenes'][0]['nodes']=[len(h['nodes'])-1];h['asset']['extras'].update(source_sha256=sha,adaptation=f'New Babylon extracted mesh {mesh_id}, metre normalization; motion added separately');save(h,b,OUT/f'imported-{species}.glb')

def run(sources):
 report=[]
 extract_pack(sources)
 for species in ['goose','fox','boar','lioness']:report.append(pack(species))
 for filename,species,height,walk,legs,root in [('dog_animated','dog',.72,None,[(19,20),(25,26),(32,33),(37,38)],8),('duck_animation','duck',.46,None,[(40,41),(54,55)],19),('animated_realistic_donkey__3d_animal_model','donkey',1.25,'Armature|walk',None,10),('bullmotions','bull',1.4,'Walk',None,11),('sheep','sheep-kenchoo',.72,None,[(23,24),(26,27),(12,13),(16,17)],8)]:report.append(downloaded(sources/f'{filename}.glb',species,height,walk,legs,root))
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--sources',type=Path,default=Path.home()/'Downloads');run(p.parse_args().sources)
