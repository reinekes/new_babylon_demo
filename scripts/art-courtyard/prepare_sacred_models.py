"""Bake supplied sacred buildings into metre-space, small static shared templates.

No Downloads file is edited. Native UVs/materials and attribution survive. The
large Etemenanki source's dense ornamental tessellation is clustered on a 2 cm
grid; degenerate faces are removed and remaining UV/normal seams stay separate.
Its twelve grey waterfall sheets are omitted from this dry ceremonial building.
Requires bundled NumPy and Pillow. Run from any directory.
"""
from pathlib import Path
import argparse, copy, hashlib, io, json, struct
import numpy as np
from PIL import Image
from prepare_city_fauna import GLB

ROOT = Path(__file__).resolve().parents[2]
MODELS = [
    ('ishtar_gate_babylon.glb', 'sacred-ishtar-gate.glb', 5.2, 0),
    ('3 level ziggurat.glb', 'sacred-shrine-3.glb', 5.2, 0),
    ('ziggurat.glb', 'sacred-ziggurat-1.glb', 10.8, 0),
    ('babylon_building_etemenanki.glb', 'sacred-ziggurat-3.glb', 10.8, .02),
]


class Writer:
    def __init__(self, asset):
        self.g = {'asset': copy.deepcopy(asset), 'scene': 0,
                  'scenes': [{'nodes': [0]}],
                  'nodes': [{'name': 'NewBabylonSacredBuilding', 'children': []}],
                  'meshes': [], 'materials': [], 'accessors': [], 'bufferViews': [],
                  'buffers': [], 'images': [], 'textures': [], 'samplers': []}
        self.binary = bytearray()

    def buffer(self, raw):
        self.binary.extend(b'\0' * (-len(self.binary) % 4))
        index = len(self.g['bufferViews'])
        self.g['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': len(raw)})
        self.binary.extend(raw)
        return index

    def accessor(self, data, kind, component=5126):
        a = np.asarray(data, dtype={5126: '<f4', 5125: '<u4', 5123: '<u2'}[component])
        item = {'bufferView': self.buffer(a.tobytes()), 'componentType': component,
                'count': len(a), 'type': kind}
        if component == 5126:
            item.update(min=a.min(axis=0).tolist(), max=a.max(axis=0).tolist())
        self.g['accessors'].append(item)
        return len(self.g['accessors']) - 1

    def save(self, target):
        self.g['buffers'] = [{'byteLength': len(self.binary)}]
        js = json.dumps(self.g, separators=(',', ':')).encode()
        js += b' ' * (-len(js) % 4)
        self.binary.extend(b'\0' * (-len(self.binary) % 4))
        raw = (struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(self.binary)) +
               struct.pack('<II', len(js), 0x4e4f534a) + js +
               struct.pack('<II', len(self.binary), 0x004e4942) + self.binary)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        return raw


