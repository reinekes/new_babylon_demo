const CARD_CLEARANCE=5,RAIL_SPACING=9,TIP_CLEARANCE=2;
const number=n=>Math.round(n*10)/10;
const distance=(a,b)=>Math.abs(a-b);

function measure(graph){
 const bounds=graph.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return null;
 const width=graph.clientWidth||bounds.width,height=graph.clientHeight||bounds.height;
 const scaleX=(graph.offsetWidth||bounds.width)/bounds.width,scaleY=(graph.offsetHeight||bounds.height)/bounds.height;
 const nodes=new Map(),levelMap=new Map();
 for(const node of graph.querySelectorAll('[data-production-node]')){
  const level=Number(node.closest('[data-production-level]')?.dataset.productionLevel);
  const rect=node.getBoundingClientRect();
  if(!Number.isInteger(level)||level<1||!rect.width||!rect.height)continue;
  const left=(rect.left-bounds.left)*scaleX-graph.clientLeft,top=(rect.top-bounds.top)*scaleY-graph.clientTop;
  const row=levelMap.get(level)??{level,top:Infinity,bottom:-Infinity,cards:[]};
  const card={left,right:left+rect.width*scaleX,top,bottom:top+rect.height*scaleY,
   column:Number(node.dataset.productionColumn)||0,row};
  nodes.set(node.dataset.productionNode,card);
  row.cards.push(card);row.top=Math.min(row.top,card.top);row.bottom=Math.max(row.bottom,card.bottom);
  levelMap.set(level,row);
 }
 const rows=[...levelMap.values()].sort((a,b)=>a.level-b.level);
 rows.forEach((row,index)=>{row.index=index;});
 return {width,height,nodes,rows};
}

function assignPorts(routes,atSource){
 const byCard=new Map(),at=atSource?'source':'target',other=atSource?'target':'source';
 for(const route of routes){
  const card=route[at],list=byCard.get(card)??[];
  list.push(route);byCard.set(card,list);
 }
 for(const [card,list] of byCard){
  list.sort((a,b)=>a[other].column-b[other].column||a[other].left-b[other].left||
   a[other].row.level-b[other].row.level||a.index-b.index);
  const width=card.right-card.left,inset=Math.min(15,width/4);
  const portOffset=atSource?6:-6;
  list.forEach((route,i)=>{
   route[atSource?'sx':'tx']=card.left+inset+(width-2*inset)*(i+1)/(list.length+1)+portOffset;
  });
 }
}

// Intersect the empty space of all intervening tiers. Leaving one tier's gutter
// is safe only when the corresponding vertical lane remains clear in every tier.
function gutterRails(rows,from,to,width){
 const blocked=rows.slice(from+1,to).flatMap(row=>row.cards.map(card=>[
  card.left-CARD_CLEARANCE,card.right+CARD_CLEARANCE
 ])).sort((a,b)=>a[0]-b[0]);
 const gaps=[];
 let left=CARD_CLEARANCE,hasCardBefore=false;
 const right=width-CARD_CLEARANCE;
 for(const [start,end] of blocked){
  if(end<left)continue;
  if(start>right)break;
  if(start>left)gaps.push([left,start,hasCardBefore]);
  left=Math.max(left,end);
  hasCardBefore=true;
 }
 if(left<right)gaps.push([left,right,false]);
 const usable=gaps.filter(([a,b])=>b-a>=1);
 const internal=usable.filter(([, ,betweenCards])=>betweenCards);
 // Prefer passages between columns; use an outer margin only if the crossed
 // tiers have no internal passage wide enough for a stroke.
 return (internal.length?internal:usable).flatMap(([a,b])=>{
  const count=Math.max(1,Math.floor((b-a)/RAIL_SPACING));
  return Array.from({length:count},(_,i)=>a+(b-a)*(i+1)/(count+1));
 });
}

function chooseRails(routes,{rows,width}){
 const used=[],candidates=new Map();
 for(const route of routes){
  const from=route.source.row.index,to=route.target.row.index;
  if(to===from+1)continue;
  const key=`${from}:${to}`;
  if(!candidates.has(key))candidates.set(key,gutterRails(rows,from,to,width));
  const midpoint=(route.sx+route.tx)/2;
  let bestScore=Infinity;
  for(const x of candidates.get(key)){
   const occupied=used.filter(other=>from<other.to&&other.from<to&&distance(x,other.x)<RAIL_SPACING);
   const score=distance(x,route.sx)+distance(x,route.tx)+distance(x,midpoint)*.08+occupied.length*width;
   if(score<bestScore){bestScore=score;route.rail=x;}
  }
  if(route.rail!==undefined)used.push({from,to,x:route.rail});
 }
}

