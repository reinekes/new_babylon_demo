#!/usr/bin/env node
/** Build inert, structured content. The user Markdown is source material, never code. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const sourceURL=new URL('../docs/SONGS_TEXTS_TRANSLATIONS_2026-10-27.md',import.meta.url);
const outputURL=new URL('../assets/encyclopedia/songs.json',import.meta.url);
const IDS=['inanna','enki','descent','drinking-song','night-feast'];
function cells(line){return line.split('|').slice(1,-1).map(s=>s.trim());}
function blocks(text){
 const lines=text.trim().split('\n'),out=[];let i=0;
 while(i<lines.length){const line=lines[i];if(!line.trim()){i++;continue;}
  if(line==='```text'){let text=[];i++;while(i<lines.length&&lines[i]!=='```')text.push(lines[i++]);if(lines[i]!=='```')throw Error('Незакрытый текст исполнения');i++;out.push({type:'lyrics',text:text.join('\n')});continue;}
  const heading=line.match(/^(#{1,6}) (.+)$/);if(heading){out.push({type:'heading',level:heading[1].length,text:heading[2]});i++;continue;}
  if(line.startsWith('|')){const headers=cells(line),separator=lines[i+1];if(!separator||!/^\|[\s|:-]+\|$/.test(separator))throw Error('Некорректная таблица');i+=2;const rows=[];while(i<lines.length&&lines[i].startsWith('|')){const row=cells(lines[i++]);if(row.length!==headers.length)throw Error('Не совпадают колонки таблицы');rows.push(row);}out.push({type:'table',headers,rows});continue;}
  if(line.startsWith('- ')){const items=[];while(i<lines.length&&lines[i].startsWith('- '))items.push(lines[i++].slice(2));out.push({type:'list',items});continue;}
  const paragraph=[];while(i<lines.length&&lines[i].trim()&&!/^(#{1,6} |\||- |```)/.test(lines[i]))paragraph.push(lines[i++]);
  if(!paragraph.length)throw Error(`Неподдерживаемый блок: ${line.slice(0,40)}`);
  out.push({type:'paragraph',text:paragraph.join('\n')});
 }
 return out;
}
export function buildSongEncyclopedia(source){
 const normalized=source.replace(/\r\n/g,'\n');
 const matches=[...normalized.matchAll(/^## (\d+)\. (.+)\n([\s\S]*?)(?=^## |$(?![\s\S]))/gm)];
 if(matches.length!==5||matches.some((m,i)=>Number(m[1])!==i+1))throw Error('Ожидались ровно пять песенных статей (1–5)');
 const caveats=normalized.match(/^## Как читать и использовать сборник\n([\s\S]*?)(?=^## )/m)?.[1];
 const principles=normalized.match(/^## Принципы будущей энциклопедической карточки\n([\s\S]*)$/m)?.[1];
 const contents=normalized.match(/^## Состав\n([\s\S]*?)(?=^## )/m)?.[1];
 if(!caveats||!principles||!contents)throw Error('Не найдены пояснения или состав сборника');
 const summaries=blocks(contents).find(b=>b.type==='table')?.rows;
 if(summaries?.length!==5)throw Error('Состав сборника должен перечислять пять песен');
 const articles=matches.map((m,i)=>{const content=blocks(m[3]);if(content.filter(b=>b.type==='lyrics').length!==1||content.filter(b=>b.type==='table').length!==1)throw Error(`Неполная песенная статья ${i+1}`);return {id:IDS[i],number:i+1,title:m[2],shortTitle:summaries[i][1],work:summaries[i][2],usage:summaries[i][3],blocks:content};});
 return {format:1,title:'Песни Нового Вавилона',source:{name:'SONGS_TEXTS_TRANSLATIONS_2026-10-27.md',sha256:createHash('sha256').update(source).digest('hex')},caveats:blocks(caveats),principles:blocks(principles),articles};
}
export async function generateSongEncyclopedia({check=false}={}){
 const source=await readFile(sourceURL,'utf8'),data=buildSongEncyclopedia(source),json=JSON.stringify(data,null,2)+'\n';
 if(check){const saved=await readFile(outputURL,'utf8');if(saved!==json)throw Error('Энциклопедия отличается от исходного сборника: запустите генератор');}
 else{await mkdir(new URL('../assets/encyclopedia/',import.meta.url),{recursive:true});await writeFile(outputURL,json);}
 return {articles:data.articles.length,bytes:Buffer.byteLength(json),sourceSHA256:data.source.sha256};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await generateSongEncyclopedia({check:process.argv.includes('--check')})));
