"""Adapt user-supplied CC BY caravan GLBs; preserve source skins and provenance.
Run with bundled Python (NumPy/Pillow), optional --source-directory. No Blender needed.
Merchant source is medieval: headwear removed; wool palette is an artistic adaptation.
Camel is an explicit chronological concession for the foreign caravan.
"""
from pathlib import Path
import argparse,copy,hashlib,io,json,math,struct
import numpy as np
from PIL import Image
from prepare_city_fauna import GLB,qm,qmul

def quaternion(m):
 # Orthogonal matrix to xyzw; eigenvector method remains stable around pi.
 w,v=np.linalg.eigh(np.array([[m[0,0]-m[1,1]-m[2,2],m[0,1]+m[1,0],m[0,2]+m[2,0],m[2,1]-m[1,2]], [m[0,1]+m[1,0],m[1,1]-m[0,0]-m[2,2],m[1,2]+m[2,1],m[0,2]-m[2,0]], [m[0,2]+m[2,0],m[1,2]+m[2,1],m[2,2]-m[0,0]-m[1,1],m[1,0]-m[0,1]], [m[2,1]-m[1,2],m[0,2]-m[2,0],m[1,0]-m[0,1],m.trace()]]));return v[:,np.argmax(w)]
def aim(a,b):
 a=a/np.linalg.norm(a);b=b/np.linalg.norm(b);q=np.r_[np.cross(a,b),1+np.dot(a,b)];return q/np.linalg.norm(q)
