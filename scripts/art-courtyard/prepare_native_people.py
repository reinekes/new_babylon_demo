"""Prepare the supplied indigoat human base with its own 41-joint skin.

No old resident surface or skin weights are transferred. A new planted-foot gait
uses the native limb lengths; the supplied gesture is not called walking.
Requires bundled numpy. The downloaded file and existing sumer assets are read only.
"""
from pathlib import Path
import argparse, copy, hashlib, json, math, struct
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
SOURCE_SHA = '0d397eb4bfb22ed3a0af95d97886544190772154f75f2bdfbd94b6e72942b9be'
DT = {5126: '<f4', 5125: '<u4', 5123: '<u2', 5121: 'u1'}
WIDTH = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}
NAMES = ['Root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', 'neck_02', 'head', 'head_end',
         'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'hand_end_l',
         'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'hand_end_r',
         'breast_l', 'breast_end_l', 'breast_r', 'breast_end_r',
         'pelvis_l', 'pelvis_end_l', 'pelvis_r', 'pelvis_end_r',
         'thigh_l', 'calf_l', 'foot_l', 'toe_l', 'toe_end_l', 'heel_l', 'heel_end_l',
         'thigh_r', 'calf_r', 'foot_r', 'toe_r', 'toe_end_r', 'heel_r', 'heel_end_r']


def load(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF' and struct.unpack_from('<I', raw, 8)[0] == len(raw)
    n = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20+n]), raw[28+n:], raw


def read(g, binary, index):
    a = g['accessors'][index]
    v = g['bufferViews'][a['bufferView']]
    d, w = np.dtype(DT[a['componentType']]), WIDTH[a['type']]
    return np.ndarray((a['count'], w), dtype=d, buffer=binary,
                      offset=v.get('byteOffset', 0)+a.get('byteOffset', 0),
                      strides=(v.get('byteStride', w*d.itemsize), d.itemsize)).copy()


def rotation(m):
    u, _, vt = np.linalg.svd(m[:3, :3])
    r = u @ vt
    if np.linalg.det(r) < 0:
        u[:, -1] *= -1
        r = u @ vt
    return r


def quaternion(r):
    # Stable matrix conversion, including rotations close to 180 degrees.
    q = np.empty(4)
    tr = np.trace(r)
    if tr > 0:
        s = math.sqrt(tr+1)*2
        q[:] = [(r[2, 1]-r[1, 2])/s, (r[0, 2]-r[2, 0])/s, (r[1, 0]-r[0, 1])/s, s/4]
    else:
        i = int(np.argmax(np.diag(r)))
        j, k = (i+1) % 3, (i+2) % 3
        s = math.sqrt(max(1e-12, 1+r[i, i]-r[j, j]-r[k, k]))*2
        q[i], q[j], q[k], q[3] = s/4, (r[j, i]+r[i, j])/s, (r[k, i]+r[i, k])/s, (r[k, j]-r[j, k])/s
    return q/np.linalg.norm(q)


def quat_matrix(q):
    x, y, z, w = q
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                     [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                     [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])


def compose(t, q, scale):
    m = np.eye(4)
    m[:3, :3] = quat_matrix(q) @ np.diag(scale)
    m[:3, 3] = t
    return m


def decompose(m):
    return m[:3, 3].copy(), quaternion(rotation(m)), np.linalg.norm(m[:3, :3], axis=0)


def point_transform(points, matrix):
    return (np.c_[points, np.ones(len(points))] @ matrix.T)[:, :3]


def smooth_normals(p, tri):
    # Keep the author's vertex positions and UV seams; pool only coincident normals.
    _, weld = np.unique(np.round(p, 5), axis=0, return_inverse=True)
    summed = np.zeros((weld.max()+1, 3))
    face = np.cross(p[tri[:, 1]]-p[tri[:, 0]], p[tri[:, 2]]-p[tri[:, 0]])
    for k in range(3):
        np.add.at(summed, weld[tri[:, k]], face)
    summed /= np.maximum(np.linalg.norm(summed, axis=1, keepdims=True), 1e-12)
    return summed[weld]


