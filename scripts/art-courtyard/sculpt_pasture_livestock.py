"""Build the pasture animals from the individually credited meshes in the game.

All coordinates describe the original skinned mesh's bind pose. The original
files remain the inputs and can be opened independently in the model atlas.
"""
import argparse
import io
import json
import math
import struct
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from prepare_city_fauna import GLB

MODELS = Path(__file__).resolve().parents[2] / "assets/art-courtyard/models"
TYPES = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
DTYPES = {5121: "u1", 5123: "<u2", 5125: "<u4", 5126: "<f4"}


def smooth(lo, hi, value):
    t = np.clip((value - lo) / (hi - lo), 0, 1)
    return t*t*(3-2*t)


def unit(v):
    return v / np.maximum(np.linalg.norm(v, axis=-1, keepdims=True), 1e-12)


class Asset:
    def __init__(self, name):
        raw = (MODELS / name).read_bytes()
        length = struct.unpack_from("<I", raw, 12)[0]
        self.doc = json.loads(raw[20:20+length])
        self.data = bytearray(raw[28+length:])
        self.primitive = self.doc["meshes"][0]["primitives"][0]

    def array(self, index):
        a = self.doc["accessors"][index]
        v = self.doc["bufferViews"][a["bufferView"]]
        dtype = np.dtype(DTYPES[a["componentType"]])
        size = TYPES[a["type"]]
        return np.ndarray((a["count"], size), dtype, self.data, v.get("byteOffset", 0)+a.get("byteOffset", 0),
                          (v.get("byteStride", size*dtype.itemsize), dtype.itemsize)).copy()

    def blob(self, data):
        self.data.extend(bytes(-len(self.data) % 4))
        view = {"buffer": 0, "byteOffset": len(self.data), "byteLength": len(data)}
        self.doc["bufferViews"].append(view)
        self.data.extend(data)
        return len(self.doc["bufferViews"])-1

    def accessor(self, rows, type_name, component=5126, normalized=False):
        rows = np.ascontiguousarray(rows, dtype=DTYPES[component]).reshape(-1,TYPES[type_name])
        entry = {"bufferView": self.blob(rows.tobytes()), "componentType": component, "count":len(rows), "type":type_name,
                 "min": rows.min(axis=0).tolist(), "max":rows.max(axis=0).tolist()}
        if normalized:
            entry["normalized"] = True
        self.doc["accessors"].append(entry)
        return len(self.doc["accessors"])-1

    def surface(self):
        a = self.primitive["attributes"]
        return self.array(a["POSITION"]), self.array(a["NORMAL"]), self.array(self.primitive["indices"]).reshape(-1,3)

    def geometry(self, label, points, faces, colors, joints, weights, roughness):
        points, faces = np.asarray(points), np.asarray(faces)
        norm = normals(points, faces)
        attrs = {"POSITION": self.accessor(points,"VEC3"),"NORMAL":self.accessor(norm,"VEC3"),
                 "COLOR_0": self.accessor(np.column_stack([np.clip(colors,0,1),np.ones(len(colors))])*255,"VEC4",5121,True),
                 "JOINTS_0":self.accessor(joints,"VEC4",5121),"WEIGHTS_0":self.accessor(weights,"VEC4")}
        mats = self.doc["materials"]
        mats.append({"name":label,"doubleSided":True,"pbrMetallicRoughness":{"metallicFactor":0,"roughnessFactor":roughness}})
        prim = {"attributes":attrs,"indices":self.accessor(faces,"SCALAR",5123),"material":len(mats)-1}
        meshes=self.doc["meshes"]; meshes.append({"name":label,"primitives":[prim]})
        nodes=self.doc["nodes"]; owner=next(i for i,n in enumerate(nodes) if n.get("mesh")==0)
        sibling={**nodes[owner],"name":label,"mesh":len(meshes)-1}
        nodes.append(sibling)
        parent=next((n["children"] for n in nodes if owner in n.get("children",[])),self.doc["scenes"][0]["nodes"])
        parent.append(len(nodes)-1)

    def write(self, species):
        # Existing accessors can share interleaved buffer views. Keep each
        # referenced view once and drop superseded meshes and baked textures.
        refs=[]
        for mesh in self.doc["meshes"]:
            for prim in mesh["primitives"]:
                refs.extend((prim["attributes"],k) for k in prim["attributes"])
                refs.append((prim,"indices"))
                for morph in prim.get("targets",[]):
                    refs.extend((morph,k) for k in morph)
        for anim in self.doc["animations"]:
            for sampler in anim["samplers"]:
                refs.extend([(sampler,"input"),(sampler,"output")])
        refs.extend((skin,"inverseBindMatrices") for skin in self.doc["skins"])
        def compact(array_name,references):
            old=self.doc[array_name]
            indices=sorted({obj[key] for obj,key in references});renumber={j:i for i,j in enumerate(indices)}
            self.doc[array_name]=[old[j] for j in indices]
            for obj,key in references:obj[key]=renumber[obj[key]]
        compact("accessors",refs)
        refs=[(obj,"bufferView") for obj in [*self.doc["accessors"],*self.doc["images"]]]
        compact("bufferViews",refs)
        compacted=bytearray()
        for view in self.doc["bufferViews"]:
            offset=view.get("byteOffset",0);size=view["byteLength"]
            compacted.extend(bytes(-len(compacted)%4));view["byteOffset"]=len(compacted)
            compacted.extend(self.data[offset:offset+size])
        self.data=compacted
        self.doc["asset"]["generator"]="New Babylon pasture animal workshop"
        self.data.extend(bytes(-len(self.data)%4))
        self.doc["buffers"]=[{"byteLength":len(self.data)}]
        meta=json.dumps(self.doc,ensure_ascii=False,separators=(",",":")).encode()
        meta+=b" "*(-len(meta)%4)
        raw=struct.pack("<4sIIII",b"glTF",2,28+len(meta)+len(self.data),len(meta),0x4E4F534A)+meta
        raw+=struct.pack("<II",len(self.data),0x004E4942)+self.data
        (MODELS / f"pasture-{species}.glb").write_bytes(raw)


