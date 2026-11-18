"""Original livestock for New Babylon. Run with Python 3, NumPy and Pillow.

Body volumes are blended into one continuous surface, then weighted to the same
anatomical landmarks that drive the gait. Measurements below are metres in an
authoring frame with the head towards +Z. The bull and pig use local TRELLIS coat references. No old file is modified.
"""
from itertools import product
from pathlib import Path
import json
import math
import struct

import numpy as np
from livestock_surface import assign_charts, bake, part_uv

from rig_trellis_livestock import gait

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "assets/art-courtyard/models"
REFERENCE = "https://www.cambridge.org/core/journals/iraq/article/abs/animal-remains-from-abu-salabikh-preliminary-report/68037934423B75C0E5A3C08298C23C3F"

# Rump, flank, ribcage, brisket, withers, skull, cheek and bridge are distinct
# volumes. The relative lengths of these landmarks give each species its build.
SPECIES = {
    "ram": {
        "height": .83, "stride": .38, "step": .018, "wool": True,
        "volumes": [
            ((0,.59,-.27),(.208,.231,.26)), ((0,.56,.0),(.225,.248,.38)),
            ((0,.60,.245),(.196,.24,.21)), ((0,.49,.283),(.14,.16,.15)),
            ((0,.68,.28),(.167,.19,.16))],
        "neck": ((0,.68,.29),(0,.79,.49),.137,.096),
        "skull": ((0,.798,.51),(.09,.102,.12)), "cheek": ((0,.752,.564),(.088,.084,.102)),
        "face": ((0,.783,.557),(0,.665,.71),.076,.052),
        "muzzle": ((0,.662,.705),(.057,.05,.061)),
        "eyes": (.078,.809,.572), "ear": (.078,.829,.488),
        "pelvis": (.144,.60,-.30), "shoulder": (.133,.60,.26),
        "knee": (.14,.349,.23), "stifle": (.141,.40,-.192),
        "pastern": (.133,.093,.273), "hock": (.144,.208,-.35), "heel": (.141,.079,-.307),
        "radii": (.098,.046,.027,.017), "hoof": (.028,.035,.052),
    },
    "bull": {
        "height": 1.43, "stride": .69, "step": .026,
        "volumes": [
            ((0,.95,-.57),(.291,.353,.39)), ((0,.90,-.17),(.316,.34,.45)),
            ((0,.94,.20),(.329,.40,.46)), ((0,.85,.51),(.246,.32,.25)),
            ((0,1.12,.44),(.245,.30,.28))],
        "neck": ((0,1.09,.49),(0,1.26,.87),.232,.145),
        "skull": ((0,1.27,.91),(.163,.168,.195)), "cheek": ((0,1.165,.956),(.145,.16,.16)),
        "face": ((0,1.27,.96),(0,1.08,1.174),.131,.095),
        "muzzle": ((0,1.077,1.18),(.111,.086,.100)),
        "eyes": (.142,1.283,.985), "ear": (.128,1.31,.851),
        "pelvis": (.213,.997,-.63), "shoulder": (.207,1.04,.49),
        "knee": (.204,.55,.441), "stifle": (.208,.65,-.452),
        "pastern": (.197,.122,.504), "hock": (.213,.346,-.721), "heel": (.205,.12,-.645),
        "radii": (.158,.064,.043,.028), "hoof": (.047,.052,.077),
    },
    "pig": {
        "height": .64, "stride": .33, "step": .015,
        "volumes": [
            ((0,.42,-.36),(.183,.202,.21)), ((0,.43,-.1),(.188,.194,.34)),
            ((0,.444,.168),(.184,.205,.26)), ((0,.39,.30),(.14,.16,.17)),
            ((0,.506,.206),(.142,.145,.19))],
        "neck": ((0,.443,.29),(0,.472,.427),.146,.103),
        "skull": ((0,.47,.448),(.112,.129,.16)), "cheek": ((0,.401,.478),(.115,.119,.132)),
        "face": ((0,.456,.492),(0,.362,.692),.092,.059),
        "muzzle": ((0,.364,.682),(.063,.052,.077)),
        "eyes": (.099,.488,.510), "ear": (.076,.531,.401),
        "pelvis": (.125,.44,-.36), "shoulder": (.124,.442,.250),
        "knee": (.124,.238,.22), "stifle": (.125,.286,-.275),
        "pastern": (.115,.072,.249), "hock": (.124,.161,-.389), "heel": (.118,.064,-.346),
        "radii": (.094,.044,.027,.017), "hoof": (.025,.031,.042),
    },
}

def unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-10)

def blend(a, b, softness):
    h = np.maximum(softness - np.abs(a-b), 0) / softness
    return np.minimum(a, b) - h*h*softness*.25

def srgb(color):
    value=np.asarray(color)
    return np.where(value <= .04045, value/12.92, ((value+.055)/1.055)**2.4)