def components(p, tri):
    _, weld = np.unique(np.round(p, 5), axis=0, return_inverse=True)
    parents = list(range(int(weld.max())+1))
    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for face in weld[tri]:
        r = root(int(face[0]))
        for i in face[1:]:
            parents[root(int(i))] = r
    result = {}
    for face in tri:
        result.setdefault(root(int(weld[face[0]])), []).append(face)
    return [np.array(faces) for faces in result.values()]


def subset(data, tri):
    used, inverse = np.unique(tri, return_inverse=True)
    return {key: value[used].copy() for key, value in data.items() if key != 'tri'} | {'tri': inverse.reshape(-1, 3)}


def merge(parts):
    result = {key: [] for key in ['p', 'j', 'w', 'uv', 'tri']}
    offset = 0
    for part in parts:
        for key in ['p', 'j', 'w', 'uv']:
            result[key].append(part[key])
        result['tri'].append(part['tri']+offset)
        offset += len(part['p'])
    return {key: np.concatenate(value) for key, value in result.items()}


def warp(points, maturity):
    p = np.array(points, copy=True)
    if maturity >= 1:
        return p
    y = p[..., 1].copy()
    child_y = np.interp(y, [0, .86, 1.42, 1.7], [0, .70, 1.22, 1.7])
    child_y = np.where(y > 1.7, 1.7+(y-1.7)*(.48/.28), child_y)
    p[..., 1] = child_y+(y-child_y)*maturity
    for axis, values in [(0, [.86, .78, .79, 1.14, 1.14]), (2, [.93, .86, .85, 1.10, 1.10])]:
        factor = np.interp(y, [0, .86, 1.35, 1.47, 1.7], values)
        p[..., axis] *= factor+(1-factor)*maturity
    return p


def graph_world(nodes, parents, overrides=None):
    cache = {}
    overrides = overrides or {}
    def world(i):
        if i not in cache:
            n = nodes[i]
            if 'matrix' in n:
                local = np.array(n['matrix']).reshape(4, 4).T
            else:
                local = compose(overrides.get((i, 'translation'), n.get('translation', [0, 0, 0])),
                                overrides.get((i, 'rotation'), n.get('rotation', [0, 0, 0, 1])),
                                overrides.get((i, 'scale'), n.get('scale', [1, 1, 1])))
            cache[i] = world(parents[i]) @ local if i in parents else local
        return cache[i]
    return [world(i) for i in range(len(nodes))]


def clip_sample(g, binary, clip, time):
    result = {}
    for c in clip['channels']:
        sampler = clip['samplers'][c['sampler']]
        times, values = read(g, binary, sampler['input']).ravel(), read(g, binary, sampler['output'])
        right = int(np.searchsorted(times, time, side='right'))
        left, right = max(0, right-1), min(len(times)-1, right)
        t = 0 if left == right or sampler.get('interpolation') == 'STEP' else (time-times[left])/(times[right]-times[left])
        a, b = values[left].astype(float), values[right].astype(float)
        if c['target']['path'] == 'rotation':
            if np.dot(a, b) < 0:
                b = -b
            v = a+(b-a)*t
            v /= np.linalg.norm(v)
        else:
            v = a+(b-a)*t
        result[(c['target']['node'], c['target']['path'])] = v
    return result


def pose_world(t, q, scales, parents):
    out = []
    for i in range(41):
        m = compose(t[i], q[i], scales[i])
        out.append(out[parents[i]] @ m if i in parents else m)
    return np.array(out)


def skinned(data, worlds, inverse_bind):
    matrices = worlds @ inverse_bind
    v = np.c_[data['p'], np.ones(len(data['p']))]
    result = np.zeros_like(v)
    for k in range(4):
        result += np.einsum('nij,nj->ni', matrices[data['j'][:, k]], v)*data['w'][:, k, None]
    return result[:, :3]


