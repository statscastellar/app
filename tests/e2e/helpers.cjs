const {test:base,expect}=require('playwright/test');
const {draft,NOW}=require('../fixtures/synthetic.cjs');
const test=base.extend({page:async({page},use)=>{
 await page.clock.setFixedTime(new Date(NOW));
 await page.route('**/*',route=>{const u=new URL(route.request().url());return u.origin==='http://127.0.0.1:4173'?route.continue():route.abort('blockedbyclient')});
 await use(page);
}});
async function seed(page,{active=false,completed=false,stage=null}={}){
 await page.goto('/Capa9-1/index.html');
 await page.evaluate(async({d,active,completed,stage})=>{
   await Pro2TeamStore.ready;
   const a=new StatsPro2.IndexedDBStorageAdapter();
   const team={...d.team,active:true,season:'2030-31',players:d.rosterSnapshot,createdAt:d.createdAt,updatedAt:d.updatedAt};
   await a.put('teams',team.teamId,team);
   if(stage){sessionStorage.setItem('StatsCastellarPro2_CurrentDraft_v1',JSON.stringify(d));}
   if(active||completed){
     const made=StatsPro2.createMatchFromDraft(d,{matchId:'qa-match',now:d.createdAt});
     const e=new StatsPro2.MatchEngine(made.state,made.actionLog);
     const s=new StatsPro2.Pro2Storage(a);
     if(completed){e.ratePlayer('1',2);e.ratePlayer('2',2);e.ratePlayer('3',3);e.finishSet();}
     await s.saveActive(e);
     if(completed){e.finishMatch();await s.finalize(e)}
     else sessionStorage.setItem('StatsCastellarPro2_ResumeMatchId_v1','qa-match');
   }
 },{d:draft(),active,completed,stage});
 if(active) {await page.goto('/Capa7/index.html');await expect(page.locator('#rivalName')).toHaveText('Rival QA');}
 if(stage) await page.goto(`/Capa9-${stage}/index.html`);
}
async function confirmServe(page){await page.locator('#save').click();await page.locator('[data-side="rival"]').click();await page.locator('#serveAccept').click();await page.locator('#serveConfirm').click();await expect(page).toHaveURL(/Capa7/);await expect(page.locator('#rivalName')).toHaveText('Rival QA')}
module.exports={test,expect,seed,confirmServe};
