const {test,expect,seed}=require('./helpers.cjs');
test('PJ de convocades, ordenació reversible i altres taules intactes',async({page})=>{
 await seed(page,{completed:true});
 await page.goto('/Informe/index.html?id=qa-match&analysis=all');
 const table=page.locator('#historyPlayers');await expect(table.locator('tbody tr')).toHaveCount(8);
 await expect(table.locator('tbody tr td:nth-child(2)')).toHaveText(Array(8).fill('1'));
 const snapshot=()=>page.evaluate(()=>Object.fromEntries(['matchTable','percentageTable','historyFoundations','historyIndividual','chartTeam','chartFoundations','playerEvolution'].map(id=>[id,document.getElementById(id).innerHTML])));
 const before=await snapshot();
 const names=()=>table.locator('tbody tr td:first-child').allTextContents();const original=await names();
 for(const button of await table.locator('thead button').all()){
  await button.click();await expect(button.locator('..')).toHaveAttribute('aria-sort',/ascending|descending/);
  await button.click();
 }
 await table.getByRole('button',{name:/Jugadora/}).click();const asc=await names();await table.getByRole('button',{name:/Jugadora/}).click();expect(await names()).toEqual([...asc].reverse());
 expect(await snapshot()).toEqual(before);
 await page.reload();await expect(table.locator('tbody tr')).toHaveCount(8);expect(await names()).toEqual(original);
});
test('PJ diferents i empats amb jugadores convocades sense accions',async({page})=>{
 await seed(page,{completed:true});
 await page.evaluate(async()=>{
  const adapter=new StatsPro2.IndexedDBStorageAdapter(),s=new StatsPro2.Pro2Storage(adapter),first=await s.getHistory('qa-match');
  const state=first.finalState,ids=state.roster.calledPlayerIds.slice(0,6),positions=Object.fromEntries(ids.map((id,i)=>[String(i+1),id]));
  const d={schemaVersion:1,team:{teamId:state.metadata.teamId,name:'Equip QA'},match:{opponent:'Segon rival',date:'2030-01-16',venue:'home'},rosterSnapshot:state.roster.snapshot,calledPlayerIds:ids,startingSixIds:ids,positions,initialServe:{side:'rival',serverPlayerId:null}};
  const made=StatsPro2.createMatchFromDraft(d,{matchId:'qa-second',now:'2030-01-16T12:00:00Z'}),e=new StatsPro2.MatchEngine(made.state,made.actionLog);
  e.manualPoint('rival');e.finishMatch();await s.saveActive(e);await s.finalize(e);
 });
 await page.goto('/Informe/index.html?id=qa-match&analysis=all');
 const table=page.locator('#historyPlayers');await expect(table.locator('tbody tr')).toHaveCount(8);
 await expect(table.locator('tbody tr td:nth-child(2)')).toHaveText(['2','2','2','2','2','2','1','1']);
 const pj=table.getByRole('button',{name:/^PJ/});await pj.click();await expect(table.locator('tbody tr td:nth-child(2)')).toHaveText(['1','1','2','2','2','2','2','2']);
});
