import test from 'node:test';
import assert from 'node:assert/strict';
import {recordCivicAidReaction,civicTrustAdjustment,validateResidentReactions} from '../resident-reactions.js';

test('a fulfilled order matters differently to a hungry recipient and a keeper with low stock',()=>{
 const recipient={id:1,mood:23},keeper={id:2,mood:27,work:'9,8',guardPost:'9,8'};
 const state={simTime:60,citizens:[recipient,keeper],buildings:[{x:9,y:8,stock:{food:4}}],
  civicOrder:{case:{aid:3,person:1,home:'8,8'}}};
 const job={id:3,source:'9,8',amount:2,delivered:1};
 recordCivicAidReaction(state,job,0);
 assert.equal(recipient.reactions,undefined);
 job.delivered=2;
 recordCivicAidReaction(state,job,1);
 assert.deepEqual(recipient.reactions,[{day:1,kind:'aid',place:'8,8',change:4}]);
 assert.deepEqual(keeper.reactions,[{day:1,kind:'guardedAid',place:'9,8',change:-3}]);
 assert.equal(civicTrustAdjustment(state,recipient),5);
 assert.equal(civicTrustAdjustment(state,keeper),-3);
 recordCivicAidReaction(state,job,2);
 assert.equal(keeper.mood,24);
 assert.ok(validateResidentReactions(state));
 state.simTime=300;
 assert.equal(civicTrustAdjustment(state,keeper),0);
});
