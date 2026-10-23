import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {lifeAnalytics} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';

test('life chronicle shows a specialist bonus only for the actual current building and preserves its read-only state',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);s.buildings.push({type:'pottery',x:10,y:9,level:1},{type:'brewery',x:11,y:9,level:1});Object.assign(c,{role:'production',calling:'potter',work:'10,9',workplace:'10,9',siteDuty:null,phase:'working',health:100,mood:75,hunger:0});
 let before=JSON.stringify(s);assert.equal(lifeAnalytics(s).people.find(p=>p.id===c.id).workRate,1.2);assert.match(lifeAnalyticsHTML(s,{tab:'family',selectedId:c.id}),/120%/);assert.equal(JSON.stringify(s),before);
 c.work='11,9';before=JSON.stringify(s);assert.equal(lifeAnalytics(s).people.find(p=>p.id===c.id).workRate,1);assert.equal(JSON.stringify(s),before);
});
test('life chronicle prioritizes current construction duty and falls back to the saved role without a work building',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age>=16);s.buildings.push({type:'pottery',x:10,y:9,level:1});Object.assign(c,{role:'builder',calling:'builder',work:'10,9',siteDuty:'builder',health:100,mood:75,hunger:0});
 assert.equal(lifeAnalytics(s).people.find(p=>p.id===c.id).workRate,1.2);
 Object.assign(c,{work:null,siteDuty:null});assert.equal(lifeAnalytics(s).people.find(p=>p.id===c.id).workRate,1.2);
 c.age=12;assert.equal(lifeAnalytics(s).people.find(p=>p.id===c.id).workRate,null);
});
