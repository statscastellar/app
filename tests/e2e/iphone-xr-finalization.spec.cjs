const {test,expect,seed}=require('./helpers.cjs');

test('iPhone XR horitzontal: noms complets i historial visible',async({page})=>{
  await page.setViewportSize({width:896,height:414});
  await seed(page,{active:true});
  await page.evaluate(()=>document.querySelector('#rivalName').textContent='RUBÍ GROC');
  for(const selector of ['#rivalName','#ownScoreZone .header-title']){
    const info=await page.locator(selector).evaluate(el=>{
      const r=el.getBoundingClientRect(),zone=el.closest('.score-zone').getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,zoneTop:zone.top,zoneBottom:zone.bottom,height:r.height,scroll:el.scrollHeight,client:el.clientHeight};
    });
    expect(info.top).toBeGreaterThanOrEqual(info.zoneTop-1);
    expect(info.bottom).toBeLessThanOrEqual(info.zoneBottom+1);
    expect(info.scroll).toBeLessThanOrEqual(info.client+1);
    expect(info.height).toBeGreaterThanOrEqual(12);
  }
  await page.goto('/Historial/index.html');
  // Llista d'historial amb un registre realment present a IndexedDB.
  await page.evaluate(async()=>{
    const a=new StatsPro2.IndexedDBStorageAdapter(),s=new StatsPro2.Pro2Storage(a);
    const e=await s.loadActive('qa-match');e.manualPoint('team');e.finishSet();e.finishMatch();await s.finalize(e);
  });
  await page.reload();
  await expect(page.locator('.match-card')).toHaveCount(1);
  const visible=await page.locator('.match-card').first().evaluate(el=>{
    const rect=el.getBoundingClientRect(),scroll=el.closest('.history-scroll');
    return {height:rect.height,scrollHeight:scroll.scrollHeight,clientHeight:scroll.clientHeight,display:getComputedStyle(scroll).display};
  });
  expect(visible.height).toBeGreaterThan(25);
  expect(visible.clientHeight).toBeGreaterThan(80);
});

test('finalitzar partit tanca quart set obert i no perd estadístiques',async({page})=>{
  await seed(page,{active:true});
  await page.evaluate(async()=>{
    const storage=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
    const e=await storage.loadActive('qa-match'),court={...e.state.game.court};
    for(let i=1;i<=3;i++){
      e.manualPoint(i===2?'rival':'team');e.finishSet();
      e.startNextSet({court,servingSide:'rival'});
    }
    e.ratePlayer('1',2);e.ratePlayer('2',2);e.ratePlayer('3',3);
    for(let i=0;i<5;i++)e.manualPoint('rival');
    for(let i=0;i<25;i++)e.manualPoint('team');
    await storage.saveActive(e);
  });
  await page.reload();
  await expect(page.locator('#setNumber')).toHaveText('4');
  await page.locator('#finishMatchBtn').click();
  await expect(page.locator('#modalBody')).toContainText('25–5');
  await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();
  await expect(page.locator('#modalTitle')).toHaveText('Partit finalitzat');
  const result=await page.evaluate(async()=>{
    const storage=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
    const rec=await storage.getHistory('qa-match'),verified=StatsPro2.prepareVerifiedExport(rec);
    return {sets:rec.finalState.game.sets,types:rec.actionLog.actions.map(a=>a.type),
      bySet:verified.report.stats.bySet,stats:verified.report.stats,integrity:!!rec.integrity};
  });
  expect(result.sets).toHaveLength(4);
  expect(result.sets[3]).toMatchObject({set:4,team:25,rival:5,winner:'team'});
  expect(result.types.filter(t=>t==='SET_END')).toHaveLength(4);
  expect(result.types.filter(t=>t==='MATCH_END')).toHaveLength(1);
  expect(result.bySet['4']).toBeTruthy();
  expect(result.integrity).toBe(true);
  await page.goto('/Historial/index.html');
  await expect(page.locator('.match-card')).toHaveCount(1);
});

test('set prèviament tancat no es duplica en finalitzar partit',async({page})=>{
  await seed(page,{active:true});
  await page.evaluate(async()=>{
    const s=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
    const e=await s.loadActive('qa-match');e.manualPoint('team');e.finishSet();await s.saveActive(e);
  });
  await page.reload();
  await page.locator('#finishMatchBtn').click();
  await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();
  await expect(page.locator('#modalTitle')).toHaveText('Partit finalitzat');
  const info=await page.evaluate(async()=>{
    const s=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
    const rec=await s.getHistory('qa-match');
    return {sets:rec.finalState.game.sets.length,ends:rec.actionLog.actions.filter(a=>a.type==='SET_END').length};
  });
  expect(info).toEqual({sets:1,ends:1});
});
