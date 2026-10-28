import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSongEncyclopedia } from '../scripts/build-song-encyclopedia.mjs';
import { encyclopediaHTML, encyclopediaInlineHTML, searchEncyclopedia, renderSongEncyclopedia } from '../ui-encyclopedia.js';

const sourcePath = new URL('../docs/SONGS_TEXTS_TRANSLATIONS_2026-10-27.md', import.meta.url);
const source = await readFile(sourcePath, 'utf8').catch(error=>{if(error.code==='ENOENT')return null;throw error;});
const publishedData=JSON.parse(await readFile(new URL('../assets/encyclopedia/songs.json',import.meta.url),'utf8'));
const data = source===null?publishedData:buildSongEncyclopedia(source);
const articleSource = [...(source||'').matchAll(/^## (\d+)\. (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];

test('encyclopedia retains the six complete performance texts including every repeated line', {skip:source===null?'Protected user Markdown is not present in this checkout':false}, () => {
 assert.equal(data.articles.length, 6);
 for (const [i, match] of articleSource.entries()) {
  const lyrics = match[3].match(/```text\n([\s\S]*?)\n```/)[1];
  const block = data.articles[i].blocks.find(b => b.type === 'lyrics');
  assert.equal(block.text, lyrics, `full performance ${i+1}`);
  assert.equal(data.articles[i].title, match[2]);
 }
 assert.match(data.articles[4].blocks.find(b=>b.type==='lyrics').text, /Shag-nga shag hul-la ngal-la-bi[\s\S]*Shag-nga shag hul-la ngal-la-bi/);
});

test('all source translation rows, explanations and references survive the generated content', {skip:source===null?'Protected user Markdown is not present in this checkout':false}, () => {
 for (const [i, match] of articleSource.entries()) {
  const article=data.articles[i], expected=match[3].split('\n').filter(l=>l.startsWith('| ')&&!l.startsWith('| Текст из версии')).map(l=>l.split('|').slice(1,-1).map(s=>s.trim()));
  const table=article.blocks.find(b=>b.type==='table');
  assert.deepEqual(table.rows, expected);
  assert.equal(table.headers.length,3);
  for(const heading of ['Значение','Текст для исполнения','Перевод и соответствие строк','Примечания для энциклопедии']) assert.ok(article.blocks.some(b=>b.type==='heading'&&b.text===heading));
  for(const paragraph of match[3].split('### Промпт Suno')[0].replace(/```text\n[\s\S]*?\n```/g,'').split(/\n\s*\n/).map(p=>p.trim()).filter(p=>p&&!p.startsWith('#')&&!p.startsWith('|')&&!p.startsWith('```'))) {
   if(paragraph.includes('```'))continue;
   assert.ok(article.blocks.some(b=>b.text===paragraph.trim()),`article ${i+1}: ${paragraph.slice(0,60)}`);
  }
 }
});

test('source provenance and all historical boundaries are carried without changing the source', {skip:source===null?'Protected user Markdown is not present in this checkout':false}, async () => {
 assert.equal(data.source.sha256,createHash('sha256').update(source).digest('hex'));
 assert.equal(data.caveats.filter(b=>b.type==='list').flatMap(b=>b.items).length,6);
 const html=encyclopediaHTML(data);
 for(const phrase of ['Упрощённая запись','Смысловой перевод','современная','1800','III тысячелетия','Ночь огней']) assert.ok(html.includes(phrase),phrase);
 assert.equal(await readFile(sourcePath,'utf8'),source);
});

test('committed lazy JSON equals the deterministic build from the user source', {skip:source===null?'Protected user Markdown is not present in this checkout':false}, async () => {
 const built=JSON.parse(await readFile(new URL('../assets/encyclopedia/songs.json',import.meta.url),'utf8'));
 assert.deepEqual(built,data);
 assert.deepEqual(buildSongEncyclopedia(source),data);
 assert.throws(()=>buildSongEncyclopedia(source.replace('## 5. Сердце','## X. Сердце')),/шесть|6|стат/);
});

test('source material cannot execute HTML, script URLs or unexpected links', () => {
 const html=encyclopediaInlineHTML('<img src=x onerror=alert(1)> [опасно](javascript:alert) [чужой](https://evil.example/x) **слово** [источник](https://etcsl.orinst.ox.ac.uk/section5/tr55a.htm)');
 assert.ok(html.includes('&lt;img'));
 assert.ok(!html.includes('<img'));
 assert.ok(!html.includes('href="javascript:'));
 assert.ok(!html.includes('href="https://evil.'));
 assert.ok(html.includes('<strong>слово</strong>'));
 assert.ok(html.includes('rel="noopener noreferrer"'));
 assert.ok(html.includes('href="https://etcsl.orinst.ox.ac.uk/section5/tr55a.htm"'));
});

test('search matches titles, meaning, lyrics and translations without losing the complete article', () => {
 assert.deepEqual(searchEncyclopedia(data,'озера пива').map(a=>a.id),['night-feast']);
 assert.equal(searchEncyclopedia(data,'ниНКаСИ').length,1);
 assert.equal(searchEncyclopedia(data,'застольная').length,2);
 assert.ok(searchEncyclopedia(data,'Nin me shar-ra').some(a=>a.id==='inanna'));
 assert.ok(searchEncyclopedia(data,'Гаккуле').some(a=>a.id==='drinking-song'));
 assert.equal(searchEncyclopedia(data,'несуществующее-слово').length,0);
 const html=encyclopediaHTML(data,{selectedId:'night-feast',query:'озера пива'});
 assert.ok(html.includes('Shag-nga shag hul-la ngal-la-bi'));
 assert.ok(html.includes('role="tablist"'));
 assert.ok(html.includes('aria-selected="true"'));
 assert.match(html,/<audio controls preload="none"/);assert.ok(!html.includes('autoplay'));
});

function stubRoot(){return {innerHTML:'',listeners:[],ownerDocument:{activeElement:null},addEventListener(type,listener){this.listeners.push([type,listener]);},removeEventListener(type,listener){this.listeners=this.listeners.filter(v=>v[0]!==type||v[1]!==listener);},querySelector(){return null;},contains(){return false;}};}

test('opening loads content lazily once per mounted window and destroy removes handlers', async () => {
 const root=stubRoot();let requests=0;
 const fetcher=async(url)=>{requests++;assert.equal(String(url),'http://localhost/encyclopedia.json?v=test');return {ok:true,json:async()=>data};};
 assert.equal(requests,0);
 const ctl=await renderSongEncyclopedia(root,{fetcher,cache:false,dataUrl:new URL('http://localhost/encyclopedia.json?v=test')});
 assert.equal(requests,1);
 assert.ok(root.innerHTML.includes('Сияющая владычица'));
 assert.equal(await renderSongEncyclopedia(root,{fetcher,cache:false,dataUrl:new URL('http://localhost/encyclopedia.json?v=test')}),ctl);
 assert.equal(requests,1);
 ctl.select('drinking-song');assert.ok(root.innerHTML.includes('Gakkul-e gakkul-e'));
 ctl.destroy();assert.equal(root.listeners.length,0);
});

test('load failure displays a retry and a later opening can recover', async () => {
 const root=stubRoot();let requests=0;
 const ctl=await renderSongEncyclopedia(root,{cache:false,fetcher:async()=>{requests++;if(requests===1)throw Error('offline');return {ok:true,json:async()=>data};}});
 assert.ok(root.innerHTML.includes('Не удалось загрузить'));
 assert.ok(root.innerHTML.includes('data-encyclopedia-retry'));
 await ctl.retry();assert.equal(requests,2);assert.ok(root.innerHTML.includes('Город и судьба'));
 ctl.destroy();
});


test('published performances retain reviewed exact hashes and all 60 translation rows even without the user Markdown', () => {
 const expected=[['inanna','d5933567cf187fd8bc3ab9d61cc4933778f0ff2f76052a72f2d6090880d2dd88',5],['enki','fe1c29dbbb9d731da71d1f236df0188d2ed6e64c8ff6d5cd747a6175cc79229c',18],['descent','3b8ffa742ff021af7cc05559c1160a201472ed31414eca093bda012cc0f55be6',14],['drinking-song','6d535ab717064c99aa349a3cbcbe4313dabc089f4e9a638591147fc9a42b8b10',12],['night-feast','ff146401a619464426b27871491da3f68a75cbd116310dfab20beecda947d12a',11]];
 assert.equal(publishedData.articles.length,6);
 for(const [id,hash,rows]of expected){const article=publishedData.articles.find(a=>a.id===id);assert.ok(article);assert.equal(createHash('sha256').update(article.blocks.find(b=>b.type==='lyrics').text).digest('hex'),hash);assert.equal(article.blocks.find(b=>b.type==='table').rows.length,rows);}
 assert.match(publishedData.source.sha256,/^[a-f0-9]{64}$/);const last=publishedData.articles.find(a=>a.id==='city-lament');assert.ok(last);assert.equal(last.blocks.find(b=>b.type==='table').rows.length,7);
});

test('published meaning, translation, notes, sources and historical caveats retain the reviewed source snapshot',()=>{
 const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const expected={'inanna':'55d081b3a295298b477bc75279ead98c0c62eefd18064ee0f16499f5afbb6527','enki':'9d9b1976822eead4a79b8fc75c7341e9e5d5867d24cc7561a160c26d570cbc1a','descent':'6f6679b426eece75f090748dfab3465f56b492d1901812e5e869988beec7188b','drinking-song':'600b52268efb6257e33c6304635e0b5de541a5b7a99aa19a25c11194f77943f5','night-feast':'ce7b0454913b8a58b5d0969cba856198eb3c3b5fd5fa352f8a156f0721ac1fef'};
 for(const article of publishedData.articles.filter(a=>a.id!=='city-lament'))assert.equal(hash(article.blocks),expected[article.id],article.id);
 assert.equal(hash(publishedData.caveats),'bc766340ef04bec81d8c264257cbdfdeca9f4e8f9c232ab6b2dcba1cfd484611');
 assert.equal(hash(publishedData.principles),'5b2920cecead948c93b0155fc9924e47dbebf8107cdb1a17dc309591d0aa1b08');
});
