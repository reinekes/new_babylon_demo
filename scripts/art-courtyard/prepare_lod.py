"""CC0 Sumer resident adaptation. Sources/credits in RESIDENT_LICENSE.md. No external scripts executed."""
import bpy, math, json
from mathutils import Matrix,Quaternion,Vector
from pathlib import Path
P=Path('/tmp/art-human-selection')
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene;scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=str(P/'natural-base-53.glb'))
arm=next(o for o in bpy.context.selected_objects if o.type=='ARMATURE');body=next(o for o in bpy.context.selected_objects if o.type=='MESH');arm.name='SumerResident_Rig';body.name='Resident_Skin'
def mat(name,color,rough=0.88):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;return m
skin=mat('Warm tan skin',(.43,.245,.125));cloth=mat('Undyed wool',(.65,.56,.39));edge=mat('Woven dark ochre border',(.28,.16,.065));hair=mat('Dark brown hair',(.045,.021,.009));eyes=mat('Dark eyes',(.022,.012,.006),.5)
body.data.materials.clear();body.data.materials.append(skin)
# Subtle physical weave, all procedural and CC0-authored. Export keeps base color.
for m in [cloth,edge]:
 nt=m.node_tree;p=nt.nodes.get('Principled BSDF');n=nt.nodes.new('ShaderNodeTexNoise');n.inputs['Scale'].default_value=170;n.inputs['Detail'].default_value=2;b=nt.nodes.new('ShaderNodeBump');b.inputs['Strength'].default_value=.13;b.inputs['Distance'].default_value=.004;nt.links.new(n.outputs['Fac'],b.inputs['Height']);nt.links.new(b.outputs['Normal'],p.inputs['Normal'])
# Voxel remesh closes imported seam fragmentation before crowd reduction; transfer skin weights from dense source.
from mathutils.kdtree import KDTree
oldverts=[v.co.copy()for v in body.data.vertices];oldweights=[[(g.group,g.weight)for g in v.groups]for v in body.data.vertices];groupnames=[g.name for g in body.vertex_groups]
tree=KDTree(len(oldverts))
for i,co in enumerate(oldverts):tree.insert(co,i)
tree.balance();bpy.context.view_layer.objects.active=body;bpy.ops.object.select_all(action='DESELECT');body.select_set(True)
mod=body.modifiers.new('Unified crowd surface','REMESH');mod.mode='VOXEL';mod.voxel_size=.017;mod.use_smooth_shade=True
while body.modifiers.find(mod.name)>0:bpy.ops.object.modifier_move_up(modifier=mod.name)
bpy.ops.object.modifier_apply(modifier=mod.name)
body.vertex_groups.clear()
for n in groupnames:body.vertex_groups.new(name=n)
for v in body.data.vertices:
 weights={};neighbors=tree.find_n(v.co,4)
 for co,idx,d in neighbors:
  fac=1/(d*d+.000001)
  for gi,w in oldweights[idx]:weights[gi]=weights.get(gi,0)+w*fac
 tot=sum(weights.values())
 if tot:
  for gi,w in weights.items():body.vertex_groups[gi].add([v.index],w/tot,'REPLACE')
for p in body.data.polygons:p.use_smooth=True
# Surface derived patches retain exact original vertex weights.
def patch(name,predicate,material,offset=.004):
 src=body.data;polys=[p for p in src.polygons if all(predicate(src.vertices[i].co)for i in p.vertices)];ids=sorted({i for p in polys for i in p.vertices});mp={i:k for k,i in enumerate(ids)};verts=[src.vertices[i].co+src.vertices[i].normal*offset for i in ids];faces=[[mp[i]for i in p.vertices]for p in polys];me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update();o=bpy.data.objects.new(name,me);scene.collection.objects.link(o);o.data.materials.append(material)
 for g in body.vertex_groups:o.vertex_groups.new(name=g.name)
 for old,new in mp.items():
  for g in src.vertices[old].groups:o.vertex_groups[g.group].add([new],g.weight,'REPLACE')
 mod=o.modifiers.new('Skin deform','ARMATURE');mod.object=arm;o.parent=arm
 for p in me.polygons:p.use_smooth=True
 return o
