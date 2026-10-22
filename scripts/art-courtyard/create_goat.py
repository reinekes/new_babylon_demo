"""Original New Babylon goat: implicit sculpt, continuous skin, authored rig/clips.
Run with Python + numpy + Pillow. No external assets or network are used.
Model coordinates: metres, Y up, +Z forward. Rebuild is deterministic.
Use --step .025 --output assets/art-courtyard/models/goat-authored-lod.glb
for a lighter city mesh; the default recreates the original studio asset.
"""
from pathlib import Path
import numpy as np, math, json, struct, io, argparse
from PIL import Image
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--step',type=float,default=.015,help='Implicit sculpt grid spacing in metres (default: .015).')
parser.add_argument('--output',type=Path,default=ROOT/'assets/art-courtyard/models/goat-authored.glb',help='Destination GLB; defaults to the original studio model.')
args=parser.parse_args()
if not math.isfinite(args.step) or args.step<=0:parser.error('--step must be finite and positive')
OUT=args.output
bones=[]
def bone(name,p,parent=0):
 i=len(bones);bones.append(dict(name=name,p=np.array(p,dtype=float),parent=parent));return i
body=bone('Body',(0,0,0),None)
neck=bone('Neck',(0,.67,.27));head=bone('Head',(0,1.045,.47),neck)
legs=[]
for side in [-1,1]:
 for front in [True,False]:
  x=side*.13;a=(x,.76,.30 if front else -.36);b=(x,.43,.28) if front else (x,.48,-.22);c=(x,.105,.34) if front else (x,.225,-.46);foot=(x,.06,.365 if front else -.405)
  thigh=bone(f'{"Front" if front else "Hind"}_{side}_upper',a)
  shin=bone(f'{"Front" if front else "Hind"}_{side}_lower',b,thigh)
  ankle=bone(f'{"Front" if front else "Hind"}_{side}_ankle',c,shin)
  legs.append(dict(side=side,front=front,a=np.array(a),b=np.array(b),c=np.array(c),foot=np.array(foot),ids=[thigh,shin,ankle]))
tail=bone('Tail',(0,.89,-.46))
earids=[bone(f'Ear_{s}',(s*.075,1.145,.50),head) for s in [-1,1]]
# Analytic ellipsoid distance; adjoining lobes use a smooth union, producing
# shared vertices through the chest, neck, shoulders, thighs and fetlocks.
primitives=[]
def ell(c,r,b=0,k=.025):primitives.append((np.array(c),np.array(r),b,k))
def limb(a,b,r0,r1,bone_id,k=.025):
 primitives.append((np.array(a),np.array(b),r0,r1,bone_id,k))
ell((0,.755,-.055),(.181,.205,.445),0,.065)
ell((0,.80,-.335),(.164,.20,.19),0,.065)
ell((0,.79,.275),(.145,.225,.18),0,.055)
ell((0,.61,-.04),(.148,.092,.29),0,.045)
limb((0,.86,.31),(0,1.065,.48),.105,.083,neck,.045)
ell((0,1.135,.515),(.078,.119,.093),head,.032)
ell((0,1.065,.61),(.073,.081,.135),head,.03)
ell((0,1.015,.719),(.059,.054,.079),head,.022)
# Chin flows into a small tapered beard instead of a floating spike.
limb((0,.99,.655),(0,.88,.615),.026,.007,head,.014)
for l in legs:
 a,b,c,f=l['a'],l['b'],l['c'],l['foot'];i,j,k=l['ids'];front=l['front']
 ell(a+(b-a)*.20,(.062,.115,.074) if front else (.074,.118,.085),i,.035)
 limb(a,b,.052 if front else .065,.029,i,.024)
 limb(b,c,.028,.018,j,.014)
 limb(c,f,.020,.023,k,.01)
 ell(f+np.array([0,-.018,.025]),(.032,.039,.050),k,.009)
# Narrow leaf ears, slightly down and out; integrated in the same skin.
for s,e in zip([-1,1],earids):
 ell((s*.143,1.115,.49),(.095,.020,.038),e,.018)
# Raised short goat tail.
limb((0,.89,-.465),(0,.965,-.61),.036,.008,tail,.023)

