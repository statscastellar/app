const {test,expect,seed}=require('./helpers.cjs');
test('Pas 4: error de desament visible al diàleg i reintent sense bucle ni duplicats',async({page})=>{
 await seed(page,{stage:4});await expect(page.locator('#save')).toBeEnabled();
 await page.evaluate(()=>{const original=StatsPro2.Pro2Storage.prototype.saveActive;let fail=true;StatsPro2.Pro2Storage.prototype.saveActive=function(...args){if(fail){fail=false;return Promise.reject(new Error('No es pot desar (prova QA)'));}return original.apply(this,args);};});
 await page.locator('#save').click();await page.locator('[data-side="rival"]').click();await page.locator('#serveAccept').click();
 await expect(page.locator('#serveDialog')).toBeVisible();await expect(page.locator('#serveError')).toContainText('No es pot desar (prova QA)');
 await expect(page.locator('#serveAccept')).toBeEnabled();
 expect(await page.evaluate(async()=>(await new StatsPro2.IndexedDBStorageAdapter().list('activeMatches')).length)).toBe(0);
 await page.locator('#serveAccept').click();await expect(page).toHaveURL(/Capa7/);await expect(page.locator('#rivalName')).toHaveText('Rival QA');
 expect(await page.evaluate(async()=>(await new StatsPro2.IndexedDBStorageAdapter().list('activeMatches')).length)).toBe(1);
});
test('Pas 4: un partit en curs mostra la recuperació i conserva les dades originals',async({page})=>{
 await seed(page,{active:true});
 const before=await page.evaluate(async()=>new StatsPro2.IndexedDBStorageAdapter().list('activeMatches'));
 await seed(page,{stage:4});await expect(page.locator('#save')).toBeEnabled();
 await page.locator('#save').click();await page.locator('[data-side="rival"]').click();await page.locator('#serveAccept').click();
 await expect(page.locator('#serveDialog')).toBeVisible();await expect(page.locator('#serveError')).toContainText('Ja hi ha un altre partit actiu');await expect(page.locator('#serveRecover')).toBeVisible();
 expect(await page.evaluate(async()=>new StatsPro2.IndexedDBStorageAdapter().list('activeMatches'))).toEqual(before);
 await page.locator('#serveRecover').click();await expect(page).toHaveURL(/Recuperar/);
});
