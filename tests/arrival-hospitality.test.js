import assert from 'node:assert/strict';
import test from 'node:test';
import {createNewCity} from '../new-game.js';
import {encode,decode} from '../engine.js';
import {recordArrivalHospitality,arrivalHospitalityView} from '../arrival-hospitality.js';

test('only completed provisioned visits count once, and receipts survive reload',()=>{
 const s=createNewCity({mode:'awakening',seed:1}),g={phase:'returning',outcome:'accepted',destination:'6,7'};
 recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.phase='departed';g.outcome='interrupted';recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,0);
 g.outcome='accepted';recordArrivalHospitality(s,'envoy',g);recordArrivalHospitality(s,'envoy',g);
 assert.equal(arrivalHospitalityView(s).visits,1);
 recordArrivalHospitality(s,'artisan',{phase:'departed',outcome:'taught',fed:true,home:'6,7'});
 assert.equal(arrivalHospitalityView(s).visits,2);
 const raw=encode(s);assert.equal(encode(decode(raw)),raw);
 const broken=JSON.parse(raw);broken.arrivalHospitality.receipts[0].at=100;
 assert.equal(decode(JSON.stringify(broken)),null);
});
