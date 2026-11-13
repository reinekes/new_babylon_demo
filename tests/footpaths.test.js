import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,build,encode,decode} from '../engine.js';
import {layRoad,roadIsBuilt} from '../roads.js';
import {footpathRibbonPoint,recordFootsteps,visibleFootpaths} from '../footpaths.js';
import {navigationSegmentClear} from '../navigation.js';
import {networkFor,visibleCitizens} from '../workforce.js';

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

test('Amal follows the same safe worn curve in either direction and after loading',()=>{
 const s=createGame({start:'established'});
 advanceTime(s,3.4);
 const amal=s.citizens[0],edge=[amal.route[amal.routeIndex-1],amal.route[amal.routeIndex]];
 assert.equal(amal.phase,'toWork');assert.equal(amal.work,'12,8');
 assert.ok(edge.every(Boolean));
 recordFootsteps(s,...edge,3);
 const trail=visibleFootpaths(s).find(r=>edge.every(p=>[r.a,r.b].some(q=>q.x===p.x&&q.y===p.y)));
 assert.ok(trail?.control);
 const [a,b]=edge;
 const shown=()=>visibleCitizens(s).find(c=>c.id===amal.id);
 const forward=shown(),raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);assert.equal(encode(s),raw);
 assert.deepEqual(visibleFootpaths(loaded),visibleFootpaths(s));
 const reloaded=visibleCitizens(loaded).find(c=>c.id===amal.id);
 assert.deepEqual([reloaded.x,reloaded.y],[forward.x,forward.y]);
 assert.ok(Math.abs(forward.y-amal.y)>.025,'feet visibly depart from the straight grid edge');
 const t=(amal.x-a.x)/(b.x-a.x),curve=footpathRibbonPoint(a,b,trail.control,t);
 assert.ok(Math.hypot(curve.x-forward.x,curve.y-forward.y)<1e-8);
 amal.route=[b,a];amal.routeIndex=1;amal.phase='toHome';
 assert.ok(Math.hypot(shown().x-forward.x,shown().y-forward.y)<1e-8);
 assert.ok(layRoad(s,point(a.x-.5,a.y-.5),point(b.x-.5,b.y-.5)).ok);
 assert.deepEqual([shown().x,shown().y],[amal.x,amal.y],'a finished street stays straight');
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


test('curves share their junction and stay out of buildings',()=>{
 const s=createGame({start:'established'}),a=point(8.5,8.5),b=point(9.5,8.5),c=point(10.5,8.5);
 recordFootsteps(s,a,b,3);recordFootsteps(s,b,c,3);
 const [first,second]=visibleFootpaths(s);
 assert.equal(first.control,null,'the narrow passage between a shrine and a house stays straight');
 assert.ok(second.control,'the next segment can bend in the open');
 assert.deepEqual(footpathRibbonPoint(first.a,first.b,first.control,1),footpathRibbonPoint(second.a,second.b,second.control,0));
 for(let i=1;i<=20;i++)assert.ok(navigationSegmentClear(s,footpathRibbonPoint(second.a,second.b,second.control,(i-1)/20),footpathRibbonPoint(second.a,second.b,second.control,i/20)));
});
