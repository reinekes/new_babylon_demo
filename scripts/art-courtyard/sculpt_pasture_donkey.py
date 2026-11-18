"""Rebuild the city's domestic ass from its credited AnimalMesh 3D archive.

Run with Python 3, NumPy and Pillow. Coordinates below use the supplied bind
frame (+Y up, +Z through the muzzle). Existing joints and actions stay in place.
"""
import io

import numpy as np
from PIL import Image, ImageFilter

from prepare_city_fauna import GLB
from sculpt_pasture_livestock import Asset, smooth, unit


def bell(value, center, width):
    return np.exp(-((value - center) / width) ** 2)


def shape(points):
    x, y, z = points.T
    side = np.sign(x)
    out = points.copy()
    trunk = smooth(40, 67, y) * smooth(-64, -52, z) * (1 - smooth(53, 69, z))
    loin = bell(z, -19, 18) * trunk
    shoulder = bell(z, 34, 19) * trunk
    out[:, 0] *= 1 - .105 * loin - .048 * bell(z, 0, 33) * trunk
    out[:, 1] += 4.4 * loin * (1 - smooth(59, 90, y))
    out[:, 1] += 1.5 * shoulder * smooth(80, 105, y)
    out[:, 1] -= 1.3 * bell(z, -46, 13) * smooth(79, 102, y)
    # Carry the poll just above the withers. Keep a distinctly straight nose,
    # substantial jaw and a soft broad muzzle, distinct from the lean throat.
    neck = smooth(44, 89, z) * smooth(64, 82, y)
    out[:, 1] += 3.6 * neck
    out[:, 0] *= 1 - .064 * bell(z, 74, 14) * smooth(66, 89, y)
    cheek = bell(z, 91, 10) * bell(y, 83, 14)
    out[:, 0] *= 1 + .083 * cheek
    muzzle = smooth(92, 108, z) * (1 - smooth(72, 90, y))
    out[:, 0] *= 1 + .16 * muzzle
    out[:, 1] += 3.3 * muzzle
    out[:, 2] += 2.1 * muzzle
    eye_y = np.where(x > 0,91.0,92.0) - .39*(z-np.where(x > 0,103.6,103.0))
    eyelid = bell(y, eye_y, 2.45)*bell(z,np.where(x > 0,103.6,103.0),3.4)*smooth(5,7,np.abs(x))
    out[:,1] += (y-eye_y)*eyelid*.38
    bridge = bell(z, 107, 4.4) * bell(y, 87.5, 12)
    out[:, 2] -= .85 * bridge
    # Open the concha into a long lanceolate blade. One ear listens abeam,
    # the other points down the road. The roots and skinning follow the poll.
    ear = smooth(110, 118, y) * smooth(91, 97, z)
    t = np.clip((y - 111) / 21, 0, 1.08)
    local_width = np.abs(x) - (7.0 + np.maximum(y - 114, 0) * np.where(x > 0, .62, .51))
    cavity = np.exp(-(local_width / 2.0) ** 2) * np.sin(np.minimum(t, 1) * np.pi) ** 1.4
    out[:, 1] += ear * t * np.where(x > 0, 8.5, 10)
    out[:, 2] += ear * (t * np.where(x > 0, -18, -4) - 1.05 * cavity)
    out[:, 0] += ear * (side * np.where(x > 0, .7, 1.8) * t + side * .20 * local_width)
    # Volume follows the shaft of each bent limb. The hoof, lower cannon and
    # fetlock have individual centres, including the different rearward set
    # of the near/far hind leg in the artist's bind stance.
    fore = z > 0
    centre_x = side * np.where(fore, 8.5 + .085 * y, 9.2 + .038 * y)
    centre_z = np.where(fore, np.where(x > 0, 40 - .045 * y, 54 - .23 * y),
                        np.where(x > 0, -32 - .44 * y, -47 - .32 * y))
    shaft = bell(y, 23, 11) * (1 - smooth(38, 52, y))
    out[:, 0] -= (x - centre_x) * .19 * shaft
    out[:, 2] -= (z - centre_z) * .105 * shaft
    out[:, 2] -= 1.5 * bell(y, 34, 5.2) * (~fore)
    out[:, 2] += .62 * bell(y, 33, 4.6) * fore
    hoof = 1 - smooth(4, 9, y)
    out[:, 0] -= .08 * (x - centre_x) * hoof
    out[:, 2] += .52 * hoof * smooth(-2, 4, z - centre_z)
    return out


