"""Sculpt the four-tile common house. Metres from its centre, +Z toward the gate.

python3 build-communal.py /tmp/communal-raw.glb --city
python3 postprocess.py /tmp/communal-raw.glb /tmp/communal-painted.glb
node city-mesh.cjs /tmp/communal-painted.glb ../../sumer-buildings/communalHouse.glb 2.8
"""
import argparse
from math import ceil, cos, pi, sin
from pathlib import Path

from courtyard_parts import awning, mat, storage_basket
from earth_geometry import (bowl, colors, export, indices, jar, make_ground, normals, pole, positions,
                            pot, quad, rng, slab, straw, surface, tint, vert, wood)

BASE = .065
PLASTER = (188, 160, 120)
PALE = (203, 178, 141)
ROOF = (174, 147, 110)
BRICK = (149, 117, 82)


def turn(first, cx, cz, angle):
    """Work on a front-facing wall, then orient its face into the court."""
    c, s = cos(angle), sin(angle)
    for i in range(first, len(positions)):
        x, y, z = positions[i]
        a, b, d = normals[i]
        positions[i] = (cx + c*x+s*z, y, cz + c*z-s*x)
        normals[i] = (c*a+s*d, b, c*d-s*a)


def plaster_panel(left, right, bottom, top, z, height, colour):
    """Trowelled facade, with a battered foot and irregular lime/mud patches."""
    cols, rows = max(1, ceil((right-left)/.28)), max(1, ceil((top-bottom)/.22))
    strip = []
    for iy in range(rows+1):
        y = bottom+(top-bottom)*iy/rows
        current = []
        for ix in range(cols+1):
            x = left+(right-left)*ix/cols
            wear = .010*sin(7*x+2*y) + .009*sin(4*y-3*x) + .004*cos(15*y+5*x)
            blemish = .043*sin(x*3.4+y*2.1)*cos(y*3-x) + .023*cos(12*y+4*x)
            stain = .12*max(0,1-y/.72) + .034*max(0,cos(1.9*x-.5*y))**4
            current.append(vert((x, y, z-.058*y/height+wear), tint(colour, 1+blemish-stain)))
        if strip:
            for i in range(cols):
                quad(strip[i],strip[i+1],current[i+1],current[i])
        strip = current


def room(cx, cz, width, depth, deck, openings, angle=0, colour=PLASTER, rail=True):
    """Cut the door, ventilation slots and their reveals through the court facade."""
    first = len(positions)
    front, back, w = depth/2, -depth/2, width/2
    surface('earth')
    # A real hollow room is visible down each portal. Shadow develops in its reveal.
    partition_top=deck+(.06 if rail else -.05)
    slab(-w+.12,0,.24,depth,BASE,partition_top,colour,.052)
    slab(w-.12,0,.24,depth,BASE,partition_top,colour,.052)
    slab(0,back+.14,width-.28,.28,BASE,deck+.07,colour,.05)
    # The city uses diffuse outdoor fill even inside rooms. Bake the reduction
    # in skylight into the packed floor and the inward face of the far wall.
    slab(0,-.12,width-.36,depth-.45,BASE-.025,BASE+.005,(93,73,54),.036)
    plaster_panel(-w+.19,w-.19,BASE+.008,deck-.15,back+.35,deck,(87,69,54))
    slab(0,0,width-.13,depth-.12,deck-.21,deck if rail else deck-.06,ROOF,.06,.30,.012)
    slab(0,front-.30,width-.26,.35,deck-.10,deck+.045,colour,.03)
    # Low parapets are behind the roof; the ends of the supporting logs remain legible.
    if rail:
        slab(0,back+.10,width-.12,.16,deck-.025,deck+.17,colour,.038)
        for x in [-w+.09,w-.09]:
            slab(x,-.025,.15,depth-.22,deck-.025,deck+.12,colour,.04)
    xs=sorted({-w,w,*[n for a,b,low,high in openings for n in [a,b]]})
    ys=sorted({BASE,deck,*[n for a,b,low,high in openings for n in [low,high]]})
    for left,right in zip(xs,xs[1:]):
        for bottom,top in zip(ys,ys[1:]):
            if any(a<=(left+right)/2<=b and lo<=(bottom+top)/2<=hi for a,b,lo,hi in openings):
                continue
            plaster_panel(left,right,bottom,top,front,deck,colour)
    for a,b,lo,hi in openings:
        for x in [a,b]:
            slab(x,front-.17,.075,.35,lo,hi,(152,120,87),.025)
        slab((a+b)/2,front-.18,b-a,.36,hi,hi+.065,BRICK,.025)
        if lo>BASE:
            slab((a+b)/2,front-.18,b-a,.34,lo-.04,lo,(152,124,92),.014)
        else:
            slab((a+b)/2,front-.19,b-a+.07,.52,BASE-.045,BASE+.01,(164,137,101),.025)
            surface('wood')
            pole((a-.13,hi+.025,front+.005),(b+.13,hi+.035,front+.005),.073,wood,8)
            surface('earth')
    # A weathered reed roof bed beneath the mud cap, tied over the round joists.
    surface('reed')
    for i in range(3):
        pole((-w+.04,deck-.075-i*.021,front+.025),(w-.07,deck-.069-i*.021,front+.018),.021,
             tint(straw,.82+i*.06),6,1)
    surface('wood')
    logs=max(2,round(width/.78))
    for i in range(logs):
        x=-w+(i+.5)*width/logs
        pole((x,deck-.16,front-.17),(x+.006,deck-.164,front+rng.uniform(.10,.17)),.073,
             tint(wood,rng.uniform(.9,1.12)),8,.92)
    surface('earth')
    turn(first,cx,cz,angle)


