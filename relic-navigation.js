// Possession has its own walking graph. Removing one explicitly selected oasis
// from this read-only navigation view permits wading there, never in the river
// or another lake. Ordinary worker navigation and the saved world are unchanged.
import {networkFor} from './workforce.js';
import {createWalkingNetwork,nearestWalkingNode,navigationSegmentClear,shortestWalkingPath} from './navigation.js';
import {isDryPoint} from './world.js';
const cache=new WeakMap(),distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function relicNavigation(s,q){
 const base=networkFor(s),lake=q?.site?.lakeId&&s.world?.lakes?.find(l=>l.id===q.site.lakeId);
 if(!lake)return {state:s,network:base};
 const old=cache.get(s);if(old?.base===base&&old.lake===lake)return old;
 const state={...s,world:{...s.world,lakes:s.world.lakes.filter(l=>l!==lake)}},network=createWalkingNetwork(state,base),value={base,lake,state,network};cache.set(s,value);return value;
}
export function relicSegmentClear(s,q,a,b){const nav=relicNavigation(s,q);return navigationSegmentClear(nav.state,a,b,nav.network.navigation?.obstacles);}
function anchor(nav,p){
 const near=nearestWalkingNode(nav.network,p);if(near&&distance(near,p)<1e-8)return near;
 return [...nav.network.nodes.values()].filter(n=>distance(n,p)<=1.6).sort((a,b)=>distance(a,p)-distance(b,p)).find(n=>navigationSegmentClear(nav.state,p,n,nav.network.navigation?.obstacles))||null;
}
export function relicPathTo(s,q,c,target){
 const nav=relicNavigation(s,q);if(!navigationSegmentClear(nav.state,target,target,nav.network.navigation?.obstacles))return null;
 const from=anchor(nav,c),to=anchor(nav,target);if(!from||!to)return null;
 const nodes=shortestWalkingPath(nav.network,from.key,to.key);if(!nodes)return null;
 const route=[{x:c.x,y:c.y},...nodes.map(p=>({x:p.x,y:p.y}))];
 if(distance(route.at(-1),target)>1e-8){if(!navigationSegmentClear(nav.state,route.at(-1),target,nav.network.navigation?.obstacles))return null;route.push({x:target.x,y:target.y});}return route;
}
export function relicExitRoute(s,q,c){
 if(isDryPoint(s,c.x,c.y))return [{x:c.x,y:c.y}];
 const dry=[...networkFor(s).nodes.values()].filter(n=>isDryPoint(s,n.x,n.y)).sort((a,b)=>distance(a,c)-distance(b,c)||a.y-b.y||a.x-b.x);
 for(const target of dry){const route=relicPathTo(s,q,c,target);if(route)return route;}return null;
}
export function relicSwimming(s,q,c){return !!q?.site?.lakeId&&!isDryPoint(s,c.x,c.y)&&!!s.world?.lakes?.find(l=>l.id===q.site.lakeId)?.cells.some(p=>Math.abs(c.x-p.x)<.51&&Math.abs(c.y-p.y)<.51);}