def detailed_surface(asset, primitive):
    attrs = primitive['attributes']
    p = asset.array(attrs['POSITION']).astype(float)
    n = asset.array(attrs['NORMAL']).astype(float)
    f = asset.array(primitive['indices']).reshape(-1, 3)
    edge_stack = np.concatenate([f[:, [0, 1]], f[:, [1, 2]], f[:, [2, 0]]])
    edges, index = np.unique(np.sort(edge_stack, axis=1), axis=0, return_inverse=True)
    left, right = edges.T

    def subdivide(values):
        return np.concatenate([values, (values[left] + values[right]) * .5])

    # Weld geometry directions across texture splits while retaining their
    # separate UVs. Sharp rims, the mouth opening and hoof soles stay defined.
    _, weld = np.unique(p.round(4), axis=0, return_inverse=True)
    joined = np.zeros((weld.max() + 1, 3))
    np.add.at(joined, weld, n)
    geometric_n = unit(joined)[weld]
    delta = p[right] - p[left]
    nl, nr = geometric_n[left], geometric_n[right]
    bend = ((delta * nr).sum(1)[:, None] * nr - (delta * nl).sum(1)[:, None] * nl)
    refined = subdivide(p)
    refined[len(p):] += .14 * bend * smooth(.10, .80, (nl * nr).sum(1))[:, None]
    sole = (p[left, 1] < 1.1) & (p[right, 1] < 1.1)
    refined[len(p):, 1][sole] = (p[left[sole], 1] + p[right[sole], 1]) * .5
    i, j, k = (index + len(p)).reshape(3, -1)
    a, b, c = f.T
    triangles = np.concatenate([np.column_stack(v) for v in ((a,i,k),(i,b,j),(k,j,c),(i,j,k))])
    primitive['indices'] = asset.accessor(triangles, 'SCALAR', 5123)
    joints = asset.array(attrs['JOINTS_0'])
    weights = asset.array(attrs['WEIGHTS_0'])
    palette = np.zeros((len(p), len(asset.doc['skins'][0]['joints'])))
    np.add.at(palette, (np.arange(len(p))[:, None], joints), weights)
    palette = subdivide(palette)
    ids = np.argsort(-palette, axis=1, kind='stable')[:, :4]
    w = np.take_along_axis(palette, ids, axis=1)
    attrs['WEIGHTS_0'] = asset.accessor(w / w.sum(1, keepdims=True), 'VEC4')
    attrs['JOINTS_0'] = asset.accessor(ids, 'VEC4', 5121)
    attrs['TEXCOORD_0'] = asset.accessor(subdivide(asset.array(attrs['TEXCOORD_0'])), 'VEC2')
    return refined, unit(subdivide(n))


def model(asset):
    for i, mesh in enumerate(asset.doc['meshes']):
        prim = mesh['primitives'][0]
        attrs = prim['attributes']
        if i == 0:
            points, normal = detailed_surface(asset, prim)
        else:
            points = asset.array(attrs['POSITION']).astype(float)
            normal = asset.array(attrs['NORMAL'])
        jac = np.stack([(shape(points + d) - shape(points - d)) / .02 for d in np.eye(3) * .01], axis=-1)
        attrs['POSITION'] = asset.accessor(shape(points), 'VEC3')
        attrs['NORMAL'] = asset.accessor(unit(np.linalg.solve(jac.transpose(0,2,1), normal[:,:,None])[:,:,0]), 'VEC3')