def rgbhex(h):
    return np.frombuffer(bytes.fromhex(h), dtype="u1") / 255

def mix(a,b,t):
    return np.asarray(a)*(1-t)+np.asarray(b)*t

class Animal:
    def __init__(self, kind):
        self.kind=kind
        self.spec=s=SPECIES[kind]
        self.bones=[]
        self.root=self.bone("trunk",(0,0,0))
        self.neck=self.bone("neck",s["neck"][0],self.root)
        self.head=self.bone("poll",s["neck"][1],self.neck)
        self.volumes=[]
        for center,radii in s["volumes"]: self.ellipsoid(center,radii,self.root,.075)
        self.segment(*s["neck"],self.neck,.064)
        self.ellipsoid(*s["skull"],self.head,.045)
        self.ellipsoid(*s["cheek"],self.head,.04)
        self.segment(*s["face"],self.head,.03)
        self.ellipsoid(*s["muzzle"],self.head,.022)
        if kind=="bull":
            self.segment((0,.71,.51),(0,1.101,.92),.077,.055,self.neck,.047)  # dewlap
        self.legs=[]
        for side,front in product([-1,1],[True,False]):
            anchors=[s[k] for k in (["shoulder","knee","pastern"] if front else ["pelvis","stifle","hock","heel"])]
            anchors=[np.array(p)*[side,1,1] for p in anchors]
            a,k,f=anchors[0],anchors[1],anchors[-1]
            # Skin the hind cannon to the ankle, leaving a pronounced backward hock.
            pivots=[a,k,anchors[2],f] if not front else [a,k,f]
            ids=[]
            for name,p in zip(["upper","lower","hock","fetlock"] if not front else ["upper","lower","fetlock"],pivots):
                ids.append(self.bone(f"{'fore' if front else 'hind'}-{'l' if side<0 else 'r'}-{name}",p,ids[-1] if ids else self.root))
            r,mid,ankle,toe=s["radii"]
            self.segment(a,k,r,mid,ids[0],.057)
            self.segment(k,anchors[2],mid,ankle,ids[1],.025)
            if not front: self.segment(anchors[2],f,ankle,ankle*.87,ids[2],.019)
            toe_pos=f+[0,-f[1]+s["hoof"][1],s["hoof"][2]*.48]
            self.segment(f,toe_pos,ankle,toe,ids[-1],.014)
            self.legs.append((side,front,pivots,ids,toe_pos))
        self.tail=self.bone("tail",s["volumes"][0][0]+np.array([0,.11,-s["volumes"][0][1][2]*.88]),self.root)
        self.ears={side:self.bone("ear-"+str(side),np.array(s["ear"])*[side,1,1],self.head) for side in (-1,1)}
        self.chunks=[]

    def sculpt_relief(self):
        s=self.spec; h=s["height"]; kind=self.kind
        # The masseter meets the lower jaw behind the corner of the mouth.
        # Relief over the orbit, cheek and front shoulder interrupts the smooth
        # primitive surfaces without adding floating patches.
        for side in (-1,1):
            eye=np.array(s["eyes"])*[side,1,1]
            cheek=np.array(s["cheek"][0]);width=s["cheek"][1][0]
            jaw=cheek+[side*width*.72,-.019*h,-.018*h]
            self.ellipsoid(jaw,[.043*h,.058*h,.08*h],self.head,.022*h)
            start=eye+[side*.001*h,.026*h,-.045*h]
            end=eye+[side*.001*h,.018*h,.047*h]
            self.segment(start,end,.024*h,.017*h,self.head,.011*h)
            end=np.array(s["muzzle"][0])+[side*s["muzzle"][1][0]*.50,-.032*h,.009*h]
            self.segment(jaw,end,.041*h,.025*h,self.head,.018*h)
            if kind=='bull':
                crest=np.array([side*.216,1.16,.48])
                self.segment(crest,[side*.277,.879,.37],.072,.068,self.root,.040)
                self.segment([side*.226,.957,-.61],[side*.215,.633,-.49],.089,.065,self.root,.045)
            elif kind=='pig':
                self.ellipsoid((side*.089,.371,.432),(.07,.078,.106),self.head,.038)
                self.ellipsoid((side*.138,.452,-.381),(.07,.126,.136),self.root,.040)

    def bone(self,name,p,parent=None):
        self.bones.append((name,np.array(p,dtype=float),parent))
        return len(self.bones)-1

    def ellipsoid(self,c,r,b,k):
        self.volumes.append(("ellipsoid",np.array(c),np.array(r),b,k))

    def segment(self,a,b,r,r2,bone,k):
        self.volumes.append(("segment",np.array(a),np.array(b),r,r2,bone,k))

    def field(self,p,rig=False):
        distance=np.full(p.shape[:-1],10.)
        scores=np.zeros((len(p),len(self.bones))) if rig else None
        for shape,*args in self.volumes:
            if shape=="ellipsoid":
                c,r,b,k=args
                delta=(p-c)/r
                length=np.linalg.norm(delta,axis=-1)
                d=length*(length-1)/np.maximum(1e-6,np.linalg.norm(delta/r,axis=-1))
            else:
                a,end,r,r2,b,k=args
                v=end-a
                t=np.clip(np.sum((p-a)*v,axis=-1)/np.dot(v,v),0,1)
                d=np.linalg.norm(p-a-t[...,None]*v,axis=-1)-mix(r,r2,t)
            distance=blend(distance,d,k)
            if rig: scores[:,b]=np.maximum(scores[:,b],np.exp(-np.maximum(d,0)/(.013*self.spec["height"]+.004)))
        return scores if rig else distance

    def add(self,verts,faces,colors,joints,weights=None,uv=None):
        verts=np.asarray(verts)
        faces=np.asarray(faces,dtype='int32')
        if np.isscalar(joints):
            j=np.zeros((len(verts),4),dtype="u1");j[:,0]=joints
            weights=np.zeros_like(j,dtype=float);weights[:,0]=1;joints=j
        colors=np.broadcast_to(colors,verts.shape)
        if uv is None: uv=np.broadcast_to([.1,.983],(len(verts),2))
        self.chunks.append((verts,faces,colors,joints,weights,uv))

    def skin(self):
        s=self.spec; step=s["step"]
        low=np.array([-s["volumes"][2][1][0]-.14,-.06,s["volumes"][0][0][2]-s["volumes"][0][1][2]-.12])
        high=np.array([-low[0],s["skull"][0][1]+s["skull"][1][1]+.14,s["muzzle"][0][2]+s["muzzle"][1][2]+.10])
        axes=[np.arange(a,b+step,step) for a,b in zip(low,high)]
        grid=np.stack(np.meshgrid(*axes,indexing="ij"),axis=-1)
        field=self.field(grid)
        corners=np.array(list(product(range(2),repeat=3)))
        cells=np.lib.stride_tricks.sliding_window_view(field,(2,2,2))
        active=np.argwhere((cells.min(axis=(-3,-2,-1))<0)&(cells.max(axis=(-3,-2,-1))>=0))
        values=field[tuple((active[:,None,:]+corners).transpose(2,0,1))]
        # A shared surface-net vertex per boundary cell yields watertight shoulders and knees.
        sums=np.zeros(active.shape); count=np.zeros(len(active))
        for i,a in enumerate(corners):
            for j,b in enumerate(corners[i+1:],i+1):
                if np.sum(abs(a-b))!=1: continue
                crossing=(values[:,i]<0)!=(values[:,j]<0)
                t=values[crossing,i]/(values[crossing,i]-values[crossing,j])
                sums[crossing]+=a+(b-a)*t[:,None];count[crossing]+=1
        v=low+(active+sums/count[:,None])*step
        lookup=np.full(field.shape,-1,dtype=int)
        lookup[tuple(active.T)]=np.arange(len(v))
        triangles=[]
        for axis in range(3):
            e=np.eye(3,dtype=int)[axis];u=np.roll(e,1);w=np.roll(e,2)
            neg=field<0
            change=np.diff(neg,axis=axis)
            edge=np.argwhere(change)
            q=np.column_stack([lookup[tuple((edge-delta).T)] for delta in [0,u,u+w,w]])
            assert np.all(q>=0)
            # u × w = e. Reverse when the negative volume is on the high side.
            negative_low=neg[tuple(edge.T)]
            q[~negative_low]=q[~negative_low,::-1]
            triangles.extend([q[:,[0,1,2]],q[:,[0,2,3]]])
        faces=np.vstack(triangles)
        scores=self.field(v,True)
        j=np.argsort(-scores,axis=1)[:,:4]
        weights=np.take_along_axis(scores,j,axis=1);weights/=weights.sum(axis=1,keepdims=True)
        x,y,z=v.T; h=s["height"]
        # Irregular geometry catches grazing light in the fleece. The finer fibre
        # pattern is carried by a tiled, embedded albedo and normal pair.
        coat=np.clip((s["neck"][1][2]-z)/(.18*h),0,1)
        coat*=np.clip((y/h-.34)/.13,0,1)
        noise=(np.sin(27*x/h+8*z/h)*np.cos(18*y/h-11*z/h)+.55*np.cos(39*z/h+10*x/h)*np.sin(27*y/h))/1.55
        def gaussian(q,center,width):
            return np.exp(-((q-center)/width)**2)
        def smooth_step(a,b,q):
            t=np.clip((q-a)/(b-a),0,1)
            return t*t*(3-2*t)
        skull=s["skull"][0]; nose=s["muzzle"][0]; eye=s["eyes"]
        snout=smooth_step(skull[2]+.005*h,nose[2]+.025*h,z)
        brow=gaussian(z,eye[2],.084*h)*gaussian(y,eye[1]+.018*h,.035*h)
        beard=gaussian(z,s["cheek"][0][2],.10*h)*gaussian(y,s["cheek"][0][1]-.064*h,.045*h)
        belly=(1-smooth_step(.47,.69,y/h))*gaussian(z,0,.41*h)
        if self.kind=="ram":
            normal=vertex_normals(v,faces)
            # Distance to irregular 3D curl centres, sampled on the surface.
            # Ridges form separate locks around the ribs, breast and shoulders.
            q=v/h*np.array([32,30,28]); grid=np.floor(q); curl=np.full(len(v),5.)
            for off in product([-1,0,1], repeat=3):
                cell=grid+off
                rand=np.sin(cell@np.array([[47.26,19.74,86.34],[73.22,31.16,28.17],[23.18,93.57,61.12]]))*43758.54
                delta=cell+.13+.74*(rand-np.floor(rand))-q
                curl=np.minimum(curl,np.sqrt((delta*delta).sum(axis=1)))
            lock=1-smooth_step(.22,.91,curl)
            v+=normal*(coat*h*(.013*lock+.004*noise))[:,None]
            c=mix(rgbhex('4e3c32'),rgbhex('c1ad8f'),coat[:,None])
            c+=((.072*noise+.119*(lock-.42))*coat)[:,None]
            c=mix(c,rgbhex('947960'),snout[:,None]*.60)
            c=mix(c,rgbhex('ba9d79'),brow[:,None]*.68)
            c=mix(c,rgbhex('8b7561'),belly[:,None]*.40)
            # A narrow white blaze over the nose, common in pied sheep.
            blaze=gaussian(x,0,.030*h)*gaussian(z,eye[2]+.042*h,.077*h)*smooth_step(.86,.94,y/h)
            c=mix(c,rgbhex('d7c5aa'),blaze[:,None]*.84)
        elif self.kind=="bull":
            # Broken-edged flank patches follow the rib cage and differ on
            # either side. The muzzle ring and fetlocks read at pasture scale.
            field=np.sin(6.6*z/h+2.1*np.sin(4.4*y/h)+5.9*x/h)+.64*np.sin(12*z/h-8*y/h+4*x/h)+.18*np.sin(27*z/h+11*y/h)
            patch=smooth_step(.18,.56,field)*(.40+.60*gaussian(z,-.16*h,.63*h))
            patch*=smooth_step(.06,.22,np.abs(x)/h)*smooth_step(.41,.55,y/h)
            c=mix(rgbhex('80543b'),rgbhex('cdbaa1'),patch[:,None]*.92)
            c+=(noise*.033)[:,None]
            c=mix(c,rgbhex('4b3b32'),(1-smooth_step(.05,.31,y/h))[:,None]*.85)
            c=mix(c,rgbhex('e0c9a9'),(snout**1.35)[:,None]*.84)
            c=mix(c,rgbhex('695244'),beard[:,None]*.7)
            c=mix(c,rgbhex('c09a71'),brow[:,None]*.63)
            blaze=gaussian(x,.004*h,.045*h)*gaussian(z,eye[2]+.021*h,.16*h)*smooth_step(.80,.89,y/h)
            c=mix(c,rgbhex('e0cfae'),blaze[:,None]*.90)
        else:
            saddle=gaussian(z,-.1*h,.50*h)*smooth_step(.62,.93,y/h)
            c=mix(rgbhex('ad8b73'),rgbhex('695b4f'),saddle[:,None]*.78)
            # Weathered gray boar bristle over a warmer ear, cheek and muzzle.
            c+=noise[:,None]*.027
            c=mix(c,rgbhex('dfad96'),(snout*.79+brow*.19)[:,None])
            c=mix(c,rgbhex('927065'),beard[:,None]*.69)
            c=mix(c,rgbhex('c4a998'),belly[:,None]*.53)
            c=mix(c,rgbhex('806657'),(1-smooth_step(.08,.30,y/h))[:,None]*.6)
        if self.kind in ("bull","pig"):
            # Delicate folds under the throat and lower cheek visibly roll over
            # the jaw as the head turns. Keep the forehead broad and taut.
            normal=vertex_normals(v,faces)
            throat=s["neck"][1][2]-.055*h
            soft=gaussian(y,s["neck"][1][1]-.116*h,.115*h)*gaussian(z,throat,.18*h)
            folds=np.sin(88*(z-.32*y)/h+1.8*np.sin(y/h*13))
            v+=normal*(h*.009*soft*folds)[:,None]
            skinfold=gaussian(y,s["eyes"][1]-.056*h,.039*h)*gaussian(z,s["eyes"][2]-.043*h,.079*h)
            v+=normal*(h*.007*skinfold)[:,None]
            c*=1+(.036*soft*folds-.074*skinfold)[:,None]
        assign_charts(self,v,faces,np.clip(c,.05,.98),j,weights,vertex_normals(v,faces))

