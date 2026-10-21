// Run with Node and Playwright installed. All requests use local files and synthetic data.
const {chromium}=require('playwright'),fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),draft=require('./draft.json');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{for(const viewport of [{width:1440,height:900},{width:844,height:390},{width:390,height:844}]){
 const context=await browser.newContext({viewport,serviceWorkers:'block'}),page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!=='http://lab.test')return route.abort();const file=path.resolve(root,'.'+u.pathname+(u.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))return route.abort();try{const body=await fs.readFile(file);await route.fulfill({body,contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});}catch{await route.fulfill({status:404,body:''});}});
 await page.goto('http://lab.test/Capa9-1/index.html');
 await page.evaluate(async d=>{const made=StatsPro2.createMatchFromDraft(d,{matchId:'dynamic-qa',now:'2030-01-15T12:00:00Z'}),e=new StatsPro2.MatchEngine(made.state,made.actionLog),s=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());await s.saveActive(e);sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1','dynamic-qa');},draft);
 await page.goto('http://lab.test/Capa7/index.html');await page.waitForSelector('.player-slot');
 const snapshot=()=>page.evaluate(async()=>JSON.stringify((await new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter()).loadActive('dynamic-qa')).exportSession()));
 const before=await snapshot();
 async function choose(label){await page.locator('#tacticsBtn').click();await page.getByRole('button',{name:label}).click();await page.waitForFunction(()=>document.querySelector('#modalLayer').hidden);}
 async function layout(value){await page.waitForFunction(v=>document.querySelector('#playerGrid').dataset.layout===v,value);assert.equal(await page.locator('.player-slot').count(),6);const players=await page.locator('.player-slot').evaluateAll(slots=>slots.map(s=>({id:s.dataset.playerId,r:s.getBoundingClientRect().toJSON()})));assert.equal(new Set(players.map(p=>p.id)).size,6);for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){const a=players[i].r,b=players[j].r;assert.ok(a.right<=b.left+1||b.right<=a.left+1||a.bottom<=b.top+1||b.bottom<=a.top+1,'Jugadores solapades');}assert.equal(await page.locator('.rating-grid button').count(),24);assert.equal(await page.locator('.block-slot').count(),3);const geometry=await page.evaluate(()=>{const z1=document.querySelector('.player-slot[data-reg-zone="1"]').getBoundingClientRect(),z3=document.querySelector('.player-slot[data-reg-zone="3"]').getBoundingClientRect();return {z1:z1.y,z3:z3.y}});assert.equal(geometry.z1>geometry.z3+5,value==='3-3');const orders=await page.locator('.player-slot').evaluateAll(slots=>slots.map(slot=>({zone:slot.dataset.zone,values:[...slot.querySelectorAll('.rating-grid button')].sort((a,b)=>{const x=a.getBoundingClientRect(),y=b.getBoundingClientRect();return x.top-y.top||x.left-y.left;}).map(b=>Number(b.textContent))})));for(const row of orders)assert.deepEqual(row.values,value==='penetration-z1'&&['4','2'].includes(row.zone)?[3,2,1,0]:[0,1,2,3]);}
 await layout('3-3');await choose(/Penetració Z1/);await layout('penetration-z1');assert.equal(await snapshot(),before);
 const rate=async(zone)=>{await page.locator(`.player-slot[data-reg-zone="${zone}"] .r2`).click();await page.waitForTimeout(100);};
 await rate('6');await layout('penetration-z1');await rate('1');await layout('3-3');await page.locator('#undoBtn').click();await layout('penetration-z1');await rate('1');await layout('3-3');await rate('4');await layout('3-3');assert.match(await page.locator('#tacticsBtn').getAttribute('class'),/active-mode/);
 await page.screenshot({path:path.join(root,'work',`defensa-${viewport.width}.png`)});
 await rate('6');await layout('penetration-z1');await page.locator('#undoBtn').click();await layout('3-3');
 await page.reload();await layout('3-3');await rate('6');await layout('penetration-z1');
 const preDisable=await snapshot();await choose(/Habitual 3\+3/);await layout('3-3');assert.equal(await snapshot(),preDisable);
 await rate('1');await layout('3-3');await rate('4');await layout('3-3');await rate('6');await layout('3-3');await page.reload();await layout('3-3');
 await page.locator('[data-score-team="home"][data-delta="1"]').click();await page.waitForTimeout(100);
 await choose(/Penetració Z1/);await layout('3-3');await rate('1');await layout('3-3');
 assert.equal(await page.locator('#actionBox').innerText().then(s=>s.includes('DEFENSA')),true);
 await page.reload();await layout('3-3');await page.locator('#undoBtn').click();await layout('3-3');
 await rate('1');await layout('3-3');await rate('6');await layout('penetration-z1');
 assert.deepEqual(errors,[]);console.log(`PASS ${viewport.width}x${viewport.height}: fases, geometria, desfer, persistència, desactivació i dades intactes`);await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
