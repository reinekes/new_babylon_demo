import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame,encode,decode} from '../engine.js';
for(const fixture of ['legacy-v16-textiles.json','legacy-v17-water-bricks.json','legacy-v19-masonry.json'])test(`${fixture}: profession expansion keeps original identities, roles, callings and loads`,()=>{
 const raw=readFileSync(new URL(`./fixtures/${fixture}`,import.meta.url),'utf8'),old=JSON.parse(raw),s=decode(raw);assert.ok(s);
 for(const previous of old.citizens){const current=s.citizens.find(c=>c.id===previous.id);assert.ok(current);for(const key of ['id','home','role','calling','pendingRole','futureRole','cargo','buildCargo','craftSite','craftAmount','craftMaterial','craftWool','craftCloth','waterTrip'])assert.deepEqual(current[key],previous[key],`${previous.id}/${key}`);}
 for(const previous of old.buildings.filter(b=>b.construction)){const current=s.buildings.find(b=>b.x===previous.x&&b.y===previous.y);for(const key of ['required','remaining','delivered'])assert.deepEqual(current.construction[key],previous.construction[key]);}
 assert.deepEqual(decode(encode(s)),s);
});
test('new calling save validation rejects future roles that do not match their underlying job',()=>{
 const s=createGame({start:'established'}),c=s.citizens.find(c=>c.age<16);Object.assign(c,{calling:'potter',futureRole:'builder'});assert.equal(decode(encode(s)),null);
 c.futureRole='production';assert.ok(decode(encode(s)));c.role='potter';assert.equal(decode(encode(s)),null);
});
