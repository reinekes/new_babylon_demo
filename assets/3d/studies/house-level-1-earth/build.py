"""Build the single-tile level I courtyard house. Pass --city for its game mesh."""
import math
import sys
from pathlib import Path
from earth_geometry import (add, bowl, city, clay, cos, export, face, jar, make_ground,
                            pale, pi, plaster, pole, pot, quad, rng, rounded_path, sin,
                            slab, straw, surface, tint, vert, wallcolor, wood)

make_ground()
# Continuous plaster skin with an actual cutaway at the entrance. The low parapet
# rolls over into the roof surface; both doorway jambs have real thickness.
cx,cz=-.14,-.98
path=rounded_path(cx,cz,3.99,2.50,.085,.20 if city else .092)
front=max(z for x,z in path)
door_edges=[min((x for x,z in path if abs(z-front)<.001),key=lambda x:abs(x-t)) for t in (-.72,.26)]
niche_edges=[min((x for x,z in path if abs(z-front)<.001),key=lambda x:abs(x-t)) for t in (.88,1.51)]
levels=[.038,.13,.30,.52,.74,.94,1.16,1.39,1.53,1.63,1.78,1.96,2.09,2.19,2.28,2.32]
rows=[]
def skin(x,z,y):
    t=y/2.32
    scale=1-.024*t+.005*sin(2*pi*t+.5)
    wave=.027*sin(4*x+1.5*z)+.012*sin(9*z-x)+.011*cos(11*x+2*z)
    chipped=.055*max(0,cos(5*x+2.5*z))**10+.032*max(0,sin(3*z-8*x))**8
    ripple=.005*sin(9*x+11*y+3*z)+.009*sin(4*x-6*y+4*z)
    return (cx+(x-cx)*(scale+ripple),y+wave*(.3+.7*t)-chipped*t**8,cz+(z-cz)*(scale+ripple))
for k,y in enumerate(levels):
    row=[vert(skin(x,z,y),wallcolor(x,y,z,plaster,.2)) for x,z in path]
    if rows:
        for i,(x,z) in enumerate(path):
            px,pz=path[i-1]
            if z==front and pz==front and door_edges[0]<(px+x)/2<door_edges[1] and y<=1.53: continue
            if z==front and pz==front and niche_edges[0]<(px+x)/2<niche_edges[1] and .94<y<=1.39: continue
            quad(rows[-1][i-1],row[i-1],row[i],rows[-1][i])
    rows.append(row)
# Parapet crest and interior lip.
for contraction,y,c in [(.977,2.335,pale),(.940,2.325,plaster),(.914,2.298,plaster),(.912,2.13,clay)]:
    row=[]
    for x,z in path:
        p=skin(x,z,y); q=(cx+(p[0]-cx)*contraction,p[1],cz+(p[2]-cz)*contraction)
        row.append(vert(q,wallcolor(*q,c,.4)))
    for i in range(len(row)): quad(rows[-1][i-1],row[i-1],row[i],rows[-1][i])
    rows.append(row)
slab(cx,cz,3.63,2.29,2.06,2.154,(174,153,125),.10,.22,.008)
# The shadowed interior has a recessed reed door, a timber lintel and clay returns.
L,R=door_edges
for side in (L,R):
    slab(side,front-.135,.085,.32,.045,1.54,clay,.025)
surface('wood')
slab((L+R)/2,front-.43,R-L+.04,.08,.045,1.56,(62,56,46),.012)
surface('reed')
for i in range(15):
    x=L+.04+(R-L-.08)*i/22
    pole((x,.09,front-.212),(x,1.48,front-.212),.025,(117,102,81),6,1)
