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
        # Compact flood silt has a continuous bed of fines. Most optical
        # contrast is in grains, with occasional exposed hairline fissures.
        # Broad contrast here would repeat across every street in the city.
        patch=np.clip((noise(45)-.38)*.52+.20*noise(13),0,1)
        grit=np.maximum(0,grain-1.0)
        # Isolated fine gravel has a rounded crown with a narrow contact
        # shadow. The cutoffs leave most of the bed as uninterrupted silt.
        pebbles=np.clip((grain-1.95)*1.7,0,1)*np.clip(clot+.27,0,1)
        rim=np.maximum(0,np.roll(pebbles,2,axis=1)-pebbles)
        lift=.084*clot+.094*grain+.074*grit+.009*dust+.15*pebbles-patch*(.23*line+.046*shoulder)
        value=.83*cloud+1.30*clot+2.65*grain+1.65*dust+4.2*mica+11*pebbles-5*rim-patch*(11*line+2.4*shoulder)
        base=[157,143,121]
        ochre=(.6*cloud+.4*noise(20))[:,:,None]*[.56,.18,-.20]
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


def bake_water_slopes():
    """Encode two periodic ripple slopes and the area sheltered from wind."""
    size = 512
    random = np.random.default_rng(137)
    cycles = np.fft.fftfreq(size) * size
    kx, ky = np.meshgrid(cycles, cycles)

    def wind_band(low, high, across, along, angle):
        c, s = np.cos(angle), np.sin(angle)
        k = np.hypot((kx*c + ky*s)*across, (ky*c - kx*s)*along)
        profile = np.exp(-.5*((k - (high+low)*.5)/((high-low)*.38))**2)
        height = np.fft.fft2(random.normal(size=k.shape)) * profile
        dx = np.fft.ifft2(1j*kx*height).real
        dy = np.fft.ifft2(1j*ky*height).real
        scale = np.sqrt((dx*dx + dy*dy).mean())
        return dx/scale, dy/scale

    broad_x, broad_y = wind_band(2, 13, 1.55, .75, .29)
    fine_x, fine_y = wind_band(6, 32, 1.3, .80, -.36)
    gusts = np.fft.fft2(random.normal(size=kx.shape)) * np.exp(-(kx*kx+ky*ky)/8)
    fetch = np.fft.ifft2(gusts).real
    fetch = (fetch-fetch.mean()) / fetch.std()
    channels = np.stack((.5+(.64*broad_x+.36*fine_x)*.25,
                         .5+(.64*broad_y+.36*fine_y)*.25, .5+fetch*.16), axis=-1)
    pixels = np.uint8(np.clip(channels, 0, 1)*255+.5)
    Image.fromarray(pixels).save(OUTPUT/'alluvial-water-slopes.webp', lossless=True, method=6)


if __name__=='__main__':
    for surface in ('floodplain-alluvium','river-silt'):bake(surface)
    bake_water_slopes()