def vertex_normals(v,f):
    n=np.zeros_like(v)
    fn=np.cross(v[f[:,1]]-v[f[:,0]],v[f[:,2]]-v[f[:,0]])
    for i in range(3): np.add.at(n,f[:,i],fn)
    return unit(n)

def parametric(animal, rings, segments, sample, color, bone):
    verts=[];colors=[];faces=[];uv=[]
    for j in range(rings+1):
        for i in range(segments):
            u=j/rings; angle=2*math.pi*i/segments
            verts.append(sample(u,angle));uv.append(part_uv(animal.part,u,angle))
            colors.append(color(u,angle) if callable(color) else color)
            if j<rings:
                a=j*segments+i;b=j*segments+(i+1)%segments
                faces.extend(((a,b,a+segments),(a+segments,b,b+segments)))
    animal.add(verts,faces,colors,bone,uv=np.asarray(uv))

def ell(animal,center,radii,color,bone,lon=18,lat=10):
    def sample(t,a):
        b=np.pi*(t-.5)
        return center+np.array(radii)*[math.cos(b)*math.cos(a),math.sin(b),-math.cos(b)*math.sin(a)]
    parametric(animal,lat,lon,sample,color,bone)

def sweep(animal,line,radius,color,bone,rings=24,sides=12,flatten=1):
    # Parallel transported section axes prevent corkscrewed ridges on the horns.
    points=np.array([line(t) for t in np.linspace(0,1,rings+1)])
    tangents=unit(np.gradient(points,axis=0))
    a=np.eye(3)[np.argmin(abs(tangents[0]))]
    basis=[]
    for tangent in tangents:
        a=unit(a-tangent*np.dot(a,tangent))
        basis.append((a,np.cross(tangent,a)))
    def sample(t,angle):
        i=round(t*rings);u,v=basis[i]
        return points[i]+radius(t)*(u*math.cos(angle)+v*flatten*math.sin(angle))
    parametric(animal,rings,sides,sample,color,bone)

