// Offline inventory only. Never imports renderer modules or modifies art assets.
import {readFile, readdir, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const ART='assets/art-courtyard';
const sha=b=>createHash('sha256').update(b).digest('hex');
const order=(a,b)=>a.localeCompare(b,'en');
const groups=[];
function group(names,status,purpose,evidence){for(const name of names.split(' '))groups.push({file:name+'.glb',status,purpose,evidence});}
group('source-walk-male source-walk-female source-walk-child source-walk-adolescent','active','Основной набор жителей; пол/возраст, родная ходьба.','game3d/actors.js|sourceHuman');
group('human-native-male human-native-female human-native-child human-native-adolescent','fallback','Первый резерв соответствующего source-walk при ошибке загрузки.','game3d/actors.js|return human(\'human-native-\'');
group('sumer-people sumer-child sumer-adolescent','fallback','Следующий резерв мужчин/детей/подростков после native; у женщин этого резерва нет.','game3d/actors.js|catch');
group('resident','fallback','Последний резерв взрослого мужчины; также художественный двор.','game3d/actors.js|return human(\'resident\')');
group('resident-lod','optional','Только benchmark художественного двора; не основной городской LOD.','courtyard/app.js|stress?model(\'resident-lod\')');
group('historical-man','active','Жрец/музыкант: дополнительный облик реального взрослого мужчины, загрузка по потребности.','game3d/actors.js|requestHistoricalResident');
group('sheep','active','Основное стадо овец симуляции; также художественный двор.','game3d/actors.js|load(\'sheep\')');
group('goat-downloaded','active','Основная коза симуляции; исходный Idle, добавленная проектом ходьба.','game3d/actors.js|variants:[\'downloaded\']');
group('goat-authored-lod','optional','Авторская коза через API createGameGoats; main явно выбирает только downloaded.','game3d/goats.js|authored:');
group('goat-authored goat','spare','Сохранённая авторская полная коза / исходная загруженная коза; вызова загрузки в runtime нет.','assets/art-courtyard/ATTRIBUTION.md|## Goats');
group('cat-walk cat-sitting gazelle-downloaded','active','Кошки/газели симуляции; два независимых кошачьих рига переключаются по действию.','game3d/imported-fauna.js|IMPORTED_FAUNA_MODELS');
group('ambient-bull','active','Декоративный бык, коровы/телята молочного двора и отдельные рабочие волы.','game3d/ambient-fauna.js|dairyHerd');
group('ambient-dog ambient-duck ambient-sheep-kenchoo imported-boar imported-fox imported-lioness imported-orange-bird','active','Дополнительная фауна; декоративные актёры не являются отдельными ресурсами/животными сохранения.','game3d/ambient-fauna.js|AMBIENT_MODELS');
group('ambient-yard-pig','active','Домашняя свинья у двора с исходной анимацией на месте.','game3d/ambient-fauna.js|YARD_PIG_MODEL');
group('shore-mallard','active','Селезень кряквы у берега.','game3d/ambient-fauna.js|SHORE_MODELS');
group('shore-mallard-female','active','Самка кряквы у берега. Добавлен клип покоя.','game3d/ambient-fauna.js|SHORE_MODELS');
group('shore-seagull','optional','Чайка в отдельных сценах, скрыта на основной карте.','game3d/ambient-fauna.js|SHORE_MODELS');
group('imported-goose imported-sky-birds','spare','Сохранённый импорт; ни одного имени в текущих runtime-путях загрузки.','assets/art-courtyard/ATTRIBUTION.md|Imported city fauna');
group('sky-bird-single','optional','API декоративного полёта; main отключает includeSkyBirds. Небесные стаи main процедурные.','game3d/actors.js|includeSkyBirds:false');
group('jackal','active','Шакалы похоронного обряда; художественная адаптация Wolf.','game3d/jackals.js|JACKAL_MODEL');
group('caravan-merchant','active','Купец только прежней ветви; адаптирован из средневекового источника. Строгая ветвь использует source-walk-male.','game3d/caravan.js|CARAVAN_MODELS');
group('caravan-camel','active','Верблюд только прежней исторической ветви; в строгой ветви не запрашивается.','game3d/caravan.js|CARAVAN_MODELS');
group('ambient-donkey','active','Декоративный осёл и вьючный караван строгой шумерской ветви с реальным stock; источник GLB общий.','game3d/caravan.js|SUMER_CARAVAN_MODEL');
group('river-cargo-boat','active','Речной визит только прежней ветви; производная от современной реконструкции Viking boat. Строгая лодка процедурная, эту GLB не запрашивает.','game3d/river-craft.js|RIVER_CRAFT_MODEL');
group('adobe-courtyard','optional','Художественный двор courtyard.html; HOME_ASSET в buildings.js — неиспользуемая константа.','courtyard/app.js|model(\'adobe-courtyard\')');
group('date-palm','fallback','Резерв основной valley-date-palm при ошибке; также художественный двор.','game3d/landscape.js|if(!palmSources.length)');
group('valley-date-palm','active','Основные пальмы долины/лесозаготовок; также crop-studio.','game3d/valley-vegetation.js|palm:');
group('valley-barley crop-emmer','active','Детали зрелых полей; при ошибке остаётся процедурный посев. Определение вида художественное.','game3d/field-crops.js|CROP_ASSET');
group('valley-dry-grass-1 valley-dry-grass-2 valley-dry-grass-3 valley-reed-1 valley-reed-2 valley-reed-3 miracle-green-grass-1 miracle-green-grass-2 miracle-green-grass-3','active','Растительность обычной долины; зелёная трава также в чудесном саду.','game3d/valley-vegetation.js|VALLEY_PLANT_ASSETS');
group('miracle-birch-1 miracle-cactus-1 miracle-cactus-2 miracle-daisy-1 miracle-daisy-2 miracle-lilac-1 miracle-lilac-2 miracle-snowdrop-1 miracle-snowdrop-2','active','Только временный чудесный сад; фантазия, не обычная историческая флора.','game3d/miracle-garden.js|MIRACLE_PLANT_ASSETS');
group('sacred-ishtar-gate sacred-shrine-3 sacred-ziggurat-1 sacred-ziggurat-3','active','Готовое священное здание только прежней ветви; строгая ветвь использует сырцовую процедурную архитектуру без этих GLB.','game3d/sacred-models.js|SACRED_MODELS');
group('supplied-pelican-wasis supplied-common-quail supplied-frog-jump','active','Импортированные обитатели берега; пеликан использует эту модель на воде.','game3d/supplied-fauna.js|supplied-');
group('supplied-yellowfin-goby supplied-oriental-goby','optional','Замена живой рыбы в тестовом режиме карты.','game3d/supplied-fauna.js|fishModels');
group('supplied-northern-cardinal supplied-horse-run supplied-white-eagle supplied-schlegel-frog supplied-realistic-rat supplied-horse-brown supplied-cobra-base supplied-cobra-head-up','spare','Импорт из подборки, просмотр в атласе.','model-atlas/supplied-fauna.js|supplied-');
group('festival-candle','active','Свеча Ночи огней в прежней ветке; в режиме Южного Шумера используется светильник из раковины.','game3d/festival-candles.js|festival-candle.glb');

export function readGlb(bytes){
 if(bytes.length<20||bytes.toString('ascii',0,4)!=='glTF'||bytes.readUInt32LE(4)!==2||bytes.readUInt32LE(8)!==bytes.length)throw Error('Invalid GLB header');
 const length=bytes.readUInt32LE(12);
 if(bytes.readUInt32LE(16)!==0x4e4f534a||20+length>bytes.length)throw Error('Missing GLB JSON chunk');
 return JSON.parse(bytes.toString('utf8',20,20+length));
}
function provenance(extras,path='asset.extras'){
 if(!extras||typeof extras!=='object')return [];
 const found=['author','license','source'].every(k=>typeof extras[k]==='string')?[{author:extras.author,license:extras.license,source:extras.source,evidence:path}]:[];
 // Source provenance is nested in native_resident.provenance and original.
 for(const [k,v] of Object.entries(extras))if(v&&typeof v==='object')found.push(...provenance(v,path+'.'+k));
 return found.filter((v,i,a)=>a.findIndex(x=>x.author===v.author&&x.source===v.source&&x.license===v.license)===i);
}
function documentedSources(file){
 const evidence=ART+'/ATTRIBUTION.md';
 if(file.startsWith('resident'))return [{author:'Innerscene / MakeHuman-MPFB; Sam brisk walk',source:'https://www.innerscene.com/tools/library/3d-parts/human-base-mesh-with-editable-53-bone-rig-8e7c8ab1',license:'CC0-1.0',evidence:evidence+'#resident--cc0-10'},{author:'Innerscene — Sam brisk walk',source:'https://www.innerscene.com/tools/library/3d-parts/brisk-walk-sam-3d-person-animated-bed03fa4',license:'CC0-1.0',evidence:evidence+'#resident--cc0-10'}];
 if(file==='sheep.glb')return [{author:'p0ss; texture basis titus tscharntke',source:'https://opengameart.org/content/sheep-rigged-textured-and-animated',license:'CC-BY-SA-3.0',evidence:evidence+'#sheep--cc-by-sa-30'}];
 if(file==='date-palm.glb')return [{author:'Innerscene; bark Poly Haven',source:'https://www.innerscene.com/tools/library/3d-parts/mature-date-palm-tree-af8bdc6f',license:'CC0-1.0',evidence:evidence+'#date-palm--cc0-10'}];
 if(file==='adobe-courtyard.glb')return [{author:'New Babylon; photo materials Poly Haven',source:'scripts/art-courtyard/prepare_courtyard.py',license:'Project-authored geometry; explicit standalone asset license not recorded. Photo materials CC0.',evidence:evidence+'#lighting-and-architecture'}];
 if(file.startsWith('goat-authored'))return [{author:'New Babylon',source:'scripts/art-courtyard/create_goat.py',license:'Project-authored; explicit standalone asset license not recorded.',evidence:evidence+'#goats--original-project-model-and-gerardoa400--cc-by-40'}];
 return [];
}

async function jsFiles(root,dir=''){
 const result=[];
 for(const entry of await readdir(join(root,dir),{withFileTypes:true})){
  const file=dir?dir+'/'+entry.name:entry.name;
  if(entry.isFile()&&entry.name.endsWith('.js')&&file!=='game3d/model-versions.js')result.push(file);
  if(entry.isDirectory()&&['game3d','courtyard','district3d'].includes(file))result.push(...await jsFiles(root,file));
 }
 return result.sort(order);
}
// This is deliberately a conservative lexical audit, not a JavaScript evaluator.
// Dynamic actor/courtyard name expansion is explicit below; no renderer is run.
export function scanReferences(sources){
 const refs=[];
 for(const [file,code] of Object.entries(sources))for(const [i,line] of code.split('\n').entries()){
  for(const match of line.matchAll(/\b([a-z0-9]+(?:-[a-z0-9]+)*\.glb)\b/g))refs.push({model:match[1],file,line:i+1,kind:'literal'});
  if(file==='courtyard/app.js')for(const match of line.matchAll(/\bmodel\('([a-z0-9-]+)'\)/g))refs.push({model:match[1]+'.glb',file,line:i+1,kind:'dynamic-name'});
 }
 const actor=sources['game3d/actors.js'];
 if(actor){
  const add=(name,needle)=>{const line=actor.split('\n').findIndex(s=>s.includes(needle));if(line<0)throw Error('Actor model expansion changed: '+needle);refs.push({model:name+'.glb',file:'game3d/actors.js',line:line+1,kind:'reviewed-dynamic-expansion'});};
  for(const token of ["human('source-walk-'+variant","human('human-native-'+variant","human('sumer-'+age)"])if(!actor.includes(token))throw Error('Actor model expansion changed: '+token);
  // Read caller-selected variants, so a new age/sex cannot silently disappear.
  const ages=[...actor.matchAll(/\bageSource\('([a-z0-9-]+)'\)/g)].map(m=>m[1]);
  const variants=new Set([...ages,...[...actor.matchAll(/\bsourceHuman\('([a-z0-9-]+)'\)/g)].map(m=>m[1])]);
  for(const variant of variants){add('source-walk-'+variant,"human('source-walk-'+variant");add('human-native-'+variant,"human('human-native-'+variant");}
  for(const match of actor.matchAll(/\b(?:human|load)\('([a-z0-9-]+)'\)/g))add(match[1],"'"+match[1]+"'");
  for(const name of ages)add('sumer-'+name,"human('sumer-'+age)");
 }
 return refs.sort((a,b)=>order(a.model,b.model)||order(a.file,b.file)||a.line-b.line);
}

export function reconcile({disk,manifest,versions,refs,classified}){
 const errors=[];
 for(const [label,items] of [['disk',disk],['manifest',manifest.map(x=>x.file)],['classification',classified]])if(new Set(items).size!==items.length)errors.push('Duplicate '+label+' model');
 const all=new Set([...disk,...manifest.map(x=>x.file),...Object.keys(versions),...refs.map(x=>x.model),...classified]);
 for(const file of [...all].sort(order)){
  if(!disk.includes(file))errors.push(file+': missing on disk');
  if(!manifest.some(x=>x.file===file))errors.push(file+': missing manifest row');
  if(!Object.hasOwn(versions,file))errors.push(file+': missing model-versions row');
  if(!classified.includes(file))errors.push(file+': missing reviewed classification');
 }
 return errors;
}

export async function buildIndex(root=ROOT){
 const read=file=>readFile(join(root,file),'utf8');
 const manifest=JSON.parse(await read(ART+'/manifest.json'));
 const versionText=await read('game3d/model-versions.js');
 const versions=Object.fromEntries([...versionText.matchAll(/"([a-z0-9-]+\.glb)":\s*"([a-f0-9]+)"/g)].map(m=>[m[1],m[2]]));
 const disk=(await readdir(join(root,ART,'models'))).filter(x=>x.endsWith('.glb')).sort(order);
 const manifestModels=manifest.files.filter(x=>x.file.endsWith('.glb')).map(x=>({...x,file:x.file.replace(/^models\//,'')}));
 const sources={};for(const file of await jsFiles(root))sources[file]=await read(file);
 const refs=scanReferences(sources);
 const errors=reconcile({disk,manifest:manifestModels,versions,refs,classified:groups.map(x=>x.file)});
 // Fail closed when main defaults controlling optional classifications change.
 for(const token of ["variants:['downloaded']",'includeSkyBirds:false'])if(!sources['game3d/actors.js'].includes(token))errors.push('Review main selection: '+token);
 const models=[];
 for(const file of disk){
  const bytes=await readFile(join(root,ART,'models',file)),glb=readGlb(bytes),entry=manifestModels.find(x=>x.file===file),rule=groups.find(x=>x.file===file);
  const hash=sha(bytes);
  if(entry?.bytes!==bytes.length)errors.push(file+': stale manifest bytes');
  if(entry?.sha256!==hash)errors.push(file+': stale manifest SHA256');
  if(versions[file]!==hash.slice(0,12))errors.push(file+': stale model-versions hash');
  let origins=provenance(glb.asset?.extras);if(!origins.length)origins=documentedSources(file);
  if(file==='historical-man.glb'){const report=JSON.parse(await read(ART+'/historical-man-report.json'));origins.push({...report.walk_source,evidence:ART+'/historical-man-report.json#walk_source'});}
  if(!origins.length)errors.push(file+': source/license evidence missing');
  if(rule){const [evidence,needle]=rule.evidence.split('|');const text=sources[evidence]??await read(evidence);if(!text.includes(needle))errors.push(file+': stale classification evidence '+rule.evidence);}
  const references=refs.filter(x=>x.model===file);
  if(rule?.status!=='spare'&&!references.length)errors.push(file+': classified runtime model has no reference');
  if(rule?.status==='spare'&&references.length)errors.push(file+': spare now referenced; review usage');
  models.push({file,status:rule?.status??'unclassified',purpose:rule?.purpose??'Unknown',classificationEvidence:rule?.evidence,bytes:bytes.length,sha256:hash,version:versions[file]??null,triangles:entry?.triangles??null,meshes:entry?.meshes??null,bones:entry?.bones??null,clips:(glb.animations??[]).map(x=>x.name??''),sources:origins,references});
 }
 // Source fingerprints make --check flag edits even when names stay the same.
 const runtimeInputs=Object.entries(sources).filter(([file,code])=>refs.some(x=>x.file===file)||/loadModel\(|LoadAssetContainerAsync|ImportMeshAsync/.test(code)).map(([file,code])=>({file,sha256:sha(code)}));
 const counts={total:models.length,...Object.fromEntries(['active','fallback','optional','spare'].map(s=>[s,models.filter(m=>m.status===s).length]))};
 return {schemaVersion:1,manifestRelease:manifest.release,scope:'Local shipped GLBs in assets/art-courtyard/models; current main game plus explicitly separate courtyard/crop studios. Procedural meshes and Downloads originals excluded.',counts,errors,runtimeInputs,models};
}

const cell=value=>String(value??'—').replaceAll('|','\\|').replaceAll('\n',' ');
function link(path,label=path){return `[${label}](../${path})`;}
export function renderMarkdown(index){
 const labels={active:'Активна',fallback:'Резерв при ошибке',optional:'Опция / студия',spare:'Запас без загрузки'};
 const lines=['# Актуальный индекс моделей','',`Сгенерировано командой \`node scripts/model-index.mjs\`. Проверка: \`node scripts/model-index.mjs --check\`. Выпуск manifest: \`${index.manifestRelease}\`. Машиночитаемые данные: [model-index.json](model-index.json). Не редактировать таблицу вручную.`, '',`На диске / в manifest / в model-versions: **${index.counts.total} GLB**. Активных: **${index.counts.active}**, резервов при ошибке: **${index.counts.fallback}**, опций/студий: **${index.counts.optional}**, запасных без загрузки: **${index.counts.spare}**. Ошибок сверки: **${index.errors.length}**.`, '', '«Активна» означает достижимый путь основного города, включая детали по событию/первому использованию и необязательные украшения с процедурным резервом. Это не число одновременно загруженных GLB. «Опция» означает API, выключенный main, или отдельную студию. «Запас» — отсутствует путь загрузки в проверенных исходниках; наличие файла в manifest само по себе не делает его активным.', '', 'Имена, байты и SHA256 проверяются по реальным GLB, manifest и model-versions; клипы читаются из GLB. Источники/лицензии берутся из встроенных asset.extras, для старых файлов — из ATTRIBUTION.md. Назначение и достижимость — явно проверяемая классификация в генераторе, а не вывод из имени файла. JSON хранит все места упоминаний, доказательство классификации и отпечатки исходников. Упоминание может быть неиспользуемой константой, поэтому само по себе не доказывает загрузку.', '', 'Ограничения: это консервативная статическая сверка локального JS, не выполнение сцены и не универсальный анализатор JavaScript. Динамические имена жителей и courtyard раскрыты отдельными адаптерами. Новый шаблон динамической загрузки требует обновить адаптер/классификацию. Источники подтверждают записанную атрибуцию, не новое юридическое разрешение. Standard остаётся Standard; отдельное разрешение пользователя записано в ATTRIBUTION.md, документ от автора в репозитории не приложен. У оригинальной геометрии проекта без указанной отдельной лицензии она честно помечена как неуказанная.', '', 'Исторические границы: индекс ничего не добавляет в игру. Шумерское основание одежды/материалов описано в [Met Museum](https://www.metmuseum.org/art/collection/search/325456) и [Penn Museum](https://www.penn.museum/sites/expedition/adaptation-and-change/); конкретные костюмы, виды зверей и ботаника остаются стилизацией. Свеча, поздние вавилонские чудеса, верблюд и исходная лодка Viking не становятся подтверждёнными шумерскими реконструкциями из-за присутствия в таблице. Чудесный сад явно фантастический.', '', 'Прежние датированные MODEL_INVENTORY_* — исторические снимки. Они не переписаны: числа 60/65 и прежние «основные» жители относятся к своим выпускам. Сейчас source-walk основной; human-native → sumer → resident — цепочки отказа (женская цепочка короче). Adobe GLB используется в художественном дворе; HOME_ASSET в buildings.js не загружается. Imported goose/старая стая сохранены без загрузки, sky-bird-single выключена в main, его небесные стаи процедурные.', '', '| Файл | Статус / назначение | Байты / треугольники | Источник, автор и лицензия | Доказательство |','|---|---|---:|---|---|'];
 for(const m of index.models){
  const origins=m.sources.map(s=>`${/^https?:/.test(s.source)?`[${cell(s.author)}](${s.source})`:link(s.source,cell(s.author))} — ${cell(s.license)} (${s.evidence.startsWith('asset.')?'GLB '+cell(s.evidence):link(s.evidence,'запись')})`).join('<br>');
  const [path,needle]=(m.classificationEvidence??'').split('|');
  lines.push(`| ${link(ART+'/models/'+m.file,'`'+m.file+'`')} | **${labels[m.status]??m.status}**. ${cell(m.purpose)} | ${m.bytes} / ${m.triangles??'—'} | ${origins} | ${link(path,'код/источник')} · ${cell(needle)} |`);
 }
 if(index.errors.length)lines.push('','Ошибки сверки:','',...index.errors.map(x=>'- '+x));
 return lines.join('\n')+'\n';
}

async function main(){
 const args=process.argv.slice(2);if(args.some(a=>a!=='--check'))throw Error('Usage: node scripts/model-index.mjs [--check]');
 const index=await buildIndex(),outputs=[['docs/model-index.json',JSON.stringify(index,null,2)+'\n'],['docs/MODEL_INDEX.md',renderMarkdown(index)]];
 if(index.errors.length)throw Error(index.errors.join('\n'));
 for(const [path,content] of outputs){if(args.includes('--check')){if(await readFile(join(ROOT,path),'utf8')!==content)throw Error('Stale generated index: '+path+'; run node scripts/model-index.mjs');}else await writeFile(join(ROOT,path),content);}
 console.log(JSON.stringify({check:args.includes('--check'),manifestRelease:index.manifestRelease,...index.counts,errors:index.errors.length}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))main().catch(error=>{console.error(error.message);process.exitCode=1;});
