"""Adapt the supplied Trident.AI static Slave surface to the existing CC0 resident rig.
Requires bundled numpy/Pillow. Never modifies the downloaded source. No external code.
Usage: python prepare_sumer_people.py [--source /path/egyptian_people.glb]
"""
from pathlib import Path
import argparse,copy,hashlib,io,json,math,struct
import numpy as np
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
DT={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}
W={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def load(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:],raw

def read(g,b,i):
 a=g['accessors'][i];v=g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);w=W[a['type']]
 return np.ndarray((a['count'],w),dtype=dt,buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',w*dt.itemsize),dt.itemsize)).copy()

def prepare(source):
 s,sb,raw=load(source);g,rb,_=load(ROOT/'assets/art-courtyard/models/resident.glb')
 chunks=[rb[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']]
 def add(a,kind,component=5126):
  a=np.asarray(a,dtype=DT[component]).reshape(-1,W[kind]);vi=len(chunks);chunks.append(a.tobytes());g['bufferViews'].append({'buffer':0,'byteLength':a.nbytes});ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':component,'count':len(a),'type':kind,'min':a.min(0).tolist(),'max':a.max(0).tolist()});return ai
 base=g['meshes'][5]['primitives'][0]['attributes'];oldpos=read(g,rb,base['POSITION']);oldj=read(g,rb,base['JOINTS_0']).astype(int);oldw=read(g,rb,base['WEIGHTS_0']);unique=np.unique(np.round(oldpos,5),axis=0,return_index=True)[1];oldpos,oldj,oldw=oldpos[unique],oldj[unique],oldw[unique]
 def weights(pos):
  # Four neighbouring original skin vertices, then four strongest joints.
  js=[];ws=[]
  for offset in range(0,len(pos),128):
   p=pos[offset:offset+128];dist=((p[:,None]-oldpos[None])**2).sum(2);near=np.argpartition(dist,3,axis=1)[:,:4];d=np.take_along_axis(dist,near,axis=1);f=1/np.maximum(d,1e-8);f/=f.sum(1,keepdims=True);total=np.zeros((len(p),53))
   for row in range(len(p)):
    np.add.at(total[row],oldj[near[row]].ravel(),(oldw[near[row]]*f[row,:,None]).ravel())
   j=np.argsort(total,axis=1)[:,-4:][:,::-1];w=np.take_along_axis(total,j,axis=1);w/=w.sum(1,keepdims=True);js.append(j);ws.append(w)
  return np.concatenate(js),np.concatenate(ws)
 p=s['meshes'][1]['primitives'][0];a=p['attributes'];pos=read(s,sb,a['POSITION']).astype(float);uv=read(s,sb,a['TEXCOORD_0']);tri=read(s,sb,p['indices']).reshape(-1,3)
 # Normalize the supplied two-metre static civilian; author's scene offsets discarded.
 pos*=1.7/(pos[:,1].max()-pos[:,1].min());pos[:,1]-=pos[:,1].min()
 # Bring broad source arms into the resident rig's A-pose and forward wrists.
 arm=np.clip((np.abs(pos[:,0])-.20)/.38,0,1);pos[:,0]*=1-.16*arm;pos[:,2]+=.19*arm
 # Slightly open lower legs to the current resident rig stance.
 leg=np.clip((.61-pos[:,1])/.5,0,1);pos[:,0]*=1+.18*leg
 # Remove the Egyptian kilt/belt surface; the new wrap encloses this opening.
 centre=pos[tri].mean(1);keep=~((centre[:,1]>.57)&(centre[:,1]<.98)&(np.abs(centre[:,0])<.29));tri=tri[keep]
 im=s['images'][1];v=s['bufferViews'][im['bufferView']];tex=np.asarray(Image.open(io.BytesIO(sb[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']])).convert('RGB'))/255
 rgb=tex[(uv[:,1]*tex.shape[0]).astype(int)%tex.shape[0],(uv[:,0]*tex.shape[1]).astype(int)%tex.shape[1]]
 shade=np.clip(rgb@np.array([.3,.5,.2])/.48,.05,1.15)
 # Egyptian multicolour collar, cuffs, ankle bands and pale cap lose their motifs.
 collar=(pos[:,1]>1.17)&(pos[:,1]<1.46)&(np.abs(pos[:,0])<.25)
 cuffs=(np.abs(pos[:,0])>.39)&(pos[:,1]<1.20);ankle=(pos[:,1]>.13)&(pos[:,1]<.24);cap=pos[:,1]>1.65
 shade[collar|cuffs|ankle|cap]=.90
 # Imported paint is not anatomy: remove the painted head wrap/black bands.
 shade[pos[:,1]>1.47]=np.clip(shade[pos[:,1]>1.47],.80,1.05)
 colors=np.c_[np.repeat(shade[:,None],3,axis=1),np.ones(len(pos))]
 def normal(vertices,indices):
  n=np.zeros_like(vertices);t=vertices[indices];face=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0]);
  for k in range(3):np.add.at(n,indices[:,k],face)
  n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-9);return n
 def mesh(name,vertices,indices,material,colors=None):
  used,remap=np.unique(indices,return_inverse=True);vertices=vertices[used];indices=remap.reshape(-1,3);colors=colors[used] if colors is not None else None
  js,ws=weights(vertices);attrs={'POSITION':add(vertices,'VEC3'),'NORMAL':add(normal(vertices,indices),'VEC3'),'JOINTS_0':add(js,'VEC4',5123),'WEIGHTS_0':add(ws,'VEC4')}
  if colors is not None:attrs['COLOR_0']=add(colors,'VEC4')
  return {'name':name,'primitives':[{'attributes':attrs,'indices':add(indices,'SCALAR',5125),'material':material}]}
 # Keep the compatible scalp/beard and rig; discard old body, eyes and garments.
 centre=pos[tri].mean(1)
 hairtri=tri[(centre[:,1]>1.625)|((centre[:,1]>1.56)&(centre[:,2]<-.005))]
 beardtri=tri[(centre[:,1]>1.465)&(centre[:,1]<1.535)&(centre[:,2]>.067)&(np.abs(centre[:,0])<.070)]
 # A normal offset separates every scalp triangle from the skin in every view;
 # a Z-only shift left side-facing facets coplanar and caused black stripes.
 surface_normal=normal(pos,tri)
 hairpos=pos+surface_normal*.004
 beardpos=pos+surface_normal*.004
 # Continuous cap with a natural high forehead and lower nape. It contains
 # no copied/painted face triangles and has a single non-intersecting surface.
 centre_head=np.array([-.0008,1.595,.006]);radii=np.array([.083,.114,.103])
 q=(pos-centre_head)/radii;rho=np.linalg.norm(q,axis=1);theta=np.arccos(np.clip(q[:,1]/np.maximum(rho,1e-9),-1,1));azimuth=np.arctan2(q[:,0],q[:,2]);limit=1.72-.34*np.cos(azimuth)
 scalp=(pos[:,1]>1.50)&(theta<limit-.025)
 # Fit to the ACTUAL skull surface, including its broad rear crown. The old
 # guessed ellipse left 38 crown vertices outside and exposed a bald circle.
 radii*=max(1.,float(rho[scalp].max()))+.035
 capv=[(centre_head+np.array([0,radii[1],0])).tolist()];capt=[];nr=18;ns=64
 for row in range(1,nr+1):
  for col in range(ns):
   angle=2*math.pi*col/ns;limit=1.72-.34*math.cos(angle);theta=limit*row/nr
   capv.append((centre_head+radii*np.array([math.sin(theta)*math.sin(angle),math.cos(theta),math.sin(theta)*math.cos(angle)])).tolist())
 # A shared pole closes the crown. Winding and normals point outwards.
 for col in range(ns):capt.append([0,1+col,1+(col+1)%ns])
 for row in range(nr-1):
  for col in range(ns):
   a0=1+row*ns+col;b0=1+row*ns+(col+1)%ns;c0=a0+ns;d0=b0+ns;capt.extend([[a0,c0,b0],[b0,c0,d0]])
 hair=mesh('Fitted short scalp hair',np.array(capv),np.array(capt),2)
 hp=hair['primitives'][0]['attributes'];hp['JOINTS_0']=add(np.tile([44,0,0,0],(g['accessors'][hp['POSITION']]['count'],1)),'VEC4',5123);hp['WEIGHTS_0']=add(np.tile([1,0,0,0],(g['accessors'][hp['POSITION']]['count'],1)),'VEC4')
 beard=mesh('Close cropped curved beard',beardpos,beardtri,2)
 skin=mesh('Trident civilian adapted skin',pos,tri,0,colors)
 # One continuous wrap surface, with shallow overlapping wool tufts rather than Egyptian motifs.
 vertices=[];indices=[];rings=25;segments=64
 for row in range(rings):
  t=row/(rings-1);y=.985-.48*t;rx=.202+.068*t;rz=.155+.055*t
  for col in range(segments):
   angle=2*math.pi*col/segments;pleat=.006*math.cos(24*angle)+.009*(.5+.5*math.cos(16*angle+math.pi*(row//4)))*math.sin(math.pi*(row%4)/4)
   vertices.append([(rx+pleat)*math.sin(angle),y+(.012*math.cos(16*angle) if row==rings-1 else 0),(rz+pleat)*math.cos(angle)])
 for row in range(rings-1):
  for col in range(segments):
   a0=row*segments+col;b0=row*segments+(col+1)%segments;c0=a0+segments;d0=b0+segments;indices.extend([[a0,c0,b0],[b0,c0,d0]])
 cloth=mesh('Undyed tufted wool wrap',np.array(vertices),np.array(indices),1)
 g['meshes']=[skin,cloth,hair,beard];g['materials']=[{'name':'Warm tan skin','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[.43,.245,.125,1],'metallicFactor':0,'roughnessFactor':.9}},{'name':'Undyed wool cloth','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[.65,.56,.39,1],'metallicFactor':0,'roughnessFactor':.94}},{'name':'Dark brown hair','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[.045,.021,.009,1],'metallicFactor':0,'roughnessFactor':.9}}]
 for node in g['nodes']:
  node.pop('mesh',None);node.pop('skin',None)
 for ni,mi,name in [(53,0,'Sumerian civilian skin'),(54,1,'Undyed wool wrap'),(56,2,'Fitted short scalp hair'),(57,3,'Close cropped curved beard')]:g['nodes'][ni].update(mesh=mi,skin=0,name=name)
 g['nodes'][60]['children']=[53,54,56,57,52]
 provenance={'original':s['asset']['extras'],'source_sha256':hashlib.sha256(raw).hexdigest(),'selected_source_mesh':'Slave_Material.002_0','adaptation':'New Babylon, 2026-10-22: civilian surface only; scene offsets discarded; Egyptian collar/cuff/cap colours removed; original kilt replaced by authored undyed tufted wool wrap; adapted to existing 53-joint rig with nearest-surface weights','rig_and_motion':'Existing resident.glb CC0 Innerscene/MakeHuman-derived rig, Walk_Loop and Idle_Loop sampler data unchanged','scalp_fit':{'centre':centre_head.tolist(),'radii':radii.tolist(),'method':'actual skull radial envelope plus clearance, closed shared pole, head-weighted'},'limitations':'Fitted closed head-weighted scalp; head paint removed. Approximate automated skin transfer; not artist-retopologized. Wool wrap is a game approximation, not evidence all workers wore votive attire. Source SKETCHFAB Standard is not CC0; source entitlement comes from supplied download.'}
 g['asset']={'version':'2.0','generator':'New Babylon prepare_sumer_people.py','extras':provenance};g.pop('images',None);g.pop('textures',None);g.pop('samplers',None)
 out=bytearray()
 for vi,chunk in enumerate(chunks):
  while len(out)%4:out.append(0)
  g['bufferViews'][vi]['byteOffset']=len(out);g['bufferViews'][vi]['byteLength']=len(chunk);out.extend(chunk)
 while len(out)%4:out.append(0)
 g['buffers']=[{'byteLength':len(out)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);result=struct.pack('<III',0x46546c67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out
 target=ROOT/'assets/art-courtyard/models/sumer-people.glb';target.write_bytes(result)
 print(json.dumps({'output':str(target),'bytes':len(result),'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']),'joints':53,'clips':[a['name'] for a in g['animations']],'provenance':provenance},indent=2))
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--source',type=Path,default=Path('/Users/back/Downloads/egyptian_people.glb'));prepare(parser.parse_args().source)
