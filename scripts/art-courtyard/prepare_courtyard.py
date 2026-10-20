"""Original courtyard architecture and CC0 palm optimisation; run with bpy4.5.
No downloaded script is executed. All texture inputs have attribution in assets/art-courtyard.
"""
import bpy,math,random,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'assets/art-courtyard/models'
TEX=ROOT/'assets/3d/textures'
NEW=ROOT/'assets/art-courtyard/textures'
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.read_factory_settings(use_empty=True)
random.seed(73129)
def material(name,color,photo=None,normal=None,rough=.94):
 m=bpy.data.materials.new(name);m.use_nodes=True;m.diffuse_color=(*color,1)
 nodes=m.node_tree.nodes;p=nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough
 if photo:
  im=nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(photo));m.node_tree.links.new(im.outputs['Color'],p.inputs['Base Color'])
 if normal:
  im=nodes.new('ShaderNodeTexImage');im.image=bpy.data.images.load(str(normal));im.image.colorspace_settings.name='Non-Color'
  n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.35;m.node_tree.links.new(im.outputs['Color'],n.inputs['Color']);m.node_tree.links.new(n.outputs['Normal'],p.inputs['Normal'])
 return m
clay=material('hand-plastered-adobe',(.78,.68,.51),TEX/'clay_plaster_color.jpg',TEX/'clay_plaster_normal.jpg')
earth=material('roof-earth',(.55,.43,.29),TEX/'dry_ground_01_color.jpg',TEX/'dry_ground_01_normal.jpg')
wood=material('palm-timber',(.31,.21,.12),TEX/'wood_table_worn_color.jpg',TEX/'wood_table_worn_normal.jpg')
reed=material('woven-reed',(.56,.45,.25));linen=material('unbleached-wool-cloth',(.72,.64,.47));fired=material('pottery',(.46,.24,.12));dark=material('raw-brick-plinth',(.44,.34,.22))
objects=[]
def cube(name,pos,size,mat,bevel=.035):
 bpy.ops.mesh.primitive_cube_add(size=1,location=pos);o=bpy.context.object;o.name=name;o.dimensions=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 o.data.materials.append(mat)
 # UV scale follows actual metres rather than stretching an entire photograph across a room.
 for poly in o.data.polygons:
  for i in poly.loop_indices:
   co=o.data.vertices[o.data.loops[i].vertex_index].co;n=poly.normal
   o.data.uv_layers.active.data[i].uv=((co.y if abs(n.x)>.5 else co.x)*.55,(co.y if abs(n.z)>.5 else co.z)*.55)
 if bevel:
  mod=o.modifiers.new('worn-soft-edge','BEVEL');mod.width=bevel;mod.segments=3
  bpy.ops.object.modifier_apply(modifier=mod.name)
  mod=o.modifiers.new('wall-corner-normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name)
 objects.append(o);return o

def pole(name,a,b,r=.06,mat=wood):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2)
 o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat)
 for poly in o.data.polygons:poly.use_smooth=True
 objects.append(o);return o

def room(x,y,w,d,h):
 t=.43
 cube('rear-adobe-wall',(x,y+d/2,h/2),(w,t,h),clay,.07)
 cube('side-adobe-wall',(x-w/2,y,h/2),(t,d,h),clay,.07);cube('side-adobe-wall',(x+w/2,y,h/2),(t,d,h),clay,.07)
 # True open doorway rather than a black rectangle pasted onto a solid box.
 door=x+.45;left=door-.55-(x-w/2);right=x+w/2-(door+.55)
 cube('door-left',((x-w/2+door-.55)/2,y-d/2,h/2),(left,t,h),clay,.045)
 cube('door-right',((x+w/2+door+.55)/2,y-d/2,h/2),(right,t,h),clay,.045)
 cube('door-lintel',(door,y-d/2,(h+1.95)/2),(1.14,t,h-1.95),clay,.055)
 cube('door-threshold',(door,y-d/2-.08,.07),(1.2,.65,.14),dark)
 for i in range(int(w/.65)):
  pole('exposed-roof-beam',(x-w/2+.3+i*.65,y-d/2-.17,h-.12),(x-w/2+.3+i*.65,y+d/2+.15,h-.12),.072)
 cube('flat-packed-roof',(x,y,h+.025),(w+.1,d+.12,.18),earth,.045)
 for yy in [-d/2,d/2]:cube('roof-parapet',(x,y+yy,h+.23),(w+.15,.22,.34),clay,.065)
 for xx in [-w/2,w/2]:cube('roof-parapet',(x+xx,y,h+.23),(.22,d,.34),clay,.065)
 for i in range(int(w/.48)):
  cube('footing-block',(x-w/2+.24+i*.48,y-d/2-.015,.16),(.46,.49,.3),dark,.018)

