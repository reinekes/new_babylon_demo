import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {cityDiagnostics} from '../city-diagnostics.js';
import {cityToolsHTML,renderCityTools} from '../ui-city-tools.js';
import {lifeAnalytics,snapshotLifeAnalytics} from '../life-analytics.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';

function town(){const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1,built:{year:2,season:1,elapsed:2,order:1}},{type:'pottery',x:7,y:8,level:1,built:{year:3,season:1,elapsed:2,order:2}},{type:'musicHouse',x:8,y:8,level:1});return s;}
test('work categories preserve type grouping, newest ordering and expanded building IDs',()=>{
 const s=town(),html=cityToolsHTML(s,{tab:'workshops',expandedBuildings:new Set(['6,8'])});
 for(const id of ['food','materials','production','services','sacred'])assert.match(html,new RegExp(`data-city-work-category="${id}"`));
 assert.ok(html.indexOf('data-city-building="7,8"')<html.indexOf('data-city-building="6,8"'));
 assert.match(html,/data-city-disclosure="6,8" open/);
 assert.match(html,/data-city-building-group="pottery"/);
});
test('districts separate housing from storage groups without residents',()=>{
 const s=town(),model=cityDiagnostics(s),html=cityToolsHTML(s,{model});
 assert.match(html,/data-city-district-section="housing"/);assert.match(html,/data-city-district-section="stores"/);
 const stores=html.split('data-city-district-section="stores"')[1];assert.ok(stores);assert.doesNotMatch(stores,/0 жителей/);
 for(const n of model.neighborhoods.filter(n=>!n.homeKeys.length))assert.ok(stores.includes(`data-city-store-group="${n.key}"`));
});
test('compact residents sort independently of state order and keep controls in stable disclosures',()=>{
 const s=town();s.citizens[0].hunger=90;s.citizens[1].hunger=10;
 const before=JSON.stringify(s),html=cityToolsHTML(s,{tab:'citizens',filter:{sort:'hunger'},expandedCitizens:new Set([s.citizens[1].id])});
 assert.match(html,/data-city-filter="sort"/);assert.match(html,/data-city-person-disclosure="1" open/);
 assert.ok(html.indexOf('data-city-citizen="0"')<html.indexOf('data-city-citizen="1"'));
 assert.match(html,/Настроить и подробнее/);assert.equal(JSON.stringify(s),before);
});
test('resident disclosure state and filters survive refresh without changing IDs or cargo',()=>{
 const s=town(),root={innerHTML:'',handlers:{},contains:()=>true,addEventListener(t,f){this.handlers[t]=f;}},c=s.citizens[0];c.cargo={clay:2};
 renderCityTools(root,s,{tab:'citizens'});
 const target={dataset:{cityPersonDisclosure:String(c.id)},open:true};root.handlers.toggle({target});
 renderCityTools(root,s);assert.match(root.innerHTML,/data-city-person-disclosure="0" open/);assert.deepEqual(c.cargo,{clay:2});
});
test('seven analytics tabs use current distributions and only recorded historic points',()=>{
 const s=town();s.lifeAnalytics.history=[];const before=JSON.stringify(s),m=lifeAnalytics(s);
 for(const id of ['overview','wellbeing','work','faith','residents','family','history'])assert.match(lifeAnalyticsHTML(s,{model:m}),new RegExp(`data-life-tab="${id}"`));
 for(const tab of ['overview','wellbeing','work','faith']){const html=lifeAnalyticsHTML(s,{model:m,tab});assert.match(html,/role="img"/);assert.doesNotMatch(html,/NaN|Infinity/);}
 assert.match(lifeAnalyticsHTML(s,{model:m,tab:'faith'}),/Нет сезонных снимков/);assert.equal(JSON.stringify(s),before);
 snapshotLifeAnalytics(s);s.tick++;snapshotLifeAnalytics(s);
 const updated=lifeAnalytics(s),html=lifeAnalyticsHTML(s,{model:updated,tab:'faith'});assert.equal(updated.history.length,2);assert.match(html,/data-life-series="faith"/);assert.match(html,/<svg/);
});
test('analytics work and wellbeing numbers are derived from actual residents without new save fields',()=>{
 const s=town();s.citizens[0].health=40;s.citizens[0].hunger=80;s.citizens[0].phase='working';s.citizens[0].faith=5;
 const before=JSON.stringify(s),m=lifeAnalytics(s);assert.equal(m.activity.find(r=>r.key==='working').count,s.citizens.filter(c=>['working','constructing'].includes(c.phase)).length);
 assert.equal(m.distributions.faith.reduce((n,r)=>n+r.count,0),s.citizens.length);assert.equal(m.distributions.health[0].count,1);
 for(const tab of ['work','wellbeing','faith'])lifeAnalyticsHTML(s,{tab,model:m});assert.equal(JSON.stringify(s),before);
});