def uv_surface(asset, size):
    # The two body sides share most of the photographic UVs. Record the
    # anatomical position at each texel so markings follow ribs, legs and face.
    p, n, faces = asset.surface()
    uv = asset.array(asset.primitive['attributes']['TEXCOORD_0']) * size - .5
    position = np.zeros((size, size, 3), dtype=np.float32)
    normal = np.zeros_like(position)
    valid = np.zeros((size, size), dtype=bool)
    for triangle in faces:
        a,b,c = uv[triangle]
        box = np.array([a,b,c])
        lo = np.maximum(np.floor(box.min(0)).astype(int), 0)
        hi = np.minimum(np.ceil(box.max(0)).astype(int) + 1, size)
        if np.any(hi <= lo):
            continue
        ax,ay = b-a
        bx,by = c-a
        det = ax*by-ay*bx
        if abs(det) < .00001:
            continue
        yy,xx = np.ogrid[lo[1]:hi[1], lo[0]:hi[0]]
        u = ((xx-a[0])*by - (yy-a[1])*bx) / det
        v = ((yy-a[1])*ax - (xx-a[0])*ay) / det
        take = (u >= -.0001) & (v >= -.0001) & (u+v <= 1.0001)
        if not take.any():
            continue
        bary = np.column_stack([1-u[take]-v[take],u[take],v[take]])
        roi = np.s_[lo[1]:hi[1], lo[0]:hi[0]]
        position[roi][take] = np.einsum('ij,jk->ik',bary,p[triangle])
        normal[roi][take] = np.einsum('ij,jk->ik',bary,n[triangle])
        valid[roi][take] = True
    return position, normal, valid


def noise(u, v):
    # C1-continuous value noise elongated in the direction of the hair grain.
    def sample(i, j):
        value = np.sin(i*127.1+j*311.7)*43758.5453
        return value - np.floor(value)
    i,j = np.floor(u),np.floor(v)
    fu,fv = u-i,v-j
    fu *= fu*(3-2*fu)
    fv *= fv*(3-2*fv)
    return ((1-fu)*((1-fv)*sample(i,j)+fv*sample(i,j+1))
            + fu*((1-fv)*sample(i+1,j)+fv*sample(i+1,j+1)))


def pad_islands(pixels, valid):
    # Bleed the nearest painted colours past the edge to protect lower mips.
    valid = valid.copy()
    for step in range(8):
        next_valid = valid.copy()
        for axis, shift in ((0,1),(1,-1),(0,-1),(1,1)):
            missing = np.roll(valid,shift,axis) & ~next_valid
            pixels[missing] = np.roll(pixels,shift,axis)[missing]
            next_valid |= missing
        valid = next_valid