def normals(points, faces):
    n=np.zeros_like(points,dtype=float)
    tri=points[faces]
    face=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
    for k in range(3):
        np.add.at(n,faces[:,k],face)
    return unit(n)


def refine_fleece(asset, points, directions, faces, coat):
    # Refine only once. Interpolate the existing UV islands, facial shape keys
    # and the four strongest skin influences, including the eyelid animation.
    paths=np.concatenate([faces[:,[0,1]],faces[:,[1,2]],faces[:,[2,0]]])
    edges,ix=np.unique(np.sort(paths,axis=1),axis=0,return_inverse=True)
    left,right=edges.T
    def mid(a):
        return np.concatenate([a,(a[left]+a[right])*.5])
    delta=points[right]-points[left]
    projections=(np.sum(delta*directions[left],axis=1)[:,None]*directions[left]
                 -np.sum(delta*directions[right],axis=1)[:,None]*directions[right])
    refined=mid(points)
    refined[len(points):]-=.19*projections
    normals_=unit(mid(directions))
    coat_=mid(coat[:,None])[:,0]
    x,y,z=refined.T
    waves=.035*np.sin(10*z+2.8*y+1.5*np.sin(7*x))+.047*np.sin(6.7*z-3.4*x+np.sin(5*y))
    refined+=normals_*(coat_*waves)[:,None]
    i,j,k=(ix+len(points)).reshape(3,-1)
    a,b,c=faces.T
    triangles=np.vstack([np.column_stack(rows) for rows in [(a,i,k),(i,b,j),(k,j,c),(i,j,k)]])
    attrs=asset.primitive['attributes']
    weights=asset.array(attrs['WEIGHTS_0']); joints=asset.array(attrs['JOINTS_0'])
    palette=len(asset.doc['skins'][0]['joints'])
    full=np.zeros((len(points),palette))
    np.add.at(full,(np.arange(len(points))[:,None],joints),weights)
    full=mid(full); ids=np.argsort(-full,axis=1)[:,:4]
    weights=np.take_along_axis(full,ids,axis=1); weights/=weights.sum(axis=1,keepdims=True)
    for key,access in list(attrs.items()):
        adef=asset.doc['accessors'][access]
        if key=='POSITION': arr=refined
        elif key=='NORMAL': arr=normals_
        elif key=='WEIGHTS_0': arr=weights
        elif key=='JOINTS_0': arr=ids
        else: arr=mid(asset.array(access).astype(float))
        attrs[key]=asset.accessor(arr,adef['type'],adef['componentType'],adef.get('normalized',False))
    for target in asset.primitive.get('targets',[]):
        for key,access in list(target.items()):
            target[key]=asset.accessor(mid(asset.array(access)),'VEC3')
    asset.primitive['indices']=asset.accessor(triangles,'SCALAR',5123)


