import {WIDTH, HEIGHT, river, bridgeSpan, isDryPoint} from './world.js';

export const DAY_SECONDS = 60;
export const seed = (x, y = 0) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const keyOf = (x, y) => `${x},${y}`;
const at = (x, y) => ({x: x - .5, y: y - .5, key: keyOf(x, y)});
const dry = (p,s) => isDryPoint(s,p.x,p.y);

function pathTo(start, target, neighbours) {
  const queue = [start], previous = new Map([[start, null]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (target(current)) {
      const path = [];
      for (let p = current; p !== null; p = previous.get(p)) path.push(p);
      return path.reverse();
    }
    for (const next of neighbours(current)) {
      if (!previous.has(next)) { previous.set(next, current); queue.push(next); }
    }
  }
  return null;
}

// Streets use tile boundaries: a house can grow on a tile without erasing its road.
// Each riverbank has its own network; roads never invent a crossing over water.
export function generateStreets(buildings,s) {
  const nodes = new Map(), land = new Map(), graph = new Map(), edges = [];
  const bridgeNodes=new Set(),bridgeEdges=new Set();
  for(const b of buildings.filter(b=>b.type==='bridge'&&b.construction?.kind!=='new')){
    const span=bridgeSpan(b.y),from=span.left+.5,to=span.right+.5;
    for(let x=from;x<=to;x++){const key=keyOf(x,span.keyY);bridgeNodes.add(key);if(x<to){const next=keyOf(x+1,span.keyY);bridgeEdges.add(`${key}|${next}`);bridgeEdges.add(`${next}|${key}`);}}
  }
  for (let y = 0; y <= HEIGHT; y++) for (let x = 0; x <= WIDTH; x++) {
    const p = at(x, y);
    if (dry(p,s)||bridgeNodes.has(p.key)) land.set(p.key, p);
  }
  const neighbours = key => {
    const [x, y] = key.split(',').map(Number), result = [];
    for (const [dx, dy] of [[1,0],[0,1],[-1,0],[0,-1]]) {
      const p = land.get(keyOf(x + dx, y + dy)), a = land.get(key);
      if (p && (bridgeEdges.has(`${key}|${p.key}`)||[.25,.5,.75].every(t => dry({x:a.x+(p.x-a.x)*t,y:a.y+(p.y-a.y)*t},s)))) result.push(p.key);
    }
    return result;
  };
  // Both bridge banks get approaches, even while the crossing is closed.
  const approaches=buildings.filter(b=>b.type==='bridge').flatMap(b=>{const span=bridgeSpan(b.y);return [span.left,span.right].map((x,i)=>({type:'approach',x:x-.5,y:b.y,siteKey:`${b.x},${b.y}`,side:i}));});
  const roadBuildings=[...buildings.filter(b=>b.type!=='bridge'),...approaches];
  const ports = [];
  const root=roadBuildings.find(b=>b.type==='shrine')||roadBuildings[0];
  const ordered=root?[root,...roadBuildings.filter(b=>b!==root)]:[];
  for (const b of ordered) {
    const corners = [[b.x+1,b.y+1],[b.x,b.y+1],[b.x+1,b.y],[b.x,b.y]];
    const port = corners.map(([x,y]) => land.get(keyOf(x,y))).find(Boolean);
    if (!port) continue;
    ports.push({...port, building:b});
    const path = pathTo(port.key, key => nodes.has(key), neighbours);
    if (!path) { nodes.set(port.key, port); graph.set(port.key, new Set()); continue; }
    for (let i = 0; i < path.length; i++) {
      const key = path[i];
      nodes.set(key, land.get(key));
      if (!graph.has(key)) graph.set(key, new Set());
      if (i) {
        const prev = path[i-1];
        if (!graph.get(prev).has(key)) edges.push([land.get(prev), land.get(key)]);
        graph.get(prev).add(key); graph.get(key).add(prev);
      }
    }
  }
  // Give a solitary home a short approach instead of an immobile doorstep.
  for (const port of ports) {
    if (graph.get(port.key)?.size) continue;
    const next = neighbours(port.key)[0];
    if (!next) continue;
    nodes.set(next, land.get(next));
    if (!graph.has(next)) graph.set(next, new Set());
    graph.get(port.key).add(next); graph.get(next).add(port.key);
    edges.push([port, land.get(next)]);
  }
  // Upgraded roads are durable city infrastructure even when the shortest route changes.
  for(const road of s?.roads||[]){
    const resolve=v=>typeof v==='string'?land.get(v):v?.key?land.get(v.key):v&&land.get(keyOf(v.x+.5,v.y+.5));
    const a=resolve(road.a),b=resolve(road.b);
    if(!a||!b||Math.abs(a.x-b.x)+Math.abs(a.y-b.y)!==1||![0,.25,.5,.75,1].every(t=>dry({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},s)))continue;
    for(const p of [a,b]){nodes.set(p.key,p);if(!graph.has(p.key))graph.set(p.key,new Set());}
    if(!graph.get(a.key).has(b.key))edges.push([a,b]);graph.get(a.key).add(b.key);graph.get(b.key).add(a.key);
  }
  const components = new Map(); let component = 0;
  for (const key of nodes.keys()) {
    if (components.has(key)) continue;
    const queue = [key]; components.set(key, component);
    for (let i=0;i<queue.length;i++) for (const next of graph.get(queue[i]) || []) {
      if (!components.has(next)) { components.set(next, component); queue.push(next); }
    }
    component++;
  }
  return {nodes, edges, ports, graph, components};
}

export function makeWalkers(streets, population) {
  const walkers = [];
  if (!streets.edges.length) return walkers;
  for (let id=0;id<Math.min(120,population);id++) {
    const origin = streets.ports[id % streets.ports.length];
    const options = streets.ports.filter(p => p.key !== origin.key && streets.components.get(p.key) === streets.components.get(origin.key));
    let destination = options[Math.floor(seed(id,8)*options.length)];
    if (!destination) destination = streets.nodes.get([...streets.graph.get(origin.key)][0]);
    if (!destination) continue;
    const keys = pathTo(origin.key, k => k === destination.key, k => streets.graph.get(k) || []);
    if (!keys || keys.length < 2) continue;
    walkers.push({id, route:keys.map(k=>streets.nodes.get(k)), speed:.20+seed(id,4)*.15, offset:seed(id,3)*100, carrying:id%3===0, robe:['#f0dfb5','#b76c4e','#527f82','#d2b66e','#a195ac','#e6e4cf'][id%6]});
  }
  return walkers;
}

export function walkerAt(agent, seconds) {
  const length = agent.route.length-1;
  // Out and back on the same path; a brief stop at each destination.
  const phase = (seconds*agent.speed+agent.offset) % (2*length+1.2);
  const travel = phase < length ? phase : phase < length+.6 ? length : phase < 2*length+.6 ? 2*length+.6-phase : 0;
  const index = Math.min(length-1,Math.floor(travel)), fraction = travel-index;
  const a = agent.route[index], b = agent.route[index+1];
  return {...agent,kind:'person',x:a.x+(b.x-a.x)*fraction,y:a.y+(b.y-a.y)*fraction,walking:phase<length||phase>length+.6&&phase<2*length+.6,step:seconds*(4+agent.speed),heading:phase<length?1:-1};
}

export function sceneDepth(entity) {
  // Roads run on the boundaries of each one-tile footprint. On either front
  // side x+y exceeds the building centre; on either rear side it is smaller.
  // A front-corner offset would incorrectly hide people beside visible walls.
  return entity.x + entity.y + (entity.kind === 'palm' ? .05 : 0);
}
export function sortScene(entities) {
  return [...entities].sort((a,b) => sceneDepth(a)-sceneDepth(b) || a.x-b.x || (a.id??0)-(b.id??0));
}
export function lightingAt(seconds) {
  const hour = ((8 + seconds * 24 / DAY_SECONDS) % 24 + 24) % 24;
  const sun = Math.sin((hour-6)/24*Math.PI*2);
  const daylight = Math.max(0,Math.min(1,(sun+.2)/.65));
  const night = 1-daylight*daylight*(3-2*daylight);
  const warm = Math.max(0,1-Math.abs(sun-.08)/.4)*(hour>12?1:.65);
  return {hour,night,warm,label:hour<5?'Ночь':hour<8?'Рассвет':hour<17?'День':hour<20?'Закат':'Ночь'};
}
