import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {syncCitizens,invalidateAssignments,networkFor} from '../workforce.js';
import {workGathering} from '../labor-life.js';
import {annualProductionHistory,productionHistory} from '../building-production-history.js';
import {BUILDINGS} from '../definitions.js';

function nearYearEndLogger(){
 const s=createGame({start:'established'}),b={type:'logging',x:6,y:10,level:1};s.buildings.push(b);
 const c=s.citizens.find(c=>c.age>=16);c.workplace='6,10';invalidateAssignments(s);syncCitizens(s);
 s.year=1;s.season=3;s.tick=3;s.simTime=179.8;s.seasonElapsed=44.8;s.trade.nextArrival=5;
 const port=networkFor(s).ports.find(p=>p.building===b);assert.ok(port);
 Object.assign(c,{work:'6,10',phase:'working',route:[],routeIndex:0,workElapsed:0,x:port.x,y:port.y,cargo:{}});
 workGathering(s,c,b,.1,1,port);const j=s.gathering.jobs.find(j=>j.citizen===c.id);assert.ok(j);
 j.stage='working';j.progress=.999;c.workElapsed=BUILDINGS.logging.workTime-.001;c.x=j.stand.x;c.y=j.stand.y;
 return {s,b,c};
}

test('wood completed before New Year belongs to that year while its return trip and reload cross the boundary',()=>{
 let {s,b,c}=nearYearEndLogger();advanceTime(s,.1);
 assert.equal(s.year,1);assert.equal(c.phase,'toWorkshop');assert.ok(c.cargo.wood>0);const load=c.cargo.wood;
 assert.equal(b.workshopStock.output.wood||0,0,'load is physically still carried');
 assert.equal(b.productionAnnual?.rows.find(r=>r.year===1)?.resources.wood,load,'account at actual target completion, not the later depot arrival');
 const restored=decode(encode(s));assert.ok(restored);s=restored;b=s.buildings.find(b=>b.type==='logging');c=s.citizens.find(p=>p.id===c.id);
 for(let i=0;i<50&&(!b.workshopStock.output.wood||s.year===1);i++){s.event=null;advanceTime(s,.1);}
 assert.equal(s.year,2);assert.equal(b.workshopStock.output.wood,load);assert.equal(c.cargo.wood||0,0);
 assert.equal(annualProductionHistory(s,b).at(-1).resources.wood,load);
 assert.equal(b.productionAnnual.rows.find(r=>r.year===2)?.resources.wood||0,0,'arrival must not credit a second or next-year load');
 assert.equal(productionHistory(s,b).find(r=>r.year===1&&r.season===3)?.resources.wood,load);assert.ok(decode(encode(s)));
});

test('legacy extraction cargo arriving after New Year preserves goods without inventing a completion date',()=>{
 let {s,b,c}=nearYearEndLogger();advanceTime(s,.1);const load=c.cargo.wood;
 delete b.productionHistory;delete b.productionAnnual;
 const restored=decode(encode(s));assert.ok(restored);s=restored;b=s.buildings.find(b=>b.type==='logging');c=s.citizens.find(p=>p.id===c.id);
 for(let i=0;i<50&&(!b.workshopStock.output.wood||s.year===1);i++){s.event=null;advanceTime(s,.1);}
 assert.equal(s.year,2);assert.equal(b.workshopStock.output.wood,load);assert.equal(c.cargo.wood||0,0);
 assert.equal(b.productionHistory,undefined);assert.equal(b.productionAnnual.rows.reduce((n,r)=>n+(r.resources.wood||0),0),0);assert.ok(decode(encode(s)));
});
