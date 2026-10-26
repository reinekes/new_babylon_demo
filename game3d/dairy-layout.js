// Shared metre-space milking contact: equipment, cow udder and palms agree.
export function dairyMilkingLayout(b){const [sx,sz]=b.workCorner||[1,1];return {kind:'dairy',x:sx*1.5,z:sz*1.94,height:.45,sx,sz};}
export function dairyMilkingCow(b){const a=dairyMilkingLayout(b),yaw=a.sx*Math.PI/2;return {x:a.x+a.sx*.1+.34*Math.sin(yaw),z:a.z+a.sz*.1+.34*Math.cos(yaw),yaw};}
