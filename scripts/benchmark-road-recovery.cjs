/* Run against three already-served game revisions. Each trial starts from the same city. */
const fs = require('node:fs');
const path = require('node:path');
const {gunzipSync} = require('node:zlib');
const {createHash} = require('node:crypto');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright-core');

const [reference, shipped, fixed, output] = process.argv.slice(2);
if (!output) throw Error('Usage: node scripts/benchmark-road-recovery.cjs REFERENCE_URL SHIPPED_URL FIXED_URL OUTPUT.json');
const urls = {reference, shipped, fixed};
const order = ['reference', 'shipped', 'fixed', 'fixed', 'reference', 'shipped', 'shipped', 'fixed', 'reference'];
const save = gunzipSync(fs.readFileSync(path.join(__dirname, '../docs/benchmarks/2026-11-21-road-levels-city.json.gz'))).toString();
const instrumentation = `
window.roadBench = {
 get s(){return state}, r:renderer,
 rewind(raw){paused=true;state=decode(raw);renderer.state=state;renderer.resetPresentation();resetCityPresentation();update();},
 go(){setSpeed(4);paused=false;last=performance.now();},
 get running(){return speed===4&&!paused&&!dialog.open&&!state.event;}
};`;

async function measure(page, url) {
 await page.goto(url, {waitUntil:'domcontentloaded', timeout:95000});
 await page.waitForFunction(()=>window.roadBench, null, {timeout:90000});
 return page.evaluate(async raw=>{
  const q=window.roadBench, r=q.r;
  await r.detailsReady;
  await r.actors.residentDetailsReady?.();
  if (q.s.roads.length!==529 || q.s.population!==500 || q.s.buildings.length!==250 || r.mode!=='3d') throw Error('Wrong city or renderer');
  r.overview();
  const view=r.captureView();
  q.go();
  await new Promise(done=>setTimeout(done,12000));
  q.rewind(raw);
  r.restoreView(view);
  const start=q.s.simTime;
  q.go();
  const intervals=[];
  const elapsed=await new Promise(resolve=>{
   requestAnimationFrame(first=>{
    let last=first;
    function tick(now){
     intervals.push(now-last);
     last=now;
     if(now-first>=20000) resolve(now-first);
     else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
   });
  });
  const gl=r.engine._gl, extension=gl.getExtension('WEBGL_debug_renderer_info');
  const simulatedSeconds=q.s.simTime-start;
  if(!q.running || document.hidden || innerWidth!==1440 || innerHeight!==780 || simulatedSeconds<=0 ||
     r.engine.webGLVersion!==2 || r.detailQueue.errors.length || q.s.population!==500 || q.s.buildings.length!==250)
   throw Error('Invalid trial: city, camera viewport, simulation or renderer changed');
  const sorted=intervals.slice().sort((a,b)=>a-b);
  return {frames:intervals.length,realSeconds:elapsed/1000,fps:1000*intervals.length/elapsed,
   frameP95:sorted[Math.ceil(sorted.length*.95)-1],simulatedSeconds,people:q.s.population,buildings:q.s.buildings.length,
   speed:4,zoom:r.camera.radius,viewport:[innerWidth,innerHeight],webgl:r.engine.webGLVersion,
   gpu:gl.getParameter(extension?extension.UNMASKED_RENDERER_WEBGL:gl.RENDERER),frameIntervalsMs:intervals.map(t=>+t.toFixed(2))};
 },save);
}

(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,
  args:['--disable-quic','--ignore-gpu-blocklist','--no-first-run','--disable-renderer-backgrounding','--disable-background-timer-throttling','--force-device-scale-factor=1']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:780},deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.addInitScript(raw=>{if(location.protocol.startsWith('http'))localStorage.setItem('new-babylon-v1',raw);},save);
  await page.route(/\/app\.js(?:\?|$)/,async route=>{
   const response=await route.fetch();
   await route.fulfill({response,body:(await response.text())+instrumentation});
  });
  const result={fixtureSHA256:createHash('sha256').update(save).digest('hex'),browser:browser.version(),order,samples:[]};
  for (const name of order) {
   const sample=await measure(page,urls[name]);
   if(errors.length)throw Error(errors.join('\n'));
   result.samples.push({name,...sample});
   fs.writeFileSync(output,JSON.stringify(result)+'\n');
   console.log(name,sample.fps.toFixed(2),'FPS, p95',sample.frameP95.toFixed(1),'ms');
   await page.goto('about:blank');
  }
  result.summary={};
  for(const name of Object.keys(urls)){
   const runs=result.samples.filter(r=>r.name===name),frames=runs.reduce((n,r)=>n+r.frames,0),seconds=runs.reduce((n,r)=>n+r.realSeconds,0);
   const intervals=runs.flatMap(r=>r.frameIntervalsMs).sort((a,b)=>a-b);
   result.summary[name]={fps:+(frames/seconds).toFixed(2),p95ms:intervals[Math.ceil(intervals.length*.95)-1],runs:runs.map(r=>+r.fps.toFixed(2))};
  }
  fs.writeFileSync(output,JSON.stringify(result)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
