"""Bake tileable colour and relief for dry alluvium and rippled river silt."""
from pathlib import Path

import numpy as np
from PIL import Image

SIZE=1024
OUTPUT=Path(__file__).resolve().parents[2]/'assets/3d/textures'
rng=np.random.default_rng(28109)
y,x=np.mgrid[0:SIZE,0:SIZE].astype('f4')
fx,fy=np.meshgrid(np.fft.rfftfreq(SIZE),np.fft.fftfreq(SIZE))


def noise(sigma_x,sigma_y=None):
    """Wrapped Gaussian noise at a physical feature size in texels."""
    if sigma_y is None:sigma_y=sigma_x
    kernel=np.exp(-2*np.pi**2*((fx*sigma_x)**2+(fy*sigma_y)**2))
    out=np.fft.irfft2(np.fft.rfft2(rng.normal(size=x.shape))*kernel,s=x.shape)
    return out/max(out.std(),1e-6)


def baking_cracks():
    cells=11
    wx=x/SIZE*cells+.15*noise(28)+.026*noise(7)
    wy=y/SIZE*cells+.12*noise(31)+.024*noise(7)
    ix,iy=np.floor(wx).astype('i4'),np.floor(wy).astype('i4')
    offset=rng.uniform(.16,.84,(cells,cells,2))
    nearest=np.full(x.shape,99.)
    runner=nearest.copy()
    for dx in (-1,0,1):
        for dy in (-1,0,1):
            sx,sy=ix+dx,iy+dy
            jitter=offset[sy%cells,sx%cells]
            d=np.hypot(wx-sx-jitter[:,:,0],wy-sy-jitter[:,:,1])
            runner=np.minimum(runner,np.maximum(nearest,d));nearest=np.minimum(nearest,d)
    gaps=runner-nearest
    return np.exp(-(gaps/.038)**1.35),np.exp(-(gaps/.13)**1.65)


def normal_map(relief,gain):
    # Tangent-space OpenGL normal. Central differences wrap at tile boundaries.
    dx=(np.roll(relief,-1,axis=1)-np.roll(relief,1,axis=1))*gain
    dy=(np.roll(relief,1,axis=0)-np.roll(relief,-1,axis=0))*gain
    normals=np.stack((-dx,-dy,np.ones_like(relief)),axis=-1)
    normals/=np.linalg.norm(normals,axis=-1)[:,:,None]
    return (127.5+127.5*normals).astype('u1')


def bake(kind):
    cloud,clot,grain=noise(40),noise(9),noise(1.9)
    dust=rng.normal(size=x.shape)
    mica=np.clip(grain-1.55,0,1)
    if kind=='floodplain-alluvium':
        line,shoulder=baking_cracks()
        # Desiccation plates survive in patches; adjacent silt drapes and dust
        # obscure most of the network, even at the edges of this repeating tile.
        patch=np.clip(.40+.50*noise(45)+.22*noise(13),0,1)
        grit=np.maximum(0,grain-1.0)
        lift=.37*cloud+.13*clot+.13*grit+.05*dust-patch*(.54*line+.15*shoulder)
        value=6.3*cloud+3.5*clot+3.0*grain+2.4*dust+6.8*mica-patch*(21*line+5*shoulder)
        base=[152,135,111]
        ochre=(.72*cloud+.28*noise(20))[:,:,None]*[3.0,.9,-1.7]
    else:
        # Discontinuous, low asymmetric ripples from shallow water. Periodic
        # warping breaks long parallel stripes. Compact channels retain fine sand.
        warp=noise(27,44)
        phase=2*np.pi*(20*y/SIZE+3*x/SIZE)+1.12*warp+.18*noise(9,13)
        wave=((np.sin(phase)+.31*np.sin(2*phase-.7))*.5+.5)
        patch=np.clip(.48+.31*noise(59)+.2*noise(21,30),0,1)
        wash=noise(27,3)
        lift=.41*wave*patch+.072*wash+.065*grain+.035*dust
        value=4.0*cloud+2.3*clot+1.5*dust+2.8*grain+2.5*wash+14*(wave-.5)*patch+5*mica
        base=[138,130,108]
        ochre=cloud[:,:,None]*[1.7,1.0,-1.6]
    color=np.array(base)+value[:,:,None]*[1,.94,.81]+ochre
    Image.fromarray(np.clip(color,0,255).astype('u1')).save(OUTPUT/(kind+'_color.webp'),quality=92,method=5)
    Image.fromarray(normal_map(lift,1.33)).save(OUTPUT/(kind+'_normal.webp'),quality=95,method=5)


if __name__=='__main__':
    for surface in ('floodplain-alluvium','river-silt'):bake(surface)
