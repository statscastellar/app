const {test,expect,seed}=require('./helpers.cjs');
async function active(page){return page.evaluate(async()=>new StatsPro2.IndexedDBStorageAdapter().list('activeMatches'));}
test('recuperació: llista buida sense errors',async({page})=>{
 await page.goto('/Recuperar/index.html');await expect(page.locator('#content')).toHaveText('No hi ha cap partit per recuperar.');
});
test('recuperació: entrada des d’Inici, continuació i tàctiques amb dades intactes',async({page})=>{
 await seed(page,{active:true});const before=await active(page);await page.goto('/');await page.locator('.menu .slot').nth(1).click();await expect(page).toHaveURL(/Recuperar/);
 await expect(page.locator('.recover-match')).toHaveCount(1);await expect(page.locator('.recover-match')).toContainText('Rival QA');expect(await active(page)).toEqual(before);
 await page.getByRole('button',{name:'Continua el partit'}).click();await expect(page).toHaveURL(/Capa7/);await expect(page.locator('#rivalName')).toHaveText('Rival QA');
 await page.locator('#tacticsBtn').click();await expect(page.getByRole('button',{name:'Habitual 3+3',exact:true})).toHaveAttribute('aria-pressed','true');expect(await active(page)).toEqual(before);
});
test('recuperació: cancel·lar eliminació preserva el partit; eliminar només amb confirmació',async({page})=>{
 await seed(page,{active:true});const before=await active(page);await page.goto('/Recuperar/index.html');await expect(page.locator('.recover-match')).toHaveCount(1);
 page.once('dialog',d=>d.dismiss());await page.getByRole('button',{name:'Eliminar partit'}).click();expect(await active(page)).toEqual(before);
 page.once('dialog',d=>d.accept());await page.getByRole('button',{name:'Eliminar partit'}).click();await expect(page.locator('#content')).toHaveText('No hi ha cap partit per recuperar.');expect(await active(page)).toEqual([]);
});