def ram():
    asset=Asset("ambient-sheep-kenchoo.glb")
    p,n,f=asset.surface(); x,y,z=p.T.copy()
    body=smooth(1.5,2.7,y)*(1-smooth(2.45,3.5,z))
    breast=np.exp(-((z-1.55)/1.45)**2)*body
    p[:,0]*=1+.14*body+.20*breast
    p[:,1]+=.23*breast*smooth(3.8,5,y)-.14*breast*(1-smooth(2.1,3.5,y))
    crown=smooth(2.75,3.17,z)*(1-smooth(3.7,4.55,z))*smooth(4.7,5.55,y)
    p[:,0]*=1+.23*crown
    p[:,1]+=.095*crown
    # Bend the original two tail joints' envelope down at the rump. Broaden
    # the tail base and leave a narrow wool-covered tip clear of the hocks.
    tail=smooth(2.36,3.36,-z)*smooth(3.48,3.73,y)
    p[:,2]+=.67*tail
    p[:,1]-=1.02*tail
    p[:,0]*=1+.24*tail
    pinna=smooth(.50,.85,np.abs(x))*smooth(3.05,3.36,z)*(1-smooth(3.53,3.76,z))*smooth(5.16,5.32,y)
    p[:,0]+=np.sign(x)*.37*pinna
    p[:,1]-=.11*pinna
    p[:,2]+=.23*pinna
    # Dark, short hair around the cheeks, with a tawny line along the bridge.
    head=smooth(2.9,3.55,z)*smooth(3.35,4.5,y)
    leg=(1-smooth(.8,2.02,y))*.68
    tone=np.tile([.91,.85,.72],(len(p),1))
    tone*=1-head[:,None]*np.array([.27,.49,.60])
    tone*=1-leg[:,None]*np.array([.42,.51,.56])
    attrs=asset.primitive["attributes"]
    attrs["POSITION"]=asset.accessor(p,"VEC3")
    attrs["COLOR_0"]=asset.accessor(np.column_stack([tone,np.ones(len(tone))])*255,"VEC4",5121,True)
    refine_fleece(asset,p,n,f,body)
    mat=asset.doc['materials'][0]
    mat['pbrMetallicRoughness']['metallicFactor']=0
    mat['extensions']['KHR_materials_specular']['specularFactor']=.28

    pts=[];faces=[];colors=[]
    rings,sides=90,20
    for side in [-1,1]:
        def center(t):
            a=t*(math.pi*1.58)
            return np.array([side*(.34+.61*(1-math.exp(-4.3*t))+.18*t),
                             5.17+(.66-.16*t)*math.cos(a),
                             3.26-(.65-.13*t)*math.sin(a)+.05*t])
        base=len(pts)
        for i in range(rings+1):
            t=i/rings; c=center(t); axis=unit(center(t+.0001)-center(t-.0001))
            rim=unit(np.cross(axis,[0,1,0])); width=unit(np.cross(axis,rim))
            # Deposited growth rings fade gradually toward the polished tip.
            rings_at=2*math.pi*(20*t+1.6*t*t)
            edge=(.5+.5*math.cos(rings_at))**5*(1-t)
            r=.238*max(.004,(1-t)**.68)*(1+.105*edge)
            for k in range(sides):
                a=2*math.pi*k/sides
                tri=1+.062*math.cos(3*a+.40*t)
                pts.append(c+r*tri*(rim*math.cos(a)+width*math.sin(a)*1.11))
                color=np.array([.41,.285,.172])*(.73+.23*(1-t)+.17*edge+.038*math.cos(a+2*t))
                colors.append(color)
            if i:
                for k in range(sides):
                    a0=base+(i-1)*sides+k; a1=base+(i-1)*sides+(k+1)%sides
                    faces.extend([[a0,a1,a0+sides],[a1,a1+sides,a0+sides]])
    asset.geometry("Ridged keratin horn sheaths",pts,faces,colors,[[25,0,0,0]]*len(pts),[[1,0,0,0]]*len(pts),.69)
    asset.doc["asset"]["extras"]["adaptation"]="New Babylon: breeding ram, rebuilt shoulder, brisket and poll, paired ridged horn sheaths, dark facial hair. Based on Sheep by kenchoo (CC BY 4.0)."
    asset.write("ram")


def recontour(asset, points, normal, shape):
    # Transform normals by the local Jacobian, preserving the source mesh's UV
    # seam normals across shoulders, hocks and the tapered horn edges.
    axes=np.eye(3)*.0001
    jac=np.stack([(shape(points+a)-shape(points-a))/.0002 for a in axes],axis=-1)
    transformed=unit(np.linalg.solve(jac.transpose(0,2,1),normal[:,:,None])[:,:,0])
    attrs=asset.primitive["attributes"]
    attrs["POSITION"]=asset.accessor(shape(points),"VEC3")
    attrs["NORMAL"]=asset.accessor(transformed,"VEC3")
    attrs.pop("TANGENT",None)


