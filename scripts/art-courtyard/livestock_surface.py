"""Baked anatomical coat charts for the alluvial sculpts (NumPy and Pillow).

The bull and pig inherit hair/skin relief from the project's TRELLIS source
assets. Only new files are written. Original UVs, rigs and files stay intact.
The ram's locks are entirely authored. Fine fur, bristles, curls and PBR
response are laid down anew per animal and anatomical region.
"""
from pathlib import Path
import io
import json
import math
import struct

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SIZE=np.array([1536,1024])
# ±X sides, ±Y back and underside, ±Z forehead and rear. Each chart has
# padding and lies strictly inside the unit square, including mipmap gutters.
CHARTS=[(8,8,746,468),(782,8,746,468),(8,490,746,220),(782,490,746,220),
        (8,736,320,280),(345,736,320,280)]
PARTS={'hoof':0,'eye':1,'ear':2,'nose':3,'horn':4,'tail':5}
AXES=[(2,1),(2,1),(2,0),(2,0),(0,1),(0,1)]

def project_uv(position,chart):
    u,v=AXES[chart];origin=np.array(CHARTS[chart][:2]);size=np.array(CHARTS[chart][2:])
    return (origin+4+(size-8)*np.stack((position[:,u],1-position[:,v]),axis=1))/SIZE

def part_uv(part,t,angle):
    offset=PARTS[part]*132+688
    return [(offset+4+118*t)/SIZE[0],(761+115*(.5+.5*math.cos(angle)))/SIZE[1]]

def assign_charts(animal,vertices,faces,colors,joints,weights,normals):
    # Project each triangle to its most face-on chart. This removes polar
    # stretching around the forehead, hindquarters and lower legs.
    tri=vertices[faces];fn=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);axis=np.argmax(abs(fn)*[1.20,1,1],axis=1)
    groups=axis*2+(fn[np.arange(len(fn)),axis]<0)
    pmin=vertices.min(axis=0);pmax=vertices.max(axis=0)
    normalized=(vertices-pmin)/(pmax-pmin)
    animal.chart_geometry=(vertices,faces,normals,groups)
    animal.body_normals=[]
    animal.bounds=(pmin,pmax)
    for chart in range(6):
        f=faces[groups==chart]
        ids,inverse=np.unique(f,return_inverse=True)
        animal.body_normals.append(normals[ids])
        animal.add(vertices[ids],inverse.reshape(-1,3),colors[ids],joints[ids],weights[ids],project_uv(normalized[ids],chart))

