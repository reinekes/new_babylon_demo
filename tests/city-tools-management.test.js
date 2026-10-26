import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {cityDiagnostics} from '../city-diagnostics.js';
import {cityToolsHTML,renderCityTools} from '../ui-city-tools.js';
import {setCitizenRole,inspireCitizen,assignWorkplace} from '../management.js';

function town(){const s=createGame({start:'established'});s.buildings.push({type:'pottery',x:6,y:8,level:1});return s;}
function mockRoot(){return {innerHTML:'',firstChild:null,handlers:{},contains:()=>true,addEventListener(type,fn){this.handlers[type]=fn;}};}
function control(dataset,value=''){return {dataset,value,blurred:false,blur(){this.blurred=true;},hasAttribute(name){return name==='data-city-inspire'&&this.dataset.cityInspire!==undefined;},closest(){return this;}};}

test('work staffing uses assigned slots and all matching callings, independently of current work phase',()=>{
 const s=town(),[a,b]=s.citizens;for(const c of s.citizens){c.work=null;delete c.workplace;}
 const card=()=>cityDiagnostics(s).workshops.find(w=>w.key==='6,8');
 assert.deepEqual(card().staffing,{count:0,capacity:2,matching:0,state:'empty',label:'Нет работников'});
 Object.assign(a,{role:'production',workplace:'6,8',phase:'home'});
 assert.equal(card().staffing.state,'partial');assert.equal(card().staffing.count,1);assert.equal(cityDiagnostics(s).totals.workers,1);
 Object.assign(b,{role:'production',work:'6,8',phase:'toWork'});
 assert.equal(card().staffing.state,'full');assert.equal(card().staffing.matching,0);
 a.calling='potter';b.calling='potter';assert.equal(card().staffing.state,'matched');assert.equal(card().staffing.matching,2);
 b.workplace='7,7';assert.equal(card().staffing.state,'partial','a worker pinned elsewhere is not another allocated slot');
});

test('work cards expose the real inventories, building icon, staffing label and sorted immediate assignment',()=>{
 const s=town();for(const c of s.citizens){c.work=null;delete c.workplace;}
 Object.assign(s.citizens[0],{role:'production',calling:'brewer'});Object.assign(s.citizens[1],{role:'production',calling:'potter'});
 const b=s.buildings.at(-1);b.artisan={stage:'idle',clay:3,reed:1,food:0,pottery:0,water:2,ready:0,elapsed:0,vesselUses:0};
 const html=cityToolsHTML(s,{tab:'workshops'}),card=html.match(/<article[^>]*data-city-building="6,8"[\s\S]*?<\/article>/)?.[0];
 assert.ok(card);assert.match(card,/ui-icon/);assert.match(card,/Нет работников/);assert.match(card,/data-staffing="empty"/);
 assert.match(card,/data-city-assign="6,8"/);assert.ok(card.indexOf(`value="${s.citizens[1].id}"`)<card.indexOf(`value="${s.citizens[0].id}"`));
 assert.match(card,/Сырьё/);assert.match(card,/Готовая продукция/);assert.match(card,/resource-clay/);assert.match(card,/>3</);
});

test('people have separate work and inspiration controls, with disabled work for children and explicit faith cost',()=>{
 const s=town();s.citizens[0].age=10;
 const html=cityToolsHTML(s,{tab:'citizens'});
 assert.match(html,/data-city-role="0"[^>]*disabled/);assert.match(html,/data-city-inspiration="0"/);assert.match(html,/data-city-inspire="0"/);
 assert.match(html,/Вдохновить · 1 вера/);assert.match(html,/Шанс 70%/);assert.match(html,/resource-faith/);
});

test('city controls act only after interaction, use stable IDs and retain cargo through existing management actions',()=>{
 const s=town(),c=s.citizens[0],root=mockRoot(),calls=[];c.id=91;c.age=30;c.cargo={clay:2};c.phase='toStore';
 const before=JSON.stringify(s);
 renderCityTools(root,s,{tab:'citizens',onRole:(id,role)=>{calls.push(['role',id,role]);return setCitizenRole(s,id,role);},onInspire:(id,profession)=>{calls.push(['inspire',id,profession]);return inspireCitizen(s,id,profession);}});
 assert.equal(JSON.stringify(s),before);
 const role=control({cityRole:'91'},'carrier');root.handlers.change({target:role});
 assert.deepEqual(calls,[['role',91,'carrier']]);assert.equal(c.pendingRole,'carrier');assert.deepEqual(c.cargo,{clay:2});assert.ok(role.blurred);
 const desired=control({cityInspiration:'91'},'potter');root.handlers.change({target:desired});assert.equal(calls.length,1);
 const faith=s.resources.faith;s.rngState=1;root.handlers.click({target:control({cityInspire:'91'})});
 assert.deepEqual(calls[1],['inspire',91,'potter']);assert.equal(s.resources.faith,faith-1);assert.deepEqual(c.cargo,{clay:2});
});

test('quick assignment routes building key and citizen ID to the existing safe action',()=>{
 const s=town(),root=mockRoot(),c=s.citizens[0],calls=[];c.cargo={clay:2};c.phase='toStore';
 renderCityTools(root,s,{tab:'workshops',onAssign:(id,key)=>{calls.push([id,key]);return assignWorkplace(s,id,key);},onRelease:id=>{calls.push([id,'']);return assignWorkplace(s,id,'');}});
 root.handlers.change({target:control({cityAssign:'6,8'},String(c.id))});assert.deepEqual(calls,[[c.id,'6,8']]);assert.equal(c.workplace,'6,8');assert.deepEqual(c.cargo,{clay:2});
 root.handlers.click({target:control({cityRelease:String(c.id)})});assert.equal(c.workplace,undefined);assert.deepEqual(c.cargo,{clay:2});
});

test('inventories and inline controls remain pure for frozen legacy state',()=>{
 const s=town(),before=JSON.stringify(s);function freeze(v){if(v&&typeof v==='object'){Object.freeze(v);for(const value of Object.values(v))freeze(value);}}freeze(s);
 cityToolsHTML(s,{tab:'citizens'});cityToolsHTML(s,{tab:'workshops'});cityToolsHTML(s,{tab:'homes',group:cityDiagnostics(s).neighborhoods[0].key});assert.equal(JSON.stringify(s),before);
});

test('meal diagnostics count actual milk at home, in reachable storage and in a carrier load',()=>{
 const s=town(),c=s.citizens[0];s.citizens=[c];const home=s.buildings.find(b=>`${b.x},${b.y}`===c.home),store=s.buildings.find(b=>b.type==='shrine');home.pantry=0;home.water=100;home.householdStock={milk:4};
 let h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.equal(h.food,2);assert.ok(!h.reasons.some(r=>['food','delivery','helper'].includes(r.code)));
 home.householdStock.milk=0;store.stock.food=0;store.stock.milk=10;s.resources.food=0;s.resources.milk=10;
 h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.equal(h.accessibleFood,5);assert.equal(h.foodStatus,'delivery');
 s.district.jobs.push({id:99,target:c.home,targetKind:'input',resource:'milk',remaining:4});c.districtJob=99;c.cargo={milk:2};c.phase='blocked';
 h=cityDiagnostics(s).homes.find(h=>h.key===c.home);assert.equal(h.foodInTransit,1);assert.equal(h.foodStatus,'delivery');
});