def aim_world(q, t, scales, parents, bone, child, endpoint):
    world = pose_world(t, q, scales, parents)
    old = world[child, :3, 3]-world[bone, :3, 3]
    new = endpoint-world[bone, :3, 3]
    old, new = old/np.linalg.norm(old), new/np.linalg.norm(new)
    axis, dot = np.cross(old, new), np.dot(old, new)
    if dot < -.99999:
        axis = np.cross(old, [0, 0, 1])
        axis /= np.linalg.norm(axis)
        delta = quat_matrix([*axis, 0])
    else:
        d = np.r_[axis, 1+dot]
        d /= np.linalg.norm(d)
        delta = quat_matrix(d)
    desired = delta @ rotation(world[bone])
    parent = rotation(world[parents[bone]]) if bone in parents else np.eye(3)
    q[bone] = quaternion(parent.T @ desired)


def relaxed_arms(t, q, scales, parents, swing=0):
    for side, upper, lower, hand in [(1, 10, 11, 12), (-1, 15, 16, 17)]:
        world = pose_world(t, q, scales, parents)
        shoulder, elbow, palm = world[[upper, lower, hand], :3, 3]
        l1, l2 = np.linalg.norm(elbow-shoulder), np.linalg.norm(palm-elbow)
        goal = np.array([side*.22, shoulder[1]-min(.54, (l1+l2)*.95), .04+side*swing])
        direction = goal-shoulder
        length = min(np.linalg.norm(direction), l1+l2-.004)
        direction /= np.linalg.norm(direction)
        along = (l1*l1-l2*l2+length*length)/(2*length)
        height = math.sqrt(max(0, l1*l1-along*along))
        bend = np.array([side*.65, -.2, -.7])
        bend -= direction*np.dot(bend, direction)
        bend /= np.linalg.norm(bend)
        aim_world(q, t, scales, parents, upper, lower, shoulder+direction*along+bend*height)
        aim_world(q, t, scales, parents, lower, hand, shoulder+direction*length)


def planted_gait(base_t, base_q, scales, parents, rest, feet, inverse_bind):
    """Two quiet cycles: linear rearward stance, low forward swing, native soles.

    Stance lasts 60% of each cycle. Clip distance is derived from this same
    rearward sole speed, so runtime distance sampling can keep the planted foot
    fixed in the city. No root horizontal motion is baked into the actor.
    """
    duration, cycle, stance = 2.4, 1.2, .6
    times = np.linspace(0, duration, 73)
    ratio = (np.linalg.norm(rest[28, :3, 3]-rest[27, :3, 3])+
             np.linalg.norm(rest[29, :3, 3]-rest[28, :3, 3]))/.84
    step, lift = .42*ratio, .065*ratio
    translations, rotations, grounds, feet_z = [], [], [], []
    smooth = lambda x: x*x*(3-2*x)
    for time in times:
        phase = (time/cycle) % 1
        t, q = base_t.copy(), base_q.copy()
        t[0, 1] -= (.033-.005*math.cos(phase*4*math.pi))*ratio
        t[0, 0] += .006*math.sin(phase*2*math.pi)*ratio
        for side, upper, lower, foot, offset in [(1, 27, 28, 29, 0), (-1, 34, 35, 36, .5)]:
            f = (phase+offset) % 1
            if f < stance:
                z, rise = step*(.5-f/stance), 0
                pitch = -.06*(1-f/.08) if f < .08 else .16*smooth((f-.5)/.1) if f > .5 else 0
            else:
                u = (f-stance)/(1-stance)
                z, rise = step*(-.5+smooth(u)), lift*math.sin(math.pi*u)
                pitch = .12*math.cos(math.pi*u)
            goal = rest[foot, :3, 3].copy()
            goal[0] *= .95
            goal[1] += rise
            goal[2] += z
            for correction in range(3):
                world = pose_world(t, q, scales, parents)
                hip, knee, ankle = world[[upper, lower, foot], :3, 3]
                l1, l2 = np.linalg.norm(knee-hip), np.linalg.norm(ankle-knee)
                ray = goal-hip
                length = min(np.linalg.norm(ray), l1+l2-.003)
                direction = ray/np.linalg.norm(ray)
                along = (l1*l1-l2*l2+length*length)/(2*length)
                height = math.sqrt(max(0, l1*l1-along*along))
                bend = np.array([side*.12, 0, 1.])
                bend -= direction*np.dot(bend, direction)
                bend /= np.linalg.norm(bend)
                aim_world(q, t, scales, parents, upper, lower, hip+direction*along+bend*height)
                aim_world(q, t, scales, parents, lower, foot, hip+direction*length)
                world = pose_world(t, q, scales, parents)
                c, s = math.cos(pitch), math.sin(pitch)
                foot_rotation = np.array([[1, 0, 0], [0, c, -s], [0, s, c]]) @ rotation(rest[foot])
                q[foot] = quaternion(rotation(world[lower]).T @ foot_rotation)
                world = pose_world(t, q, scales, parents)
                sole = skinned(feet, world, inverse_bind)[feet['p'][:, 0]*side > 0, 1].min()
                # Source footwear has native calf/heel weights too. Correct the
                # actual sole, independently for each leg, rather than the ankle.
                goal[1] += rise-sole
        relaxed_arms(t, q, scales, parents, .065*math.sin(phase*2*math.pi)*ratio)
        world = pose_world(t, q, scales, parents)
        t[0, 1] -= skinned(feet, world, inverse_bind)[:, 1].min()
        world = pose_world(t, q, scales, parents)
        grounds.append(float(skinned(feet, world, inverse_bind)[:, 1].min()))
        feet_z.append(world[[29, 36], 2, 3])
        translations.append(t)
        rotations.append(q)
    translations, rotations = np.array(translations), np.array(rotations)
    for frame in range(1, len(rotations)):
        flip = np.sum(rotations[frame]*rotations[frame-1], axis=1) < 0
        rotations[frame, flip] *= -1
    return times, translations, rotations, 2*step/stance, np.ptp(feet_z, axis=0), grounds


