import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceTime,createGame,decode,encode} from '../engine.js';
import {newCivicOrder,publishCivicLaw} from '../civic-order.js';
import {actorViewCitizens} from '../game3d/actors.js';
import {professionClothing} from '../work-clothing.js';

test('the named lawmaker handles the paid tablet at home, then resumes normal work',()=>{
 const s=createGame({start:'established'}),author=s.citizens[0];
 author.calling='lawmaker';s.civicOrder=newCivicOrder();
 for(const b of s.buildings.filter(b=>b.type==='house'))b.pantry=b.pantryDelivered=14;
 const stock=s.resources.clay;
 assert.ok(publishCivicLaw(s,author.id).ok);assert.equal(s.resources.clay,stock-1);
 let elapsed=0,copy=false,done=false;
 for(let i=0;i<900&&!done;i++){
  s.event=null;advanceTime(s,.12);
  const figure=actorViewCitizens(s).find(c=>c.id===author.id);
  if(figure?.activity?.task==='law-tablet'){
   assert.equal(author.phase,'home');assert.equal(figure.walking,false);
   assert.equal(professionClothing(figure,s.buildings,s).id,'lawmaker');
   assert.deepEqual([figure.x,figure.y],[author.x,author.y]);
   if(!copy){const raw=encode(s),restored=decode(raw);assert.ok(restored);assert.equal(raw,encode(restored));}
   copy=true;elapsed+=.12;
  }else if(copy)done=true;
 }
 assert.ok(copy&&done&&elapsed>=2);
 assert.equal(s.civicOrder.law.copyRemaining,undefined);
 assert.equal(publishCivicLaw(s,author.id).ok,false);
});
