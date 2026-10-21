// Compare Habitual 3+3 with the official base using identical synthetic data.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..'),draft=require('./draft.json');
const base='548459f37af7c13cd51a9fc4ef0a3310e56ee785';
async function stableShot(page,clip){let previous;for(let i=0;i<12;i++){const current=await page.screenshot({animations:'disabled',clip});if(previous&&current.equals(previous))return current;previous=current;await page.waitForTimeout(150);}throw Error('Screenshot did not stabilize');}
const originals=Object.fromEntries(['Capa7/index.html','Capa7/js/capa7-pro2-controller.js'].map(p=>[p,cp.execFileSync('git',['show',base+':'+p],{cwd:root})]));
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
  const results=[];
  for(const baseline of [true,false]){
   const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();await page.clock.setFixedTime(new Date('2030-01-15T12:00:00Z'));
   await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://qa.test')return route.abort();const relative=u.pathname.slice(1)+(u.pathname.endsWith('/')?'index.html':'');const file=path.resolve(root,relative);if(!file.startsWith(root+path.sep))return route.abort();try{await route.fulfill({body:baseline&&originals[relative]||await fs.readFile(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.json':'application/json'})[path.extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}});
   await page.goto('http://qa.test/Capa9-1/index.html');
   await page.evaluate(async d=>{const m=StatsPro2.createMatchFromDraft(d,{matchId:'unchanged-qa',now:'2030-01-15T12:00:00Z'}),e=new StatsPro2.MatchEngine(m.state,m.actionLog);await new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter()).saveActive(e);sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1','unchanged-qa');},draft);
   await page.goto('http://qa.test/Capa7/index.html');await page.waitForSelector('.player-slot');await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(500);
   const result=await page.evaluate(async()=>({rects:[...document.querySelectorAll('.player-slot,.rating-grid button,.block-slot button,.footer > *')].map(e=>e.getBoundingClientRect().toJSON()),session:(await new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter()).loadActive('unchanged-qa')).exportSession(),footerTop:document.querySelector('.footer').getBoundingClientRect().top}));
   result.image=await stableShot(page,{x:0,y:0,width:viewport.width,height:Math.floor(result.footerTop)});results.push(result);await context.close();
  }
  assert.deepEqual(results[1].rects,results[0].rects,'Habitual geometry changed');assert.deepEqual(results[1].session,results[0].session,'Match state changed');if(!results[1].image.equals(results[0].image)){await fs.writeFile(path.join(root,'work',`default-base-${viewport.width}.png`),results[0].image);await fs.writeFile(path.join(root,'work',`default-current-${viewport.width}.png`),results[1].image);}assert.ok(results[1].image.equals(results[0].image),'Habitual court appearance changed');
  console.log(`PASS ${viewport.width}x${viewport.height}: Habitual 3+3 matches official base (court pixels, control geometry, match state)`);
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
