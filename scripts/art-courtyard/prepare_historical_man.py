"""Adapt ASYKIN's supplied robed man, retaining his own mesh, skin and UV atlas.

The original clip is Talking, not walking. A true walking cycle from the already
licensed Iko Nia pair is retargeted by semantic world rotation deltas to this
man's 34 native joints. No actor is replaced by a talking/gliding animation.
Head geometry uses a 3 mm grid; the robe/body use 16 mm clusters with shared
local skin weights to remove sub-pixel tessellation without opening UV seams.
Downloads and the existing residents remain read only.
"""
from pathlib import Path
import argparse, copy, hashlib, io, json, re
import numpy as np
from PIL import Image
from prepare_city_fauna import GLB
from prepare_native_people import (Writer, clip_sample, compose, graph_world,
                                   point_transform, quaternion, rotation, skinned)
from prepare_source_walk_people import aim

ROOT=Path(__file__).resolve().parents[2]

class HistoricalWriter(Writer):
    def clip(self,name,times,translations,rotations):
        clip={'name':name,'samplers':[],'channels':[]}
        time_index=self.accessor(times,'SCALAR')
        for bone in range(translations.shape[1]):
            for path,values,kind in [('translation',translations[:,bone],'VEC3'),('rotation',rotations[:,bone],'VEC4')]:
                constant=np.max(np.ptp(values,axis=0))<1e-7
                chosen=values[[0,-1]]if constant else values
                ti=self.accessor([times[0],times[-1]],'SCALAR')if constant else time_index
                clip['channels'].append({'sampler':len(clip['samplers']),'target':{'node':bone+1,'path':path}})
                clip['samplers'].append({'input':ti,'output':self.accessor(chosen,kind),'interpolation':'LINEAR'})
        self.g['animations'].append(clip)
ALIASES={'_rootJoint':'Root','Hips':'pelvis','Spine':'spine_01','Spine1':'spine_02',
 'Spine2':'spine_03','Neck':'neck_01','Head':'head','HeadTop_End':'head_end'}
for side,suffix in [('Left','l'),('Right','r')]:
    for source,target in [('Shoulder','clavicle'),('Arm','upperarm'),('ForeArm','lowerarm'),
                          ('Hand','hand'),('UpLeg','thigh'),('Leg','calf'),('Foot','foot'),
                          ('ToeBase','toe'),('Toe_End','toe_end')]:
        ALIASES[side+source]=target+'_'+suffix
    for finger in range(1,5):
        ALIASES[f'{side}HandIndex{finger}']=f'handindex{finger}_{suffix}'

def worlds(t,q,parents):
    result=[]
    for i in range(len(t)):
        local=compose(t[i],q[i],[1,1,1])
        result.append(result[parents[i]]@local if i in parents else local)
    return np.array(result)

