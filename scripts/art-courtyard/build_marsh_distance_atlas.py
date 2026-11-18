"""Orthographic base-colour silhouettes baked from the original floodplain GLBs."""
from io import BytesIO
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

ROOT=Path(__file__).resolve().parents[2]
SRC=ROOT/'assets/art-courtyard/models'
OUT=ROOT/'assets/3d/textures/floodplain-botany-distant.webp'
# Physical dimensions of each padded tile, also used by the distant geometry.
SPECIES=[('marsh-plumed-cane',1.56,2.86),('marsh-cattail',1.40,1.67),
         ('marsh-clubrush',.87,.59),('alluvial-awn-grass',.84,.64)]
TILE=256


def read(name):
    data=(SRC/(name+'.glb')).read_bytes()
    size=struct.unpack_from('<I',data,12)[0]
    g=json.loads(data[20:20+size])
    blob=data[28+size:]
    def view(i):
        v=g['bufferViews'][i]
        a=v.get('byteOffset',0)
        return blob[a:a+v['byteLength']]
    def accessor(i):
        a=g['accessors'][i]
        return np.frombuffer(view(a['bufferView']),dtype='<u2' if a['componentType']==5123 else '<f4')
    primitive=g['meshes'][0]['primitives'][0]
    pos=accessor(primitive['attributes']['POSITION']).reshape(-1,3)
    uv=accessor(primitive['attributes']['TEXCOORD_0']).reshape(-1,2)
    indices=accessor(primitive['indices']).reshape(-1,3)
    bitmap=np.asarray(Image.open(BytesIO(view(g['images'][0]['bufferView']))).convert('RGBA'))
    return pos,uv,indices,bitmap


def render(model, width, height, direction):
    pos,uv,tris,albedo=model
    x,y,z=pos.T
    if direction==0:
        ax,ay,depth=x/width+.5,1-y/height,z
    elif direction==1:
        ax,ay,depth=z/width+.5,1-y/height,-x
    else:
        ax,ay,depth=x/width+.5,z/width+.5,y
    xy=np.stack((ax,ay),axis=-1)*(TILE-5)+2
    zbuf=np.full((TILE,TILE),-1e10)
    result=np.zeros((TILE,TILE,4),np.uint8)
    for tri in tris:
        a,b,c=xy[tri]
        min_x,min_y=np.maximum(0,np.floor(np.min([a,b,c],axis=0))).astype(int)
        max_x,max_y=np.minimum(TILE-1,np.ceil(np.max([a,b,c],axis=0))).astype(int)
        if max_x<min_x or max_y<min_y:continue
        det=(b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
        if abs(det)<.001:continue
        gy,gx=np.mgrid[min_y:max_y+1,min_x:max_x+1]
        wa=((b[1]-c[1])*(gx+.5-c[0])+(c[0]-b[0])*(gy+.5-c[1]))/det
        wb=((c[1]-a[1])*(gx+.5-c[0])+(a[0]-c[0])*(gy+.5-c[1]))/det
        wc=1-wa-wb
        z=wa*depth[tri[0]]+wb*depth[tri[1]]+wc*depth[tri[2]]
        du=wa*uv[tri[0],0]+wb*uv[tri[1],0]+wc*uv[tri[2],0]
        dv=wa*uv[tri[0],1]+wb*uv[tri[1],1]+wc*uv[tri[2],1]
        texel=albedo[np.clip((dv*albedo.shape[0]).astype(int),0,albedo.shape[0]-1),
                     np.clip((du*albedo.shape[1]).astype(int),0,albedo.shape[1]-1)]
        sl=np.s_[min_y:max_y+1,min_x:max_x+1]
        use=(wa>=0)&(wb>=0)&(wc>=0)&(z>zbuf[sl])&(texel[:,:,3]>62)
        # Preserve albedo; soft basal occlusion gives the shared cards depth at distance.
        shading=.82+.18*np.clip((wa*y[tri[0]]+wb*y[tri[1]]+wc*y[tri[2]])/height,0,1)
        pixels=texel.copy();pixels[:,:,:3]=(pixels[:,:,:3]*shading[:,:,None]).astype('u1')
        zbuf[sl][use]=z[use]
        result[sl][use]=pixels[use]
    return Image.fromarray(result)


if __name__=='__main__':
    atlas=Image.new('RGBA',(TILE*4,TILE*4))
    for col,(name,width,height) in enumerate(SPECIES):
        model=read(name)
        for row in range(3):
            atlas.paste(render(model,width,height,row),(col*TILE,row*TILE))
    atlas.save(OUT,format='WEBP',lossless=True,method=6,exact=True)
