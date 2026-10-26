"""Adapt Iko Nia's supplied walking pair, retaining native topology and gait.

The folded female skirt and bare leg surfaces are fitted to the male using the
two *source* semantic bind frames. No legacy resident surface/weights are used.
Requires numpy; the supplied download and earlier human-native assets are read only.
"""
from pathlib import Path
import argparse, hashlib, json, re
import numpy as np
from prepare_native_people import (load, read, rotation, quaternion, compose,
    point_transform, smooth_normals, components, subset, merge, graph_world,
    clip_sample, skinned, Writer)

ROOT = Path(__file__).resolve().parents[2]
SOURCE_SHA = 'b98f7d15b68c0d3948989973451ca1f528fbb7a21f164c4ed0faadb9028d8e71'
SOURCE_URL = 'https://sketchfab.com/3d-models/man-woman-walk-bbaa566445074509a32ef5059a9d0bc2'


def warp(points, maturity):
    """Moderate age proportions for this source's taller, narrower head."""
    p = np.array(points, copy=True)
    if maturity >= 1:
        return p
    y = p[..., 1].copy()
    child_y = np.interp(y, [0, .83, 1.39, 1.7], [0, .74, 1.35, 1.7])
    p[..., 1] = child_y+(y-child_y)*maturity
    for axis, factors in [(0, [.89, .86, .87, 1.08, 1.08]), (2, [.94, .91, .91, 1.05, 1.05])]:
        factor = np.interp(y, [0, .83, 1.32, 1.45, 1.7], factors)
        p[..., axis] *= factor+(1-factor)*maturity
    return p


def stem(name):
    return re.sub(r'_\d+$', '', name.split(':')[-1])


def canonical_name(name, palette):
    value = stem(name)
    simple = {'Hips': 'pelvis', 'Spine': 'spine_01', 'Spine1': 'spine_02',
              'Spine2': 'spine_03', 'Neck': 'neck_01', 'Head': 'head',
              'HeadTop_End': 'head_end'}
    if palette == 0:
        return 'Root'
    if value in simple:
        return simple[value]
    for side, suffix in [('Left', 'l'), ('Right', 'r')]:
        if value.startswith(side):
            tail = value[len(side):]
            limb = {'Shoulder': 'clavicle', 'Arm': 'upperarm', 'ForeArm': 'lowerarm',
                    'Hand': 'hand', 'UpLeg': 'thigh', 'Leg': 'calf', 'Foot': 'foot',
                    'ToeBase': 'toe'}
            if tail in limb:
                return limb[tail]+'_'+suffix
            return re.sub(r'[^a-z0-9]+', '_', tail.lower())+'_'+suffix
    return re.sub(r'[^a-z0-9]+', '_', value.lower())+'_'+str(palette)


def source_part(g, binary, mesh):
    prim = g['meshes'][mesh]['primitives'][0]
    a = prim['attributes']
    data = {'p': read(g, binary, a['POSITION']).astype(float),
            'j': read(g, binary, a['JOINTS_0']).astype(int),
            'w': read(g, binary, a['WEIGHTS_0']).astype(float),
            'uv': read(g, binary, a['TEXCOORD_0']).astype(float),
            'tri': read(g, binary, prim['indices']).astype(int).reshape(-1, 3)}
    if mesh == 6:
        # One malformed, effectively zero-weight author vertex made a long spike.
        bad = np.unique(data['tri'])[data['w'][np.unique(data['tri'])].sum(1) < .5]
        assert bad.tolist() == [3631]
        data['j'][bad] = [6, 0, 0, 0]
        data['w'][bad] = [1, 0, 0, 0]
    return data