def flaked_brick(a,b,z,limit=.52):
    """Low, broken courses at the exposed toes of selected plaster panels."""
    surface('earth')
    n=max(2,round((b-a)/.40))
    for row in range(4):
        pitch=(b-a)/n
        for i in range(n+1):
            l=max(a,a+(i-.5*(row%2))*pitch)
            r=min(b,a+(i+1-.5*(row%2))*pitch-.023)
            at=(l+r)/2;foot=BASE+row*.13
            high=limit*(.68+.33*sin(at*2.6+.6)+.19*cos(at*4.2))
            if r-l<.10 or foot>high:continue
            slab(at,z,r-l,.075,foot+.009,foot+.131+rng.uniform(-.017,.014),
                 tint(BRICK,rng.uniform(.97,1.19)),.035,.44,.009)


def oven(x,z):
    """A smoke-stained hearth with an actual arched mouth, soot and a brick sill."""
    profile=[(.57,.06),(.70,.18),(.72,.38),(.66,.65),(.56,.85),(.39,1.03),(.19,1.11),(.025,1.14)]
    segments=28
    surface('earth')
    rows=[]
    for r,h in profile:
        ring=[]
        for i in range(segments):
            angle=2*pi*i/segments
            ring.append(vert((x+r*sin(angle),h,z+r*cos(angle)),tint((164,127,90),1-.19*max(0,cos(angle))**12*(1-h/1.2))))
        rows.append(ring)
    for k in range(len(rows)-1):
        for i in range(segments):
            j=(i+1)%segments
            mid=(i+.5)*2*pi/segments
            if cos(mid)>.82 and k<2 or cos(mid)>.95 and k==2:continue
            quad(rows[k][i],rows[k][j],rows[k+1][j],rows[k+1][i])
    slab(x,z+.13,.72,.13,BASE,.74,(72,54,42),.1)
    slab(x,z+.54,.81,.44,.06,.125,BRICK,.04)
    flaked_brick(x-.48,x+.48,z+.62,.17)


def rolled_mat(x,z,width,r,y):
    surface('reed')
    for i in range(21):
        angle=2*pi*i/21
        pole((x-width/2,y+r+r*sin(angle),z+r*cos(angle)),
             (x+width/2,y+r+r*sin(angle),z+r*cos(angle)),.023,
             tint(straw, .90+.12*cos(3*angle)),6,1)
    for f in [.18,.78]:
        for j in range(12):
            a=j*pi/6;b=(j+1)*pi/6;R=r+.015
            px=x+(f-.5)*width
            pole((px,y+r+R*sin(a),z+R*cos(a)),(px,y+r+R*sin(b),z+R*cos(b)),
                 .018,(118,91,58),5,1)
    surface('earth')


