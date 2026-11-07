import test from 'node:test';
import assert from 'node:assert/strict';
import {createNewCity} from '../new-game.js';
import {decode,encode} from '../engine.js';
import {recordRevelationFact} from '../revelation-evidence.js';
import {landMemoryStories} from '../land-memory.js';
import {relicStartReason,startRelicQuest} from '../relic-quest.js';

test('the first land search needs two distinct saved stories and leaves legacy saves alone',()=>{
 const s=createNewCity({mode:'awakening',seed:137}),c=s.citizens[0],home=s.buildings.find(b=>b.type==='house');
 s.resources.faith=500;
 assert.match(startRelicQuest(s,c.id,'land').reason,/две разные истории/);
 assert.equal(s.resources.faith,500);
 recordRevelationFact(s,'building',c,home);
 recordRevelationFact(s,'building',s.citizens[1],home);
 assert.match(relicStartReason(s,c.id,'land'),/две разные истории/);
 recordRevelationFact(s,'food',c,home);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(encode(loaded),raw);
 assert.doesNotMatch(relicStartReason(loaded,c.id,'land'),/две разные истории/);
 const legacy=JSON.parse(raw);
 delete legacy.landMemoryChapter;
 delete legacy.revelationEvidence;
 for(const b of legacy.buildings)delete b.landMemoryAnchor;
 const old=decode(JSON.stringify(legacy));
 assert.ok(old);
 assert.equal(old.landMemoryChapter,undefined);
 assert.doesNotMatch(relicStartReason(old,c.id,'land'),/две разные истории/);
});

test('an archived story keeps its participant when a replacement occupies the original site',()=>{
 const s=createNewCity({mode:'awakening',seed:137}),c=s.citizens[0],place=s.buildings.find(b=>b.type==='house');
 recordRevelationFact(s,'building',c,place);
 const story=()=>landMemoryStories(s).find(row=>row.kind==='building');
 assert.equal(story().place,place);
 assert.deepEqual(story().livingIds,[c.id]);
 const replacement={...place};
 delete replacement.landMemoryAnchor;
 s.buildings[s.buildings.indexOf(place)]=replacement;
 assert.equal(story().place,null);
 assert.deepEqual(story().livingIds,[c.id]);
 const raw=encode(s),loaded=decode(raw);
 assert.ok(loaded);
 assert.equal(landMemoryStories(loaded)[0].place,null);
});