def retexture(asset, faces, layers, finish):
    mat=asset.doc["materials"][0]
    metal=mat["pbrMetallicRoughness"]
    tex=asset.doc["textures"][metal["baseColorTexture"]["index"]]
    image_index=tex.get("source",tex.get("extensions",{}).get("EXT_texture_webp",{}).get("source"))
    image=asset.doc["images"][image_index]
    view=asset.doc["bufferViews"][image["bufferView"]]
    start=view.get("byteOffset",0)
    original=Image.open(io.BytesIO(asset.data[start:start+view["byteLength"]])).convert("RGB")
    uv=asset.array(asset.primitive["attributes"]["TEXCOORD_0"]) * (np.array(original.size)-1)
    pixels=np.asarray(original,dtype=np.float32)/255
    base=finish(pixels)
    for strength,tint in layers:
        mask=Image.new("L",original.size)
        draw=ImageDraw.Draw(mask)
        valid=np.flatnonzero(strength[faces].max(axis=1)>.005)
        for i in valid:
            verts=faces[i]
            draw.polygon([tuple(p) for p in uv[verts]],fill=int(255*strength[verts].mean()))
        alpha=np.asarray(mask.filter(ImageFilter.GaussianBlur(1.1)),dtype=np.float32)[:,:,None]/255
        base=base*(1-alpha)+tint(pixels)*alpha
    colored=Image.fromarray((np.clip(base,0,1)*255).astype("uint8"))
    def save_image(im,fmt):
        out=io.BytesIO();im.save(out,fmt,quality=88,method=6)
        return asset.blob(out.getvalue())
    # Store both a core JPEG and the generated tangent-space relief as JPEG.
    # The core albedo remains usable independently of the source ORM encoding.
    image["bufferView"]=save_image(colored,"JPEG");image["mimeType"]="image/jpeg"
    tex["source"]=image_index;tex.pop("extensions",None)
    gray=colored.convert("L")
    height=np.asarray(gray,dtype=np.float32)-np.asarray(gray.filter(ImageFilter.GaussianBlur(2.1)),dtype=np.float32)
    dy,dx=np.gradient(height/255)
    bump=unit(np.stack([-dx*.70,dy*.70,np.ones_like(dx)],axis=-1))
    im=Image.fromarray(((bump*.5+.5)*255).astype("uint8"))
    im.thumbnail((1024,1024),Image.Resampling.LANCZOS)
    asset.doc["images"].append({"name":"Hide and keratin surface","mimeType":"image/jpeg","bufferView":save_image(im,"JPEG")})
    asset.doc["textures"].append({"source":len(asset.doc["images"])-1,"sampler":tex.get("sampler",0)})
    mat["normalTexture"]={"index":len(asset.doc["textures"])-1,"scale":.58}
    metal.update(metallicFactor=0,roughnessFactor=.94)


def mobile_features(asset, points, landmarks):
    skin=asset.doc["skins"][0];nodes=asset.doc["nodes"]
    inv=list(asset.array(skin["inverseBindMatrices"]))
    attrs=asset.primitive["attributes"]
    joints=asset.array(attrs["JOINTS_0"]);weights=asset.array(attrs["WEIGHTS_0"])
    palette=len(skin["joints"])+len(landmarks); full=np.zeros((len(points),palette))
    np.add.at(full,(np.arange(len(points))[:,None],joints),weights)
    idle={"name":"Idle","channels":[],"samplers":[]}
    walk=asset.doc["animations"][0]
    t=np.linspace(0,1,49)
    idle_keys=asset.accessor(t*3.2,"SCALAR")
    walk_keys=asset.accessor(t,"SCALAR")
    parents={}
    for name,pivot,mask,axis,idle_angle,walk_angle,*parent in landmarks:
        pivot=np.asarray(pivot);index=len(nodes);joint=len(skin["joints"])
        parent_node,parent_joint,base=parents[parent[0]] if parent else (skin["skeleton"],0,np.zeros(3))
        parents[name]=(index,joint,pivot)
        skin["joints"].append(index)
        nodes[parent_node].setdefault("children",[]).append(index)
        nodes.append({"name":name,"translation":(pivot-base).tolist()})
        matrix=np.eye(4);matrix[:3,3]=-pivot
        inv.append(matrix.T.ravel())
        amount=full[:,parent_joint]*mask
        full[:,parent_joint]-=amount;full[:,joint]=amount
        for clip,keys,angle in [(idle,idle_keys,idle_angle),(walk,walk_keys,walk_angle)]:
            a=angle(t)
            rot=np.column_stack([np.sin(a/2)[:,None]*unit(np.array(axis)),np.cos(a/2)])
            clip["channels"].append({"sampler":len(clip["samplers"]),"target":{"node":index,"path":"rotation"}})
            clip["samplers"].append({"input":keys,"output":asset.accessor(rot,"VEC4"),"interpolation":"LINEAR"})
    ids=np.argsort(-full,axis=1)[:,:4]
    w=np.take_along_axis(full,ids,axis=1);w/=w.sum(axis=1,keepdims=True)
    attrs["JOINTS_0"]=asset.accessor(ids,"VEC4",5121);attrs["WEIGHTS_0"]=asset.accessor(w,"VEC4")
    skin["inverseBindMatrices"]=asset.accessor(inv,"MAT4")
    asset.doc["animations"].append(idle)


