"""Prepare user-supplied Yard Wheat Clump, preserving original credits and UVs.
The model is a generic wheat stand-in for emmer, not a botanical reconstruction.
Requires bundled Python numpy/Pillow. Does not touch source download or manifest.
"""
from pathlib import Path
import json, struct, hashlib, tempfile
from prepare_valley_plants import extract
ROOT=Path(__file__).resolve().parents[2]
if __name__=='__main__':
 source=Path.home()/'Downloads/yard_wheat_clump.glb'
 raw=source.read_bytes();size=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+size]);binary=raw[28+size:]
 g.pop('animations',None)
 for mesh in g['meshes']:
  mesh.pop('weights',None)
  for primitive in mesh['primitives']:primitive.pop('targets',None)
 j=json.dumps(g,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
 static=struct.pack('<III',0x46546c67,2,28+len(j)+len(binary))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(binary),0x004e4942)+binary
 with tempfile.TemporaryDirectory() as folder:
  frozen=Path(folder)/source.name;frozen.write_bytes(static)
  report=extract(frozen,'crop-emmer',[6],1.02,'Generic wheat adapted visually for emmer / Triticum dicoccum; broad awned ears, species not identified by source author',True)
 report['source_sha256']=hashlib.sha256(raw).hexdigest()
 report['changes'].append('froze rest shape; removed source morph wind animation and morph targets')
 # Record the unmodified download identity in the adaptation metadata as well.
 model=ROOT/'assets/art-courtyard/models/crop-emmer.glb'
 out=model.read_bytes();n=struct.unpack_from('<I',out,12)[0]
 doc=json.loads(out[20:20+n]);payload=out[28+n:]
 doc['asset']['extras']['new_babylon_adaptation']=report
 while True:
  j=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();j+=b' '*((-len(j))%4)
  size=28+len(j)+len(payload)
  if report['bytes']==size:break
  report['bytes']=size
 data=struct.pack('<III',0x46546c67,2,size)+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(payload),0x004e4942)+payload
 model.write_bytes(data)
 (ROOT/'assets/art-courtyard/models/crop-emmer.metadata.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({k:report[k]for k in ['file','bytes','triangles','bounds_min','bounds_max']},ensure_ascii=False))
