"""Prepare p0ss CC BY-SA 3.0 sheep, using Blender Python 4.5.3.
Run: python prepare_sheep.py (requires bpy); no external network access.
"""
import bpy, math, json, struct
from pathlib import Path
from mathutils import Vector, Matrix
BASE=Path(__file__).resolve().parent
bpy.ops.wm.open_mainfile(filepath=str(BASE/'sheepies.blend'),use_scripts=False)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
scene=bpy.context.scene
rig=bpy.data.objects['sheep skeleton']; sheep=bpy.data.objects['Sheep 2']
for obj in list(bpy.data.objects):
    if obj not in (rig,sheep): bpy.data.objects.remove(obj,do_unlink=True)
rig.name='SheepRig'; sheep.name='Sheep'
# Legacy file bone-parents a mesh that also has skinning. glTF needs object-parented skin.
world=sheep.matrix_world.copy();sheep.parent_type='OBJECT';sheep.parent_bone='';sheep.matrix_world=world
# Original mesh and armature placement are preserved together; never rebind weights.
rig.animation_data.action=None
for track in list(rig.animation_data.nla_tracks):rig.animation_data.nla_tracks.remove(track)
for pb in rig.pose.bones:
    pb.location=(0,0,0); pb.rotation_quaternion=(1,0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
scene.frame_set(0);bpy.context.view_layer.update()
# Original head points +X in armature-local space. Align to Blender -Y,
# exported as glTF +Z (right-handed source; Babylon loader handles handedness).
root=bpy.data.objects.new('SheepModel',None);scene.collection.objects.link(root)
root['license']='CC-BY-SA-3.0';root['author']='p0ss';root['source']='https://opengameart.org/content/sheep-rigged-textured-and-animated'
root['forward_gltf']='+Z';root['adaptation']='medium fleece selection, PBR material, metre scale, centered feet; original animation and weights retained'
world=rig.matrix_world.copy();rig.parent=root;rig.matrix_world=world
root.rotation_euler.z=-math.pi/2-rig.rotation_euler.z
root.scale=(.49,.49,.49);bpy.context.view_layer.update()
coords=[sheep.matrix_world@Vector(c) for c in sheep.bound_box]
lo=Vector(tuple(min(c[i]for c in coords)for i in range(3)))
hi=Vector(tuple(max(c[i]for c in coords)for i in range(3)))
root.location=(-(lo.x+hi.x)/2,-(lo.y+hi.y)/2,-lo.z)
bpy.context.view_layer.update()
# Reuse original UV and byte-for-byte extracted packed texture.
mat=bpy.data.materials.new('SheepFleece');mat.use_nodes=True
nodes=mat.node_tree.nodes;bsdf=nodes.get('Principled BSDF')
bsdf.inputs['Roughness'].default_value=.9
bsdf.inputs['Metallic'].default_value=0
bsdf.inputs['Specular IOR Level'].default_value=.2
tex=nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(BASE/'packed-image-1.png'),check_existing=False);tex.image.pack()
mat.node_tree.links.new(tex.outputs['Color'],bsdf.inputs['Base Color'])
sheep.data.materials.clear();sheep.data.materials.append(mat)
for p in sheep.data.polygons:p.use_smooth=True
# Keep complete authored clips, names explicit for runtime choice.
rename={'idle':'Idle','walking':'Walk','eating':'Graze','begin walking':'StartWalk','stop walk':'StopWalk','begin eating':'StartGraze','stop eating':'StopGraze'}
for a in bpy.data.actions:
    a.name=rename.get(a.name,a.name);a.use_fake_user=True
    # Blender 2.56 legacy slots remain unspecified until an object binds them.
    rig.animation_data.action=a
    if len(a.slots): rig.animation_data.action_slot=a.slots[0]
scene.render.fps=24;scene.frame_start=0;scene.frame_end=518
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(0)
bpy.ops.object.select_all(action='DESELECT')
for o in (root,rig,sheep):o.select_set(True)
bpy.context.view_layer.objects.active=rig
bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'sheep-adapted.blend'))
bpy.ops.export_scene.gltf(filepath=str(BASE/'sheep.glb'),export_format='GLB',use_selection=True,export_yup=True,export_animations=True,export_animation_mode='ACTIONS',export_frame_range=False,export_force_sampling=True,export_skins=True,export_all_influences=True,export_extras=True,export_cameras=False,export_lights=False)
# Independent binary inspection avoids a misleading exporter success alone.
b=(BASE/'sheep.glb').read_bytes();length,kind=struct.unpack_from('<II',b,12);gltf=json.loads(b[20:20+length])
coords=[sheep.matrix_world@Vector(c) for c in sheep.bound_box]
lo=[min(c[i]for c in coords)for i in range(3)];hi=[max(c[i]for c in coords)for i in range(3)]
triangles=sum(gltf['accessors'][p['indices']]['count']//3 for m in gltf['meshes']for p in m['primitives'])
report={'source':'https://opengameart.org/content/sheep-rigged-textured-and-animated','license':'CC-BY-SA-3.0','mesh':'Sheep 2 medium fleece','source_vertices':len(sheep.data.vertices),'source_polygons':len(sheep.data.polygons),'export_triangles':triangles,'bones':len(rig.data.bones),'bounds_blender_metres':{'min':lo,'max':hi,'size':[hi[i]-lo[i]for i in range(3)]},'gltf_forward':'+Z','animation_fps':24,'source_frames':{a.name:list(a.frame_range)for a in bpy.data.actions},'gltf_animations':[{ 'name':a['name'],'duration_seconds':max(gltf['accessors'][s['input']]['max'][0]for s in a['samplers'])}for a in gltf.get('animations',[])],'embedded_images':len(gltf.get('images',[])),'glb_bytes':len(b)}
assert len(gltf['skins'])==1 and report['embedded_images']==1
assert {'Idle','Walk','Graze'}.issubset({a['name']for a in gltf['animations']})
assert all('JOINTS_0'in p['attributes']and'WEIGHTS_0'in p['attributes']for m in gltf['meshes']for p in m['primitives'])
(BASE/'sheep-report.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
# Reload into empty Blender and assert restored weights, bones, and animations.
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(BASE/'sheep.glb'),disable_bone_shape=True)
meshes=[o for o in bpy.data.objects if o.type=='MESH'];rigs=[o for o in bpy.data.objects if o.type=='ARMATURE']
assert len(meshes)==1 and len(rigs)==1
assert len(meshes[0].vertex_groups)>0 and all(v.groups for v in meshes[0].data.vertices)
assert len(bpy.data.actions)>=3
print('RELOAD OK',len(meshes[0].data.vertices),'vertices',len(rigs[0].data.bones),'bones',len(bpy.data.actions),'actions; all vertices weighted')
