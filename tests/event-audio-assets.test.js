import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';
import {EVENT_MUSIC_TRACKS} from '../city-audio.js';
const root=new URL('../assets/audio/',import.meta.url);
test('ten supplied compressed recordings are copied byte-for-byte with clean filenames and playable metadata',()=>{
 const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.tracks.length,10);assert.deepEqual(new Set(manifest.tracks.map(t=>t.file)),new Set(Object.values(EVENT_MUSIC_TRACKS)));
 for(const track of manifest.tracks){const bytes=fs.readFileSync(new URL(track.file,root));assert.equal(bytes.length,track.asset.bytes);assert.equal(bytes.length,track.source.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),track.asset.sha256);assert.equal(track.asset.sha256,track.source.sha256);assert.ok(track.asset.duration>1);assert.equal(track.asset.codec,'mp3');assert.ok([1,2].includes(track.asset.channels));assert.ok(track.asset.sampleRate>=22050);assert.equal(track.file,track.source.name.replace(/-\d{13}-[A-Za-z0-9]+-compressed(?=\.mp3$)/,'').normalize('NFC'));}
 assert.deepEqual(new Set(fs.readdirSync(root).filter(f=>f.endsWith('.mp3')).map(f=>f.normalize('NFC'))),new Set(Object.values(EVENT_MUSIC_TRACKS)));
});
