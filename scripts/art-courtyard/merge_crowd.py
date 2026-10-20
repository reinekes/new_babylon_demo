"""CC0 crowd draw-call optimization: one skinned mesh, one primitive, vertex colors."""
import bpy,json,struct
from pathlib import Path
P=Path('/tmp/art-human-selection');bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.open_mainfile(filepath=str(P/'sumer-resident-lod.blend'));scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');meshes=[o for o in scene.objects if o.type=='MESH' and any(m.type=='ARMATURE'for m in o.modifiers)];assert len(meshes) in (1,7)
arm.data.pose_position='REST';scene.frame_set(0);bpy.context.view_layer.update()
if len(meshes)==7:
 # Shared shader consumes the color attribute; no image texture or atlas required.
 m=bpy.data.materials.new('Crowd matte vertex colors');m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Roughness'].default_value=.95;p.inputs['Metallic'].default_value=0;vc=m.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Color';m.node_tree.links.new(vc.outputs['Color'],p.inputs['Base Color'])
 for o in meshes:
  colors=[]
  for slot in o.material_slots:
   mat=slot.material;bsdf=mat.node_tree.nodes.get('Principled BSDF') if mat and mat.use_nodes else None;colors.append(tuple(bsdf.inputs['Base Color'].default_value)if bsdf else tuple(mat.diffuse_color))
  attr=o.data.color_attributes.get('Color') or o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER');o.data.color_attributes.active_color=attr
  for face in o.data.polygons:
   rgba=colors[face.material_index]
   for li in face.loop_indices:attr.data[li].color=rgba
  o.data.materials.clear();o.data.materials.append(m)
  for face in o.data.polygons:face.material_index=0
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=next(o for o in meshes if o.name=='Resident_Skin');bpy.ops.object.join();body=bpy.context.object;body.name='SumerResident_CrowdMesh';body.data.name='Crowd continuous draw mesh';assert len([mo for mo in body.modifiers if mo.type=='ARMATURE'])==1
 body.data.materials.clear();body.data.materials.append(m)
 for face in body.data.polygons:face.material_index=0
else:
 body=meshes[0]
arm.data.pose_position='POSE';bpy.context.view_layer.update();bpy.ops.object.select_all(action='DESELECT');arm.select_set(True);body.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(P/'sumer-resident-lod-single.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_materials='EXPORT');bpy.data.orphans_purge(do_recursive=True);bpy.ops.wm.save_as_mainfile(filepath=str(P/'sumer-resident-lod-single.blend'))
b=(P/'sumer-resident-lod-single.glb').read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);stats={'bytes':len(b),'triangles':sum(j['accessors'][p['indices']]['count']//3 for me in j['meshes'] for p in me['primitives']),'meshes':len(j['meshes']),'primitives':sum(len(me['primitives'])for me in j['meshes']),'materials':len(j['materials']),'bones':[len(s['joints'])for s in j['skins']],'clips':[a['name']for a in j['animations']],'vertex_color_attributes':[[p['attributes'].get('COLOR_0')for p in me['primitives']]for me in j['meshes']]};assert stats['meshes']==stats['primitives']==stats['materials']==1;assert stats['bones']==[53];assert stats['vertex_color_attributes'][0][0]is not None;assert stats['triangles']<8000;(P/'single-mesh-stats.json').write_text(json.dumps(stats,indent=2));print(json.dumps(stats))
