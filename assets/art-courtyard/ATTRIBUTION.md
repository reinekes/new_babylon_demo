# Courtyard art assets and sources

This is a separate art trial, not a completed replacement of New Babylon graphics. No Banished assets are used. Author images and preview renders are not included in runtime.

## Resident — CC0 1.0

MakeHuman/MPFB anatomical body and rig, distributed by Innerscene: [53-bone human base](https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1). Walk source: [Sam brisk walk](https://www.innerscene.com/tools/library/3d-parts/brisk-walk-sam-3d-person-animated-bed03fa4). Publisher declares original authored periodic motion, not third-party motion capture. Both explicitly released CC0. [CC0 legal terms](https://creativecommons.org/publicdomain/zero/1.0/).

New Babylon adaptations: body reduction, warm skin/dark eyes, scalp and beard surface meshes, weighted wrap skirt and asymmetrical shoulder cloth with short fringe, rest-corrected walk retargeting and sole grounding; original breathing idle; independent remeshed crowd LOD with transferred skin weights. Edited models remain CC0. Runtime resident.glb and resident-lod.glb; editable .blend and scripts in [resident-source.zip](sources/resident-source.zip). The human styling and clothing are artistic approximations, not a portrait or a specific archaeological reconstruction. Base/extracted source models are not shown unclothed in the trial.

## Sheep — CC BY-SA 3.0

**Sheep (rigged, textured and animated), p0ss (2011)**, [original publication and file](https://opengameart.org/content/sheep-rigged-textured-and-animated). Texture basis: boar-TT7020726 by **titus tscharntke**, through the [Woodland Animals Texture Pack](https://opengameart.org/content/woodland-animals-texture-pack). Licensed [Creative Commons Attribution-ShareAlike 3.0 Unported](https://creativecommons.org/licenses/by-sa/3.0/), [legal code](https://creativecommons.org/licenses/by-sa/3.0/legalcode).

New Babylon adaptations: selected medium-wool Sheep2, legacy material replaced with Principled + original packed texture, corrected armature relationship and export action slots, adjusted scale/origin, smooth shading, renamed/exported seven original authored clips into self-contained glTF. The adapted sheep.glb and all sheep-specific source assets are distributed under the SAME CC BY-SA 3.0 license. Source file, adapted .blend, texture, conversion script and full attribution: [sheep-source.zip](sources/sheep-source.zip). The code of the game is separate from this asset license. No exact ancient breed is claimed.

## Date palm — CC0 1.0

[Mature date palm, Innerscene](https://www.innerscene.com/tools/library/3d-parts/mature-date-palm-tree-af8bdc6f), publisher original CC0 model. [Palm Bark, Poly Haven](https://polyhaven.com/a/palm_bark), CC0 photographs, downloaded via official API, MD5 checked. [Poly Haven license](https://polyhaven.com/license).

New Babylon adaptations: removed 35 regular decorative rings, merged by four materials, retained fronds/dates/trunk, added 1K bark color/OpenGL normal/roughness, retiled UVs. Runtime date-palm.glb, editable sources/palm-adapted.blend, script scripts/art-courtyard/prepare_palm.py. Adapted model remains CC0.

## Lighting and architecture

[Kiara 1 Dawn HDRI — Greg Zaal, Poly Haven](https://polyhaven.com/a/kiara_1_dawn), CC0; 1K HDR, MD5 verified. Used for lighting/reflections only, not presented as a Mesopotamian landscape photograph.

Adobe courtyard, sagging reed/woven shade, pottery, timber props and outdoor dressing authored for this project. Four existing CC0 photo materials reused; their sources are recorded in ../3d/ATTRIBUTION.md. Architecture source: sources/courtyard.blend and scripts/art-courtyard/prepare_courtyard.py. This architecture is an editable study made in Blender, not an excavated-house reconstruction.

Historical basis: [Penn Museum — Adaptation and Change](https://www.penn.museum/sites/expedition/adaptation-and-change/), [Met Sumerian fringed skirt](https://www.metmuseum.org/art/collection/search/325456). Sun-dried mudbrick, date palms and sheep are appropriate; garments, house layout and exact plant placement remain artistic choices.

## Runtime tools

Babylon.js9.31.0 and babylonjs-loaders9.31.0 from official npm, Apache2.0; vendor license in ../vendor/BABYLON-LICENSE.txt. Blender4.5.3 Python official PyPI bpy used only as an isolated conversion tool; it is not downloaded or run by the website. All shipped runtime assets are local; no external requests are needed.
