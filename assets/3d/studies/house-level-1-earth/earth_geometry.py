"""Build the single-tile courtyard house study. Coordinates are X, height, front."""
import json
import math
import random
import struct
import sys
from pathlib import Path

city = "--city" in sys.argv
rng = random.Random(2718)
sin, cos, pi = math.sin, math.cos, math.pi
positions, colors, normals, indices = [], [], [], []
surface_ranges=[]
def surface(name):
    start=len(indices)
    if surface_ranges:
        if surface_ranges[-1][2]==name:return
        surface_ranges[-1][1]=start
        if surface_ranges[-1][0]==start:surface_ranges.pop()
    surface_ranges.append([start,None,name])
surface('earth')
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def add(a,b): return tuple(x+y for x,y in zip(a,b))
def mul(v,k): return tuple(x*k for x in v)
def cross(a,b): return (a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0])
def unit(v): return mul(v, 1/max(1e-12,math.sqrt(sum(x*x for x in v))))
def linear(c):
    v=max(0,min(255,c))/255
    return v/12.92 if v<=.04045 else ((v+.055)/1.055)**2.4
def tint(col,k): return tuple(v*k for v in col)
def vert(p,col):
    i=len(positions); positions.append(p); colors.append(tuple(linear(c) for c in col)); normals.append([0.,0.,0.]); return i
def face(a,b,c):
    n=cross(sub(positions[b],positions[a]),sub(positions[c],positions[a]))
    if sum(k*k for k in n)<1e-17: return
    indices.extend((a,b,c))
    for i in (a,b,c):
        for j in range(3): normals[i][j]+=n[j]
def quad(a,b,c,d): face(a,b,c);face(a,c,d)
def wallcolor(x,y,z,base,seed):
    grain=.014*sin(12*x+7*y+seed)*cos(11*z+3*y)+.010*sin(19*y-3*z+x)+rng.uniform(-.008,.008)
    foot=max(0,1-y/.62)
    return tint(base,1+grain+.022*sin(4*x+2*z+seed)*cos(2*y)-.13*foot)
def rounded_path(cx,cz,w,d,r,step):
    # Clockwise from above in X/Z, outward winding for upward strips.
    points=[]
    arc_steps=2 if city else 4
    for sx,sz,start in [(1,1,0),(-1,1,90),(-1,-1,180),(1,-1,270)]:
        center=(cx+sx*(w/2-r),cz+sz*(d/2-r))
        arc=[(center[0]+r*cos(math.radians(start+i*90/arc_steps)),center[1]+r*sin(math.radians(start+i*90/arc_steps))) for i in range(arc_steps+1)]
        if points:
            a,b=points[-1],arc[0]; count=math.ceil(math.dist(a,b)/step)
            points.extend(tuple(a[j]+(b[j]-a[j])*k/count for j in (0,1)) for k in range(1,count))
        points.extend(arc)
    a,b=points[-1],points[0]; count=math.ceil(math.dist(a,b)/step)
    points.extend(tuple(a[j]+(b[j]-a[j])*k/count for j in (0,1)) for k in range(1,count))
    return points
plaster=(201,181,151); clay=(166,142,112); pale=(202,182,152)
wood=(103,90,74); straw=(178,157,119); rust=(157,77,48)
def slab(cx,cz,w,d,y0,y1,base,r=.055,step=.28,rough=.012):
    h=y1-y0; lip=min(r*.5,h*.17)
    path=rounded_path(cx,cz,w,d,min(r,w*.4,d*.4),max(step,.36) if city else step)
    levels=[(y0,.96),(y0+lip,1)]+[(y0+h*i/4,1) for i in range(1,4)]+[(y1-lip,.996),(y1,.97)]
    if city:levels=[levels[0],levels[1],levels[-2],levels[-1]]
    rings=[]; seed=rng.random()*6
    for y,s in levels:
        row=[]
        for x,z in path:
            wav=rough*(.64*sin(x*4+z*2+seed)+.36*cos(z*7-x))
            p=(cx+(x-cx)*s,y+wav*((y-y0)/h),cz+(z-cz)*s)
            row.append(vert(p,wallcolor(*p,base,seed)))
        if rings:
            for i in range(len(row)): quad(rings[-1][i-1],row[i-1],row[i],rings[-1][i])
        rings.append(row)
    for row,y,reverse in [(rings[0],y0,False),(rings[-1],y1,True)]:
        if reverse and w>3 and d>2:
            # Radial tessellation lets mottled, trowelled earth read from above.
            for k in (range(8,0,-4) if city else range(11,0,-1)):
                scale=k/12; inner=[]
                for x,z in path:
                    px=cx+(x-cx)*scale; pz=cz+(z-cz)*scale
                    marks=.025*sin(7*px+sin(3*pz))+.014*cos(12*pz+3*px)
                    py=y+.008*sin(4*px+sin(3*pz))
                    inner.append(vert((px,py,pz),tint(base,1+marks+rng.uniform(-.016,.016))))
                for i in range(len(row)):quad(row[i-1],inner[i-1],inner[i],row[i])
                row=inner
        center=vert((cx,y,cz),base)
        for i in range(len(row)):
            if reverse: face(center,row[i],row[i-1])
            else: face(center,row[i-1],row[i])
