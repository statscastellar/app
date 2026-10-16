const {test,expect,seed}=require('./helpers.cjs');
const fs=require('node:fs/promises');
async function saved(page){return page.evaluate(async()=>new StatsPro2.IndexedDBStorageAdapter().get('completedMatches','qa-match'))}
async function openResult(page){await page.locator('#editBtn').click();await page.locator('#editResultBtn').click();await expect(page.locator('#resultDialog')).toBeVisible()}
async function fillResult(page,team=20,rival=25){await page.locator('[data-set="1"][data-side="team"]').fill(String(team));await page.locator('[data-set="1"][data-side="rival"]').fill(String(rival))}
async function confirmResult(page){page.once('dialog',dialog=>dialog.accept());await page.locator('#resultSave').click();await expect(page.locator('#resultDialog')).not.toBeVisible();await expect(page.locator('#setScores')).toContainText('20–25')}
test('resultat definitiu: cancel·lació, confirmació, persistència i estadístiques',async({page})=>{
 await seed(page,{completed:true});await page.goto('/Informe/index.html?id=qa-match');const before=await saved(page);
 await openResult(page);
 const geometry=await page.locator('#resultDialog').evaluate(dialog=>({viewport:innerWidth,left:dialog.getBoundingClientRect().left,right:dialog.getBoundingClientRect().right,overflow:dialog.scrollWidth>dialog.clientWidth}));
 expect(geometry.left).toBeGreaterThanOrEqual(0);expect(geometry.right).toBeLessThanOrEqual(geometry.viewport);expect(geometry.overflow).toBe(false);
 await fillResult(page);await page.locator('#resultCancel').click();expect(await saved(page)).toEqual(before);
 await page.locator('#editResultBtn').click();await fillResult(page);page.once('dialog',dialog=>dialog.dismiss());await page.locator('#resultSave').click();expect(await saved(page)).toEqual(before);
 await confirmResult(page);await expect(page.locator('#score')).toHaveText('0–1');
 const after=await saved(page);
 expect(await page.evaluate(async previous=>{try{await new StatsPro2.IndexedDBStorageAdapter().atomicReplaceCompleted('qa-match',previous,previous);return false}catch(error){return /ha canviat/.test(error.message)}},before)).toBe(true);expect(await saved(page)).toEqual(after);expect(after.report.stats).toEqual(before.report.stats);expect(after.actionLog.actions.length).toBe(before.actionLog.actions.length);expect(Object.keys(after).sort()).toEqual(Object.keys(before).sort());expect(after.finalState.identity).toEqual(before.finalState.identity);expect(after.completedAt).toBe(before.completedAt);
 await page.reload();await expect(page.locator('#setScores')).toContainText('20–25');await expect(page.locator('#editStatus')).toBeHidden();await expect(page.locator('body')).not.toContainText(/resultat corregit|marcador corregit|resultat modificat/i);
 await page.locator('#editBtn').click();await page.locator('[data-player="qa-player-1"][data-type="RECEPCIO"][data-value="2"] .minus').click();await page.locator('[data-player="qa-player-1"][data-type="RECEPCIO"][data-value="3"] .plus').click();await expect(page.locator('[data-player="qa-player-1"][data-type="RECEPCIO"][data-value="3"] .stat-count')).toHaveText('1');await expect(page.locator('#setScores')).toContainText('20–25');
 await page.goto('/Historial/index.html');await expect(page.locator('.result')).toHaveText('0–1');await expect(page.locator('.result')).toHaveClass(/loss/);await expect(page.locator('.sets')).toContainText('20–25');
});
test('exportacions ODS, XLSX i impressió utilitzen el resultat vigent',async({page})=>{
 await seed(page,{completed:true});await page.goto('/Informe/index.html?id=qa-match');await openResult(page);await fillResult(page);await confirmResult(page);
 for(const id of ['xlsxBtn','odsBtn']){const download=page.waitForEvent('download');await page.locator('#'+id).click();const file=await download;const bytes=await fs.readFile(await file.path());expect(bytes.subarray(0,2).toString()).toBe('PK');expect(bytes.includes(Buffer.from('S1 20-25'))).toBe(true);expect(bytes.includes(Buffer.from('0-1'))).toBe(true)}
 await page.evaluate(()=>{window.print=()=>{window.__qaPrintedScore=document.querySelector('#setScores').textContent}});await page.locator('#pdfBtn').click();expect(await page.evaluate(()=>window.__qaPrintedScore)).toContain('20–25');
});
test('fallada d’arxivament: joc bloquejat i reintent segur',async({page})=>{
 await seed(page,{active:true});await page.locator('[data-score-team="home"][data-delta="1"]').click();
 await page.evaluate(()=>{const original=StatsPro2.IndexedDBStorageAdapter.prototype.atomicFinalize;let first=true;StatsPro2.IndexedDBStorageAdapter.prototype.atomicFinalize=function(...args){if(first){first=false;return Promise.reject(new Error('Fallada QA d’arxivament'))}return original.apply(this,args)}});
 await page.locator('#finishMatchBtn').click();await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();await expect(page.locator('.toast')).toContainText('marcador queda bloquejat');await page.locator('#modalLayer').click({position:{x:3,y:3}});
 for(const selector of ['[data-score-team]','#undoBtn','#positionsBtn','#changeBtn','#finishSetBtn','#sosBtn','#rivalCourtBtn','#actionBox','#playerGrid button','#blockGrid button'])for(const control of await page.locator(selector).all())await expect(control).toBeDisabled();
 await page.locator('#finishMatchBtn').click();await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();await expect(page.locator('#modalTitle')).toHaveText('Partit finalitzat');expect((await saved(page)).finalState.game.score.team).toBe(1);await page.locator('#modalLayer').click({position:{x:3,y:3}});await expect(page.locator('#finishMatchBtn')).toBeDisabled();
});
test('una altra pestanya finalitza: la còpia oberta també es bloqueja',async({page})=>{
 await seed(page,{active:true});const other=await page.context().newPage();await other.goto('http://127.0.0.1:4173/Capa7/index.html');await expect(other.locator('#rivalName')).toHaveText('Rival QA');
 await page.locator('#finishMatchBtn').click();await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();await expect(page.locator('#modalTitle')).toHaveText('Partit finalitzat');
 await other.locator('[data-score-team="home"][data-delta="1"]').click();await expect(other.locator('#modalTitle')).toHaveText('Partit ja finalitzat');await other.locator('#modalLayer').click({position:{x:3,y:3}});await expect(other.locator('#scoreHome')).toHaveText('0');await expect(other.locator('[data-score-team="home"][data-delta="1"]')).toBeDisabled();expect((await saved(page)).finalState.game.score.team).toBe(0);await other.close();
});