def paint_coat(asset, source):
    size = 1024
    points, normals, valid = uv_surface(source, size)
    pos = points[valid].astype(float)
    x,y,z = pos.T
    side = np.abs(x)
    normal = normals[valid]
    image = asset.doc['images'][0]
    view = asset.doc['bufferViews'][image['bufferView']]
    offset = view.get('byteOffset', 0)
    photo = Image.open(io.BytesIO(asset.data[offset:offset+view['byteLength']])).convert('RGB')
    photo = photo.resize((size,size), Image.Resampling.LANCZOS)
    rgb = np.asarray(photo).astype(float)/255
    weights = np.array([.274,.593,.133])
    luminance = (rgb[valid]*weights).sum(1)
    broad = (np.asarray(photo.filter(ImageFilter.GaussianBlur(6)))[valid]*weights).sum(1)/255
    detail = (luminance-broad)
    coat = np.tile([.558,.536,.496], (len(pos),1))

    def glaze(colour, mask):
        t = np.clip(mask,0,1)[:,None]
        coat[:] = coat * (1-t) + np.asarray(colour)*t

    barrel = smooth(40,61,y)*(1-smooth(45,63,z))*smooth(-64,-52,z)
    belly = (1-smooth(48,72,y))*barrel
    glaze([.72,.68,.61], belly*.85)
    glaze([.602,.568,.51], barrel*bell(y,74,23)*.4)
    dorsal = smooth(84,100,y) * (1-smooth(.7,3.8,side)) * smooth(-63,-47,z)*(1-smooth(51,73,z))
    shoulder_band = bell(z,28-.18*(102-y),2.15+.060*(102-np.minimum(y,102)))*smooth(70,96,y)
    glaze([.259,.248,.225], .72*dorsal + shoulder_band*.56)
    scapula = bell(z, 39-.31*(90-y), 11)*bell(y,80,20)
    croup = bell(z,-40,19)*bell(y,86,20)
    glaze([.439,.427,.4], scapula*.24 + .22*croup)
    head = smooth(77,90,z)
    throat = bell(z,76,15)*bell(y,78,14)
    glaze([.64,.612,.566], .45*throat)
    muzzle = head*(1-smooth(72,87,y-.16*(z-104)))
    glaze([.73,.705,.645], .89*muzzle)
    # Preserve the photographed nostril clefts and parted lips. Localising
    # the value transfer prevents an abrupt white sock around the entire nose.
    nares = smooth(103,111,z)*(1-smooth(70,77,y)) + head*(1-smooth(60,65,y))
    bare = np.clip(nares,0,1) * (1-smooth(.12,.57,luminance))
    glaze([.226,.198,.172], bare*.86)
    eye_y = np.where(x>0,91,92) - .39*(z-np.where(x>0,103.6,103))
    orbit = bell(y,eye_y,4.0)*bell(z,np.where(x>0,103.6,103),4.3)*smooth(4,7,side)
    glaze([.72,.694,.635], orbit*.69)
    trace = bell(y,eye_y,1.58)*bell(z,np.where(x>0,103.6,103),3.0)
    glaze([.239,.210,.177], trace*(1-smooth(.14,.46,luminance))*.74)
    ear = smooth(110,119,y)*smooth(92,98,z)
    opening = ear*smooth(-.03,.72,normal[:,2])
    glaze([.505,.419,.370], opening*.84)
    axis = 7.0+np.maximum(y-114,0)*np.where(x>0,.62,.51)
    fold = bell(side,axis-1.7,.88) * bell(y,121.9,6) * opening
    glaze([.632,.548,.481], fold*.42)
    glaze([.27,.252,.225], ear*smooth(125,132,y)*.70)
    limb=(1-smooth(37,53,y))
    glaze([.46,.448,.419],limb*.82)
    socks = (1-smooth(8,17,y)) + .28*bell(y,24+.14*z,2.3) + .14*bell(y,32+.11*z,2.0)
    glaze([.31,.300,.274], socks*limb*.84)
    foot=1-smooth(5,8,y)
    glaze([.364,.339,.296],foot)
    glaze([.278,.259,.234],foot*bell(y,5.0,1.7)*.85)

    hoof_growth = np.cos(y*3.8 + .12*z + .18*side)
    coat += (hoof_growth*.012 * foot * smooth(.3,1.8,y))[:,None]

    # Local hair direction runs down and back over the barrel, turns at the
    # flank whorl and follows the bones down the lower limbs and muzzle.
    grain = .61*y-.79*z + .25*side + 2.5*np.sin(z*.044) + 1.5*np.sin(y*.08)
    flow = .79*y+.61*z+.30*side
    fine = noise(grain*2.5,flow*.63) - .5
    guard = noise(grain*4.3+19,flow*.87+55)-.5
    whorl = noise((z+side*.18)*2.65,y*.69)-.5
    fur = .74*fine+.26*guard
    fur = fur*(1-limb*.82) + whorl*limb*.82
    short = smooth(43,95,z)*smooth(61,86,y)
    close = noise((grain+.22*flow)*2.65, flow*1.68+1.6*np.sin(z*.26))-.5
    fur = fur*(1-short*.70) + close*short*.70
    coarse = noise(grain*.105,flow*.057)-.5
    organic = np.clip(detail,-.20,.23)*(.39+.33*(bare+orbit))*(1-.83*ear)
    # Scumble at the base of the nose and retain fine photographic fur only.
    density = (1-.62*foot)*(1-.42*bare)*(1-.36*short)*(1-.57*ear)
    coat += (organic + density*(.073*fur+.024*coarse) + .016*fur*ear)[:,None]
    colour = np.array(rgb * .44 + np.array([.31,.30,.28]))
    colour[valid] = coat
    pad_islands(colour,valid)
    def jpeg(pixels, quality):
        out = io.BytesIO()
        Image.fromarray(np.uint8(255*np.clip(pixels,0,1))).save(out,'JPEG',quality=quality,subsampling=0,optimize=True)
        return asset.blob(out.getvalue())
    image['bufferView'] = jpeg(colour,94)
    image['mimeType'] = 'image/jpeg'
    relief = np.zeros((size,size),dtype=np.float32)
    relief[valid] = (fur*.72 + np.clip(detail,-.1,.1)*.63)*density
    pad_islands(relief,valid)
    dy,dx = np.gradient(relief)
    normal_map = unit(np.stack([-dx*.95,dy*.95,np.ones_like(dx)],axis=-1))*.5+.5
    asset.doc['images'].append({'name':'Short hair and muzzle pores','mimeType':'image/jpeg','bufferView':jpeg(normal_map,94)})
    textures=asset.doc['textures']
    textures.append({'source':len(asset.doc['images'])-1,'sampler':textures[0]['sampler']})
    asset.doc['materials'][0]['normalTexture']={'index':len(textures)-1,'scale':.45}


