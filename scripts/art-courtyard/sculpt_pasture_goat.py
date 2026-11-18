"""Rebuild the pasture doe from the CC BY GerardoA400 goat bundled with the city.

Run with Python 3, numpy and Pillow. All measurements below use the original
animal's bind frame: +Y up, +Z towards the muzzle, 0.30 m per source unit.
"""
import io
import numpy as np
from PIL import Image, ImageFilter
from sculpt_pasture_livestock import Asset, smooth, unit
from prepare_city_fauna import GLB


def gaussian(v, center, spread):
    return np.exp(-((v-center)/spread)**2)


def sculpt(points, part):
    x,y,z=points.T
    out=points.astype(float).copy()
    side=np.abs(x)
    trunk=smooth(.94,1.55,y)*(1-smooth(1.30,1.90,z)) * smooth(-1.65,-1.25,z)
    # Rib cage, shallow barrel and tucked flank of an adult doe.
    flank=gaussian(z,-.68,.55)*trunk
    ribs=gaussian(z,.15,.86)*trunk
    chest=gaussian(z,.98,.49)*trunk
    out[:,0]*=1-.20*flank-.12*ribs-.12*chest
    out[:,1]+=.28*flank*(1-smooth(1.49,2.36,y))
    out[:,1]+=.095*chest*smooth(2.07,2.69,y)
    out[:,1]-=.065*chest*(1-smooth(1.37,2.10,y))
    # The neck grows out of the withers and narrows towards the poll.
    neck=smooth(1.40,2.12,z)*smooth(1.76,2.55,y)
    out[:,0]*=1-.075*neck
    out[:,1]+=.15*neck+.045*chest*smooth(2.32,2.72,y)
    out[:,2]+=.08*neck
    # A quieter topline at the loin, sloping smoothly into the croup.
    out[:,1]-=.075*gaussian(z,-1.20,.39)*smooth(2.02,2.65,y)

    # A fine jaw ending in a small tuft, continuous with the chin skin.
    beard=smooth(2.08,2.24,z)*(1-smooth(2.56,2.74,z))*(1-smooth(2.37,2.57,y))
    out[:,0]*=1-.71*beard
    out[:,1]+=np.maximum(2.53-y,0)*.955*beard
    out[:,2]+=.055*beard
    muzzle=smooth(2.45,2.9,z)*(1-smooth(2.86,3.10,y))
    out[:,0]*=1-.12*muzzle
    out[:,1]+=.054*muzzle
    out[:,2]+=.043*muzzle
    # A slight stop over the nasals and the separate upper and lower lip.
    bridge=gaussian(z,2.64,.16)*smooth(2.76,2.96,y)
    out[:,1]-=.042*bridge
    lip=smooth(2.47,2.71,z)*(1-smooth(2.49,2.59,y))
    oral_seam=2.506-.14*(z-2.68)
    out[:,1]+=.91*np.maximum(oral_seam-y,0)*lip
    out[:,0]*=1-.155*lip
    out[:,2]-=.087*lip
    eyelid=gaussian(z,2.45,.13)*gaussian(y,2.881,.072)*smooth(.15,.26,side)
    out[:,1]+=.30*(y-2.881)*eyelid
    nose=gaussian(z,2.829,.045)*gaussian(y,2.525+.17*(z-2.829),.027)
    out[:,0]-=np.sign(x)*.031*nose*smooth(.055,.105,side)
    # The backward rake of the horns clears the ear opening in profile.
    if part=='horn':
        tip=np.clip((2.30-z)/.42,0,1)
        out[:,2]-=.255*tip
        out[:,1]+=.21*np.sin(tip*np.pi*.77)
        out[:,0]+=np.sign(x)*.072*tip
    if part in ('coat','hair'):
        pinna=smooth(.302,.635,side)*smooth(2.87,3.00,y)*smooth(1.94,2.18,z)
        out[:,0]+=np.sign(x)*.095*pinna
        out[:,2]-=.23*pinna
        out[:,1]-=.17*pinna
        # Rotate around the root. Shifting only the tip folds the original
        # taper back onto itself and leaves a hooked, pinched end.
        dz=z+1.345;dy=y-2.337
        axis_tail=2.337+.68*dz
        tail=smooth(1.31,1.505,-z)*(1-smooth(.105,.18,np.abs(y-axis_tail)))*(1-smooth(.12,.25,side))
        ang=.99*tail; c=np.cos(ang); t=np.sin(ang)
        out[:,1]+=dy*(c-1)-dz*t
        out[:,2]+=dy*t+dz*(c-1)
        out[:,0]*=1+.48*tail
        # Narrow each cannon around its own centre, keeping the hoof sole
        # and original joint pivots in place throughout the walk.
        front=smooth(.16,.59,z)
        leg=(1-smooth(.72,1.24,y))*(1-smooth(1.36,1.68,z))
        cannon=leg*gaussian(y,.55,.31)
        center_x=np.sign(x)*(.297+.011*front)
        out[:,0]-=(x-center_x)*(.24*cannon)
        center_z=front*.925+(1-front)*(-.98)
        out[:,2]-=(z-center_z)*(.155*cannon)
        out[:,2]-=.052*(1-front)*gaussian(y,.91,.15)
        out[:,2]+=.033*front*gaussian(y,.88,.13)
        # Narrow towards the hock below the gaskin; the thigh keeps its
        # fullness above the stifle. Both claws retain a separate front edge.
        hock=gaussian(y,1.06,.28)*(1-front)
        out[:,0]-=(x-center_x)*.19*hock
        out[:,2]-=(z+.99)*.14*hock
        toe_z=np.where(z>0,1.103,-.768)
        cleft=gaussian(side,np.where(z>0,.249,.301),.027)*gaussian(z,toe_z,.096)*(1-smooth(.079,.167,y))
        out[:,2]-=.060*cleft
        if part=='hair':
            # The old transparent feather cards can reach below the actual toe.
            out[:,1]+=.16*(1-smooth(.02,.31,y))
    return out


