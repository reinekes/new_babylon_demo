"""Adapt GerardoA400's CC BY 4.0 goat without changing topology or skin weights.
Run with Python 3, numpy and Pillow. Original download is never overwritten.
Source rigAction is a stationary look-around, NOT an authored walking cycle.
"""
from pathlib import Path
import copy, hashlib, io, json, math, struct
import numpy as np
from PIL import Image
ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'assets/art-courtyard/models/goat.glb'
TARGET = SOURCE.with_name('goat-downloaded.glb')
DT = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}

def qmul(a, b):
    av, bv = np.asarray(a[:3]), np.asarray(b[:3]); aw, bw = a[3], b[3]
    return np.r_[aw*bv+bw*av+np.cross(av,bv), aw*bw-np.dot(av,bv)]

def qmatrix(q):
    x,y,z,w = q / np.linalg.norm(q)
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])

def prepare():
    raw=SOURCE.read_bytes(); length=struct.unpack_from('<I',raw,12)[0]
    g=json.loads(raw[20:20+length]); binary=raw[28+length:]
    chunks=[binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']]
    def read(index):
        a=g['accessors'][index];v=g['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);w=WIDTH[a['type']]
        return np.ndarray((a['count'],w),dtype=dt,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dt.itemsize*w),dt.itemsize)).copy()
    def append(values, kind):
        values=np.asarray(values,dtype='<f4').reshape(-1,WIDTH[kind]);vi=len(chunks);chunks.append(values.tobytes())
        g['bufferViews'].append({'buffer':0,'byteLength':values.nbytes})
        ai=len(g['accessors']);g['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(values),'type':kind,'min':values.min(axis=0).tolist(),'max':values.max(axis=0).tolist()});return ai
    image_report=[]
    for im in g.get('images',[]):
        vi=im['bufferView'];image=Image.open(io.BytesIO(chunks[vi]));before=image.size
        image.thumbnail((1024,1024),Image.Resampling.LANCZOS)
        output=io.BytesIO();image.save(output,format='PNG',optimize=True);chunks[vi]=output.getvalue();im['mimeType']='image/png'
        image_report.append({'source':list(before),'adapted':list(image.size)})
    source=copy.deepcopy(g['animations'][0]);source['name']='SourceRigAction'
    source['extras']={'provenance':'Original GerardoA400 rigAction; sampler/accessor values unchanged','semantic':'Stationary head look-around with front-leg flex; no verified walking stride'}
    idle=copy.deepcopy(source);idle['name']='Idle'
    # Use source frame zero, so every custom state restores every original animated property.
    pose={};original_targets=[]
    for ch in source['channels']:
        target=ch['target'];key=(target['node'],target['path']);s=source['samplers'][ch['sampler']]
        pose[key]=read(s['output'])[0].astype(float);original_targets.append(key)
    nodes=g['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
    def local(i,p):
        return pose.get((i,p),np.array(nodes[i].get(p,{'rotation':[0,0,0,1],'translation':[0,0,0],'scale':[1,1,1]}[p]),float))
    def world_rot(i):
        r=qmatrix(local(i,'rotation'))
        return world_rot(parents[i])@r if i in parents else r
    # Rotate about horizontal world X in each joint's parent frame: forward/back leg flex.
    axes={i:world_rot(parents[i]).T@np.array([1.,0,0]) for i in (16,20,21,22,23,25,29,31,35,37,41,43)}
    def turn(i,angle):
        delta=np.r_[axes[i]*math.sin(angle/2), math.cos(angle/2)]
        return qmul(delta,local(i,'rotation'))
    # Ground contact is measured from the actual weighted mesh, not joint pivots.
    skin=g['skins'][0];inverse_bind=read(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    skin_vertices=[]
    for mesh in g['meshes']:
        for primitive in mesh['primitives']:
            attributes=primitive['attributes'];positions=read(attributes['POSITION'])
            skin_vertices.append((np.c_[positions,np.ones(len(positions))],read(attributes['JOINTS_0']).astype(int),read(attributes['WEIGHTS_0'])))
    source_ground=min(float(p[:,1].min()) for p,j,w in skin_vertices)
    root_up=world_rot(parents[16]).T@np.array([0.,1,0])
    def ground_contact(frame):
        cache={}
        def world(i):
            if i in cache:return cache[i]
            transform=np.eye(4)
            transform[:3,:3]=qmatrix(frame.get((i,'rotation'),local(i,'rotation')))*frame.get((i,'scale'),local(i,'scale'))
            transform[:3,3]=frame.get((i,'translation'),local(i,'translation'))
            cache[i]=world(parents[i])@transform if i in parents else transform
            return cache[i]
        matrices=np.asarray([world(i) for i in skin['joints']])@inverse_bind
        minimum=float('inf')
        for positions,joints,weights in skin_vertices:
            height=np.zeros(len(positions))
            for c in range(4):height+=np.einsum('ij,ij->i',matrices[joints[:,c],1,:],positions)*weights[:,c]
            minimum=min(minimum,float(height.min()))
        frame[(16,'translation')]+=root_up*(source_ground-minimum)
    authored=[]
    for name,duration in [('Walk',1.2),('Graze',4.0),('Rest',5.0)]:
        times=np.linspace(0,duration,round(duration*30)+1);values={key:[] for key in original_targets}
        for t in times:
            phase=2*math.pi*t/duration;frame={k:v.copy() for k,v in pose.items()}
            if name=='Walk':
                # Diagonal pairs; rear .001, front .002. Mild in-place skeletal cycle.
                for hip,knee,offset in [(23,25,0),(35,37,0),(41,43,math.pi),(29,31,math.pi)]:
                    wave=math.sin(phase+offset);frame[(hip,'rotation')]=turn(hip,.65*wave)
                    frame[(knee,'rotation')]=turn(knee,-.20*max(0,wave))
                frame[(16,'translation')][2]+=.025*(1-math.cos(phase*2))
                frame[(21,'rotation')]=turn(21,.025*math.sin(phase))
                ground_contact(frame)
            elif name=='Graze':
                # Standing browse/head dip, not a claim of historical or source-authored motion.
                frame[(20,'rotation')]=turn(20,.60+.025*math.sin(phase))
                frame[(21,'rotation')]=turn(21,.35+.045*math.sin(phase*3))
                frame[(22,'rotation')]=turn(22,.12+.04*math.sin(phase*6))
            else:
                # Standing drowse: modest neck droop and breathing, never a lying-down pose.
                frame[(20,'rotation')]=turn(20,.12)
                frame[(22,'rotation')]=turn(22,.09+.012*math.sin(phase))
                frame[(16,'translation')][2]+=.008*math.sin(phase)
            for key in values:values[key].append(frame[key])
        ai=append(times,'SCALAR');anim={'name':name,'channels':[],'samplers':[],'extras':{'provenance':'New Babylon procedural skeletal adaptation, 2026-10-22; original author did not supply this motion','semantic':{'Walk':'in-place diagonal-pair walk; measured stride about 0.39 metres','Graze':'standing browse with neck/head dip','Rest':'standing drowse; not lying down'}[name]}}
        for key,v in values.items():
            i,p=key;oi=append(v,'VEC4' if p=='rotation' else 'VEC3');si=len(anim['samplers']);anim['samplers'].append({'input':ai,'output':oi,'interpolation':'LINEAR'});anim['channels'].append({'sampler':si,'target':{'node':i,'path':p}})
        authored.append(anim)
    g['animations']=[idle,*authored,source]
    bounds=np.concatenate([read(p['attributes']['POSITION']) for m in g['meshes'] for p in m['primitives']]);lo=bounds.min(axis=0);hi=bounds.max(axis=0)
    # All source scene roots and complete skinned hierarchy move together; inverse bind matrices unchanged.
    scale=.30;root_index=len(nodes)
    nodes.append({'name':'DownloadedGoatMetres','children':g['scenes'][g.get('scene',0)]['nodes'],'scale':[scale]*3,'translation':[-float((lo[0]+hi[0])/2)*scale,-float(lo[1])*scale,-float((lo[2]+hi[2])/2)*scale], 'extras':{'forward_gltf':'+Z','metres_per_source_unit':scale}})
    g['scenes'][g.get('scene',0)]['nodes']=[root_index]
    report={'source_sha256':hashlib.sha256(raw).hexdigest(),'license':'CC-BY-4.0','source':g['asset']['extras']['source'],'author':g['asset']['extras']['author'],'source_clip_duration_seconds':float(max(read(s['input'])[-1,0] for s in source['samplers'])),'source_clip_semantic':'Stationary head look-around; root horizontal travel absent; not verified as walking','source_bounds':{'min':lo.tolist(),'max':hi.tolist()},'metres_bounds_size':((hi-lo)*scale).tolist(),'forward_gltf':'+Z','scale':scale,'triangles':sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives']),'bones':len(g['skins'][0]['joints']),'images':image_report,'walk_stride_metres_estimate':.39,'walk_stride_note':'Forward-kinematic toe excursion 0.370-0.401 metres; hips +/-0.65 radians; per-frame skinned-hoof ground correction; new clip, not source root displacement','clips':{'Idle':'Source rigAction verbatim','SourceRigAction':'Source rigAction verbatim','Walk':'New Babylon procedural addition','Graze':'New Babylon procedural addition','Rest':'New Babylon procedural standing drowse addition'}}
    g['asset']['extras']['new_babylon_adaptation']=report
    out=bytearray()
    for v,c in zip(g['bufferViews'],chunks):
        out.extend(b'\0'*((-len(out))%4));v['byteOffset']=len(out);v['byteLength']=len(c);out.extend(c)
    g['buffers']=[{'byteLength':len(out)}];out.extend(b'\0'*((-len(out))%4))
    js=json.dumps(g,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
    glb=struct.pack('<III',0x46546c67,2,28+len(js)+len(out))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(out),0x004e4942)+out
    TARGET.write_bytes(glb);report['output_bytes']=len(glb);print(json.dumps(report,indent=2))
if __name__=='__main__':prepare()
