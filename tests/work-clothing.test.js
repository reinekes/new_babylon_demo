import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decode,encode} from '../engine.js';
import {BUILDINGS} from '../definitions.js';
import {PROFESSIONS,hasWorkplace} from '../professions.js';
import {professionClothing} from '../work-clothing.js';

test('all adopted adult callings and staffed workplaces resolve to a garment',()=>{
 for(const [calling,{role}] of Object.entries(PROFESSIONS)){
  const outfit=professionClothing({age:28,role,calling});
  assert.equal(outfit?.id,calling==='auto'?undefined:calling,calling);
 }
 for(const type of Object.keys(BUILDINGS).filter(hasWorkplace)){
  const outfit=professionClothing({age:22,role:'auto',work:'job'},new Map([['job',type]]));
  assert.ok(outfit?.color&&outfit.shape,type);
 }
 const clay=['clay','brickyard','pottery','kiln'].map(type=>professionClothing({age:20,work:'job'},[{id:'job',type}]));
 assert.equal(new Set(clay.map(o=>o.color)).size,1);
 assert.equal(new Set(clay.map(o=>o.shape)).size,4);
});

test('actual assignment takes precedence while carrying and children keep their civilian clothes',()=>{
 const buildings=new Map([['old','pottery'],['new','fishing']]);
 const c={age:30,role:'production',work:'old',workplace:'new',calling:'watercarrier',pendingRole:'watercarrier',cargo:{pottery:4}};
 const before=structuredClone(c);
 assert.equal(professionClothing(c,buildings).id,'potter');assert.deepEqual(c,before);
 assert.equal(professionClothing({...c,work:'new'},buildings).id,'fisher');
 assert.equal(professionClothing({...c,craftSite:'old',work:'new'},buildings).id,'potter');
 assert.equal(professionClothing({...c,age:15},buildings),null);
 assert.equal(professionClothing({...c,phase:'mourning'},buildings),null);
 assert.equal(professionClothing({age:23,role:'auto',cargo:{clay:3}}),null);
 for(const [duty,id] of [[{siteDuty:'builder'},'builder'],[{siteDuty:'carrier'},'carrier'],[{tradeJob:'receipt'},'carrier'],[{saleJob:'dispatch'},'carrier'],[{districtJob:'load'},'carrier'],[{guardPost:'post'},'guard']]){
  assert.equal(professionClothing({...c,...duty},buildings).id,id);
 }
 const state={manualGathering:{orders:[{key:'4,6',resource:'clay',active:true}]}};
 assert.equal(professionClothing({age:21,manualGathering:{key:'4,6'},cargo:{clay:.25}},[],state).id,'clayworker');
});

test('archived cities derive outfits directly from the restored jobs without changing identities or goods',()=>{
 for(const fixture of ['legacy-v16-textiles.json','legacy-v17-water-bricks.json','legacy-v19-masonry.json']){
  const state=decode(readFileSync(new URL('./fixtures/'+fixture,import.meta.url),'utf8'));assert.ok(state);
  const before=encode(state),outfits=city=>city.citizens.map(c=>[c.id,professionClothing(c,city.buildings,city)?.id||null]);
  const seen=outfits(state);assert.ok(seen.some(([,id])=>id));
  assert.deepEqual(outfits(decode(before)),seen);assert.equal(encode(state),before);
 }
});