def coat_colors(points):
    x,y,z=points.T
    side=np.abs(x)
    def blend(rgb, mask):
        nonlocal coat
        w=np.clip(mask,0,1)[:,None]
        coat=coat*(1-w)+np.asarray(rgb)*w
    coat=np.tile([.61,.352,.171],(len(x),1))
    # Lighter belly and insides of the legs, warm ribs and a narrow dark saddle.
    belly=(1-smooth(1.26,1.84,y))*(1-smooth(1.35,1.95,z))*smooth(.72,1.14,y)
    blend([.86,.705,.46],belly*.85)
    flank=gaussian(z,-.57,.79)*gaussian(y,1.97,.60)
    blend([.72,.462,.224],flank*.44)
    dorsal=smooth(2.38,2.69,y)*(1-smooth(.035,.255,side))*(1-smooth(1.75,2.21,z))
    blend([.205,.124,.071],dorsal*.92)
    breast=gaussian(z,1.36,.54)*gaussian(y,1.73,.57)
    blend([.39,.247,.14],breast*.58)
    head=smooth(1.92,2.26,z)*smooth(2.27,2.70,y)
    bridge=gaussian(x,0,.185)*gaussian(y+.65*(z-2.43),3.01,.44)
    blend([.26,.153,.095],head*bridge*.73)
    eyebrow=gaussian(y+.47*(z-2.48),2.993,.082)*smooth(.14,.31,side)
    blend([.86,.70,.47],head*eyebrow*.93)
    orbit=gaussian(z,2.454,.15)*gaussian(y,2.883,.081)*smooth(.17,.26,side)
    blend([.13,.078,.049],orbit*.91)
    cheek=gaussian(y+.36*(z-2.47),2.765,.067)*gaussian(z,2.49,.26)*smooth(.12,.26,side)
    blend([.90,.75,.52],cheek*.80)
    muzzle=smooth(2.70,2.89,z)*(1-smooth(2.71,2.94,y))
    blend([.255,.164,.115],muzzle*.72)
    slit=gaussian(y,2.522+.17*(z-2.829),.027)*gaussian(z,2.829,.047)*smooth(.04,.082,side)
    blend([.055,.032,.021],slit)
    lipline=gaussian(y,2.466-.17*(z-2.728),.026)*gaussian(z,2.748,.142)
    blend([.114,.074,.048],lipline*.81)
    chin=smooth(2.06,2.27,z)*(1-smooth(2.24,2.54,y))
    blend([.265,.171,.104],chin*.78)
    ear=smooth(.36,.60,side)*smooth(2.93,3.08,y)*smooth(2.10,2.26,z)
    blend([.57,.323,.237],ear*.85)
    legs=(1-smooth(.48,1.10,y))
    blend([.215,.15,.101],legs*(.69+.21*smooth(.15,.36,side)))
    hoof=(1-smooth(.105,.225,y))
    edge=smooth(.018,.12,np.abs(side-np.where(z>0,.249,.301)))
    blend([.39,.315,.246],hoof*(.44+.50*edge))
    return coat