def pole(a,b,r,color,sides=9,tip=.87):
    if city:sides=min(sides,6)
    axis=unit(sub(b,a)); u=unit(cross(axis,(0,1,0) if abs(axis[1])<.9 else (1,0,0))); v=cross(axis,u)
    rows=[]
    for p,size in [(a,r),(b,r*tip)]:
        row=[]
        for j in range(sides):
            vec=add(mul(u,cos(j*2*pi/sides)),mul(v,sin(j*2*pi/sides)))
            row.append(vert(add(p,mul(vec,size)),tint(color,1+.045*cos(3*j))))
        rows.append(row)
    lo,hi=rows
    for j in range(sides):
        quad(lo[j-1],lo[j],hi[j],hi[j-1])
        if j>1: face(lo[0],lo[j],lo[j-1]);face(hi[0],hi[j-1],hi[j])
def jar(x,z,y,scale,shape,base,bands=()):
    previous_surface=surface_ranges[-1][2];surface('pottery')
    rows=[]
    sides=16 if city else 28
    for k,(radius,height) in enumerate(shape):
        col=dict(bands).get(k,base); row=[]
        for j in range(sides):
            a=j*2*pi/sides; r=scale*radius*(.93+.024*cos(a*3+.4)+.011*sin(5*a+height*3))
            p=(x+r*cos(a)+scale*.017*height,y+scale*height*(1+.005*cos(2*a)),z+r*sin(a))
            row.append(vert(p,tint(col,1+.016*sin(3*a)+.012*cos(5*a+k))))
        if rows:
            for j in range(sides): quad(rows[-1][j-1],row[j-1],row[j],rows[-1][j])
        rows.append(row)
    surface(previous_surface)
pot=[(.01,0),(.21,0),(.27,.06),(.38,.26),(.42,.53),(.40,.67),(.34,.77),(.32,.79),(.31,.81),(.26,.86),(.19,.9),(.17,.98),(.21,.99),(.22,1.03),(.19,1.055),(.155,1.03),(.145,.96),(.19,.85),(.28,.70),(.02,.61)]
bowl=[(.01,0),(.22,.02),(.25,.07),(.44,.22),(.5,.32),(.5,.35),(.45,.36),(.42,.28),(.22,.11),(.01,.10)]
def make_ground():
    # A low, worn earthen threshold defines one tile, with soft irregular edges.
    surface('ground')
    # Thin, irregular apron of packed earth. Its perimeter feathers into the site.
    rings=[]
    rings_total,segments=(6,56) if city else (18,112)
    for ring in range(1,rings_total+1):
        row=[]
        for i in range(segments):
            a=2*pi*i/segments; dx,dz=cos(a),sin(a)
            edge=(abs(dx)**7+abs(dz)**7)**(-1/7)
            uneven=.975+.021*sin(7*a+.6)+.017*cos(19*a)+.009*sin(29*a)
            x=2.48*dx*edge*uneven*ring/rings_total; z=2.49*dz*edge*uneven*ring/rings_total
            top=.047*(1-(ring/rings_total)**8)+.006*sin(5*x+sin(4*z))+.003*cos(11*z)
            p=(x,top,z)
            row.append(vert(p,tint((169,150,125),.98+.045*sin(3*x+cos(4*z))+.018*rng.random())))
        if rings:
            for j in range(len(row)):quad(row[j-1],rings[-1][j-1],rings[-1][j],row[j])
        else:
            center=vert((0,.045,0),(168,150,125))
            for j in range(len(row)):face(center,row[j],row[j-1])
        rings.append(row)
    surface('earth')
def export(out,name):
    # Single rough, vertex-painted material keeps batching simple.
    surface_ranges[-1][1]=len(indices)
    used=sorted(set(indices))
    remap={old:new for new,old in enumerate(used)}
    out_positions=[positions[i] for i in used]
    out_colors=[colors[i] for i in used]
    out_normals=[unit(normals[i]) for i in used]
    out_indices=[remap[i] for i in indices]
    blob=bytearray();views=[];accessors=[]
    def accessor(seq,fmt,kind,component,target,bounds=False):
        while len(blob)%4:blob.append(0)
        start=len(blob);pack=struct.Struct('<'+fmt).pack
        for item in seq:blob.extend(pack(*item))
        views.append(dict(buffer=0,byteOffset=start,byteLength=len(blob)-start,target=target))
        a=dict(bufferView=len(views)-1,componentType=component,count=len(seq),type=kind)
        if bounds:a.update(min=list(map(min,zip(*seq))),max=list(map(max,zip(*seq))))
        accessors.append(a);return len(accessors)-1
    attrs={k:accessor(data,'3f','VEC3',5126,34962,k=='POSITION') for k,data in [('POSITION',out_positions),('NORMAL',out_normals),('COLOR_0',out_colors)]}
    idx=accessor([(i,) for i in out_indices],'I','SCALAR',5125,34963)
    gltf=dict(asset=dict(version='2.0',generator='New Babylon courtyard house study'),scene=0,scenes=[dict(nodes=[0])],nodes=[dict(name=name,mesh=0)],meshes=[dict(extras=dict(surfaceIndexRanges=surface_ranges),primitives=[dict(attributes=attrs,indices=idx,material=0)])],materials=[dict(name='Earth, reed and slip',doubleSided=True,pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=1))],buffers=[dict(byteLength=len(blob))],bufferViews=views,accessors=accessors)
    data=json.dumps(gltf,separators=(',',':')).encode();data+=b' '*(-len(data)%4)
    out.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(data)+len(blob))+struct.pack('<I4s',len(data),b'JSON')+data+struct.pack('<I4s',len(blob),b'BIN\0')+blob)
    print(out,len(out_positions),'vertices',len(indices)//3,'triangles')
