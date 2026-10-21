// Real service worker, local synthetic match, no network dependency.
const {chromium}=require('playwright'),assert=require('node:assert/strict'),draft=require('./draft.json');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const context=await browser.newContext({serviceWorkers:'allow'}),page=await context.newPage();
 await page.goto('http://127.0.0.1:4173/');
 await page.evaluate(()=>navigator.serviceWorker.register('/service-worker.js'));
 await page.evaluate(()=>navigator.serviceWorker.ready);
 assert.ok(await page.evaluate(async()=>(await caches.keys()).includes('stats-castellar-1.1.0-recover-20261021-v1')));
 await page.goto('http://127.0.0.1:4173/Capa9-1/index.html');
 await page.evaluate(async d=>{const m=StatsPro2.createMatchFromDraft(d,{matchId:'offline-qa',now:'2030-01-15T12:00:00Z'});await new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter()).saveActive(new StatsPro2.MatchEngine(m.state,m.actionLog));sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1','offline-qa');},draft);
 await page.goto('http://127.0.0.1:4173/Capa7/index.html');await page.waitForSelector('.player-slot');
 await page.locator('#tacticsBtn').click();await page.getByRole('button',{name:/Penetració Z1/}).click();await page.waitForFunction(()=>document.querySelector('#modalLayer').hidden);
 await context.setOffline(true);await page.reload();await page.waitForSelector('.player-slot');
 assert.equal(await page.locator('#playerGrid').getAttribute('data-layout'),'penetration-z1');
 await page.locator('.player-slot[data-reg-zone="6"] .r2').click();await page.locator('.player-slot[data-reg-zone="1"] .r2').click();
 await page.waitForFunction(()=>document.querySelector('#playerGrid').dataset.layout==='3-3');
 console.log('PASS service worker: new assets cached, tactic persists and rally runs offline with synthetic data');
 await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