# Front is negative Y. Hair cap follows anatomical scalp and tapered sideburns.
scalp=patch('Fitted short scalp hair',lambda v:v.z>1.608 if v.y<-.075 else v.z>1.54,hair,.005)
beard=patch('Close cropped curved beard',lambda v:1.46<v.z<1.535 and v.y<-.08 and (abs(v.x)>.019 or v.z<1.491),hair,.003)
# Full fitted shoulder tunic covers torso, leaving arm/neck openings; wool wrap skirt covers hips.
top=patch('Wool shoulder wrap',lambda v: .965<v.z<1.393 and abs(v.x)<(.205 if v.z<1.32 else .19),cloth,.009)
# Geometric wrap garment with subtle radial pleating, open below the knee.
N=64;levels=[(.987,.188,.145),(.91,.222,.166),(.77,.245,.185),(.61,.275,.215),(.455,.295,.24)]
verts=[]
for l,(z,rx,ry)in enumerate(levels):
 for i in range(N):
  a=2*math.pi*i/N;p=1+.018*math.cos(16*a);verts.append((rx*math.cos(a)*p,ry*math.sin(a)*p,z+.003*math.cos(8*a)*(l/4)))
faces=[]
for l in range(len(levels)-1):
 for i in range(N):faces.append((l*N+i,l*N+(i+1)%N,(l+1)*N+(i+1)%N,(l+1)*N+i))
me=bpy.data.meshes.new('Wool wrap pleats');me.from_pydata(verts,[],faces);me.update();skirt=bpy.data.objects.new('Pleated wool wrap skirt',me);scene.collection.objects.link(skirt);skirt.data.materials.append(cloth);skirt.data.materials.append(edge)
for p in me.polygons:p.material_index=1 if p.center.z<.50 else 0;p.use_smooth=True
for n in ['pelvis','thigh_l','thigh_r']:skirt.vertex_groups.new(name=n)
for i,v in enumerate(verts):
 z=v[2];leg=.64*max(0,min(1,(.91-z)/.46));left=.5+.5*math.tanh(v[0]/.06);skirt.vertex_groups['pelvis'].add([i],1-leg,'REPLACE');skirt.vertex_groups['thigh_l'].add([i],leg*left,'REPLACE');skirt.vertex_groups['thigh_r'].add([i],leg*(1-left),'REPLACE')
mod=skirt.modifiers.new('Skin deform','ARMATURE');mod.object=arm;skirt.parent=arm
# Remove hidden covered torso/hips. No nude body surface is exported underneath the garment.
import bmesh
bm=bmesh.new();bm.from_mesh(body.data);remove=[v for v in bm.verts if .47<v.co.z<.965];bmesh.ops.delete(bm,geom=remove,context='VERTS');bm.to_mesh(body.data);bm.free()
# Decimate body preserving weighted skin and recognizable head. Other surface patches remain curved.
bpy.context.view_layer.objects.active=body;body.select_set(True)
mod=body.modifiers.new('Game mesh reduction','DECIMATE');mod.ratio=.25;bpy.ops.object.modifier_apply(modifier=mod.name)
for o in [scalp,beard,top]:
 bpy.context.view_layer.objects.active=o;mod=o.modifiers.new('Patch reduction','DECIMATE');mod.ratio=.25;bpy.ops.object.modifier_apply(modifier=mod.name)
# Dark almond eye surface patches conform to actual face via raycast, following head bone.
for side in [-1,1]:
 vs=[]
 for i in range(12):
  a=2*math.pi*i/12;x=side*.031+.012*math.cos(a);z=1.568+.0046*math.sin(a);hit,loc,n,idx=body.ray_cast(Vector((x,-1,z)),Vector((0,1,0)));vs.append((x,loc.y-.0015 if hit else -.147,z))
 me=bpy.data.meshes.new('Eye almond');me.from_pydata(vs,[],[tuple(range(12))]);me.update();o=bpy.data.objects.new('Dark eye '+str(side),me);scene.collection.objects.link(o);o.data.materials.append(eyes);g=o.vertex_groups.new(name='head');g.add(list(range(12)),1,'REPLACE');mod=o.modifiers.new('Head skin','ARMATURE');mod.object=arm;o.parent=arm
