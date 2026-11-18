"""Paint a vertex-coloured courtyard house with tileable original surface studies.

Requires numpy and Pillow. Run: python postprocess.py raw.glb house-level-1.glb.
Explicit triangle labels use mesh.extras.surfaceIndexRanges = [[start,end,name],...].
start and end count index elements in the input primitive, end exclusive.
"""
import argparse
from collections import defaultdict
import io
import json
from pathlib import Path
import struct

import numpy as np
from PIL import Image

SIZE = 512
Y, X = np.mgrid[:SIZE, :SIZE]
SURFACES = {
    # Physical span of a repeated swatch (metres), microsurface roughness.
    "earth": (1.65, .98),
    "ground": (1.70, 1.0),
    "reed": (.38, .84),
    "wood": (.56, .92),
    "pottery": (.52, .94),
    "cloth": (.34, .98),
}
LABELS = {
    "earth": "Straw-tempered mud plaster",
    "ground": "Compacted alluvial soil",
    "reed": "Dry reed rind and binding",
    "wood": "Unpeeled weathered timber",
    "pottery": "Unpolished terracotta slip",
    "cloth": "Handwoven fibre",
}


def noise(rng, nx, ny=None, x=X, y=Y):
    """Periodic C1 value noise, scaled to approximately unit variance."""
    ny = nx if ny is None else ny
    grid = rng.normal(0, 1, (ny, nx))
    u, v = x * nx / SIZE, y * ny / SIZE
    i, j = np.floor(u).astype(int), np.floor(v).astype(int)
    u, v = u - i, v - j
    u, v = u*u*(3-2*u), v*v*(3-2*v)
    top = grid[j % ny, i % nx]*(1-u) + grid[j % ny, (i+1) % nx]*u
    bottom = grid[(j+1) % ny, i % nx]*(1-u) + grid[(j+1) % ny, (i+1) % nx]*u
    return (top*(1-v) + bottom*v)*1.35


def inclusions(rng, shade, height, kind):
    """Short buried straw fibres, grit and scattered mineral grains."""
    if kind == "earth":
        count, straw_fraction = 1760, .22
    elif kind == "ground":
        count, straw_fraction = 2870, .06
    else:
        count, straw_fraction = 1320, 0
    for _ in range(count):
        fibre = rng.random() < straw_fraction
        cx, cy = rng.uniform(0, SIZE, 2)
        angle = rng.uniform(0, 2*np.pi)
        if fibre:
            a, b = rng.uniform(2, 9), rng.uniform(.36, .8)
            tone, relief = rng.uniform(6, 20), rng.uniform(.10, .33)
        else:
            a = rng.uniform(.45, 2.1) if kind != "pottery" else rng.uniform(.4, 1.1)
            b = a*rng.uniform(.40, .83)
            tone = rng.choice([-1, 1])*rng.uniform(5, 22)
            relief = rng.uniform(-.25, .55)
        r = int(np.ceil(a+1))
        xi = np.arange(int(cx)-r, int(cx)+r+1)
        yi = np.arange(int(cy)-r, int(cy)+r+1)
        dx, dy = xi[None, :] - cx, yi[:, None] - cy
        dx1 = dx*np.cos(angle) + dy*np.sin(angle)
        dy1 = -dx*np.sin(angle) + dy*np.cos(angle)
        shape = np.clip(1.3-(dx1/a)**2-(dy1/b)**2, 0, 1)
        loc = np.ix_(yi % SIZE, xi % SIZE)
        shade[loc] += tone*shape
        height[loc] += relief*shape