class Writer:
    def __init__(self):
        self.g = {'asset': {'version': '2.0'}, 'scene': 0, 'scenes': [{'nodes': [0]}],
                  'nodes': [], 'meshes': [], 'skins': [], 'materials': [], 'animations': [],
                  'accessors': [], 'bufferViews': []}
        self.binary = bytearray()

    def accessor(self, values, kind, component=5126):
        a = np.asarray(values, dtype=DT[component]).reshape(-1, WIDTH[kind])
        while len(self.binary) % 4:
            self.binary.append(0)
        vi = len(self.g['bufferViews'])
        self.g['bufferViews'].append({'buffer': 0, 'byteOffset': len(self.binary), 'byteLength': a.nbytes})
        self.binary.extend(a.tobytes())
        index = len(self.g['accessors'])
        self.g['accessors'].append({'bufferView': vi, 'componentType': component, 'count': len(a), 'type': kind,
                                    'min': a.min(0).tolist(), 'max': a.max(0).tolist()})
        return index

    def mesh(self, name, data, material):
        attributes = {'POSITION': self.accessor(data['p'], 'VEC3'),
                      'NORMAL': self.accessor(data['n'] if 'n' in data else smooth_normals(data['p'], data['tri']), 'VEC3'),
                      'JOINTS_0': self.accessor(data['j'], 'VEC4', 5123),
                      'WEIGHTS_0': self.accessor(data['w'], 'VEC4'),
                      'TEXCOORD_0': self.accessor(data['uv'], 'VEC2')}
        index = len(self.g['meshes'])
        self.g['meshes'].append({'name': name, 'primitives': [{'attributes': attributes,
                                 'indices': self.accessor(data['tri'], 'SCALAR', 5123), 'material': material}]})
        self.g['nodes'].append({'name': name, 'mesh': index, 'skin': 0})
        self.g['nodes'][0]['children'].append(len(self.g['nodes'])-1)

    def clip(self, name, times, translations, rotations, scales):
        clip = {'name': name, 'samplers': [], 'channels': []}
        time_index = self.accessor(times, 'SCALAR')
        for bone in range(41):
            for path, values, kind in [('translation', translations[:, bone], 'VEC3'),
                                       ('rotation', rotations[:, bone], 'VEC4'),
                                       ('scale', np.tile(scales[bone], (len(times), 1)), 'VEC3')]:
                # Two keys still reset the complete native base before runtime IK.
                constant = np.max(np.ptp(values, axis=0)) < 1e-7
                selected = values[[0, -1]] if constant else values
                ti = self.accessor([times[0], times[-1]], 'SCALAR') if constant else time_index
                si = len(clip['samplers'])
                clip['samplers'].append({'input': ti, 'output': self.accessor(selected, kind), 'interpolation': 'LINEAR'})
                clip['channels'].append({'sampler': si, 'target': {'node': bone+1, 'path': path}})
        self.g['animations'].append(clip)

    def save(self, path):
        while len(self.binary) % 4:
            self.binary.append(0)
        self.g['buffers'] = [{'byteLength': len(self.binary)}]
        js = json.dumps(self.g, separators=(',', ':')).encode()
        js += b' '*((-len(js)) % 4)
        raw = struct.pack('<III', 0x46546c67, 2, 28+len(js)+len(self.binary))
        raw += struct.pack('<II', len(js), 0x4e4f534a)+js+struct.pack('<II', len(self.binary), 0x004e4942)+self.binary
        path.write_bytes(raw)
        return len(raw)


