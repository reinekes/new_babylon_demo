// Pure presentation. Never changes simulation tasks, routes, cargo or residents.
export function residentPose(person,craft,time=0,reduce=false){
 const beat=reduce?0:Math.sin(time*3.5+(Number(person.id)||0)*1.7);
 if(person.mourningTorch||person.guarding)return {kind:'walk',beat};
 if(person.celebrating)return {kind:'dance',beat};
 if(person.phase==='unloading'&&person.carrying)return {kind:'unload',beat};
 if(person.carrying||person.waterTrip?.load>0)return {kind:'carry',beat};
 if(person.walking)return {kind:'walk',beat};
 if(person.playing)return {kind:'play',beat};
 if(person.phase==='working')return {kind:craft==='brewery'?'stir':craft==='weaver'?'weave':['brickyard','clay','pottery'].includes(craft)?'mould':['field','garden','reed'].includes(craft)?'harvest':'work',beat};
 return {kind:person.age>=55?'elder':'idle',beat};
}
export function drawActorGesture(r,p,q,person,pose){
 const line=(pts,color,w=1)=>r.line(pts.map(([a,b])=>[p.x+a*q,p.y+b*q]),color,w*q),skin='#b48c65',n=pose.beat;
 if(pose.kind==='dance'){line([[-2,-7],[-4,-9-n],[-6,-8-n]],skin,1.3);line([[2,-7],[4,-9+n],[6,-8+n]],skin,1.3);}
 else if(pose.kind==='weave'){
  line([[-2,-7],[-4,-5],[2+n,-6]],skin,1.3);line([[2,-7],[4,-5],[-1+n,-4.7]],skin,1.3);line([[-2+n,-5],[3+n,-7]],'#e7d7af',1.5);
 }else if(pose.kind==='mould'){
  line([[-2,-7],[-3,-4.5],[n*.6,-3.8]],skin,1.4);line([[2,-7],[4,-4],[1+n*.6,-3.5]],skin,1.4);r.box(p.x+n*.6*q,p.y-2*q,2.3*q,1.1*q,2*q,'#bf936c','#8d6f51','#a9815d');
 }else if(pose.kind==='harvest'){
  line([[-2,-7],[-4,-4],[1,-3+n]],skin,1.3);line([[2,-7],[4,-5],[5,-7+n]],skin,1.3);line([[4,-6+n],[6,-9+n],[8,-8+n]],'#bba983',.9);
 }else if(pose.kind==='stir'){
  line([[-2,-7],[-3,-5],[2+n*.7,-5]],skin,1.3);line([[2,-7],[4,-6],[3+n*.7,-4]],skin,1.3);line([[3+n*.7,-9],[1+n*.4,1]],'#80674c',1.1);line([[.5+n*.4,0],[2+n*.4,1]],'#c5a67a',1.7);
 }else if(pose.kind==='unload'){
  const bend=(n+1)*.5;line([[-2,-7],[-3,-5],[2,-3+bend]],skin,1.3);line([[2,-7],[5,-5],[6,-3+bend]],skin,1.3);
 }else if(pose.kind==='carry'){
  line([[-2,-7],[-3,-6],[-1,-4]],skin,1.3);line([[2,-7],[4,-8],[5,-6]],skin,1.3);
 }else if(pose.kind==='play'){
  line([[-2,-7],[-4,-7-n],[-5,-9-n]],skin,1);line([[2,-7],[4,-5+n]],skin,1);
 }else if(pose.kind==='elder'){
  line([[2,-7],[4,-5],[5,-7]],skin,1.3);line([[5,-8],[5,1]],'#846e50',.9);line([[-.8,-10],[1,-8.4],[.6,-7.8]],'#dad6c2',1.1);
 }
}