def details(animal):
    s=animal.spec; kind=animal.kind; h=s["height"]
    warm=rgbhex('8d6951') if kind!='ram' else rgbhex('705443')
    hoof=rgbhex('423934')
    animal.part='hoof'
    for side,front,pivots,bones,tip in animal.legs:
        w,hh,l=s["hoof"]
        for cloven in (-1,1):
            center=tip+[cloven*w*.68,-tip[1]+hh,.005]
            def shape(t,ang):
                # Sloped front wall, a flat bearing surface and separate toes.
                span=(1-.48*t)*(.93+.07*math.sin(t*np.pi))
                return center+[w*.68*span*math.cos(ang),-hh*.92+2*hh*t,
                               -l*span*math.sin(ang)-.36*l*t]
            parametric(animal,5,13,shape,lambda t,a: hoof+.065*t,bones[-1])
            ell(animal,center+[0,hh*.91,-.35*l],[w*.37,hh*.16,l*.52],hoof+.06,bones[-1],12,6)
            ell(animal,center-[0,hh*.87,0],[w*.62,hh*.125,l*.90],hoof,bones[-1],12,6)
        # Two dewclaws behind each fetlock, above the weight-bearing toes.
        for c in (-1,1):
            ell(animal,pivots[-1]+[c*w*.55,-.008*h,-w*.71],[w*.30,w*.44,w*.39],hoof,bones[-1],10,6)
    for side in (-1,1):
        animal.part='eye'
        eye=np.array(s["eyes"])*[side,1,1]; r=.016*h
        # Locate the eye on the blended cheek after adding the orbital ridge.
        # A fixed landmark inside that volume can swallow the entire iris.
        lo,hi=abs(eye[0])*.65,abs(eye[0])+.095*h
        for _ in range(13):
            x=(lo+hi)/2
            if animal.field(np.array([[side*x,eye[1],eye[2]]]))[0]<0:lo=x
            else:hi=x
        eye[0]=side*(hi+.001*h)
        ell(animal,eye,[r*.72,r*1.13,r*1.52],rgbhex('382c26'),animal.head)
        iris=eye+[side*.004*h,0,.001*h]
        ell(animal,iris,[r*.66,r*.91,r*1.06],rgbhex('a38a5e') if kind=='ram' else rgbhex('654d3b'),animal.head)
        ell(animal,iris+[side*.005*h,0,0],[r*.51,r*(.32 if kind!='pig' else .65),r*.82],
            rgbhex('171a17'),animal.head)
        ell(animal,iris+[side*.0078*h,r*.32,r*.23],[r*.13,r*.14,r*.16],rgbhex('d6c2a5'),animal.head,10,6)
        line=lambda t: eye+[side*.005*h,r*.9*math.sin(t*np.pi),r*1.6*(2*t-1)]
        sweep(animal,line,lambda t:r*.23*(.07+math.sin(t*np.pi)),rgbhex('514031'),animal.head,14,6)
        # Shallow, folded ears, with raised rims and a pink inner shell.
        animal.part='ear'
        start=np.array(s["ear"])*[side,1,1]
        length={'ram':.121,'bull':.243,'pig':.117}[kind]
        width={'ram':.045,'bull':.074,'pig':.076}[kind]
        def ear(t,ang):
            c=np.array([side*length*t,
                        (.128*t-.040*t*t) if kind=='pig' else -.46*width*t+.23*width*math.sin(t*np.pi),
                        -length*(.31 if kind=='pig' else .34)*t])
            span=(max(.007,math.sin(np.pi*t))**.82)*width
            return start+c+[0,span*math.cos(ang),span*(.39*math.sin(ang)-.28*math.cos(ang)**2)]
        # The parametric winding is along local X here, varying with side.
        flip=side==-1
        def ear_sample(t,a): return ear(t,-a if flip else a)
        def ear_color(t,a):
            inner=np.clip(2*math.sin(-a if flip else a),0,1)*math.sin(np.pi*t)**.4
            return mix(warm,rgbhex('bb8c7c'),inner*.91)
        parametric(animal,17,18,ear_sample,ear_color,animal.ears[side])
    animal.part='nose'
    nose,radii=s["muzzle"]
    pad=np.array(nose)+[0,.002*h,radii[2]*.73]
    pad_r=np.array([radii[0]*(1.12 if kind=='pig' else .97),radii[1]*.82,radii[2]*.53])
    pad_color=rgbhex('ab8278' if kind=='pig' else '645650')
    def nose_surface(t,a):
        lat=np.pi*(t-.5)
        q=np.array([math.cos(lat)*math.cos(a),math.sin(lat),-math.cos(lat)*math.sin(a)])
        # Recessed, dark nostrils in the front face of the pad. The surrounding
        # raised rim shares vertices with the nose, including the central cleft.
        nostril=np.exp(-(((abs(q[0])-.44)/.195)**2+((q[1]-.16)/.28)**2))
        active=max(q[2],0)**2
        q[2]-=.35*nostril*active
        q[2]-=.045*math.exp(-(q[0]/.1)**2)*max(0,-q[1])
        return q,nostril*active
    def nose_point(t,a):return pad+pad_r*nose_surface(t,a)[0]
    def nose_tone(t,a):
        q,dark=nose_surface(t,a)
        rim=.052*math.exp(-((dark-.30)/.17)**2)
        return mix(pad_color,rgbhex('332b28'),min(1,2.6*dark))+rim
    parametric(animal,34,64,nose_point,nose_tone,animal.head)
    for side in (-1,1):
        start=np.array(nose)+[side*radii[0]*.92,-.008*h,-radii[2]*.45]
        line=lambda t:start+[side*radii[0]*.04*math.sin(t*np.pi),-.012*h*math.sin(t*np.pi/1.45),t*radii[2]*1.15]
        sweep(animal,line,lambda t:.0025*h*(.05+math.sin(t*np.pi)),rgbhex('48362e'),animal.head,16,6)
    if kind in ('ram','bull'):
        animal.part='horn'
        for side in (-1,1):
            if kind=='ram':
                # Spiral emerges behind poll, then turns forwards beneath the ear.
                def line(t):
                    a=.34+5.23*t; r=.12*(1-.47*t)
                    return [.064*side+side*(.051+.122*t),.823+r*math.cos(a),.485-r*math.sin(a)]
                radius=lambda t:(.042*(1-t)**.65+.0012)*(1+.045*math.sin(t*130))
            else:
                def line(t):
                    return [side*(.104+.357*t),1.376+.05*math.sin(t*np.pi)+.205*t**2,.842-.105*math.sin(t*np.pi)+.078*t*t]
                radius=lambda t:(.056*(1-t)**.73+.001)*(1+.030*math.sin(t*145))
            def horn(t,a):
                col=mix(rgbhex('897461'),rgbhex('c7b191'),min(1,t*2.4))
                col=mix(col,rgbhex('4c4037'),max(0,(t-.75)*4))
                return np.clip(col*(.95+.05*math.sin(t*130)+.03*math.cos(a*2)),0,1)
            sweep(animal,line,radius,horn,animal.head,70,18,.89)
    animal.part='tail'
    p=animal.bones[animal.tail][1]
    if kind=='pig':
        line=lambda t:p+np.array([.046*math.sin(t*7)*t,-.096*t+.032*math.sin(t*7),-.062*math.sin(np.pi*t*.60)+.030*math.cos(t*7)-.030])
        radius=lambda t:.010*(1-t*.84)
    else:
        line=lambda t:p+np.array([.04*t+.014*math.sin(4*t),-(.68 if kind=='bull' else .235)*t,-.08*math.sin(np.pi*t*.9)-.025*t])
        radius=lambda t:(.025 if kind=='bull' else .038)*(1-.79*t)
    sweep(animal,line,radius,warm,animal.tail,34,12)
    if kind=='bull':
        ell(animal,line(.92),[.035,.088,.031],rgbhex('503b31'),animal.tail,16,10)
    if kind=='pig':
        # Tapered, uneven bristles grow from the ridge, in the direction of lay.
        rng=np.random.default_rng(137)
        for z in np.linspace(-.415,.30,43):
            x=rng.uniform(-.020,.020)
            ground=.55
            for v,r in s["volumes"]:
                ratio=((z-v[2])/r[2])**2+((x-v[0])/r[0])**2
                if ratio<1: ground=max(ground,v[1]+r[1]*math.sqrt(1-ratio))
            p=np.array([x,ground-.002,z])
            length=rng.uniform(.014,.026)
            sweep(animal,lambda t:p+[.003*math.sin(t),length*t,-length*.61*t],
                  lambda t:.0024*(1-.96*t),rgbhex('675547'),animal.root,3,5)