def pot(x,y,scale=1,z=0):
 profile=[(.0,.0),(.13,.02),(.24,.10),(.28,.28),(.26,.45),(.16,.55),(.11,.60),(.12,.65),(.17,.68),(.17,.71),(.115,.71),(.095,.64),(.13,.57),(.21,.43),(.23,.27),(.19,.12),(.10,.08),(.0,.08)]
 verts=[];faces=[];N=24
 for r,h in profile:
  for i in range(N):a=i/N*math.tau;verts.append((x+math.cos(a)*r*scale,y+math.sin(a)*r*scale,z+h*scale))
 for j in range(len(profile)-1):
  for i in range(N):k=j*N+i;faces.append((k,j*N+(i+1)%N,(j+1)*N+(i+1)%N,k+N))
 mesh=bpy.data.meshes.new('thrown-pottery');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new('clay-storage-jar',mesh);bpy.context.collection.objects.link(o);o.data.materials.append(fired)
 for p in mesh.polygons:p.use_smooth=True
 objects.append(o)

def awning(x,y,w,d,h):
 for dx in [-w/2,w/2]:
  for dy in [-d/2,d/2]:pole('awning-post',(x+dx,y+dy,0),(x+dx,y+dy,h+.05),.065)
 for dx in [-w/2,w/2]:pole('awning-roof-pole',(x+dx,y-d/2,h),(x+dx,y+d/2,h),.06)
 verts=[];uv=[];indices=[];N=16
 for j in range(N+1):
  for i in range(N+1):
   u=i/N;v=j/N;verts.append((x+(u-.5)*w,y+(v-.5)*d,h-.19*math.sin(u*math.pi)+.024*math.cos(v*math.pi*8)));uv.append((u*2,v*2))
 for j in range(N):
  for i in range(N):k=j*(N+1)+i;indices.append((k,k+1,k+N+2,k+N+1))
 mesh=bpy.data.meshes.new('sagging-woven-roof');mesh.from_pydata(verts,[],indices);mesh.update();layer=mesh.uv_layers.new()
 for loop in mesh.loops:layer.data[loop.index].uv=uv[loop.vertex_index]
 o=bpy.data.objects.new('woven-shade',mesh);bpy.context.collection.objects.link(o);mesh.materials.append(linen)
 for p in mesh.polygons:p.use_smooth=True
 solid=o.modifiers.new('cloth-thickness','SOLIDIFY');solid.thickness=.018;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=solid.name);objects.append(o)
 for i in range(36):
  u=i/35;pole('fine-reed-weave',(x+(u-.5)*w,y-d/2,h-.19*math.sin(u*math.pi)+.03),(x+(u-.5)*w,y+d/2,h-.19*math.sin(u*math.pi)+.03),.009,reed)

room(0,2.1,8.4,2.6,2.85);room(-3.05,-.65,2.45,3.05,2.52)
cube('low-courtyard-wall',(4.2,-.7,.39),(.4,3.8,.78),clay,.065)
cube('low-courtyard-wall',(2.8,-2.6,.34),(2.8,.4,.68),clay,.065)
awning(1.0,-.55,3.45,2.3,2.3)
for x,y,scale in [(3.35,1,1.55),(2.78,1.2,1.1),(2.9,.6,.75),(-1.3,1,1),(-2.2,-2.2,.8)]:pot(x,y,scale)
for x in [-1.72,-1.12]:pole('roof-ladder-rail',(x,1,.0),(x,1.65,3.2),.045)
for i in range(9):z=.2+i*.34;y=1+z/3.2*.65;pole('roof-ladder-rung',(-1.76,y,z),(-1.08,y,z),.028)
# A woven sleeping mat and low work bench live in the shade.
cube('work-table',(1,-.45,.7),(1.6,.85,.11),wood,.025)
for x in [.35,1.65]:
 for y in [-.76,-.14]:pole('work-table-leg',(x,y,.02),(x,y,.68),.045)
for x in [.4,1.1,1.8]:pot(x,-.4,.5,.77)
cube('reed-mat',(.6,-1.9,.022),(1.9,.8,.035),reed,.01)
for i in range(23):pole('mat-binding',(-.3+i*.08,-2.28,.047),(-.3+i*.08,-1.52,.047),.008,linen)
# Merge by material after beveling; all forms remain editable in saved .blend.
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/art-courtyard/sources/courtyard.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'adobe-courtyard.glb'),export_format='GLB',use_selection=True,export_animations=False,export_extras=True)
print('COURTYARD',len(objects),'objects',sum(len(o.data.polygons) for o in objects))