# Import original authored CC0 walk and preserve only armature source for baking.
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(P/'sam-walk.glb'));samobs=set(bpy.data.objects)-before;sam=next(o for o in samobs if o.type=='ARMATURE');[sam.animation_data.nla_tracks.remove(t) for t in list(sam.animation_data.nla_tracks)];sam.animation_data.action=next(a for a in bpy.data.actions if a.name.startswith('Walk_Brisk'))
source_action=sam.animation_data.action;fr0,fr1=source_action.frame_range;names=[b.name for b in arm.data.bones];rest={n:arm.data.bones[n].matrix_local.copy()for n in names};srest={n:sam.data.bones[n].matrix_local.copy()for n in names};ordered=sorted(names,key=lambda n:len(arm.data.bones[n].parent_recursive))
arm.animation_data_create();walk=bpy.data.actions.new('Walk_Loop');arm.animation_data.action=walk
# Global rest-corrected rotation, target's own bone lengths; pelvis translation motion retained as delta.
for frame in range(53):
 scene.frame_set(1);scene.frame_set(int(fr0+(fr1-fr0)*frame/52),subframe=(fr0+(fr1-fr0)*frame/52)%1);bpy.context.view_layer.update()
 for n in ordered:
  pb=arm.pose.bones[n];sb=sam.pose.bones[n];q=sb.matrix.to_quaternion()@srest[n].to_quaternion().inverted()@rest[n].to_quaternion();q=rest[n].to_quaternion().slerp(q,.80)
  if n.startswith('upperarm_'):q=Quaternion((0,1,0),-.16 if n.endswith('_l') else .16)@q
  if pb.parent:pos=pb.parent.matrix@rest[pb.parent.name].inverted()@rest[n].translation
  else:pos=rest[n].translation.copy()
  if n=='pelvis':pos+=sb.matrix.translation-srest[n].translation
  pb.matrix=Matrix.Translation(pos)@q.to_matrix().to_4x4();pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)
# Ground the baked walk on the actual deformed soles, avoiding airborne support feet.
for frame in range(53):
 scene.frame_set(frame);bpy.context.view_layer.update();ev=body.evaluated_get(bpy.context.evaluated_depsgraph_get());me=ev.to_mesh();lo=min((ev.matrix_world@v.co).z for v in me.vertices);ev.to_mesh_clear();pb=arm.pose.bones['Root'];m=pb.matrix.copy();m.translation.z+=.002-lo;pb.matrix=m;pb.keyframe_insert('location',frame=frame)
# Authored idle: relaxed arms from walk frame0, breathing and very slight head motion; no mocap.
arm.animation_data.action=None
for n in names:arm.pose.bones[n].matrix_basis=Matrix.Identity(4)
bpy.context.view_layer.update()
for side in ['l','r']:
 pb=arm.pose.bones['upperarm_'+side];bone=pb.bone;desired=Vector((.24 if side=='l' else -.24,-.02,-1)).normalized();q=(bone.tail_local-bone.head_local).normalized().rotation_difference(desired);m=q.to_matrix().to_4x4()@bone.matrix_local;m.translation=bone.head_local;pb.matrix=m
bpy.context.view_layer.update();basepose={n:arm.pose.bones[n].matrix_basis.copy()for n in names};idle=bpy.data.actions.new('Idle_Loop');arm.animation_data.action=idle
for frame in range(91):
 phase=2*math.pi*frame/90
 for n in names:
  pb=arm.pose.bones[n];pb.matrix_basis=basepose[n];pb.rotation_mode='QUATERNION'
  if n=='Root':pb.location.z+=.002
  if n=='spine_03':pb.rotation_quaternion=pb.rotation_quaternion@Quaternion((1,0,0),.008*math.sin(phase))
  if n=='head':pb.rotation_quaternion=pb.rotation_quaternion@Quaternion((0,1,0),.012*math.sin(phase))
  pb.keyframe_insert('location',frame=frame);pb.keyframe_insert('rotation_quaternion',frame=frame);pb.keyframe_insert('scale',frame=frame)
