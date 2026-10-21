const {test,expect,seed}=require('./helpers.cjs');
async function shot(page,name){
 await page.evaluate(()=>document.fonts.ready);
 // The intended footer change has its own Z1 tests. Keep the historical
 // whole-screen reference strict for every pixel outside that one control.
 if(name==='partit'){
  await expect(page.locator('#tacticsBtn')).toHaveText('TÀCTIQUES');
  await page.evaluate(()=>{const b=document.querySelector('#tacticsBtn'),info=document.createElement('div');window.__tacticsSnapshotButton=b;info.id='snapshotInfo';info.className='foot info';info.textContent='INFANTIL FEMENÍ A · 2a DIV. · 2026–27';b.replaceWith(info);});
 }
 try{await expect(page).toHaveScreenshot(name+'.png',{animations:'disabled',fullPage:true,maxDiffPixels:0});}
 finally{if(name==='partit')await page.evaluate(()=>{document.querySelector('#snapshotInfo').replaceWith(window.__tacticsSnapshotButton);delete window.__tacticsSnapshotButton;});}
}
for(const stage of [1,2,3,4]) test('@visual pas '+stage,async({page})=>{await seed(page,{stage});if(stage===1)await expect(page.locator('#team option[value="qa-team"]')).toHaveCount(1);if(stage===2)await expect(page.locator('#next')).toBeVisible();if(stage===3)await expect(page.locator('.slot-hit')).toHaveCount(8);if(stage===4)await expect(page.locator('#players .player')).toHaveCount(6);await shot(page,'pas-'+stage)});
test('@visual partit i mesura de textos dels bloqueigs',async({page},info)=>{await seed(page,{active:true});await expect(page.locator('#blockGrid button')).toHaveCount(9);await shot(page,'partit');
 const measurements=await page.locator('#blockGrid button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect(),s=getComputedStyle(b),range=document.createRange();range.selectNodeContents(b);const t=range.getBoundingClientRect();const available=b.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);return {text:b.textContent,width:r.width,height:r.height,textWidth:t.width,available,scrollWidth:b.scrollWidth,clientWidth:b.clientWidth,whiteSpace:s.whiteSpace,overflow:s.overflow,textOverflow:s.textOverflow,font:s.font,clipped:t.width>available+1||b.scrollHeight>b.clientHeight+1}}));
 await info.attach('mesures-bloqueig',{body:JSON.stringify(measurements,null,2),contentType:'application/json'});
 // Mesures observacionals: les captures preserven el disseny actual, encara que contingui truncaments.
});
for(const screen of ['historial','informe','acumulat']) test('@visual '+screen,async({page})=>{await seed(page,{completed:true});if(screen==='historial'){await page.goto('/Historial/index.html');await expect(page.locator('.match-card')).toHaveCount(1)}else if(screen==='informe'){await page.goto('/Informe/index.html?id=qa-match');await expect(page.locator('#matchTable tbody tr')).toHaveCount(6)}else{await page.goto('/Acumulat/index.html');await expect(page.locator('#matches')).toHaveText('1')}await shot(page,screen)});
