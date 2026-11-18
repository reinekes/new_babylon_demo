"""Architectural concept models for the roadmap. No simulation state or catalogue registration."""
import argparse
from math import cos, pi, sin
from pathlib import Path
from courtyard_parts import awning, mat, room
from earth_geometry import (bowl, clay, export, face, jar, make_ground, plaster, pole, pot, quad,
                            rng, slab, straw, surface, tint, vert, wood)


def tablet(x,z,y,w=.34,d=.24):
    surface('earth')
    slab(x,z,w,d,y,y+.048,(170,130,95),.045,.17,.003)
    # Impressed wedge marks are an uninscribed visual shorthand for a ledger.
    for row in range(3):
        for j in range(4):
            px=x+w*(j-1.5)*.17; pz=z+d*(row-1)*.21
            points=[(px-.014,y+.051,pz-.003),(px+.008,y+.051,pz-.008),(px,y+.051,pz+.007)]
            face(*[vert(q,(116,92,69)) for q in points])


def beam(a,b,r=.040):
    surface('wood');pole(a,b,r,tint(wood,rng.uniform(.93,1.11)),8,.91)


def basket(x,z,y,s):
    # Open hemispherical basket with a visibly bound rim and horizontal coils.
    surface('reed')
    prev=None
    for k,(r,h) in enumerate([(.11,0),(.22,.028),(.34,.16),(.41,.29),(.42,.33),(.38,.35),(.36,.29),(.27,.18),(.14,.10),(.01,.10)]):
        row=[]
        for j in range(18):
            a=2*pi*j/18
            row.append(vert((x+s*r*cos(a),y+h*s,z+s*r*sin(a)),tint(straw,.83+.07*(k%2)+.03*(j%2))))
        if prev:
            for j in range(len(row)):quad(prev[j-1],row[j-1],row[j],prev[j])
        prev=row
    surface('earth')


def archive():
    room(-1.30,-.83,1.69,2.66,.045,2.31,-1.24,.69)
    # Covered records bay. The terracotta labels and stacked tablets are visible in open cubbies.
    slab(.63,-1.96,2.30,.20,.045,1.69,plaster,.065)
    for x in (-.45,.28,.99,1.70):
        slab(x,-1.58,.115,.80,.045,1.67,clay,.042)
    for h in (.27,.80,1.32):
        surface('wood');slab(.63,-1.56,2.27,.78,h,h+.07,(128,104,79),.023,.25,.009)
        for j,x in enumerate((-.1,.64,1.34)):
            if h>1 and j==2:continue
            for k in range(1+(j+int(h*10))%3):tablet(x+.04*k,-1.47,h+.072+k*.053,.43,.33)
    awning(.68,-1.55,2.49,1.10,.05,1.99,1.86)
    surface('earth')
    slab(.6,.83,1.44,.76,.045,.56,plaster,.085)
    tablet(.31,.79,.562,.44,.35);tablet(.89,.91,.563,.33,.27)
    beam((.70,.625,.71),(1.10,.625,.67),.012)
    mat(.54,1.60,1.09,.56,.07)
    basket(-.57,1.63,.065,.84)
    jar(-1.50,1.39,.055,.49,pot,(168,117,83))
    slab(-1.95,1.75,.19,.78,.05,.49,plaster,.065)


def lyre(x,z,base):
    surface('wood')
    slab(x,z,.86,.26,base,base+.25,(129,89,58),.087)
    beam((x-.36,base+.08,z),(x-.49,base+1.20,z),.054)
    beam((x+.34,base+.12,z),(x+.41,base+.99,z),.054)
    beam((x-.51,base+1.16,z),(x+.44,base+.99,z),.040)
    surface('reed')
    for i in range(8):
        t=i/7;px=x-.34+t*.62
        pole((x-.23+.42*t,base+.20,z+.085),(px,base+1.13-.13*t,z+.008),.009,(192,164,111),5,1)