function routePaths(svg,layout){
 const {width,height,nodes,rows}=layout;
 svg.setAttribute('viewBox',`0 0 ${width} ${height}`);
 const paths=[...svg.querySelectorAll('path[data-from][data-to]')];
 const routes=paths.flatMap((path,index)=>{
  const source=nodes.get(path.dataset.from),target=nodes.get(path.dataset.to);
  return source&&target&&source.row.index<target.row.index?[{path,index,source,target}]:[];
 });
 assignPorts(routes,true);assignPorts(routes,false);chooseRails(routes,layout);
 const bands=rows.slice(1).map(()=>[]);
 function queue(route,band,from,to,field){
  bands[band].push({route,field,left:Math.min(from,to),right:Math.max(from,to)});
 }
 for(const route of routes){
  const from=route.source.row.index,to=route.target.row.index;
  if(to===from+1)queue(route,from,route.sx,route.tx,'y1');
  else if(route.rail!==undefined){
   queue(route,from,route.sx,route.rail,'y1');
   queue(route,to-1,route.rail,route.tx,'y2');
  }
 }
 bands.forEach((items,index)=>{
  const top=rows[index].bottom,bottom=rows[index+1].top;
  if(bottom<top+8)return;
  const lanes=[];
  // Reuse a lane when the horizontal spans are disjoint. Only overlapping
  // spans need separate tracks; this keeps busy rows compact.
  items.sort((a,b)=>a.left-b.left||a.right-b.right||a.route.index-b.route.index);
  for(const item of items){
   const slot=lanes.findIndex(right=>right+CARD_CLEARANCE<=item.left);
   item.lane=slot<0?lanes.length:slot;
   lanes[item.lane]=item.right;
  }
  const pad=Math.min(8,(bottom-top)/4);
  for(const item of items)item.route[item.field]=top+pad+(bottom-top-2*pad)*(item.lane+1)/(lanes.length+1);
 });
 const results=new Map();
 for(const route of routes){
  const {path,source,target,sx,tx,y1,y2,rail}=route;
  if(y1===undefined||(rail===undefined?target.row.index-source.row.index!==1:y2===undefined))continue;
  const tip=number(target.top-TIP_CLEARANCE);
  const middle=rail===undefined?'':` H${number(rail)} V${number(y2)}`;
  results.set(path,`M${number(sx)} ${number(source.bottom+1)} V${number(y1)}${middle} H${number(tx)} V${tip}`);
 }
 for(const path of paths){
  const d=results.get(path);
  if(d===undefined)path.removeAttribute('d');
  else if(path.getAttribute('d')!==d)path.setAttribute('d',d);
 }
}

/** The graph and SVG share one scroll plane; scrolling requires no remeasurement. */
export function mountProductionGraph(graph){
 const svg=graph?.querySelector('svg[data-production-edges]');
 const win=graph?.ownerDocument?.defaultView;
 if(!svg||!win)return ()=>{};
 const request=win.requestAnimationFrame?.bind(win)||win.setTimeout.bind(win);
 const cancel=win.cancelAnimationFrame?.bind(win)||win.clearTimeout.bind(win);
 const dialog=graph.closest('dialog');
 let frame=null,disposed=false;
 const schedule=()=>{
  if(disposed||frame!==null)return;
  frame=request(()=>{
   frame=null;
   if(!graph.isConnected){cleanup();return;}
   const layout=measure(graph);
   if(layout)routePaths(svg,layout);
  });
 };
 const observer=win.ResizeObserver?new win.ResizeObserver(schedule):null;
 const onClose=()=>{if(!dialog.open)cleanup();};
 function cleanup(){
  if(disposed)return;
  disposed=true;
  if(frame!==null)cancel(frame);
  observer?.disconnect();
  if(!observer)win.removeEventListener('resize',schedule);
  dialog?.removeEventListener('close',onClose);
 }
 if(observer){
  observer.observe(graph);
  for(const element of graph.querySelectorAll('[data-production-level],[data-production-node]'))observer.observe(element);
 }else win.addEventListener('resize',schedule);
 dialog?.addEventListener('close',onClose);
 graph.ownerDocument.fonts?.ready?.then(schedule,()=>{});
 schedule();
 return cleanup;
}
