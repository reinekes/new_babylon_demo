import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {createGame,advanceTime} from '../engine.js';
import {ensureRoads,planRoadRoute,roadUpgradeCost,upgradeRoad,upgradeRoadRoute} from '../roads.js';
import {levelOf} from '../definitions.js';
import {setHTML} from '../ui-render.js';

function roadPanel(){
 const document=new JSDOM('<button id="open-roads"></button><button id="lay-roads"></button><p id="map-hint"></p><aside id="tile-detail"></aside>').window.document;
 const $=id=>document.getElementById(id),state=createGame({start:'established'}),roads=ensureRoads(state);
 const renderer={roadMode:true,setRoadMode(active){this.roadMode=active;}};
 const ui=vm.createContext({document,$,renderer,state,roadMode:true,selection:null,inspected:null,inspectedPerson:null,inspectedDeposit:null,
  routeCache:null,routeFrom:null,routeTo:null,routeTarget:2,roadDrawFrom:null,roadDrawTo:null,
  levelOf,roadUpgradeCost,upgradeRoad,planRoadRoute,upgradeRoadRoute,setHTML,esc:String,toast(){},costs:()=>'',priorityControl:()=>'',siteStatus:()=>'',bindManagement(){}});
 const source=readFileSync(new URL('../app.js',import.meta.url),'utf8');
 vm.runInContext(source.slice(source.indexOf('function roadDetail('),source.indexOf('function cropCalendarPanel(')),ui);
 ui.mutate=result=>{
  if(result.ok&&ui.inspected)ui.updateRoadDetail(roads.find(r=>r.x===ui.inspected.x&&r.y===ui.inspected.y));
  return result.ok;
 };
 return {ui,$,roads,renderer};
}

test('an accepted single upgrade releases its map focus while the open worksite and failed order remain inspectable',()=>{
 const {ui,$,roads,renderer}=roadPanel(),road=roads[0];ui.roadDetail(road);
 ui.state.event={};$('upgrade-road').click();
 assert.equal(ui.inspected.roadMark.id,road.id);assert.equal(renderer.roadMode,true);assert.ok(!road.construction);
 ui.state.event=null;$('upgrade-road').focus();$('upgrade-road').click();
 assert.equal(road.construction.target,2);assert.equal(renderer.roadMode,false);assert.ok(!ui.inspected.roadMark);
 assert.equal($('tile-detail').hidden,false);assert.ok($('building-controls').querySelector('[data-cancel]'));
 // Deliberately inspect the same project again while its builders work.
 renderer.setRoadMode(true);ui.roadMode=true;ui.roadDetail(road);assert.equal(ui.inspected.roadMark.id,road.id);
 for(let i=0;i<800&&road.construction;i++)advanceTime(ui.state,.25);
 assert.equal(road.level,2);ui.updateRoadDetail(road);
 assert.ok(!ui.inspected.roadMark);assert.equal(renderer.roadMode,false);
});

test('multi-road previews last for planning and are released when the route is ordered',()=>{
 const {ui,$,roads,renderer}=roadPanel();
 const [start,end]=roads;
 ui.roadDetail(start);$('route-start').click();ui.routeTo=end.id;ui.inspected=null;ui.renderRoadRoute();
 assert.ok(renderer.routeRoads.size>=2);
 assert.equal($('order-route').disabled,false);$('order-route').click();
 assert.equal(renderer.routeRoads,null);assert.equal(renderer.plannedRoads,null);assert.equal(renderer.roadMode,false);
 assert.equal($('tile-detail').hidden,true);assert.ok(start.construction&&end.construction);
});
