"""Prepare one complete hand-held candle from the supplied CC-BY cluster.

The source's three wax candles share a single watertight surface. Selecting
triangles by their centres cuts holes through its long wall faces. This script
instead clips triangles geometrically, interpolates their authored UVs/normals,
and closes every cut with a planar wax cap. Source colour and credit survive;
two other candles, shared puddle, cobweb and animated flame are omitted. Runtime
supplies the tiny flame so this prop needs no rig or animation evaluation.
Requires bundled NumPy/Pillow; never modifies the user's Downloads source.
"""
from pathlib import Path
from collections import Counter, defaultdict
import io, json, hashlib
import numpy as np
from PIL import Image
from prepare_city_fauna import GLB
from prepare_sacred_models import Writer

ROOT = Path(__file__).resolve().parents[2]
SOURCE = Path.home() / 'Downloads/candle_light.glb'
TARGET = ROOT / 'assets/art-courtyard/models/festival-candle.glb'


def welded_edges(triangles, decimals=5):
    points = triangles[:, :, :3].reshape(-1, 3)
    unique, weld = np.unique(np.round(points, decimals), axis=0, return_inverse=True)
    faces = weld.reshape(-1, 3)
    edges = Counter(tuple(sorted((int(a), int(b))))
                    for face in faces for a, b in zip(face, np.roll(face, -1)))
    return unique, faces, edges


def triangulate_cap(points, outward):
    """Ear clipping retains boundary vertices, including collinear UV seams."""
    u = np.cross(outward, [0, 1, 0])
    if np.linalg.norm(u) < .1:
        u = np.cross(outward, [1, 0, 0])
    u /= np.linalg.norm(u)
    v = np.cross(outward, u)
    xy = points @ np.array([u, v]).T
    order = list(range(len(points)))
    cross = lambda a, b: a[0]*b[1] - a[1]*b[0]
    area = sum(cross(xy[i], xy[(i+1) % len(xy)]) for i in order)
    if area < 0:
        order.reverse()
    result = []
    while len(order) > 3:
        for j, b in enumerate(order):
            a, c = order[j-1], order[(j+1) % len(order)]
            if cross(xy[b]-xy[a], xy[c]-xy[b]) <= 1e-8:
                continue
            def inside(k):
                return all(cross(q-p, xy[k]-p) >= -1e-8 for p, q in
                           [(xy[a], xy[b]), (xy[b], xy[c]), (xy[c], xy[a])])
            if any(inside(k) for k in order if k not in (a, b, c)):
                continue
            result.append([a, b, c])
            order.pop(j)
            break
        else:
            raise ValueError('Non-simple candle cut boundary')
    result.append(order)
    return result


def clip_closed(triangles, inward, offset, cap_uv):
    """Intersect an intact mesh with a half space, capping all cut loops."""
    inward = np.array(inward, dtype=float)
    inward /= np.linalg.norm(inward)
    clipped = []
    for face in triangles:
        polygon = []
        for j, b in enumerate(face):
            a = face[j-1]
            da, db = a[:3] @ inward + offset, b[:3] @ inward + offset
            ia, ib = da >= -1e-8, db >= -1e-8
            if ia != ib:
                polygon.append(a + (b-a) * (da/(da-db)))
            if ib:
                polygon.append(b)
        for j in range(1, len(polygon)-1):
            triangle = np.array([polygon[0], polygon[j], polygon[j+1]])
            if np.linalg.norm(np.cross(triangle[1, :3]-triangle[0, :3], triangle[2, :3]-triangle[0, :3])) > 1e-8:
                clipped.append(triangle)
    clipped = np.array(clipped)
    # Reuse identical cut coordinates on UV/normal seams before the next cut.
    # Otherwise rounding only the cap can make the next intersection disagree
    # with its adjacent wall by a few millionths of a source unit.
    clipped[:, :, :3] = np.round(clipped[:, :, :3], 5)
    unique, faces, edges = welded_edges(clipped)
    boundary = [edge for edge, count in edges.items() if count == 1]
    if not boundary:
        return clipped, 0
    assert all(abs(unique[i] @ inward + offset) < 2e-5 for edge in boundary for i in edge), 'Unexpected source hole'
    adjacency = defaultdict(list)
    for a, b in boundary:
        adjacency[a].append(b)
        adjacency[b].append(a)
    assert all(len(neighbours) == 2 for neighbours in adjacency.values()), 'Branched cut boundary'
    remaining = set(adjacency)
    caps = []
    while remaining:
        first = min(remaining)
        loop, previous, current = [], None, first
        while current not in loop:
            loop.append(current)
            remaining.discard(current)
            following = next(n for n in adjacency[current] if n != previous)
            previous, current = current, following
        assert current == first, 'Open candle cut'
        points = unique[loop]
        normals = np.repeat([-inward], len(points), axis=0)
        uv = np.repeat([cap_uv], len(points), axis=0)
        vertices = np.c_[points, normals, uv]
        for face in triangulate_cap(points, -inward):
            caps.append(vertices[face])
    result = np.concatenate([clipped, np.array(caps)])
    _, _, closed_edges = welded_edges(result)
    assert set(closed_edges.values()) == {2}, 'Cut failed to produce a closed candle'
    return result, len(caps)


