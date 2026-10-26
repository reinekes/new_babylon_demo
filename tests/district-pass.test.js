import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,advanceTime,encode,decode} from '../engine.js';
import * as districts from '../district-logistics.js';
import {syncCitizens} from '../workforce.js';
import {stockStores} from '../inventory.js';
import {makeStressDistrict} from '../district3d/state.js';
import {recoverCitizenCargo} from '../workforce.js';

test('one district index visits residents once regardless of the number of transfer orders',()=>{
 assert.equal(typeof districts.indexDistrictJobs,'function');let reads=0;const jobs=Array.from({length:128},(_,i)=>({id:i+1,source:'9,8',target:'10,9',resource:'wood',remaining:1,amount:2,delivered:0,cancelled:0,automatic:true})),citizens=Array.from({length:200},(_,i)=>({get districtJob(){reads++;return i%128+1;},cargo:{wood:.5}})),s={district:{jobs},citizens};
 const before=JSON.stringify(jobs),index=districts.indexDistrictJobs(s);assert.ok(reads<=400,`resident assignment reads: ${reads}`);assert.equal(index.carried.get(1),1);assert.equal(index.incoming.get('10,9:wood'),228);assert.equal(index.queued.get('9,8:wood'),128);assert.equal(JSON.stringify(jobs),before);
});

test('discovering referenced household stores visits each resident once for all orders',()=>{
 let reads=0;const jobs=Array.from({length:128},(_,i)=>({id:i+1,source:'1,1',target:'2,1',remaining:0})),citizens=Array.from({length:200},(_,i)=>({get districtJob(){reads++;return i%128+1;},cargo:{wood:.5},store:'2,1'})),houses=[{type:'house',x:1,y:1,stock:{}},{type:'house',x:2,y:1,stock:{}}],s={buildings:[{type:'shrine',x:0,y:0},...houses],citizens,district:{jobs}};
 assert.deepEqual(stockStores(s),s.buildings);assert.ok(reads<=400,`resident assignment reads: ${reads}`);
});

test('compaction preserves every manual order and owned job while retaining only sixteen completed automatic jobs',()=>{
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'depot',x:10,y:9,level:1});syncCitizens(s);for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}for(const c of s.citizens)c.role='builder';
 s.buildings.at(-1).stockMinimum={food:0};s.district.jobs=Array.from({length:160},(_,i)=>({id:i+1,source:'9,8',target:'10,9',resource:'wood',amount:1,remaining:0,delivered:1,cancelled:0,automatic:i!==2}));s.district.jobs.push({id:161,source:'9,8',target:'10,9',resource:'wood',amount:1,remaining:0,delivered:0,cancelled:0,automatic:true},{id:162,source:'9,8',target:'10,9',resource:'wood',amount:1,remaining:1,delivered:0,cancelled:0,automatic:true});s.district.nextId=163;s.district.lastScan=-1;
 Object.assign(s.citizens[0],{role:'carrier',work:null,site:null,districtJob:1,store:'10,9',phase:'toHome',cargo:{}});Object.assign(s.citizens[1],{role:'carrier',work:null,site:null,districtJob:161,store:'10,9',phase:'toDistrictStore',cargo:{wood:1}});
 districts.syncDistrictJobs(s);assert.ok([1,3,161,162].every(id=>s.district.jobs.some(q=>q.id===id)));assert.equal(s.district.jobs.filter(q=>q.automatic&&q.remaining===0&&q.delivered===1&&q.id!==1).length,16);assert.equal(s.district.nextId,163);assert.equal(s.citizens[1].cargo.wood,1);assert.ok(decode(encode(s)));
});

test('an uncollected night order resumes at dawn without a new production event',()=>{
 const s=createGame({start:'established'});s.buildings=s.buildings.filter(b=>['house','shrine'].includes(b.type));s.buildings.push({type:'depot',x:10,y:9,level:1,stockMinimum:{food:0}});syncCitizens(s);for(const b of s.buildings.filter(b=>b.type==='house')){b.pantry=100;b.pantryDelivered=100;b.water=100;b.waterDelivered=100;}for(const c of s.citizens)c.role='builder';s.citizens[0].role='carrier';s.simTime=31;s.seasonElapsed=31;
 assert.ok(districts.requestTransfer(s,'9,8','10,9','wood',1).ok);const q=s.district.jobs.at(-1);for(let i=0;i<100;i++){s.event=null;advanceTime(s,.1);}assert.equal(q.remaining,1);assert.ok(!s.citizens.some(c=>c.districtJob===q.id));
 for(let i=0;i<220&&q.delivered<1;i++){s.event=null;advanceTime(s,.1);}assert.equal(q.delivered,1);assert.ok(decode(encode(s)));
});

test('large cities can retain two hundred owned completed orders plus active automatic transfers',()=>{
 const s=makeStressDistrict(),target=s.buildings.find(b=>b.type==='granary'),key=`${target.x},${target.y}`;
 for(const c of s.citizens){recoverCitizenCargo(s,c.id);Object.assign(c,{age:20,work:null,site:null,phase:'home',route:[],routeIndex:0,store:key,districtJob:c.id+1,cargo:{}});}
 s.district.jobs=Array.from({length:344},(_,i)=>({id:i+1,source:'9,8',target:key,resource:'wood',amount:1,remaining:i>=200&&i<328?1:0,delivered:i>=200&&i<328?0:1,cancelled:0,automatic:true}));s.district.nextId=345;s.district.lastScan=-1;
 assert.ok(decode(encode(s)),'owned IDs and one hundred twenty-eight active orders fit a valid save');districts.syncDistrictJobs(s);assert.equal(s.district.jobs.length,344);assert.equal(s.district.nextId,345);assert.ok(decode(encode(s)));
});
