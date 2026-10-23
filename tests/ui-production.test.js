import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame} from '../engine.js';
import {initializeArtisans} from '../artisan.js';
import {initializeTextiles} from '../textiles.js';
import {MATERIALS,RESOURCE_NAMES} from '../definitions.js';

test('artisan card renders water shortages without creating a warehouse water resource',async()=>{
 const {productionReadout}=await import('../ui-production.js');
 for(const type of ['pottery','brewery']){const s=createGame({start:'established'}),b={type,x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);const before=JSON.stringify(s),html=productionReadout(s,b);
  assert.match(html,/Вода/);assert.match(html,/В буфере/);assert.doesNotMatch(html,/undefined|NaN/);assert.equal(JSON.stringify(s),before);
 }
 assert.equal(MATERIALS.includes('water'),false);assert.equal(RESOURCE_NAMES.water,undefined);
});
test('production card keeps delivered buffers, current cargo, city reserves and remaining output distinct',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'}),b={type:'pottery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);Object.assign(b.artisan,{clay:1,water:2});
 s.citizens.push({id:900,work:'10,9',craftSite:'10,9',craftMaterial:'clay',craftAmount:2},{id:901,work:'10,9',cargo:{pottery:1},phase:'toStore'});
 s.buildings.push({type:'house',x:7,y:9,construction:{required:{pottery:5},remaining:{pottery:2},delivered:{pottery:1}}});
 s.resources.pottery=11;s.delivered.pottery=700;
 const html=productionReadout(s,b);
 assert.match(html,/Глина<\/th><td>4<\/td><td>1<\/td><td>2<\/td><td>1<\/td>/);
 assert.match(html,/Готово на месте: <b>0<\/b>/);assert.match(html,/Несут на склад: <b>1<\/b>/);
 assert.match(html,/На складах города: <b>11<\/b>/);assert.match(html,/Зарезервировано городом: <b>5<\/b>/);assert.doesNotMatch(html,/700/);
});
test('upgraded textile recipe card shows real scaled consumption and output',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'});
 for(const [type,quantity]of [['weaver','4.8 шерсти'],['tailor','3.2 ткани']]){const b={type,x:10,y:9,level:2};s.buildings.push(b);initializeTextiles(s);const html=productionReadout(s,b);assert.ok(html.includes(quantity),html);assert.match(html,/1\.6/);}
});
test('active artisan card distinguishes consumed recipe from the buffer needed for the next batch',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'}),b={type:'brewery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);Object.assign(b.artisan,{stage:'brewing',elapsed:5,vesselUses:2});const html=productionReadout(s,b);
 assert.match(html,/Сырьё текущей партии уже израсходовано/);assert.match(html,/использований сосуда: <b>2<\/b>/);assert.doesNotMatch(html,/Нужно доставить.*4/);
});
test('artisan card retains progress of the current saved stage',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'}),b={type:'pottery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);Object.assign(b.artisan,{stage:'forming',elapsed:2.5});
 assert.match(productionReadout(s,b),/Этап выполнен на 50%/);
});
test('kiln progress restarts for its eight-second cooling stage instead of reporting the whole cycle as one stage',async()=>{
 const {productionReadout}=await import('../ui-production.js'),{initializeKilns}=await import('../kilns.js');const s=createGame({start:'established'}),b={type:'kiln',x:10,y:9,level:1};s.buildings.push(b);initializeKilns(s);b.firing.hot=4;
 for(const [time,title,progress]of [[10,'Идёт обжиг',50],[20,'Печь остывает',0],[24,'Печь остывает',50],[27.9,'Печь остывает',98]]){b.firing.time=time;const html=productionReadout(s,b);assert.match(html,new RegExp(title));assert.match(html,new RegExp(`aria-valuenow="${progress}"`));}
});
test('a sown field does not request the same four seeds again or call unthreshed sheaves ready food',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'}),b={type:'field',x:10,y:9,level:1,crop:{sown:1,seedUsed:4,seedStock:0,sheaves:7,remaining:14}};
 const html=productionReadout(s,b);assert.match(html,/Еда<\/th><td>4<\/td><td>0<\/td><td>0<\/td><td>0<\/td>/);assert.doesNotMatch(html,/Готово на месте/);assert.match(html,/снопов на току: 7/);
});
test('production inputs include actual city stock and display-only resource labels have a safe fallback',async()=>{
 const {productionReadout}=await import('../ui-production.js'),{resourceLabel}=await import('../resource-display.js');const s=createGame({start:'established'}),b={type:'pottery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);
 assert.match(productionReadout(s,b),/Сырьё на складах города: 90 глины \+ 45 тростника/);assert.equal(resourceLabel('constructor'),'Неизвестный ресурс');
});
test('brewery recipe never presents its reusable vessel as consumed by every batch',async()=>{
 const {productionReadout}=await import('../ui-production.js');const s=createGame({start:'established'}),b={type:'brewery',x:10,y:9,level:1};s.buildings.push(b);initializeArtisans(s);b.artisan.vesselUses=2;
 const html=productionReadout(s,b);assert.doesNotMatch(html,/1 керамики →/);assert.match(html,/1 на 4 партии/);assert.match(html,/Керамика<\/th><td>1 на 4 партии<\/td><td>0<\/td><td>0<\/td><td>0<\/td>/);
});
test('all existing production cards render finite values in every building level',async()=>{
 const {productionReadout}=await import('../ui-production.js');const {BUILDINGS}=await import('../definitions.js');
 for(const type of Object.keys(BUILDINGS).filter(k=>Object.keys(BUILDINGS[k].output).length))for(const level of [1,2,3]){const s=createGame({start:'established'}),b={type,x:10,y:9,level};s.buildings.push(b);initializeArtisans(s);initializeTextiles(s);const html=productionReadout(s,b);assert.ok(html,type);assert.doesNotMatch(html,/undefined|NaN|Infinity/,`${type}/${level}`);}
});
