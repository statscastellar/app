const {test,expect,seed}=require('./helpers.cjs');
for(const side of ['team','rival'])test(`servei ${side}: una confirmació, cancel·lació i cap partit duplicat`,async({page})=>{
 await seed(page,{stage:4});await expect(page.locator('#save')).toBeEnabled();
 await page.locator('#save').click();await expect(page.locator('#serveAccept')).toBeDisabled();
 await expect(page.locator('#serveConfirm')).toHaveCount(0);
 await page.locator(`[data-side="${side}"]`).click();await page.locator('#serveCancel').click();await expect(page.locator('#serveDialog')).toBeHidden();
 expect(await page.evaluate(async()=>new StatsPro2.IndexedDBStorageAdapter().list('activeMatches'))).toEqual([]);
 await page.locator('#save').click();await expect(page.locator('#serveAccept')).toBeDisabled();
 await page.locator(`[data-side="${side}"]`).click();await expect(page.locator('#serveAccept')).toHaveText('CONFIRMA');
 // Two immediate events must still produce a single match.
 await page.locator('#serveAccept').evaluate(b=>{b.dispatchEvent(new MouseEvent('click',{bubbles:true}));b.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 await expect(page).toHaveURL(/Capa7/);await expect(page.locator('#rivalName')).toHaveText('Rival QA');
 const saved=await page.evaluate(async()=>{const a=new StatsPro2.IndexedDBStorageAdapter(),current=await new StatsPro2.Pro2Storage(a).getCurrentActive();return {count:(await a.list('activeMatches')).length,side:current.engine.state.game.servingSide,court:current.engine.state.game.court};});
 expect(saved.count).toBe(1);expect(saved.side).toBe(side);expect(saved.court['1']).toBe('qa-player-1');
 await expect(page.locator('#actionValue')).toHaveText(side==='team'?'SERVEI':'RECEPCIÓ');
});
test('tàctiques: el fons taronja segueix la selecció, sense marques, i persisteix',async({page})=>{
 await seed(page,{active:true});
 async function open(selected){
  await page.locator('#tacticsBtn').click();
  const habitual=page.getByRole('button',{name:'Habitual 3+3',exact:true}),z1=page.getByRole('button',{name:'Penetració Z1 · 4+2',exact:true});
  await expect(habitual).toHaveAttribute('aria-pressed',String(selected==='3-3'));await expect(z1).toHaveAttribute('aria-pressed',String(selected==='penetration-z1'));
  await expect(selected==='3-3'?habitual:z1).toHaveCSS('background-color','rgb(111, 70, 27)');await expect(selected==='3-3'?z1:habitual).toHaveCSS('background-color','rgb(5, 9, 13)');
  await expect(page.locator('#modalActions')).not.toContainText('✓');return {habitual,z1};
 }
 let options=await open('3-3');await options.z1.click();await page.reload();
 options=await open('penetration-z1');await options.habitual.click();await page.reload();
 await open('3-3');
});
