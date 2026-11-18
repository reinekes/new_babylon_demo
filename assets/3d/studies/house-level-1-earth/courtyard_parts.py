"""Earth rooms, reed shades and household surfaces shared by the city model studies."""
from math import ceil
from earth_geometry import (clay, cos, pi,
                            plaster, pole, quad, rng, rounded_path, sin, slab,
                            straw, surface, tint, vert, wallcolor, wood)


def room(x, z, width, depth, base, height, door, opening, finish=plaster):
    """A slightly battered continuous shell, a cut door with returns, and usable flat roof."""
    path = rounded_path(x, z, width, depth, .085, .20)
    front = max(pz for px, pz in path)
    edge = [px for px, pz in path if abs(front - pz) < .001]
    left, right = [min(edge, key=lambda px: abs(px-target)) for target in
                   (door-opening/2, door+opening/2)]
    lintel = min(height*.75, 1.65)
    def point(px, pz, h):
        t = h / height
        batter = 1 - .027*t + .004*sin(5*px+2*h+pz)
        wear = .017*sin(3.7*px+1.4*pz) + .012*cos(7.2*pz-px) - .022*max(0, cos(5*px+pz))**12
        return x+(px-x)*batter, base+h+wear*t, z+(pz-z)*batter

    surface('earth')
    previous = []
    layers = sorted(set([0, .12, .38, .75, lintel, height-.32, height-.14, height]))
    for h in layers:
        row = [vert(point(px,pz,h), wallcolor(px,h,pz,finish,.81)) for px,pz in path]
        if previous:
            for i,(px,pz) in enumerate(path):
                lx,lz = path[i-1]
                if pz==front and lz==front and left<(px+lx)/2<right and h<=lintel:
                    continue
                quad(previous[i-1],row[i-1],row[i],previous[i])
        previous = row
    for inset, delta in [(.025,.014),(.14,.006),(.16,-.035),(.16,-.19)]:
        row=[]
        for px,pz in path:
            qx,qy,qz=point(px,pz,height)
            spot=(x+(qx-x)*(1-2*inset/width),qy+delta,z+(qz-z)*(1-2*inset/depth))
            row.append(vert(spot,wallcolor(*spot,finish,.4)))
        for i in range(len(row)):quad(previous[i-1],row[i-1],row[i],previous[i])
        previous=row
    deck=base+height-.15
    slab(x,z,width*.97-.19,depth*.97-.19,deck-.11,deck,(178,155,124),.075,.25,.014)
    for side in (left,right): slab(side,front-.12,.082,.30,base+.01,base+lintel,clay,.022)
    slab((left+right)/2,front-.34,right-left+.07,.11,base,base+lintel,(72,64,51),.025)
    slab((left+right)/2,front+.08,right-left+.17,.32,base,base+.085,(165,140,106),.04)
    surface('reed')
    for i in range(max(4,round((right-left)*13))):
        px=left+.03+.030*i
        pole((px,base+.083,front-.24),(px,base+lintel-.02,front-.245),.016,(128,111,82),6)
    surface('wood')
    pole((left-.085,base+lintel,front+.008),(right+.085,base+lintel+.01,front+.008),.056,wood,8)
    for j in range(max(2,round(width/.63))):
        px=x-width*.43+.62*j
        pole((px,deck-.17,front-.09),(px+.012,deck-.16,front+.07+rng.uniform(-.018,.023)),.048,wood)
    surface('earth')
    return deck


def awning(x,z,width,depth,base,high,low):
    """A bound, sagging reed mat sitting on a pegged three-beam frame."""
    start=z-depth/2
    for j in (-1,1):
        px=x+j*width*.45
        surface('wood')
        for end,h in [(start,high),(start+depth,low)]:
            pole((px+.03*j,base,end+.028),(px,h,end),.046,wood)
            pole((px,h-.29,end),(px-.23*j,h-.018,end),.022,wood,6)
        pole((px,high-.027,start-.04),(px,low-.03,start+depth+.06),.04,wood)
    for end,h in [(start,high),(start+depth,low)]:
        pole((x-width*.52,h-.024,end),(x+width*.52,h-.024,end),.045,wood)
    surface('reed')
    def sag(px,f):
        return high+(low-high)*f-.038*sin(pi*f)-.024*max(0,1-(2*(px-x)/width)**2)+.009*sin(px*9+f)
    count=ceil(width/.034)
    for i in range(count):
        px=x-width/2+(i+.5)*width/count
        tone=tint(straw,rng.uniform(.79,1.14))
        end=1+rng.uniform(-.015,.083)
        previous=[]
        for f in [-.029,.48,end]:
            py=sag(px,f); pz=start+f*depth
            r=width/count*rng.uniform(.42,.55)
            row=[vert((px-r,py,pz),tint(tone,.95)),vert((px,py+.012,pz),tone),
                 vert((px+r,py,pz),tint(tone,.90))]
            if previous:
                for j in range(3):quad(previous[j-1],row[j-1],row[j],previous[j])
            previous=row
    for f in (.18,.53,.86):
        for i in range(9):
            a=x-width/2+width*i/9; b=a+width/9; pz=start+depth*f
            pole((a,sag(a,f)+.012,pz),(b,sag(b,f)+.012,pz),.009,(121,103,78),6,1)
    surface('earth')


def ladder(x,z,base,top,lean=.36):
    surface('wood')
    for dz in (-.20,.20):
        pole((x+lean,base,z+dz*1.10),(x,top+.17,z+dz),.035,wood,8)
    steps=max(5,round((top-base)/.31))
    for i in range(1,steps+1):
        t=i/(steps+1); px=x+lean*(1-t); py=base+t*(top+.17-base)
        pole((px+.015,py,z-.235),(px+.015,py+.008*sin(i*4),z+.235),.023,(138,117,88),7)
        surface('reed')
        for dz in (-.2,.2):pole((px+.01,py,z+dz-.023),(px+.01,py,z+dz+.023),.034,straw,6,1)
        surface('wood')
    surface('earth')


def mat(x,z,width,depth,y):
    surface('reed')
    for i in range(22):
        px=x-width/2+(i+.5)*width/22
        color=(145,122,90) if i in (1,2,19,20) else (173,151,115)
        pole((px,y,z-depth/2),(px,y,z+depth/2+rng.uniform(-.014,.014)),width/44,color,5,1)
    surface('earth')


def hanging(x,z,span,y,fall):
    """A worn linen cloth hooked over a parapet facing the courtyard."""
    surface('cloth');previous=[]
    for i in range(25):
        px=x+span*i/24
        tone=(154,129,103) if i in (2,3,20,21) else (186,168,137)
        row=[]
        for depth,h in [(-.14,-.08),(-.12,.01),(-.04,.025),(.016,-.02),(.018,-fall*.5),(.026,-fall)]:
            fold=sin(i*1.51)*.014
            row.append(vert((px,y+h+.024*cos(i*.42)*abs(h),z+depth+fold),tint(tone,1+.022*sin(i*.96))))
        if previous:
            for j in range(1,len(row)):quad(previous[j-1],previous[j],row[j],row[j-1])
        previous=row
    surface('earth')


def front_wall(gap_x, gap_width):
    for a,b in [(-2.25,gap_x-gap_width/2),(gap_x+gap_width/2,2.25)]:
        if b>a:slab((a+b)/2,2.25,b-a,.22,.035,.73,plaster,.052,.24,.038)