def color_attribute(asset, primitive, colors):
    rgba=np.column_stack([np.clip(colors,0,1),np.ones(len(colors))])
    primitive['attributes']['COLOR_0']=asset.accessor(np.rint(rgba*255),'VEC4',5121,True)


def chin_hair(a, positions, faces):
    # Seed tapered fibre bundles on the real skin under the jaw. Each bundle
    # follows the head joint, including when the doe browses.
    tri=positions[faces]
    centers=tri.mean(axis=1)
    x,y,z=centers.T
    area=np.linalg.norm(np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]),axis=1)
    density=area*gaussian(x,0,.075)*gaussian(z,2.408,.076)
    density*=smooth(1.84,2.02,y)*(1-smooth(2.14,2.33,y))
    rng=np.random.default_rng(3461)
    which=rng.choice(len(faces),112,p=density/density.sum())
    u=np.sqrt(rng.random(len(which)));v=rng.random(len(which))
    bary=np.column_stack([1-u,u*(1-v),u*v])
    start=sculpt(np.einsum('ij,ijk->ik',bary,tri[which]),'coat')
    start[:,1]+=.027
    axis_width=unit(np.column_stack([rng.uniform(-1,1,len(start)),np.zeros(len(start)),rng.uniform(-1,1,len(start))]))
    thick=rng.uniform(.003,.012,len(start))[:,None]
    side=axis_width*thick
    direction=np.column_stack([rng.uniform(-.13,.13,len(start)),-np.ones(len(start)),rng.uniform(-.43,-.15,len(start))])
    length=rng.uniform(.11,.24,len(start))[:,None]
    end=start+direction*length
    middle=start+direction*.57*length
    middle[:,2]+=.015
    pts=np.stack([start-side,start+side,middle+.70*side,middle-.70*side,end],axis=1)
    f=np.concatenate([np.array([[0,1,2],[0,2,3],[3,2,4]])+5*i for i in range(len(start))])
    tone=rng.uniform(.64,1.5,len(start))[:,None]*np.array([.176,.108,.061])
    colors=np.repeat(tone[:,None,:],5,axis=1);colors[:,3:]*=1.14
    number=len(start)*5
    a.geometry('Short mandibular hair tufts',pts.reshape(-1,3),f,colors.reshape(-1,3),
               [[8,0,0,0]]*number,[[1,0,0,0]]*number,.97)


