import {WIDTH,HEIGHT} from '../world.js';
export const SKY_BIRD_MODEL='sky-bird-single.glb';
// The measured source beak is -Z; preparation rotates the complete rig to +Z.
// Babylon's actual loader preserves that forward axis (its conversion reflects X).
// Therefore atan2(dx,dz) is the complete yaw, verified against the real skin.
export function skyFlightPose(theta,index=0,{direction=1,centerX=WIDTH*3,centerZ=HEIGHT*3}={}){
 const t=theta+index*.73,sign=direction<0?-1:1,dx=-75*Math.sin(t)*sign,dz=55*Math.cos(t)*sign;
 return {x:centerX+75*Math.cos(t)+(index%4)*1.1,y:17+Math.sin(t*.6)*2+(index%3)*.7,z:centerZ+55*Math.sin(t)+Math.floor(index/4)*2,yaw:Math.atan2(dx,dz),bank:.04*Math.sin(t)*sign};
}