def make_surface(kind):
    rng = np.random.default_rng(17321 + list(SURFACES).index(kind))
    broad, mid, fine = noise(rng, 4), noise(rng, 18), noise(rng, 76)
    grit = rng.normal(0, 1, X.shape)
    if kind in ("earth", "ground"):
        # Patches of re-wetted plaster, trowel ridges, and hairline shrinkage.
        warp = noise(rng, 5)
        tool = noise(rng, 7, 70, X, Y + 13*warp + 11*np.sin(X*2*np.pi/SIZE))
        shade = 236 + 5.7*broad + 4.8*mid + 3.5*fine + 2.5*grit + 1.25*tool
        height = 2.3*mid + .72*fine + .19*grit + .22*tool
        field = noise(rng, 7, 8, X+6*mid, Y+5*warp)
        fissures = np.exp(-(field/.049)**2)*np.clip((warp+.08)*.9, 0, 1)
        shade -= (17 if kind=="earth" else 22)*fissures
        height -= .85*fissures
        inclusions(rng, shade, height, kind)
        if kind == "ground":
            shade += 3*mid + 1.5*grit - 3
            height += .48*fine
        warm = .8*mid + .65*broad
    elif kind in ("wood", "reed"):
        # UV's second axis follows the length of each stalk/branch.
        warp = 3.9*noise(rng, 5, 4) + 1.5*noise(rng, 12, 8)
        fibre = noise(rng, 119, 9, X+warp, Y)
        ribbon = noise(rng, 33, 4, X+warp, Y)
        groove = np.clip((-fibre-.6), 0, 1.8)
        shade = 235 + 5.0*ribbon + 3.7*fibre - 7.8*groove + 2*mid + 2.2*grit
        height = .84*ribbon + .39*fibre - .46*groove + .12*grit
        if kind == "wood":
            bark = np.clip(-noise(rng, 48, 8, X+1.8*warp, Y)-.4,0,2)
            shade -= 7*bark
            height -= .48*bark
        warm = ribbon*.65
    elif kind == "pottery":
        turning = noise(rng, 4, 85, X, Y + 2*noise(rng, 3))
        shade = 239 + 4.2*broad + 3.2*mid + 2.3*fine + 2.8*grit + .95*turning
        height = .27*fine + .22*turning + .14*grit
        inclusions(rng, shade, height, kind)
        warm = broad + .7*mid
    else:
        u, v = (X+1.0*noise(rng, 5, 23))/8, (Y+.9*noise(rng, 25, 6))/8
        a, b = np.cos(2*np.pi*u), np.cos(2*np.pi*v)
        over = np.cos(np.pi*u)*np.cos(np.pi*v) > 0
        weave = np.maximum(np.where(over,a*.9,a*.26), np.where(over,b*.26,b*.9))
        shade = 229 + 10*weave + 4.8*mid + 2.8*grit
        height = .9*weave + .12*grit
        warm = .4*broad
    rgb = np.stack((shade + warm, shade, shade - 1.25*warm), axis=-1)
    dx = (np.roll(height,-1,axis=1)-np.roll(height,1,axis=1))*.5
    dy = (np.roll(height,-1,axis=0)-np.roll(height,1,axis=0))*.5
    strength = .27 if kind in ("earth", "ground") else 1.0
    normal = np.stack((-dx*strength,-dy*strength,np.ones_like(height)),axis=-1)
    normal /= np.linalg.norm(normal,axis=-1,keepdims=True)
    def encode(array):
        data = io.BytesIO()
        Image.fromarray(np.uint8(np.clip(array+.5, 0, 255))).save(data, format="PNG")
        return data.getvalue()
    return encode(rgb), encode((normal+1)*127.5)


def unpack_glb(path):
    raw = path.read_bytes()
    magic, version, size, js_len, kind = struct.unpack_from('<4sIII4s',raw)
    if (magic, version, size, kind) != (b'glTF', 2, len(raw), b'JSON'):
        raise ValueError(f"Invalid input GLB: {path}")
    g = json.loads(raw[20:20+js_len])
    return g, raw[28+js_len:]


def read_accessor(g, data, number):
    a = g["accessors"][number]
    view = g["bufferViews"][a["bufferView"]]
    dtype = {5126: "<f4", 5125: "<u4", 5123: "<u2"}[a["componentType"]]
    dim = {"VEC3": 3, "VEC4": 4, "SCALAR": 1}[a["type"]]
    offset = a.get("byteOffset",0)+view.get("byteOffset",0)
    return np.frombuffer(data, dtype=dtype, count=dim*a["count"], offset=offset).reshape((-1,dim))


def connected_groups(triangles, vertex_count):
    parents = list(range(vertex_count))
    def root(i):
        while parents[i]!=i:
            parents[i]=parents[parents[i]]
            i=parents[i]
        return i
    for a,b,c in triangles.tolist():
        a,b,c = root(a),root(b),root(c)
        parents[b]=a
        parents[c]=a
    out=defaultdict(list)
    for n,(a,_,_) in enumerate(triangles.tolist()):
        out[root(a)].append(n)
    return out.values()


def guess_surface(points, colour):
    span = np.ptp(points,axis=0)
    if min(span[0],span[2])>4.4:
        return "ground"
    if len(points)>=100 and span[1]>.12 and .90<span[0]/max(.0001,span[2])<1.1 and max(span)<1.1:
        return "pottery"
    if len(points)<=36 and max(span)>2.2*np.median(span):
        return "wood" if np.mean(colour)<.20 else "reed"
    return "earth"


