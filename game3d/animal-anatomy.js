// Artist-authored section skin, closed at both ends. Angular seam normals are
// welded after normal calculation so sunlight never reveals a longitudinal cut.
export function closedAnimalLoft(B,controls){
 const rings=[],segments=16,positions=[],indices=[],normals=[],uvs=[];
 const interpolate=(a,b,c,d,t)=>.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t);
 for(let r=0;r<controls.length-1;r++)for(let j=0;j<3;j++){
  const t=j/3,ring=controls[r].map((_,k)=>interpolate(controls[Math.max(0,r-1)][k],controls[r][k],controls[r+1][k],controls[Math.min(controls.length-1,r+2)][k],t));
  for(let k=0;k<4;k++)ring[k]=Math.max(Math.min(controls[r][k],controls[r+1][k]),Math.min(Math.max(controls[r][k],controls[r+1][k]),ring[k]));
  ring[2]=Math.max(.001,ring[2]);ring[3]=Math.max(.001,ring[3]);rings.push(ring);
 }
 rings.push(controls.at(-1));
 for(const [r,[z,y,rx,ry]]of rings.entries())for(let i=0;i<=segments;i++){
  const t=i/segments*Math.PI*2;positions.push(Math.cos(t)*rx,y+Math.sin(t)*ry,z);uvs.push(i/segments,r/(rings.length-1));
 }
 for(let r=0;r<rings.length-1;r++)for(let i=0;i<segments;i++){const a=r*(segments+1)+i,b=a+segments+1;indices.push(a,b,a+1,a+1,b,b+1);}
 for(const end of [0,rings.length-1]){const [z,y]=rings[end],center=positions.length/3;positions.push(0,y,z);uvs.push(.5,end?1:0);for(let i=0;i<segments;i++){const a=end*(segments+1)+i;indices.push(...(end?[center,a+1,a]:[center,a,a+1]));}}
 B.VertexData.ComputeNormals(positions,indices,normals);
 for(let r=0;r<rings.length;r++){const a=r*(segments+1)*3,b=a+segments*3,n=[0,1,2].map(k=>normals[a+k]+normals[b+k]),length=Math.hypot(...n)||1;for(let k=0;k<3;k++)normals[a+k]=normals[b+k]=n[k]/length;}
 return {positions,indices,normals,uvs};
}

// Stance occupies 62% of the cycle: the foot moves backward against travel at
// constant height. Only the recovery swing lifts it. Front and hind flexions
// have opposite signs, with a small resting bend to avoid a locked straight leg.
export function animalFootPose(phase,upper,lower,moving=1,end=1){
 const cycle=((phase/(2*Math.PI))%1+1)%1,stance=.62,swing=cycle>=stance,t=swing?(cycle-stance)/(1-stance):cycle/stance;
 const stride=(upper+lower)*.30,z=(swing?-1+2*(t*t*(3-2*t)):1-2*t)*stride*moving;
 const height=(upper+lower)*.965-(swing?Math.sin(t*Math.PI)*(upper+lower)*.16*moving:0);
 const reach=Math.min(Math.hypot(z,height),upper+lower-.00001),bend=(end<0?-1:1)*Math.acos(Math.max(-1,Math.min(1,(reach*reach-upper*upper-lower*lower)/(2*upper*lower))));
 return {hip:-Math.atan2(z,height)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend)),knee:bend,stance:!swing,z,height};
}
