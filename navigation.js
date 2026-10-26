import {WIDTH,HEIGHT,isDryPoint,onBridge,bridgeSpan} from './world.js';
import {footprintSize} from './footprints.js';

const pointKey=(x,y)=>`${x+.5},${y+.5}`;
const pairKey=(a,b)=>`${a}>${b}`;
const EPS=1e-8;
export function navigationDistance(route){let d=0;for(let i=1;i<(route?.length||0);i++)d+=Math.hypot(route[i].x-route[i-1].x,route[i].y-route[i-1].y);return d;}
export function navigationGridStep(a,b){const dx=Math.abs(a.x-b.x),dy=Math.abs(a.y-b.y);return dx+dy>EPS&&(dx<EPS||Math.abs(dx-1)<EPS)&&(dy<EPS||Math.abs(dy-1)<EPS);}
function solidBounds(b){const n=footprintSize(b);return {minX:b.x-.47,maxX:b.x+n-.53,minY:b.y-.47,maxY:b.y+n-.53};}
function intersectsBox(a,b,r){
 let lo=0,hi=1;
 for(const [start,delta,min,max]of [[a.x,b.x-a.x,r.minX,r.maxX],[a.y,b.y-a.y,r.minY,r.maxY]]){
  if(Math.abs(delta)<EPS){if(start<=min||start>=max)return false;continue;}
  let t0=(min-start)/delta,t1=(max-start)/delta;if(t0>t1)[t0,t1]=[t1,t0];lo=Math.max(lo,t0);hi=Math.min(hi,t1);if(lo>=hi-EPS)return false;
 }
 return hi>EPS&&lo<1-EPS;
}
function obstacleIndex(s){
 const cells=new Map();for(const b of s.buildings||[]){if(['road','bridge'].includes(b.type))continue;const bounds=solidBounds(b);
  for(let y=Math.floor(bounds.minY);y<=Math.ceil(bounds.maxY);y++)for(let x=Math.floor(bounds.minX);x<=Math.ceil(bounds.maxX);x++){const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(bounds);}
 }return cells;
}
function localObstacles(index,a,b=a){const found=new Set();for(let y=Math.floor(Math.min(a.y,b.y));y<=Math.ceil(Math.max(a.y,b.y));y++)for(let x=Math.floor(Math.min(a.x,b.x));x<=Math.ceil(Math.max(a.x,b.x));x++)for(const box of index.get(`${x},${y}`)||[])found.add(box);return found;}
export function navigationSegmentClear(s,a,b,index=obstacleIndex(s)){
 const length=Math.hypot(b.x-a.x,b.y-a.y),steps=Math.max(4,Math.ceil(length/.1)),horizontal=Math.abs(a.y-b.y)<EPS;
 for(let i=0;i<=steps;i++){const t=i/steps,x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;if(!isDryPoint(s,x,y)&&!(horizontal&&onBridge(s.buildings||[],x,y)))return false;}
 for(const box of localObstacles(index,a,b))if(intersectsBox(a,b,box))return false;return true;
}
function speedFor(s,a,b,roads){
 const road=roads.get(pairKey(a.key,b.key)),roadFactor=1+((road?.level||1)-1)*.2;
 const bridge=(s.buildings||[]).find(v=>v.type==='bridge'&&v.construction?.kind!=='new'&&Math.abs(a.y-bridgeSpan(v.y).y)<EPS&&Math.abs(b.y-a.y)<EPS&&onBridge([v],(a.x+b.x)/2,a.y));
 return roadFactor*(bridge?1+((bridge.level||1)-1)*.25:1);
}
function roadLookup(s){const roads=new Map();for(const r of s.roads||[]){if(!r.a||!r.b)continue;const a=r.a.key||pointKey(r.a.x,r.a.y),b=r.b.key||pointKey(r.b.x,r.b.y);roads.set(pairKey(a,b),r);roads.set(pairKey(b,a),r);}return roads;}
export function navigationTravelCost(s,route){const roads=roadLookup(s);let n=0;for(let i=1;i<(route?.length||0);i++){const a=route[i-1],b=route[i];n+=Math.hypot(b.x-a.x,b.y-a.y)/speedFor(s,a,b,roads);}return n;}