def rig(g, binary, si):
    skin = g['skins'][si]
    bind = np.linalg.inv(read(g, binary, skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1))
    sp = {c: i for i, n in enumerate(g['nodes']) for c in n.get('children', [])}
    palette = {node: i for i, node in enumerate(skin['joints'])}
    parents = {palette[c]: palette[p] for c, p in sp.items() if c in palette and p in palette}
    names = [canonical_name(g['nodes'][n]['name'], i) for i, n in enumerate(skin['joints'])]
    assert len(names) == len(set(names))
    # The file already uses +Y up and +Z forward in its surface bind space.
    parts = [source_part(g, binary, mi) for mi in (range(8) if si == 0 else range(8, 16))]
    allp = np.concatenate([d['p'] for d in parts])
    floor = min(source_part(g, binary, 2)['p'][:, 1]) if si == 0 else .076
    scale = 1.7/(allp[:, 1].max()-floor)
    canonical = np.eye(4)
    canonical[:3, :3] *= scale
    canonical[:3, 3] = -np.array([bind[1, 0, 3], floor, 0])*scale
    rest = np.tile(np.eye(4), (len(bind), 1, 1))
    for i in range(1, len(bind)):
        rest[i, :3, :3] = rotation(bind[i])
        rest[i, :3, 3] = point_transform(bind[i:i+1, :3, 3], canonical)[0]
    # Dummy root inherits the source X90 parent. Uniform units are removed, so
    # native hand-parented tools and all runtime IK distances remain metres.
    original_world = graph_world(g['nodes'], sp)
    dummy = original_world[skin['joints'][0]]
    rest[0, :3, :3] = rotation(dummy)
    factor = np.linalg.norm(dummy[:3, 0])*scale
    times = np.arange(30)/30
    samples = [clip_sample(g, binary, g['animations'][0], float(t+1/30)) for t in times]
    hip = skin['joints'][1]
    raw_hip = np.array([s[(hip, 'translation')] for s in samples])
    world_hip = (raw_hip*factor) @ rest[0, :3, :3].T
    rest[0, :3, 3] = [-world_hip[:, 0].mean(), -floor*scale, 0]
    local = np.array([np.linalg.inv(rest[parents[i]]) @ rest[i] if i in parents else rest[i] for i in range(len(rest))])
    t = local[:, :3, 3].copy()
    q = np.array([quaternion(rotation(m)) for m in local])
    qt = np.array([[s.get((node, 'rotation'), g['nodes'][node].get('rotation', [0, 0, 0, 1])) for node in skin['joints']] for s in samples])
    tt = np.array([[s.get((node, 'translation'), g['nodes'][node].get('translation', [0, 0, 0])) for node in skin['joints']] for s in samples])*factor
    tt[:, 0] = t[0]
    qt[:, 0] = q[0]
    # Descendant translations carry tiny exporter roundoff; preserve the authored
    # animated deltas while basing lengths on the exact canonical inverse bind.
    for i in range(2, len(rest)):
        tt[:, i] += t[i]-tt[0, i]
    return dict(skin=skin, parents=parents, names=names, rest=rest, t=t, q=q,
                walk_t=tt, walk_q=qt, canonical=canonical, scale=scale)


def worlds(t, q, parents):
    result = []
    for i in range(len(t)):
        m = compose(t[i], q[i], [1, 1, 1])
        result.append(result[parents[i]] @ m if i in parents else m)
    return np.array(result)


def aim(t, q, parents, bone, child, target):
    w = worlds(t, q, parents)
    old = w[child, :3, 3]-w[bone, :3, 3]
    new = target-w[bone, :3, 3]
    old /= np.linalg.norm(old)
    new /= np.linalg.norm(new)
    delta = np.r_[np.cross(old, new), 1+np.dot(old, new)]
    delta /= np.linalg.norm(delta)
    desired = compose([0, 0, 0], delta, [1, 1, 1])[:3, :3] @ rotation(w[bone])
    parent = rotation(w[parents[bone]]) if bone in parents else np.eye(3)
    q[bone] = quaternion(parent.T @ desired)


