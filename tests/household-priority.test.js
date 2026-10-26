import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import {invalidateAssignments,syncCitizens,recoverCitizenCargo} from '../workforce.js';
import {newMedicalSkill} from '../education.js';

function clinicCity(){
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'healer',x:6,y:15,level:1});
 s.citizens=[s.citizens[0],s.citizens[8]];s.population=2;
 const [doctor,patient]=s.citizens;Object.assign(doctor,{role:'healer',calling:'healer',medicine:newMedicalSkill(1,1)});Object.assign(patient,{role:'builder',health:40,home:'9,9'});
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=0;b.water=100;b.waterDelivered=100;}
 s.resources.reed=0;s.resources.food=200;invalidateAssignments(s);syncCitizens(s);return {s,patient};
}
test('sick sole household supplier collects real groceries before an unproductive clinic visit',()=>{
 const {s,patient}=clinicCity();let carried=false,treated=false;
 for(let i=0;i<1250;i++){s.event=null;advanceTime(s,.1);carried ||= (patient.pantryFood||0)>0;treated ||= patient.phase==='treatment';if(i%100===0)assert.ok(decode(encode(s)),`save at ${s.simTime}`);}
 assert.ok(carried,'sick adult must physically bring food to the household');assert.ok(treated,'groceries do not remove access to care');assert.equal(patient.missedMeals,0);assert.equal(patient.hunger,0);assert.ok(patient.health>=40);assert.ok(s.resources.food>150,'the source contains food throughout');
});
test('a worker arriving after 20 can still buy dinner without dropping their work cargo',()=>{
 const {s,patient}=clinicCity();s.buildings=s.buildings.filter(b=>b.type!=='healer');s.citizens=s.citizens.filter(c=>c.id===patient.id);s.population=1;
 s.simTime=34;s.seasonElapsed=34;patient.health=100;patient.phase='resting';patient.cargo={clay:2};invalidateAssignments(s);syncCitizens(s);
 let carried=false;for(let i=0;i<100;i++){s.event=null;advanceTime(s,.1);carried ||= (patient.pantryFood||0)>0;assert.ok(decode(encode(s)));}
 assert.ok(carried);assert.ok(patient.mealEaten>0);assert.equal(patient.cargo.clay,2);assert.ok(s.resources.food<200);
});
test('a newly assigned market porter supplies their empty home before starting the paid job',async()=>{
 const {trade}=await import('../trading.js');const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'market',x:10,y:9,level:1});s.citizens=[s.citizens[0]];s.population=1;const c=s.citizens[0];c.role='builder';
 for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}
 invalidateAssignments(s);for(let i=0;i<1200&&s.trade.caravan?.phase!=='trading';i++){s.event=null;advanceTime(s,.1);}assert.equal(s.trade.caravan?.phase,'trading');
 s.event=null;assert.ok(trade(s,'stone','buy',2).ok);c.role='carrier';const home=s.buildings.find(b=>`${b.x},${b.y}`===c.home);home.pantry=0;c.phase='home';invalidateAssignments(s);syncCitizens(s);
 advanceTime(s,.1);assert.ok(c.pantryTrip,'starting market work must not preempt the next family dinner');assert.ok(decode(encode(s)));
 let delivered=false;for(let i=0;i<700;i++){s.event=null;advanceTime(s,.1);delivered ||= s.trade.deliveries[0].delivered===2;}
 assert.ok(delivered,'paid purchase resumes after groceries');assert.ok(home.pantry>0);
});
function childrenCity(isolated=false){
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.citizens=[s.citizens[0],s.citizens[10]];s.population=2;const [adult,child]=s.citizens;
 adult.role='builder';child.home=isolated?'22,8':'9,9';if(isolated)s.buildings.push({type:'house',x:22,y:8,level:1,pantry:0,pantryDelivered:0});
 for(const b of s.buildings.filter(b=>b.type==='house')){b.water=100;b.waterDelivered=100;b.pantry=b.x===8?10:0;b.pantryDelivered=b.pantry;}
 invalidateAssignments(s);syncCitizens(s);return {s,adult,child,target:child.home};
}
test('an adult physically buys and delivers food to a child-only neighboring home, then returns to their own home',async()=>{
 const {household}=await import('../households.js');const {s,adult,child,target}=childrenCity();const b=s.buildings.find(b=>`${b.x},${b.y}`===target);let carried=false,returned=false;
 for(let i=0;i<650;i++){s.event=null;advanceTime(s,.1);if(adult.pantryTarget===target&&adult.pantryFood>0){carried=true;assert.equal(household(s,b).inTransit,adult.pantryFood);assert.equal(household(s,s.buildings[0]).inTransit,0);}if(carried&&!adult.pantryTrip&&adult.phase==='home')returned=true;if(i%20===0)assert.ok(decode(encode(s)),`neighbor save ${i}`);}
 assert.ok(carried);assert.ok(returned);assert.ok(b.pantryDelivered>0);assert.equal(child.missedMeals,0);assert.equal(child.hunger,0);assert.equal(adult.home,'8,8');assert.equal(child.home,target);assert.equal(child.pantryTrip,undefined);
});
test('neighbor food aid cannot cross an isolated riverbank or fabricate cargo',()=>{
 const {s,adult,target}=childrenCity(true);for(let i=0;i<200;i++){s.event=null;advanceTime(s,.1);}assert.notEqual(adult.pantryTarget,target);assert.equal(s.buildings.at(-1).pantry,0);assert.ok(s.resources.food>0);
 const raw=JSON.parse(encode(s));raw.citizens[0].pantryTarget='missing';assert.equal(decode(JSON.stringify(raw)),null);raw.citizens[0].pantryTrip=true;raw.citizens[0].pantryFood=2;raw.citizens[0].phase='toPantryHome';assert.equal(decode(JSON.stringify(raw)),null);
});
test('neighbor cargo is recovered exactly once on death and destination demolition waits for the trip',async()=>{
 const {recoverCitizenCargo}=await import('../workforce.js');const {canDemolish}=await import('../management.js');const {s,adult,target}=childrenCity();
 for(let i=0;i<200&&!(adult.pantryFood>0);i++){s.event=null;advanceTime(s,.1);}assert.equal(adult.pantryTarget,target);assert.ok(adult.pantryFood>0);const b=s.buildings.find(b=>`${b.x},${b.y}`===target);assert.match(canDemolish(s,b),/доставки еды/);
 const amount=adult.pantryFood,before=s.resources.food;recoverCitizenCargo(s,adult.id);assert.ok(Math.abs(s.resources.food-before-amount)<1e-7);assert.equal(adult.pantryTarget,undefined);recoverCitizenCargo(s,adult.id);assert.ok(Math.abs(s.resources.food-before-amount)<1e-7);
 s.citizens=s.citizens.filter(c=>c.id!==adult.id);s.population=1;invalidateAssignments(s);syncCitizens(s);assert.ok(decode(encode(s)));
});
test('diagnostics and food warnings attribute a neighboring courier to the receiving children',async()=>{
 const {cityDiagnostics}=await import('../city-diagnostics.js');const {foodWarnings}=await import('../food-planning.js');const {supplyOverview}=await import('../supply.js');const {s,adult,target}=childrenCity();
 for(let i=0;i<200&&!(adult.pantryFood>0);i++){s.event=null;advanceTime(s,.1);}assert.equal(adult.pantryTarget,target);
 const d=cityDiagnostics(s),receiver=d.homes.find(h=>h.key===target),sender=d.homes.find(h=>h.key===adult.home);assert.equal(receiver.foodInTransit,adult.pantryFood);assert.equal(sender.foodInTransit,0);assert.equal(receiver.foodStatus,'delivery');assert.equal(d.totals.foodInTransit,adult.pantryFood);
 const warning=foodWarnings(s).houses.find(h=>h.key===target);assert.equal(warning.inTransit,adult.pantryFood);assert.equal(supplyOverview(s).houses.find(h=>h.key===target).inTransit,adult.pantryFood);
});
test('a severely hungry resident with food already at home eats before another long optional refill',async()=>{
 const {makeStressDistrict}=await import('../district3d/state.js');const {initializeLifeAnalytics}=await import('../life-analytics.js');const s=makeStressDistrict();
 for(const c of s.citizens)recoverCitizenCargo(s,c.id);s.citizens=s.citizens.filter(c=>[31,34].includes(c.id));s.population=2;
 for(const c of s.citizens)Object.assign(c,{home:'8,18',x:8.5,y:18.5,phase:'home',route:[],routeIndex:0,work:null,site:null,store:null,role:'builder',cargo:{},health:42,hunger:100,mealEaten:0,mealDay:-1,mealEvaluated:-1,missedMeals:1,lastMealQuality:0,partner:c.id===31?34:31});
 const b=s.buildings.find(b=>b.type==='house'&&b.x===8&&b.y===18);b.pantry=2.4;b.pantryDelivered=2.4;b.water=100;b.waterDelivered=100;
 invalidateAssignments(s);syncCitizens(s);delete s.lifeAnalytics;initializeLifeAnalytics(s);let ate=false;
 for(let i=0;i<900;i++){s.event=null;advanceTime(s,.2);ate ||= s.citizens.find(c=>c.id===31)?.mealEaten>.75;}
 assert.ok(ate,'the hungry supplier must eat the meal already available at home');assert.equal(s.deaths,0);assert.ok(s.population>=2);assert.ok([31,34].every(id=>s.citizens.some(c=>c.id===id)));assert.ok(s.citizens.every(c=>c.health>0));assert.ok(decode(encode(s)));
});
test('a hungry home worker rests with their work cargo, eats pantry food, and later resumes its delivery',async()=>{
 const {initializeLifeAnalytics}=await import('../life-analytics.js');const s=createGame({start:'established'}),c=s.citizens[0];s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.citizens=[c];s.population=1;
 Object.assign(c,{phase:'home',role:'builder',work:null,site:null,store:'9,8',x:8.5,y:8.5,cargo:{wood:2},health:40,hunger:100,missedMeals:1,lastMealQuality:0});const b=s.buildings.find(b=>b.type==='house'&&b.x===8);b.pantry=.8;b.pantryDelivered=.8;b.water=100;b.waterDelivered=100;s.resources.food=0;s.simTime=29;s.seasonElapsed=29;delete s.lifeAnalytics;initializeLifeAnalytics(s);invalidateAssignments(s);
 const wood=s.resources.wood+c.cargo.wood;let ate=false;
 for(let i=0;i<80;i++){s.event=null;advanceTime(s,.1);ate ||= c.mealDay===0&&c.mealEaten>.75;assert.ok(decode(encode(s)));}
 assert.ok(ate);assert.ok(c.hunger<100);assert.equal(c.cargo.wood,2);assert.equal(c.phase,'resting');assert.ok(b.pantry<.01);
 for(let i=0;i<300;i++){s.event=null;advanceTime(s,.1);}assert.equal(c.cargo.wood||0,0);assert.ok(Math.abs(s.resources.wood-wood)<1e-7);assert.ok(decode(encode(s)));
});