def prepare(source,target,kind):
 a=GLB(source);g=a.g;chunks=[a.b[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']]for v in g['bufferViews']]
 def append(values,typ):
  values=np.asarray(values,dtype='<f4');i=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteLength':values.nbytes});chunks.append(values.tobytes());g['accessors'].append({'bufferView':i,'componentType':5126,'count':len(values),'type':typ,'min':values.min(0).reshape(-1).tolist(),'max':values.max(0).reshape(-1).tolist()});return len(g['accessors'])-1
 removed=[]
 if kind=='merchant':
  for n in g['nodes']:
   if 'mesh'in n and 'Headwear'in g['meshes'][n['mesh']].get('name',''):removed.append(g['meshes'][n['mesh']]['name']);del n['mesh'];n.pop('skin',None)
 for im in g.get('images',[]):
  vi=im['bufferView'];img=Image.open(io.BytesIO(chunks[vi]));img.thumbnail((1024,1024),Image.Resampling.LANCZOS);out=io.BytesIO();transparent='A'in img.getbands()and img.getchannel('A').getextrema()[0]<255
  if transparent:img.save(out,format='PNG',optimize=True);im['mimeType']='image/png'
  else:img.convert('RGB').save(out,format='JPEG',quality=88);im['mimeType']='image/jpeg'
  chunks[vi]=out.getvalue()
 if kind=='merchant':
  for m in g['materials']:
   name=m.get('name','');p=m.setdefault('pbrMetallicRoughness',{});p['metallicFactor']=0;p['roughnessFactor']=.94
   if any(k in name for k in ['Outfit_Top','Outfit_Bottom','Footwear']):
    p.pop('baseColorTexture',None);p['baseColorFactor']=([.43,.30,.16,1]if 'Footwear'in name else [.69,.57,.38,1]if 'Top'in name else [.43,.33,.21,1]);m.pop('normalTexture',None)
 # Smooth the source's overt quilted sleeve/boot ridges without replacing face or rig.
 if kind=='merchant':
  for mesh in g['meshes']:
   if not any(w in mesh.get('name','')for w in ['Outfit_Top','Footwear']):continue
   for primitive in mesh['primitives']:
    ai=primitive['attributes']['POSITION'];coords=a.read(ai);indices=a.read(primitive['indices']).astype(int).reshape(-1,3);links=[set()for _ in coords]
    for tri in indices:
     for v in tri:links[v].update(int(n)for n in tri if n!=v)
    for _ in range(12):coords=np.array([v*.45+coords[list(links[i])].mean(0)*.55 if links[i]else v for i,v in enumerate(coords)])
    accessor=g['accessors'][ai];vi=accessor['bufferView'];view=g['bufferViews'][vi];buf=bytearray(chunks[vi]);arr=np.ndarray(coords.shape,dtype='<f4',buffer=buf,offset=accessor.get('byteOffset',0),strides=(view.get('byteStride',12),4));arr[:]=coords;chunks[vi]=bytes(buf)
    normals=np.zeros_like(coords)
    for triangle in indices:
     A,B,C=coords[triangle];normal=np.cross(B-A,C-A)
     for index in triangle:normals[index]+=normal
    normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-10);normal_accessor=g['accessors'][primitive['attributes']['NORMAL']];nvi=normal_accessor['bufferView'];nv=g['bufferViews'][nvi];nbuf=bytearray(chunks[nvi]);np.ndarray(normals.shape,dtype='<f4',buffer=nbuf,offset=normal_accessor.get('byteOffset',0),strides=(nv.get('byteStride',12),4))[:]=normals;chunks[nvi]=bytes(nbuf)
 # Keep the source camel's textile drawing, compress its saturated colour into wool/ochre.
 if kind=='camel':
  image_index=g['textures'][g['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]['source'];vi=g['images'][image_index]['bufferView'];image=Image.open(io.BytesIO(chunks[vi])).convert('RGB');rgb=np.array(image).astype(float);luma=rgb@np.array([.2126,.7152,.0722]);warm=np.stack([luma*1.06,luma*.78,luma*.50],axis=-1);muted=np.clip(rgb*.18+warm*.82,0,255).astype('uint8');out=io.BytesIO();Image.fromarray(muted).save(out,format='JPEG',quality=88);chunks[vi]=out.getvalue()
 original=copy.deepcopy(g['animations']);a.g['animations']=[original[0]];base=a.pose(0);world=a.world(base);raw=a.vertices(0);yaw=math.pi if kind=='camel' else 0;rot=qm(np.array([0,math.sin(yaw/2),0,math.cos(yaw/2)]));scale=1.36 if kind=='camel'else 1.68/(raw[:,1].max()-raw[:,1].min());verts=raw@rot.T*scale;center=(verts.min(0)+verts.max(0))/2;center[1]=0
 wrapper=len(g['nodes']);roots=g['scenes'][g.get('scene',0)]['nodes'];g['nodes'].append({'name':'NewBabylonCaravanMetresForwardZ','children':roots,'rotation':[0,math.sin(yaw/2),0,math.cos(yaw/2)],'scale':[scale]*3});g['scenes'][g.get('scene',0)]['nodes']=[wrapper]
 # GLB's parent map was captured before wrapper: use old hierarchy for exact skin bounds.
 def clip(name,duration,pose_at,semantic):
  count=round(duration*30)+1;times=np.linspace(0,duration,count);frames=[];translations=[]
  for t in times:
   pose=pose_at(float(t));v=a.vertices(pose=pose)@rot.T*scale
   # Lock horizontal skeleton drift to source root, while retaining source support gait.
   w=a.world(pose);root=24 if kind=='merchant'else 7;delta=(w[root][:3,3]-world[root][:3,3])@rot.T*scale;trans=-center.copy();trans[[0,2]]-=delta[[0,2]];trans[1]=.015-v[:,1].min();frames.append(pose);translations.append(trans)
  anim={'name':name,'samplers':[],'channels':[],'extras':{'provenance':semantic}};ti=append(times[:,None],'SCALAR')
  for node,path in sorted(set().union(*(f.keys()for f in frames))):
   vals=[f.get((node,path),base.get((node,path),g['nodes'][node].get(path,{'rotation':[0,0,0,1],'translation':[0,0,0],'scale':[1,1,1],'weights':[]}[path])))for f in frames]
   if path=='rotation':
    for i in range(1,len(vals)):
     if np.dot(vals[i-1],vals[i])<0:vals[i]=-np.asarray(vals[i])
   oi=append(vals,'VEC4'if path=='rotation'else'SCALAR'if path=='weights'else'VEC3');anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':node,'path':path}});anim['samplers'].append({'input':ti,'output':oi,'interpolation':'LINEAR'})
  oi=append(translations,'VEC3');anim['channels'].append({'sampler':len(anim['samplers']),'target':{'node':wrapper,'path':'translation'}});anim['samplers'].append({'input':ti,'output':oi,'interpolation':'LINEAR'});return anim
 if kind=='camel':
  clips=[]
  for src,name in zip(original,['Idle','Idle2','Walk']):
   a.g['animations']=[src];duration=max(float(a.read(s['input'])[-1,0])for s in src['samplers']);clips.append(clip(name,duration,a.pose,'Supplied camel '+src['name']+'; grounded in-place, original rig'))
 else:
  a.g['animations']=[original[0]]
  clips=[clip('Idle',3,lambda t:a.pose(t),'Source Mixamo standing gesture, first three seconds')]
  names={n.get('name',''):i for i,n in enumerate(g['nodes'])};root=24
  legs=[]
  for side in ['Left','Right']:
   ids=[next(i for n,i in names.items()if 'mixamorig:'+side+k+'_'in n)for k in ['UpLeg','Leg','Foot']];legs.append(ids)
  def walk(t):
   pose={k:v.copy()for k,v in base.items()};phase=t/.95*2*math.pi
   for side,(hip,knee,foot)in enumerate(legs):
    w=a.world(pose);h=w[hip][:3,3];k=w[knee][:3,3];f=w[foot][:3,3];angle=phase+side*math.pi;cycle=(angle/(2*math.pi))%1;target=f.copy();swing=max(0,(cycle-.6)/.4);target[2]+=.31*(1-2*cycle/.6)if cycle<.6 else -.31+.62*(swing*swing*(3-2*swing));target[1]+=.13*math.sin(math.pi*swing);L1=np.linalg.norm(k-h);L2=np.linalg.norm(f-k);d=target-h;dist=min(np.linalg.norm(d),L1+L2-.001);direction=d/np.linalg.norm(d);along=(L1*L1-L2*L2+dist*dist)/(2*dist);bend=np.array([0.,0.,1.]);bend-=direction*np.dot(bend,direction);bend/=np.linalg.norm(bend);K=h+direction*along+bend*math.sqrt(max(0,L1*L1-along*along))
    for joint,end,dest in [(hip,knee,K),(knee,foot,target)]:
     w=a.world(pose);q=aim(w[end][:3,3]-w[joint][:3,3],dest-w[joint][:3,3]);R=qm(q)@w[joint][:3,:3];P=w[a.parents[joint]][:3,:3];pose[joint,'rotation']=quaternion(np.linalg.inv(P)@R)
    w=a.world(pose);pose[foot,'rotation']=quaternion(np.linalg.inv(w[a.parents[foot]][:3,:3])@world[foot][:3,:3])
   for side in ['Left','Right']:
    joint=next(i for n,i in names.items()if 'mixamorig:'+side+'Arm_'in n);q=pose.get((joint,'rotation'),np.array(g['nodes'][joint].get('rotation',[0,0,0,1])));angle=.20*math.cos(phase+(0 if side=='Left'else math.pi));pose[joint,'rotation']=qmul(q,np.array([math.sin(angle/2),0,0,math.cos(angle/2)]))
   return pose
  clips.append(clip('Walk',.95,walk,'New Babylon authored two-link leg IK on supplied merchant rig; not source walking animation'))
 g['animations']=clips
 if kind=='merchant':
  # Authored overlapping wool wrap, weighted to the supplied pelvis/thighs.
  vertices=[];normals=[];weights=[];joints=[];indices=[];skin=g['skins'][0];hip=skin['joints'].index(24);thighs=[skin['joints'].index(ids[0])for ids in legs];N=48
  for layer,(y,rx,rz)in enumerate([(1.095,.225,.17),(.96,.25,.18),(.77,.29,.20),(.54,.33,.23)]):
   for i in range(N):
    angle=2*math.pi*i/N;fold=1+.025*math.cos(angle*16);x=rx*math.cos(angle)*fold;z=rz*math.sin(angle)*fold;vertices.append([x,y,z]);normals.append([math.cos(angle),.1,math.sin(angle)]);leg_weight=.20*layer/3;weights.append([1-leg_weight,leg_weight,0,0]);joints.append([hip,thighs[0 if x>0 else 1],0,0])
  for layer in range(3):
   for i in range(N):
    A=layer*N+i;B=layer*N+(i+1)%N;C=(layer+1)*N+i;D=(layer+1)*N+(i+1)%N;indices.extend([A,C,B,B,C,D])
  def integer(values,typ):
   vals=np.asarray(values,dtype='<u2');vi=len(g['bufferViews']);g['bufferViews'].append({'buffer':0,'byteLength':vals.nbytes});chunks.append(vals.tobytes());g['accessors'].append({'bufferView':vi,'componentType':5123,'count':len(vals),'type':typ});return len(g['accessors'])-1
  material=len(g['materials']);g['materials'].append({'name':'NewBabylon undyed draped wool wrap','doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':[.50,.36,.20,1],'roughnessFactor':1,'metallicFactor':0}})
  primitive={'attributes':{'POSITION':append(vertices,'VEC3'),'NORMAL':append(normals,'VEC3'),'WEIGHTS_0':append(weights,'VEC4'),'JOINTS_0':integer(joints,'VEC4')},'indices':integer(indices,'SCALAR'),'material':material};mi=len(g['meshes']);g['meshes'].append({'name':'NewBabylon draped wool trade wrap','primitives':[primitive]});source_node=next(n for n in g['nodes']if n.get('mesh')==7);node=copy.deepcopy(source_node);node['name']='NewBabylon skinned wool wrap';node['mesh']=mi;ni=len(g['nodes']);g['nodes'].append(node);parent=a.parents[next(i for i,n in enumerate(g['nodes'])if n is source_node)];g['nodes'][parent]['children'].append(ni)
 report={'source_sha256':hashlib.sha256(Path(source).read_bytes()).hexdigest(),'author':g['asset']['extras']['author'],'license':g['asset']['extras']['license'],'source':g['asset']['extras']['source'],'forward_gltf':'+Z','scale':scale,'removed_meshes':removed,'clips':{c['name']:c['extras']['provenance']for c in clips},'historical_limits':'Camel foreign caravan is artistic anachronism for Sumer III millennium BCE. Merchant medieval source is adapted, not a historical reconstruction.','base_height':float(verts[:,1].max()-verts[:,1].min())};g['asset']['extras']['new_babylon_adaptation']=report
 out=bytearray()
 for view,chunk in zip(g['bufferViews'],chunks):
  out.extend(b'\0'*((-len(out))%4));view['byteOffset']=len(out);view['byteLength']=len(chunk);out.extend(chunk)
 g['buffers']=[{'byteLength':len(out)}];out.extend(b'\0'*((-len(out))%4));js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4);Path(target).write_bytes(struct.pack('<III',0x46546c67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out);print(json.dumps(report,ensure_ascii=False))
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source-directory',type=Path,default=Path.home()/'Downloads');args=p.parse_args();dest=Path(__file__).resolve().parents[2]/'assets/art-courtyard/models'
 for fn,out,kind in [('traider.glb','caravan-merchant.glb','merchant'),('camel.glb','caravan-camel.glb','camel')]:prepare(args.source_directory/fn,dest/out,kind)
