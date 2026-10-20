import bpy,json,math
from pathlib import Path
import sys
filename=sys.argv[1] if len(sys.argv)>1 else 'sumer-resident.glb'
P=Path('/tmp/art-human-selection');bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.open_mainfile(filepath=str(P/'sumer-resident.blend'))
for o in list(bpy.data.objects):
 if o.type not in ['CAMERA','LIGHT']:bpy.data.objects.remove(o,do_unlink=True)
for a in list(bpy.data.actions):bpy.data.actions.remove(a)
bpy.ops.import_scene.gltf(filepath=str(P/filename))
arm=next(o for o in bpy.context.scene.objects if o.type=='ARMATURE')
for t in list(arm.animation_data.nla_tracks):arm.animation_data.nla_tracks.remove(t)
report={'roundtrip':True,'clips':[]}
for name in ['Walk_Loop','Idle_Loop']:
 a=bpy.data.actions[name];arm.animation_data.action=a;frames=a.frame_range;mins=[];maxs=[]
 for f in range(round(frames[0]),round(frames[1])+1):
  bpy.context.scene.frame_set(f);bpy.context.view_layer.update();vs=[];dg=bpy.context.evaluated_depsgraph_get()
  for o in bpy.context.scene.objects:
   if o.type=='MESH' and any(m.type=='ARMATURE' for m in o.modifiers):
    ev=o.evaluated_get(dg);me=ev.to_mesh();vs.extend(ev.matrix_world@v.co for v in me.vertices);ev.to_mesh_clear()
  assert all(math.isfinite(c)for v in vs for c in v)
  mins.append([min(v[i]for v in vs)for i in range(3)]);maxs.append([max(v[i]for v in vs)for i in range(3)])
 report['clips'].append({'name':name,'frame_range':list(frames),'min':[min(v[i]for v in mins)for i in range(3)],'max':[max(v[i]for v in maxs)for i in range(3)]})
 bpy.context.scene.frame_set(13 if name=='Walk_Loop' else 0);bpy.context.scene.render.filepath=str(P/('preview-export-'+('lod-' if 'lod' in filename else '')+name+'.png'));bpy.ops.render.render(write_still=True)
(P/('roundtrip-lod-report.json' if 'lod' in filename else 'roundtrip-report.json')).write_text(json.dumps(report,indent=2));print(json.dumps(report))
