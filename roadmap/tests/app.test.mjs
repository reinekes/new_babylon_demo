import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {JSDOM} from 'jsdom';

function app() {
  const shell=fs.readFileSync(new URL('../assets/shell.html',import.meta.url),'utf8').replace(/<script[\s\S]*?<\/script>/g,'');
  const dom=new JSDOM(shell,{url:'https://example.test/roadmap/',runScripts:'outside-only'});
  dom.window.ROADMAP_DATA={schema:1,asOf:'2026-11-03',builtAt:'2026-11-03',groups:{performance:'Производительность'},statuses:{planned:'Запланировано',verify:'Проверить'},tasks:[],releases:[],history:[],documents:[],overview:'',guide:'',planRaw:'# План\n',completedIds:[],manifest:{reports:[]}};
  dom.window.eval(fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8'));
  return {dom,api:dom.window.Roadmap};
}

test('Markdown rendering cannot execute raw HTML or javascript URLs',()=>{
  const {dom,api}=app();
  const html=api.markdown('<img src=x onerror=alert(1)>\n\n[опасно](javascript:alert(1))\n\n[источник](https://example.com)');
  const el=dom.window.document.createElement('div');el.innerHTML=html;
  assert.equal(el.querySelector('img'),null);
  assert.equal(el.querySelector('[onerror]'),null);
  assert.ok([...el.querySelectorAll('a')].every(a=>!a.href.startsWith('javascript:')));
  assert.match(el.textContent,/img src/);
  dom.window.close();
});

test('completion export moves exactly the selected IDs and keeps their full evidence',()=>{
  const {dom,api}=app();
  const raw='# План\nupdated: 2026-11-03\n\n## first | Первый\ngroup: performance\nstatus: verify\npriority: P0\ndepends: -\nsources: engine.js\n\n### Готово когда\nИзмерен настоящий FPS.\n\n## second | Второй\ngroup: performance\nstatus: planned\npriority: P1\ndepends: first\nsources: engine.js\n\n### Описание\nПродолжение.\n';
  const tasks=api.parseRecords(raw).map(r=>({...r,depends:r.fields.depends==='-'?[]:[r.fields.depends],group:r.fields.group}));
  const result=api.createTransfer({tasks,planRaw:raw,completedIds:[],manifest:{reports:['reports/2026-11-03.md']}},['first'],{date:'2026-11-04',version:'test-release',commit:'',note:'Проверено владельцем'});
  assert.ok(!result.plan.includes('## first |'));
  assert.ok(result.plan.includes('## second |'));
  assert.match(result.report,/completed: first/);
  assert.match(result.report,/Измерен настоящий FPS/);
  assert.match(result.report,/publication: not_published/);
  assert.match(result.plan,/updated: 2026-11-04/);
  assert.throws(()=>api.createTransfer({tasks,planRaw:raw,completedIds:[],manifest:{reports:[]}},['second'],{date:'2026-11-04'}),/зависим/i);
  dom.window.close();
});

test('filters and local completion are separate from canonical status',()=>{
  const {dom,api}=app();
  api.setData({...dom.window.ROADMAP_DATA,tasks:[{id:'fps',title:'Проверить FPS',group:'performance',status:'verify',priority:'P0',depends:[],sources:[],sections:{Описание:'CPU — отдельно.'},raw:''}]});
  dom.window.document.querySelector('[data-view="plan"]').click();
  const box=dom.window.document.querySelector('[data-task-check="fps"]');assert.ok(box);box.click();
  assert.equal(api.getData().tasks[0].status,'verify');
  assert.match(dom.window.document.querySelector('#selection-info').textContent,/1/);
  assert.equal(dom.window.localStorage.getItem('new-babylon-roadmap-v1'), '["fps"]');
  dom.window.close();
});

test('portable HTML and real-plan ZIP roundtrip retain remaining dependencies and UTF-8',async()=>{
  const {spawnSync}=await import('node:child_process');
  const {mkdtempSync,writeFileSync,rmSync}=await import('node:fs');
  const {tmpdir}=await import('node:os');
  const {join,resolve}=await import('node:path');
  const errors=[];
  const {VirtualConsole}=await import('jsdom');
  const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
  const dom=new JSDOM(fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),{url:'file:///portable/index.html',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){w.TextEncoder=TextEncoder;}});
  const api=dom.window.Roadmap,state=api.getData();
  assert.equal(state.tasks.length,(fs.readFileSync(new URL('../plan.md',import.meta.url),'utf8').match(/^## /gm)||[]).length);assert.equal(state.history.length,13);
  assert.ok(state.releases.filter(x=>x.type==='release').length>=44);
  const transfer=api.createTransfer(state,['perf-city-4x'],{date:'2026-11-04',note:'Проверка передачи UTF-8: город и жители'});
  const folder=mkdtempSync(join(tmpdir(),'babylon-roadmap-'));
  try{
    const path=join(folder,'update.zip');writeFileSync(path,api.zip(transfer.files));
    const result=spawnSync('python3',['-c',`import sys,zipfile,importlib.util,pathlib,json
spec=importlib.util.spec_from_file_location('roadmap_build',sys.argv[2]); m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with zipfile.ZipFile(sys.argv[1]) as z:
 assert z.testzip() is None
 assert sorted(z.namelist())==['plan.md','reports/2026-11-04.md']
 plan=z.read('plan.md').decode();report=z.read('reports/2026-11-04.md').decode()
 tasks=[m.task_from_record(r,'roadmap/plan.md') for r in m.parse_records(plan)]
 records=m.parse_records(report);assert len(records)==1
 done=m.split_field(records[0]['fields']['completed']);assert done==['perf-city-4x']
 assert len(tasks)==int(sys.argv[3]) and 'город и жители' in report
 m.validate_tasks(tasks,done+json.loads(sys.argv[4]),pathlib.Path(sys.argv[2]).resolve().parent.parent)
 print(f'ZIP roundtrip PASS: {len(tasks)} remaining, 1 archived, dependencies valid')`,path,resolve('roadmap/build.py'),String(state.tasks.length-1),JSON.stringify(state.completedIds)],{encoding:'utf8'});
    assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/PASS/);
    assert.deepEqual(errors,[]);
  }finally{rmSync(folder,{recursive:true,force:true});dom.window.close();}
});