def write_glb(animal):
    s=animal.spec;kind=animal.kind
    views=[];access=[];binary=bytearray()
    def add_bytes(content):
        while len(binary)%4:binary.append(0)
        offset=len(binary);binary.extend(content)
        views.append({"buffer":0,"byteOffset":offset,"byteLength":len(content)})
        return len(views)-1
    def accessor(a,shape,ctype,normalized=False):
        dtypes={5126:'<f4',5121:'u1',5123:'<u2',5125:'<u4'}
        a=np.ascontiguousarray(a,dtype=dtypes[ctype])
        entry={"bufferView":add_bytes(a.tobytes()),"componentType":ctype,"count":len(a),"type":shape}
        if normalized:entry["normalized"]=True
        if shape in ('VEC3','SCALAR'):
            entry["min"]=np.atleast_1d(a.min(axis=0)).tolist();entry["max"]=np.atleast_1d(a.max(axis=0)).tolist()
        access.append(entry);return len(access)-1
    arrays=list(zip(*animal.chunks));positions=np.vstack(arrays[0])
    offset=0; all_faces=[]
    for verts,faces,*_ in animal.chunks:
        all_faces.append(faces+offset);offset+=len(verts)
    faces=np.vstack(all_faces)
    # Drop tip triangles of zero area before generating vertex normals.
    fn=np.cross(positions[faces[:,1]]-positions[faces[:,0]],positions[faces[:,2]]-positions[faces[:,0]])
    faces=faces[np.linalg.norm(fn,axis=1)>1e-11]
    normals=vertex_normals(positions,faces)
    smooth=np.vstack(animal.body_normals);normals[:len(smooth)]=smooth
    norms=np.linalg.norm(normals,axis=1);normals[norms<.1]=[0,1,0]
    weights=np.vstack(arrays[4])
    encoded_weights=np.rint(weights*255).astype('int16')
    encoded_weights[:,0]+=255-encoded_weights.sum(axis=1)
    attrs={
        "POSITION":accessor(positions,'VEC3',5126),
        "NORMAL":accessor(normals,'VEC3',5126),
        "COLOR_0":accessor(np.column_stack((np.rint(np.clip(srgb(np.vstack(arrays[2])),0,1)*255),np.full(len(positions),255))),'VEC4',5121,True),
        "JOINTS_0":accessor(np.vstack(arrays[3]),'VEC4',5121),
        "WEIGHTS_0":accessor(encoded_weights,'VEC4',5121,True),
        "TEXCOORD_0":accessor(np.vstack(arrays[5]),'VEC2',5126)}
    index=accessor(faces.flatten(),'SCALAR',5123 if len(positions)<65536 else 5125)
    nodes=[];bind=[]
    for i,(name,p,parent) in enumerate(animal.bones):
        local=p if parent is None else p-animal.bones[parent][1]
        nodes.append({"name":name,"translation":local.tolist()})
        if parent is not None:nodes[parent].setdefault("children",[]).append(i)
        mat=np.eye(4);mat[3,:3]=-p;bind.append(mat.flatten())
    meshnode=len(nodes);nodes.append({"name":"sculpted-"+kind,"mesh":0,"skin":0})
    skin={"joints":list(range(meshnode)),"skeleton":0,"inverseBindMatrices":accessor(bind,'MAT4',5126)}
    clips=[]
    for walking,name,seconds in [(True,"Walk",1),(False,"Idle",3.5)]:
        count=40
        clock=accessor(np.linspace(0,seconds,count+1),'SCALAR',5126)
        samplers=[]; channels=[]
        def channel(target,path,values):
            samplers.append({"input":clock,"output":accessor(values,"VEC4" if path=="rotation" else "VEC3",5126),"interpolation":"LINEAR"})
            channels.append({"sampler":len(samplers)-1,"target":{"node":target,"path":path}})
        def rot(angle,axis):
            a=np.asarray(angle)*.5
            v=np.sin(a)[:,None]*np.asarray(axis)
            return np.column_stack((v,np.cos(a)))
        ts=np.linspace(0,1,count+1); wave=np.sin(ts*2*np.pi)
        body_drop=(.009+ .006*np.cos(ts*4*np.pi))*s["height"] if walking else np.zeros_like(ts)
        if walking:channel(0,'translation',np.column_stack((s["height"]*.005*wave,-body_drop,np.zeros_like(ts))))
        else:channel(0,'scale',np.column_stack((1+.0085*wave,1+.004*wave,np.ones_like(ts))))
        channel(animal.neck,"rotation",rot(.033*np.sin(4*np.pi*ts+.16) if walking else .033*wave,[1,0,0]))
        channel(animal.head,"rotation",rot(.019*wave if walking else .066*wave,[0,1,0]))
        channel(animal.tail,"rotation",rot(.19*np.sin(ts*2*np.pi) if walking else .215*np.sin(ts*2*np.pi)**3,[0,0,1]))
        for side,ear in animal.ears.items():
            ear_flick=(np.maximum(0,np.sin(ts*2*np.pi+side*.9))**10)*(.09 if walking else .20)
            channel(ear,'rotation',rot(ear_flick*side,[0,0,1]))
        if walking:
            for side,front,pivots,ids,_ in animal.legs:
                shift=(0 if side<0 else .5)+(.22 if front else 0)
                angles=np.array([gait(pivots[:3],(phase+shift)%1,s["stride"],.066*s["height"],drop) for phase,drop in zip(ts,body_drop)])
                channel(ids[0],'rotation',rot(angles[:,0],[1,0,0]))
                channel(ids[1],'rotation',rot(angles[:,1],[1,0,0]))
                channel(ids[2],'rotation',rot(-angles.sum(axis=1),[1,0,0]))
        clips.append({"name":name,"channels":channels,"samplers":samplers})
    textures,coat_source=bake(animal,OUTPUT)
    maps=[{"bufferView":add_bytes(data),"mimeType":"image/jpeg"} for data in textures]
    while len(binary)%4:binary.append(0)
    gltf={
        "asset":{"version":"2.0","generator":"New Babylon, original alluvial herd sculpt","extras":{
            "author":"Новый Вавилон","license":"Авторская игровая модель проекта","source":"https://github.com/reinekes/new_babylon_demo/blob/main/scripts/art-courtyard/sculpt_alluvial_livestock.py",
            "archaeozoology":REFERENCE,"reconstruction":"Original interpretation of an individual coat, horns and proportions; no ancient breed identification."}},
        "scene":0,"scenes":[{"nodes":[0,meshnode]}],"nodes":nodes,
        "meshes":[{"name":"alluvial-"+kind,"primitives":[{"attributes":attrs,"indices":index,"material":0}]}],
        "skins":[skin],"animations":clips,"materials":[{"name":kind+"-coat-and-features","pbrMetallicRoughness":{
            "baseColorTexture":{"index":0},"metallicRoughnessTexture":{"index":2},"metallicFactor":0,"roughnessFactor":1},"normalTexture":{"index":1,"scale":.88},"occlusionTexture":{"index":2,"strength":.65}}],
        "images":maps,"textures":[{"source":i,"sampler":0} for i in range(3)],
        "samplers":[{"wrapS":10497,"wrapT":10497,"minFilter":9987,"magFilter":9729}],
        "accessors":access,"bufferViews":views,"buffers":[{"byteLength":len(binary)}]}
    if coat_source:
        gltf["asset"]["extras"]["coat_reference"]={**{key:coat_source[key] for key in ["author","source","license"]},
            "file":f"test-{kind}-trellis.glb","adaptation":"Side-view coat luminance and anatomical relief registered to an independently sculpted mesh; fibres, pigment, normal and roughness maps authored anew."}
    header=json.dumps(gltf,ensure_ascii=False,separators=(',',':')).encode()
    header+=b' '*(-len(header)%4)
    data=(struct.pack('<4sIII4s',b'glTF',2,28+len(header)+len(binary),len(header),b'JSON')+header+
          struct.pack('<I4s',len(binary),b'BIN\0')+binary)
    path=OUTPUT/f"alluvial-{kind}.glb"
    path.write_bytes(data)
    print(path.name,len(positions),"vertices",len(faces),"triangles",len(data),"bytes",flush=True)

if __name__=="__main__":
    for species in SPECIES:
        animal=Animal(species)
        animal.sculpt_relief()
        animal.skin()
        details(animal)
        write_glb(animal)