def square():
    # An open processional court. The low dais and two tall cloth-capped masts are legible from above.
    surface('earth')
    slab(0,-1.29,3.41,1.60,.05,.19,clay,.11)
    slab(0,-1.42,3.24,1.23,.19,.36,plaster,.07)
    for x in (-1.87,1.87):
        slab(x,-1.61,.48,.49,.052,.33,clay,.07)
        beam((x,.23,-1.61),(x+.015,2.79,-1.61),.062)
    beam((-1.94,2.43,-1.61),(1.94,2.39,-1.61),.040)
    # Narrow draped woven panels leave the stage and its lyre visible.
    surface('cloth')
    for center,length,col in [(-1.39,.69,(156,98,70)),(-.76,.50,(183,157,111)),(.76,.50,(183,157,111)),(1.39,.69,(156,98,70))]:
        last=[]
        for j in range(10):
            x=center+(j/9-.5)*.44;fold=.035*sin(j*1.5)
            row=[vert((x,2.41,-1.58),col),vert((x+.032,2.40-length+.035*cos(j*.8),-1.56+fold),tint(col,.97))]
            if last:quad(last[0],last[1],row[1],row[0])
            last=row
    lyre(.0,-1.36,.365)
    for x in (-1.66,1.66):
        slab(x,.84,.38,1.82,.043,.34,clay,.065)
        mat(x,.84,.36,1.31,.355)
    mat(0,.47,1.02,1.51,.076)
    for x in (-1.71,1.71):
        jar(x,1.99,.058,.42,bowl,(155,112,84))


def irrigation():
    # A worked earth head channel with a transverse timber stop-board. No lifting machinery.
    surface('ground')
    for x in (.52,1.55):
        slab(x,-.04,.32,4.14,.04,.31,(154,132,101),.09,.22,.04)
    slab(1.04,-.04,.80,4.12,.036,.093,(124,133,110),.045,.23,.008)
    for x in (.60,1.48):
        beam((x,.11,-.58),(x,1.31,-.58),.060)
    beam((.45,1.30,-.58),(1.62,1.28,-.58),.052)
    for i in range(4):
        surface('wood');slab(1.04,-.56,.88,.10,.14+i*.13,.26+i*.13,(128,104,77),.019)
    for j in range(5):
        z=.3+j*.25
        for x in (.54,1.52):
            beam((x,.16,z),(x+.021,.46,z+.02),.033)
    awning(-1.08,-1.12,1.93,1.43,.045,1.96,1.77)
    for i in range(3):
        x=-1.78+i*.36
        beam((x,.10,-.19),(x+.17,1.45,-1.07),.032)
        slab(x,-.18,.21,.32,.06,.119,(142,113,81),.046)
    for i in range(13):
        surface('reed')
        z=.47+i*.041
        pole((-1.98,.12+.025*(i%3),z),(-.55,.14,z+.035),.027,straw,6)
    basket(-1.52,1.45,.058,1.14);basket(-.74,1.66,.061,.82)
    jar(-.34,-1.89,.057,.44,pot,(164,120,89))


def ground_disc(x,z,rx,rz):
    surface('ground')
    center=vert((x,.084,z),(180,153,112))
    last=[]
    for k in range(1,7):
        ring=[]
        for j in range(52):
            a=2*pi*j/52
            x0=x+rx*cos(a)*k/6;z0=z+rz*sin(a)*k/6
            tone=(180,153,111) if k<6 else (157,134,100)
            ring.append(vert((x0,.079+.004*cos(j*.8+4*k),z0),tint(tone,rng.uniform(.955,1.04))))
        for j in range(len(ring)):
            if last:quad(ring[j-1],last[j-1],last[j],ring[j])
            else:face(center,ring[j],ring[j-1])
        last=ring


