"""Bake only tracks constant and identical in every clip into glTF node defaults."""
import json,struct,sys
from pathlib import Path
p=Path(sys.argv[1]);data=p.read_bytes();n=struct.unpack_from('<I',data,12)[0];g=json.loads(data[20:20+n]);tail=data[20+n:];binary=tail[8:];tracks={}
for ai,anim in enumerate(g.get('animations',[])):
 for ci,ch in enumerate(anim['channels']):
  a=g['accessors'][anim['samplers'][ch['sampler']]['output']];v=g['bufferViews'][a['bufferView']];size={'VEC3':3,'VEC4':4}[a['type']];stride=v.get('byteStride',size*4);off=v.get('byteOffset',0)+a.get('byteOffset',0);rows=[struct.unpack_from('<'+'f'*size,binary,off+i*stride) for i in range(a['count'])]
  constant=all(max(abs(x-y) for x,y in zip(row,rows[0]))<1e-7 for row in rows)
  tracks.setdefault((ch['target']['node'],ch['target']['path']),[]).append((ai,ci,rows[0] if constant else None))
remove=set()
for (node,path),items in tracks.items():
 if len(items)!=len(g['animations']) or any(x[2] is None for x in items):continue
 if any(max(abs(x-y) for x,y in zip(items[0][2],it[2]))>=1e-7 for it in items):continue
 g['nodes'][node][path]=list(items[0][2]);remove.update((ai,ci) for ai,ci,_ in items)
for ai,anim in enumerate(g['animations']):anim['channels']=[c for ci,c in enumerate(anim['channels']) if (ai,ci) not in remove]
j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4);p.write_bytes(struct.pack('<III',0x46546c67,2,20+len(j)+len(tail))+struct.pack('<II',len(j),0x4e4f534a)+j+tail);print(p,len(remove),'constant channels baked')