def read_reference(path):
    data=path.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length]);blob=data[28+length:]
    def accessor(i):
        a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']]
        size={'SCALAR':1,'VEC2':2,'VEC3':3}[a['type']]
        dtype=np.dtype({5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']])
        return np.ndarray((a['count'],size),dtype=dtype,buffer=blob,
            offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',dtype.itemsize*size),dtype.itemsize))
    p=doc['meshes'][0]['primitives'][0];attrs=p['attributes'];mat=doc['materials'][p['material']]
    t=doc['textures'][mat['pbrMetallicRoughness']['baseColorTexture']['index']]
    source=t['source'] if 'source' in t else t['extensions']['EXT_texture_webp']['source']
    v=doc['bufferViews'][doc['images'][source]['bufferView']];start=v.get('byteOffset',0)
    texture=np.asarray(Image.open(io.BytesIO(blob[start:start+v['byteLength']])).convert('L'))/255
    return accessor(attrs['POSITION']),accessor(attrs['NORMAL']),accessor(attrs['TEXCOORD_0']),accessor(p['indices']).reshape(-1,3),texture,doc['asset']['extras']

def register_side(ref,side,w,h):
    vertices,_,uv,faces,albedo,_=ref
    unit=(vertices-vertices.min(axis=0))/(vertices.max(axis=0)-vertices.min(axis=0))
    xy=np.column_stack((unit[:,2]*(w-3)+1,(1-unit[:,1])*(h-3)+1))
    image=np.full((h,w),.5);depth=np.full((h,w),-4.)
    for f in faces:
        tri=xy[f];mn=np.maximum(tri.min(axis=0).astype(int),0);mx=np.minimum(np.ceil(tri.max(axis=0)).astype(int),[w-1,h-1])
        x,y=np.meshgrid(np.arange(mn[0],mx[0]+1),np.arange(mn[1],mx[1]+1))
        u,v=tri[1:]-tri[0];det=u[0]*v[1]-u[1]*v[0]
        if abs(det)<1e-6:continue
        a=((x-tri[0,0])*v[1]-(y-tri[0,1])*v[0])/det
        b=(u[0]*(y-tri[0,1])-u[1]*(x-tri[0,0]))/det
        weights=np.stack((1-a-b,a,b),axis=-1);z=weights@(side*unit[f,0])
        hit=(np.min(weights,axis=-1)>=0)&(z>depth[y,x])
        yy,xx=y[hit],x[hit];depth[yy,xx]=z[hit]
        bary=weights[hit];st=(bary@uv[f])%1
        color=albedo[(st[:,1]*(albedo.shape[0]-1)).astype(int),(st[:,0]*(albedo.shape[1]-1)).astype(int)]
        image[yy,xx]=np.log(.14+color)
    # Use a neutral medium or the closest vertically registered flank sample at
    # the edge. Never transfer the silhouette of the donor or a second eye.
    mask=depth>-4
    for x in range(w):
        ys=np.flatnonzero(mask[:,x])
        if len(ys):
            image[:,x]=np.interp(np.arange(h),ys,image[ys,x])
            depth[:,x]=np.interp(np.arange(h),ys,depth[ys,x])
    empty=np.flatnonzero(~mask.any(axis=0))
    good=np.flatnonzero(mask.any(axis=0))
    for x in empty:
        nearest=good[np.argmin(abs(good-x))]
        image[:,x]=image[:,nearest];depth[:,x]=depth[:,nearest]
    encoded=Image.fromarray(np.uint8(np.clip(.59+image*.30,0,1)*255))
    blurred=lambda r:np.asarray(encoded.filter(ImageFilter.GaussianBlur(r)),dtype=float)/255
    mid=blurred(3);broad=blurred(19);gross=blurred(69)
    texture=(np.asarray(encoded)/255-mid)*4.0+(mid-broad)*4.8+(broad-gross)*2.6
    # Some donor GLB triangle normals are discontinuous even where both sides
    # lie on the same smooth flank. Use depth at two physical scales for
    # anatomical relief so those tangent-space boundaries are never copied.
    z=(depth-depth.min())/max(.001,depth.max()-depth.min())
    curvature=(blur(z,3)-blur(z,14))*1.9
    return np.clip(texture+curvature,-.31,.25)

def blur(a,r):
    return np.asarray(Image.fromarray(np.uint8(np.clip(a,0,1)*255)).filter(ImageFilter.GaussianBlur(r)),dtype=float)/255

def coat_panel(kind,chart,w,h,rng,source=None):
    # Each cluster contains a handful of co-oriented fibres. Around the
    # wrist the hair lies down; over the loin it lies back; the cheek and
    # forehead interrupt this grain. Long pig bristles form small tufts.
    size=np.array([w,h]); yy,xx=np.mgrid[:h,:w];u=xx/w;v=yy/h
    base=Image.new('L',(w,h),132);strokes=ImageDraw.Draw(base)
    wool=kind=='ram'
    for j in range(int(w*h/(20 if wool else 17))):
        x,y=rng.integers([0,0],size)
        a,b=(x/w,y/h)
        if chart<2:
            if b>.69: angle=1.50+.19*math.sin(11*a)
            elif a>.78: angle=-.12+.93*math.sin((b-.32)*6)
            else:angle=2.67-.94*math.exp(-((a-.66)/.12)**2)+.55*math.cos(8*a+3*b)
        elif chart<4:
            angle=3.05+.62*math.sin((b-.5)*3.5)+.42*math.sin(a*6)
        else:angle=1.58+1.1*math.sin((a-.5)*3.7)
        angle+=rng.normal(0,.16)
        length=rng.uniform(5,15)*(1.38 if kind=='pig' else 1)
        if chart<2 and a>.8:length*=.68
        if chart>=4:length*=.67
        for k in range(4 if wool else 3):
            sx=x+rng.normal(0,2.3);sy=y+rng.normal(0,2.2);bend=angle+rng.normal(0,.18);scale=rng.uniform(.65,1.25)
            color=int(np.clip(rng.normal(133,45),29,238))
            if wool:
                r=length*.37*scale;deg=math.degrees(bend)
                strokes.arc((sx-r,sy-r*.68,sx+r,sy+r*.68),deg,deg+205,fill=color,width=1 if k else 2)
            else:
                end=(sx+math.cos(bend)*length*scale,sy+math.sin(bend)*length*scale)
                middle=(sx+math.cos(bend-.12)*length*.55,sy+math.sin(bend-.12)*length*.55)
                strokes.line([(sx,sy),middle,end],fill=color,width=1 if k else 2)
    hairs=np.asarray(base,dtype=float)/255
    # Weak irregular pigmentation between groups of fibres persists below the
    # resolution of single hairs at ordinary city zoom.
    grid=rng.normal(128,31,(max(3,h//13),max(3,w//13))).clip(0,255).astype('u1')
    mottling=np.asarray(Image.fromarray(grid).resize((w,h),Image.Resampling.BICUBIC))/255-.5
    if source is None:registered=np.zeros((h,w))
    else:
        # The two sculpts have slightly different proportions. Fit the spine,
        # croup, brisket and brow in the donor side view to the new landmarks.
        along=np.interp(u,[0,.13,.36,.64,.80,.915,1],[.03,.19,.37,.69,.835,.93,.998])
        height=np.clip(v+(.014 if kind=='bull' else -.026)+.026*np.cos(7*u),0,.993)
        registered=source[(height*(h-1)).astype(int),(along*(w-1)).astype(int)]
        # Avoid pasting any donor eye or nose outline onto the authored head.
        registered*=np.clip((.965-u)*14,.16,1)*np.clip((.94-v)*11,.25,1)
    # Anatomical secondary folds extend down the dewlap/jowl. Gradients enter
    # the normal map independently of coat pigmentation.
    if chart<2:
        neck=np.exp(-((u-(.73 if kind=='bull' else .77))/.12)**2-((v-.38)/.18)**2)
        folds=neck*np.sin((u+.31*v)*105+1.55*np.sin(v*11))
        pilosity=(.64+.36*(1-np.clip((u-.75)*4,0,1)))
    else:
        folds=.06*np.sin(u*30+v*9);pilosity=1
    fibres=(hairs-.52)*pilosity
    value=np.clip(.85+.44*fibres+.27*mottling+.91*registered+.026*folds,.40,1)
    relief=.52+.64*fibres+.13*mottling+.40*registered+.075*folds
    gx=(np.roll(relief,-1,axis=1)-np.roll(relief,1,axis=1))*.90
    gy=(np.roll(relief,-1,axis=0)-np.roll(relief,1,axis=0))*.90
    norm=np.stack((-gx,-gy,np.ones((h,w))),axis=2);norm/=np.linalg.norm(norm,axis=2,keepdims=True)
    tint=np.clip(.85*registered+mottling*.30,-.25,.2)
    color=np.clip(value[:,:,None]*(1+tint[:,:,None]*[.19,.04,-.13]),0,1)
    rough=np.clip((.87 if wool else .76 if kind=='pig' else .80)+.18*fibres+mottling*.16+registered*.13,.52,.97)
    cavity=np.clip(.977+.12*np.minimum(registered,0)+.1*np.minimum(fibres,0),.85,1)
    orm=np.stack((cavity,rough,np.zeros_like(rough)),axis=2)
    return color,norm*.5+.5,orm

def remap_transitions(animal, panels):
    """Evaluate one continuous triplanar hair field on the actual skin.

    Vertex normals select smooth projection weights. Baking the result back
    into each chart avoids visible polygon boundaries on the cheek and croup.
    The game still samples just one set of three conventional PBR maps.
    """
    verts,faces,normals,groups=animal.chart_geometry
    lo,hi=animal.bounds;positions=(verts-lo)/(hi-lo)
    output=[]
    for chart,(ox,oy,w,h) in enumerate(CHARTS):
        axis=chart//2;sign=1 if chart%2==0 else -1
        xy=project_uv(positions,chart)*SIZE-[ox,oy]
        depth=np.full((h,w),-2.);points=np.zeros((h,w,3));directions=np.zeros_like(points)
        for tri in faces[groups==chart]:
            local=xy[tri];mn=np.maximum(local.min(axis=0).astype(int)-1,0);mx=np.minimum(np.ceil(local.max(axis=0)).astype(int)+1,[w-1,h-1])
            x,y=np.meshgrid(np.arange(mn[0],mx[0]+1),np.arange(mn[1],mx[1]+1))
            u,v=local[1:]-local[0];det=u[0]*v[1]-u[1]*v[0]
            if abs(det)<1e-7:continue
            a=((x-local[0,0])*v[1]-(y-local[0,1])*v[0])/det
            b=(u[0]*(y-local[0,1])-u[1]*(x-local[0,0]))/det
            coeff=np.stack((1-a-b,a,b),axis=2)
            d=coeff@(sign*positions[tri,axis])
            active=(coeff.min(axis=2)>=-.08)&(d>depth[y,x])
            yy,xx=y[active],x[active];depth[yy,xx]=d[active]
            points[yy,xx]=coeff[active]@positions[tri];directions[yy,xx]=coeff[active]@normals[tri]
        valid=depth>-2
        # Four-pixel padding carries the same values through bilinear filtering
        # and the first mip levels on narrow limbs and folded regions.
        for _ in range(4):
            previous=valid.copy()
            for dy,dx in [(-1,0),(1,0),(0,-1),(0,1)]:
                neighbour=np.roll(previous,(dy,dx),(0,1));take=neighbour&~valid
                points[take]=np.roll(points,(dy,dx),(0,1))[take]
                directions[take]=np.roll(directions,(dy,dx),(0,1))[take];valid|=take
        point=points[valid];normal=directions[valid];weights=abs(normal)**2.25
        weights/=np.maximum(1e-8,weights.sum(axis=1,keepdims=True))
        c=np.zeros((len(point),3));grad=np.zeros_like(c);orm=np.zeros_like(c)
        for donor,(dx,dy,dw,dh) in enumerate(CHARTS):
            component=donor//2
            use=(normal[:,component]<0)==bool(donor%2)
            st=project_uv(point[use],donor)*SIZE-[dx,dy]
            px=np.clip(np.rint(st[:,0]).astype(int),0,dw-1)
            py=np.clip(np.rint(st[:,1]).astype(int),0,dh-1)
            strength=weights[use,component,None]
            pigment,bump,rough=panels[donor]
            c[use]+=strength*pigment[py,px];orm[use]+=strength*rough[py,px]
            dab=(bump[py,px]*2-1)[:,:2]
            u,v=AXES[donor]
            grad[use,u]+=strength[:,0]*dab[:,0];grad[use,v]-=strength[:,0]*dab[:,1]
        tx,ty=AXES[chart];n=np.column_stack((grad[:,tx],-grad[:,ty],np.ones(len(point))))
        n/=np.linalg.norm(n,axis=1,keepdims=True)
        imgs=[a.copy() for a in panels[chart]]
        for image,values in zip(imgs,[c,n*.5+.5,orm]):image[valid]=np.clip(values,0,1)
        output.append(imgs)
    return output

def bake(animal,model_dir):
    kind=animal.kind
    source=read_reference(model_dir/f'test-{kind}-trellis.glb') if kind in ['bull','pig'] else None
    atlases=[Image.new('RGB',tuple(SIZE),c) for c in [(215,215,215),(128,128,255),(252,215,0)]]
    rng=np.random.default_rng({'bull':310,'pig':920,'ram':142}[kind])
    panels=[]
    for i,(x,y,w,h) in enumerate(CHARTS):
        photo=register_side(source,1 if i==0 else -1,w,h) if source and i<2 else None
        panels.append(coat_panel(kind,i,w,h,rng,photo))
    for (x,y,w,h),maps in zip(CHARTS,remap_transitions(animal,panels)):
        for im,values in zip(atlases,maps):
            im.paste(Image.fromarray(np.uint8(values*255)),(x,y))
    for name,index in PARTS.items():
        x=688+index*132; y=746;n=132
        yy,xx=np.mgrid[:n,:n];noise=rng.normal(0,1,(n,n));v=.94+.015*noise
        roughness={'eye':.24,'nose':.42,'hoof':.60,'horn':.58,'tail':.83,'ear':.72}[name]
        bump=noise*.035
        if name=='nose':
            pores=Image.new('L',(n,n),184);dr=ImageDraw.Draw(pores)
            for j in range(660):
                a,b=rng.integers(0,n,2);r=rng.uniform(.6,1.7);dr.ellipse((a-r,b-r,a+r,b+r),fill=int(rng.uniform(63,155)))
            porosity=np.asarray(pores.filter(ImageFilter.GaussianBlur(.44)))/255-.66
            v+=.56*porosity;bump+=.56*porosity
        if name=='ear':
            vessels=Image.new('L',(n,n));strokes=ImageDraw.Draw(vessels)
            for j in range(9):
                a,b=rng.uniform(4,27),rng.uniform(7,n-7)
                end=b+rng.normal(0,15)
                for k in range(2):
                    mid=(a+rng.uniform(32,54),(b+end)*.5+rng.uniform(-3,3))
                    strokes.line([(a,b),mid,(rng.uniform(95,125),end+rng.normal(0,8))],fill=110,width=1)
            vein=np.asarray(vessels.filter(ImageFilter.GaussianBlur(.65)))/255
            v-=.11*vein;bump+=.08*vein
        if name in ('hoof','horn'):
            layer=.50*np.cos(xx*.60+.8*np.sin(yy*.07))+.5*np.cos(xx*.22+yy*.046)
            bump+=.12*layer;v+=.068*layer
        dx,dy=np.gradient(bump)
        norm=np.stack((-dy,-dx,np.ones_like(dx)),axis=-1);norm/=np.linalg.norm(norm,axis=-1,keepdims=True)
        val=np.clip(v,.45,1);rough=np.clip(roughness+.03*noise,.17,1)
        maps=[np.stack((val,val,val),axis=2),norm*.5+.5,np.stack((np.ones_like(v),rough,np.zeros_like(v)),axis=-1)]
        for im,values in zip(atlases,maps):im.paste(Image.fromarray(np.uint8(values*255)),(x,y))
    result=[]
    for i,img in enumerate(atlases):
        buffer=io.BytesIO();img.save(buffer,'JPEG',quality=[90,87,83][i],subsampling=0,optimize=True);result.append(buffer.getvalue())
    return result,source[-1] if source else None
