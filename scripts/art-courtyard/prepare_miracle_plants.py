"""Extract complete, single-LOD plants for the explicitly magical garden.
Run using NumPy/Pillow; source files and embedded source credits are untouched.
Generic green grass may also decorate moist banks; other plants are miracle-only.
"""
from pathlib import Path
import argparse,json
from prepare_valley_plants import extract
SPECS = [
 ('snowdrop_pack_lowpoly_gameready_lod','snowdrop-1',[30],.38,'miracle-only snowdrop group 1, complete LOD1'),
 ('snowdrop_pack_lowpoly_gameready_lod','snowdrop-2',[40],.42,'miracle-only snowdrop group 3, complete LOD1'),
 ('daisy_models_pack_realistic_optimized','daisy-1',[49],.52,'miracle-only daisy patch 1, complete LOD1'),
 ('daisy_models_pack_realistic_optimized','daisy-2',[63],.46,'miracle-only daisy patch 3, complete LOD1'),
 ('five_birch_trees_pack_lowpoly_lods','birch-1',[15,16],4.8,'miracle-only birch 2, complete bark plus foliage LOD2'),
 ('grass_pack_of_9_vars_lowpoly_game_ready','green-grass-1',[4],.38,'generic green grass, moist bank or miracle garden'),
 ('grass_pack_of_9_vars_lowpoly_game_ready','green-grass-2',[6],.33,'generic green grass, moist bank or miracle garden'),
 ('grass_pack_of_9_vars_lowpoly_game_ready','green-grass-3',[8],.44,'generic green grass, moist bank or miracle garden'),
 ('cactus_pack_18_var_game_ready_lod_realistic','cactus-1',[80],.82,'miracle-only single medium cactus 1, complete LOD1'),
 ('cactus_pack_18_var_game_ready_lod_realistic','cactus-2',[134],.54,'miracle-only single small cactus 2, complete LOD1'),
 ('lilac_bush_pack_12_vars_lods_game_ready','lilac-1',[128,129],.95,'miracle-only small lilac bush 2, bark plus branches LOD1'),
 ('lilac_bush_pack_12_vars_lods_game_ready','lilac-2',[140,141],1.15,'miracle-only small lilac bush 3, bark plus branches LOD1'),
]
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--downloads',type=Path,default=Path.home()/'Downloads');args=p.parse_args()
 for source,target,nodes,height,meaning in SPECS:
  r=extract(args.downloads/(source+'.glb'),'miracle-'+target,nodes,height,meaning,True)
  print(json.dumps({k:r[k] for k in ['file','bytes','triangles','source_node_indices','bounds_min','bounds_max']}))
