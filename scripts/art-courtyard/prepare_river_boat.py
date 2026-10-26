"""Adapt the supplied CC BY Gislinge model into a small, lazy-loaded river craft.

The 12th-century Danish prototype is an explicit artistic adaptation, not a
reconstruction of a Sumerian boat. Keep source UVs, planks, frames and steering
oar; combine static geometry, omit redundant thole straps/pins, reduce textures.
The rig and sail are separate so the live renderer can lower them for bridges.
Run with bundled Python (NumPy/Pillow); the Downloads source is never modified.
"""
from pathlib import Path
import argparse, copy, hashlib, io, json, struct
import numpy as np
from PIL import Image
from prepare_city_fauna import GLB

ROOT = Path(__file__).resolve().parents[2]

def add_plank_deck(part, planking, height=.19):
    """Fit a dry working floor to the source planking's real inner cross-section.

    The open source bilge lies below the waterline. A thin, tapered wooden deck
    covers it without lifting the hull or hiding any river pixels with a mask.
    """
    cuts = []
    for triangle in planking:
        points = []
        for p, q in zip(triangle, np.roll(triangle, -1, axis=0)):
            if (p[1]-height)*(q[1]-height) < 0:
                points.append(p+(q-p)*(height-p[1])/(q[1]-p[1]))
        if len(points) == 2:
            cuts.append(points)
    rows = []
    for z in np.arange(-3.2, 3.201, .05):
        xs = [p[0]+(q[0]-p[0])*(z-p[2])/(q[2]-p[2]) for p,q in cuts
              if min(p[2],q[2])-1e-9 <= z <= max(p[2],q[2])+1e-9 and abs(q[2]-p[2]) > 1e-9]
        left, right = [x for x in xs if x < 0], [x for x in xs if x > 0]
        if left and right and min(right)-max(left) > .03:
            rows.append((float(z), max(left)+.001, min(right)-.001))
    if len(rows) < 8:
        raise ValueError('No usable inner hull profile for the river deck')
    offset = len(part['p'])
    def quad(points, normal):
        start = len(part['p'])
        part['p'].extend(points);part['n'].extend([normal]*4)
        part['uv'].extend([((p[0]+.72)/1.44, (p[2]-rows[0][0])/.20) for p in points])
        part['i'].extend([start,start+1,start+2,start,start+2,start+3])
    for i,(a,b) in enumerate(zip(rows,rows[1:])):
        z0,l0,r0 = a;z1,l1,r1 = b
        # Continuous wooden backing keeps the narrow plank seams dry as well.
        quad([(l0,height-.013,z0),(l1,height-.013,z1),(r1,height-.013,z1),(r0,height-.013,z0)], [0,1,0])
        begin, end = i%4 == 0, i%4 == 3 or i == len(rows)-2
        for amount, first in [(.001,True),(.001,False)]:
            if first and begin:
                t=amount/(z1-z0);l0+=(l1-l0)*t;r0+=(r1-r0)*t;z0+=amount
            if not first and end:
                t=amount/(z1-z0);l1+=(l0-l1)*t;r1+=(r0-r1)*t;z1-=amount
        quad([(l0,height,z0),(l1,height,z1),(r1,height,z1),(r0,height,z0)], [0,1,0])
        if begin:quad([(l0,height-.013,z0),(l0,height,z0),(r0,height,z0),(r0,height-.013,z0)], [0,0,-1])
        if end:quad([(r1,height-.013,z1),(r1,height,z1),(l1,height,z1),(l1,height-.013,z1)], [0,0,1])
    return {'height_metres':height,'planks':int(np.ceil((len(rows)-1)/4)),
            'vertex_range':[offset,len(part['p'])-offset],
            'profile':[[round(v,5) for v in row] for row in rows]}