# Delete imported hidden bone widgets, which are authoring helpers, never part of the character.
for o in list(bpy.data.objects):
 if o.type=='MESH' and o not in [body,scalp,beard,top,skirt] and not o.name.startswith('Dark eye') and o not in samobs:bpy.data.objects.remove(o,do_unlink=True)
# Delete source armature and its modern-clothes meshes, and source animation.
for o in samobs:bpy.data.objects.remove(o,do_unlink=True)
arm.animation_data.action=None
for action,end in [(walk,52),(idle,90)]:
 track=arm.animation_data.nla_tracks.new();track.name=action.name;strip=track.strips.new(action.name,0,action);strip.action_frame_start=0;strip.action_frame_end=end;strip.frame_end=end
scene.frame_start=0;scene.frame_end=90;scene.frame_set(0)
# Measure evaluated deformed mesh bounds through complete gait, foot trajectory, displacement.
stats={'sources':['Innerscene CC0 MakeHuman53bone base','Innerscene original periodic authored CC0 Walk_Brisk'],'clips':{},'triangles':0,'bones':len(arm.data.bones),'meshes':[]}
for o in list(scene.objects):
 if o.type=='MESH':
  tris=sum(len(p.vertices)-2 for p in o.data.polygons);stats['triangles']+=tris;stats['meshes'].append({'name':o.name,'triangles':tris})
for track in arm.animation_data.nla_tracks:track.mute=True
for action,end in [(walk,52),(idle,90)]:
 arm.animation_data.action=action;bounds=[];feet={s:[]for s in ['foot_l','foot_r']}
 for f in range(end+1):
  scene.frame_set(f);bpy.context.view_layer.update();dg=bpy.context.evaluated_depsgraph_get();vs=[]
  for o in scene.objects:
   if o.type=='MESH':
    ev=o.evaluated_get(dg);mesh=ev.to_mesh();vs.extend(ev.matrix_world@v.co for v in mesh.vertices);ev.to_mesh_clear()
  bounds.append([[min(v[i]for v in vs)for i in range(3)],[max(v[i]for v in vs)for i in range(3)]])
  for s in feet:feet[s].append(list(arm.pose.bones[s].matrix.translation))
 stats['clips'][action.name]={'seconds':end/30,'frames':end+1,'bounds_min':[min(bb[0][i]for bb in bounds)for i in range(3)],'bounds_max':[max(bb[1][i]for bb in bounds)for i in range(3)],'foot_travel':{s:[max(v[i]for v in a)-min(v[i]for v in a)for i in range(3)]for s,a in feet.items()}}
arm.animation_data.action=None
for t in arm.animation_data.nla_tracks:t.mute=False
bpy.data.orphans_purge(do_recursive=True)
# Export only character, no lighting/camera. Both named NLA clips embedded.
bpy.ops.object.select_all(action='DESELECT')
for o in scene.objects:o.select_set(True)
scene.frame_set(0)
bpy.ops.export_scene.gltf(filepath=str(P/'sumer-resident-lod.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_materials='EXPORT')
# Camera/lighting added after export for offline visual inspection.
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(2.4,-3.5,1.9));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.25;aim(cam,(0,0,.86));scene.camera=cam
for loc,power,size in [((2,-3,4),450,4),((-2,-1,2),220,3),((1,2,3),350,3)]:
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
scene.world=bpy.data.worlds.new('Warm studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.17,.17,.16,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.6
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=False
bpy.ops.wm.save_as_mainfile(filepath=str(P/'sumer-resident-lod.blend'))
for t in arm.animation_data.nla_tracks:t.mute=True
arm.animation_data.action=walk
for f in [0,13,26]:
 scene.frame_set(f);scene.render.filepath=str(P/f'lod-preview-walk-{f:02d}.png');bpy.ops.render.render(write_still=True)
(P/'lod-stats.json').write_text(json.dumps(stats,indent=2));print('RESIDENT_STATS',json.dumps(stats))
