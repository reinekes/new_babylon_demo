"""Rebuild distinct child/adolescent surfaces AND rest joints from adapted civilian.
Run after prepare_sumer_people.py, with bundled numpy. No source downloaded/modified.
Positions, joint bind matrices and every translation animation sample are retargeted.
"""
from prepare_sumer_people import ROOT,load,read,DT,W
import copy,json,struct
import numpy as np

def build(maturity,label):
 g,b,_=load(ROOT/'assets/art-courtyard/models/sumer-people.glb')
 chunks=[b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']]
 def put(i,values):
  a=g['accessors'][i];values=np.asarray(values,dtype=DT[a['componentType']]).reshape(-1,W[a['type']]);vi=len(chunks);chunks.append(values.tobytes());g['bufferViews'].append({'buffer':0,'byteLength':values.nbytes});a.update(bufferView=vi,min=values.min(0).tolist(),max=values.max(0).tolist());a.pop('byteOffset',None)
 def warp(p):
  p=np.array(p,copy=True);y=p[...,1].copy()
  # Child is 5.3 heads tall rather than the adult's roughly 7.5: shorter legs,
  # shorter torso, narrow shoulders, fuller head and no adult pectoral contour.
  child_y=np.interp(y,[0,.93,1.43,1.7],[0,.78,1.28,1.7])
  # Extrapolate the head segment: clamping higher hair vertices to 1.7
  # squashed the crown back into the skin and opened a bald patch.
  child_y=np.where(y>1.7,1.7+(y-1.7)*(.42/.27),child_y)
  xscale=np.interp(y,[0,.9,1.35,1.48,1.7],[.88,.78,.77,1.12,1.12])
  zscale=np.interp(y,[0,.9,1.35,1.48,1.7],[.94,.87,.84,1.1,1.1])
  p[...,0]*=xscale+(1-xscale)*maturity;p[...,2]*=zscale+(1-zscale)*maturity;p[...,1]=child_y+(y-child_y)*maturity
  return p
 # The original inverse binds encode the world-space rest skeleton exactly.
 skin=g['skins'][0];ib=read(g,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
 oldworld={j:np.linalg.inv(ib[k]) for k,j in enumerate(skin['joints'])};newworld={j:m.copy() for j,m in oldworld.items()}
 for j,m in newworld.items():m[:3,3]=warp(m[:3,3])
 parents={c:i for i,n in enumerate(g['nodes']) for c in n.get('children',[])};delta={}
 for j,m in newworld.items():
  parent=parents.get(j);pw=newworld.get(parent)
  # Nonjoint container is the original identity authored rig container.
  if pw is None:pw=np.eye(4)
  local=np.linalg.inv(pw)@m;old=np.array(g['nodes'][j].get('translation',[0,0,0]));new=local[:3,3]
  delta[j]=new-old;g['nodes'][j]['translation']=new.tolist()
 put(skin['inverseBindMatrices'],np.array([np.linalg.inv(newworld[j]).T.reshape(-1) for j in skin['joints']]))
 for mesh in g['meshes']:
  for prim in mesh['primitives']:
   a=prim['attributes'];raw=read(g,b,a['POSITION']);p=warp(raw)
   if 'skin' in mesh['name'].lower():
    # Replace the adult pectoral/abdominal protrusions by a smooth child torso.
    chest=(raw[:,1]>.99)&(raw[:,1]<1.43)&(np.abs(raw[:,0])<.19)&(raw[:,2]>.025)
    hull=.108*np.sqrt(np.maximum(.08,1-(raw[:,0]/.205)**2))
    p[chest,2]=p[chest,2]*maturity+hull[chest]*(1-maturity)
   if 'wool' in mesh['name'].lower():
    # Plain cloth has no sculpted adult kaunakes tufts.
    y=raw[:,1];rx=.202+.068*np.clip((.985-y)/.48,0,1);rz=.155+.055*np.clip((.985-y)/.48,0,1)
    angle=np.arctan2(raw[:,0]/rx,raw[:,2]/rz);smooth=raw.copy();smooth[:,0]=rx*np.sin(angle);smooth[:,2]=rz*np.cos(angle)
    p=warp(smooth)*(1-maturity)+p*maturity
   put(a['POSITION'],p)
   # Recompute normals on the actual smaller, narrower child's surface.
   tri=read(g,b,prim['indices']).reshape(-1,3);n=np.zeros_like(p);t=p[tri];face=np.cross(t[:,1]-t[:,0],t[:,2]-t[:,0])
   for k in range(3):np.add.at(n,tri[:,k],face)
   n/=np.maximum(np.linalg.norm(n,axis=1,keepdims=True),1e-9);put(a['NORMAL'],n)
   if 'skin' in mesh['name'].lower():
    # Remove imported adult muscle/paint shading; actual chest is also narrower.
    put(a['COLOR_0'],np.tile([.94,.94,.94,1],(len(p),1)))
 for clip in g['animations']:
  for channel in clip['channels']:
   target=channel['target'];j=target['node']
   if target['path']=='translation' and j in delta:
    ai=clip['samplers'][channel['sampler']]['output'];put(ai,read(g,b,ai)+delta[j])
 # Beard geometry never exists in the child's asset (including hidden polygons).
 for node in g['nodes']:
  if 'beard' in node.get('name','').lower():node.pop('mesh',None);node.pop('skin',None)
 # Child wrap is plain woven wool, without adult votive tufts.
 for mesh in g['meshes']:
  if 'wool' in mesh['name'].lower():mesh['name']='Simple child wool wrap'
 g['asset']['extras']['child_anatomy']={'maturity':maturity,'method':'new surface proportions, rest joint positions, inverse binds and every clip translation; no adult beard or painted chest','height_normalized':1.7,'generator':'prepare_child_people.py'}
 out=bytearray()
 for i,chunk in enumerate(chunks):
  while len(out)%4:out.append(0)
  g['bufferViews'][i]['byteOffset']=len(out);out.extend(chunk)
 while len(out)%4:out.append(0)
 g['buffers']=[{'byteLength':len(out)}];js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
 result=struct.pack('<III',0x46546c67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out
 target=ROOT/f'assets/art-courtyard/models/sumer-{label}.glb';target.write_bytes(result);print(target,len(result))
if __name__=='__main__':
 build(0,'child');build(.65,'adolescent')