def calm_idle(t, q, parents, names, skirt):
    q = q.copy()
    for suffix in ['l', 'r']:
        upper, lower, hand = [names.index(k+'_'+suffix) for k in ['upperarm', 'lowerarm', 'hand']]
        w = worlds(t, q, parents)
        a, b, c = w[[upper, lower, hand], :3, 3]
        side = np.sign(a[0])
        l1, l2 = np.linalg.norm(b-a), np.linalg.norm(c-b)
        palm_y = a[1]-(l1+l2)*.90
        nearby = skirt['p'][abs(skirt['p'][:, 1]-palm_y) < .09]
        edge = np.max(abs(nearby[:, 0])) if len(nearby) else .23
        target = np.array([side*max(edge+.075, abs(a[0])+.045), palm_y, .015])
        d = target-a
        distance = min(np.linalg.norm(d), (l1+l2)*.98)
        d /= np.linalg.norm(d)
        along = (l1*l1-l2*l2+distance*distance)/(2*distance)
        height = np.sqrt(max(0, l1*l1-along*along))
        bend = np.array([side*.7, -.15, -.7])
        bend -= d*np.dot(bend, d)
        bend /= np.linalg.norm(bend)
        aim(t, q, parents, upper, lower, a+d*along+bend*height)
        aim(t, q, parents, lower, hand, a+d*distance)
    return q


class SourceWriter(Writer):
    def mesh(self, name, data, material):
        attributes = {'POSITION': self.accessor(data['p'], 'VEC3'),
                      'NORMAL': self.accessor(smooth_normals(data['p'], data['tri']), 'VEC3'),
                      'JOINTS_0': self.accessor(data['j'], 'VEC4', 5121),
                      'WEIGHTS_0': self.accessor(data['w'], 'VEC4'),
                      'TEXCOORD_0': self.accessor(data['uv'], 'VEC2')}
        index = len(self.g['meshes'])
        self.g['meshes'].append({'name': name, 'primitives': [{'attributes': attributes,
            'indices': self.accessor(data['tri'], 'SCALAR', 5123), 'material': material}]})
        self.g['nodes'].append({'name': name, 'mesh': index, 'skin': 0})
        self.g['nodes'][0]['children'].append(len(self.g['nodes'])-1)

    def clip(self, name, times, translations, rotations):
        clip = {'name': name, 'samplers': [], 'channels': []}
        ti = self.accessor(times, 'SCALAR')
        constant_ti = self.accessor([times[0], times[-1]], 'SCALAR')
        for bone in range(rotations.shape[1]):
            for path, values, kind in [('translation', translations[:, bone], 'VEC3'),
                                       ('rotation', rotations[:, bone], 'VEC4')]:
                constant = np.max(np.ptp(values, axis=0)) < 1e-7
                si = len(clip['samplers'])
                clip['samplers'].append({'input': constant_ti if constant else ti,
                    'output': self.accessor(values[[0, -1]] if constant else values, kind), 'interpolation': 'LINEAR'})
                clip['channels'].append({'sampler': si, 'target': {'node': bone+1, 'path': path}})
        self.g['animations'].append(clip)


