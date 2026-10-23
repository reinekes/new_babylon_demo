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


## Goats — original project model and GerardoA400 / CC BY 4.0

**Original New Babylon goat:** `models/goat-authored.glb` and its city LOD `models/goat-authored-lod.glb`; reproducible source `scripts/art-courtyard/create_goat.py` in the repository. Original project geometry, skeleton, color and Idle/Walk/Graze/Rest motions; no purchased or downloaded goat geometry used in this variant.

**Goat by GerardoA400:** [model](https://sketchfab.com/3d-models/goat-5d7431517b634f4e9e8c0f3729cd9c59), [author](https://sketchfab.com/GerardoA400), licensed [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/). Downloaded original is retained as `models/goat.glb`; city adaptation is `models/goat-downloaded.glb`. Attribution/source/license are also preserved inside the GLB.

New Babylon changes to the downloaded model: added a metre-scale/grounded wrapper, reduced embedded textures to at most1024pixels; geometry, original materials, weights and skin bind matrices retained. Original `rigAction` retained verbatim as `SourceRigAction` and `Idle`. The source clip is stationary head/look-around motion, NOT a verified walking clip. `Walk`, `Graze` and `Rest` are new project-added skeletal motions; Walk includes per-frame ground correction and an estimated0.39m cycle. Downloaded Rest is a standing drowse, while the project model folds its legs. Reproduction: `scripts/art-courtyard/prepare_downloaded_goat.py`. No exact ancient goat breed is claimed.


## Imported city fauna and adapted civilians · 2026-10-22

- `models/cat-walk.glb`: **Cat Walk** — LostBoyz2078 (https://sketchfab.com/LostModels2025); source https://sketchfab.com/3d-models/cat-walk-915680200c064815bba75e008ba9efb5; license CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). 4575 triangles, 667472 bytes.
- `models/cat-sitting.glb`: **An Animated Cat** — Evil_Katz (https://sketchfab.com/Evil_Katz); source https://sketchfab.com/3d-models/an-animated-cat-aec25699660043a29595f9572149d1e8; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). 7372 triangles, 3289240 bytes.
- `models/gazelle-downloaded.glb`: **Gazella** — kenchoo (https://sketchfab.com/kenchoo); source https://sketchfab.com/3d-models/gazella-b2c70a0821ef4c6ca0c096e33bc97593; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). 8652 triangles, 3731492 bytes.
- `models/imported-orange-bird.glb`: **Bird Orange** — Wen Yeh (https://sketchfab.com/wenyeh1110); source https://sketchfab.com/3d-models/bird-orange-0d31748606c2499fb652c0c1052b7cfa; license CC-BY-NC-SA-4.0 (http://creativecommons.org/licenses/by-nc-sa/4.0/). 5062 triangles, 570772 bytes.
- `models/imported-sky-birds.glb`: **Birds** — Zacxophone (https://sketchfab.com/Zacxophone); source https://sketchfab.com/3d-models/birds-3a9bb97be78944f9bffc23fb25c2154e; license SKETCHFAB Standard (https://sketchfab.com/licenses). 810 triangles, 195568 bytes.
- `models/imported-goose.glb`: **ULTIMATE ANIMAL PACK |100 ANIMALS | 50% OFF** — WildMesh 3D (https://sketchfab.com/WildMesh_3D); source https://sketchfab.com/3d-models/ultimate-animal-pack-100-animals-50-off-c7be3f41fb3a4ed6be31d0bcd86a4684; license CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). 10336 triangles, 770224 bytes.
- `models/imported-fox.glb`: **ULTIMATE ANIMAL PACK |100 ANIMALS | 50% OFF** — WildMesh 3D (https://sketchfab.com/WildMesh_3D); source https://sketchfab.com/3d-models/ultimate-animal-pack-100-animals-50-off-c7be3f41fb3a4ed6be31d0bcd86a4684; license CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). 14192 triangles, 814576 bytes.
- `models/imported-boar.glb`: **ULTIMATE ANIMAL PACK |100 ANIMALS | 50% OFF** — WildMesh 3D (https://sketchfab.com/WildMesh_3D); source https://sketchfab.com/3d-models/ultimate-animal-pack-100-animals-50-off-c7be3f41fb3a4ed6be31d0bcd86a4684; license CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). 13484 triangles, 907576 bytes.
- `models/imported-lioness.glb`: **ULTIMATE ANIMAL PACK |100 ANIMALS | 50% OFF** — WildMesh 3D (https://sketchfab.com/WildMesh_3D); source https://sketchfab.com/3d-models/ultimate-animal-pack-100-animals-50-off-c7be3f41fb3a4ed6be31d0bcd86a4684; license CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/). 16474 triangles, 1009076 bytes.
- `models/sumer-people.glb`: **Egyptian People** — Trident.AI (https://sketchfab.com/Trident.AI); source https://sketchfab.com/3d-models/egyptian-people-b24eba1c3d56439a9dda74fc84065c37; license SKETCHFAB Standard (https://sketchfab.com/licenses). 16124 triangles, 2356068 bytes.

Adaptations: scripts/art-courtyard/prepare_city_fauna.py, prepare_birds_pack.py, prepare_sumer_people.py. Supplied originals in Downloads remain unchanged. Cats receive matched charcoal coats, grounding and canonical clips; two unrelated rigs switch by visibility fade. Gazelle source look-around preserved; walking newly authored. Pack goose/fox/boar/lioness are extracted static meshes with breathing only. Orange bird is a stylized character with its original clip, not an identified ancient species; derivative remains CC BY-NC-SA4.0. Civilian uses Trident.AI body/face surface, existing CC0 resident rig/actions and project-authored undyed wool wrap replacing Egyptian collar/kilt motifs. No exact ancient breed, face reconstruction or photorealism is claimed.

NC licenses remain attached for this noncommercial demo. Birds and Egyptian People retain embedded Standard metadata. Separately, on2026-10-22 user confirmed author permission: “разрешение есть - добавим его когда будем заканчивать игру”. No conversion into CC is asserted; document will be added at project finalization per user. See docs/ANIMAL_PACK_SELECTION_2026-10-22.md and docs/SUMER_PEOPLE_ASSET_NOTES_2026-10-22.md.


## Living valley vegetation · 2026-10-22

- `models/valley-barley.glb` — ljungman (https://sketchfab.com/ljungman); source https://sketchfab.com/3d-models/wheat-1e4643b88a1f4683a9765287ff2871cb; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-date-palm.glb` — evolveduk (https://sketchfab.com/evolveduk); source https://sketchfab.com/3d-models/date-palm-11acf710e6c149daa8d6fb8cdc5d087f; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-dry-grass-1.glb` — Pixel-bit (https://sketchfab.com/Pixel-bit); source https://sketchfab.com/3d-models/dry-grass-d1484537470441b999d37077aeb9b47a; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-dry-grass-2.glb` — Pixel-bit (https://sketchfab.com/Pixel-bit); source https://sketchfab.com/3d-models/dry-grass-d1484537470441b999d37077aeb9b47a; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-dry-grass-3.glb` — Pixel-bit (https://sketchfab.com/Pixel-bit); source https://sketchfab.com/3d-models/dry-grass-d1484537470441b999d37077aeb9b47a; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-reed-1.glb` — Nicholas-3D (https://sketchfab.com/Nicholas01); source https://sketchfab.com/3d-models/reed-plants-pack-bc77ea5218e44f2dbc23b2a4aef0c898; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-reed-2.glb` — Nicholas-3D (https://sketchfab.com/Nicholas01); source https://sketchfab.com/3d-models/reed-plants-pack-bc77ea5218e44f2dbc23b2a4aef0c898; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).
- `models/valley-reed-3.glb` — Nicholas-3D (https://sketchfab.com/Nicholas01); source https://sketchfab.com/3d-models/reed-plants-pack-bc77ea5218e44f2dbc23b2a4aef0c898; license CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/).

Adaptations by New Babylon: scripts/art-courtyard/prepare_valley_plants.py. Grounded metre-scale, scene transforms baked, complete complementary palm/reed parts selected, embedded textures <=512px, alpha cutouts retained. Barley card geometry/UV derive from Wheat by ljungman, with newly authored long-awn barley albedo, flat normal and roughness maps. No new crop production rules. Original downloads unchanged. Desert Shrubs (American desert species), unknown decorative palms and Standard grass were not used. See docs/VALLEY_PLANTS_ASSETS_2026-10-22.md and docs/LIVING_VALLEY_REPORT_2026-10-22.md.

## 2026-10-23 · движущаяся фауна и цветение

| Файл | Автор | Источник | Лицензия | Изменения |
|---|---|---|---|---|
| `ambient-bull.glb` | Kapi777 (https://sketchfab.com/Kapi777) | https://sketchfab.com/3d-models/bullmotions-50982988cd354bfcb79f9820ba60a27b | CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/) | Масштаб/текстуры; Walk и Idle добавлены для dog/duck/sheep, авторские для donkey/bull; исходные клипы сохранены. |
| `ambient-dog.glb` | MAXDESIGN-3D (https://sketchfab.com/MAXDESIGN) | https://sketchfab.com/3d-models/dog-animated-21b7336c58a442578ab88fc47233ef11 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Масштаб/текстуры; Walk и Idle добавлены для dog/duck/sheep, авторские для donkey/bull; исходные клипы сохранены. |
| `ambient-donkey.glb` | AnimalMesh 3D (https://sketchfab.com/AnimalMesh3D) | https://sketchfab.com/3d-models/animated-realistic-donkey-3d-animal-model-32ce1c2f276a4e27bb26b8bb99439bb7 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Масштаб/текстуры; Walk и Idle добавлены для dog/duck/sheep, авторские для donkey/bull; исходные клипы сохранены. |
| `ambient-duck.glb` | icekic (https://sketchfab.com/icekic) | https://sketchfab.com/3d-models/duck-animation-4a95a539dab94eaf9314a93ddb743f4e | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Масштаб/текстуры; Walk и Idle добавлены для dog/duck/sheep, авторские для donkey/bull; исходные клипы сохранены. |
| `ambient-sheep-kenchoo.glb` | kenchoo (https://sketchfab.com/kenchoo) | https://sketchfab.com/3d-models/sheep-08b05ae799d947f1a68c49b2d661eb53 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Масштаб/текстуры; Walk и Idle добавлены для dog/duck/sheep, авторские для donkey/bull; исходные клипы сохранены. |
| `crop-emmer.glb` | ebmclachlan (https://sketchfab.com/ebmclachlan) | https://sketchfab.com/3d-models/yard-wheat-clump-b8bdffd307a64833b2acc986a87f3977 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-birch-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/five-birch-trees-pack-lowpoly-lods-08fe5117138e4fdaa7ca440ef1201e07 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-cactus-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/cactus-pack-18-var-game-ready-lod-realistic-297e91de8db54640aaa9489f982b088e | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-cactus-2.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/cactus-pack-18-var-game-ready-lod-realistic-297e91de8db54640aaa9489f982b088e | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-daisy-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/daisy-models-pack-realistic-optimized-0748471f99f2416a8b66b522c293720f | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-daisy-2.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/daisy-models-pack-realistic-optimized-0748471f99f2416a8b66b522c293720f | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-green-grass-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/grass-pack-of-9-vars-lowpoly-game-ready-0561204a1fa14c17939300ee1108948b | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-green-grass-2.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/grass-pack-of-9-vars-lowpoly-game-ready-0561204a1fa14c17939300ee1108948b | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-green-grass-3.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/grass-pack-of-9-vars-lowpoly-game-ready-0561204a1fa14c17939300ee1108948b | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-lilac-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/lilac-bush-pack-12-vars-lods-game-ready-10312697ec994fc99355cb94f1963a2e | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-lilac-2.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/lilac-bush-pack-12-vars-lods-game-ready-10312697ec994fc99355cb94f1963a2e | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-snowdrop-1.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/snowdrop-pack-lowpoly-gameready-lod-14890248c9374b569a7bc0d497ccdbe0 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |
| `miracle-snowdrop-2.glb` | LOLIPOP (https://sketchfab.com/lolipop_1707) | https://sketchfab.com/3d-models/snowdrop-pack-lowpoly-gameready-lod-14890248c9374b569a7bc0d497ccdbe0 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованы масштаб/начало; текстуры до 512; выбран полный LOD. |

Четырём прежним imported-goose/fox/boar/lioness добавлены оригинальные morph-походки; автор/CC BY-NC 4.0 сохранены. Лён/бобовые/лук/финиковые грозди — оригинальная геометрия проекта. Полный реестр: docs/MODEL_INVENTORY_2026-10-23.md.

## 2026-10-23 · поселение, дети и исправленный полёт

| Модель | Автор/источник/лицензия | Изменения |
|---|---|---|
| `sumer-people.glb` | Trident.AI · https://sketchfab.com/3d-models/egyptian-people-b24eba1c3d56439a9dda74fc84065c37 · SKETCHFAB Standard (отдельное разрешение подтверждено пользователем) | Цельная новая геометрия волос, правильные локальные оси рук; дети/подростки: изменены вершины, суставы, bind-матрицы и клипы, а не только масштаб. |
| `sumer-child.glb` | Trident.AI · https://sketchfab.com/3d-models/egyptian-people-b24eba1c3d56439a9dda74fc84065c37 · SKETCHFAB Standard (отдельное разрешение подтверждено пользователем) | Цельная новая геометрия волос, правильные локальные оси рук; дети/подростки: изменены вершины, суставы, bind-матрицы и клипы, а не только масштаб. |
| `sumer-adolescent.glb` | Trident.AI · https://sketchfab.com/3d-models/egyptian-people-b24eba1c3d56439a9dda74fc84065c37 · SKETCHFAB Standard (отдельное разрешение подтверждено пользователем) | Цельная новая геометрия волос, правильные локальные оси рук; дети/подростки: изменены вершины, суставы, bind-матрицы и клипы, а не только масштаб. |
| `sky-bird-single.glb` | Zacxophone (https://sketchfab.com/Zacxophone) · https://sketchfab.com/3d-models/birds-3a9bb97be78944f9bffc23fb25c2154e · SKETCHFAB Standard (https://sketchfab.com/licenses) | Выделена одна птица, сохранены шесть авторских каналов крыльев; убран перенос тела, нормализован настоящий перед модели; полёт по касательной. |

Улей и домаII/III, рабочие галереи/столы и точки взаимодействия — оригинальная процедурная геометрия Нового Вавилона. Дома-ульи на старте — игровое допущение, не точная реконструкция Шумера.

## 2026-10-23 · шакал и караван

| Модель | Автор | Источник | Лицензия | Адаптация |
|---|---|---|---|---|
| `jackal.glb` | OLEKSO (https://sketchfab.com/oleksabasarab) | https://sketchfab.com/3d-models/wolf-e319f122c2474d3186b841b019fb0edd | CC-BY-NC-4.0 (http://creativecommons.org/licenses/by-nc/4.0/) | Художественный шакал из Wolf; калибровка морды, поза уноса. Некоммерческий прототип. |
| `caravan-merchant.glb` | Dr Helmi Norman (https://sketchfab.com/helmi.norman) | https://sketchfab.com/3d-models/parameswara-chronicles-shaikh-abdul-aziz-ca665011d8a044edaa19d8c678436e7c | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Убраны поздние головной убор/силуэт, сглажен костюм, добавлена шерстяная обёртка и авторская походка на исходном скелете. |
| `caravan-camel.glb` | eb78 (https://sketchfab.com/E.A.Cornell) | https://sketchfab.com/3d-models/camel-99af7daa5baf450ea7b809937937e6d5 | CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/) | Нормализованный масштаб/направление/клипы, оптимизированные текстуры; авторская поклажа. |
