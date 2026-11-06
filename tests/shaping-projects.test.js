import assert from 'node:assert/strict';
import test from 'node:test';
import {decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {recordShapingProject,recordShapingUse,shapingProjectView} from '../shaping-projects.js';

test('five used buildings must share a builder and include a brickyard and public service',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),[master,other]=s.citizens;
 const types=['brickyard','waterpoint','house','clay','reed'];
 for(const [i,type] of types.entries()){
  const b={type,x:20+i,y:20,level:1,construction:{kind:'new'}};
  recordShapingProject(s,b,[i===4?other:master]);
  recordShapingUse(s,b);
  assert.equal(shapingProjectView(s).count,i);
  delete b.construction;
  recordShapingUse(s,b);recordShapingUse(s,b);
 }
 assert.equal(shapingProjectView(s).count,4);
 const project={type:'clay',x:26,y:20,level:1,construction:{kind:'new'}};
 recordShapingProject(s,project,[master]);
 delete project.construction;recordShapingUse(s,project);
 const view=shapingProjectView(s);
 assert.equal(view.masterId,master.id);
 assert.equal(view.count,5);
 assert.ok(view.brickyard&&view.publicService);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const corrupted=JSON.parse(raw);
 corrupted.shapingProjects.used[0].builders=[master.id,master.id];
 assert.equal(decode(JSON.stringify(corrupted)),null);
});

test('a real building completion records its builder and production records first use',async()=>{
 const {build,advanceTime}=await import('../engine.js');
 const {buildingKey,MATERIALS}=await import('../definitions.js');
 const {recordBuildingProduction}=await import('../building-production-history.js');
 const {syncCitizens,networkFor}=await import('../workforce.js');
 const s=createNewCity({mode:'awakening',seed:1}),builder=s.citizens[0];
 Object.assign(s.godhood,{stage:'recognized',recognitionAt:0,witnessId:builder.id,believerIds:[builder.id]});
 Object.assign(builder,{role:'builder',calling:'builder',builderSkill:{level:1,projects:0}});
 for(const k of MATERIALS)s.resources[k]=100;
 let result;
 for(const [x,y] of [[7,9],[8,9],[8,8],[5,8],[7,7],[7,10]]){
  result=build(s,'brickyard',x,y);if(result.ok)break;
 }
 assert.ok(result.ok,result.reason);
 const site=s.buildings.at(-1),key=buildingKey(site),q=site.construction;
 for(const k of MATERIALS){q.delivered[k]=q.required[k];q.remaining[k]=0;}
 for(const source of Object.values(q.sources))for(const k of Object.keys(source))source[k]=0;
 q.work=11.9;
 syncCitizens(s);
 const port=networkFor(s).ports.find(p=>p.building===site);
 Object.assign(builder,{site:key,sitePort:key,siteDuty:'builder',phase:'constructing',x:port.x,y:port.y,route:[],routeIndex:0});
 advanceTime(s,.5);
 assert.ok(!site.construction);
 assert.deepEqual(site.shapingProject.builders,[builder.id]);
 assert.equal(shapingProjectView(s).count,0);
 recordBuildingProduction(s,site,'brick',4);
 assert.equal(shapingProjectView(s).count,1);
 for(let i=0;i<20;i++)advanceTime(s,.5);
 const saved=encode(s),loaded=decode(saved);assert.ok(loaded);assert.equal(encode(loaded),saved);
});