def plant_hooves(asset):
    # Evaluate the deformed soles (including the two toes) at every walk key.
    # Subtract the measured residual from the hip track, in bind-space units.
    rig=GLB.__new__(GLB)
    rig.g,rig.b=asset.doc,asset.data
    rig.parents={c:i for i,n in enumerate(rig.g["nodes"]) for c in n.get("children",[])}
    walk,idle=asset.doc["animations"][:2]
    root=asset.doc["skins"][0]["skeleton"]
    track=next(ch for ch in walk["channels"] if ch["target"]=={"node":root,"path":"translation"})
    sampler=walk["samplers"][track["sampler"]]
    keys=asset.array(sampler["input"])[:,0]
    poses=asset.array(sampler["output"])
    floor=asset.surface()[0][:,1].min()
    poses[:,1]-=np.array([rig.vertices(t)[:,1].min()-floor for t in keys])
    sampler["output"]=asset.accessor(poses,"VEC3")
    # Idle explicitly restores the loaded legs and body after a walking cycle.
    static=asset.accessor([0,3.2],"SCALAR")
    identity=asset.accessor([[0,0,0,1]]*2,"VEC4");origin=asset.accessor([[0,0,0]]*2,"VEC3")
    animated={c["target"]["node"] for c in idle["channels"]}
    for ch in walk["channels"]:
        target=ch["target"]
        if target["node"] in animated:continue
        output=origin if target["path"]=="translation" else identity
        idle["channels"].append({"sampler":len(idle["samplers"]),"target":dict(target)})
        idle["samplers"].append({"input":static,"output":output,"interpolation":"LINEAR"})


def bull():
    asset=Asset("test-bull-trellis.glb")
    p,n,f=asset.surface()
    right=np.array([.76,0,.65]);forward=np.array([-.65,0,.76]);poll=np.array([-.045,0,.38])
    def horns(q):
        local=q-poll;u=local@right;v=local@forward;y=q[:,1]
        return smooth(.034,.069,np.abs(u))*smooth(.227,.253,y)*smooth(-.044,-.018,v)
    def shape(q):
        x,y,z=q.T;local=q-poll;u=local@right;out=q.copy()
        shoulder=np.exp(-((z-.14)/.15)**2)*smooth(-.19,.05,y)
        flank=np.exp(-((z+.13)/.15)**2)
        hip=np.exp(-((z+.31)/.095)**2)*smooth(-.16,.06,y)
        out[:,0]+=(x-.024)*(.22*shoulder+.10*hip-.06*flank)
        out[:,1]+=.010*shoulder*smooth(.11,.25,y)+.018*flank*(1-smooth(-.055,.07,y))
        brisket=np.exp(-((z-.202)/.080)**2-((y+.045)/.086)**2)
        out[:,1]-=.025*brisket
        # A shorter, broader nasal cushion and a strong jaw hinge behind it.
        face=smooth(.30,.405,z)*smooth(.036,.092,y)*(1-smooth(.198,.25,y))
        out+=right*((u*.20)*face)[:,None]
        h=horns(q);rise=smooth(.038,.127,np.abs(u))
        out+=right*(np.sign(u)*h*(.015+.072*rise))[:,None]
        out[:,1]+=.036*h*rise
        out-=forward*(.017*h*rise)[:,None]
        # Preserve the length of the weight-bearing pasterns. Sculpt the hock above them.
        hocks=np.exp(-((y+.145)/.048)**2)*smooth(.16,.30,-z)
        out[:,2]-=.012*hocks
        # Turn the original, side-looking muzzle partway toward the route.
        # The neck skin rotates progressively from sternum to poll.
        pivot=np.array([.023,0,.218]);local=out-pivot
        turn=.51*smooth(.22,.358,z)*smooth(-.01,.12,y)
        out[:,0]=pivot[0]+local[:,0]*np.cos(turn)+local[:,2]*np.sin(turn)
        out[:,2]=pivot[2]-local[:,0]*np.sin(turn)+local[:,2]*np.cos(turn)
        return out
    recontour(asset,p,n,shape)
    x,y,z=p.T;horn=horns(p)
    muzzle=smooth(.415,.468,z)*smooth(.055,.085,y)*(1-smooth(.151,.18,y))
    def coat(c):
        return np.clip(c**.81*np.array([1.15,1.10,1.01])+[.054,.047,.034],0,1)
    def ivory(c):
        lum=c.mean(axis=2,keepdims=True)
        return np.array([.43,.35,.265])+lum*np.array([.56,.53,.48])
    def nose(c):
        lum=c.mean(axis=2,keepdims=True)
        return np.array([.225,.152,.119])+lum*np.array([.54,.48,.45])
    hairline=np.exp(-((x-.026)/.079)**2)*smooth(.125,.215,y)*(1-smooth(.245,.34,z))
    socket=np.maximum(np.exp(-(((p-[-.0955,.1974,.3834])/[.016,.017,.022])**2).sum(1)),
                      np.exp(-(((p-[-.0367,.1936,.4526])/[.013,.017,.018])**2).sum(1)))
    def eye(c):
        lum=c.mean(axis=2,keepdims=True)
        return np.array([.068,.043,.026])+lum*np.array([.50,.335,.22])
    def ridge(c):
        return coat(c)*[.90,.88,.82]+[.105,.083,.051]
    retexture(asset,f,[(hairline*.62,ridge),(horn,ivory),(muzzle,nose),(socket,eye)],coat)
    head=smooth(.238,.352,z)*smooth(-.037,.078,y)
    tail=smooth(.405,.464,-z)*(1-smooth(.067,.155,y))
    mobile_features(asset,p,[
        ("Poll and jaw",[.015,.152,.233],head,right,lambda t:.052*np.sin(2*np.pi*t),lambda t:.024*np.cos(4*np.pi*t)),
        ("Tail switch",[.022,.146,-.397],tail,[0,0,1],lambda t:.15*np.sin(2*np.pi*t),lambda t:.10*np.sin(2*np.pi*t))])
    asset.doc["asset"]["extras"]["adaptation"]="New Babylon: bay working bull. Modelled on the project's TRELLIS.2 bull; reshaped withers, rib cage, neck, poll, muzzle, horns and hocks; separate skull and tail joints."
    plant_hooves(asset)
    asset.write("bull")