def prepare():
    source = GLB(SOURCE)
    g = source.g
    node = next(i for i, n in enumerate(g['nodes']) if n.get('name') == 'Object003_candles_0')
    primitive = g['meshes'][g['nodes'][node]['mesh']]['primitives'][0]
    attr, world = primitive['attributes'], source.world({})[node]
    original_p = source.read(attr['POSITION'])
    p = (np.c_[original_p, np.ones(len(original_p))] @ world.T)[:, :3]
    n = source.read(attr['NORMAL']) @ np.linalg.inv(world[:3, :3])
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    uv = source.read(attr['TEXCOORD_0'])
    faces = source.read(primitive['indices']).reshape(-1, 3).astype(int)
    if np.linalg.det(world[:3, :3]) < 0:
        faces = faces[:, [0, 2, 1]]
    material = g['materials'][primitive['material']]
    texture = g['textures'][material['pbrMetallicRoughness']['baseColorTexture']['index']]
    image = g['images'][texture['source']]
    view = g['bufferViews'][image['bufferView']]
    raw_image = source.b[view.get('byteOffset', 0):view.get('byteOffset', 0)+view['byteLength']]
    atlas = Image.open(io.BytesIO(raw_image)).convert('RGB')
    # The brightest source wax texel gives the tiny new cut caps the same
    # authored ivory. All uncut exterior faces keep their interpolated UVs.
    pixels = np.asarray(atlas)
    texels = np.clip((uv*np.array(atlas.size)).astype(int), 0, np.array(atlas.size)-1)
    brightness = pixels[texels[:, 1], texels[:, 0]].mean(1)
    cap_uv = uv[int(np.argmax(brightness))]
    triangles = np.c_[p, n, uv][faces]
    caps = []
    triangles, count = clip_closed(triangles, [0, 1, 0], -8, cap_uv)
    caps.append({'plane': 'base above shared melted pool', 'triangles': count})
    # Short candle axis and neighbours, measured in the source's world space.
    axes = np.array([[2.1, -4.2], [5.0, -30.0], [25.3, -16.3]])
    for other in axes[1:]:
        inward_xz = axes[0]-other
        offset = (np.dot(other, other)-np.dot(axes[0], axes[0])) / 2 / np.linalg.norm(inward_xz)
        triangles, count = clip_closed(triangles, [inward_xz[0], 0, inward_xz[1]], offset, cap_uv)
        caps.append({'plane': 'between adjacent candle axes', 'triangles': count})
    # The original fused wax has thin taller-neighbour ridges inside the
    # short candle's sector. Trim these just above its highest authored lip.
    triangles, count = clip_closed(triangles, [0, -1, 0], 62.3, cap_uv)
    caps.append({'plane': 'short candle lip; removes neighbouring tall wax', 'triangles': count})
    # Normalize around the authored wick axis; its bottom is y=0. The highest
    # wax lip is slightly above the wick, so the visual flame rises above it.
    low, high = triangles[:, :, :3].min(axis=(0, 1)), triangles[:, :, :3].max(axis=(0, 1))
    scale = .4/(high[1]-low[1])
    origin = np.array([2.1, low[1], -4.2])
    triangles[:, :, :3] = (triangles[:, :, :3]-origin)*scale
    p = triangles[:, :, :3].reshape(-1, 3)
    n = triangles[:, :, 3:6].reshape(-1, 3)
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)
    uv = triangles[:, :, 6:8].reshape(-1, 2)
    # Deduplicate only matching position, normal and UV; preserve hard seams.
    combined, remap = np.unique(np.round(np.c_[p, n, uv], 9), axis=0, return_inverse=True)
    p, n, uv = combined[:, :3], combined[:, 3:6], combined[:, 6:8]
    faces = remap.reshape(-1, 3)
    _, _, final_edges = welded_edges(triangles, 8)
    assert set(final_edges.values()) == {2}
    writer = Writer(g['asset'])
    out = writer.g
    out['nodes'][0]['name'] = 'NewBabylonFestivalCandle'
    original_size = atlas.size
    atlas.thumbnail((256, 256), Image.Resampling.LANCZOS)
    encoded = io.BytesIO()
    atlas.save(encoded, format='JPEG', quality=86, optimize=True)
    out['images'] = [{'bufferView': writer.buffer(encoded.getvalue()), 'mimeType': 'image/jpeg'}]
    out['textures'] = [{'source': 0, 'sampler': 0}]
    out['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    out['materials'] = [{'name': 'ivory-wax-and-wick', 'pbrMetallicRoughness': {
        'baseColorTexture': {'index': 0}, 'metallicFactor': 0, 'roughnessFactor': .86}, 'doubleSided': False}]
    out['meshes'] = [{'name': 'complete-source-short-candle', 'primitives': [{
        'attributes': {'POSITION': writer.accessor(p, 'VEC3'), 'NORMAL': writer.accessor(n, 'VEC3'), 'TEXCOORD_0': writer.accessor(uv, 'VEC2')},
        'indices': writer.accessor(faces.reshape(-1, 1), 'SCALAR', 5123), 'material': 0}]}]
    wick_tip = (np.array([2.089, 59.94, -4.34])-origin)*scale
    # Start the small live flame at the wick; its centre is .035 m higher.
    out['nodes'].append({'name': 'complete-source-short-candle', 'mesh': 0})
    out['nodes'][0]['children'] = [1]
    out['nodes'][0]['extras'] = {'palmGripMetres': [0, .1, 0], 'wickTipMetres': wick_tip.tolist(),
                                'flameCenterMetres': (wick_tip+np.array([0, .035, 0])).tolist()}
    out['asset']['extras']['adaptation'] = 'Single complete short candle geometrically clipped with closed wax caps; native exterior UVs; 256px colour atlas; no source skeleton, cobweb or shared puddle. Fictional festival prop, not an attested Sumerian candle.'
    out['asset']['extras']['sourceSHA256'] = hashlib.sha256(SOURCE.read_bytes()).hexdigest()
    raw = writer.save(TARGET)
    # Verify the serialized output, not just intermediate double precision.
    result = GLB(TARGET)
    result_primitive = result.g['meshes'][0]['primitives'][0]
    actual_p = result.read(result_primitive['attributes']['POSITION'])
    actual_tri = result.read(result_primitive['indices']).reshape(-1, 3).astype(int)
    _, _, actual_edges = welded_edges(actual_p[actual_tri], 8)
    assert set(actual_edges.values()) == {2}, 'Serialized candle must stay watertight'
    report = {'sourceBytes': SOURCE.stat().st_size, 'outputBytes': len(raw),
              'triangles': len(faces), 'vertices': len(p), 'textureSource': original_size,
              'textureOutput': atlas.size, 'bounds': [p.min(0).tolist(), p.max(0).tolist()],
              'closedManifold': True, 'boundaryEdges': 0, 'nonManifoldEdges': 0,
              'sourceWaxTriangles': len(source.read(primitive['indices']))//3, 'cuts': caps,
              'palmGripMetres': [0, .1, 0], 'wickTipMetres': wick_tip.tolist(),
              'flameCenterMetres': (wick_tip+np.array([0, .035, 0])).tolist(),
              'author': g['asset']['extras']['author'], 'license': g['asset']['extras']['license'],
              'source': g['asset']['extras']['source'], 'sha256': hashlib.sha256(raw).hexdigest()}
    (ROOT/'assets/art-courtyard/festival-candle-report.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report))


if __name__ == '__main__':
    prepare()
