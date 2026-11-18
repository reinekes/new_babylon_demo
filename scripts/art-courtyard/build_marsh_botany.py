"""Author four metre-scaled, original floodplain plants. Run with Python, NumPy and Pillow."""
from io import BytesIO
import json
import math
from pathlib import Path
from random import Random
import struct

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / 'assets/art-courtyard/models'
TAU = math.tau


def plant_atlas(species, seed):
    rng = np.random.default_rng(seed)
    image = np.zeros((512, 256, 4), dtype=np.uint8)
    x, y = np.meshgrid(np.arange(256), np.arange(512))
    # Longitudinal veins, a pale midrib, dry edges and purple-brown basal sheaths.
    if species == 'awn':
        base, edges, midrib = [149, 133, 78], [31, 21, 7], [28, 27, 16]
    elif species == 'cattail':
        base, edges, midrib = [88, 111, 82], [21, 15, 1], [13, 15, 11]
    else:
        base, edges, midrib = [96, 117, 66], [47, 27, 9], [34, 35, 17]
    u, t = np.clip(x / 90, 0, 1), y / 512
    mottling = rng.normal(0, 2.8, t.shape) + 3 * np.sin(t * 32 + u * 9)
    veins = 5 * np.cos(u * 101 + .8 * np.sin(t * 6)) + 2 * np.sin(u * 222)
    leaf = (np.array(base) + np.array(edges) * abs(2*u-1)[:, :, None]**7
            + np.array(midrib) * np.exp(-((u-.50)/.045)**2)[:, :, None]
            + (mottling+veins)[:, :, None] + (1-t)[:, :, None]*[11, 9, 8]
            + t[:, :, None]**5*np.array([10, -4, 3]))
    image[:, :91, :3] = np.clip(leaf[:, :91], 0, 255)
    image[:, :91, 3] = 255
    # Narrow culm strip and a separate fibrous/russet seed surface.
    culm = np.array([130,133,77] if species != 'awn' else [174,151,94])
    stalk = culm + (5*np.sin(x*.42)+mottling+9*(1-t))[:, :, None]
    image[:, 92:128, :3] = np.clip(stalk[:, 92:128],0,255)
    image[:, 92:128, 3] = 255
    noise = rng.normal(0, 11, x.shape) + np.sin(x*2.0+y*.79)*8 + np.sin(y*1.9)*3
    head = np.array([107,65,39] if species=='cattail' else [145,112,62])
    image[:, 129:164, :3] = np.clip(head + noise[:, :, None] + (1-t)[:, :, None]*[16,13,7],0,255)[:, 129:164]
    image[:, 129:164, 3] = 255
    im = Image.fromarray(image)
    draw = ImageDraw.Draw(im)
    for t in ([.19,.41,.63,.84] if species=='cane' else []):
        y0 = int((1-t)*480+12)
        draw.rectangle((93,y0,126,y0+3),fill=(114,119,70,255))
        draw.rectangle((93,y0-2,126,y0),fill=(150,147,92,255))
    # A nodding branch of fine, alternating spikelets. Transparent space between
    # the sprays matters against the sky, unlike an opaque cone of seed heads.
    rnd = Random(seed)
    points = [(210 + 6*math.sin(t*3.1),493-465*t) for t in np.linspace(0,1,34)]
    draw.line(points,fill=(161,139,90,255),width=3)
    for i in range(26):
        t=(i+.6)/27
        cx, cy = 210+6*math.sin(t*3.1), 493-465*t
        width=(6+28*math.sin(math.pi*t)**.72)*rnd.uniform(.72,1)
        for side in (-1,1):
            tx, ty = cx+side*width, cy-rnd.uniform(22,42)
            col=rnd.choice([(191,164,115,255),(178,151,111,255),(210,181,136,255),(171,149,111,255)])
            draw.line((cx,cy,tx,ty),fill=col,width=2)
            for j in range(3):
                f=(j+1)/3; sx,sy=cx+side*width*f,cy+(ty-cy)*f
                draw.ellipse((sx-1,sy-4,sx+1,sy+1),fill=col)
                draw.line((sx,sy-3,sx+side*rnd.uniform(3,7),sy-rnd.uniform(8,17)),fill=col,width=1)
    stream=BytesIO()
    im.save(stream,format='PNG',optimize=True)
    return stream.getvalue()


