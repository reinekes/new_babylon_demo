import {buildingKey,isOperational} from './definitions.js';
import {workplaceCapacity} from './professions.js';

const sides=[[0,-1],[1,0],[0,1],[-1,0]];
const positionKey=(x,y)=>`${x},${y}`;
const fieldOrder=(a,b)=>a.y-b.y||a.x-b.x;
const quarterTurn=b=>((b.rotation||0)%4+4)%4;
const isPlot=b=>b.type==='field'&&isOperational(b);
const patchCache=new WeakMap(),emptyPatches=new Map();

// Groups are derived from the saved plots. Separate seed deliveries, field IDs,
// water access and harvest provenance continue to belong to those plots.
export function fieldPatches(buildings){
 if(!buildings)return emptyPatches;
 const cached=patchCache.get(buildings);
 if(cached){
  let index=0,match=true;
  for(const b of buildings){
   if(!isPlot(b))continue;
   const snapshot=cached.plots[index++];
   if(!snapshot||snapshot.plot!==b||snapshot.x!==b.x||snapshot.y!==b.y||snapshot.rotation!==quarterTurn(b)||snapshot.id!==b.id){match=false;break;}
  }
  if(match&&index===cached.plots.length)return cached.patches;
 }
 const plots=buildings.filter(isPlot);
 const byPosition=new Map(plots.map(b=>[positionKey(b.x,b.y),b])),byPlot=new Map();
 for(const first of plots){
  if(byPlot.has(first))continue;
  const members=[first],seen=new Set(members);
  let left=first.x,right=first.x,top=first.y,bottom=first.y;
  for(const plot of members){
   left=Math.min(left,plot.x);right=Math.max(right,plot.x);
   top=Math.min(top,plot.y);bottom=Math.max(bottom,plot.y);
   for(const [dx,dy]of sides){
    const next=byPosition.get(positionKey(plot.x+dx,plot.y+dy));
    if(next&&!seen.has(next)){seen.add(next);members.push(next);}
   }
  }
  if(members.length>1)members.sort(fieldOrder);
  const lengthX=right-left,lengthY=bottom-top;
  const rotation=members.length===1?quarterTurn(first):lengthX===lengthY?quarterTurn(members[0])%2:Number(lengthX>lengthY);
  const group={id:buildingKey(members[0]),plots:members,rotation,slots:members.length*workplaceCapacity('field')};
  for(const plot of members){
   const joins=sides.map((_,i)=>{const [dx,dy]=sides[(i-rotation+4)%4];return byPosition.has(positionKey(plot.x+dx,plot.y+dy));});
   byPlot.set(plot,{group,joins,signature:`${rotation}:${joins.map(Number).join('')}`});
  }
 }
 patchCache.set(buildings,{patches:byPlot,plots:plots.map(plot=>({plot,x:plot.x,y:plot.y,rotation:quarterTurn(plot),id:plot.id}))});
 return byPlot;
}

// N/E/S/W are in field-local coordinates, with furrows running along Z.
export function fieldPatchLimits(joins,rim=2.9){
 const [north,east,south,west]=joins;
 return {left:west?-3:-rim,right:east?3:rim,near:north?-3:-rim,far:south?3:rim};
}