def ground_support(a):
    # The downloaded rig was grounded against the tip of a transparent hair
    # card. Use the skinned, opaque soles and lift the hip in its parent's
    # actual coordinate basis at every walk key.
    rig=GLB.__new__(GLB)
    rig.g=dict(a.doc);rig.b=a.data
    rig.parents={child:i for i,node in enumerate(a.doc['nodes']) for child in node.get('children',[])}
    skin=a.doc['skins'][0]
    inverse=a.array(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    attrs=a.doc['meshes'][1]['primitives'][0]['attributes']
    pos=a.array(attrs['POSITION']); soles=pos[:,1]<.26
    vertices=np.column_stack([pos[soles],np.ones(soles.sum())])
    joints=a.array(attrs['JOINTS_0'])[soles]; weights=a.array(attrs['WEIGHTS_0'])[soles]
    def bottom(world):
        matrices=np.asarray([world[i] for i in skin['joints']])@inverse
        return min(sum(np.einsum('ij,ij->i',matrices[joints[:,k],1],vertices)*weights[:,k] for k in range(4)))
    wrapper=a.doc['nodes'][a.doc['scenes'][0]['nodes'][0]]
    wrapper['translation'][1]-=float(bottom(rig.world({})))
    hip=next(i for i,n in enumerate(a.doc['nodes']) if n.get('name')=='root.x_30')
    for clip in a.doc['animations']:
        if clip['name'] not in ('Walk','Rest'):continue
        rig.g['animations']=[clip]
        channel=next(c for c in clip['channels'] if c['target']=={'node':hip,'path':'translation'})
        track=clip['samplers'][channel['sampler']]
        times=a.array(track['input'])[:,0]
        positions=a.array(track['output'])
        for i,t in enumerate(times):
            world=rig.world(rig.pose(t))
            local_up=np.linalg.solve(world[rig.parents[hip]][:3,:3],np.array([0.,1.,0.]))
            positions[i]-=local_up*bottom(world)
        track['output']=a.accessor(positions,'VEC3')


def build():
    a=Asset('goat-downloaded.glb')
    for mesh_index,mesh in enumerate(a.doc['meshes']):
        part=['horn','coat','hair','eye','eye'][mesh_index]
        for prim in mesh['primitives']:
            attrs=prim['attributes']
            pos=a.array(attrs['POSITION']).astype(float)
            norm=a.array(attrs['NORMAL']).astype(float)
            delta=np.eye(3)*.0001
            jac=np.stack([(sculpt(pos+v,part)-sculpt(pos-v,part))/.0002 for v in delta],axis=-1)
            attrs['POSITION']=a.accessor(sculpt(pos,part),'VEC3')
            attrs['NORMAL']=a.accessor(unit(np.linalg.solve(jac.transpose(0,2,1),norm[:,:,None])[:,:,0]),'VEC3')
            attrs.pop('TANGENT',None)
            if part in ('coat','hair'):
                color_attribute(a,prim,coat_colors(pos))
            if part=='horn':
                tip=np.clip((2.31-pos[:,2])/.43,0,1)
                age=.5+.5*np.cos((tip+.10*tip**2)*np.pi*30)
                horn=np.array([.64,.515,.363])*(.92-.44*tip+.22*age**5)[:,None]
                color_attribute(a,prim,horn)
    body=a.doc['meshes'][1]['primitives'][0]
    source=Asset('goat-downloaded.glb')
    source_body=source.doc['meshes'][1]['primitives'][0]
    chin_hair(a,source.array(source_body['attributes']['POSITION']),a.array(body['indices']).reshape(-1,3))
    for i,material in enumerate(a.doc['materials']):
        pbr=material['pbrMetallicRoughness']
        pbr['metallicFactor']=0
        if i<3:pbr['roughnessFactor']=.91
        if i==2:pbr['baseColorFactor']=[.86,.84,.80,.13]
    # Calibrated normal maps retain the original hair and horn grooves.
    # Keep opacity exactly; compact high-entropy opaque normals without chroma
    # subsampling so their signed tangent components stay registered.
    for i,image in enumerate(a.doc['images']):
        view=a.doc['bufferViews'][image['bufferView']]
        source=a.data[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
        if i not in (2,4,5,6,8,10):continue
        im=Image.open(io.BytesIO(source)).convert('RGB')
        if i==4:
            # The photographed coat contains broad shadows from the capture.
            # Remove this baked lighting while retaining individual fibres.
            val=np.asarray(im).astype(float)/255.
            broad=np.asarray(im.filter(ImageFilter.GaussianBlur(15))).astype(float)/255.
            neutral=np.clip(np.mean(broad,axis=2,keepdims=True),.025,1)
            correction=np.clip((.78/neutral)**.42,.89,1.25)
            chroma=val[:,:,0]-val[:,:,1]
            bare_skin=smooth(.038,.17,chroma)[:,:,None]
            luma=(val[:,:,0]*.30+val[:,:,1]*.59+val[:,:,2]*.11)[:,:,None]
            val=val*(1-.55*bare_skin)+luma*.55*bare_skin
            im=Image.fromarray(np.uint8(np.clip(val*correction*255,0,255)))
        elif i==8:
            # Warm the photographed iris while retaining the dark pupil.
            e=np.asarray(im).astype(float)/255.
            yy,xx=np.indices(e.shape[:2]);u=xx/(im.width-1)-.5;v=yy/(im.height-1)-.5
            iris=(1-smooth(.155,.190,np.hypot(u,v)))*smooth(.11,.28,e.max(axis=2))
            e=(e*(1-iris[:,:,None]*.48)+np.array([.72,.52,.236])*iris[:,:,None]*.48)
            im=Image.fromarray(np.uint8(np.clip(255*e,0,255)))
        if i in (2,10):im.thumbnail((512,512),Image.Resampling.LANCZOS)
        if i==6:im.thumbnail((768,768),Image.Resampling.LANCZOS)
        out=io.BytesIO(); im.save(out,'JPEG',quality=96 if i!=5 else 94,subsampling=0,optimize=True)
        image['bufferView']=a.blob(out.getvalue());image['mimeType']='image/jpeg'
    a.doc['asset']['extras']['pastureDoe']={
        'sourceFile':'goat-downloaded.glb','sourceAuthor':'GerardoA400',
        'changes':'Adult doe: resculpted rib cage, withers, loin, neck, jaw, ears, tail, horn sweep and lower leg anatomy, regional short-coat pigmentation.',
        'orientation':'same +Z as the credited source','metresPerSourceUnit':.30,
    }
    a.doc['asset']['extras']['adaptation']=a.doc['asset']['extras']['pastureDoe']['changes']
    ground_support(a)
    a.write('goat')


if __name__=='__main__':
    build()
