// One indexed mesh per parcel. A warehouse, pack train and boat instance the same source.
const turn=2*Math.PI;

export function createHandmadeParcel(B,scene,kind){
 const positions=[],normals=[],indices=[],colors=[],uvs=[];
 const palette=new Map();
 function vertex(x,y,z,hex,tone,u,v){
  if(!palette.has(hex))palette.set(hex,B.Color3.FromHexString(hex));
  const c=palette.get(hex);
  const index=positions.length/3;
  positions.push(x,y,z);colors.push(c.r*tone,c.g*tone,c.b*tone,1);uvs.push(u,v);
  return index;
 }
 function stitch(a,b,c,d){indices.push(a,b,d,b,c,d);}
 // path returns a centre and two oriented half-axes of the section, in metres.
 function strand(steps,sides,path,colour,grain=0){
  const start=positions.length/3;
  for(let i=0;i<=steps;i++){
   const t=i/steps,[p,w,h]=path(t),tone=.98+.035*Math.sin(turn*(3*t+grain));
   for(let j=0;j<sides;j++){
    const a=turn*j/sides,c=Math.cos(a),s=Math.sin(a);
    vertex(p[0]+w[0]*c+h[0]*s,p[1]+w[1]*c+h[1]*s,p[2]+w[2]*c+h[2]*s,colour,tone,t,j/sides);
   }
  }
  for(let i=0;i<steps;i++)for(let j=0;j<sides;j++){
   const k=start+i*sides,after=(j+1)%sides;
   stitch(k+j,k+j+sides,k+after+sides,k+after);
  }
 }
 const rim=(angle,y,radius)=>{
  const x=Math.cos(angle),z=Math.sin(angle);
  const warp=1+.012*Math.cos(angle*3+.7)+.008*Math.sin(angle*5);
  return [x*radius*warp,y,z*radius*.82*warp];
 };
 function basket(){
  const radius=t=>.196+.119*Math.sin(t*1.37);
  const baseY=.018,height=.308,reed=['#b99359','#bd9e6c','#a88b60','#c3a77a'];
  for(let n=0;n<13;n++){
   const t=(n+.45)/13;
   strand(48,4,f=>{
    const a=turn*f,wave=Math.cos(12*a+n*Math.PI);
    const p=rim(a,baseY+t*height+.0018*Math.sin(3*a+n*.55),radius(t)+.006*wave);
    return [p,[.007*Math.cos(a),0,.007*Math.sin(a)],[0,.015,0]];
   },reed[n%reed.length],n/11);
  }
  for(let n=0;n<24;n++){
   const a0=turn*n/24;
   strand(19,4,t=>{
    const a=a0+.026*Math.sin(Math.PI*t),r=radius(t)-.003*Math.cos(t*13*Math.PI+n*Math.PI);
    return [rim(a,baseY+t*height,r),[.005*Math.cos(a),0,.005*Math.sin(a)],[-.0092*Math.sin(a),0,.0092*Math.cos(a)]];
   },reed[(n+1)%reed.length],n/24);
  }
  for(const t of [0,1])strand(48,6,f=>{
   const a=turn*f,p=rim(a,baseY+t*height,radius(t));
   return [p,[.013*Math.cos(a),0,.013*Math.sin(a)],[0,.0125,0]];
  },'#a9875b');
  // Cross-laid splits form the bottom visible through the mouth, and under the parcel.
  for(const transverse of [false,true])for(let n=-7;n<=7;n++){
   const v=n/7.9,span=.196*Math.sqrt(1-v*v),offset=.196*v;
   strand(3,4,t=>{
    const along=(2*t-1)*span,arch=.004*Math.sin(Math.PI*t);
    return transverse
     ?[[offset,.018+arch,along*.82],[.0125,0,0],[0,.004,0]]
     :[[along,.012+arch,offset*.82],[0,0,-.0115],[0,.004,0]];
   },reed[(n+8)%4]);
  }
 }
 function mat(){
  const fibres=['#ba9a66','#ab8959','#c9aa74','#b69b71'];
  for(const [roll,centre] of [-.152,.151].entries()){
   const radius=roll?.121:.138,cy=radius+.003;
   // Cut ends vary slightly and show the hollows between the outer culms.
   for(let n=0;n<27;n++){
    const a=turn*n/27,angle=a+.006*Math.sin(n*5),length=.52+.014*Math.cos(n*3+roll);
    const y=cy+radius*.92*Math.cos(angle),x=centre+radius*.92*Math.sin(angle);
    strand(2,6,t=>[[x,y+.003*Math.sin(Math.PI*t),length*(t-.5)],[.0145,0,0],[0,.0145,0]],fibres[(n+roll)%4],n/27);
   }
   for(const side of [-1,1]){
    strand(68,4,t=>{
     const a=turn*2.15*t,r=radius*(.10+.78*t);
     return [[centre+r*Math.cos(a),cy+r*Math.sin(a),side*.261],
      [.018*Math.cos(a),.018*Math.sin(a),0],[0,0,.008*side]];
    },fibres[2-roll]);
   }
   for(const z of [-.164,.164])for(const offset of [-.008,.008]){
    strand(32,5,t=>{
     const a=turn*t,x=Math.cos(a),y=Math.sin(a);
     return [[centre+(radius+.002)*x,cy+(radius+.002)*y,z+offset+.002*Math.sin(3*a)],
      [.0036*x,.0036*y,0],[0,0,.0048]];
    },'#846845');
   }
  }
 }
 function clay(){
  // Moist kneaded clay has broad thumb flats and soft fractures where cakes touch.
  const cakes=[[-.147,.002,-.096,.184,.118,.164], [.17,.002,-.108,.151,.093,.151],
   [.097,.001,.139,.205,.112,.117], [-.142,.091,.064,.159,.097,.139]];
  const levels=[[.80,0],[.97,.10],[1,.33],[.98,.62],[.87,.85],[.69,.96],[.43,1],[.17,.985]];
  for(const [k,[cx,cy,cz,rx,ry,rz]] of cakes.entries()){
   const start=positions.length/3,segments=32;
   for(const [y,[radius,height]] of levels.entries())for(let i=0;i<segments;i++){
    const a=i*turn/segments,cos=Math.cos(a),sin=Math.sin(a);
    const rough=1+.079*Math.sin(3*a+k*1.7)+.039*Math.sin(7*a+y*.58+k)+.014*Math.cos(11*a-k);
    const x=radius*Math.sign(cos)*Math.pow(Math.abs(cos),.74)*rough;
    const z=radius*Math.sign(sin)*Math.pow(Math.abs(sin),.78)*rough;
    // Finger hollows and a torn edge are spread over the top of the kneaded mass.
    const thumb=Math.exp(-((x+.25)**2/.044+(z-.21)**2/.22));
    const shear=Math.exp(-((x-.32)**2/.022+(z+.24)**2/.18));
    const h=height*(1-.12*thumb-.075*shear)+Math.min(height,1-height)*.05*Math.sin(5*a+k);
    const shade=.87+.10*height+.03*Math.sin(7*a+y*.64+k);
    const u=.25+.21*x,v=.62+.11*z-.03*(1-height);
    vertex(cx+rx*x,cy+ry*h,cz+rz*z,'#f0f2ec',shade,u,v);
   }
   for(let y=0;y<levels.length-1;y++)for(let i=0;i<segments;i++){
    const row=start+y*segments,next=(i+1)%segments;
    stitch(row+i,row+next,row+segments+next,row+segments+i);
   }
   for(let i=1;i<segments-1;i++){
    indices.push(start,start+i+1,start+i);
    const top=start+(levels.length-1)*segments;indices.push(top,top+i,top+i+1);
   }
  }
 }
 if(kind==='basket')basket();else if(kind==='mat')mat();else clay();
 B.VertexData.ComputeNormals(positions,indices,normals);
 const data=new B.VertexData(),mesh=new B.Mesh('goods-source-'+kind,scene);
 Object.assign(data,{positions,indices,normals,uvs,colors});data.applyToMesh(mesh);
 return mesh;
}
