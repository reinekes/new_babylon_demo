import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,build,encode,decode} from '../engine.js';
import {layRoad,roadIsBuilt} from '../roads.js';
import {footpathRibbons,footpathRibbonPoint,recordFootsteps,visibleFootpaths} from '../footpaths.js';
import {networkFor} from '../workforce.js';

const point=(x,y)=>({x,y});

test('a route is invisible at first, gains wear from repeated walking, persists and fades',()=>{
 const s=createGame({start:'established'}),a=point(1.5,1.5),b=point(2.5,2.5);
 assert.deepEqual(visibleFootpaths(s),[]);
 recordFootsteps(s,a,b,Math.SQRT2);
 assert.deepEqual(visibleFootpaths(s),[],'one passage does not leave a clear track');
 recordFootsteps(s,b,a,Math.SQRT2);
 assert.equal(visibleFootpaths(s).length,1,'a diagonal shortcut becomes a single track in both directions');
 const loaded=decode(encode(s));
 assert.ok(loaded);assert.deepEqual(visibleFootpaths(loaded),visibleFootpaths(s));
 assert.deepEqual(visibleFootpaths({...loaded,simTime:loaded.simTime+360}),[]);
});

test('footpaths come from actual resident motion and do not become road orders',()=>{
 const s=createGame({start:'established'}),n=s.roads.length;
 advanceTime(s,12);
 assert.ok(s.footpaths?.length>0,'residents record their walking routes');
 assert.equal(s.roads.length,n);assert.ok(decode(encode(s)));
});

test('an explicit street promotes a matching automatic edge, including after save and load',()=>{
 const s=createGame({start:'established'}),road=s.roads[0];assert.ok(road);
 assert.equal(roadIsBuilt(road),false);
 assert.ok(layRoad(s,point(road.a.x-.5,road.a.y-.5),point(road.b.x-.5,road.b.y-.5)).ok);
 assert.equal(s.roads.filter(r=>r.id===road.id).length,1);
 const loaded=decode(encode(s));
 assert.ok(loaded);assert.equal(roadIsBuilt(loaded.roads.find(r=>r.id===road.id)),true);
});

test('legacy paths remain navigable and older finished paving stays visible',()=>{
 const s=createGame({start:'established'}),road=s.roads[0];delete road.built;
 const loaded=decode(encode(s));assert.ok(loaded);
 const saved=loaded.roads.find(r=>r.id===road.id),net=networkFor(loaded);
 assert.ok(net.graph.get(saved.a.key).has(saved.b.key));
 assert.equal(roadIsBuilt(saved),false);
 loaded.buildings.length=0;networkFor(loaded);
 assert.equal(roadIsBuilt(saved),false,'legacy origin stays stable when the generated graph changes');
 saved.level=2;assert.equal(roadIsBuilt(saved),true);
});


test('a newly blocked segment hides wear and cannot collect more, while the old save stays valid',()=>{
 const s=createGame({start:'established'}),a=point(1.5,1.5),b=point(2.5,2.5);
 recordFootsteps(s,a,b,Math.SQRT2);recordFootsteps(s,a,b,Math.SQRT2);
 assert.equal(visibleFootpaths(s).length,1);
 assert.ok(build(s,'house',2,2).ok);
 const oldWear=s.footpaths[0].wear;
 assert.deepEqual(visibleFootpaths(s),[]);
 recordFootsteps(s,a,b,Math.SQRT2);
 assert.equal(s.footpaths[0].wear,oldWear);assert.ok(decode(encode(s)));
 s.buildings.pop();
 s.world.lakes=[{cells:[point(2,2)]}];
 assert.deepEqual(visibleFootpaths(s),[]);
 recordFootsteps(s,a,b,Math.SQRT2);
 assert.equal(s.footpaths[0].wear,oldWear);
});


test('a worn right-angle corner joins smoothly while branches and blocked joins stay intact',()=>{
 const left=point(0,0),corner=point(1,0),right=point(1,1);
 const paths=[{a:left,b:corner,level:3},{a:corner,b:right,level:2}];
 const [first,second,join]=footpathRibbons(paths);
 assert.deepEqual(first.b,join.a);
 assert.deepEqual(second.a,join.b);
 assert.deepEqual(join.control,corner);
 assert.equal(join.level,2);
 const midpoint=footpathRibbonPoint(join.a,join.b,join.control,.5);
 assert.ok(midpoint.x<corner.x&&midpoint.y>corner.y);
 assert.deepEqual(paths[0].b,corner);
 assert.deepEqual(footpathRibbons(paths,()=>false),paths);
 const branch=[...paths,{a:corner,b:point(2,0),level:1}];
 assert.deepEqual(footpathRibbons(branch),branch);
});
