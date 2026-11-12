import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,decode,encode,advanceTime} from '../engine.js';
import {recordBuildingProduction, recordManualProduction, cityProduction} from '../building-production-history.js';
import {cityToolsHTML} from '../ui-city-tools.js';
import {grantTestResources} from '../test-tools.js';
import {assignWorkplace,demolish,setCitizenRole} from '../management.js';
import {syncCitizens} from '../workforce.js';
import {putStock} from '../inventory.js';
import {initializeTextiles} from '../textiles.js';
import {JSDOM} from 'jsdom';
import {renderCityTools} from '../ui-city-tools.js';

test('annual production attributes output to current and removed buildings and manual sites',()=>{
 const s=createGame({start:'established'}),tailor={type:'tailor',x:7,y:8,level:1},second={type:'tailor',x:6,y:8,level:1};
 s.buildings.push(tailor,second);syncCitizens(s);
 recordBuildingProduction(s,tailor,'clothing',12);
 recordBuildingProduction(s,second,'clothing',8);
 recordManualProduction(s,{x:5,y:7,resource:'clay'},6);
 grantTestResources(s,'clothing');
 assert.equal(demolish(s,second.x,second.y).ok,true);
 const before=JSON.stringify(s),view=cityProduction(s,1);
 const clothing=view.resources.find(row=>row.key==='clothing');
 assert.equal(clothing.total,20);
 assert.deepEqual(clothing.sources.map(row=>[row.kind,row.amount]),[['building',12],['demolished',8]]);
 assert.equal(view.resources.find(row=>row.key==='clay').sources[0].kind,'manual');
 assert.equal(JSON.stringify(s),before);
 assert.match(cityToolsHTML(s,{tab:'production'}),/Год 1|За текущий год/);
});

test('annual report preserves older production and handles incomplete pre-update accounting',()=>{
 const s=createGame({start:'established'});
 recordBuildingProduction(s,s.buildings.find(b=>b.type==='clay'),'clay',9);
 recordManualProduction(s,{x:6,y:7,resource:'clay'},3);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 delete s.cityProductionSince;
 assert.equal(cityProduction(s,1).coverage,'partial');
 s.year=2;s.season=0;s.tick=4;
 assert.equal(cityProduction(s,1).resources.find(row=>row.key==='clay').total,12);
 assert.equal(cityProduction(s,2).resources.length,0);
});

test('a real garment batch appears once through delivery and can be opened from the report',()=>{
 const s=createGame({start:'established'}),tailor={type:'tailor',x:10,y:9,level:1};
 s.buildings.push(tailor);initializeTextiles(s);syncCitizens(s);
 assert.ok(setCitizenRole(s,0,'tailor').ok);
 assert.ok(assignWorkplace(s,0,'10,9').ok);
 putStock(s,'9,8','cloth',2);
 for(let i=0;i<700&&s.resources.clothing<1;i++)advanceTime(s,.1);
 assert.equal(s.resources.clothing,1);
 assert.equal(cityProduction(s).resources.find(row=>row.key==='clothing').total,1);
 const {window}=new JSDOM('<main></main>'),root=window.document.querySelector('main');let opened;
 renderCityTools(root,s,{tab:'production',onFocus:key=>{opened=key;}});
 const picker=root.querySelector('[data-production-resource]');
 picker.value='clothing';picker.dispatchEvent(new window.Event('change',{bubbles:true}));
 const output=root.querySelector('[data-production-output="1:clothing"]');
 assert.ok(output.open);
 output.querySelector('[data-city-focus]').click();assert.equal(opened,'10,9');
});
