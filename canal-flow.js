// Each watered field consumes one share along an unbroken route back to a
// river intake. Recomputing paths against residual capacity lets a second
// intake supply a field even when its nearest branch has filled.
export function allocateCanalWater({adjacent,heads,capacity,fields,intakeLimits=new Map()}){
 const residual=new Map(capacity),intakes=new Set(heads),intakeRemaining=new Map(intakeLimits);
 const routes=new Map(),distance=new Map(),frontier=[...intakes].sort();
 for(const id of frontier)distance.set(id,0);
 for(let i=0;i<frontier.length;i++){
  const from=frontier[i];
  for(const to of adjacent.get(from)||[]){
   if(distance.has(to))continue;
   distance.set(to,distance.get(from)+1);
   frontier.push(to);
  }
 }
 const nearest=entries=>Math.min(...entries.map(id=>distance.get(id)??Infinity));
 const order=[...fields].sort(([a,left],[b,right])=>nearest(left)-nearest(right)||a.localeCompare(b));
 for(const [field,entries] of order){
  const queue=entries.filter(id=>(residual.get(id)||0)>=1).sort(),parent=new Map(queue.map(id=>[id,null]));
  let head=null;
  for(let i=0;i<queue.length;i++){
   const from=queue[i];
   if(intakes.has(from)&&(intakeRemaining.get(from)??Infinity)>=1){head=from;break;}
   for(const to of adjacent.get(from)||[]){
    if(parent.has(to)||(residual.get(to)||0)<1)continue;
    parent.set(to,from);
    queue.push(to);
   }
  }
  if(head===null)continue;
  if(intakeRemaining.has(head))intakeRemaining.set(head,intakeRemaining.get(head)-1);
  const path=[];
  for(let id=head;id!==null;id=parent.get(id)){
   residual.set(id,residual.get(id)-1);
   path.push(id);
  }
  routes.set(field,path);
 }
 return {routes,residual,intakeRemaining};
}
