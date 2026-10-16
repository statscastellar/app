const {test,expect,seed}=require('../e2e/helpers.cjs');
async function record(page){return page.evaluate(async()=>{const a=new StatsPro2.IndexedDBStorageAdapter();return {completed:await a.get('completedMatches','qa-match'),active:await a.list('activeMatches')}})}
test('interfície: marcador i controls bloquejats després de tancar resum',async({page},info)=>{
 await seed(page,{active:true});
 await page.locator('.player-slot[data-zone="1"] .r2').click();
 await page.locator('.player-slot[data-zone="2"] .r2').click();
 await page.locator('.player-slot[data-zone="3"] .r3').click();
 await page.locator('#finishMatchBtn').click();
 await page.locator('#modalActions').getByRole('button',{name:'Finalitzar partit',exact:true}).click();
 await expect(page.locator('#modalTitle')).toHaveText('Partit finalitzat');
 const before=await record(page);
 // Clic normal al fons del diàleg; no accés al motor ni clic forçat.
 await page.locator('#modalLayer').click({position:{x:3,y:3}});
 await expect(page.locator('#modalLayer')).toBeHidden();
 await expect(page.locator('[data-score-team="home"][data-delta="1"]')).toBeDisabled();
 await page.locator('[data-score-team="home"][data-delta="1"]').dispatchEvent('click');
 await expect(page.locator('#scoreHome')).toHaveText('1');
 const after=await record(page);
 expect(after).toEqual(before);expect(after.active).toEqual([]);
 await info.attach('punt-postfinalitzacio',{body:JSON.stringify({visibleScore:await page.locator('#scoreHome').textContent(),archivedScore:after.completed.finalState.game.score,archiveUnchanged:JSON.stringify(before)===JSON.stringify(after)},null,2),contentType:'application/json'});
 await page.screenshot({path:info.outputPath('punt-visible-despres-final.png')});
 await page.goto('/Informe/index.html?id=qa-match');
 await expect(page.locator('#matchTable tbody tr')).toHaveCount(6);
 expect(await record(page)).toEqual(before);
});
test('motor: punt entre finishMatch i archive queda rebutjat',async({page},info)=>{
 await seed(page);
 const result=await page.evaluate(async()=>{const {draft}= {draft:JSON.parse(JSON.stringify(window.Pro2DraftStore.current()))};
 const d={schemaVersion:1,team:{teamId:'qa-team',name:'Equip QA'},match:{opponent:'QA',date:'2030-01-15',venue:'home'},rosterSnapshot:Array.from({length:6},(_,i)=>({playerId:'x'+i,name:'Prova '+i,number:i})),calledPlayerIds:['x0','x1','x2','x3','x4','x5'],startingSixIds:['x0','x1','x2','x3','x4','x5'],positions:{1:'x0',2:'x1',3:'x2',4:'x3',5:'x4',6:'x5'},initialServe:{side:'rival',serverPlayerId:null}};
 const m=StatsPro2.createMatchFromDraft(d,{matchId:'qa-edge',now:'2030-01-15T12:00:00Z'}),e=new StatsPro2.MatchEngine(m.state,m.actionLog),a=new StatsPro2.MemoryStorageAdapter(),s=new StatsPro2.Pro2Storage(a);
 await s.saveActive(e);e.finishMatch();let rejected=false;try{e.manualPoint('team')}catch(error){rejected=/finalitzat/.test(error.message)}const archived=await s.finalize(e);return {rejected,score:archived.finalState.game.score,pointActions:archived.actionLog.actions.filter(x=>x.type==='POINT').length,participationPoints:archived.report.stats.participation.totalPoints,technicalActions:archived.report.stats.teamAnnaActions};});
 expect(result.rejected).toBe(true);expect(result.score.team).toBe(0);expect(result.pointActions).toBe(0);
 await info.attach('motor-postfinalitzacio',{body:JSON.stringify(result,null,2),contentType:'application/json'});
});
test('selector: geometria, llegibilitat i estabilitat de captures',async({page},info)=>{
 await seed(page,{completed:true});await page.goto('/Historial/index.html');await expect(page.locator('.match-card')).toHaveCount(1);
 const measures=await page.locator('#teamFilter').evaluate(e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return {rect:r.toJSON(),font:s.font,lineHeight:s.lineHeight,whiteSpace:s.whiteSpace,overflow:s.overflow,backdropFilter:s.backdropFilter,color:s.color,selected:e.selectedOptions[0].textContent,active:document.activeElement===e,clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,devicePixelRatio}});
 expect(measures.selected).toBe('Equip QA');expect(measures.scrollWidth).toBe(measures.clientWidth);
 await info.attach('selector-mesures',{body:JSON.stringify(measures,null,2),contentType:'application/json'});
 for(let i=0;i<3;i++){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:info.outputPath('historial-'+i+'.png'),fullPage:true,animations:'disabled',scale:'css'});}
});
