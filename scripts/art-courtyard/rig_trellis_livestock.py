"""Skin a TRELLIS.2 test-herd GLB using landmarks measured on its exported mesh."""
import argparse
import json
import math
import struct
from pathlib import Path

# Each row is the model-space shoulder/hip, knee/hock, and ankle.
LANDMARKS = {
    "bull": [
        [(-.044,.018,-.365),(-.043,-.135,-.417),(-.044,-.289,-.414)],
        [(.100,.025,-.288),(.105,-.148,-.280),(.103,-.289,-.236)],
        [(-.035,.015,.148),(-.041,-.139,.106),(-.040,-.284,.109)],
        [(.117,.029,.209),(.124,-.144,.189),(.123,-.283,.216)],
    ],
    "pig": [
        [(-.045,.012,-.315),(-.042,-.111,-.394),(-.054,-.258,-.420)],
        [(.090,.010,-.265),(.109,-.107,-.315),(.118,-.255,-.264)],
        [(-.028,.018,.112),(-.028,-.108,.066),(-.024,-.250,.034)],
        [(.083,.022,.168),(.099,-.109,.167),(.116,-.254,.213)],
    ],
    "goat": [
        [(-.045,.033,-.294),(-.047,-.135,-.358),(-.056,-.307,-.419)],
        [(.057,.032,-.276),(.044,-.150,-.242),(.075,-.311,-.245)],
        [(-.043,.019,.163),(-.045,-.138,.094),(-.043,-.305,.065)],
        [(.076,.025,.166),(.084,-.140,.185),(.078,-.308,.230)],
    ],
}
STRIDE = {"pig": .34, "goat": .40, "bull": .62}
HEIGHT = {"pig": .64, "goat": .96, "bull": 1.43}


def smoothstep(low, high, value):
    t = min(1, max(0, (value-low)/(high-low)))
    return t*t*(3-2*t)


def gait(leg, phase, stride, lift, body_drop):
    hip, knee, ankle = leg
    upper = math.hypot(knee[1]-hip[1], knee[2]-hip[2])
    lower = math.hypot(ankle[1]-knee[1], ankle[2]-knee[2])
    stance = .66
    reach = stride*stance/2
    if phase < stance:
        fore = reach - stride*phase
        up = 0
    else:
        swing = (phase-stance)/(1-stance)
        fore = -reach + 2*reach*smoothstep(0, 1, swing)
        up = lift*math.sin(math.pi*swing)**2
    z = ankle[2]-hip[2]+fore
    y = hip[1]-ankle[1]-up-body_drop
    distance = min(math.hypot(z, y), upper+lower-.0002)
    cosine = (distance**2-upper**2-lower**2)/(2*upper*lower)
    take = math.acos(max(-1, min(1, cosine)))
    upper_rest = -math.atan2(knee[2]-hip[2], hip[1]-knee[1])
    lower_rest = -math.atan2(ankle[2]-knee[2], knee[1]-ankle[1])
    bend = math.copysign(take, lower_rest-upper_rest)
    angle = -math.atan2(z,y)-math.atan2(lower*math.sin(bend),upper+lower*math.cos(bend))
    return angle-upper_rest, bend-(lower_rest-upper_rest)


