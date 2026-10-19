import test from 'node:test';import assert from 'node:assert/strict';
import {photoFilename,photoLighting} from '../photo-mode.js';
test('photo filename is dated and lighting changes only renderer preview, never city time',()=>{const s={year:7,season:2,simTime:480},r={lightMode:'auto'},before=structuredClone(s);assert.match(photoFilename(s,new Date('2026-10-19T12:00:00Z')),/new-babylon-y7-2026-10-19\.png/);assert.equal(photoLighting(r,'sunset'),'sunset');assert.equal(r.lightMode,'sunset');assert.deepEqual(s,before);assert.equal(photoLighting(r,'bad'),'auto');});
