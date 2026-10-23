"""Regression checks for texture-only GLB rewriting; run with bundled Python."""
import importlib.util
import io
from pathlib import Path
import random
import struct
import sys
import unittest
from PIL import Image

sys.dont_write_bytecode = True

spec = importlib.util.spec_from_file_location('texture_optimizer', Path(__file__).with_name('optimize_runtime_textures.py'))
optimizer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(optimizer)


def png(mode, size, seed):
    rng = random.Random(seed)
    source = Image.frombytes(mode, size, rng.randbytes(size[0] * size[1] * len(mode)))
    output = io.BytesIO(); source.save(output, format='PNG')
    return output.getvalue()


def fixture():
    binary = [struct.pack('<fff', 1.25, 2.5, -3.75), png('RGB', (256, 256), 7),
              png('RGB', (128, 128), 11), png('RGBA', (128, 128), 19)]
    document = {
        'asset': {'version': '2.0', 'extras': {'author': 'Original author', 'license': 'CC BY 4.0'}},
        'buffers': [{'byteLength': 0}],
        'bufferViews': [{'buffer': 0, 'byteLength': len(data)} for data in binary],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': 1, 'type': 'VEC3'}],
        'images': [{'bufferView': i, 'mimeType': 'image/png'} for i in [1, 2, 3]],
        'textures': [{'source': i} for i in range(3)],
        'materials': [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}},
                       'normalTexture': {'index': 1}},
                      {'alphaMode': 'BLEND', 'pbrMetallicRoughness': {'baseColorTexture': {'index': 2}}}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'material': 0}]}],
        'nodes': [{'mesh': 0, 'skin': 0}], 'skins': [{'joints': [0]}],
        'animations': [{'name': 'Original', 'channels': [], 'samplers': []}],
    }
    return optimizer.write_glb(document, binary)


class TextureOnlyOptimization(unittest.TestCase):
    def test_colour_compression_preserves_geometry_normal_alpha_and_credits(self):
        source = fixture()
        optimized, report = optimizer.optimize(source)
        before, old_views = optimizer.read_glb(source)
        after, new_views = optimizer.read_glb(optimized)
        self.assertLess(len(optimized), len(source))
        self.assertEqual(after['images'][0]['mimeType'], 'image/jpeg')
        self.assertEqual(old_views[0], new_views[0])
        self.assertEqual(old_views[2], new_views[2])
        self.assertEqual(before['asset'], after['asset'])
        self.assertEqual(before['skins'], after['skins'])
        self.assertEqual(before['animations'], after['animations'])
        for index in (3,):
            self.assertEqual(Image.open(io.BytesIO(old_views[index])).tobytes(),
                             Image.open(io.BytesIO(new_views[index])).tobytes())
        self.assertEqual(report['non_image_views_binary_identical'], 1)

    def test_second_run_does_not_recompress_jpeg_or_grow_asset(self):
        optimized, _ = optimizer.optimize(fixture())
        repeated, _ = optimizer.optimize(optimized)
        self.assertEqual(optimized, repeated)

    def test_explicit_alpha_resize_keeps_rgba_not_jpeg(self):
        optimized, report = optimizer.optimize(fixture(), max_size=128, alpha_size=64)
        self.assertEqual(report['images'][0]['after_size'], [128, 128])
        self.assertEqual(report['images'][1]['after_size'], [128, 128])
        self.assertEqual(report['images'][2]['after_size'], [64, 64])
        self.assertEqual(report['images'][2]['format'], 'PNG')
        self.assertEqual(report['images'][2]['mode'], 'RGBA')
        self.assertTrue(report['images'][2]['alpha_preserved'])


if __name__ == '__main__':
    unittest.main()
