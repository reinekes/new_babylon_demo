import {requestTransfer} from '../district-logistics.js';
import {assignWorkplace,inspireCitizen} from '../management.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {stampBuildingCompletion} from '../building-chronology.js';
import {syncCitizens} from '../workforce.js';
import {strictScenario} from '../scenario-profiles.js';
import {queueGranaryReceipt,workOnAccount,ACCOUNT_WORK_SECONDS} from '../scribes.js';

test('a paid work interval transcribes one accepted load and hands its receipt to a successor',()=>{
 const s=createGame({start:'established',mode:'mature',scenario:strictScenario()});
 const granary={type:'granary',x:10,y:8,level:1};
 s.buildings.push(granary);stampBuildingCompletion(s,granary);syncCitizens(s);
 const [carrier,scribe,successor]=s.citizens;
 queueGranaryReceipt(s,granary,carrier,{food:3,wood:0});
 const resources={...s.resources};
 workOnAccount(s,granary,scribe,ACCOUNT_WORK_SECONDS-1);
 assert.equal(granary.receiptArchive.tablets.length,0);
 workOnAccount(s,granary,scribe,1);
 const [tablet]=granary.receiptArchive.tablets;
 assert.deepEqual(tablet.cargo,{food:3});
 assert.equal(tablet.carrier,carrier.id);
 assert.equal(tablet.author,scribe.id);
 workOnAccount(s,granary,successor,ACCOUNT_WORK_SECONDS);
 assert.equal(granary.receiptArchive.tablets.length,1);
 assert.deepEqual(granary.receiptArchive.reading,{author:successor.id,tablet:tablet.id});
 assert.deepEqual(s.resources,resources);
 assert.deepEqual(decode(encode(s)).buildings.find(b=>b.type==='granary').receiptArchive,granary.receiptArchive);
});

test('physical deliveries become receipts only after arrival and work at the granary',()=>{
 const s=createGame({start:'established',mode:'mature',seed:137,scenario:strictScenario()});
 const granary={type:'granary',x:10,y:8,level:1},key='10,8',id=s.citizens[0].id;
 s.buildings.push(granary);stampBuildingCompletion(s,granary);syncCitizens(s);
 assert.ok(inspireCitizen(s,id,'scribe').success);
 assert.ok(assignWorkplace(s,id,key).ok);
 assert.ok(requestTransfer(s,'9,8',key,'wood',4).ok);
 assert.equal(granary.receiptArchive,undefined);
 for(let i=0;i<600&&!granary.receiptArchive?.tablets.length;i++){s.event=null;advanceTime(s,.25);}
 const tablet=granary.receiptArchive.tablets[0];
 assert.equal(tablet.author,id);
 assert.equal(tablet.cargo.wood,4);
 assert.equal(granary.stock.wood,4);
 assert.ok(tablet.writtenAt>tablet.arrivedAt);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 granary.receiptArchive.pending.push({...tablet});
 assert.equal(decode(encode(s)),null);
});