def prepare(source, target, width, cluster):
    a = GLB(source)
    g, worlds = a.g, a.world({})
    parts, omitted = [], []
    for i, node in enumerate(g['nodes']):
        if 'mesh' not in node:
            continue
        if cluster and node.get('name', '').lower().startswith('waterfall'):
            omitted.append(node['name'])
            continue
        for primitive in g['meshes'][node['mesh']]['primitives']:
            if primitive.get('mode', 4) != 4:
                omitted.append(node.get('name', f'node-{i}')+' (exported wire edges)')
                continue
            attrs = primitive['attributes']
            points = a.read(attrs['POSITION'])
            p = (np.c_[points, np.ones(len(points))] @ worlds[i].T)[:, :3]
            tri = a.read(primitive['indices']).reshape(-1, 3).astype(int)
            if np.linalg.det(worlds[i][:3, :3]) < 0:
                tri = tri[:, [0, 2, 1]]
            if 'NORMAL' in attrs:
                n = a.read(attrs['NORMAL']) @ np.linalg.inv(worlds[i][:3, :3])
            else:
                n = np.zeros_like(p)
                face = np.cross(p[tri[:, 1]]-p[tri[:, 0]], p[tri[:, 2]]-p[tri[:, 0]])
                for corner in range(3):
                    np.add.at(n, tri[:, corner], face)
            n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
            uv = a.read(attrs['TEXCOORD_0']) if 'TEXCOORD_0' in attrs else np.zeros((len(p), 2))
            parts.append({'p': p, 'n': n, 'uv': uv, 'tri': tri,
                          'material': primitive.get('material', 0)})
    points = np.concatenate([p['p'] for p in parts])
    low, high = points.min(0), points.max(0)
    scale = width / max(high[0]-low[0], high[2]-low[2])
    center = (low+high)/2
    center[1] = low[1]
    for part in parts:
        part['p'] = (part['p']-center)*scale
    writer = Writer(g['asset'])
    out = writer.g
    image_cache, texture_cache, material_cache, material_remap = {}, {}, {}, {}
    image_metrics = []

    def texture(index, normal=False):
        tex = g['textures'][index]
        image = g['images'][tex['source']]
        view = g['bufferViews'][image['bufferView']]
        raw = a.b[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
        key = (hashlib.sha256(raw).hexdigest(), normal)
        if key not in image_cache:
            im = Image.open(io.BytesIO(raw)).convert('RGB')
            before = im.size
            im.thumbnail((512, 512), Image.Resampling.LANCZOS)
            encoded = io.BytesIO()
            im.save(encoded, format='PNG' if normal else 'JPEG',
                    **({'optimize': True} if normal else {'quality': 86, 'optimize': True}))
            output = encoded.getvalue()
            image_cache[key] = len(out['images'])
            out['images'].append({'bufferView': writer.buffer(output),
                                  'mimeType': 'image/png' if normal else 'image/jpeg'})
            image_metrics.append({'source': list(before), 'output': list(im.size),
                                  'normal': normal, 'bytes': len(output)})
        sampler = copy.deepcopy(g.get('samplers', [{}])[tex.get('sampler', 0)])
        sampler_key = json.dumps(sampler, sort_keys=True)
        tex_key = (image_cache[key], sampler_key)
        if tex_key not in texture_cache:
            si = next((i for i, s in enumerate(out['samplers']) if s == sampler), len(out['samplers']))
            if si == len(out['samplers']):
                out['samplers'].append(sampler)
            texture_cache[tex_key] = len(out['textures'])
            out['textures'].append({'source': image_cache[key], 'sampler': si})
        return texture_cache[tex_key]

    for mi in sorted({p['material'] for p in parts}):
        material = copy.deepcopy(g['materials'][mi])
        pbr = material.setdefault('pbrMetallicRoughness', {})
        pbr['metallicFactor'], pbr['roughnessFactor'] = 0, .88
        for parent, slot in [(pbr, 'baseColorTexture'), (pbr, 'metallicRoughnessTexture'),
                             (material, 'normalTexture'), (material, 'occlusionTexture'),
                             (material, 'emissiveTexture')]:
            if slot in parent:
                parent[slot]['index'] = texture(parent[slot]['index'], slot == 'normalTexture')
        key = json.dumps({k: v for k, v in material.items() if k != 'name'}, sort_keys=True)
        if key not in material_cache:
            material_cache[key] = len(out['materials'])
            out['materials'].append(material)
        material_remap[mi] = material_cache[key]
    groups = {}
    triangles_before = sum(len(p['tri']) for p in parts)
    max_shift = 0
    for part in parts:
        p, n, uv, tri = (part[k] for k in ['p', 'n', 'uv', 'tri'])
        if cluster:
            _, inverse = np.unique(np.round(p/cluster).astype(np.int64), axis=0, return_inverse=True)
            count = np.bincount(inverse)
            sums = np.zeros((len(count), 3))
            np.add.at(sums, inverse, p)
            clustered = (sums/count[:, None])[inverse]
            max_shift = max(max_shift, float(np.linalg.norm(clustered-p, axis=1).max()))
            p = clustered
            f = inverse[tri]
            tri = tri[(f[:, 0] != f[:, 1]) & (f[:, 0] != f[:, 2]) & (f[:, 1] != f[:, 2])]
        used = np.unique(tri)
        # Exact vertex/UV/normal deduplication never welds texture or hard seams.
        values, inverse = np.unique(np.c_[p[used], n[used], uv[used]].astype('<f4'), axis=0, return_inverse=True)
        remap = np.full(len(p), -1, dtype=int)
        remap[used] = inverse
        data = groups.setdefault(material_remap[part['material']], {'v': [], 'tri': [], 'count': 0})
        data['v'].append(values)
        data['tri'].append(remap[tri]+data['count'])
        data['count'] += len(values)
    triangles_after = 0
    for mi, part in groups.items():
        values = np.concatenate(part['v'])
        tri = np.concatenate(part['tri'])
        # Merge source nodes by material into one draw call, then remove exact seams.
        values, inverse = np.unique(values, axis=0, return_inverse=True)
        tri = inverse[tri]
        triangles_after += len(tri)
        attrs = {'POSITION': writer.accessor(values[:, :3], 'VEC3'),
                 'NORMAL': writer.accessor(values[:, 3:6], 'VEC3'),
                 'TEXCOORD_0': writer.accessor(values[:, 6:], 'VEC2')}
        mesh_index = len(out['meshes'])
        name = f'Sacred-{target.stem}-surface-{mi}'
        out['meshes'].append({'name': name, 'primitives': [{'attributes': attrs,
            'indices': writer.accessor(tri.ravel(), 'SCALAR', 5123 if len(values) < 65536 else 5125),
            'material': mi}]})
        out['nodes'][0]['children'].append(len(out['nodes']))
        out['nodes'].append({'name': name, 'mesh': mesh_index})
    report = {'source_file': source.name, 'source_bytes': source.stat().st_size,
              'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
              'output': target.name, 'triangles_before': triangles_before,
              'triangles': triangles_after, 'meshes': len(out['meshes']),
              'cluster_grid_metres': cluster, 'max_vertex_displacement_metres': max_shift,
              'omitted_nodes': omitted, 'texture_metrics': image_metrics,
              'scale_metres_per_source_unit': scale,
              'bounds_metres': {'min': ((low-center)*scale).tolist(), 'max': ((high-center)*scale).tolist()},
              'historical_status': 'Artistic wonder asset; later Babylonian imagery is not a Sumerian reconstruction',
              'source': copy.deepcopy(g['asset'].get('extras', {}))}
    out['asset']['generator'] = 'New Babylon prepare_sacred_models.py'
    out['asset'].setdefault('extras', {})['new_babylon_sacred'] = report
    raw = writer.save(target)
    return report | {'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-directory', type=Path, default=Path.home()/'Downloads')
    parser.add_argument('--output', type=Path, default=ROOT/'assets/art-courtyard/models')
    args = parser.parse_args()
    rows = [prepare(args.source_directory/source, args.output/name, width, cluster)
            for source, name, width, cluster in MODELS]
    (args.output.parent/'sacred-models-report.json').write_text(json.dumps(rows, indent=2)+'\n')
    print(json.dumps(rows, indent=2))
