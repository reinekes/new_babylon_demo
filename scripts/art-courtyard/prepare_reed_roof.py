"""Extract the thatch photography from Nucity's Primitive Hut 1A Barn (CC BY 4.0).

Usage: python3 scripts/art-courtyard/prepare_reed_roof.py path/to/source.glb
Requires Pillow. The author's model is not modified.
"""
import io
from pathlib import Path
import json
import struct
import sys
from PIL import Image, ImageDraw

data = Path(sys.argv[1]).read_bytes()
magic, version, size, json_length, _ = struct.unpack_from('<4s4I', data)
assert (magic, version, size) == (b'glTF', 2, len(data))
gltf = json.loads(data[20:20 + json_length])
view = gltf['bufferViews'][gltf['images'][0]['bufferView']]
offset = 28 + json_length + view.get('byteOffset', 0)
atlas = Image.open(io.BytesIO(data[offset:offset + view['byteLength']])).convert('RGBA')
assert atlas.size == (512, 512)
destination = Path(__file__).resolve().parents[2] / 'assets/3d/textures'
# Preserve the cut-out stem silhouette at the top of the lower chart. Pad
# hidden white pixels with straw RGB to avoid pale fringes in generated mipmaps.
roof = atlas.crop((0, 256, 512, 512))
pixels = roof.tobytes()
roof.putdata([(r, g, b, a) if a else (147, 126, 91, 0)
              for r, g, b, a in zip(pixels[::4], pixels[1::4], pixels[2::4], pixels[3::4])])
roof.save(destination / 'reed-roof.webp', quality=86, method=6)

# Tightly laid reeds for the mats and screens: use the opaque stalk bodies,
# rotating the strip so its strands follow the existing u/v chart.
woven = atlas.crop((28, 285, 490, 330)).convert('RGB').transpose(Image.Transpose.ROTATE_90)
woven = woven.resize((64, 256), Image.Resampling.LANCZOS)
mat = Image.new('RGB', (256, 256))
for i in range(4):
    mat.paste(woven if i % 2 == 0 else woven.transpose(Image.Transpose.FLIP_LEFT_RIGHT), (i * 64, 0))
weave = ImageDraw.Draw(mat, 'RGBA')
for y in range(7, 256, 16):
    weave.line((0, y, 256, y), fill=(85, 57, 34, 95), width=2)
    weave.line((0, y + 2, 256, y + 2), fill=(223, 190, 129, 64), width=1)
mat.save(destination / 'woven-reed.webp', quality=83, method=6)