def prepare(source, target):
    a = GLB(source)
    original = a.g
    world = a.world({})
    g = {'asset': copy.deepcopy(original['asset']), 'scene': 0,
         'scenes': [{'nodes': [0]}], 'nodes': [], 'meshes': [],
         'materials': copy.deepcopy(original['materials']),
         'accessors': [], 'bufferViews': [], 'buffers': [], 'images': [],
         'textures': copy.deepcopy(original['textures']),
         'samplers': copy.deepcopy(original.get('samplers', []))}
    binary = bytearray()

    def buffer(data):
        while len(binary) % 4: binary.append(0)
        index = len(g['bufferViews'])
        g['bufferViews'].append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': len(data)})
        binary.extend(data)
        return index

    def accessor(values, kind, component=5126):
        values = np.asarray(values, dtype='<u2' if component == 5123 else '<f4')
        view = buffer(values.tobytes())
        item = {'bufferView': view, 'componentType': component,
                'count': len(values), 'type': kind}
        if kind != 'SCALAR':
            item.update(min=values.min(0).tolist(), max=values.max(0).tolist())
        g['accessors'].append(item)
        return len(g['accessors']) - 1

    # Source units are centimetres; the pointed bow faces source +Z.
    hull_nodes = [i for i,n in enumerate(original['nodes']) if 'mesh' in n and
                  not any(k in n['name'] for k in ('Sail', 'Yard', 'Mast', 'Shrouds', 'Stay'))]
    hull = []
    for i in hull_nodes:
        p = original['meshes'][original['nodes'][i]['mesh']]['primitives'][0]
        v = a.read(p['attributes']['POSITION'])
        hull.append((np.c_[v,np.ones(len(v))] @ world[i].T)[:,:3])
    bounds = np.concatenate(hull)
    scale = 6.4 / np.ptp(bounds[:,2])
    center = (bounds.min(0)+bounds.max(0))/2
    center[1] = 0
    # Waterline is y=0, keel .29m below it. Model sits inside a 13.7m channel.
    shift = np.array([-center[0]*scale, -.29, -center[2]*scale])
    rig_base = np.array([0., .19, .27])
    groups = {k: {'p': [], 'n': [], 'uv': [], 'i': []} for k in ('hull', 'rig', 'sail')}
    removed = []
    steering_range = None
    planking = []
    for i,n in enumerate(original['nodes']):
        if 'mesh' not in n: continue
        name = n['name']
        if 'Rigging Pin' in name or 'Thole Straps' in name:
            removed.append(name)
            continue
        kind = 'sail' if 'Sail Full' in name else 'rig' if any(k in name for k in ('Sail', 'Yard', 'Mast', 'Shrouds', 'Stay')) else 'hull'
        part = groups[kind]
        for primitive in original['meshes'][n['mesh']]['primitives']:
            attrs = primitive['attributes']
            ps = a.read(attrs['POSITION'])
            ps = (np.c_[ps,np.ones(len(ps))] @ world[i].T)[:,:3] * scale + shift
            # Babylon AUTO applies a Y half-turn plus Z reflection: net X
            # reflection, preserving the source +Z bow. Do not turn it around.
            # Local rig origin permits a true horizontal lowered-mast pose.
            if kind != 'hull': ps -= rig_base
            ns = a.read(attrs['NORMAL']) @ np.linalg.inv(world[i][:3,:3])
            ns /= np.maximum(np.linalg.norm(ns,axis=1)[:,None],1e-9)
            uv = a.read(attrs['TEXCOORD_0'])
            local_ix = a.read(primitive['indices']).reshape(-1).astype(int)
            ix = local_ix + len(part['p'])
            if name.startswith('Planking_'):planking.extend(ps[local_ix].reshape((-1,3,3)))
            if name == 'Rudder_Ship Oak Aged_0': steering_range = [len(part['p']),len(ps)]
            part['p'].extend(ps);part['n'].extend(ns);part['uv'].extend(uv);part['i'].extend(ix)
    deck = add_plank_deck(groups['hull'], planking)
    g['nodes'] = [{'name': 'NewBabylonRiverCraft', 'children': [1,2],
                   'extras': {'river_craft': True, 'waterline': 0, 'length_metres': 6.4,
                              'forward_gltf': '+Z', 'forward_babylon': '+Z',
                              'bow_probe':[0,.4,3.2], 'stern_probe':[0,.4,-3.2]}},
                  {'name': 'RiverCraftHull', 'mesh': 0},
                  {'name': 'RiverCraftLowerableRig', 'translation': rig_base.tolist(), 'children': [3,4]},
                  {'name': 'RiverCraftRig', 'mesh': 1},
                  {'name': 'RiverCraftSail', 'mesh': 2}]
    for kind in ('hull','rig','sail'):
        part = groups[kind]
        attrs = {'POSITION': accessor(part['p'],'VEC3'), 'NORMAL': accessor(part['n'],'VEC3'),
                 'TEXCOORD_0': accessor(part['uv'],'VEC2')}
        g['meshes'].append({'name': 'RiverCraft'+kind.title(), 'primitives': [{
            'attributes': attrs, 'indices': accessor(part['i'],'SCALAR',5123),
            'material': 1 if kind == 'sail' else 0}]})
    texture_metrics = []
    for index, im in enumerate(original['images']):
        view = original['bufferViews'][im['bufferView']]
        image = Image.open(io.BytesIO(a.b[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']])).convert('RGB')
        before = image.size
        edge = 512 if index in (0,3) else 256
        image.thumbnail((edge,edge),Image.Resampling.LANCZOS)
        out = io.BytesIO();image.save(out,format='JPEG',quality=86 if index in (0,3) else 82,optimize=True)
        g['images'].append({'bufferView':buffer(out.getvalue()),'mimeType':'image/jpeg'})
        texture_metrics.append({'source':list(before),'output':list(image.size),'bytes':len(out.getvalue())})
    for mat in g['materials']:
        mat['pbrMetallicRoughness']['metallicFactor']=0
        mat['pbrMetallicRoughness']['roughnessFactor']=.92
    # Warm untreated wood / unbleached linen, retaining the supplied fine grain.
    g['materials'][0]['pbrMetallicRoughness']['baseColorFactor']=[.90,.82,.67,1]
    g['materials'][1]['pbrMetallicRoughness']['baseColorFactor']=[.92,.83,.64,1]
    g['asset']['generator']='New Babylon prepare_river_boat.py; source Sketchfab-15.12.0'
    g['asset']['extras']['new_babylon_river_boat']={
        'input_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
        'adaptation':'Gislinge hull reused as artistic river craft, not a Sumerian reconstruction; source plank UVs and steering oar retained; tapered dry plank deck fitted to the inner hull; separate lowerable rig and sail; no new trade inventory.',
        'removed':removed,'texture_metrics':texture_metrics,
        'length_metres':6.4,'beam_metres':float(np.ptp(bounds[:,0])*scale),
        'draft_metres':.29,'deck_metres':.19,'plank_deck':deck,
        'steering_oar_vertex_range':steering_range,
        'triangles':sum(len(v['i'])//3 for v in groups.values())}
    g['buffers']=[{'byteLength':len(binary)}]
    js=json.dumps(g,separators=(',',':')).encode()
    js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
    data=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
    print(json.dumps({'target':str(target),'source_bytes':source.stat().st_size,'bytes':len(data),**g['asset']['extras']['new_babylon_river_boat']},indent=2))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--source',type=Path,default=Path.home()/'Downloads/gislinge_viking_boat.glb');p.add_argument('--out',type=Path,default=ROOT/'assets/art-courtyard/models/river-cargo-boat.glb');v=p.parse_args();prepare(v.source,v.out)
