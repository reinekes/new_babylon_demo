const random=(x,y)=>{const n=Math.sin(x*127.1+y*311.7+73129)*43758.5453;return n-Math.floor(n);};

export function resourceDisplayLayout(deposit){
 const items=[],{kind,x,y}=deposit,angle=random(x+11,y+19)*Math.PI*2;
 const add=(u,v,i)=>{const jitter=.09,px=u+(random(x+i,y+29)-.5)*jitter,py=v+(random(x+41,y+i)-.5)*jitter;items.push({x:x+px,y:y+py,angle:angle+i*2.399,size:.75+random(x+i,y+71)*.48});};
 if(kind==='reed'||kind==='clay'||kind==='stone'){
  const count=kind==='reed'?15:7,spread=kind==='reed'?.36:.31;
  for(let i=0;i<count;i++){
   const a=i*2.399+angle,r=spread*Math.sqrt(i/(count-1));
   add(Math.cos(a)*r,Math.sin(a)*r*(kind==='reed'?.65:.82),i);
   items[i].size*=i===0&&kind!=='reed'?1.55:.76+random(x-i,y+27)*.28;
  }
 }
 else if(kind==='forest'||kind==='dates'){for(const [i,p]of [[-.21,-.12],[.19,-.14],[.04,.21]].entries())add(p[0],p[1],i);}
 return items;
}
