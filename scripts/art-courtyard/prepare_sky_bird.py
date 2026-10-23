"""Keep one supplied bird and its original wing rotations; no source rig invention.
Uses the existing, already-normalized permitted bird pack. Original asset untouched.
Run with the bundled Python (numpy/Pillow), from any directory.
"""
from pathlib import Path
import argparse, copy, numpy as np
from prepare_birds_pack import load, read, matrix, bounds, save
ROOT=Path(__file__).resolve().parents[2]
def prepare(source,target):
 g,b,sha=load(source);g=copy.deepcopy(g)
 # First bird: meshes 0/1, skin0, Armature at source node5. Outer coordinate
 # conversions 0..3 are retained exactly, including the source -Z beak direction.
 keep=[0,1,2,3,5,6,7,9,10,11,12,13,14,15,16,17,18,19];mapping={old:new for new,old in enumerate(keep)}
 nodes=[]
 for old in keep:
  n=g['nodes'][old];n['children']=[mapping[c]for c in n.get('children',[])if c in mapping]
  if not n['children']:n.pop('children')
  nodes.append(n)
 g['nodes']=nodes;g['meshes']=g['meshes'][:2];g['skins']=g['skins'][:1]
 for skin in g['skins']:skin['joints']=[mapping[j]for j in skin['joints']];skin['skeleton']=mapping[skin['skeleton']]
 g['scenes']=[{'nodes':[mapping[0]]}];g['scene']=0
 for a in g['animations']:
  old=a['samplers'];new=[];channels=[]
  for c in a['channels']:
   if c['target']['node'] not in mapping or c['target']['path']!='rotation':continue
   c['target']['node']=mapping[c['target']['node']];new.append(old[c['sampler']]);c['sampler']=len(new)-1;channels.append(c)
  a['channels']=channels;a['samplers']=new;a['name']='WingFlight'
 lo,hi=bounds(g,b);center=(lo+hi)/2;scale=.95/(hi[0]-lo[0])
 parents={c:i for i,n in enumerate(g['nodes'])for c in n.get('children',[])}
 def world(i):return (world(parents[i])if i in parents else np.eye(4))@matrix(g['nodes'][i])
 skin=g['skins'][0];ibm=read(g,b,skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1);mat=np.array([world(j)for j in skin['joints']])@ibm
 def skin_points(mesh):
  a=g['meshes'][mesh]['primitives'][0]['attributes'];v=read(g,b,a['POSITION']);v=np.c_[v,np.ones(len(v))];j=read(g,b,a['JOINTS_0']).astype(int);w=read(g,b,a['WEIGHTS_0']);return sum(np.einsum('nij,nj->ni',mat[j[:,c]],v)*w[:,c,None]for c in range(4))[:,:3]
 body,beak_vertices=skin_points(0),skin_points(1);beak=(beak_vertices[np.argmin(beak_vertices[:,2])]-center)*scale;tail=(body[np.argmax(body[:,2])]-center)*scale
 assert beak[2]<tail[2], 'Measured narrow separate beak must point toward glTF -Z'
 beak[[0,2]]*=-1;tail[[0,2]]*=-1;translation=-center*scale;translation[[0,2]]*=-1
 wrapper=len(g['nodes']);g['nodes'].append({'name':'NewBabylonSingleSkyBirdForwardZ','children':[0],'scale':[float(scale)]*3,'rotation':[0,1,0,0],'translation':translation.tolist()});g['scenes'][0]['nodes']=[wrapper]
 g['asset']['extras']['new_babylon_sky_flight']={'input_sha256':sha,'source_skin':0,'source_meshes':[0,1],'source_forward_gltf':'-Z','forward_gltf':'+Z','forward_babylon':'+Z','beak_gltf':beak.tolist(),'tail_gltf':tail.tolist(),'beak_width':float(np.ptp(beak_vertices[:,0])*scale),'wingspan':.95,'removed_body_translation':True,'adaptation':'First original bird only; six original wing rotation tracks; root/body translations removed. No internal turning; source author/license unchanged.'}
 n=save(g,b,target);print(f'{target.name}: {n} bytes; wing tracks {len(g["animations"][0]["channels"])}; measured source beak -Z; normalized glTF/Babylon +Z')
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=ROOT/'assets/art-courtyard/models/imported-sky-birds.glb');p.add_argument('--out',type=Path,default=ROOT/'assets/art-courtyard/models/sky-bird-single.glb');a=p.parse_args();prepare(a.source,a.out)