def distances(P,weights=False):
 d=np.full(P.shape[:-1],100.,dtype=float);W=np.zeros(P.shape[:-1]+(len(bones),)) if weights else None
 for primitive in primitives:
  if len(primitive)==4:
   c,r,b,k=primitive;q=P-c;k0=np.sqrt(np.sum((q/r)**2,axis=-1));k1=np.sqrt(np.sum((q/(r*r))**2,axis=-1));v=k0*(k0-1)/(k1+1e-12)
  else:
   a,end,r0,r1,b,k=primitive;ab=end-a;t=np.clip(np.sum((P-a)*ab,axis=-1)/np.sum(ab*ab),0,1);v=np.linalg.norm(P-a-t[...,None]*ab,axis=-1)-(r0+(r1-r0)*t)
  h=np.clip(.5+.5*(v-d)/k,0,1);d=v*(1-h)+d*h-k*h*(1-h)
  if weights:
   W*=h[...,None];W[...,b]+=1-h
 return (d,W) if weights else d
# 1.5cm sculpt grid: the offline extraction cost never enters the game loop.
step=args.step;lo=np.array([-.27,-.025,-.68]);hi=np.array([.27,1.48,.86]);dims=np.ceil((hi-lo)/step).astype(int)+1
axis=[lo[i]+np.arange(dims[i])*step for i in range(3)]
P=np.stack(np.meshgrid(*axis,indexing='ij'),axis=-1);D=distances(P)
base=np.stack(np.meshgrid(np.arange(dims[0]-1),np.arange(dims[1]-1),np.arange(dims[2]-1),indexing='ij'),axis=-1).reshape(-1,3)
corners=np.array([[0,0,0],[1,0,0],[1,1,0],[0,1,0],[0,0,1],[1,0,1],[1,1,1],[0,1,1]])
vals=np.stack([D[tuple((base+c).T)] for c in corners],axis=1)
base=base[(vals.min(axis=1)<0)&(vals.max(axis=1)>0)]
tetra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]]
verts=[];faces=[];edge_cache={}
def vertex(a,b,va,vb):
 ia=np.ravel_multi_index(tuple(a),dims);ib=np.ravel_multi_index(tuple(b),dims);key=(min(ia,ib),max(ia,ib))
 if key not in edge_cache:
  t=va/(va-vb);edge_cache[key]=len(verts);verts.append(lo+(a+(b-a)*t)*step)
 return edge_cache[key]
for cell in base:
 C=cell+corners;V=D[tuple(C.T)]
 for tet in tetra:
  inside=[i for i in tet if V[i]<0];outside=[i for i in tet if V[i]>=0]
  if not inside or not outside:continue
  ids=[vertex(C[a],C[b],V[a],V[b]) for a in inside for b in outside]
  if len(ids)==3:faces.append(ids)
  else:faces.extend([[ids[0],ids[1],ids[2]],[ids[1],ids[3],ids[2]]])
V=np.array(verts);F=np.array(faces,dtype=np.uint32)
# A coarse grid can isolate a minute beard/tail tip. Retain the connected main
# skin only; horns below use their original smooth parametric rings at every LOD.
if step>.015:
 parent=np.arange(len(V))
 def root(i):
  while parent[i]!=i:
   parent[i]=parent[parent[i]];i=parent[i]
  return i
 for a,b,c in F:
  a=root(a);parent[root(b)]=a;parent[root(c)]=a
 labels=np.array([root(i) for i in range(len(V))]);ids,counts=np.unique(labels,return_counts=True);keep=labels==ids[np.argmax(counts)]
 removed=np.count_nonzero(~keep)
 if removed:
  remap=np.cumsum(keep)-1;F=remap[F[keep[F].all(axis=1)]].astype(np.uint32);V=V[keep]
  print('REMOVED isolated coarse-grid tip vertices',removed)
