"""Build original textured barley tillers for the city. Requires Pillow."""
import io
import json
import math
import random
import struct
from pathlib import Path
from PIL import Image, ImageDraw

rng = random.Random(466)
atlas = Image.new('RGBA', (512, 512))
draw = ImageDraw.Draw(atlas)
# Two sides of a barley ear. Awn roots sit on individual spikelets.
for col in range(2):
    cx = 104 + col * 208
    def spine(y):
        return cx + int(6 * math.sin((400-y) / 260))
    draw.line([(spine(y), y) for y in range(118, 494, 4)], fill=(155, 128, 60, 255), width=5)
    for row in range(18,-1,-1):
        y = 432 - row*13
        for side in [-1,1]:
            rx = spine(y)
            width = int(9 + 13*math.sin((row+1)/20*math.pi))
            sx = rx+side*width
            top = y-21+rng.randint(-3,3)
            length = rng.randint(98,153)
            draw.line([(sx,top), (sx+side*11,top-43), (sx+side*(25+row//2),max(3,top-length))],
                      fill=(195+rng.randrange(24),177+rng.randrange(14),109,255),width=4)
            hull = [(rx-side*2,y+8),(rx+side*6,y+5),(sx,top+8),(sx,top-4),(sx-side*8,top-1),(rx-side*3,y-6)]
            draw.polygon(hull, fill=(164+rng.randrange(24),135+rng.randrange(20),73,255))
            draw.line([hull[1],(sx-side*3,top+8),hull[3]],fill=(221,193,121,255),width=3)
            draw.line([(rx+side*3,y+1),(sx-side*5,top+7)],fill=(121,109,57,255),width=2)
# Opaque stripes for narrow leaves, shafts, and their central ribs.
for x in range(416,512):
    t=(x-416)/96
    rib=(.5+.5*math.cos(t*math.pi*6))*.10 + .23*math.exp(-((t-.5)*13)**2)
    for y in range(512):
        g = y/512*.12+rib+rng.uniform(-.023,.023)
        atlas.putpixel((x,y),(int(149+g*83),int(142+g*78),int(78+g*60),255))
v=[]; uv=[]; idx=[]
def point(x,y,z,u,w):
    v.extend((x,y,z));uv.extend((u/512,w/512));return len(v)//3-1
def strips(rows):
    for a,b in zip(rows,rows[1:]):
        for j in range(len(a)-1):idx.extend((a[j],b[j],a[j+1],a[j+1],b[j],b[j+1]))
for stem in range(5):
    a = stem*2.4
    bx = .21*math.cos(a); bz=.19*math.sin(a)
    h = .55+rng.uniform(-.04,.08)
    drift = .13+rng.uniform(-.04,.025)
    def stalk(t):
        return (bx*(1+t*.76)+drift*t**2,h*t,bz*(1+t*.84)+.035*t**2)
    rows=[]
    for j,t in enumerate([0,.38,.73,1]):
        x,y,z=stalk(t); rad=.009-.003*t; ring=[]
        for k in range(5):
            q=k*math.pi/2
            ring.append(point(x+rad*math.cos(q),y,z+rad*math.sin(q),421+k*19,12+480*t))
        rows.append(ring)
    strips(rows)
    for leaf,base in enumerate([.21,.56]):
        x,y,z=stalk(base);d=a+leaf*1.73;dx=math.cos(d);dz=math.sin(d);length=.21+.045*(2-leaf)
        rows=[]
        for j,(t,wide,rise) in enumerate([(0,.004,0),(.35,.019,.10),(.74,.013,.14),(1,.001,.086)]):
            rows.append([point(x+dx*t*length-dz*k*wide,y+rise+(1-abs(k))*.005,z+dz*t*length+dx*k*wide,422+(k+1)*40,10+t*485) for k in [-1,0,1]])
        strips(rows)
    # A bent, three-sided ear. The atlas supplies translucent gaps between awns.
    x,y,z=stalk(1); u0=stem%2*208; tilt=.046+.038*(.5+.5*math.sin(a))
    for side in range(3):
        q=a+side*math.pi/3
        rows=[]
        for t in [0,.38,.70,1]:
            ex=x+tilt*(t+.55*t*t);ey=y+.37*t-.05*t*t
            rows.append([point(ex+k*.102*math.cos(q),ey,z+.018*t*t+k*.102*math.sin(q),u0+(k+1)*102+1,499-t*497) for k in [-1,1]])
        strips(rows)
norm=[0.]*len(v)
for i in range(0,len(idx),3):
    a,b,c=[idx[i+n]*3 for n in range(3)]
    u=[v[b+n]-v[a+n] for n in range(3)];w=[v[c+n]-v[a+n] for n in range(3)]
    cross=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]]
    for n in [a,b,c]:
        for j in range(3):norm[n+j]+=cross[j]
for i in range(0,len(norm),3):
    l=math.hypot(*norm[i:i+3]) or 1
    norm[i:i+3]=[x/l for x in norm[i:i+3]]
blob=bytearray();views=[]
def store(data):
    blob.extend(b'\0'*(-len(blob)%4));views.append({'buffer':0,'byteOffset':len(blob),'byteLength':len(data)});blob.extend(data);return len(views)-1
def acc(data,components,kind,fmt):
    return {'bufferView':store(struct.pack('<'+str(len(data))+fmt,*data)),'componentType':5126 if fmt=='f' else 5123,'type':kind,'count':len(data)//components}
access=[acc(v,3,'VEC3','f'),acc(norm,3,'VEC3','f'),acc(uv,2,'VEC2','f'),acc(idx,1,'SCALAR','H')]
access[0].update(min=[min(v[i::3]) for i in range(3)],max=[max(v[i::3]) for i in range(3)])
out=io.BytesIO();atlas.save(out,format='PNG',optimize=True);tex=store(out.getvalue());blob.extend(b'\0'*(-len(blob)%4))
g={'asset':{'version':'2.0','generator':'New Babylon botanical studies'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[{'name':'Five ripening barley tillers','mesh':0}],
   'meshes':[{'primitives':[{'attributes':{'POSITION':0,'NORMAL':1,'TEXCOORD_0':2},'indices':3,'material':0}]}],
   'materials':[{'name':'Barley straw and golden spikelets','alphaMode':'MASK','alphaCutoff':.31,'doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.94}}],
   'images':[{'bufferView':tex,'mimeType':'image/png'}],'textures':[{'source':0}],'accessors':access,'bufferViews':views,'buffers':[{'byteLength':len(blob)}]}
data=json.dumps(g,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
target=Path(__file__).resolve().parents[1]/'assets/3d/crops/barley-tillers.glb'
target.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(blob))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
