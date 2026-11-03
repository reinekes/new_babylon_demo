// Presentation-only screen-size budget. Root motion and simulation still run each frame.
export function residentPoseInterval(camera,point,viewportHeight,height=1.7,important=false){
 const eye=camera?.globalPosition||camera?.position;
 if(important||!eye||!point||!(viewportHeight>0)||!(camera.fov>0))return 0;
 const distance=Math.hypot(point.x-eye.x,point.y-eye.y,point.z-eye.z);
 const pixels=height*viewportHeight/(2*Math.tan(camera.fov/2)*Math.max(.01,distance));
 return pixels<12?1/10:pixels<28?1/15:0;
}
export function residentPoseSlot(seconds,interval,id){
 if(!(interval>0))return null;
 let hash=0;for(const c of String(id))hash=(hash*31+c.charCodeAt(0))>>>0;
 // Spread work across frames rather than sampling the entire crowd in one spike.
 return Math.floor(seconds/interval+(hash%17)/17);
}
