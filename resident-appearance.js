// Work clues are game readability aids, not a claim of historical uniforms.
export function residentAppearance(c,buildings=[]){
 const work=buildings instanceof Map?buildings.get(c.work):buildings.find(b=>(b.id||`${b.x},${b.y}`)===c.work)?.type;
 const craft=c.role==='watercarrier'?'watercarrier':c.role==='tailor'?'tailor':work==='weaver'?'weaver':null,wear=c.clothing??100;
 return {craft,wear:wear>50?'new':wear>25?'worn':'ragged',patches:wear>50?0:wear>25?1:2,
  robe:wear<=25?'#9b927b':wear<=50?'#b6a88d':craft==='watercarrier'?'#668f9a':craft==='tailor'?'#bb8e6b':craft==='weaver'?'#7e9c97':c.robe||'#dfc99d'};
}
export function drawResidentClothes(r,p,q,look){
 const x=p.x,y=p.y,c=r.ctx;
 const poly=(pts,color)=>r.polygon(pts.map(([a,b])=>[x+a*q,y+b*q]),color);
 const line=(pts,color,w=.7)=>r.line(pts.map(([a,b])=>[x+a*q,y+b*q]),color,w*q);
 const edge=look.wear==='ragged'?[[-2.8,-2.8],[-1.8,-3.4],[-.7,-2.2],[.3,-3.1],[1.6,-2.3],[2.8,-3]]:[[-2.8,-2.6],[2.8,-2.6]];
 poly([[-1.9,-9.4],[1.9,-9.4],...edge.toReversed()],look.robe);
 line([[-1.7,-8.5],[1.8,-6.6],[-1.9,-4.5]],look.wear==='new'?'#f1e3be':'#94846c',.7);
 line([[-2.2,-5.8],[2.2,-5.8]],'#796047',.9);
 if(look.wear==='new'){line([[-2.4,-3.3],[2.4,-3.3]],'#f5e7c3',.65);for(let i=0;i<5;i++)line([[-1.9+i*.95,-3.2],[-1.9+i*.95,-2.5]],'#d1b68b',.45);}
 if(look.wear!=='new'){
  line([[-1.4,-7.4],[-.7,-6.9]],'#88775e',.6);line([[1,-4.3],[1.8,-3.8]],'#88775e',.6);
  for(let i=0;i<look.patches;i++){const a=i?1.1:-1.1,b=i?-4.1:-7;poly([[a-.8,b-.8],[a+.8,b-.6],[a+.7,b+.9],[a-.7,b+.7]],i?'#c5b68d':'#82775d');line([[a-.9,b-.4],[a-.4,b-.5],[a+.5,b-.3],[a+.9,b-.2]],'#e3d3ab',.4);}
 }
 if(look.craft==='tailor'){
  poly([[-1.2,-5.4],[1.3,-5.4],[1.7,-3],[-1.7,-3]],'#e2ca9c');line([[2,-5.7],[3.5,-5.2],[3.8,-3.8]],'#705b41',.7);
 }else if(look.craft==='weaver'){
  line([[-1.6,-8.8],[2.5,-4.5]],'#f0dfb4',1);c.fillStyle='#e7d9b4';c.beginPath();c.ellipse(x+2.8*q,y-4.8*q,1.1*q,1.6*q,-.3,0,7);c.fill();line([[2.8,-6.7],[2.8,-2.9]],'#7e6547',.5);
 }
}
