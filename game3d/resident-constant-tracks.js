// Babylon normally interpolates and rewrites every channel during a manual
// pose sample. A private resident clip may hold two identical GLB keys. Leave
// an already exact target alone, while preserving its playhead for resuming.
const classified=new WeakMap();
const cycle=1; // Babylon Animation.ANIMATIONLOOPMODE_CYCLE.

function constantTrack(animation){
 if(classified.has(animation))return classified.get(animation);
 const keys=animation.getKeys(),prop=animation.targetProperty;
 let track=null;
 if(keys.length===2&&['position','rotationQuaternion','scaling'].includes(prop)
  &&!animation._coreAnimation&&animation.loopMode===cycle&&!animation.getEvents().length&&!animation.enableBlending&&!animation.getEasingFunction()){
  const [first,last]=keys,value=first.value;
  const simple=k=>!k.inTangent&&!k.outTangent&&!k.easingFunction&&!k.interpolation;
  if(simple(first)&&simple(last)&&last.frame>first.frame&&value.equals(last.value)){
   const quaternion=prop==='rotationQuaternion';
   // Above this threshold Babylon uses its linear branch for identical quaternions.
   if(!quaternion||value.lengthSquared()>.999999)track={prop,value,quaternion,from:first.frame,to:last.frame};
  }
 }
 classified.set(animation,track);return track;
}

function sampleConstant(frame,weight=-1){
 const track=this.residentTrack,value=track.value,target=this.target?.[track.prop];
 if(target&&target===this.currentValue&&weight===-1&&!this.isAdditive&&!this._enableBlending&&!this._events.length&&this._animationState.loopMode===cycle){
  frame=Math.max(track.from,Math.min(track.to,frame));
  let equal;
  if(track.quaternion&&frame<track.to){
   // Reproduce SlerpToRef's exact arithmetic, including last-bit rounding.
   const t=(frame-track.from)/(track.to-track.from),u=1-t;
   equal=target.x===u*value.x+t*value.x&&target.y===u*value.y+t*value.y&&
    target.z===u*value.z+t*value.z&&target.w===u*value.w+t*value.w;
  }else equal=target.equals(value);
  if(equal){this._currentFrame=frame;return;}
 }
 return this.residentOriginalSeek(frame,weight);
}

export function prepareResidentClip(group){
 for(const channel of group.animatables)for(const runtime of channel.getAnimations()){
  const track=constantTrack(runtime.animation);
  if(!track||runtime.goToFrame===sampleConstant)continue;
  runtime.residentTrack=track;runtime.residentOriginalSeek=runtime.goToFrame;
  runtime.goToFrame=sampleConstant;
 }
}
