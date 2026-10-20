import bpy, json, math
from pathlib import Path
from collections import Counter
out=Path('/tmp/art-palm-selection')
tex=Path('/tmp/art-palm-selection/textures')
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(out/'mature-date-palm-tree.glb'))
# The source uses 35 separate, identical horizontal ring meshes. Removing these
# decorative strips leaves the full original trunk and lets photographic bark
# carry irregular scars, rather than making a regular ladder up the trunk.
removed=[]
for obj in list(bpy.data.objects):
 if obj.type=='MESH' and obj.name.startswith('Palm trunk leaf scar'):
  removed.append(obj.name); bpy.data.objects.remove(obj,do_unlink=True)
# Build one packed metallic/roughness map so export stays self-contained and small.
color=bpy.data.images.load(str(tex/'palm_bark_color.jpg'))
normal=bpy.data.images.load(str(tex/'palm_bark_normal.jpg')); normal.colorspace_settings.name='Non-Color'
rough=bpy.data.images.load(str(tex/'palm_bark_roughness.jpg')); rough.colorspace_settings.name='Non-Color'
# Keep images as JPEG embedded in GLB; pack also preserves native .blend portability.
for img in [color,normal,rough]: img.pack()
bark=next(m for m in bpy.data.materials if m.name=='bark')
bark.use_nodes=True; nodes=bark.node_tree.nodes; links=bark.node_tree.links; nodes.clear()
output=nodes.new('ShaderNodeOutputMaterial'); bsdf=nodes.new('ShaderNodeBsdfPrincipled'); links.new(bsdf.outputs['BSDF'],output.inputs['Surface']); bsdf.inputs['Metallic'].default_value=0
uv=nodes.new('ShaderNodeTexCoord'); mapping=nodes.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'; mapping.inputs[1].default_value=(1,5,1); links.new(uv.outputs['UV'],mapping.inputs[0])
for image,name,socket in [(color,'Palm bark / Poly Haven','Base Color'),(rough,'Palm bark roughness','Roughness')]:
 t=nodes.new('ShaderNodeTexImage');t.name=name;t.image=image;links.new(mapping.outputs['Vector'],t.inputs['Vector']);links.new(t.outputs['Color'],bsdf.inputs[socket])
t=nodes.new('ShaderNodeTexImage');t.name='Palm bark GL normal';t.image=normal;links.new(mapping.outputs['Vector'],t.inputs['Vector']);nm=nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.75;links.new(t.outputs['Color'],nm.inputs['Color']);links.new(nm.outputs['Normal'],bsdf.inputs['Normal'])
# glTF UV repeat transformed through Vector Math is not recognized by the
# exporter; bake the simple repeat into UV coordinates and link nodes directly.
for obj in bpy.data.objects:
 if obj.type!='MESH':continue
 if any(m==bark for m in obj.data.materials):
  for uv_layer in obj.data.uv_layers:
   for loop in uv_layer.data:loop.uv.y*=5
for n in list(nodes):
 if n.type=='TEX_IMAGE':links.new(uv.outputs['UV'],n.inputs['Vector'])
# Preserve every static world transform and UV before material-level merge.
# Meshes in this source each carry exactly one material.
meshes=[o for o in bpy.data.objects if o.type=='MESH']
for o in meshes:
 world=o.matrix_world.copy();o.parent=None;o.matrix_world=world
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.transform_apply(location=True,rotation=True,scale=True)
groups={}
for o in meshes:
 assert len(o.data.materials)==1,(o.name,len(o.data.materials))
 groups.setdefault(o.data.materials[0].name,[]).append(o)
for name,objects in sorted(groups.items()):
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name='Date palm - '+name
# Delete only unused transform containers left by glTF import.
for o in list(bpy.data.objects):
 if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
for o in bpy.data.objects:
 o['source']='https://www.innerscene.com/tools/library/3d-parts/mature-date-palm-tree-af8bdc6f';o['license']='CC0-1.0'
for mat in bpy.data.materials:
 mat['license']='CC0-1.0'
bark['texture_source']='https://polyhaven.com/a/palm_bark'
bpy.ops.wm.save_as_mainfile(filepath=str(out/'palm-adapted.blend'))
bpy.ops.export_scene.gltf(filepath=str(out/'date-palm.glb'),export_format='GLB',export_image_format='AUTO',export_jpeg_quality=85,export_extras=True,export_yup=True,export_normals=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
print('ADAPTATION',json.dumps({'removed_uniform_leaf_scar_meshes':len(removed),'mesh_count':len([o for o in bpy.data.objects if o.type=='MESH']),'materials':list(groups),'files':[str(out/'date-palm.glb'),str(out/'palm-adapted.blend')]},indent=2))
