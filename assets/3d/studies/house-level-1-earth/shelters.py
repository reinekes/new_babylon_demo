"""Create the reed shelter and the founding hut with the courtyard house materials."""
import argparse
from math import atan2, cos, pi, sin
from pathlib import Path
from earth_geometry import (bowl, clay, export, face, jar, make_ground, plaster, pole,
                            pot, quad, rng, slab, straw, surface, tint, vert, wood)


def woven_panel(points, width, count):
    """Split cane follows a sequence of support rails; slight irregularity breaks the fringe."""
    surface('reed')
    for i in range(count):
        x = (i / (count - 1) - .5) * width
        shade = tint(straw, rng.uniform(.79, 1.08))
        last = None
        for j, (y, z) in enumerate(points):
            end = rng.uniform(-.06, .06) if j == len(points) - 1 else 0
            v = (x + .009 * sin(j + i * .41), y - .025 * cos(x * 2) + .006 * sin(i),
                 z + end)
            if last:
                pole(last, v, width / count * .51, shade, 4, .96)
            last = v


def starter():
    make_ground()
    layers = [(0, 1.57), (.12, 1.64), (.24, 1.64), (.46, 1.61), (.69, 1.58),
              (.92, 1.53), (1.16, 1.46), (1.38, 1.38), (1.61, 1.27),
              (1.83, 1.14), (2.05, 1.01), (2.25, .86), (2.43, .67), (2.59, .49),
              (2.69, .28), (2.73, .055)]
    seg = 64
    prev = []
    for row, (h, r) in enumerate(layers):
        cur = []
        for i in range(seg):
            a = i * 2 * pi / seg
            radial = r * (1 + .012 * cos(a * 5 + h) + .007 * sin(a * 9 + h * 2))
            rise = h + .026 * sin(3 * a + h) * min(1, h)
            shade = 1 + .028 * sin(3*a + h*5) - .17 * max(0, 1-h/.63)
            cur.append(vert((sin(a)*radial, rise, cos(a)*radial-.51),
                            tint(plaster, shade + rng.uniform(-.015, .015))))
        if prev:
            for i in range(seg):
                a = (i+.5)*2*pi/seg
                if min(a,2*pi-a) < (.36 if h<.93 else .27 if h<1.16 else .17 if h<1.39 else 0):
                    continue
                quad(prev[i],prev[(i+1)%seg],cur[(i+1)%seg],cur[i])
        prev = cur
    top = vert((0,2.736,-.51),plaster)
    for i in range(seg):face(prev[i], prev[(i+1)%seg],top)
    # A shadowed porch has deep returns; bricks become visible where the skin wears at the jambs.
    slab(0,.48,1.34,.1,.04,1.50,(72,62,50),.055)
    for side in [-1,1]:
        slab(side*.53,.79,.18,.70,.05,1.06,clay,.045)
        for j in range(4):
            slab(side*(.55-.024*j),1.075-.024*j,.17,.19,.14+.203*j,.31+.203*j,
                 tint(clay, .94+.03*j), .025)
    slab(0,1.28,1.13,.48,.047,.13,clay,.045)
    surface('wood')
    for x in [-.90,.83]:
        pole((x+.045,.043,2.03),(x,1.47,1.98),.046,wood)
        pole((x,1.47,1.98),(x,1.69,.58),.043,wood)
    pole((-.98,1.47,1.99),(.92,1.48,1.98),.043,wood)
    woven_panel([(1.70,.58),(1.60,1.28),(1.47,2.12)],1.96,52)
    for z,y in [(.80,1.688),(1.52,1.575),(1.90,1.505)]:
        pole((-.99,y,z),(.98,y,z),.015,(132,113,84),6,1)
    jar(1.23,1.32,.054,.53,pot,(169,121,89))
    jar(-1.19,1.65,.054,.42,bowl,(152,110,82))


def camp():
    make_ground()
    # Hoops formed by bending reed bundles. The springing is low, leaving both gables open.
    def arch(t, z):
        return (1.56*cos(t)*(1+.018*sin(2*z)), .075+1.74*sin(t), z+.034*sin(t*2))
    surface('reed')
    for k in range(5):
        z=-1.58+k*.77
        for offset in (-.035,.035):
            pts=[arch(j*pi/14,z+offset) for j in range(15)]
            for a,b in zip(pts,pts[1:]):pole(a,b,.051,tint(straw,.82),6,1)
    # Broad strips of woven mat run between the hoops. Coarser exterior bindings
    # catch the light while small breaks in the front fringe reveal bundled stems.
    rings=[]
    for k in range(32):
        t=k*pi/31
        row=[]
        for j in range(13):
            z=-1.67+j*.286; rim=.027*sin(k*2.63) if j in (0,12) else 0
            x,h,_=arch(t,z)
            x+=.057*cos(t); h+=.073*sin(t)-.017*cos(j*.7)*sin(t)
            row.append(vert((x,h,z+rim),tint(straw,.85+.06*sin(k*1.3)+.035*cos(j*.9))))
        if rings:
            for j in range(1,len(row)):quad(rings[-1][j-1],row[j-1],row[j],rings[-1][j])
        rings.append(row)
    for k in range(43):
        t=(k+.25)*pi/43;x,h,_=arch(t,0)
        pole((x+.060*cos(t),h+.079*sin(t),-1.68),(x+.060*cos(t),h+.079*sin(t),1.78+rng.uniform(-.07,.07)),
             .020,tint(straw,rng.uniform(.72,1)),5,.87)
    for z in [-1.59,-.56,.55,1.62]:
        pts=[arch(j*pi/18,z) for j in range(19)]
        pts=[(x*1.054,h*1.064,pz) for x,h,pz in pts]
        for a,b in zip(pts,pts[1:]):pole(a,b,.027,(121,103,76),7,1)
    for side in [-1,1]:
        surface('wood')
        pole((side*1.51,.10,-1.68),(side*1.51,.10,1.75),.060,wood)
    surface('reed')
    for i in range(53):
        x=-1.45+i*.055; h=1.71*(max(0,1-(x/1.57)**2))**.5
        pole((x,.057,-1.58),(x,h,-1.58),.031,tint(straw,rng.uniform(.7,.96)),5,.90)
    surface('cloth')
    slab(-.42,1.48,1.33,.77,.059,.080,(160,140,113),.035)
    jar(1.32,1.84,.053,.41,pot,(158,116,87))
    jar(-1.06,1.82,.054,.35,bowl,(168,125,93))

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('type',choices=['starterHut','reedCamp'])
    parser.add_argument('output',type=Path)
    parser.add_argument('--city',action='store_true')
    args=parser.parse_args()
    (starter if args.type=='starterHut' else camp)()
    export(args.output,args.type)
