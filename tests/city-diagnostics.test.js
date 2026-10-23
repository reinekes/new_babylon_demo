import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {syncInventory} from '../inventory.js';
import {cityDiagnostics,filterCitizens} from '../city-diagnostics.js';
import {cityToolsHTML} from '../ui-city-tools.js';

function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const x of Object.values(v))freeze(x);}return v;}
test('diagnostics are pure even for uninitialised production and crop buffers',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'weaver',x:6,y:8,level:1});delete s.buildings.find(b=>b.type==='field').crop;
 const before=JSON.stringify(s);freeze(s);const d=cityDiagnostics(s);cityDiagnostics(s);cityToolsHTML(s);
 assert.equal(d.homes.length,2);assert.equal(JSON.stringify(s),before);
});
test('full central stores do not disguise a hungry isolated household on the opposite bank',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'house',x:20,y:8,level:1,pantry:0,water:0},{type:'depot',x:21,y:8,level:1});syncInventory(s);
 const c=s.citizens[0];c.home='20,8';c.hunger=75;c.health=45;c.work=null;c.pantryFood=0;
 const d=cityDiagnostics(s),h=d.homes.find(h=>h.key==='20,8');
 assert.equal(h.accessibleFood,0);assert.equal(h.hungry,1);assert.equal(h.ill,1);assert.ok(h.reasons.some(r=>r.code==='food'));
 assert.equal(d.neighborhoods.find(n=>n.homeKeys.includes(h.key)).food,0);
 assert.equal(d.totals.storedFood,s.resources.food);
});
test('workshops explain missing workers, material, water, storage, and construction without changing buffers',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'weaver',x:6,y:8,level:1,weaving:{wool:0}},{type:'brickyard',x:6,y:9,level:1,brickmaking:{clay:4,reed:1,water:0,wet:0,drying:0,ready:0}},{type:'kiln',x:6,y:10,level:1,construction:{kind:'new',required:{brick:12},delivered:{brick:0},remaining:{brick:12}}});
 let d=cityDiagnostics(s);assert.equal(d.workshops.find(w=>w.key==='6,8').reason.code,'worker');
 Object.assign(s.citizens[0],{work:'6,8',phase:'working',store:'9,8'});Object.assign(s.citizens[1],{work:'6,9',phase:'working',store:'9,8'});
 d=cityDiagnostics(s);assert.equal(d.workshops.find(w=>w.key==='6,8').reason.code,'input');assert.equal(d.workshops.find(w=>w.key==='6,9').reason.code,'water');assert.equal(d.workshops.find(w=>w.key==='6,10').reason.code,'construction');
 s.buildings.find(b=>b.type==='weaver').weaving.wool=3;s.buildings.find(b=>b.type==='shrine').stock.cloth=200;
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.key==='6,8').reason.code,'storage');
});
test('topology cache invalidates when a real bridge connects isolated workshop',()=>{
 const s=createGame({start:'established'});s.buildings.push({type:'weaver',x:20,y:8,level:1,weaving:{wool:0}});
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.key==='20,8').reason.code,'path');
 s.buildings.push({type:'bridge',x:14,y:8,level:1});
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.key==='20,8').reason.code,'worker');
});
test('passive drying continues at night and is not reported as a labour shortage',()=>{
 const s=createGame({start:'established'});s.simTime=35;s.buildings.push({type:'brickyard',x:6,y:9,level:1,brickmaking:{clay:0,reed:0,water:0,wet:4,drying:2,ready:0}});
 const w=cityDiagnostics(s).workshops.find(w=>w.key==='6,9');assert.equal(w.reason.code,'drying');assert.equal(w.status,'process');
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.key==='7,7').reason.code,'night');
});
test('filters combine profession, child/adult and household or personal trouble without renumbering people',()=>{
 const s=createGame({start:'established'});const [a,b,c]=s.citizens;a.role='carrier';a.age=20;a.hunger=50;b.role='carrier';b.age=12;b.hunger=0;c.role='production';c.health=40;
 assert.deepEqual(filterCitizens(s,{role:'carrier',age:'adult',trouble:'hunger'}).map(c=>c.id),[a.id]);
 assert.ok(filterCitizens(s,{age:'child'}).includes(b));assert.ok(filterCitizens(s,{trouble:'health'}).includes(c));
 assert.ok(filterCitizens(s,{trouble:'family'}).includes(b));
});
test('food and water carried home are separate from store/home totals and seed grain is protected',()=>{
 const s=createGame({start:'established'}),c=s.citizens[0],home=s.buildings.find(b=>`${b.x},${b.y}`===c.home);home.pantry=1;home.water=2;c.pantryTrip=true;c.pantryFood=3;
 const d=cityDiagnostics(s),h=d.homes.find(h=>h.key===c.home);
 assert.equal(h.food,1);assert.equal(h.foodInTransit,3);assert.equal(d.totals.foodInTransit,3);
 assert.equal(d.totals.storedFood,s.resources.food);assert.equal(d.totals.availableFood,s.resources.food-4);
 assert.equal(d.neighborhoods.reduce((n,q)=>n+q.food,0),s.resources.food-4);
});
test('markup supplies labelled filters and safe citizen/home/work navigation',()=>{
 const s=createGame({start:'established'});s.citizens[0].role='<script>';
 const html=cityToolsHTML(s,{tab:'citizens'});assert.match(html,/aria-label="Профессия"/);assert.match(html,/data-city-citizen="0"/);assert.match(html,/data-city-focus=/);assert.ok(!html.includes('<script>'));assert.match(html,/&lt;script&gt;/);
});
import {initializeArtisans,workArtisan} from '../artisan.js';
test('new artisans explain vessel and water shortages, and retain overnight passive stages',()=>{
 const s=createGame({start:'established'}),pot={type:'pottery',x:6,y:8,level:1},beer={type:'brewery',x:6,y:9,level:1};s.buildings.push(pot,beer);initializeArtisans(s);
 Object.assign(s.citizens[0],{work:'6,8',phase:'working'});Object.assign(s.citizens[1],{work:'6,9',phase:'working'});
 Object.assign(pot.artisan,{clay:4,reed:2});Object.assign(beer.artisan,{food:4,water:3});
 let d=cityDiagnostics(s);assert.equal(d.workshops.find(w=>w.type==='pottery').reason.code,'water');assert.match(d.workshops.find(w=>w.type==='brewery').reason.label,/сосуд/);
 Object.assign(beer.artisan,{vesselUses:2});assert.equal(cityDiagnostics(s).workshops.find(w=>w.type==='brewery').reason.code,'working');
 pot.artisan.water=2;workArtisan(pot,5);s.simTime=35;
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.type==='pottery').reason.code,'drying');
 pot.artisan.stage='firing';assert.equal(cityDiagnostics(s).workshops.find(w=>w.type==='pottery').reason.code,'firing');
});
test('summer field without canal explains water instead of claiming harmless seasonal waiting',()=>{
 const s=createGame({start:'established'});s.season=1;const field=s.buildings.find(b=>b.type==='field');field.crop.sown=1;
 assert.equal(cityDiagnostics(s).workshops.find(w=>w.key==='12,8').reason.code,'water');
});
import {mealRation,mealCycle} from '../wellbeing.js';
function oneHome(){const s=createGame({start:'established'}),c=s.citizens[0];s.citizens=[c];const home=s.buildings.find(b=>`${b.x},${b.y}`===c.home);home.water=100;home.pantry=0;c.hunger=0;c.health=100;c.missedMeals=0;return {s,c,home};}
test('home dinner demand uses actual adult and child meal portions, and excludes a completed current dinner',()=>{
 const {s,c,home}=oneHome();home.pantry=.7;
 let h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.equal(h.demand,mealRation(c));assert.ok(h.reasons.length);
 c.age=12;assert.equal(cityDiagnostics(s).homes.find(h=>h.key===c.home).demand,mealRation(c));
 c.age=20;s.simTime=35;c.mealDay=mealCycle(s.simTime);c.mealEaten=mealRation(c);home.pantry=0;
 h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.equal(h.demand,0);assert.ok(!h.reasons.some(r=>['food','delivery','helper'].includes(r.code)));
});
test('empty pantry beside a full store needs delivery, and an incapable household needs a helper',()=>{
 const {s,c,home}=oneHome();assert.ok(s.resources.food>90);
 let h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.ok(h.accessibleFood>90);assert.ok(h.reasons.some(r=>r.code==='delivery'));assert.ok(!h.reasons.some(r=>r.code==='food'));
 assert.ok(!cityToolsHTML(s).includes('Дома обеспечены'));
 c.health=15;h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.ok(h.reasons.some(r=>r.code==='delivery'));c.clinic='healer';h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.ok(h.reasons.some(r=>r.code==='helper'));delete c.clinic;
 c.health=100;c.pantryTrip=true;c.pantryFood=mealRation(c);c.phase='toPantryHome';h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.ok(h.reasons.some(r=>r.code==='delivery'));assert.equal(h.foodStatus,'delivery');
});
test('construction lists real site builders and carriers and distinguishes work from awaiting materials',()=>{
 const s=createGame({start:'established'}),site={type:'kiln',x:6,y:10,level:1,construction:{kind:'new',required:{brick:12},delivered:{brick:12},remaining:{brick:0}}};s.buildings.push(site);
 Object.assign(s.citizens[0],{work:null,site:'6,10',siteDuty:'builder',phase:'constructing'});Object.assign(s.citizens[1],{work:null,site:'6,10',siteDuty:'carrier',phase:'toSite'});
 let w=cityDiagnostics(s).workshops.find(w=>w.key==='6,10');assert.deepEqual(w.workers,[s.citizens[0].id,s.citizens[1].id]);assert.equal(w.builders.length,1);assert.equal(w.carriers.length,1);assert.equal(w.working,1);assert.equal(w.reason.label,'Строится');assert.ok(!w.reason.detail.includes('нужны строители'));assert.match(cityToolsHTML(s,{tab:'workshops'}),/строителей: 1/);assert.match(cityToolsHTML(s,{tab:'workshops'}),/носильщиков: 1/);
 site.construction.delivered.brick=0;site.construction.remaining.brick=12;w=cityDiagnostics(s).workshops.find(w=>w.key==='6,10');assert.equal(w.reason.label,'Ждёт стройматериалы');
});
test('family filter exactly follows diagnostic home reasons including water and disconnected paths before hunger',()=>{
 const {s,c,home}=oneHome();home.pantry=10;home.water=0;
 assert.deepEqual(filterCitizens(s,{trouble:'family'}).map(c=>c.id),[c.id]);
 home.water=100;s.buildings.push({type:'house',x:20,y:8,level:1,pantry:10,water:100});c.home='20,8';
 assert.deepEqual(filterCitizens(s,{trouble:'family'}).map(c=>c.id),[c.id]);
 const before=JSON.stringify(s);freeze(s);const d=cityDiagnostics(s),keys=new Set(d.homes.filter(h=>h.reasons.length).map(h=>h.key));
 assert.deepEqual(filterCitizens(s,{trouble:'family'}).map(c=>c.id),s.citizens.filter(c=>keys.has(c.home)).map(c=>c.id));assert.equal(JSON.stringify(s),before);
});

test('house upgrades show assigned construction crew rather than disappearing from work overview',()=>{const {s,c,home}=oneHome();home.construction={kind:'upgrade',required:{clay:1},delivered:{clay:1},remaining:{clay:0}};Object.assign(c,{work:null,site:c.home,siteDuty:'builder',phase:'constructing'});const w=cityDiagnostics(s).workshops.find(w=>w.key===c.home);assert.ok(w);assert.equal(w.reason.label,'Строится');assert.deepEqual(w.builders,[c.id]);});