def process(src, dst):
    g, data = unpack_glb(src)
    mesh = g["meshes"][0]
    old = mesh["primitives"][0]
    pos, norm, col = [read_accessor(g,data,old["attributes"][key]) for key in ("POSITION","NORMAL","COLOR_0")]
    tris = read_accessor(g,data,old["indices"]).reshape((-1,3))
    labels = np.full(len(tris), "", dtype="U8")
    for begin,end,kind in mesh.get("extras",{}).get("surfaceIndexRanges",[]):
        if begin%3 or end%3 or kind not in SURFACES:
            raise ValueError(f"Invalid index range: {begin}, {end}, {kind}")
        labels[begin//3:end//3]=kind

    blob=bytearray()
    g.update(bufferViews=[],accessors=[],materials=[],textures=[],images=[],
             samplers=[dict(magFilter=9729,minFilter=9987,wrapS=10497,wrapT=10497)])
    def append_view(chunk,target=None):
        blob.extend(b'\0'*(-len(blob)%4)); n=len(g["bufferViews"])
        v=dict(buffer=0,byteOffset=len(blob),byteLength=len(chunk))
        if target:v["target"]=target
        g["bufferViews"].append(v);blob.extend(chunk);return n
    def accessor(array,indices=False,bounds=False):
        array=np.asarray(array,dtype="<u4" if indices else "<f4")
        view=append_view(array.tobytes(),34963 if indices else 34962)
        a=dict(bufferView=view,componentType=5125 if indices else 5126,count=len(array),
               type="SCALAR" if indices else f"VEC{array.shape[1]}")
        if bounds:a.update(min=array.min(axis=0).tolist(),max=array.max(axis=0).tolist())
        g["accessors"].append(a);return len(g["accessors"])-1

    # Box-map each connected sculpt. Grain on timber runs along its principal
    # axis; only projection seams duplicate vertices, preserving smooth normals.
    records={k:dict(rows=[],lookup={},indices=[]) for k in SURFACES}
    for group in connected_groups(tris,len(pos)):
        idx=tris[group]; ids=np.unique(idx); pts=pos[ids]
        component_labels=labels[group]
        missing=component_labels==""
        if missing.any():component_labels[missing]=guess_surface(pts,col[ids])
        for kind in np.unique(component_labels):
            faces=idx[component_labels==kind]; record=records[kind]
            local=pos
            if kind in ("wood","reed"):
                _,axes=np.linalg.eigh(np.cov(pts.T))
                along=axes[:,-1]
                if along[np.abs(along).argmax()]<0:along=-along
                guide=np.eye(3)[np.abs(along).argmin()]
                across=np.cross(guide,along);across/=np.linalg.norm(across)
                depth=np.cross(across,along)
                projected=np.column_stack((pts@across,pts@along,pts@depth))
            else:
                projected=pts
            local_ids=np.searchsorted(ids,faces)
            p=projected[local_ids]
            normal=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0])
            projections=np.argmax(np.abs(normal),axis=1)
            # Preserve orientation of UVs on mirrored faces by flipping U.
            for face,face_ids,axis,fn in zip(faces,local_ids,projections,normal):
                sign=1 if fn[axis]>=0 else -1
                ui,vi=((2,1),(0,2),(0,1))[axis]
                for original,local_id in zip(face,face_ids):
                    key=(int(original),int(axis),sign)
                    new_id=record["lookup"].get(key)
                    if new_id is None:
                        new_id=len(record["rows"]);record["lookup"][key]=new_id
                        span=SURFACES[kind][0]
                        u,v=projected[local_id,[ui,vi]]/span
                        record["rows"].append((original,sign*u,-v))
                    record["indices"].append(new_id)

    primitives=[]
    for kind,record in records.items():
        if not record["indices"]:continue
        rows=np.array(record["rows"]);ids=rows[:,0].astype(int)
        attrs={k:accessor(a,bounds=k=="POSITION") for k,a in (
            ("POSITION",pos[ids]),("NORMAL",norm[ids]),("COLOR_0",col[ids]),("TEXCOORD_0",rows[:,1:]))}
        texture_ids=[]
        for suffix,png in zip(("Albedo","Normal"),make_surface(kind)):
            j=len(g["images"]);g["images"].append(dict(name=f"{LABELS[kind]} {suffix}",bufferView=append_view(png),mimeType="image/png"))
            texture_ids.append(len(g["textures"]));g["textures"].append(dict(source=j,sampler=0))
        mat=dict(name=LABELS[kind],doubleSided=True,
                 pbrMetallicRoughness=dict(metallicFactor=0,roughnessFactor=SURFACES[kind][1],
                                           baseColorTexture=dict(index=texture_ids[0])),
                 normalTexture=dict(index=texture_ids[1]))
        primitives.append(dict(attributes=attrs,indices=accessor(record["indices"],indices=True),material=len(g["materials"])))
        g["materials"].append(mat)
    mesh["primitives"]=primitives
    mesh.get("extras",{}).pop("surfaceIndexRanges",None)
    blob.extend(b'\0'*(-len(blob)%4))
    g["buffers"]=[dict(byteLength=len(blob))]
    j=json.dumps(g,separators=(',',':')).encode();j+=b' '*(-len(j)%4)
    dst.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(blob))+struct.pack('<I4s',len(j),b'JSON')+j+
                    struct.pack('<I4s',len(blob),b'BIN\0')+blob)
    print(dst,[(k,len(v['indices'])//3) for k,v in records.items() if v['indices']])
    return g


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=Path);parser.add_argument('destination',type=Path)
    args=parser.parse_args();process(args.source,args.destination)
