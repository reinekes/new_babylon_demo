import {footprintSize} from '../footprints.js';

// Equipment, the cow and the milkers share this position inside the open gate.
export function dairyMilkingLayout(b){
 const [sx,sz]=b.workCorner||[1,1];
 if(footprintSize(b)===2)return {kind:'dairy',x:7.20,z:3+sz*.78,height:.45,sx:1,sz};
 return {kind:'dairy',x:sx*1.5,z:sz*1.94,height:.45,sx,sz};
}
export function dairyMilkingCow(b){const a=dairyMilkingLayout(b),yaw=a.sx*Math.PI/2;return {x:a.x+a.sx*.1+.34*Math.sin(yaw),z:a.z+a.sz*.1+.34*Math.cos(yaw),yaw};}
