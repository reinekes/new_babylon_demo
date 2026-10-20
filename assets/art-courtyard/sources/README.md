# Editable art trial sources

- resident-source.zip: anatomical resident and crowd LOD, Blender sources and conversion scripts. CC0. After exporting the one-mesh LOD, run `python3 scripts/art-courtyard/prune_animation.py assets/art-courtyard/models/resident-lod.glb` to bake tracks constant and identical across both clips into node defaults. Unused binary sampler data is deliberately retained.
- sheep-source.zip: original and adapted Blender files, original packed texture, scripts and full attribution. CC BY-SA 3.0; adapted sheep retains this license.
- palm-adapted.blend: packed editable palm, CC0.
- courtyard.blend: packed editable architectural study, authored for New Babylon.

Conversion used the official Blender 4.5.3 Python package in an isolated temporary environment. Scripts under scripts/art-courtyard record the adaptation; some asset-selection scripts refer to the temporary work paths used during preparation. Open the packed Blender files to edit without those paths. Author URLs, license links and modifications are in ../ATTRIBUTION.md. Runtime has no Blender dependency.