surface('wood')
pole((L-.1,1.55,front+.006),(R+.10,1.56,front+.006),.069,wood,10)
surface('earth')
slab((L+R)/2,front+.105,R-L+.17,.4,.045,.118,(173,132,88))
# A genuine recessed shelf in the front wall, with a shallow slip bowl.
a,b=niche_edges
slab((a+b)/2-.01,front-.21,b-a+.06,.06,.91,1.42,(140,104,76),.025)
for x in (a,b): slab(x-.006,front-.105,.05,.21,.93,1.40,clay,.014)
slab((a+b)/2-.01,front-.065,b-a+.10,.28,.90,.963,clay,.019)
slab((a+b)/2-.01,front-.11,b-a+.06,.22,1.375,1.42,clay,.018)
jar((a+b)/2-.05,front-.066,.967,.27,bowl,(162,83,55))
# Beam ends shade the front and rear friezes.
surface('wood')
for j in range(6):
    x=-1.80+.65*j+rng.uniform(-.045,.045)
    for z,direction in [(front,1),(-2.20,-1)]:
        pole((x,1.98,z-.09*direction),(x+.008,1.976+rng.uniform(-.025,.02),z+rng.uniform(.045,.115)*direction),rng.uniform(.041,.062),tint(wood,rng.uniform(.86,1.14)),9)
# Short side walls leave the court visible from the city camera.
surface('earth')
slab(-1.98,1.16,.25,2.24,.038,.84,plaster,.044,.13,.049)
slab(1.88,1.01,.26,2.56,.038,.68,plaster,.042,.13,.054)
slab(-1.64,2.18,.85,.24,.039,.54,plaster,.035,.13,.042)
slab(1.67,2.20,.62,.23,.038,.48,plaster,.08)
slab(-1.62,1.21,.46,.98,.04,.36,clay,.047)
# In small areas the finish has spalled to the body of the wall. An irregular,
# nearly flush mortar bed carries clipped courses rather than stuck-on blocks.
def erosion(longitude,height,rx,ry,side):
    def pos(u,v,offset):
        x,z=(cx+3.99/2,u) if side=='right' else (u,front)
        p=skin(x,z,v)
        return add(p,(offset,0,0) if side=='right' else (0,0,offset))
    def boundary(t):
        return 1+.13*sin(3*t+.8)+.067*cos(7*t)+.035*sin(13*t)
    outline=[]
    for j in range(54):
        t=j*pi/27; k=boundary(t)
        outline.append(vert(pos(longitude+rx*cos(t)*k,height+ry*sin(t)*k,.012),
                            tint(clay,rng.uniform(.84,.96))))
    middle=vert(pos(longitude,height,.014),tint(clay,.86))
    for j in range(54):
        if side=='right':face(middle,outline[j],outline[j-1])
        else:face(middle,outline[j-1],outline[j])
    for course in range(-3,4):
        v=height+.119*course
        for col in range(-4,5):
            u=longitude+.32*(col+.46*(course%2))
            corners=[]
            for du,dv in [(-.15,-.048),(.151,-.048),(.156,.043),(-.148,.051)]:
                h,k=(u+du-longitude)/rx,(v+dv-height)/ry
                dist=math.hypot(h,k);rim=boundary(math.atan2(k,h))
                if dist>rim*.93: h*=rim*.93/dist;k*=rim*.93/dist
                corners.append(pos(longitude+h*rx,height+k*ry,.020+rng.uniform(0,.006)))
            if math.hypot((u-longitude)/rx,(v-height)/ry)>1.03:continue
            ids=[vert(q,tint(clay,1+rng.uniform(-.025,.072))) for q in corners]
            if side=='right':ids.reverse()
            quad(*ids)
erosion(-1.23,.44,.67,.29,'right')
erosion(-1.57,.47,.40,.18,'front')
# A sloping reed awning with an uneven fringe, three transverse lashings
# and a scalloped edge. Splayed, individually bound poles keep the front open.
def spar(a,b,r,col):
    middle=tuple((v+w)*.5 for v,w in zip(a,b))
    middle=add(middle,(rng.uniform(-.022,.022),.006,rng.uniform(-.020,.020)))
    pole(a,middle,r,col,9,.93);pole(middle,b,r*.93,col,9,.79)