def rig(kind, path):
    raw = path.read_bytes()
    size = struct.unpack_from("<I",raw,12)[0]
    doc = json.loads(raw[20:20+size])
    if doc.get("skins"):
        raise ValueError("Use a TRELLIS.2 GLB without a skin")
    data = bytearray(raw[28+size:])
    primitive = doc["meshes"][0]["primitives"][0]
    accessor = doc["accessors"][primitive["attributes"]["POSITION"]]
    view = doc["bufferViews"][accessor["bufferView"]]
    offset = view.get("byteOffset",0)+accessor.get("byteOffset",0)
    positions = [struct.unpack_from("<3f",data,offset+i*view.get("byteStride",12)) for i in range(accessor["count"])]
    minimum = min(v[1] for v in positions)
    height = max(v[1] for v in positions)-minimum

    def add_accessor(rows,type_name,fmt,component=5126):
        while len(data)%4:
            data.append(0)
        offset = len(data)
        for row in rows:
            data.extend(struct.pack("<"+fmt,*row))
        doc["bufferViews"].append({"buffer":0,"byteOffset":offset,"byteLength":len(data)-offset})
        entry = {"bufferView":len(doc["bufferViews"])-1,"componentType":component,"type":type_name,"count":len(rows)}
        if type_name=="SCALAR":
            entry.update(min=list(min(rows)),max=list(max(rows)))
        doc["accessors"].append(entry)
        return len(doc["accessors"])-1

    joints,weights=[],[]
    legs=LANDMARKS[kind]
    for x,y,z in positions:
        # Assign vertices to their nearest limb centreline at the same height.
        def distance(leg):
            top,mid,foot=leg
            a,b=(top,mid) if y>mid[1] else (mid,foot)
            fraction=min(1,max(0,(y-a[1])/(b[1]-a[1])))
            return (x-a[0]-(b[0]-a[0])*fraction)**2+(z-a[2]-(b[2]-a[2])*fraction)**2
        i=min(range(4),key=lambda j:distance(legs[j]))
        top,mid,foot=legs[i]
        attached=(1-smoothstep(top[1]-.075,top[1]+.02,y))*(1-smoothstep(.065,.155,math.sqrt(distance(legs[i]))))
        lower=1-smoothstep(mid[1]-.035,mid[1]+.035,y)
        hoof=1-smoothstep(foot[1]-.015,foot[1]+.032,y)
        joints.append((0,3*i+1,3*i+2,3*i+3))
        weights.append((1-attached,attached*(1-lower),attached*lower*(1-hoof),attached*lower*hoof))
    primitive["attributes"]["JOINTS_0"]=add_accessor(joints,"VEC4","4B",5121)
    primitive["attributes"]["WEIGHTS_0"]=add_accessor(weights,"VEC4","4f")
    nodes=doc["nodes"]
    body=len(nodes)
    nodes.append({"name":"body","children":[body+1+3*i for i in range(4)]})
    bind=[(0,0,0)]
    for i,leg in enumerate(legs):
        previous=(0,0,0)
        for j,point in enumerate(leg):
            node={"name":f"leg-{i}-"+("upper","lower","hoof")[j],"translation":[value-origin for value,origin in zip(point,previous)]}
            if j<2:
                node["children"]=[len(nodes)+1]
            nodes.append(node)
            previous=point
            bind.append(point)
    mesh_node=next(n for n in nodes if "mesh" in n)
    mesh_node["skin"]=0
    doc["scenes"][doc.get("scene",0)]["nodes"].append(body)
    inverse=add_accessor([(1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1) for x,y,z in bind],"MAT4","16f")
    doc["skins"]=[{"joints":list(range(body,len(nodes))),"skeleton":body,"inverseBindMatrices":inverse}]
    count=48
    time=add_accessor([(i/count,) for i in range(count+1)],"SCALAR","f")
    # Flex the legs under load and move the trunk twice per four-beat stride.
    # Compensate at the ankles so this does not lift the stance hooves.
    drop = [height*(.012+.005*math.cos(4*math.pi*i/count)) for i in range(count+1)]
    trunk = add_accessor([(0,-value,0) for value in drop],"VEC3","3f")
    samplers=[{"input":time,"output":trunk,"interpolation":"LINEAR"}]
    channels=[{"sampler":0,"target":{"node":body,"path":"translation"}}]
    for i,leg in enumerate(legs):
        angles=[]
        for frame in range(count+1):
            upper,lower=gait(leg,(frame/count+[0,.5,.25,.75][i])%1,STRIDE[kind]*height/HEIGHT[kind],.065*height,drop[frame])
            angles.append((upper,lower,-upper-lower))
        for j in range(3):
            keys=[(math.sin(a[j]/2),0,0,math.cos(a[j]/2)) for a in angles]
            output=add_accessor(keys,"VEC4","4f")
            channels.append({"sampler":len(samplers),"target":{"node":body+1+3*i+j,"path":"rotation"}})
            samplers.append({"input":time,"output":output,"interpolation":"LINEAR"})
    doc["animations"]=[{"name":"Walk","channels":channels,"samplers":samplers}]
    doc["asset"].setdefault("extras",{})["walk_stride"]=STRIDE[kind]
    if kind != "bull":
        doc["asset"]["extras"].update(
            author="New Babylon, generated with Microsoft TRELLIS.2",
            source="https://huggingface.co/spaces/microsoft/TRELLIS.2",
            license="TRELLIS.2 code and weights: MIT. Project-generated reference and asset.",
        )
    if kind == "bull":
        doc["asset"]["extras"].update(
            source="https://3dvalley.com/tools/create/image-to-3d",
            author="Новый Вавилон / TRELLIS.2 Standard (3D Valley)",
            license="Результат генерации по референсу проекта, условия 3D Valley",
        )
    doc["buffers"][0]["byteLength"]=len(data)
    header=json.dumps(doc,separators=(",",":")).encode()
    header+=b" "*(-len(header)%4)
    data.extend(b"\0"*(-len(data)%4))
    path.write_bytes(struct.pack("<4sIII4s",b"glTF",2,28+len(header)+len(data),len(header),b"JSON")+header+struct.pack("<I4s",len(data),b"BIN\0")+data)


if __name__=="__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kind",choices=LANDMARKS)
    parser.add_argument("glb",type=Path)
    args=parser.parse_args()
    rig(args.kind,args.glb)