def dorsal_bristles(asset,points,surface,faces):
    """Lay tapered guard hairs back along the spine and over the shoulder."""
    rng=np.random.default_rng(713)
    tri=points[faces]
    face_normal=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])
    centers=tri.mean(axis=1);x,y,z=centers.T
    density=smooth(.07,.22,y)*(1-smooth(.10,.16,np.abs(x-.031)))
    density*=smooth(-.48,-.37,z)*(1-smooth(.14,.27,z))
    area=np.linalg.norm(face_normal,axis=1)*density
    indices=rng.choice(len(faces),1700,p=area/area.sum())
    selected=faces[indices]
    r=np.sqrt(rng.random(len(indices)));s=rng.random(len(indices))
    blend=np.column_stack([1-r,r*(1-s),r*s])
    start=(points[selected]*blend[:,:,None]).sum(axis=1)
    normal=unit((surface[selected]*blend[:,:,None]).sum(axis=1))
    length=rng.uniform(.005,.016,len(indices))*(.86+.30*np.exp(-((start[:,2]-.10)/.16)**2))
    back=np.tile([0.,-.08,-1.],(len(indices),1));back-=normal*(normal*back).sum(axis=1)[:,None]
    tangent=unit(back)
    side=unit(np.cross(tangent,normal))*rng.uniform(.00025,.0006,len(indices))[:,None]
    base=start+normal*.00045
    middle=base+(.31*tangent+.38*normal)*length[:,None]
    tip=base+(.86*tangent+.49*normal)*length[:,None]
    verts=np.stack([base-side,base+side,middle+.52*side,middle-.52*side,tip],axis=1).reshape(-1,3)
    face=np.concatenate([np.array([[0,1,2],[0,2,3],[3,2,4]])+5*i for i in range(len(indices))])
    tone=rng.uniform(.60,1.55,len(indices))[:,None]*np.array([.135,.106,.080])
    colors=np.repeat(tone[:,None,:],5,axis=1)
    colors[:,3:,:]*=1.36
    asset.geometry("Short dorsal guard hairs",verts,face,colors.reshape(-1,3),[[0,0,0,0]]*len(verts),[[1,0,0,0]]*len(verts),.95)


def root_disk(asset,shape,poll,right,forward):
    points=[];faces=[];colors=[]
    rings,steps=26,96
    for j in range(rings+1):
        r=max(.0001,j/rings)
        for k in range(steps):
            a=2*math.pi*k/steps
            u=r*math.cos(a);h=r*math.sin(a)
            nostril=max(math.exp(-(((u-side*.48)/.194)**2+((h-.09)/.335)**2)*1.7) for side in [-1,1])
            top=.158+.001*h+.008*max(0,1-r*r)**.6-.006*nostril
            pt=poll+right*(.025+.038*u*(1-.075*h))+forward*top+[0,.084+.025*h,0]
            points.append(pt)
            pores=.5+.5*math.sin(u*47+math.sin(h*23))*math.cos(h*52-u*5)
            base=np.array([.267,.133,.108])*(.89+.09*pores+.10*h)
            colors.append(base*(1-.93*nostril))
        if j:
            for k in range(steps):
                i=(j-1)*steps+k;q=(j-1)*steps+(k+1)%steps
                faces.extend([[i,i+steps,q],[q,i+steps,q+steps]])
    # Roll the disk's perimeter back into the muzzle skin.
    outer=(rings)*steps
    for band in range(1,5):
        t=band/4
        for k in range(steps):
            a=2*math.pi*k/steps
            radial=.075*(1-math.cos(math.pi*t))*.5
            point=points[outer+k]-forward*.019*t-right*(.038*math.cos(a)*radial)
            point[1]-=.025*math.sin(a)*radial
            points.append(point)
            colors.append(np.asarray(colors[outer+k])*(1-.17*t))
        previous=outer+(band-1)*steps
        for k in range(steps):
            i=previous+k;q=previous+(k+1)%steps
            faces.extend([[i,i+steps,q],[q,i+steps,q+steps]])
    pts=shape(np.asarray(points),disk=True)
    joint=asset.doc['skins'][0]['joints'].index(next(i for i,n in enumerate(asset.doc['nodes']) if n.get('name')=='Jowl and snout'))
    asset.geometry("Rooting disk and recessed nares",pts,faces,colors,[[joint,0,0,0]]*len(pts),[[1,0,0,0]]*len(pts),.70)