# Correct winding against the scalar-field outward gradient.
eps=.0005;N=np.stack([(distances(V+np.eye(3)[k]*eps)-distances(V-np.eye(3)[k]*eps))/(2*eps) for k in range(3)],axis=1);N/=np.maximum(1e-12,np.linalg.norm(N,axis=1))[:,None]
fn=np.cross(V[F[:,1]]-V[F[:,0]],V[F[:,2]]-V[F[:,0]]);flip=(fn*N[F].mean(axis=1)).sum(axis=1)<0;F[flip]=F[flip][:,[0,2,1]]
_,W=distances(V,True);J=np.argsort(W,axis=1)[:,-4:][:,::-1].copy();W=np.take_along_axis(W,J,axis=1);W/=W.sum(axis=1)[:,None]
# Natural warm brown coat with cream underside, darker muzzle and fetlocks.
x,y,z=V.T;cream=np.exp(-((y-.60)/.12)**2)*np.exp(-((z+.04)/.38)**4);shoulder=np.exp(-((z-.18)/.20)**2)*.16
basecol=np.tile(np.array([.19,.087,.029]),(len(V),1));basecol=basecol*(1-(cream*.58+shoulder)[:,None])+np.array([.76,.64,.44])*(cream*.58+shoulder)[:,None]
dorsal=np.exp(-((x/.14)**2))*np.exp(-((y-.94)/.07)**2)*.22;basecol*=1-dorsal[:,None]
# Soft face blaze rather than geometry patches.
blaze=np.exp(-(x/.027)**2)*np.exp(-((z-.64)/.11)**2)*np.clip((y-.99)/.1,0,1)*.55;basecol=basecol*(1-blaze[:,None])+np.array([.82,.73,.56])*blaze[:,None]
hoofs=np.clip((.105-y)/.035,0,1);horns=(y>1.235).astype(float);mask=np.maximum(hoofs,horns*.82);basecol=basecol*(1-mask[:,None])+np.array([.055,.046,.033])*mask[:,None]
UV=np.stack([(np.arctan2(x,y-.75)/(2*np.pi)+.5), (z+.7)/1.6],axis=1)
# Add eyes/nostrils as properly attached small ellipsoids, rigidly weighted.
def detail(c,r,color,bid=2,lon=16,lat=10):
 global V,N,F,W,J,UV,basecol
 vs=[];ns=[]
 for i in range(lat+1):
  t=np.pi*i/lat
  for j in range(lon+1):
   a=2*np.pi*j/lon;q=np.array([np.sin(t)*np.cos(a),np.cos(t),np.sin(t)*np.sin(a)]);vs.append(np.array(c)+q*r);n=q/np.array(r);ns.append(n/np.linalg.norm(n))
 idx=[];off=len(V)
 for i in range(lat):
  for j in range(lon):
   a=off+i*(lon+1)+j;idx.extend([[a,a+1,a+lon+1],[a+1,a+lon+2,a+lon+1]])
 V=np.vstack([V,vs]);N=np.vstack([N,ns]);F=np.vstack([F,idx]);UV=np.vstack([UV,np.zeros((len(vs),2))]);J=np.vstack([J,np.full((len(vs),4),bid)]);W=np.vstack([W,np.tile([1,0,0,0],(len(vs),1))]);basecol=np.vstack([basecol,np.tile(color,(len(vs),1))])
def horn_mesh(side):
 global V,N,F,W,J,UV,basecol
 vs=[];ns=[];cs=[];idx=[];rings=33;segments=16
 def center(t):return np.array([side*(.052+.055*t),1.215+.275*math.sin(t*math.pi*.62),.505-.255*t**1.3])
 for j in range(rings):
  t=j/(rings-1);c=center(t);tan=center(min(1,t+.001))-center(max(0,t-.001));tan/=np.linalg.norm(tan);u=np.cross(tan,[1,0,0]);u/=np.linalg.norm(u);v=np.cross(tan,u);r=.026*(1-t)**.8+.0008
  for i in range(segments):
   angle=i/segments*2*math.pi;n=u*math.cos(angle)+v*math.sin(angle);vs.append(c+n*r);ns.append(n);cs.append(np.array([.08,.065,.045])*(1+.035*math.sin(t*150)))
 for j in range(rings-1):
  for i in range(segments):
   a=j*segments+i;b=j*segments+(i+1)%segments;c=a+segments;d=b+segments;idx.extend([[a,b,c],[b,d,c]])
 for j in [0,rings-1]:
  c=len(vs);vs.append(center(j/(rings-1)));ns.append([0,-1 if j==0 else 1,0]);cs.append([.08,.065,.045])
  for i in range(segments):idx.append([c,j*segments+(i+1)%segments,j*segments+i])
 vs=np.array(vs);ns=np.array(ns);idx=np.array(idx);cross=np.cross(vs[idx[:,1]]-vs[idx[:,0]],vs[idx[:,2]]-vs[idx[:,0]]);flip=(cross*ns[idx].mean(axis=1)).sum(axis=1)<0;idx[flip]=idx[flip][:,[0,2,1]]
 offset=len(V);V=np.vstack([V,vs]);N=np.vstack([N,ns]);F=np.vstack([F,idx+offset]);UV=np.vstack([UV,np.zeros((len(vs),2))]);J=np.vstack([J,np.full((len(vs),4),head)]);W=np.vstack([W,np.tile([1,0,0,0],(len(vs),1))]);basecol=np.vstack([basecol,cs])