surface('wood')
for x,lean in [(-1.41,.07),(.53,-.041)]:
    spar((x+lean,.025,1.57),(x,1.60,1.52),.046,wood)
    spar((x,1.55,1.52),(x,1.85,.20),.042,wood)
    pole((x+.01,1.31,1.54),(x,1.65,1.13),.027,wood,8)
    surface('reed')
    for y in (1.487,1.505,1.523):pole((x,y,1.526),(x+.004,y+.014,1.526),.049,(153,132,97),9,1)
    surface('wood')
spar((-1.55,1.568,1.51),(.65,1.55,1.53),.047,wood)
surface('reed')
# Reeds bow between cross-members and extend beyond the last binding in
# differently weathered bundles. Fine spacing leaves small gaps for sunlight.
def awning(x,z):
    sag=.048*max(0,1-((x+.44)/1.12)**2)
    return 1.889-.227*(z-.14)-sag-.025*sin((z-.14)/1.42*pi)+.014*sin(x*7+z)
reed_count=72 if city else 100
for j in range(reed_count):
    x=-1.54+j*2.2077/(reed_count-1)+rng.uniform(-.006,.006)
    end=1.66+.045*sin(j*.15)+rng.uniform(-.067,.085)
    if j in (4,5,23,24,25,77,91):end-=rng.uniform(.11,.26)
    zig=rng.uniform(-.031,.031);r=rng.uniform(.009,.014)
    c=tint(straw,rng.uniform(.78,1.12));prev=None
    stalk_rings=[]
    for z in ([.14,.89,end] if city else [.14,.48,.96,1.38,end]):
        xx=x+zig*(z-.14)+.006*sin(z*3+j)
        pt=(xx,awning(xx,z)+.008*sin(j*3.7),z)
        if city:
            # Three-sided split reeds retain the full woven silhouette. Continuous
            # cross sections avoid hidden caps at every bend in the master model.
            radius=r*1.48
            row=[vert(add(pt,off),tint(c,k)) for off,k in [
                ((-radius,0,0),.90),((0,radius,0),1),((radius,0,0),.96)]]
            if stalk_rings:
                old=stalk_rings[-1]
                for i in range(3):quad(old[i-1],row[i-1],row[i],old[i])
            stalk_rings.append(row)
        elif prev:pole(prev,pt,r,c,6,.95)
        prev=pt
for z in [.34,.73,1.18,1.47]:
    prev=None
    for i in range(24):
        x=-1.55+i*.097
        pt=(x,awning(x,z)+.015,z+.009*sin(4*x))
        if prev:pole(prev,pt,.009,(119,102,78),6,1)
        prev=pt
# Woven floor mat with dyed borders and diamond motifs.
surface('reed')
slab(-.49,1.64,1.23,.62,.059,.080,(164,126,78),.023)
for i in range(31):
    x=-1.08+i*.039
    if city:
        pole((x,.091,1.36),(x,.091,1.932),.019,(145,123,94) if i in (2,3,27,28) else (166,148,116),5,1)
        continue
    for j in range(11):
        z=1.36+j*.052; motif=abs((i%10)-5)+abs(j-5)
        color=(145,123,94) if i in (2,3,27,28) else (166,148,116)
        pole((x,.091,z),(x,.091,z+.055),.019,tint(color,.96+.04*(i%2)),5,1)