class Plant:
    def __init__(self, species, seed):
        self.species, self.seed = species, seed
        self.rng=Random(seed)
        self.positions, self.uvs, self.indices = [], [], []

    def vertex(self, pos, u, v):
        self.positions.append(pos)
        self.uvs.append((u/256, v/512))
        return len(self.positions)-1

    def surface(self, rows):
        for low, high in zip(rows, rows[1:]):
            for a,b,c,d in zip(low,low[1:],high,high[1:]):
                self.indices.extend((a,c,b,b,c,d))

    def shaft(self, curve, profile, sides=5, bark=False):
        rows=[]
        u0,u1=(130,162) if bark else (94,125)
        for t, radius in profile:
            x,y,z=curve(t)
            row=[]
            for j in range(sides+1):
                angle=j% sides*TAU/sides
                row.append(self.vertex((x+radius*math.cos(angle),y,z+radius*math.sin(angle)),u0+(u1-u0)*j/sides,493-480*t))
            rows.append(row)
        self.surface(rows)

    def leaf(self, base, angle, length, height, half_width, droop):
        rows=[]
        # Fold along the midrib, twist the tip and taper at the enclosing sheath.
        for t,w in [(0,.20),(.17,.86),(.38,1),(.64,.78),(.85,.40),(1,.015)]:
            theta=angle+.43*t*t
            reach=length*(.36*t+.64*t*t)
            twist=.95*t*t
            x=base[0]+math.cos(theta)*reach
            z=base[2]+math.sin(theta)*reach
            y=base[1]+height*math.sin(t*1.67)-droop*t*t
            row=[]
            for k in [-1,0,1]:
                width=k*w*half_width
                row.append(self.vertex((x-math.sin(theta)*width*math.cos(twist),y+width*math.sin(twist)+(abs(k)-1)*w*half_width*.29,z+math.cos(theta)*width*math.cos(twist)),5+(k+1)*40,491-480*t))
            rows.append(row)
        self.surface(rows)

    def plume(self, base, angle, reach, height, half_width):
        rows=[]
        for t in (0,.31,.67,1):
            x=base[0]+math.cos(angle)*reach*t
            z=base[2]+math.sin(angle)*reach*t
            y=base[1]+height*(1.55*t-(.92 if self.species=='cane' else .48)*t*t)
            # An upright spray plane seen obliquely has a real, curved axis.
            rows.append([self.vertex((x-math.sin(angle)*k*half_width,y,z+math.cos(angle)*k*half_width),166+(k+1)*43,505-t*501) for k in (-1,1)])
        self.surface(rows)

    def write(self, name, label):
        p=np.asarray(self.positions, dtype='<f4')
        tri=np.asarray(self.indices,dtype='<u2').reshape(-1,3)
        normals=np.zeros_like(p)
        face=np.cross(p[tri[:,1]]-p[tri[:,0]],p[tri[:,2]]-p[tri[:,0]])
        for i in range(3):
            np.add.at(normals,tri[:,i],face)
        normals/=np.maximum(1e-12,np.linalg.norm(normals,axis=1,keepdims=True))
        # Closed tube seams have duplicated UVs; average their normals at the seam.
        groups={}
        for i,point in enumerate(p):
            groups.setdefault(tuple(np.round(point,6)),[]).append(i)
        for group in groups.values():
            if len(group)>1:
                mean=normals[group].sum(axis=0)
                normals[group]=mean/max(float(np.linalg.norm(mean)),1e-12)
        blob=bytearray(); views=[]; access=[]
        def store(data,target=None):
            blob.extend(b'\0'*(-len(blob)%4))
            view={'buffer':0,'byteOffset':len(blob),'byteLength':len(data)}
            if target: view['target']=target
            views.append(view);blob.extend(data);return len(views)-1
        for array,typ,comp in [(p,'VEC3',5126),(normals,'VEC3',5126),(np.asarray(self.uvs,dtype='<f4'),'VEC2',5126),(tri.reshape(-1),'SCALAR',5123)]:
            access.append({'bufferView':store(array.tobytes(),34963 if typ=='SCALAR' else 34962),'componentType':comp,'count':len(array),'type':typ})
        access[0].update(min=p.min(axis=0).tolist(),max=p.max(axis=0).tolist())
        texture=store(plant_atlas(self.species,self.seed));blob.extend(b'\0'*(-len(blob)%4))
        g={'asset':{'version':'2.0','generator':'New Babylon · original floodplain botany','extras':{'author':'New Babylon','source':'scripts/art-courtyard/build_marsh_botany.py','license':'Project-authored geometry and atlas; explicit standalone asset license not recorded.'}},
           'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':label,'mesh':0}],
           'meshes':[{'name':label,'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0}]}],
           'materials':[{'name':name+'-epidermis','doubleSided':True,'alphaMode':'MASK','alphaCutoff':.31,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.91}}],
           'textures':[{'source':0}],'images':[{'name':label+' atlas','mimeType':'image/png','bufferView':texture}],
           'buffers':[{'byteLength':len(blob)}],'bufferViews':views,'accessors':access}
        j=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*(-len(j)%4)
        raw=struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(blob),b'BIN\0')+blob
        (OUTPUT/(name+'.glb')).write_bytes(raw)
        print(name,len(raw),len(tri),p.min(0),p.max(0))