// Streets still own only their actual built segments. Walking gets a separate
// dry-land graph; diagonal shortcuts never manufacture free diagonal roads.
export function createWalkingNetwork(s,streets){
 const nodes=new Map(),graph=new Map(),costs=new Map(),index=obstacleIndex(s),roads=roadLookup(s),bridges=(s.buildings||[]).filter(b=>b.type==='bridge'&&b.construction?.kind!=='new');
 for(let y=0;y<=HEIGHT;y++)for(let x=0;x<=WIDTH;x++){
  const p={x:x-.5,y:y-.5,key:`${x},${y}`};if(!isDryPoint(s,p.x,p.y)&&!onBridge(bridges,p.x,p.y))continue;
  if([...localObstacles(index,p)].some(r=>p.x>r.minX&&p.x<r.maxX&&p.y>r.minY&&p.y<r.maxY))continue;nodes.set(p.key,p);graph.set(p.key,new Set());
 }
 let maxSpeed=1;
 const connect=(a,b)=>{const speed=speedFor(s,a,b,roads),cost=Math.hypot(b.x-a.x,b.y-a.y)/speed;maxSpeed=Math.max(maxSpeed,speed);graph.get(a.key).add(b.key);graph.get(b.key).add(a.key);costs.set(pairKey(a.key,b.key),cost);costs.set(pairKey(b.key,a.key),cost);};
 for(const a of nodes.values())for(const [dx,dy]of [[1,0],[0,1]]){const b=nodes.get(pointKey(a.x+dx,a.y+dy));if(b&&navigationSegmentClear(s,a,b,index))connect(a,b);}
 for(const a of nodes.values())for(const [dx,dy]of [[1,1],[-1,1]]){
  const b=nodes.get(pointKey(a.x+dx,a.y+dy)),sideX=nodes.get(pointKey(a.x+dx,a.y)),sideY=nodes.get(pointKey(a.x,a.y+dy));if(!b||!sideX||!sideY)continue;
  // All four cardinal sides must be walkable. This prevents squeezing around a
  // wet/occupied corner even if the mathematical diagonal misses its centre.
  if(!graph.get(a.key).has(sideX.key)||!graph.get(a.key).has(sideY.key)||!graph.get(b.key).has(sideX.key)||!graph.get(b.key).has(sideY.key))continue;
  if(navigationSegmentClear(s,a,b,index))connect(a,b);
 }
 const components=new Map();let component=0;for(const key of nodes.keys()){if(components.has(key))continue;const queue=[key];components.set(key,component);for(let i=0;i<queue.length;i++)for(const next of graph.get(queue[i]))if(!components.has(next)){components.set(next,component);queue.push(next);}component++;}
 return {...streets,nodes,graph,components,navigation:{costs,maxSpeed,obstacles:index}};
}
class MinHeap{
 constructor(){this.items=[];this.order=0;}
 push(key,priority,cost){const item={key,priority,cost,order:this.order++},a=this.items;a.push(item);let i=a.length-1;while(i>0){const p=(i-1)>>1;if(!this.before(item,a[p]))break;a[i]=a[p];i=p;}a[i]=item;}
 before(a,b){return a.priority<b.priority-EPS||Math.abs(a.priority-b.priority)<EPS&&a.order<b.order;}
 pop(){const a=this.items,first=a[0],tail=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let next=i*2+1;if(next+1<a.length&&this.before(a[next+1],a[next]))next++;if(!this.before(a[next],tail))break;a[i]=a[next];i=next;}a[i]=tail;}return first;}
}
export function shortestWalkingPath(network,from,to){
 if(!from||!to||!network.nodes.has(from)||!network.nodes.has(to)||network.components.get(from)!==network.components.get(to))return null;
 const goal=network.nodes.get(to),heuristic=key=>{const p=network.nodes.get(key);return Math.hypot(goal.x-p.x,goal.y-p.y)/(network.navigation?.maxSpeed||1);},open=new MinHeap(),costs=new Map([[from,0]]),previous=new Map([[from,null]]);open.push(from,heuristic(from),0);
 while(open.items.length){const current=open.pop();if(current.cost>(costs.get(current.key)??Infinity)+EPS)continue;
  if(current.key===to){const path=[];for(let key=to;key!==null;key=previous.get(key))path.push(network.nodes.get(key));return path.reverse();}
  for(const next of network.graph.get(current.key)||[]){const a=network.nodes.get(current.key),b=network.nodes.get(next),cost=current.cost+(network.navigation?.costs.get(pairKey(current.key,next))??Math.hypot(b.x-a.x,b.y-a.y));if(cost>=(costs.get(next)??Infinity)-EPS)continue;costs.set(next,cost);previous.set(next,current.key);open.push(next,cost+heuristic(next),cost);}
 }return null;
}
export function nearestWalkingNode(network,p){
 let best=null,distance=Infinity;
 const test=q=>{if(!q)return;const d=Math.hypot(p.x-q.x,p.y-q.y);if(d<distance-EPS){best=q;distance=d;}};
 const x=Math.round(p.x+.5),y=Math.round(p.y+.5);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)test(network.nodes.get(`${x+dx},${y+dy}`));
 if(best)return best;for(const q of network.nodes.values())test(q);return best;
}
