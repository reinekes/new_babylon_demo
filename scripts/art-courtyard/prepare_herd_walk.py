"""Bake four-beat walking onto existing pig and sheep skins, preserving their meshes."""
import argparse
import json
import math
import struct
from functools import cache
from pathlib import Path

from rig_trellis_livestock import gait, smoothstep

# Upper leg, lower leg, and detached foot control in the distributed source rigs.
RIGS = {
    "pig": ([(21, 22, 31), (15, 16, 29), (18, 19, 30), (12, 13, 9)], .42, .64),
    "sheep": ([(12, 13, 37), (16, 17, 41), (23, 24, 39), (26, 27, 43)], .31, .83),
}

def product(a, b):
    return tuple(tuple(sum(x*y for x, y in zip(row, column)) for column in zip(*b)) for row in a)

def transform(matrix, vector):
    return tuple(sum(x*y for x,y in zip(row,vector)) for row in matrix)

def quaternion_product(a, b):
    x,y,z,w=a
    i,j,k,l=b
    return (w*i+x*l+y*k-z*j, w*j-x*k+y*l+z*i, w*k+x*j-y*i+z*l, w*l-x*i-y*j-z*k)

def matrix(node):
    if "matrix" in node:
        return tuple(tuple(node["matrix"][column*4+row] for column in range(4)) for row in range(4))
    x,y,z,w=node.get("rotation",(0,0,0,1))
    tx,ty,tz=node.get("translation",(0,0,0))
    rotation=((1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)),
              (2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)),
              (2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)))
    scale=node.get("scale",(1,1,1))
    return tuple(tuple(a*b for a,b in zip(row,scale))+(t,) for row,t in zip(rotation,(tx,ty,tz)))+((0,0,0,1),)

def bake(path, species):
    raw=path.read_bytes()
    size=struct.unpack_from("<I",raw,12)[0]
    document=json.loads(raw[20:20+size])
    data=bytearray(raw[28+size:])
    nodes=document["nodes"]
    parents={child:i for i,node in enumerate(nodes) for child in node.get("children",[])}

    @cache
    def world(index):
        local=matrix(nodes[index])
        return product(world(parents[index]),local) if index in parents else local

    def point(index):
        return transform(world(index),(0,0,0,1))[:3]

    def local_vector(parent,vector):
        basis=[row[:3] for row in world(parent)[:3]]
        return tuple(sum(a*b for a,b in zip(axis,vector))/sum(a*a for a in axis) for axis in zip(*basis))

    def rotation(index, angle):
        axis=local_vector(parents[index],(1,0,0))
        length=math.sqrt(sum(x*x for x in axis))
        delta=tuple(x*math.sin(angle/2)/length for x in axis)+(math.cos(angle/2),)
        return quaternion_product(delta,nodes[index].get("rotation",(0,0,0,1)))

    def accessor(rows, length):
        data.extend(b"\0"*(-len(data)%4))
        start=len(data)
        for row in rows:
            data.extend(struct.pack("<"+"f"*length,*row))
        views=document["bufferViews"]
        views.append({"buffer":0,"byteOffset":start,"byteLength":len(data)-start})
        accessors=document["accessors"]
        accessors.append({"bufferView":len(views)-1,"componentType":5126,"count":len(rows),
                          "type":"SCALAR" if length==1 else f"VEC{length}"})
        if length==1:
            accessors[-1].update(min=list(rows[0]),max=list(rows[-1]))
        return len(accessors)-1

    legs, stride, height=RIGS[species]
    # The pig is in raw source units. The sheep's root already normalizes it to .72 m.
    model_height=5.01 if species=="pig" else .72
    stride *= model_height/height
    lift=model_height*.062
    frames=48
    time=accessor([(i/frames,) for i in range(frames+1)],1)
    clip={"name":"Walk","channels":[],"samplers":[]}

    def channel(node, target_path, rows):
        output=accessor(rows, len(rows[0]))
        clip["channels"].append({"sampler":len(clip["samplers"]),"target":{"node":node,"path":target_path}})
        clip["samplers"].append({"input":time,"output":output,"interpolation":"LINEAR"})

    for (upper, lower, foot), offset in zip(legs,(0,.5,.25,.75)):
        landmarks=[point(node) for node in (upper,lower,foot)]
        upper_keys, lower_keys, foot_keys=[],[],[]
        for i in range(frames+1):
            phase=(i/frames+offset)%1
            # Support is longer than swing, so the gait has four separate footfalls.
            stance=.66
            reach=stride*stance/2
            swing=max(0,(phase-stance)/(1-stance))
            forward=reach-stride*phase if phase<stance else -reach+2*reach*smoothstep(0,1,swing)
            up=lift*math.sin(math.pi*swing)**2
            upper_angle,lower_angle=gait(landmarks,phase,stride,lift,0)
            upper_keys.append(rotation(upper,upper_angle))
            lower_keys.append(rotation(lower,lower_angle))
            change=local_vector(parents[foot],(0,up,forward))
            foot_keys.append(tuple(a+b for a,b in zip(nodes[foot]["translation"],change)))
        channel(upper,"rotation",upper_keys)
        channel(lower,"rotation",lower_keys)
        channel(foot,"translation",foot_keys)

    animations=document.setdefault("animations",[])
    # Preserve source idle and other archive clips. The new Walk is used in the herd.
    animations[:]=[clip,*(animation for animation in animations if animation["name"]!="Walk")]
    document["buffers"][0]["byteLength"]=len(data)
    header=json.dumps(document,separators=(",",":")).encode()
    header+=b" "*(-len(header)%4)
    data.extend(b"\0"*(-len(data)%4))
    path.write_bytes(struct.pack("<4sIII4s",b"glTF",2,28+len(header)+len(data),len(header),b"JSON")
                     +header+struct.pack("<I4s",len(data),b"BIN\0")+data)

if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("species",choices=RIGS)
    parser.add_argument("file",type=Path)
    args=parser.parse_args()
    bake(args.file,args.species)
