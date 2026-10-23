// Render-only age anatomy. Save identities and economic collision positions never change.
export function residentAnatomy(age=24){
 const a=Math.max(0,Math.min(100,Number(age)||0));
 // Smooth stature through puberty; three separately bound meshes describe growth.
 const height=a<10?.55+a*.024:a<16?.79+(a-10)*.035:1;
 return {source:a<10?'child':a<16?'adolescent':'adult',scale:height};
}
