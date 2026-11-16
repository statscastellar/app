const {test,expect,seed}=require('./helpers.cjs');
async function tactic(page,mode){
 await page.locator('#tacticsBtn').click();
 await page.getByRole('button',{name:mode==='6-2'?'6-2 · Dues col·locadores':'Penetració Z1 · 4+2',exact:true}).click();
 if(mode==='6-2'){
   await expect(page.locator('#modalTitle')).toHaveText('Configurar el 6-2');
   await page.getByLabel('Col·locadora 1').selectOption('qa-player-1');
   await page.getByLabel('Col·locadora 2').selectOption('qa-player-1');
   await expect(page.getByRole('button',{name:'Activar 6-2'})).toBeDisabled();
   await page.getByLabel('Col·locadora 2').selectOption('qa-player-4');
   await expect(page.getByRole('button',{name:'Activar 6-2'})).toBeEnabled();
   await page.getByRole('button',{name:'Activar 6-2'}).click();
 }
 await expect.poll(async()=>page.evaluate(async()=>{
   const a=new StatsPro2.IndexedDBStorageAdapter();
   return (await a.get('settings','pro2:tactics:qa-match'))?.mode;
 })).toBe(mode==='6-2'?'6-2':'penetration-z1');
}
async function assertLayout(page,key){
 await expect(page.locator('#playerGrid')).toHaveAttribute('data-layout',key);
 await expect(page.locator('.player-slot')).toHaveCount(6);
 const positions=await page.locator('.player-slot').evaluateAll(nodes=>nodes.map(n=>({
   pid:n.dataset.playerId,zone:n.dataset.zone,reg:n.dataset.regZone,
   cy:n.getBoundingClientRect().top+n.getBoundingClientRect().height/2
 })));
 expect(new Set(positions.map(p=>p.pid)).size).toBe(6);
 expect(new Set(positions.map(p=>p.reg)).size).toBe(6);
 if(key.startsWith('penetration-z')){
   const setter=key.slice(-1),front=positions.find(x=>x.zone===setter);
   expect(front.cy).toBeLessThan(positions.find(x=>x.zone==='1'&&setter!=='1'||x.zone==='5'&&setter==='1').cy);
 }
}
test('Z1: recepció 3-3, col·locació 4-2, atac 3-3 i estadística reglamentària',async({page})=>{
 await seed(page,{active:true});await tactic(page,'penetration-z1');
 await assertLayout(page,'3-3');
 await page.locator('.player-slot[data-reg-zone="5"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('COL·LOCACIÓ');
 await assertLayout(page,'penetration-z1');
 await page.locator('.player-slot[data-reg-zone="1"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('ATAC');
 await assertLayout(page,'3-3');
 const result=await page.evaluate(async()=>{
  const s=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
  const e=await s.loadActive('qa-match');return e.log.actions.filter(a=>['RECEPCIO','COLLOCACIO'].includes(a.type)).map(a=>({type:a.type,playerId:a.data.playerId,zone:a.data.zone}));
 });
 expect(result.at(-2)).toMatchObject({type:'RECEPCIO',playerId:'qa-player-5',zone:'5'});
 expect(result.at(-1)).toMatchObject({type:'COLLOCACIO',playerId:'qa-player-1',zone:'1'});
});
test('Z1: si rep la col·locadora, no avança durant la col·locació',async({page})=>{
 await seed(page,{active:true});await tactic(page,'penetration-z1');
 await page.locator('.player-slot[data-reg-zone="1"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('COL·LOCACIÓ');
 await assertLayout(page,'3-3');
});
for(let k=0;k<6;k++)test('6-2: rotació '+(k+1)+' i retorn a defensa sense duplicar jugadores',async({page})=>{
 await seed(page,{active:true});
 const initial={'1':'qa-player-1','2':'qa-player-2','3':'qa-player-3','4':'qa-player-4','5':'qa-player-5','6':'qa-player-6'};
 let court={...initial};
 for(let j=0;j<k;j++)court={'1':court['2'],'2':court['3'],'3':court['4'],'4':court['5'],'5':court['6'],'6':court['1']};
 await page.evaluate(async court=>{
  const s=new StatsPro2.Pro2Storage(new StatsPro2.IndexedDBStorageAdapter());
  const e=await s.loadActive('qa-match');e.changePositions(court);await s.saveActive(e);
 },court);
 await page.reload();
 await tactic(page,'6-2');
 await assertLayout(page,'3-3');
 const active=Object.keys(court).find(z=>['1','5','6'].includes(z)&&['qa-player-1','qa-player-4'].includes(court[z]));
 const other=Object.keys(court).find(z=>court[z]!=='qa-player-1'&&court[z]!=='qa-player-4');
 await page.locator('.player-slot[data-reg-zone="'+other+'"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('COL·LOCACIÓ');
 await assertLayout(page,'penetration-z'+active);
 const activeId=court[active];
 await expect(page.locator('.player-slot[data-player-id="'+activeId+'"]')).toHaveAttribute('data-reg-zone',active);
 await page.locator('.player-slot[data-reg-zone="'+active+'"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('ATAC');
 await assertLayout(page,'3-3');
 await page.reload();await assertLayout(page,'3-3');
 const db=await page.evaluate(async()=>{
  const a=new StatsPro2.IndexedDBStorageAdapter();
  return (await a.get('settings','pro2:tactics:qa-match')).setters;
 });
 expect(db).toEqual(['qa-player-1','qa-player-4']);
});
test('6-2: si rep la col·locadora activa, es manté en 3-3',async({page})=>{
 await seed(page,{active:true});await tactic(page,'6-2');
 await page.locator('.player-slot[data-reg-zone="1"] .r2').click();
 await expect(page.locator('#actionValue')).toHaveText('COL·LOCACIÓ');await assertLayout(page,'3-3');
});

test('6-2: la substitució d’una col·locadora actualitza la configuració sense canviar la zona',async({page})=>{
 await seed(page,{active:true});await tactic(page,'6-2');
 await page.locator('#changeBtn').click();
 await page.getByRole('button',{name:'Canviar Prova 1',exact:true}).click();
 await page.locator('[data-in="qa-player-7"]').click();
 await page.locator('#modalActions').getByRole('button',{name:'Confirmar',exact:true}).click();
 await expect(page.locator('.player-slot[data-player-id="qa-player-7"]')).toHaveAttribute('data-reg-zone','1');
 await expect.poll(async()=>page.evaluate(async()=>{
  const a=new StatsPro2.IndexedDBStorageAdapter();
  return (await a.get('settings','pro2:tactics:qa-match'))?.setters;
 })).toEqual(['qa-player-7','qa-player-4']);
 await page.reload();await assertLayout(page,'3-3');
 await page.locator('.player-slot[data-reg-zone="5"] .r2').click();
 await assertLayout(page,'penetration-z1');
 await expect(page.locator('.player-slot[data-player-id="qa-player-7"]')).toHaveAttribute('data-reg-zone','1');
});
test('6-2: pantalla horitzontal tipus iPhone XR manté sis jugadores i botons accessibles',async({page})=>{
 await page.setViewportSize({width:896,height:414});await seed(page,{active:true});await tactic(page,'6-2');
 await page.locator('.player-slot[data-reg-zone="5"] .r2').click();
 await assertLayout(page,'penetration-z1');
 const info=await page.locator('.player-slot').evaluateAll(nodes=>nodes.map(el=>{
  const r=el.getBoundingClientRect();
  return {width:r.width,height:r.height,buttons:el.querySelectorAll('.rating-grid button').length};
 }));
 expect(info).toHaveLength(6);
 for(const slot of info){expect(slot.width).toBeGreaterThan(20);expect(slot.height).toBeGreaterThan(20);expect(slot.buttons).toBe(4);}
 await page.locator('.player-slot[data-reg-zone="1"] .r2').click();await assertLayout(page,'3-3');
});
