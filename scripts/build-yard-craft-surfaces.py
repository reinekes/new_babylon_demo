"""Bake the padded six-surface atlas used by the city's hand-built craft meshes."""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

TARGET = Path(__file__).resolve().parents[1] / "assets/3d/textures/courtyard"
W, H = 512, 256
Y, X = np.mgrid[:H, :W]
rng = np.random.default_rng(11729)


def clouds(nx, ny):
    grid = rng.integers(0, 255, (ny, nx), dtype=np.uint8)
    tile = Image.fromarray(np.tile(grid, (3, 3))).resize((W * 3, H * 3), Image.Resampling.BICUBIC)
    return np.asarray(tile, dtype=float)[H:2*H, W:2*W] / 128 - 1


def surface(kind, tint):
    broad = clouds(6, 4)
    medium = clouds(26, 14)
    grit = rng.normal(0, 1, (H, W))
    shade = broad * 9 + medium * 4 + grit * 2.0
    relief = medium * .8 + grit * .55
    if kind in ('buff', 'red', 'storage'):
        rings = np.cos((Y + .65 * np.sin(2 * np.pi * X/W) + .4 * medium) * .72)
        scorch = np.maximum(0, broad - .10) ** 1.3 * (24 if kind == 'red' else 15)
        shade += 2.7 * rings - scorch
        relief += 1.0 * rings
    elif kind in ('adobe', 'fired'):
        straw = Image.new('L', (W, H), 128)
        draw = ImageDraw.Draw(straw)
        for i in range(820 if kind == 'adobe' else 350):
            x, y = rng.uniform(0, W), rng.uniform(0, H)
            angle, length = rng.uniform(-np.pi, np.pi), rng.uniform(1, 10)
            end = (x + np.cos(angle) * length, y + np.sin(angle) * length)
            value = int(rng.choice([71, 100, 148, 167, 178]))
            draw.line((x, y, *end), fill=value, width=1)
        inclusions = np.asarray(straw, dtype=float) - 128
        shade += inclusions * .50 + 3 * grit
        relief += inclusions * .18 + 2 * medium
    else:
        crystals = clouds(160, 74)
        shade += crystals * 10 + grit * 5
        relief += crystals * 3
    rgb = np.clip(tint + shade[:, :, None] * [1.04, .94, .78], 0, 255).astype(np.uint8)
    dv, du = np.gradient(relief)
    normal = np.stack([-du * .22, dv * .22, np.ones_like(du)], axis=-1)
    normal /= np.linalg.norm(normal, axis=-1, keepdims=True)
    return Image.fromarray(rgb), Image.fromarray(np.uint8(127.5 * (1 + normal)))


def bake():
    color = Image.new('RGB', (1024, 1024))
    detail = Image.new('RGB', (1024, 1024), (128, 128, 255))
    samples = [('buff', [193, 156, 114]), ('red', [158, 93, 61]),
               ('adobe', [169, 141, 100]), ('fired', [158, 103, 72]),
               ('stone', [118, 115, 102]), ('storage', [166, 129, 91])]
    for i, (kind, tint) in enumerate(samples):
        diffuse, normals = surface(kind, tint)
        offset = ((i % 2) * W, (i // 2) * H)
        color.paste(diffuse, offset)
        detail.paste(normals, offset)
    # Replicate the last row for the coarsest mip levels.
    for atlas in (color, detail):
        atlas.paste(atlas.crop((0, 512, 1024, 768)), (0, 768))
    color.save(TARGET / 'yard-craft-color.jpg', quality=88, optimize=True, subsampling=0)
    detail.save(TARGET / 'yard-craft-normal.jpg', quality=83, optimize=True, subsampling=0)


if __name__ == '__main__':
    bake()
