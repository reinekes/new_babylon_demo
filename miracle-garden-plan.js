const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const noise=i=>{const n=Math.sin(i*127.1+71.7)*43758.5453;return n-Math.floor(n);};
// A transient visual plan. No saved residents, resource quantities or world cells.
export function miracleGardenPlan(center,radius=2){
 const r=clamp(Number(radius)||2,1,6),out=[];
 const put=(kind,x,y,scale=1,delay=0)=>{const i=out.length;out.push({kind,x:center.x+x*r,y:center.y+y*r,scale:scale*({grass:2.2,daisy:1.8,snowdrop:1.8,lilac:1.4,birch:1,cactus:1.5}[kind]),delay,angle:noise(i+7)*Math.PI*2,variant:Math.floor(noise(i+33)*3)});};
 // A low carpet beneath contrasting white bells and gold-hearted daisies.
 for(let i=0;i<76;i++){const a=i*2.39996323,d=Math.sqrt((i+.5)/76)*.87;put('grass',Math.cos(a)*d,Math.sin(a)*d,.9+noise(i)*.65,d*1.7);}
 for(let i=0;i<58;i++){const a=i*2.39996323+.5,d=Math.sqrt((i+.5)/58)*.78;put(i%3?'daisy':'snowdrop',Math.cos(a)*d,Math.sin(a)*d,1+noise(i+100)*.55,.6+d*2.5);}
 for(let i=0;i<4;i++){const a=i*Math.PI/2+.6;put('lilac',Math.cos(a)*.66,Math.sin(a)*.66,.8+noise(i+200)*.25,2+i*.12);}
 put('birch',-.16,-.17,1,1.8);
 for(let i=0;i<9;i++){const a=i*Math.PI*2/9;put('cactus',Math.cos(a)*.96,Math.sin(a)*.96,.8+noise(i+300)*.35,1.3+i*.1);}
 return out;
}