def compound():
    make_ground()
    for i,(x,y,z) in enumerate(positions):
        positions[i]=(x*2.28,y+.017,z*2.28)
        nx,ny,nz=normals[i];normals[i]=(nx/2.28,ny,nz/2.28)
        red,green,blue=colors[i];colors[i]=(red*1.05,green*.94,blue*.80)
    # Front of this tall hall is z=-2.25; the smaller flanking rooms butt into it.
    room(0,-3.775,4.87,3.05,3.87,[(-.64,.64,BASE,2.11),
         (-.54,-.42,2.72,3.12),(-.06,.06,2.72,3.12),(.42,.54,2.72,3.12)],colour=PALE)
    for side in [-1,1]:
        room(side*3.94,-3.79,3.03,3.02,2.72,
             [(-.36,.36,BASE,1.71)],colour=(188,161,125))
        # Three ground-floor chambers per wing. Doors open sideways into the courtyard.
        angle=-side*pi/2
        for j,(z,depth) in enumerate([(-1.11,2.24),(1.31,2.60),(3.89,2.48)]):
            room(side*4.51,z,depth,1.88,2.525,[(-.37,.37,BASE,1.72)],
                 angle,colour=(191-j*2,165-j*2,128-j*2),rail=False)
        # Each wing shares one roof and an outer parapet across its partitions.
        slab(side*4.51,1.45,1.83,7.40,2.49,2.525,ROOF,.065,.28,.015)
        slab(side*5.38,1.40,.15,7.48,2.49,2.65,PLASTER,.05,.28,.035)
    surface('earth')

    for side in [-1,1]:
        a,b=sorted([side*.76,side*5.44])
        slab((a+b)/2,5.22,b-a,.34,BASE,1.52,PLASTER,.071,.28,.032)
        slab(side*.94,5.22,.40,.51,BASE,1.95,PALE,.078,.28,.022)
        flaked_brick(a+.07,b-.06,5.382,.44)
    surface('wood')
    pole((-1.02,1.84,5.22),(1.03,1.865,5.22),.118,(107,84,60),9,.86)
    surface('earth')
    flaked_brick(-2.30,-.75,-2.249,.51);flaked_brick(.75,2.30,-2.249,.50)
    slab(-3.21,2.0,.69,3.10,BASE,.495,(179,149,110),.087,.27,.016)
    # Triple binding and worn ends distinguish the stored roll from a plain cylinder.
    rolled_mat(-3.20,3.05,.54,.091,.50)
    for i in range(12):
        z=3.50-i*.28;top=BASE+(2.525-BASE)*(i+1)/12
        slab(3.06,z,.94,.30,BASE,top,(179,150,113),.037,.25,.008)
    slab(3.06,-.02,.94,.58,BASE,2.525,PLASTER,.045)
    slab(3.54,-.05,.25,.53,2.34,2.525,PLASTER,.03)
    # Small outer stair curb worn by the passage to the terrace.
    for i in range(12):
        top=BASE+(2.525-BASE)*(i+1)/12+.115
        slab(2.60,3.50-i*.28,.12,.30,BASE,top,PLASTER,.025,.32,.007)
    awning(-2.47,-1.13,1.96,1.96,BASE,2.45,1.98)
    jar(-2.85,-1.47,BASE,.87,pot,(163,128,90))
    jar(-2.08,-1.49,BASE,.56,pot,(178,142,99))
    storage_basket(-2.69,-.74,BASE,.76)
    mat(-1.60,.61,1.10,.72,BASE+.007)
    rolled_mat(-1.47,.51,.84,.105,BASE+.031)
    oven(2.27,-1.43)
    jar(1.61,-1.53,BASE,.46,bowl,(172,129,84))
    surface('wood')
    for i in range(4):
        pole((1.52+.12*i,BASE,-1.96),(1.61+.12*i,1.13+.11*i,-2.25),.025,wood)
    surface('earth')


def face_the_gate():
    """In the city's left-handed view from +Z, the west wing is screen-right."""
    for i,(x,y,z) in enumerate(positions):
        positions[i]=(-x,y,z)
        nx,ny,nz=normals[i];normals[i]=(-nx,ny,nz)
    for i in range(0,len(indices),3):
        indices[i+1],indices[i+2]=indices[i+2],indices[i+1]


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output',type=Path)
    parser.add_argument('--city',action='store_true')
    args=parser.parse_args()
    rng.seed(261120)
    compound()
    face_the_gate()
    export(args.output,'Communal courtyard house')
