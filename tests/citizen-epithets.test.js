import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,encode,decode} from '../engine.js';
import {citizenName} from '../definitions.js';
import {setCitizenRole,inspireCitizen} from '../management.js';
import {displayName,epithetInfo,recordCitizenDelivery,recordCitizenHarvest,syncCitizenEpithets,validateCitizenEpithets,EPITHETS} from '../citizen-epithets.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {lifeAnalyticsHTML} from '../ui-life-analytics.js';
import {snapshotLifeAnalytics,lifeAnalytics} from '../life-analytics.js';

test('legacy names and all view functions remain readonly with no invented personal history',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],before=JSON.stringify(s);assert.equal(displayName(s,c),citizenName(c.id));assert.deepEqual(epithetInfo(s,c).history,[]);
 cityToolsHTML(s,{tab:'citizens'});lifeAnalyticsHTML(s,{tab:'residents'});assert.equal(JSON.stringify(s),before);assert.equal(c.epithetHistory,undefined);
});
test('a real role change changes only the displayed byname and cargo waits for its original delivery',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],id=c.id,home=c.home,name=citizenName(id);assert.equal(setCitizenRole(s,id,'carrier').ok,true);
 assert.match(displayName(s,c),/Носильщик/);assert.equal(c.id,id);assert.equal(c.home,home);assert.equal(citizenName(id),name);
 c.cargo={clay:2};c.phase='toStore';setCitizenRole(s,id,'builder');assert.equal(c.pendingRole,'builder');assert.deepEqual(c.cargo,{clay:2});assert.match(displayName(s,c),/Носильщик/);
});
test('three observed failed inspirations earn stubborn, and a later success earns steadfast with the old reason retained',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0];c.sex='f';
 for(let i=0;i<3;i++){s.rngState=500;assert.equal(inspireCitizen(s,c.id,'fisher').success,false);}
 assert.match(displayName(s,c),/Упрямая/);assert.match(epithetInfo(s,c).reason,/3/);assert.equal(c.calling,undefined);
 s.rngState=1;assert.equal(inspireCitizen(s,c.id,'fisher').success,true);assert.match(displayName(s,c),/Упорная/);assert.ok(epithetInfo(s,c).history.some(row=>row.label==='Упрямая'));assert.equal(c.calling,'fisher');
 const loaded=decode(encode(s));assert.ok(loaded);assert.equal(displayName(loaded,c.id),displayName(s,c));assert.equal(loaded.citizens[0].id,c.id);
});
test('specialized adult inspiration earns a profession byname, while a child gets no false working title',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],child=s.citizens.find(c=>c.age<16);s.rngState=1;inspireCitizen(s,c.id,'fisher');assert.match(displayName(s,c),/Рыбак/);
 s.rngState=1;inspireCitizen(s,child.id,'hunter');assert.ok(!displayName(s,child).includes('Охотник'));assert.match(displayName(s,child),/Вдохновл/);assert.equal(child.futureRole,'production');
});
test('delivery and harvest milestones use accepted measured amounts and keep at most eight name changes',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0];recordCitizenDelivery(s,c,{food:100,faith:100});assert.match(displayName(s,c),/Кормилец/);assert.equal(c.epithetEvidence.delivered,100);
 recordCitizenHarvest(s,c,{food:100});assert.match(displayName(s,c),/Жнец/);
 for(let i=0;i<20;i++)setCitizenRole(s,c.id,i%2?'builder':'carrier');assert.equal(c.epithetHistory.length,8);assert.equal(c.id,0);assert.equal(validateCitizenEpithets(s),true);
});
test('seasonal epithets rely on observed medical, kinship, age and recovery facts and preserve base registry names',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0];c.age=70;snapshotLifeAnalytics(s);assert.match(displayName(s,c),/Старейшина/);assert.equal(s.lifeAnalytics.people.find(p=>p.id===c.id).name,citizenName(c.id));
 c.age=30;c.medicine={level:3,study:20,practice:40,year:s.year};syncCitizenEpithets(s);assert.match(epithetInfo(s,c).reason,/лекар/);
 const other=s.citizens[2];other.hunger=95;other.health=30;other.missedMeals=3;syncCitizenEpithets(s);assert.ok(!displayName(s,other).includes('Переживший'));
 other.hunger=0;other.health=90;other.missedMeals=0;syncCitizenEpithets(s);assert.match(displayName(s,other),/Переживший голод/);
 const model=lifeAnalytics(s);assert.match(model.people.find(p=>p.id===c.id).name,/Лекарь|Лекар|Целител/);assert.match(lifeAnalyticsHTML(s,{tab:'family',selectedId:c.id}),/История прозвищ/);
});
test('the catalog offers broad context and validation rejects fabricated or unbounded records',()=>{
 assert.ok(Object.keys(EPITHETS).length>=30);
 const s=createGame({start:'established'}),c=s.citizens[0];assert.equal(validateCitizenEpithets(s),true);
 c.epithet={key:'invented',reason:'x',tick:0,year:1,season:0};assert.equal(validateCitizenEpithets(s),false);delete c.epithet;
 c.epithetHistory=Array(9).fill({key:'stubborn',reason:'x',tick:0,year:1,season:0});assert.equal(validateCitizenEpithets(s),false);
});
