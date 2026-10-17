// Observational audit: never updates baselines or changes application styles.
const {test,expect,seed}=require('../e2e/helpers.cjs');
const fs=require('node:fs'),path=require('node:path');
const screens=['pas-1','pas-2','pas-3','pas-4','partit','historial','informe','acumulat'];
for(const screen of screens)test('geometria i llegibilitat '+screen,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(screen.startsWith('pas-'))await seed(page,{stage:Number(screen.slice(-1))});
 else if(screen==='partit'){await seed(page,{active:true});await expect(page.locator('#blockGrid button')).toHaveCount(9)}
 else{await seed(page,{completed:true});await page.goto('/'+({historial:'Historial',informe:'Informe',acumulat:'Acumulat'}[screen])+'/index.html'+(screen==='informe'?'?id=qa-match':''));if(screen==='historial')await expect(page.locator('.match-card')).toHaveCount(1);if(screen==='informe')await expect(page.locator('#matchTable tbody tr')).toHaveCount(6);if(screen==='acumulat')await expect(page.locator('#matches')).toHaveText('1')}
 await page.evaluate(()=>document.fonts.ready);
 const measurements=await page.evaluate(()=>{
  const vp={width:innerWidth,height:innerHeight};
  const selector=e=>e.id?'#'+e.id:e.tagName.toLowerCase()+(e.classList.length?'.'+[...e.classList].join('.'):'');
  const visible=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.visibility!=='hidden'&&s.display!=='none'&&r.width>0&&r.height>0};
  const scrollers=e=>{const a=[];for(let p=e.parentElement;p&&p!==document.body;p=p.parentElement){const s=getComputedStyle(p);if(/auto|scroll/.test(s.overflowX)&&p.scrollWidth>p.clientWidth+1)a.push(selector(p))}return a};
  const controls=[...document.querySelectorAll('button,input:not([type=hidden]),select,textarea,a[href],[role=button],[tabindex]')].filter(visible).map(e=>{
   const r=e.getBoundingClientRect(),s=getComputedStyle(e),scroll=scrollers(e);
   const name=(e.getAttribute('aria-label')||(e.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ').trim()||[...(e.labels||[])].map(l=>l.textContent).join(' ')||e.getAttribute('title')||e.textContent||e.getAttribute('placeholder')||'').trim();
   let textWidth=0,textHeight=0,textOutside=false;
   // Native controls use browser rendering; DOM text ranges cannot measure their glyphs.
   if(!['SELECT','INPUT','TEXTAREA'].includes(e.tagName)){
    const range=document.createRange();range.selectNodeContents(e);const t=range.getBoundingClientRect();textWidth=t.width;textHeight=t.height;
    textOutside=[...range.getClientRects()].some(t=>t.left<r.left-1||t.right>r.right+1||t.top<r.top-1||t.bottom>r.bottom+1);
   }
   const clippedDescendants=[...e.querySelectorAll('span,small,b,strong')].filter(n=>{if(!visible(n)||!n.textContent.trim())return false;const st=getComputedStyle(n);if(!/hidden|clip/.test(st.overflowX+' '+st.overflowY))return false;const nr=n.getBoundingClientRect(),rg=document.createRange();rg.selectNodeContents(n);const tr=rg.getBoundingClientRect();return tr.width>n.clientWidth-parseFloat(st.paddingLeft)-parseFloat(st.paddingRight)+1||tr.left<nr.left-1||tr.right>nr.right+1}).map(n=>({selector:selector(n),text:n.textContent,width:n.clientWidth,scrollWidth:n.scrollWidth}));
   const available=e.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight);
   const clipped= textOutside || (s.whiteSpace==='nowrap'&&textWidth>available+1) || e.scrollHeight>e.clientHeight+1;
   const inViewport=r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;
   let coveredBy=null;
   if(inViewport&&!e.disabled){const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);if(hit&&hit!==e&&!e.contains(hit)&&!hit.contains(e))coveredBy=selector(hit)}
   return {selector:selector(e),text:(e.tagName==='SELECT'?e.selectedOptions[0]?.textContent:name).slice(0,120),name,rect:{x:r.x,y:r.y,width:r.width,height:r.height},clipped,overflowX:s.overflowX,overflowY:s.overflowY,whiteSpace:s.whiteSpace,actualText:e.textContent.trim().slice(0,120),confirmedClip:(clipped&&(/hidden|clip/.test(s.overflowX+' '+s.overflowY)||s.textOverflow==='ellipsis'))||clippedDescendants.length>0,clippedDescendants,textWidth,textHeight,available,ellipsis:s.textOverflow==='ellipsis',scrollContainers:scroll,horizontalOutside:r.left< -1||r.right>innerWidth+1,verticalOutside:r.top< -1||r.bottom>innerHeight+1,coveredBy,disabled:!!e.disabled,tabIndex:e.tabIndex,nativeTextMeasurement:['SELECT','INPUT','TEXTAREA'].includes(e.tagName)};
  });
  const overflow=[...document.querySelectorAll('body *')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();return r.left< -1||r.right>innerWidth+1}).map(e=>({selector:selector(e),scrollContainers:scrollers(e)}));
  return {viewport:vp,document:{width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,bodyWidth:document.body.scrollWidth,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1},controls,overflow};
 });
 // Measure actual keyboard focus movement without changing page geometry beforehand.

 const dir=path.resolve(__dirname,'../reports/visual-audit',info.project.name);fs.mkdirSync(dir,{recursive:true});
 // Three independent frames allow us to distinguish unstable rendering from stable differences.
 for(let i=0;i<3;i++){await page.evaluate(()=>document.activeElement?.blur());await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:path.join(dir,screen+'-'+i+'.png'),fullPage:true,animations:'disabled',scale:'css'})}
 await page.keyboard.press('Tab');const keyboard=await page.evaluate(()=>({tag:document.activeElement.tagName,selector:document.activeElement.id||document.activeElement.className}));
 fs.writeFileSync(path.join(dir,screen+'.json'),JSON.stringify({screen,profile:info.project.name,measurements,keyboard,errors},null,2));
 expect(errors,'runtime errors').toEqual([]);expect(measurements.controls.length).toBeGreaterThan(0);
});
