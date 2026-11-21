"""Bake seamless Sumerian street finishes from the game's floodplain silt."""
from math import cos, pi, sin
from pathlib import Path
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[2] / 'assets/3d/textures'
SIZE = 512
rng = random.Random(17613)


def noise_grid(cells):
    """An overscanned periodic grid, so even the large patches cross the tile seam."""
    points = [rng.randrange(256) for _ in range(cells * cells)]
    grid = Image.new('L', (cells + 4, cells + 4))
    grid.putdata([points[((y - 2) % cells) * cells + (x - 2) % cells]
                  for y in range(cells + 4) for x in range(cells + 4)])
    return grid.resize((SIZE, SIZE), Image.Resampling.BICUBIC, (2, 2, cells + 2, cells + 2))


def clast(draws, x, y, radius, elongation, tint, rise):
    """A partly embedded chip. Paint bleed into the opposite side of the tile."""
    angle = rng.uniform(0, 2*pi)
    corners = rng.randrange(5, 9)
    shape = []
    for i in range(corners):
        u = (i + rng.uniform(-.18, .18)) * 2*pi / corners
        r = radius * rng.uniform(.78, 1.13)
        xx, yy = r*cos(u), r*sin(u)*elongation
        shape.append((xx*cos(angle) - yy*sin(angle), xx*sin(angle) + yy*cos(angle)))
    for dx in (0, -SIZE, SIZE):
        for dy in (0, -SIZE, SIZE):
            cx, cy = x+dx, y+dy
            if cx+radius*1.2<0 or cy+radius*1.2<0 or cx-radius*1.2>SIZE or cy-radius*1.2>SIZE:
                continue
            shell = [(cx+xx, cy+yy) for xx, yy in shape]
            draws[0].polygon(shell, fill=tint)
            draws[1].polygon(shell, fill=128+rise)


def lay_stones(color, relief, source):
    """Cut irregular flagstones at the halfway line between their neighbours."""
    cols, rows = 14, 16
    offsets = [(rng.uniform(-.35,.35), rng.uniform(-.35,.35)) for _ in range(cols*rows)]
    def site(i,j):
        dx,dy = offsets[(j%rows)*cols+i%cols]
        return ((i+.5+dx)*SIZE/cols, (j+.5+dy)*SIZE/rows)
    draw, height = ImageDraw.Draw(color), ImageDraw.Draw(relief)
    for j in range(-1,rows+1):
        for i in range(-1,cols+1):
            x,y = site(i,j)
            # Use the same stone on either side of a repetition seam.
            variation = random.Random(1979+(i%cols)+(j%rows)*cols)
            if variation.random()<.13:continue
            outline = [(x-65,y-65),(x+65,y-65),(x+65,y+65),(x-65,y+65)]
            for dj in range(-2,3):
                for di in range(-2,3):
                    if di==0 and dj==0:continue
                    xx,yy=site(i+di,j+dj)
                    nx,ny=xx-x,yy-y
                    limit=nx*(x+xx)*.5+ny*(y+yy)*.5
                    clipped=[]
                    for a,b in zip(outline,outline[1:]+outline[:1]):
                        da=nx*a[0]+ny*a[1]-limit
                        db=nx*b[0]+ny*b[1]-limit
                        if da<=0:clipped.append(a)
                        if (da>0)!=(db>0):
                            t=da/(da-db)
                            clipped.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
                    outline=clipped
            inset=variation.uniform(.72,.91)
            # Worn corners are chipped off each angular slab.
            face=[]
            for n,(ax,ay) in enumerate(outline):
                for neighbour in (outline[n-1],outline[(n+1)%len(outline)]):
                    t=variation.uniform(.04,.16)
                    face.append((x+(ax+(neighbour[0]-ax)*t-x)*inset,y+(ay+(neighbour[1]-ay)*t-y)*inset))
            source_color=source.getpixel((round(x)%SIZE,round(y)%SIZE))
            delta=variation.uniform(-9,17)
            draw.polygon(face,fill=tuple(round(c+delta+d) for c,d in zip(source_color,(3,6,8))))
            height.polygon(face,fill=variation.randint(141,155))


def render(kind):
    base = Image.open(ROOT / 'floodplain-alluvium_color.webp').convert('RGB').resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    cracked = Image.open(ROOT / 'dry_ground_01_color.jpg').convert('L').resize((SIZE, SIZE), Image.Resampling.LANCZOS)
    cloud, dust, flecks = noise_grid(5), noise_grid(23), noise_grid(129)
    params = {'silt': ((7, 8, 9), 75, 1, 2.3),
              'aggregate': ((5, 3, 2), 1250, 1, 5.0),
              'paving': ((4, 5, 4), 620, 2.2, 8.5)}
    warmth, count, small, large = params[kind]
    color = Image.new('RGB', (SIZE, SIZE))
    pixels = []
    for (r,g,b), patch, fines, grit, crust in zip(base.getdata(), cloud.getdata(), dust.getdata(), flecks.getdata(), cracked.getdata()):
        pressure = (patch-128)*.043+(fines-128)*.042+(grit-128)*.033
        # Only small islands of less worn clay retain dry fissures.
        pressure += (crust-124)*max(0, (patch-115)/210)*.32
        if kind=='silt':
            # Loose sun-dried fines survive in flecks a few centimetres across.
            # The packed substrate remains visible over most of the tile.
            pressure += max(0,(grit-174)*.48)*max(0,min(1,(fines-103)/38))
        pixels.append((round(r+warmth[0]+pressure),round(g+warmth[1]+pressure),round(b+warmth[2]+pressure)))
    color.putdata(pixels)
    fragments = color.copy()
    relief = Image.new('L', (SIZE, SIZE), 128)
    draw = ImageDraw.Draw(fragments), ImageDraw.Draw(relief)
    for _ in range(count):
        x, y = rng.randrange(SIZE), rng.randrange(SIZE)
        if rng.randrange(210)>45+cloud.getpixel((x,y)):continue
        radius = rng.uniform(small,large)**.97
        delta = rng.choice([-15,-10,-7,5,9,13,16,21])
        red = rng.randrange(4)==0 and kind=='aggregate'
        tint = tuple(min(245,max(0,v+delta+extra)) for v,extra in zip(color.getpixel((x,y)),(9,-2,-7) if red else (-1,1,3)))
        clast(draw,x,y,radius,rng.uniform(.38,.85),tint,round(radius*1.5))
    if kind=='paving':
        lay_stones(fragments,relief,color)
    # Expose the smaller stones in broken patches, with silt showing through
    # their faces rather than flat, uniformly coloured polygons.
    opacity=ImageChops.add(dust.point(lambda x:round(x*.35+108)),flecks.point(lambda x:round(x*.18)))
    color=Image.composite(fragments,color,opacity)
    fine=ImageChops.add(flecks.point(lambda x:round(x*.12)),dust.point(lambda x:round(x*.06)))
    relief=ImageChops.add(relief.filter(ImageFilter.GaussianBlur(.68)),fine)
    dx=ImageChops.subtract(ImageChops.offset(relief,1,0),ImageChops.offset(relief,-1,0),.28,128)
    dy=ImageChops.subtract(ImageChops.offset(relief,0,1),ImageChops.offset(relief,0,-1),.28,128)
    normal=Image.merge('RGB',(dx,dy,Image.new('L',(SIZE,SIZE),250)))
    color.save(ROOT/f'street-{kind}-color.webp',quality=92,method=6)
    normal.save(ROOT/f'street-{kind}-normal.webp',quality=88,method=6)


if __name__ == '__main__':
    for surface in ('silt','aggregate','paving'):
        render(surface)
