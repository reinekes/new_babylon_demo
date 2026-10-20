"""CC0 focused Idle_Loop arm relaxation; Walk_Loop and all geometry remain untouched."""
import bpy,math,json,struct,hashlib
from pathlib import Path
from mathutils import Matrix,Vector,Quaternion
P=Path('/tmp/art-human-selection');bpy.context.preferences.filepaths.use_scripts_auto_execute=False
report=[]
for stem in ['sumer-resident','sumer-resident-lod']:
 oldbytes=(P/(stem+'.glb')).read_bytes();bpy.ops.wm.open_mainfile(filepath=str(P/(stem+'.blend')));scene=bpy.context.scene;arm=next(o for o in scene.objects if o.type=='ARMATURE');tracks=list(arm.animation_data.nla_tracks)
 for t in tracks:t.mute=True
 arm.animation_data.action=bpy.data.actions['Idle_Loop'];action=arm.animation_data.action
 coords=[]
 for f in range(91):
  scene.frame_set(f);bpy.context.view_layer.update()
  for side,sgn in [('l',1),('r',-1)]:
   for part,direction in [('upperarm',Vector((sgn*.20,.06,-1))),('lowerarm',Vector((sgn*.25,-.10,-1))),('hand',Vector((sgn*.02,-.03,-1)))]:
    pb=arm.pose.bones[part+'_'+side];old=pb.matrix.copy();direction.normalize();oldaxis=(pb.tail-pb.head).normalized();q=oldaxis.rotation_difference(direction)@old.to_quaternion()
    if part=='hand':
     # Keep thumb/index edge forward so palms face the thighs rather than the camera.
     rest=pb.bone.matrix_local;index=arm.data.bones['index_01_'+side].head_local;pinky=arm.data.bones['pinky_01_'+side].head_local;across=q@(rest.to_quaternion().inverted()@(index-pinky));across-=direction*across.dot(direction);across.normalize();target=Vector((0,-1,0));target-=direction*target.dot(direction);target.normalize();angle=math.atan2(direction.dot(across.cross(target)),across.dot(target));q=Quaternion(direction,angle)@q
    scale=old.to_scale();pb.matrix=Matrix.Translation(old.translation)@q.to_matrix().to_4x4()@Matrix.Diagonal((*scale,1));pb.rotation_mode='QUATERNION';pb.keyframe_insert('location',frame=f);pb.keyframe_insert('rotation_quaternion',frame=f);bpy.context.view_layer.update()
   if f==0:coords.append({'side':side,'elbow':list(arm.pose.bones['lowerarm_'+side].head),'wrist':list(arm.pose.bones['hand_'+side].head),'hand_tip':list(arm.pose.bones['hand_'+side].tail)})
 arm.animation_data.action=None
 for t in tracks:t.mute=False
 scene.frame_set(0);bpy.ops.object.select_all(action='DESELECT');arm.select_set(True)
 for o in scene.objects:
  if o.type=='MESH' and any(m.type=='ARMATURE'for m in o.modifiers):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(P/(stem+'.glb')),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_frame_range=False,export_force_sampling=True,export_materials='EXPORT');bpy.ops.wm.save_as_mainfile(filepath=str(P/(stem+'.blend')))
 # Compare immutable walk samples by node name/path independent of accessor numbering.
 def walkdata(raw):
  n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);binstart=20+n+8;data=raw[binstart:];anim=next(a for a in j['animations']if a['name']=='Walk_Loop');out={}
  def acc(i):
   a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);nc={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];return data[offset:offset+a['count']*nc*4]
  for c in anim['channels']:
   s=anim['samplers'][c['sampler']];t=c['target'];out[(j['nodes'][t['node']]['name'],t['path'])]=(acc(s['input']),acc(s['output']))
  return out
 before=walkdata(oldbytes);after=walkdata((P/(stem+'.glb')).read_bytes());assert before.keys()==after.keys();diff=0
 for k in before:
  for a,b in zip(before[k],after[k]):
   assert len(a)==len(b)
   if a!=b:
    av=struct.unpack('<'+'f'*(len(a)//4),a);bv=struct.unpack('<'+'f'*(len(b)//4),b);diff=max(diff,max(abs(x-y)for x,y in zip(av,bv)))
 assert diff<.00001,(stem,diff)
 report.append({'file':stem+'.glb','walk_max_sample_difference':diff,'idle_frame0_arm_joints':coords})
(P/'idle-arm-refinement.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