def sheaf(x,z,height,radius):
    surface('reed')
    for j in range(26):
        a=2*pi*j/26+.05*rng.random(); h=height*rng.uniform(.85,1.10)
        c=tint((190,159,95),rng.uniform(.86,1.10))
        q=(x+radius*.35*cos(a),height*.43,z+radius*.35*sin(a))
        start=(x+radius*cos(a),.063,z+radius*sin(a))
        top=(x+radius*.72*cos(a),h,z+radius*.72*sin(a))
        pole(start,q,.018,c,5,.76);pole(q,top,.014,c,5,.60)
        socket=(top[0]+.015*cos(a),top[1]+.085,top[2]+.015*sin(a))
        pole(top,socket,.026,c,6,.36)
    for k in range(14):
        a=2*pi*k/14;b=2*pi*(k+1)/14
        pole((x+radius*.37*cos(a),height*.43,z+radius*.37*sin(a)),
             (x+radius*.37*cos(b),height*.43,z+radius*.37*sin(b)),.018,(132,110,78),6,1)


def threshing():
    ground_disc(.03,.13,2.03,1.94)
    for x,z,h,r in [(-1.25,-1.24,1.06,.31),(-.68,-1.52,1.29,.37),(-.08,-1.57,1.02,.32),(.41,-1.37,.90,.24)]:
        sheaf(x,z,h,r)
    surface('wood')
    # A low rubbing sledge with upturned runners at the front.
    for x in (-.68,-.52,-.36,-.20,-.04):
        slab(x,.53,.17,1.38,.11,.20,(133,102,70),.038)
        beam((x,.15,1.12),(x,.36,1.45),.058)
    for z in (-.02,.81):beam((-.82,.22,z),(.10,.22,z),.045)
    for x in (.86,1.16,1.47):
        surface('reed')
        for i in range(8):
            z=.28+i*.054
            pole((x-.19,.11,z),(x+.19,.10,z+.06),.017,tint(straw,.98+i*.015),5,1)
    basket(1.16,-.46,.09,1.22);basket(1.62,-.02,.090,.70)
    # A fork leans from the edge of the work floor to the sheaves.
    beam((-1.44,.10,.20),(-.96,.94,-1.01),.028)
    for dx in (-.08,.02,.10):beam((-1.43,.11,.18),(-1.48+dx,.095,.46),.018)


def masters():
    room(-1.30,-1.13,1.70,2.04,.045,2.18,-1.27,.65)
    # Cut-away section of a second wall under construction. Lift platforms and
    # drying, unlaid bricks identify a builder's yard rather than another residence.
    surface('earth')
    for j,count in enumerate((7,7,7,6,5,4,3,2)):
        for i in range(count):
            slab(-.34+i*.36+.13*(j%2),-1.64,.348,.27,.047+j*.137,.176+j*.137,
                 tint(clay,rng.uniform(.93,1.08)),.030,.35,.007)
    for x in (.00,1.67):
        for z in (-1.24,-.61):
            beam((x,.05,z),(x+.038,2.10,z+.03),.047)
        beam((x,.91,-1.39),(x,.91,-.48),.042)
    for z in (-1.24,-.61):
        beam((-.13,.91,z),(1.85,.91,z),.049)
        beam((-.02,.25,z),(1.65,1.66,z),.030)
    surface('reed')
    for j in range(19):
        z=-1.24+j*.035
        pole((-.08,.989,z),(1.77,.987,z+.007),.024,straw,6)
    for j,n in enumerate((4,3,3)):
        for i in range(n):
            surface('earth');slab(.46+i*.34+.08*(j%2),1.57,.32,.49,.05+j*.12,.163+j*.12,
                                  tint(clay,1+.017*sin(i*3+j)),.024,.35,.006)
    slab(-1.13,.92,1.26,.74,.05,.54,plaster,.062)
    tablet(-1.15,.94,.547,.60,.40)
    beam((-1.42,.63,.69),(-.90,.63,.69),.018)
    basket(-.03,.34,.065,.84)
    jar(-1.77,1.85,.051,.41,pot,(151,106,80))


BUILDERS={'scribal-house':archive, 'festival-square':square, 'irrigation-yard':irrigation,
          'threshing-floor':threshing, 'master-house':masters}

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('proposal',choices=BUILDERS)
    parser.add_argument('output',type=Path)
    parser.add_argument('--city',action='store_true')
    a=parser.parse_args()
    rng.seed(173+list(BUILDERS).index(a.proposal))
    make_ground()
    BUILDERS[a.proposal]()
    export(a.output,a.proposal)