def build(g, binary, variant, out):
    female = variant == 'female'
    r = rig(g, binary, 0 if female else 1)
    fr = r if female else rig(g, binary, 0)
    mr = rig(g, binary, 1) if female else r
    maturity = 0 if variant == 'child' else .65 if variant == 'adolescent' else 1
    rest = r['rest'].copy()
    original_rest = rest.copy()
    for i in range(1, len(rest)):
        rest[i, :3, 3] = warp(rest[i, :3, 3], maturity)
    local = np.array([np.linalg.inv(rest[r['parents'][i]]) @ rest[i] if i in r['parents'] else rest[i] for i in range(len(rest))])
    t, q = local[:, :3, 3], np.array([quaternion(rotation(m)) for m in local])

    def part(mi, from_female=False, source_rig=None):
        d = source_part(g, binary, mi)
        source_rig = source_rig or (fr if from_female else r)
        d['p'] = point_transform(d['p'], source_rig['canonical'])
        if source_rig is not r:
            remap = {i: r['names'].index(n) for i, n in enumerate(source_rig['names']) if n in r['names']}
            mapped = np.vectorize(lambda i: remap.get(int(i), 0))(d['j'])
            # The same supplied model's native weights and corresponding bind
            # frames provide a geometric fit, without a nearest-surface transfer.
            d['p'] = skinned(d, original_rest[np.array([remap.get(i, 0) for i in range(len(source_rig['names']))])], np.linalg.inv(source_rig['rest']))
            d['j'] = mapped
        d['p'] = warp(d['p'], maturity)
        return d

    body = part(2 if female else 10)
    upper = part(0 if female else 9)
    if not female:
        # The collar is a separately connected 24-triangle source component.
        faces = [c for c in components(upper['p'], upper['tri']) if len(c) != 24]
        upper = subset(upper, np.concatenate(faces))
        legs = part(2, True)
        leg_faces = [c for c in components(legs['p'], legs['tri']) if len(c) in [648, 104]]
        assert sorted(map(len, leg_faces)) == [104, 104, 648]
        body = merge([body, subset(legs, np.concatenate(leg_faces))])
    skirt = part(7, not female)
    # A modest clearance follows the authored folded surface. Its topology,
    # asymmetric hem, overlapping panels and source bone weights are retained.
    centre_z = np.median(skirt['p'][:, 2])
    radial = skirt['p'][:, [0, 2]]-np.array([0, centre_z])
    radial /= np.maximum(np.linalg.norm(radial, axis=1, keepdims=True), 1e-6)
    skirt['p'][:, [0, 2]] += radial*.012
    # The supplied skin has ankles but no complete toe caps underneath footwear.
    # Retain a closed source surface: the male's low, flat foot shape is fitted
    # to both native rigs, with a plain matte leather material and low sole.
    feet = part(11, source_rig=mr)
    foot_floor = feet['p'][:, 1].min()
    feet['p'][:, 1] = foot_floor+(feet['p'][:, 1]-foot_floor)*.94
    parts = [('Native civilian skin', body, 0), ('Native upper cloth', upper, 1),
             ('Native draped wool skirt', skirt, 2), ('Source flat leather foot cover', feet, 7)]
    for mi, name, material in [(3 if female else 12, 'Source eye white', 4),
                               (4 if female else 13, 'Source eye dark', 5),
                               (5 if female else 14, 'Source lip', 6),
                               (6 if female else 15, 'Source scalp hair', 3)]:
        parts.append((name, part(mi), material))
    ib = np.linalg.inv(rest)
    wt = r['walk_t']+(t-r['t'])[None]
    wq = r['walk_q'].copy()
    # Ground the retained flat soles per frame; only the dummy root moves.
    ground = []
    ground_surface = merge([body, feet])
    soles = ground_surface['p'][:, 1] < .12
    for f in range(30):
        posed = skinned(ground_surface, worlds(wt[f], wq[f], r['parents']), ib)
        floor = posed[soles, 1].min()
        wt[f, 0, 1] -= floor
        ground.append(float(floor))
    iq = calm_idle(t, q, r['parents'], r['names'], skirt)
    it = t.copy()
    posed = skinned(ground_surface, worlds(it, iq, r['parents']), ib)
    it[0, 1] -= posed[soles, 1].min()
    # Derive distance from the native rearward stance velocity, not clip naming.
    ankle_tracks = []
    for side in ['l', 'r']:
        foot = r['names'].index('foot_'+side)
        ankle_tracks.append(np.array([worlds(wt[f], wq[f], r['parents'])[foot, :3, 3] for f in range(30)]))
    velocities = []
    for track in ankle_tracks:
        velocity = np.diff(track[:, 2])*30
        low = track[:-1, 1] < np.min(track[:, 1])+.055
        velocities.extend((-velocity[low & (velocity < -.05)]).tolist())
    stride = float(np.median(velocities))
    assert .25 < stride < 4
    meta = {'rig': 'ikonia-mixamo', 'sourceWalk': True, 'bones': len(rest),
            'age': variant if maturity < 1 else 'adult', 'sex': 'f' if female else 'm' if maturity == 1 else 'neutral',
            'strideMetres': stride, 'semanticMap': {name: i for i, name in enumerate(r['names'])},
            'provenance': {'author': 'Iko Nia (https://sketchfab.com/iko.gazette)',
                'license': 'CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/)', 'source': SOURCE_URL, 'sha256': SOURCE_SHA},
            'walk': {'sourceName': 'Animation', 'sourceFrames': 30, 'sourceStart': 1/30, 'sourceEnd': 1,
                     'loopDuration': 1, 'sourceQuaternionsPreserved': True,
                     'method': 'authored native source walk in canonical metres',
                     'strideMethod': 'median rearward native ankle velocity during low stance'}}
    writer = SourceWriter()
    writer.g['asset'].update(generator='New Babylon prepare_source_walk_people.py', extras={'native_resident': meta})
    writer.g['nodes'] = [{'name': 'SourceWalkResident', 'children': [1], 'extras': {'native_resident': meta}}]
    for i, name in enumerate(r['names']):
        n = {'name': name, 'translation': it[i].tolist(), 'rotation': iq[i].tolist()}
        children = [child+1 for child, parent in r['parents'].items() if parent == i]
        if children:
            n['children'] = children
        writer.g['nodes'].append(n)
    writer.g['skins'] = [{'name': 'Native source Mixamo skin', 'joints': list(range(1, len(rest)+1)),
                          'skeleton': 1, 'inverseBindMatrices': writer.accessor(ib.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]
    palette = [('Source warm skin', [.58, .31, .16]), ('Undyed linen cloth', [.49, .39, .25]),
               ('Ochre wool cloth', [.27, .16, .075]), ('Source dark hair', [.035, .018, .008]),
               ('Source eye white', [.67, .62, .49]), ('Source eye dark', [.008, .006, .004]),
               ('Source lip', [.40, .16, .085]), ('Matte earth leather', [.17, .105, .055])]
    for name, color in palette:
        writer.g['materials'].append({'name': name, 'doubleSided': True,
            'pbrMetallicRoughness': {'baseColorFactor': color+[1], 'metallicFactor': 0, 'roughnessFactor': .96}})
    for name, data, material in parts:
        writer.mesh(name, data, material)
    times = np.arange(31)/30
    writer.clip('Walk_Loop', times, np.concatenate([wt, wt[:1]]), np.concatenate([wq, wq[:1]]))
    writer.clip('Idle_Loop', np.array([0, 2]), np.stack([it, it]), np.stack([iq, iq]))
    path = out/('source-walk-'+variant+'.glb')
    size = writer.save(path)
    weighted = set(np.concatenate([d['j'][d['w'] > 1e-6] for _, d, _ in parts]).tolist())
    return {'variant': variant, 'bytes': size, 'triangles': sum(len(d['tri']) for _, d, _ in parts),
            'bones': len(rest), 'weightedJoints': len(weighted), 'maxWeightedJointIndex': max(weighted),
            'strideMetres': stride, 'groundCorrection': [min(ground), max(ground)], 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, default=Path('/Users/back/Downloads/man_woman_walk.glb'))
    parser.add_argument('--output', type=Path, default=ROOT/'assets/art-courtyard/models')
    args = parser.parse_args()
    g, binary, raw = load(args.source)
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA, 'Unexpected source file'
    args.output.mkdir(parents=True, exist_ok=True)
    report = [build(g, binary, v, args.output) for v in ['male', 'female', 'child', 'adolescent']]
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