def materials(asset, source):
    for i, material in enumerate(asset.doc['materials']):
        material.pop('extensions',None)
        material['pbrMetallicRoughness']={'baseColorTexture':{'index':i},'metallicFactor':0,'roughnessFactor':.90}
    asset.doc.pop('extensionsUsed',None)
    asset.doc.pop('extensionsRequired',None)
    paint_coat(asset, source)


def corneas(asset):
    # Each aperture has its own rolled bind-frame orientation. The visible
    # curved cornea sits just inside the lids, with a dark horizontal pupil.
    points, colours, faces = [], [], []
    rings, steps = 16, 64
    head = next(i for i,node in enumerate(asset.doc['nodes']) if node['name']=='Head_08')
    for side in (1,-1):
        centre = np.array([7.79,91.07,103.47]) if side>0 else np.array([-9.58,92.03,102.95])
        normal = unit(np.array([side*.807,-.10,.58]))
        across = unit(np.array([-side*.6,-.32,.77]))
        across = unit(across - normal * np.dot(across,normal))
        up = unit(np.cross(across,normal)*side)
        start=len(points)
        for ring in range(rings+1):
            count = 1 if ring==0 else steps
            for k in range(count):
                theta = 2*np.pi*k/steps
                r = ring/rings
                u = 3.08*r*np.cos(theta)
                v = 1.30*r*np.sin(theta)*(1-.26*abs(np.cos(theta)))
                # Recede under the skin at the corners while bulging through
                # the socket centrally. The outer edge is hidden by the lids.
                depth = .94*(1-r*r)-.19*r**4
                point = centre + across*u + up*v + normal*depth
                points.append(point)
                iris = np.hypot(u,v)/1.67
                colour=np.array([.015,.012,.011])
                if iris<1.18:
                    radial = .72+.20*np.sin(np.arctan2(v,u)*21+iris*3) + .12*np.sin(np.arctan2(v,u)*37)
                    colour = np.array([.107,.050,.019]) * (radial*(1-.70*smooth(.66,1.18,iris)))
                pupil = np.hypot(u/1.21,v/.34)
                colour = colour*smooth(.78,1.18,pupil) + np.array([.004,.004,.005])*(1-smooth(.78,1.18,pupil))
                glint=np.exp(-((u+.52)/.24)**2-((v-.42)/.15)**2)
                colours.append(colour + np.array([.48,.53,.55])*glint)
                if ring:
                    q = start+1+(ring-1)*steps+k
                    nxt=start+1+(ring-1)*steps+(k+1)%steps
                    if ring==1:
                        faces.append([start,q,nxt])
                    else:
                        faces.extend([[q-steps,q,nxt],[q-steps,nxt,nxt-steps]])
        if side>0:
            for face in faces[-(2*rings-1)*steps:]:
                face[1],face[2]=face[2],face[1]
    joint=asset.doc['skins'][0]['joints'].index(head)
    asset.geometry('Chestnut iris and cornea',shape(np.asarray(points)),faces,colours,
                   [[joint,0,0,0]]*len(points), [[1,0,0,0]]*len(points),.26)


