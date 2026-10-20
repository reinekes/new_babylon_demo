"""CC0 geometry-only refinement of existing residents: asymmetric shoulder wrap and short fringe."""
import bpy,bmesh,json,struct
from pathlib import Path
from mathutils import Vector
P=Path('/tmp/art-human-selection');bpy.context.preferences.filepaths.use_scripts_auto_execute=False
report=[]
for stem in ['sumer-resident','sumer-resident-lod']:
 bpy.ops.wm.open_mainfile(filepath=str(P/(stem+'.blend')));scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');top=next(o for o in scene.objects if o.name=='Wool shoulder wrap');skirt=next(o for o in scene.objects if o.name=='Pleated wool wrap skirt')
 # Exact diagonal plane retains intersections and interpolates original skin weights.
 bm=bmesh.new();bm.from_mesh(top.data);bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=Vector((0,0,1.275)),plane_no=Vector((-.60,0,1)).normalized(),dist=.000001,clear_outer=True,clear_inner=False);bm.to_mesh(top.data);bm.free();top.data.update()
 # Small fringe teeth along the original closed hem ring; each point inherits interpolated hem weights.
 bm=bmesh.new();bm.from_mesh(skirt.data);dv=bm.verts.layers.deform.verify();hem=[e for e in bm.edges if len(e.link_faces)==1 and max(v.co.z for v in e.verts)<.48 and min(v.co.z for v in e.verts)>.448]
 for e in hem:
  a,b=e.verts;v=bm.verts.new((a.co+b.co)*.5+Vector((0,0,-.013)));keys=set(a[dv].keys())|set(b[dv].keys())
  for k in keys:v[dv][k]=.5*a[dv].get(k,0)+.5*b[dv].get(k,0)
  f=bm.faces.new((a,b,v));f.material_index=0;f.smooth=True
 bm.to_mesh(skirt.data);bm.free();skirt.data.update()
 # Keep source scene lighting, saved geometry and exact existing actions; only character selected for GLB.
 bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
 for o in scene.objects:
  if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers):o.select_set(True)
 scene.frame_set(0);bpy.ops.export_scene.gltf(filepath=str(P/(stem+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_materials='EXPORT');bpy.ops.wm.save_as_mainfile(filepath=str(P/(stem+'.blend')))
 b=(P/(stem+'.glb')).read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);report.append({'file':stem+'.glb','bytes':len(b),'triangles':sum(j['accessors'][p['indices']]['count']//3 for m in j['meshes']for p in m['primitives']),'bones':[len(s['joints'])for s in j['skins']],'clips':[a['name']for a in j['animations']],'fringe_teeth':len(hem)})
(P/'wrap-refinement-stats.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