# Keep eyes in a second primitive; the continuous skin stays separately manifold.
skin_count=len(F)
for s in [-1,1]:horn_mesh(s)
for s in [-1,1]:
 detail((s*.075,1.115,.57),(.009,.014,.018),[.065,.046,.018])
 detail((s*.082,1.116,.575),(.003,.003,.010),[.008,.008,.006])
 detail((s*.083,1.12,.581),(.002,.002,.003),[.7,.68,.55])
 detail((s*.040,1.025,.782),(.012,.008,.004),[.02,.016,.012])
# glTF binary writer, embedded texture and skin; no external converter required.
buf=bytearray();views=[];access=[]
def raw(data):
 while len(buf)%4:buf.append(0)
 i=len(views);views.append(dict(buffer=0,byteOffset=len(buf),byteLength=len(data)));buf.extend(data);return i
def acc(a,typ,ctype=5126):
 dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[ctype];a=np.asarray(a,dtype=dtype);view=raw(a.tobytes());x=dict(bufferView=view,componentType=ctype,count=len(a),type=typ)
 if typ=='VEC3':x.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
 if typ=='SCALAR':x.update(min=[a.min().item()],max=[a.max().item()])
 access.append(x);return len(access)-1
attrs=dict(POSITION=acc(V,'VEC3'),NORMAL=acc(N,'VEC3'),TEXCOORD_0=acc(UV,'VEC2'),COLOR_0=acc(basecol,'VEC3'),JOINTS_0=acc(J,'VEC4',5123),WEIGHTS_0=acc(W,'VEC4'))
skin_indices=acc(F[:skin_count].reshape(-1),'SCALAR',5125);eye_indices=acc(F[skin_count:].reshape(-1),'SCALAR',5125)
inv=np.tile(np.eye(4),(len(bones),1,1));inv[:,:3,3]=-np.array([b['p'] for b in bones]);ibm=acc(inv.transpose(0,2,1).reshape(-1,16),'MAT4')
rng=np.random.default_rng(27);size=256;yy,xx=np.mgrid[:size,:size];grain=rng.normal(0,1,(size,size));grain=(grain+np.roll(grain,1,axis=0)+np.roll(grain,2,axis=0))/3
image=np.uint8(np.clip(239+grain*9,210,255));pixels=np.stack([image,image,image],axis=2);bio=io.BytesIO();Image.fromarray(pixels).save(bio,format='PNG');iv=raw(bio.getvalue())
nodes=[dict(name='Goat',mesh=0,skin=0),dict(name='GoatRig',children=[2])]
for i,b in enumerate(bones):
 local=b['p']-(bones[b['parent']]['p'] if b['parent'] is not None else np.zeros(3));node=dict(name=b['name'],translation=local.tolist());children=[j+2 for j,c in enumerate(bones) if c['parent']==i]
 if children:node['children']=children
 nodes.append(node)
