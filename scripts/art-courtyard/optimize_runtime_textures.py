"""Reduce embedded GLB texture transfers without changing model or animation data.

Requires Pillow (already bundled with the workspace Python). Originals/downloads
are never read implicitly. Dry-run by default; pass --apply for the named files.
RGB colour PNGs become JPEG quality 85; transparency stays PNG. Normal and other
non-colour maps retain their exact encoded bytes. Existing JPEGs are not recompressed.
All non-image buffer views, accessors, meshes, skins, animations, material settings,
and attribution metadata are verified before a smaller result can replace a file.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import io
import json
from pathlib import Path
import struct

from PIL import Image, ImageFile

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942
COLOUR_ROLES = {'baseColorTexture', 'diffuseTexture', 'emissiveTexture'}


def read_glb(raw):
    magic, version, size = struct.unpack_from('<III', raw)
    if magic != 0x46546C67 or version != 2 or size != len(raw):
        raise ValueError('Expected an intact GLB 2.0 file')
    chunks, offset = {}, 12
    while offset < len(raw):
        length, kind = struct.unpack_from('<II', raw, offset)
        offset += 8
        if kind in chunks or kind not in (JSON_CHUNK, BIN_CHUNK):
            raise ValueError('Unsupported or duplicate GLB chunk')
        chunks[kind] = raw[offset:offset + length]
        offset += length
    if offset != len(raw) or JSON_CHUNK not in chunks or BIN_CHUNK not in chunks:
        raise ValueError('Incomplete GLB chunks')
    document = json.loads(chunks[JSON_CHUNK])
    if len(document.get('buffers', [])) != 1 or document['buffers'][0].get('uri'):
        raise ValueError('Expected one embedded buffer')
    views = document.get('bufferViews', [])
    if any(v.get('buffer') != 0 for v in views):
        raise ValueError('Only embedded buffer 0 is supported')
    binary = chunks[BIN_CHUNK]
    data = []
    for view in views:
        start = view.get('byteOffset', 0)
        end = start + view['byteLength']
        if end > len(binary):
            raise ValueError('Buffer view extends outside the binary chunk')
        data.append(binary[start:end])
    return document, data


def write_glb(document, views):
    binary = bytearray()
    for view, payload in zip(document['bufferViews'], views):
        binary.extend(b'\0' * (-len(binary) % 4))
        view['byteOffset'] = len(binary)
        view['byteLength'] = len(payload)
        binary.extend(payload)
    document['buffers'][0]['byteLength'] = len(binary)
    binary.extend(b'\0' * (-len(binary) % 4))
    metadata = json.dumps(document, ensure_ascii=False, separators=(',', ':')).encode()
    metadata += b' ' * (-len(metadata) % 4)
    size = 28 + len(metadata) + len(binary)
    return (struct.pack('<III', 0x46546C67, 2, size)
            + struct.pack('<II', len(metadata), JSON_CHUNK) + metadata
            + struct.pack('<II', len(binary), BIN_CHUNK) + binary)


def image_roles(document):
    roles = {}
    textures = document.get('textures', [])

    def visit(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    texture = textures[child['index']]
                    source = texture.get('source')
                    if source is not None:
                        roles.setdefault(source, set()).add(key)
                visit(child)
        elif isinstance(value, list):
            for child in value:
                visit(child)

    visit(document.get('materials', []))
    return roles


def transparent(image):
    return 'A' in image.getbands() or 'transparency' in image.info


def optimize_image(payload, roles, max_size, alpha_size, quality):
    with Image.open(io.BytesIO(payload)) as source:
        source.load()
        # Tangent-space normals and packed material channels must stay lossless,
        # at their authored dimensions, and in their original colour channels.
        if not roles or not roles.issubset(COLOUR_ROLES):
            return payload, source.format, source.size, source.size
        has_alpha = transparent(source)
        limit = alpha_size if has_alpha else max_size
        target = source.copy()
        target.thumbnail((limit, limit), Image.Resampling.LANCZOS)
        if source.format == 'JPEG' and target.size == source.size:
            return payload, source.format, source.size, source.size
        output = io.BytesIO()
        fmt = 'PNG' if has_alpha else 'JPEG'
        if has_alpha:
            # Preserve exact pixels for same-size alpha maps; no palette/colour
            # conversions which could change a hair mask or low-opacity coat.
            target.save(output, format=fmt, optimize=True)
        else:
            # Pillow's optimized 4:4:4 encoder needs enough space for noisy atlases.
            ImageFile.MAXBLOCK = max(ImageFile.MAXBLOCK, target.width * target.height * 4)
            target.convert('RGB').save(output, format=fmt, quality=quality,
                                       subsampling=0, optimize=True)
        encoded = output.getvalue()
        if len(encoded) >= len(payload):
            return payload, source.format, source.size, source.size
        return encoded, fmt, source.size, target.size


def normalized_metadata(document):
    result = copy.deepcopy(document)
    for view in result['bufferViews']:
        view.pop('byteOffset', None)
        view.pop('byteLength', None)
    result['buffers'][0].pop('byteLength', None)
    for image in result.get('images', []):
        image.pop('mimeType', None)
    return result


def verify(original, optimized):
    before, before_views = read_glb(original)
    after, after_views = read_glb(optimized)
    if normalized_metadata(before) != normalized_metadata(after):
        raise AssertionError('Model, material or attribution metadata changed')
    image_views = {image['bufferView'] for image in before.get('images', []) if 'bufferView' in image}
    preserved = []
    for index, (left, right) in enumerate(zip(before_views, after_views)):
        if index not in image_views:
            if left != right:
                raise AssertionError(f'Non-image buffer view {index} changed')
            preserved.append(left)
    roles = image_roles(before)
    images = []
    for index, (left, right) in enumerate(zip(before.get('images', []), after.get('images', []))):
        if 'bufferView' not in left:
            continue
        source = before_views[left['bufferView']]
        target = after_views[right['bufferView']]
        with Image.open(io.BytesIO(source)) as a, Image.open(io.BytesIO(target)) as b:
            a.load(); b.load()
            if transparent(a):
                if b.format != 'PNG' or not transparent(b):
                    raise AssertionError('Transparency removed')
                expected = a.copy()
                expected.thumbnail(b.size, Image.Resampling.LANCZOS)
                if b.size != expected.size or b.convert('RGBA').tobytes() != expected.convert('RGBA').tobytes():
                    raise AssertionError('Alpha map changed outside the declared resize')
            if 'normalTexture' in roles.get(index, set()) and source != target:
                raise AssertionError('Encoded normal map changed')
            images.append({'index': index, 'roles': sorted(roles.get(index, [])),
                           'before_bytes': len(source), 'after_bytes': len(target),
                           'before_size': list(a.size), 'after_size': list(b.size),
                           'format': b.format, 'mode': b.mode,
                           'alpha_preserved': transparent(a)})
    return {'non_image_views_binary_identical': len(preserved),
            'non_image_sha256': hashlib.sha256(b''.join(preserved)).hexdigest(),
            'skins_unchanged': len(after.get('skins', [])),
            'animations_unchanged': len(after.get('animations', [])),
            'meshes_unchanged': len(after.get('meshes', [])), 'images': images}


def optimize(raw, max_size=1024, alpha_size=1024, quality=85):
    document, payloads = read_glb(raw)
    original_document = copy.deepcopy(document)
    roles = image_roles(document)
    accessor_views = {a['bufferView'] for a in document.get('accessors', []) if 'bufferView' in a}
    changed = False
    for index, image in enumerate(document.get('images', [])):
        if 'bufferView' not in image:
            continue
        view_index = image['bufferView']
        if view_index in accessor_views:
            raise ValueError('Image buffer view is also used by an accessor')
        encoded, fmt, _, _ = optimize_image(payloads[view_index], roles.get(index, set()),
                                             max_size, alpha_size, quality)
        if encoded != payloads[view_index]:
            changed = True
            payloads[view_index] = encoded
            image['mimeType'] = 'image/png' if fmt == 'PNG' else 'image/jpeg'
    # Do not rewrite an already optimized asset just for JSON whitespace/offsets.
    candidate = write_glb(document, payloads) if changed else raw
    if len(candidate) >= len(raw):
        candidate = raw
    verification = verify(raw, candidate)
    assert original_document['asset'] == read_glb(candidate)[0]['asset']
    return candidate, verification


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('files', nargs='+', type=Path)
    parser.add_argument('--apply', action='store_true', help='Replace named files only if smaller')
    parser.add_argument('--max-size', type=int, default=1024, help='Maximum RGB colour texture side')
    parser.add_argument('--alpha-size', type=int, default=1024, help='Maximum alpha texture side; keep 1024 unless visually verified')
    parser.add_argument('--quality', type=int, default=85)
    args = parser.parse_args()
    if min(args.max_size, args.alpha_size) < 1 or not 1 <= args.quality <= 100:
        parser.error('Invalid image size or JPEG quality')
    for path in args.files:
        original = path.read_bytes()
        optimized, verification = optimize(original, args.max_size, args.alpha_size, args.quality)
        if args.apply and optimized != original:
            path.write_bytes(optimized)
        print(json.dumps({'file': str(path), 'applied': args.apply and optimized != original,
                          'before_bytes': len(original), 'after_bytes': len(optimized),
                          'saved_bytes': len(original) - len(optimized),
                          'before_sha256': hashlib.sha256(original).hexdigest(),
                          'after_sha256': hashlib.sha256(optimized).hexdigest(),
                          **verification}, ensure_ascii=False))


if __name__ == '__main__':
    main()