def hair_on_hide(asset,points,normal,faces):
    mat=asset.doc["materials"][0]["pbrMetallicRoughness"]
    tex=asset.doc["textures"][mat["baseColorTexture"]["index"]]
    img=asset.doc["images"][tex["source"]];view=asset.doc["bufferViews"][img["bufferView"]]
    offset=view["byteOffset"]
    im=Image.open(io.BytesIO(asset.data[offset:offset+view["byteLength"]])).convert("RGB")
    scale=2;work=im.resize((im.width*scale,im.height*scale),Image.Resampling.BILINEAR);draw=ImageDraw.Draw(work)
    rng=np.random.default_rng(437)
    tri=points[faces];centers=tri.mean(axis=1)
    a=tri[:,1]-tri[:,0];b=tri[:,2]-tri[:,0]
    x,y,z=centers.T
    dens=smooth(-.12,.10,y)*smooth(-.48,-.38,z)*(1-smooth(.22,.34,z))
    area=np.linalg.norm(np.cross(a,b),axis=1)*dens
    inds=rng.choice(len(faces),68000,p=area/area.sum())
    selected=faces[inds];r=np.sqrt(rng.random(len(inds)));s=rng.random(len(inds))
    weights=np.column_stack([1-r,r*(1-s),r*s])
    n=unit((normal[selected]*weights[:,:,None]).sum(1))
    direction=np.tile([0.,-.40,-.96],(len(inds),1));direction-=n*(n*direction).sum(1)[:,None]
    d=unit(direction)*rng.uniform(.006,.017,len(inds))[:,None]
    e=np.stack([a[inds],b[inds]],axis=-1)
    gram=e.transpose(0,2,1)@e + np.eye(2)*1e-11
    uvdelta=np.linalg.solve(gram,(e.transpose(0,2,1)@d[:,:,None]))[:,:,0]
    change=np.column_stack([-uvdelta.sum(1),uvdelta]);limit=np.min(np.where(change<0,-weights/np.minimum(-1e-12,change),1.),axis=1)
    uv=asset.array(asset.primitive["attributes"]["TEXCOORD_0"])[selected]
    uv*=np.array([work.width-1,work.height-1])
    start=(weights[:,:,None]*uv).sum(1);end=start+(change[:,:,None]*uv).sum(1)*np.minimum(1.,limit)[:,None]
    swatch=np.asarray(im)
    tone=swatch[np.clip((start[:,1]/scale).astype(int),0,im.height-1),np.clip((start[:,0]/scale).astype(int),0,im.width-1)].astype(float)
    pigment=rng.uniform(-.21,.22,len(inds))
    tone=np.clip(tone*(1+pigment[:,None])+np.maximum(0,pigment[:,None])*np.array([53,42,30]),0,255).astype(int)
    for start_,end_,color in zip(start,end,tone):
        draw.line([tuple(start_),tuple(end_)],fill=tuple(color),width=1)
    out=io.BytesIO();work.resize(im.size,Image.Resampling.LANCZOS).save(out,"JPEG",quality=91)
    img["bufferView"]=asset.blob(out.getvalue())


def inner_ears(asset,shape,poll,right,forward):
    # Low ridges of cartilage cross part of each concha. The opening and
    # outer free edge retain their own silhouette while the head turns.
    pts=[];faces=[];colors=[];joints=[]
    for side in [-1,1]:
        joint=asset.doc["skins"][0]["joints"].index(next(i for i,n in enumerate(asset.doc["nodes"]) if n.get("name")=="Pinna "+str(side)))
        p=poll+right*(side*.086)+forward*(.024 if side<0 else .004)+[0,.235 if side<0 else .249,0]
        base=len(pts);rows=11;cols=22
        for j in range(rows+1):
            lat=-math.pi/2+math.pi*j/rows
            for k in range(cols):
                a=2*math.pi*k/cols;u=math.cos(lat)*math.cos(a);v=math.cos(lat)*math.sin(a)
                pt=p+right*(.031*u)+forward*(v*.005)+[0,math.sin(lat)*.008+side*u*.007,0]
                pts.append(pt);joints.append([joint,0,0,0])
                colors.append(np.array([.163,.084,.071])*(.9+.13*math.sin(lat)))
                if j:
                    l=base+(j-1)*cols+k;r=base+(j-1)*cols+(k+1)%cols
                    faces.extend([[l,l+cols,r],[r,l+cols,r+cols]])
    asset.geometry('Inner pinna folds',shape(np.array(pts)),faces,colors,joints,[[1,0,0,0]]*len(pts),.87)


