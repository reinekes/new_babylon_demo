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


def lay_bricks(color, relief, source, fines):
    """Stagger hand-moulded courses with a chipped lip and silt-filled joint."""
    columns, rows = 8, 10
    w, h = SIZE/columns, SIZE/rows
    top = Image.new('RGB', (SIZE, SIZE), (110, 91, 72))
    col, height = ImageDraw.Draw(top), ImageDraw.Draw(relief)
    tones = [(182,135,96), (178,131,90), (191,147,106), (181,137,98),
             (174,123,87), (194,149,108), (189,140,96), (175,132,96)]
    for j in range(-1, rows+1):
        for i in range(-1, columns+1):
            variation = random.Random(3109 + i % columns + (j % rows)*columns)
            x, y = (i+.5*(j%2))*w, j*h
            inset = variation.uniform(1.4, 2.2)
            a,b,c,d = x+inset,y+inset,x+w-inset,y+h-inset
            cut = [variation.uniform(1.4, 5.0) for _ in range(8)]
            if variation.random()<.16:cut[0]+=6
            face = [(a+cut[0],b),(c-cut[1],b+variation.uniform(-.8,.8)),
                    (c,b+cut[2]),(c,d-cut[3]),(c-cut[4],d),
                    (a+cut[5],d),(a,d-cut[6]),(a,b+cut[7])]
            tone = variation.choice(tones)
            col.polygon(face, fill=tone)
            col.line(face[:3], fill=tuple(k+9 for k in tone), width=2)
            col.line(face[3:6], fill=tuple(k-10 for k in tone), width=2)
            height.polygon(face, fill=variation.randint(151,170))
    # The baked clay and the bedding both inherit small-scale grain.
    sediment = ImageChops.add(source.convert('L').point(lambda v:round((v-141)*.40+128)),
                              fines.point(lambda v:round((v-128)*.12+128)), offset=-128)
    color.paste(ImageChops.add(top, Image.merge('RGB',(sediment,)*3), offset=-128))


def scatter_aggregate(fragments, relief, cloud):
    draw = ImageDraw.Draw(fragments), ImageDraw.Draw(relief)
    tones = [(125,111,94), (158,150,128), (192,178,147), (116,108,94),
             (177,165,141), (151,101,73), (178,126,89), (158,111,81)]
    for _ in range(1500):
        x,y = rng.randrange(SIZE),rng.randrange(SIZE)
        if rng.randrange(220)>72+cloud.getpixel((x,y)):continue
        radius = 2+8.5*rng.random()**2.2
        shade = rng.uniform(-10,12)
        tint = tuple(round(v+shade) for v in rng.choice(tones))
        clast(draw, x, y, radius, rng.uniform(.4,.86), tint, round(6+radius*2.3))


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
    if kind=='aggregate':
        scatter_aggregate(fragments, relief, cloud)
    if kind=='paving':
        lay_bricks(fragments, relief, color, flecks)
    # Expose the smaller stones in broken patches, with silt showing through
    # their faces rather than flat, uniformly coloured polygons.
    opacity=ImageChops.add(dust.point(lambda x:round(x*.35+108)),flecks.point(lambda x:round(x*.18)))
    if kind=='paving':
        opacity = dust.point(lambda v:round(218+v*.12))
    elif kind=='aggregate':
        opacity = dust.point(lambda v:round(195+v*.20))
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
