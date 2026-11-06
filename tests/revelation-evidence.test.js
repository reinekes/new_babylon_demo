import assert from 'node:assert/strict';
import test from 'node:test';
import {decode,encode} from '../engine.js';
import {createNewCity} from '../new-game.js';
import {recordRevelationFact,revelationEvidenceView} from '../revelation-evidence.js';

test('a new Awakening remembers one actual witness per kind across save and reload',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),[first,second]=s.citizens,home=s.buildings.find(b=>b.type==='house');
 assert.equal(revelationEvidenceView(s).count,0);
 for(const kind of ['family','building','food'])recordRevelationFact(s,kind,first,home);
 recordRevelationFact(s,'food',second,home);
 assert.equal(revelationEvidenceView(s).count,3);
 assert.equal(s.revelationEvidence.food.citizenId,first.id);
 const raw=encode(s);
 assert.equal(encode(decode(raw)),raw);
 const broken=JSON.parse(raw);broken.revelationEvidence.food.x=s.world.width;
 assert.equal(decode(JSON.stringify(broken)),null);
});

test('old cities do not infer or accumulate testimony',()=>{
 const s=createNewCity({mode:'awakening',seed:1});
 delete s.revelationEvidence;
 const old=decode(encode(s)),before=encode(old);
 recordRevelationFact(old,'family',old.citizens[0],old.buildings[0]);
 assert.equal(revelationEvidenceView(old),null);
 assert.equal(encode(old),before);
});

test('incomplete work and unmet requests do not count, confirmed work does',async()=>{
 const {recordNeighborFoodFact}=await import('../causal-facts.js');
 const {recordBuilderCompletion}=await import('../godhood.js');
 const {recordFieldGrain}=await import('../field-grain.js');
 const s=createNewCity({mode:'awakening',seed:137}),[c]=s.citizens;
 const home=s.buildings.find(b=>b.type==='house'&&`${b.x},${b.y}`!==c.home);
 assert.ok(home);
 c.pantryTarget=`${home.x},${home.y}`;
 recordNeighborFoodFact(s,c,home,0);
 assert.equal(s.revelationEvidence.family,undefined);
 recordNeighborFoodFact(s,c,home,1);
 assert.equal(s.revelationEvidence.family.citizenId,c.id);
 const site={type:'house',x:12,y:8,level:1,construction:{kind:'new',target:1,required:{},delivered:{},work:11}};
 Object.assign(s.godhood,{stage:'recognized',believerIds:[c.id],witnessId:c.id,recognitionAt:0});
 Object.assign(c,{role:'builder',calling:'builder',siteDuty:'builder',phase:'constructing',site:'12,8',x:12,y:8});
 assert.equal(recordBuilderCompletion(s,site),false);
 assert.equal(s.revelationEvidence.building,undefined);
 site.construction.work=12;
 assert.equal(recordBuilderCompletion(s,site),true);
 assert.equal(s.revelationEvidence.building.citizenId,c.id);
 const field={type:'field',x:13,y:8};
 recordFieldGrain(s,field,c,0,0);
 assert.equal(s.revelationEvidence.food,undefined);
 recordFieldGrain(s,field,c,4,0);
 assert.equal(revelationEvidenceView(s).count,3);
});