def pig():
    asset=Asset("test-pig-trellis.glb");p,n,f=asset.surface()
    right=np.array([.76,0,.65]);forward=np.array([-.65,0,.76])
    poll=np.array([-.049,0,.348])
    def shape(q,disk=False):
        x,y,z=q.T;out=q.copy()
        local=q-poll;u=local@right;v=local@forward
        rib=np.exp(-((z+.004)/.242)**2)*smooth(-.13,.105,y)
        ham=np.exp(-((z+.298)/.124)**2)*smooth(-.17,.15,y)
        out[:,0]+=(x-.032)*(.09*rib+.15*ham)
        out[:,1]+=.017*np.exp(-((z-.088)/.14)**2)*smooth(.15,.245,y)
        out[:,1]+=.016*np.exp(-((z+.15)/.089)**2)*(1-smooth(-.018,.11,y))
        cheek=np.exp(-((v-.005)/.076)**2)*smooth(.045,.105,y)*(1-smooth(.18,.22,y))
        out+=right*(u*cheek*.13)[:,None]
        snout=smooth(.046,.150,v)*(1-smooth(.159,.209,y))*smooth(.26,.36,z)
        out+=forward*(.009*snout)[:,None]
        out[:,1]-=.017*snout
        if not disk:
            rim=smooth(.130,.161,v)*(1-smooth(.135,.16,y))
            out-=forward*(.009*rim)[:,None]
            out[:,1]-=.012*rim*smooth(.083,.105,y)
        pad=smooth(.104,.152,v)*(1-smooth(.123,.165,y))
        out+=right*(.10*pad*u)[:,None]
        ear=smooth(.19,.252,y)*smooth(.040,.112,np.abs(u))*smooth(.245,.294,z)
        out[:,1]+=(.004-.021*smooth(.078,.136,np.abs(u)))*ear
        out-=right*(np.sign(u)*.012*ear)[:,None]
        # Narrow the rolled tips along their forward axis, preserving the bowl.
        ear_axis=np.where(u<0,.035,-.010)
        out-=forward*((v-ear_axis)*.38*ear)[:,None]
        # Return the neck slightly toward the direction of travel.
        pivot=np.array([.017,0,.195]);rel=out-pivot
        turn=.41*smooth(.185,.345,z)*smooth(-.012,.08,y)
        out[:,0]=pivot[0]+np.cos(turn)*rel[:,0]+np.sin(turn)*rel[:,2]
        out[:,2]=pivot[2]-np.sin(turn)*rel[:,0]+np.cos(turn)*rel[:,2]
        return out
    recontour(asset,p,n,shape)
    x,y,z=p.T;local=p-poll;u=local@right;v=local@forward
    def coat(c):
        lum=c@np.array([.37,.46,.17])
        return np.clip(lum[:,:,None]**.62*np.array([.74,.70,.65])+c*.18+[.038,.042,.044],0,1)
    def skin(c):
        lum=c.mean(axis=2,keepdims=True)
        return np.array([.184,.095,.091])+lum**.75*np.array([.68,.54,.48])
    def foot(c):
        return coat(c)*[.72,.68,.66]
    ear=smooth(.20,.247,y)*smooth(.04,.097,np.abs(u))*smooth(.25,.30,z)
    nose=smooth(.096,.146,v)*(1-smooth(.13,.16,y))
    footmask=1-smooth(-.262,-.222,y)
    retexture(asset,f,[(ear*.78,lambda c: skin(c)*[1.10,1.15,1.12]+[.027,.018,.016]),(nose,skin),(footmask,foot)],coat)
    hair_on_hide(asset,p,n,f)
    head=smooth(.169,.302,z)*smooth(-.015,.089,y)
    tail=smooth(.392,.458,-z)*smooth(-.045,.055,y)*(1-smooth(.14,.208,y))
    def nod(t):return .059*np.sin(2*np.pi*t)
    features=[("Jowl and snout",[-.004,.129,.197],head,right,nod,lambda t:.021*np.cos(4*np.pi*t))]
    for side in [-1,1]:
        pinna=ear*smooth(.003,.051,u*side)
        ear_base=poll+right*(side*.049)+[0,.201,0]
        features.append(("Pinna "+str(side),shape(ear_base[None,:])[0],pinna,forward,
                         lambda t,s=side:s*.093*(np.sin(2*np.pi*t+.72*s)-np.sin(.72*s)),
                         lambda t,s=side:s*.038*np.sin(4*np.pi*t),"Jowl and snout"))
    features.append(("Tail tip",[.015,.165,-.399],tail,[0,0,1],lambda t:.18*np.sin(2*np.pi*t),lambda t:.12*np.sin(2*np.pi*t)))
    mobile_features(asset,p,features)
    plant_hooves(asset)
    root_disk(asset,shape,poll,right,forward)
    inner_ears(asset,shape,poll,right,forward)
    shaped,normal,_=asset.surface();dorsal_bristles(asset,shaped,normal,f)
    asset.doc["asset"]["extras"]["adaptation"]="New Babylon: lean domestic pig; modelled on the project's TRELLIS.2 pig. Rebuilt loin, hams, cheek and rooting snout, articulated pinnae, individually tapered dorsal hairs."
    asset.write("pig")


if __name__=="__main__":
    builders={"ram":ram,"bull":bull,"pig":pig}
    parser=argparse.ArgumentParser()
    parser.add_argument("species",choices=builders)
    builders[parser.parse_args().species]()