def mane(asset, source):
    # Build the short upright brush over the moving midline of the neck.
    # Sample skin weights directly on the summit of each section of the neck
    # so the roots stay inside the coat when the animal twists its head.
    p,_,_ = source.surface()
    z_levels = [41.46,48.33,55.23,62.78,71.75,79.59,88.09,96.03,99.75,102.98]
    ridge = [np.argmin((p[:,2]-z)**2+p[:,0]**2+(np.maximum(0,100-p[:,1]))**2*5) for z in z_levels]
    crest = p[ridge]
    attrs=source.primitive['attributes']
    joints=source.array(attrs['JOINTS_0'])[ridge]
    w=source.array(attrs['WEIGHTS_0'])[ridge]
    palette=np.zeros((len(crest),len(source.doc['skins'][0]['joints'])))
    np.add.at(palette,(np.arange(len(crest))[:,None],joints),w)
    rng=np.random.default_rng(11013)
    points=[]; faces=[]; colours=[]; ids=[]; weights=[]
    def section(z):
        x=np.interp(z,crest[:,2],crest[:,0])
        y=np.interp(z,crest[:,2],crest[:,1])
        t=smooth(41,60,z)*(1-smooth(92,104,z))
        bond=np.array([np.interp(z,crest[:,2],influence) for influence in palette.T])
        choose=np.argsort(-bond,kind='stable')[:4]
        return x,y,t,choose,bond[choose]/bond[choose].sum()

    def add(point,colour,bind):
        points.append(point)
        colours.append(colour)
        ids.append(bind[0])
        weights.append(bind[1])

    sections=74
    profile=[(-1,-.52),(-.85,.11),(-.48,.63),(0,.79),(.48,.63),(.85,.11),(1,-.52)]
    for i,z in enumerate(np.linspace(41.5,102.4,sections)):
        x,y,t,joint,weight=section(z)
        height=.22+3.95*t
        for lateral,alt in profile:
            width=.26+1.57*t
            value=.050+.018*(alt+.5)+.006*np.sin(z*1.6+lateral)
            add([x+lateral*width,y+alt*height,z-.28*height*max(alt,0)],
                np.array([1.10,.98,.84])*value,(joint,weight))
        if i:
            for k in range(len(profile)-1):
                v=i*len(profile)+k
                a,b=v-len(profile),v-len(profile)+1
                faces.extend([[a,v,b],[b,v,v+1]])
    # Tapered guard tufts break up the edge in side view and preserve a
    # rounded crown viewed end-on. Their tips pick up the ochre sky light.
    for z in rng.uniform(42.0,102.1,272):
        x,y,t,joint,weight=section(z)
        lateral=rng.uniform(-1,1)
        half=.22+1.47*t
        height=(.32+4.9*t)*(1-.48*abs(lateral))*rng.uniform(.85,1.14)
        centre=np.array([x+lateral*half,y-.22,z])
        direction=np.array([lateral*.31+rng.uniform(-.12,.12),1,rng.uniform(-.50,-.20)])
        width=rng.uniform(.21,.43)
        tint=rng.uniform(.82,1.20)*np.array([.071,.061,.049])
        start=len(points)
        for at,diameter in ((0,1),(.72,.51)):
            for across,along in ((-1,-.76),(1,-.76),(.06,1)):
                point=centre+direction*height*at+[width*across*diameter,0,width*along*diameter]
                add(point,tint*(.76+at*.44),(joint,weight))
        add(centre+direction*height,tint*1.40,(joint,weight))
        for k in range(3):
            a0,b0=start+k,start+(k+1)%3
            faces.extend([[a0,b0,a0+3],[b0,b0+3,a0+3],[a0+3,b0+3,start+6]])
    asset.geometry('Upright mane, warm guard hairs',shape(np.array(points)),faces,colours,ids,weights,.93)

    # The source hair sheet also contains the tail switch and long fetlock
    # fringes. Preserve the tail switch, trim feathering on these clean legs.
    hair=asset.doc['meshes'][1]['primitives'][0]
    positions=asset.array(hair['attributes']['POSITION'])
    triangles=asset.array(hair['indices']).reshape(-1,3)
    centres=positions[triangles].mean(axis=1)
    tail=(centres[:,2]<-56) & (centres[:,1]>39)
    keep,indices=np.unique(triangles[tail],return_inverse=True)
    hair['indices']=asset.accessor(indices,'SCALAR',5123)
    for key,old_index in list(hair['attributes'].items()):
        old=asset.doc['accessors'][old_index]
        hair['attributes'][key]=asset.accessor(asset.array(old_index)[keep],old['type'],old['componentType'])
    img=asset.doc['images'][1]
    view=asset.doc['bufferViews'][img['bufferView']]
    start=view.get('byteOffset',0)
    data=np.asarray(Image.open(io.BytesIO(asset.data[start:start+view['byteLength']])).convert('RGBA')).copy()
    value=data[:,:,:3].astype(float).mean(axis=2)/255
    data[:,:,:3]=np.uint8(np.clip((.145+value[:,:,None]*.68)*[1.08,1.0,.89],0,1)*255)
    encoded=io.BytesIO()
    Image.fromarray(data).save(encoded,'PNG',optimize=True)
    img['bufferView']=asset.blob(encoded.getvalue())
    img['mimeType']='image/png'


