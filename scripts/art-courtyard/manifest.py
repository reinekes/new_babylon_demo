"""Refresh local asset checksums and geometry inventory after an authored change."""
import json,struct,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[2]/'assets/art-courtyard';rows=[]
for p in sorted(root.rglob('*')):
 if not p.is_file() or p.name=='manifest.json' or any(part.startswith('.') for part in p.relative_to(root).parts):continue
 d=p.read_bytes();r={'file':str(p.relative_to(root)),'bytes':len(d),'sha256':hashlib.sha256(d).hexdigest()}
 if p.suffix=='.glb':
  g=json.loads(d[20:20+struct.unpack_from('<I',d,12)[0]]);r.update(triangles=sum(g['accessors'][q['indices']]['count']//3 for m in g['meshes'] for q in m['primitives']),meshes=len(g['meshes']),bones=max([len(s['joints']) for s in g.get('skins',[])]+[0]),clips=[a['name'] for a in g.get('animations',[])])
 rows.append(r)
(root/'manifest.json').write_text(json.dumps({'release':'art-courtyard-20261020-1','purpose':'separate art trial, no save data','files':rows},indent=2)+'\n')