def prepare(source,walk,target):
    a=GLB(source);g=a.g;skin=g['skins'][0];joints=skin['joints'];palette={node:i for i,node in enumerate(joints)}
    names=[ALIASES[re.sub(r'_0\d+$','',g['nodes'][node]['name'].replace('mixamorig:',''))] for node in joints]
    parents={palette[node]:palette[parent] for node,parent in a.parents.items() if node in palette and parent in palette}
    ib=a.read(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    bind=np.linalg.inv(ib)
    primitive=g['meshes'][0]['primitives'][0];attrs=primitive['attributes'];p=a.read(attrs['POSITION']).astype(float)
    scale=1.7/np.ptp(p[:,1]);canonical=np.eye(4);canonical[:3,:3]*=scale;canonical[:3,3]=[-(p[:,0].min()+p[:,0].max())/2*scale,-p[:,1].min()*scale,0]
    p=point_transform(p,canonical)
    rest=np.tile(np.eye(4),(len(joints),1,1))
    for i in range(len(joints)):
        rest[i,:3,:3]=rotation(bind[i]);rest[i,:3,3]=point_transform(bind[i:i+1,:3,3],canonical)[0]
    local=np.array([np.linalg.inv(rest[parents[i]])@rest[i] if i in parents else rest[i] for i in range(len(rest))])
    t=local[:,:3,3].copy();q=np.array([quaternion(rotation(m))for m in local]);inverse_bind=np.linalg.inv(rest)
    data={'p':p,'n':a.read(attrs['NORMAL']),'uv':a.read(attrs['TEXCOORD_0']),
          'j':a.read(attrs['JOINTS_0']).astype(int),'w':a.read(attrs['WEIGHTS_0']).astype(float),
          'tri':a.read(primitive['indices']).reshape(-1,3).astype(int)}
    original_triangles=len(data['tri'])
    # All UV-separated copies use the same position and averaged native weights;
    # texture seams cannot tear apart when the robed knees bend.
    cells=np.where(p[:,1]>1.4,.003,.016)
    grid=np.round(p/cells[:,None]);clustered=grid*cells[:,None]
    _,inv=np.unique(np.c_[cells,grid],axis=0,return_inverse=True)
    weights=np.zeros((inv.max()+1,len(joints)))
    for k in range(4):np.add.at(weights,(inv,data['j'][:,k]),data['w'][:,k])
    js=np.argsort(weights,axis=1)[:,-4:][:,::-1];ws=np.take_along_axis(weights,js,axis=1);ws/=np.maximum(ws.sum(1,keepdims=True),1e-12)
    data['p'],data['j'],data['w']=clustered,js[inv],ws[inv]
    faces=inv[data['tri']];data['tri']=data['tri'][(faces[:,0]!=faces[:,1])&(faces[:,0]!=faces[:,2])&(faces[:,1]!=faces[:,2])]
    used,indices=np.unique(data['tri'],return_inverse=True)
    for key in ['p','n','uv','j','w']:data[key]=data[key][used]
    data['tri']=indices.reshape(-1,3)
    max_shift=float(np.linalg.norm(clustered-p,axis=1).max())
    ground_mask=data['p'][:,1]<.12
    ground_surface={k:v[ground_mask] for k,v in data.items() if k in ['p','j','w']}
    w=GLB(walk);wg=w.g;wskin=wg['skins'][0];wnames=[wg['nodes'][node]['name'] for node in wskin['joints']];wmap={name:i for i,name in enumerate(wnames)}
    wbind=np.linalg.inv(w.read(wskin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1))
    wparents=w.parents

    def retarget(clip,time):
        pose=clip_sample(wg,w.b,clip,time);source_world=graph_world(wg['nodes'],wparents,pose)
        tt,qq=t.copy(),q.copy();out=[]
        for i,name in enumerate(names):
            parent=parents.get(i);pr=rotation(out[parent]) if parent is not None else np.eye(3)
            if name!='Root' and name in wmap:
                wi=wmap[name];delta=rotation(source_world[wskin['joints'][wi]])@rotation(wbind[wi]).T
                qq[i]=quaternion(pr.T@delta@rotation(rest[i]))
                if name=='pelvis':
                    desired=rest[i,:3,3]+source_world[wskin['joints'][wi]][:3,3]-wbind[wi,:3,3]
                    tt[i]=point_transform(desired[None],np.linalg.inv(out[parent]))[0]
            node=compose(tt[i],qq[i],[1,1,1]);out.append(out[parent]@node if parent is not None else node)
        # Native bind poses have different knee flexion. Copying rotations alone
        # gave one heel a 40 cm lift. Retarget actual source ankle trajectories
        # with a two-bone solve, retaining this man's exact hip/knee lengths.
        for suffix in ['l','r']:
            upper,lower,foot=[names.index(k+'_'+suffix)for k in ['thigh','calf','foot']]
            source_foot=wmap['foot_'+suffix]
            goal=rest[foot,:3,3]+source_world[wskin['joints'][source_foot]][:3,3]-wbind[source_foot,:3,3]
            out=worlds(tt,qq,parents);hip,knee,ankle=out[[upper,lower,foot],:3,3]
            l1,l2=np.linalg.norm(knee-hip),np.linalg.norm(ankle-knee);ray=goal-hip;length=min(np.linalg.norm(ray),l1+l2-.003);direction=ray/np.linalg.norm(ray)
            along=(l1*l1-l2*l2+length*length)/(2*length);height=np.sqrt(max(0,l1*l1-along*along))
            bend=np.array([.08 if suffix=='l'else -.08,0,1.]);bend-=direction*np.dot(bend,direction);bend/=np.linalg.norm(bend)
            aim(tt,qq,parents,upper,lower,hip+direction*along+bend*height)
            aim(tt,qq,parents,lower,foot,hip+direction*length)
            out=worlds(tt,qq,parents);delta=rotation(source_world[wskin['joints'][source_foot]])@rotation(wbind[source_foot]).T
            qq[foot]=quaternion(rotation(out[lower]).T@delta@rotation(rest[foot]))
        out=worlds(tt,qq,parents)
        tt[0,1]-=skinned(ground_surface,out,inverse_bind)[:,1].min()
        return tt,qq

    writer=HistoricalWriter();meta={'rig':'asykin-mixamo-retarget','sourceWalk':True,'bones':len(rest),'age':'adult','sex':'m',
       'strideMetres':wg['asset']['extras']['native_resident']['strideMetres'],
       'semanticMap':{name:i for i,name in enumerate(names)},'provenance':copy.deepcopy(g['asset']['extras']),
       'walk':{'source':wg['asset']['extras']['native_resident']['provenance'],
          'sourceQuaternionsPreserved':False,'method':'semantic world-space rotation deltas retargeted to the 34 native joints; own native lengths, skin and robe retained'},
       'simplification':{'body_grid_metres':.016,'head_grid_metres':.003,'max_vertex_displacement_metres':max_shift,
          'weights':'top four averaged native weights shared by every coincident voxel; UV and normal seams retained'}}
    idle=next(clip for clip in wg['animations'] if clip['name']=='Idle_Loop');it,iq=retarget(idle,0)
    writer.g['asset']=copy.deepcopy(g['asset']);writer.g['asset']['generator']='New Babylon prepare_historical_man.py';writer.g['asset']['extras']['native_resident']=meta
    writer.g['nodes']=[{'name':'HistoricalRobedResident','children':[1],'extras':{'native_resident':meta}}]
    for i,name in enumerate(names):
        node={'name':name,'translation':it[i].tolist(),'rotation':iq[i].tolist()}
        children=[child+1 for child,parent in parents.items()if parent==i]
        if children:node['children']=children
        writer.g['nodes'].append(node)
    writer.g['skins']=[{'name':'Original ASYKIN native skin in canonical metres','joints':list(range(1,len(rest)+1)),
       'skeleton':1,'inverseBindMatrices':writer.accessor(inverse_bind.transpose(0,2,1).reshape(-1,16),'MAT4')}]
    # A single inherited atlas preserves the face, beard, headband and long robe.
    image=g['images'][0];view=g['bufferViews'][image['bufferView']];raw=a.b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
    im=Image.open(io.BytesIO(raw)).convert('RGB');im.thumbnail((512,512),Image.Resampling.LANCZOS);encoded=io.BytesIO();im.save(encoded,format='JPEG',quality=88,optimize=True)
    while len(writer.binary)%4:writer.binary.append(0)
    vi=len(writer.g['bufferViews']);writer.g['bufferViews'].append({'buffer':0,'byteOffset':len(writer.binary),'byteLength':len(encoded.getvalue())});writer.binary.extend(encoded.getvalue())
    writer.g['images']=[{'bufferView':vi,'mimeType':'image/jpeg'}];writer.g['samplers']=[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}];writer.g['textures']=[{'source':0,'sampler':0}]
    writer.g['materials']=[{'name':'ASYKIN inherited atlas','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'baseColorFactor':[.93,.88,.76,1],'metallicFactor':0,'roughnessFactor':.94}}]
    writer.mesh('Historical adapted skin and inherited robe',data,0)
    frames=np.arange(31)/30;walk_clip=next(clip for clip in wg['animations'] if clip['name']=='Walk_Loop');poses=[retarget(walk_clip,float(time))for time in frames]
    velocity=[]
    for suffix in ['l','r']:
        fi=names.index('foot_'+suffix);track=np.array([worlds(tt,qq,parents)[fi,:3,3]for tt,qq in poses]);v=np.diff(track[:,2])*30;low=track[:-1,1]<track[:,1].min()+.055;velocity.extend((-v[low&(v<-.05)]).tolist())
    meta['strideMetres']=float(np.median(velocity))
    meta['walk']['strideMethod']='median rearward retargeted ankle velocity during the low stance'
    writer.clip('Walk_Loop',frames,np.array([tt for tt,_ in poses]),np.array([qq for _,qq in poses]))
    writer.clip('Idle_Loop',np.array([0,2]),np.stack([it,it]),np.stack([iq,iq]))
    # Preserve the source's actual stationary conversation as a separately named
    # optional clip. It is never selected for displacement by the game actors.
    duration=max(float(a.read(s['input']).max())for s in g['animations'][0]['samplers']);talk_times=np.linspace(0,duration,round(duration*20)+1);talk=[]
    for time in talk_times:
        pose=clip_sample(g,a.b,g['animations'][0],float(time));sw=graph_world(g['nodes'],a.parents,pose);tt,qq=t.copy(),q.copy();out=[]
        for i,node in enumerate(joints):
            parent=parents.get(i);pr=rotation(out[parent])if parent is not None else np.eye(3)
            if i:
                qq[i]=quaternion(pr.T@rotation(sw[node]))
                if names[i]=='pelvis':tt[i]=point_transform(point_transform(sw[node][None,:3,3],canonical),np.linalg.inv(out[parent]))[0]
            local=compose(tt[i],qq[i],[1,1,1]);out.append(out[parent]@local if parent is not None else local)
        tt[0,1]-=skinned(ground_surface,np.array(out),inverse_bind)[:,1].min();talk.append((tt,qq))
    writer.clip('Source_Talking',talk_times,np.array([tt for tt,_ in talk]),np.array([qq for _,qq in talk]))
    size=writer.save(target)
    return {'output':target.name,'bytes':size,'source_bytes':source.stat().st_size,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
      'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'triangles_before':original_triangles,'triangles':len(data['tri']),
      'vertices':len(data['p']),'bones':len(rest),'texture':list(im.size),'max_vertex_displacement_metres':max_shift,
      'source':g['asset']['extras'],'walk_source':wg['asset']['extras']['native_resident']['provenance'],
      'clips':['Walk_Loop','Idle_Loop','Source_Talking']}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--source',type=Path,default=Path.home()/'Downloads/man_model.glb');parser.add_argument('--walk',type=Path,default=ROOT/'assets/art-courtyard/models/source-walk-male.glb');parser.add_argument('--out',type=Path,default=ROOT/'assets/art-courtyard/models/historical-man.glb');args=parser.parse_args()
    report=prepare(args.source,args.walk,args.out);(args.out.parent.parent/'historical-man-report.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