animations=[]
def quatx(a):return [math.sin(a/2),0,0,math.cos(a/2)]
for clip,duration in [('Idle',4.),('Walk',1.3),('Graze',4.),('Rest',4.)]:
 frames=49;times=np.linspace(0,duration,frames);input=acc(times,'SCALAR');samplers=[];channels=[]
 rotations={i:[] for i in range(len(bones))};translations=[]
 for t in times:
  phase=t/duration*2*np.pi;angles=np.zeros(len(bones));offset=np.zeros(3)
  if clip=='Idle':angles[neck]=math.sin(phase)*.018;angles[head]=math.sin(phase+.7)*.022;angles[tail]=math.sin(phase*2)*.07
  if clip=='Graze':angles[neck]=1.48+math.sin(phase)*.025;angles[head]=.18+math.sin(phase*3)*.025
  if clip=='Rest':offset[1]=-.44;angles[neck]=-.08;angles[head]=.12
  if clip=='Walk':
   offset[1]=math.cos(phase*2)*.006;angles[neck]=math.sin(phase)*.025;angles[head]=-math.sin(phase)*.02
  for l in legs:
   a,b,c,f=l['a'],l['b'],l['c'],l['foot'];i,j,k=l['ids'];front=l['front']
   if clip=='Rest':angles[i]=1.15 if front else -1.15;angles[j]=-2.30 if front else 2.30;angles[k]=-angles[i]-angles[j]
   elif clip=='Walk':
    ph=phase+(0 if l['side']<0 else np.pi)+(0 if front else np.pi*.62);cycle=(ph/(2*np.pi))%1;stance=.65;u=cycle/stance if cycle<stance else (cycle-stance)/(1-stance)
    reachz=(.11-.22*u) if cycle<stance else -.11+.22*(u*u*(3-2*u));lift=0 if cycle<stance else math.sin(u*np.pi)*.065
    # Solve two articulated segments against an authored, planted ankle target.
    ulen=np.linalg.norm(b-a);llen=np.linalg.norm(c-b);base=c-a;tz=base[2]+reachz;ty=-base[1]-lift;R=min(math.hypot(tz,ty),ulen+llen-.001)
    sign=1 if front else -1;bend=sign*math.acos(np.clip((R*R-ulen*ulen-llen*llen)/(2*ulen*llen),-1,1));hip=-math.atan2(tz,ty)-math.atan2(llen*math.sin(bend),ulen+llen*math.cos(bend))
    basehip=-math.atan2(b[2]-a[2],a[1]-b[1]);baseshin=-math.atan2(c[2]-b[2],b[1]-c[1]);angles[i]=hip-basehip;angles[j]=bend-(baseshin-basehip);angles[k]=-angles[i]-angles[j]
   elif clip=='Graze':angles[i]=.035 if front else -.018;angles[j]=-.035 if front else .018
  for e in earids:angles[e]=math.sin(phase*2+(e%2))* .035
  for i in rotations:rotations[i].append(quatx(angles[i]))
  translations.append(offset)
 for i,keys in rotations.items():
  samplers.append(dict(input=input,output=acc(keys,'VEC4'),interpolation='LINEAR'));channels.append(dict(sampler=len(samplers)-1,target=dict(node=i+2,path='rotation')))
 samplers.append(dict(input=input,output=acc(translations,'VEC3'),interpolation='LINEAR'));channels.append(dict(sampler=len(samplers)-1,target=dict(node=2,path='translation')))
 animations.append(dict(name=clip,samplers=samplers,channels=channels))
g=dict(asset=dict(version='2.0',generator='New Babylon original implicit sculpt',extras=dict(project='New Babylon',author='Created for this project',source='scripts/art-courtyard/create_goat.py',forward='+Z',units='metres')),scene=0,scenes=[dict(nodes=[0,1])],nodes=nodes,skins=[dict(name='Goat skin',joints=list(range(2,2+len(bones))),inverseBindMatrices=ibm,skeleton=2)],meshes=[dict(name='Goat continuous skin',primitives=[dict(attributes=attrs,indices=skin_indices,material=0),dict(attributes=attrs,indices=eye_indices,material=1)])],materials=[dict(name='Goat short coat',pbrMetallicRoughness=dict(baseColorTexture=dict(index=0),metallicFactor=0,roughnessFactor=.94)),dict(name='Goat eye and muzzle',pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=.52),doubleSided=True)],textures=[dict(source=0)],images=[dict(bufferView=iv,mimeType='image/png')],animations=animations,buffers=[dict(byteLength=len(buf))],bufferViews=views,accessors=access)
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);buf+=b'\0'*((-len(buf))%4);OUT.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buf))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buf),0x004e4942)+buf)
print('SAVED',OUT,'vertices',len(V),'triangles',len(F),'bones',len(bones),'bytes',OUT.stat().st_size)