def build(source, source_bin, source_raw, variant, out_dir):
    female = variant == 'female'
    si = int(female)
    maturity = 0 if variant == 'child' else .65 if variant == 'adolescent' else 1
    source_skin = source['skins'][si]
    native_ib = read(source, source_bin, source_skin['inverseBindMatrices']).reshape(-1, 4, 4).transpose(0, 2, 1)
    bind = np.linalg.inv(native_ib)
    source_parents = {c: i for i, n in enumerate(source['nodes']) for c in n.get('children', [])}
    palette = {node: i for i, node in enumerate(source_skin['joints'])}
    parents = {palette[node]: palette[parent] for node, parent in source_parents.items() if node in palette and parent in palette}
    parts = []
    for mi in [si*3, si*3+1, si*3+2]:
        prim = source['meshes'][mi]['primitives'][0]
        a = prim['attributes']
        parts.append({'p': read(source, source_bin, a['POSITION']).astype(float),
                      'j': read(source, source_bin, a['JOINTS_0']).astype(int),
                      'w': read(source, source_bin, a['WEIGHTS_0']),
                      'uv': read(source, source_bin, a['TEXCOORD_0']),
                      'tri': read(source, source_bin, prim['indices']).astype(int).reshape(-1, 3)})
    weights_hash = hashlib.sha256(parts[0]['j'].astype('<u2').tobytes()+parts[0]['w'].astype('<f4').tobytes()).hexdigest()
    # One rigid bind-space change, applied equally to surface and joints.
    up = bind[8, :3, 3]-bind[1, :3, 3]
    up /= np.linalg.norm(up)
    forward = (bind[30, :3, 3]-bind[29, :3, 3])+(bind[37, :3, 3]-bind[36, :3, 3])
    forward -= up*np.dot(forward, up)
    forward /= np.linalg.norm(forward)
    right = np.cross(up, forward)
    right /= np.linalg.norm(right)
    basis = np.stack([right, up, forward])
    allp = np.concatenate([d['p'] for d in parts]) @ basis.T
    size = allp[:, 1].max()-allp[:, 1].min()
    scale = 1.7/size
    centre = basis @ ((bind[29, :3, 3]+bind[36, :3, 3])/2)
    centre[0] = (basis @ bind[1, :3, 3])[0]
    centre[1] = allp[:, 1].min()
    canonical = np.eye(4)
    canonical[:3, :3] = basis*scale
    canonical[:3, 3] = -centre*scale
    for d in parts:
        d['p'] = point_transform(d['p'], canonical)
    rest = canonical @ bind
    rest[0] = np.eye(4)
    for i in range(1, 41):
        rest[i, :3, 3] = warp(rest[i, :3, 3], maturity)
    for d in parts:
        d['p'] = warp(d['p'], maturity)
    body, garment, hair = parts
    garment_parts = [subset(garment, faces) for faces in components(garment['p'], garment['tri'])]
    garment_parts.sort(key=lambda d: d['p'][:, 1].mean(), reverse=True)
    upper, shorts, foot_a, foot_b = garment_parts
    upper['n'] = smooth_normals(upper['p'], upper['tri'])
    exposed_upper = None
    if female:
        centres = upper['p'][upper['tri']].mean(axis=1)
        covered = centres[:, 1] <= 1.34+.45*centres[:, 0]
        exposed_upper = subset(upper, upper['tri'][~covered])
        upper = subset(upper, upper['tri'][covered])
    feet = merge([foot_a, foot_b])
    # Undies are the only supplied surface under the torso/feet. Preserve them,
    # assign the feet skin, and cover the shorts with a separate modest wool wrap.
    hip = rest[1, :3, 3]
    waist = upper['p'][:, 1].min()+.035
    hem = warp(np.array([0, .43 if female else .60 if maturity < 1 else .56, 0]), maturity)[1]
    rx = max(.17, np.max(np.abs(shorts['p'][:, 0])))*1.055
    rz = max(.19*(.86+.14*maturity), np.max(np.abs(shorts['p'][:, 2]-hip[2])))*1.055
    p, j, w, uv, tri = [], [], [], [], []
    rings, segments = 7, 40
    for row in range(rings):
        t = row/(rings-1)
        for col in range(segments):
            angle = col/segments*2*math.pi
            pleat = .0035*math.cos(angle*16)
            p.append([(rx*(1+.20*t)+pleat)*math.sin(angle), waist+(hem-waist)*t,
                      hip[2]+(rz*(1+.30*t)+pleat)*math.cos(angle)])
            # Explicit native pelvis/thigh cloth weights, never old-skin neighbours.
            left = .65*t*(.5+.5*math.tanh(math.sin(angle)*5))
            right_weight = .65*t-left
            j.append([1, 27, 34, 2])
            w.append([.96-.65*t, left, right_weight, .04])
            uv.append([col/segments*2, t])
            if row < rings-1:
                a, b = row*segments+col, row*segments+(col+1) % segments
                tri.extend([[a, a+segments, b], [b, a+segments, b+segments]])
    wrap = {'p': np.array(p), 'j': np.array(j), 'w': np.array(w), 'uv': np.array(uv), 'tri': np.array(tri)}
    lower = merge([shorts, wrap])
    local = np.array([np.linalg.inv(rest[parents[i]]) @ rest[i] if i in parents else rest[i] for i in range(41)])
    decomposed = [decompose(m) for m in local]
    base_t, base_q, scales = map(np.array, zip(*decomposed))
    inverse_bind = np.linalg.inv(pose_world(base_t, base_q, scales, parents))
    times, translations, rotations, stride, excursion, grounds = planted_gait(
        base_t, base_q, scales, parents, rest, feet, inverse_bind)
    idle_t, idle_q = base_t.copy(), base_q.copy()
    relaxed_arms(idle_t, idle_q, scales, parents)
    idle_floor = skinned(feet, pose_world(idle_t, idle_q, scales, parents), inverse_bind)[:, 1].min()
    idle_t[0, 1] -= idle_floor
    writer = Writer()
    extras = {'rig': 'indigoat-41', 'age': 'adult' if maturity == 1 else variant,
              'sex': 'f' if female else 'm' if maturity == 1 else 'neutral',
              'strideMetres': round(stride, 6), 'semanticMap': {name: i for i, name in enumerate(NAMES)},
              'provenance': {**source['asset']['extras'], 'sha256': hashlib.sha256(source_raw).hexdigest()},
              'sourceBodyWeightsSha256': weights_hash, 'nativeSourceSkin': si,
              'sourceBodyVertices': len(body['p']), 'maturity': maturity,
              'geometry': 'Supplied native body and weights; rigid canonical bind-space transform. Age variants change surface/rest proportions together. Coincident normals are smoothed without changing adult shape.',
              'clothing': 'Native male/child upper surface reassigned skin; female native upper faces split into skin and diagonal one-shoulder cloth without deleting faces or changing weights. Separate lower wool wrap/dress covers original shorts; supplied footwear surface reassigned bare skin. Period-inspired interpretation.',
              'walk': {'method': 'New Babylon original planted-foot native gait, native limb lengths and sole frame; no old geometry, motion samples or skin weights.',
                       'duration': float(times[-1]), 'samples': len(times), 'stanceFraction': .6,
                       'footExcursionMetres': excursion.tolist(), 'strideMethod': 'Two cycles * rearward stance travel / 0.6 stance fraction, matching the linear planted-foot speed',
                       'soleRange': [min(grounds), max(grounds)]},
              'sourceGesture': {'name': 'Animation', 'duration': 6.3333333, 'runtimeIncluded': False,
                                'semantic': 'Inspected gesture/sway with root displacement; never treated as walking.'}}
    writer.g['asset'] = {'version': '2.0', 'generator': 'New Babylon prepare_native_people.py', 'extras': {'native_resident': extras}}
    writer.g['nodes'].append({'name': 'NativeResident', 'children': [1], 'extras': {'native_resident': copy.deepcopy(extras)}})
    for i, name in enumerate(NAMES):
        children = [child+1 for child, parent in parents.items() if parent == i]
        node = {'name': name, 'translation': base_t[i].tolist(), 'rotation': base_q[i].tolist(), 'scale': scales[i].tolist()}
        if children:
            node['children'] = children
        writer.g['nodes'].append(node)
    writer.g['skins'] = [{'name': 'NativeIndigoat41', 'joints': list(range(1, 42)), 'skeleton': 1,
                          'inverseBindMatrices': writer.accessor(inverse_bind.transpose(0, 2, 1).reshape(-1, 16), 'MAT4')}]
    writer.g['materials'] = [{'name': 'Native warm skin', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [.402, .258, .202, 1], 'metallicFactor': 0, 'roughnessFactor': .91}},
                             {'name': 'Undyed native wool cloth', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [.64, .55, .39, 1], 'metallicFactor': 0, 'roughnessFactor': .97}},
                             {'name': 'Native dark hair', 'doubleSided': True, 'pbrMetallicRoughness': {'baseColorFactor': [.045, .025, .016, 1], 'metallicFactor': 0, 'roughnessFactor': .92}}]
    mesh_specs = [('Native civilian skin', body, 0), ('Native bare feet', feet, 0),
                  ('Native upper cloth', upper, 1 if female else 0)]
    if exposed_upper is not None:
        mesh_specs.append(('Native upper skin', exposed_upper, 0))
    mesh_specs += [('Native woven wool dress' if female else 'Native woven wool wrap', lower, 1),
                   ('Fitted native scalp hair', hair, 2)]
    for name, data, material in mesh_specs:
        writer.mesh(name, data, material)
    writer.clip('Walk_Loop', times, translations, rotations, scales)
    writer.clip('Idle_Loop', np.array([0., 3.]), np.array([idle_t, idle_t]), np.array([idle_q, idle_q]), scales)
    path = out_dir/f'human-native-{variant}.glb'
    size = writer.save(path)
    return {'file': str(path), 'bytes': size, 'triangles': sum(len(data['tri']) for _, data, _ in mesh_specs),
            'native_resident': extras}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', type=Path, default=Path('/Users/back/Downloads/animated_low_poly_human_base_..glb'))
    parser.add_argument('--out-dir', type=Path, default=ROOT/'assets/art-courtyard/models')
    args = parser.parse_args()
    source, binary, raw = load(args.source)
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA, 'Unexpected supplied source: inspect provenance before adapting'
    assert len(source['skins']) == 2 and all(len(s['joints']) == 41 for s in source['skins'])
    args.out_dir.mkdir(parents=True, exist_ok=True)
    reports = [build(source, binary, raw, v, args.out_dir) for v in ['male', 'female', 'child', 'adolescent']]
    print(json.dumps(reports, indent=2))


if __name__ == '__main__':
    main()