def make_reeds():
    plant=Plant('cane',257)
    for i,(x,z,h) in enumerate([(-.19,-.10,2.28),(.12,.12,1.65),(.14,-.18,1.06)]):
        a=i*2.4+.5
        def stem(t):
            return x+.29*math.cos(a)*t*t,h*t,z+.28*math.sin(a)*t*t
        profile=[(0,.022)]
        for t in [.19,.41,.63,.84]:
            profile.extend([(t-.008,.022-.011*t),(t,.024-.010*t),(t+.008,.021-.011*t)])
        profile.append((1,.007));plant.shaft(stem,profile,sides=6)
        for j,t in enumerate([.095,.21,.34,.45,.59,.70,.81,.90]):
            scale=(.32+.68*math.sin(t*2.75))*h/2
            plant.leaf(stem(t),a+j*2.77,.52*scale,.29*scale,.037*scale,.32*scale)
        if i<2:
            for j in range(16):
                t=j/16;q=a+j*2.40
                base=stem(1)
                plant.plume((base[0]+.14*t*t,base[1]+.39*t,base[2]),q,.21*(1-t)**.72+.025,.30-.12*t,.029)
            plant.plume((stem(1)[0]+.13,h+.36,stem(1)[2]),a,.072,.21,.026)
    plant.write('marsh-plumed-cane','Jointed cane with nodding panicles')


def make_cattail():
    plant=Plant('cattail',742)
    for i,(x,z,h) in enumerate([(-.19,-.08,1.61),(.14,.09,1.35),(.08,-.17,1.13)]):
        a=1.13+i*2.4
        def stalk(t):
            return x+.10*math.cos(a)*t*t,h*t,z+.10*math.sin(a)*t*t
        plant.shaft(stalk,[(0,.016),(.6,.012),(1,.006)],sides=6)
        def head(t):
            return stalk(.67+.24*t)
        w=.034+.003*i
        plant.shaft(head,[(0,.008),(.04,.74*w),(.10,w),(.72,w*1.08),(.93,w),(.98,w*.61),(1,.004)],8,True)
        for j in range(6):
            plant.leaf((x,0,z),a+j*1.73,.29+.26*plant.rng.random(),h*plant.rng.uniform(.71,1.04),.024,.12+.22*plant.rng.random())
    plant.write('marsh-cattail','Narrow-leaved cattail colony')


def make_clubrush():
    plant=Plant('rush',194)
    for i in range(15):
        a=i*2.4;r=.06+.08*plant.rng.random();h=plant.rng.uniform(.30,.58);lean=plant.rng.uniform(.08,.28)
        def culm(t):
            return (r+lean*t*t)*math.cos(a),h*t,(r+lean*t*t)*math.sin(a)
        plant.shaft(culm,[(0,.012),(.47,.011),(.86,.008),(1,.001)],3)
        if i%3==0:
            for j in range(4):
                q=a+j*1.99; base=culm(.84); reach=.022+j*.010; drop=.007*j
                def nut(t):
                    return base[0]+math.cos(q)*reach*t,base[1]+.038*t-drop*t*t,base[2]+math.sin(q)*reach*t
                plant.shaft(nut,[(0,.001),(.36,.009),(.68,.008),(1,.001)],5,True)
        if i%4==0: plant.leaf(culm(.07),a+.44,.19,.25,.008,.12)
    plant.write('marsh-clubrush','Triangular rush culms and lateral spikelets')


def make_awn_grass():
    plant=Plant('awn',432)
    for i in range(22):
        a=2.4*i+plant.rng.uniform(-.16,.16);r=plant.rng.uniform(.02,.10)
        base=(math.cos(a)*r,0,math.sin(a)*r)
        plant.leaf(base,a,plant.rng.uniform(.12,.34),plant.rng.uniform(.15,.34),.008,plant.rng.uniform(.04,.15))
        if i%4==0:
            h=plant.rng.uniform(.28,.43)
            def straw(t):
                return base[0]+.11*math.cos(a)*t*t,h*t,base[2]+.11*math.sin(a)*t*t
            plant.shaft(straw,[(0,.004),(.53,.003),(1,.0015)],3)
            for j in range(3):
                plant.plume(straw(1),a+j*2.1,.035,.16,.016)
    plant.write('alluvial-awn-grass','Dry bunchgrass with awned seed sprays')


if __name__=='__main__':
    make_reeds();make_cattail();make_clubrush();make_awn_grass()