# A draped domestic textile adds a muted madder stripe on the sunlit yard wall.
surface('cloth')
profile=[(1.728,.40),(1.74,.62),(1.765,.69),(1.83,.708),(1.92,.705),(2.005,.675),(2.022,.57),(2.03,.39),(2.033,.275)]
grid=[]
for i in range(31):
    z=.82+i*.022+.005*sin(.6*i); row=[]
    c=(158,137,111) if i in (2,3,6,25,28) else (179,166,141)
    for j,(x,y) in enumerate(profile):
        drape=abs(j-3)/5
        row.append(vert((x+.012*sin(i*.91)*drape,y+(.018*cos(i*.83)-.048*cos(i*.16))*drape,z),tint(c,1+.025*cos(i*.95))))
    if grid:
        for j in range(1,len(row)):quad(row[j-1],row[j],grid[-1][j],grid[-1][j-1])
    grid.append(row)
for i in range(15):
    z=.83+i*.046; pole((2.033,.281-.048*cos(i*.32),z),(2.04,.225-.048*cos(i*.32)+rng.random()*.02,z+.008),.008,(180,145,96),5)
# Storage vessels have open mouths, foot rings, shoulders and painted slip bands.
jar(1.28,1.91,.061,.70,pot,(156,111,84),[(7,(149,108,85)),(9,(161,119,90)),(12,(141,100,78))])
jar(.81,2.00,.058,.43,pot,(177,142,104))
jar(1.33,1.35,.057,.40,bowl,(153,109,83),[(5,(173,130,95))])
jar(-1.60,1.18,.37,.40,bowl,(173,104,66))
# Tapered ladder up the exterior flank, joined with visible lashings.
surface('wood')
for z,spread in [(-1.01,.043),(-.55,-.038)]:
    spar((2.31,.032,z-spread),(1.77,2.47,z+spread),.035,(106,91,73))
for j in range(8):
    t=.083+j*.111; x=2.31-.54*t; y=.032+2.438*t
    left=-1.053+.086*t;right=-.512-.076*t
    slope=.026*sin(j*2.22)
    pole((x+.016,y,left-.032),(x+.013,y+slope,right+.031),.023,(131,111,85),8,.92)
    surface('reed')
    for z,dy in [(left,0),(right,slope)]:
        for k in [-.01,.01]:
            pole((x+.009,y+dy,z+k-.007),(x+.009,y+dy,z+k+.007),.031,(157,136,98),8,1)
    surface('wood')
surface('reed')
# Bundled spare roof reeds rest along the back parapet.
for j in range(11):
    tier=0 if j<6 else 1
    z=-1.86+(j if j<6 else j-5.5)*.055
    pole((-.98,2.188+tier*.048,z),(.37+rng.uniform(-.065,.065),2.19+tier*.048,z+.01),.029,tint(straw,rng.uniform(.84,1.1)),7)
for x in [-.74,.12]:pole((x,2.219,-1.91),(x,2.219,-1.53),.021,wood,7,1)
surface('earth')
# A clay roof outlet and a small household reserve of unfired bricks at the rear.
for x in [-1.32,-1.15]:
    slab(x,-2.295,.052,.40,2.10,2.20,clay,.019)
slab(-1.235,-2.295,.20,.40,2.08,2.139,clay,.022)
for k in range(2):
    for j in range(4-k):
        slab(-.95+j*.32+.12*k,-2.34,.309,.22,.049+k*.117,.162+k*.117,tint(clay,rng.uniform(.90,1.05)),.025)
# Low-profile hairline fissures on the weather-facing plaster.
for origin,side in [((1.83,1.46,-1.57),'right'),((1.83,.76,-.23),'right'),((-.91,1.15,-2.20),'back')]:
    ox,oy,oz=origin; last=None
    for dx,dy in [(0,0),(.052,-.083),(.036,-.141),(.098,-.223),(.113,-.307),(.147,-.335)]:
        wall_x,wall_z=(cx+3.99/2,oz+dx) if side=='right' else (ox+dx,cz-2.50/2)
        point=skin(wall_x,wall_z,oy+dy)
        point=add(point,(.003,0,0) if side=='right' else (0,0,-.003))
        if last:pole(last,point,.0028,(152,132,109),5,.75)
        last=point
out=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).with_name('house-untextured.glb')
export(out,'Courtyard house I')