def support(asset):
    # Plant the opaque hoof wall at each sample of the two in-game actions.
    # Per-sample world offsets only move the metre wrapper; the entire intact
    # skeleton retains its original joint rotations and weight transfers.
    rig = GLB.__new__(GLB)
    rig.g = dict(asset.doc)
    rig.b = asset.data
    rig.parents = {child:i for i,node in enumerate(asset.doc['nodes']) for child in node.get('children',[])}
    index = asset.doc['scenes'][0]['nodes'][0]
    skin=asset.doc['skins'][0]
    inverse=asset.array(skin['inverseBindMatrices']).reshape(-1,4,4).transpose(0,2,1)
    attrs=asset.primitive['attributes']
    p=asset.array(attrs['POSITION'])
    low=p[:,1]<9
    p=np.column_stack([p[low],np.ones(low.sum())])
    joints=asset.array(attrs['JOINTS_0'])[low]
    weights=asset.array(attrs['WEIGHTS_0'])[low]
    def ground(pose):
        world=rig.world(pose)
        mats=np.asarray([world[i] for i in skin['joints']])@inverse
        return min(sum(np.einsum('ij,ij->i',mats[joints[:,k],1],p)*weights[:,k] for k in range(4)))
    wrapper=asset.doc['nodes'][index]
    wrapper['translation'][1]-=float(ground({}))
    for clip in asset.doc['animations']:
        if clip['name'] not in ('Walk','Idle'):
            continue
        rig.g['animations']=[clip]
        channel=next(c for c in clip['channels'] if c['target']=={'node':index,'path':'translation'})
        sampler=clip['samplers'][channel['sampler']]
        original=asset.array(sampler['input'])[:,0]
        # Include original keys to preserve authored horizontal root behaviour.
        timeline=np.unique(np.r_[original,np.linspace(0,original[-1],round(float(original[-1])*110)+1)].astype('f4'))
        frames=[]
        for time in timeline:
            pose=rig.pose(time)
            translation=pose[index,'translation'].copy()
            translation[1]-=ground(pose)
            frames.append(translation)
        sampler['input']=asset.accessor(timeline,'SCALAR')
        sampler['output']=asset.accessor(frames,'VEC3')


def build():
    asset = Asset('ambient-donkey.glb')
    source = Asset('ambient-donkey.glb')
    model(asset)
    materials(asset, source)
    corneas(asset)
    mane(asset, source)
    support(asset)
    asset.doc['asset']['extras']['adaptation'] = (
        'New Babylon domestic ass. Resculpted trunk, head, pinnae and limbs. '
        'AnimalMesh 3D skeleton and original motions retained.')
    asset.doc['asset']['extras']['pastureDonkey'] = {
        'sourceFile':'ambient-donkey.glb', 'sourceAuthor':'AnimalMesh 3D',
        'forward':'+Z', 'bindEarHeightMetres':1.381, 'walkStrideMetres':.905,
        'walkDurationSeconds':1.30,
        'materials':'Warm grey dun, shoulder cross, short directional coat, dark horn and chestnut eyes.',
    }
    asset.write('donkey')


if __name__ == '__main__':
    build()
