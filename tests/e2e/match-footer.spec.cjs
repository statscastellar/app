const {test,expect,seed}=require('./helpers.cjs');
test('peu: vuit espais, TÀCTIQUES independent i informació visible',async({page})=>{
 await seed(page,{active:true});
 const footer=page.locator('.footer');await expect(footer.locator(':scope > *')).toHaveCount(8);
 expect(await footer.locator(':scope > *').evaluateAll(items=>items.map(e=>e.id||'info'))).toEqual(['homeBtn','sosBtn','positionsBtn','tacticsBtn','info','changeBtn','finishSetBtn','finishMatchBtn']);
 await expect(footer.locator('.info')).toHaveText('INFANTIL FEMENÍ A · 2a DIV. · 2026–27');await expect(footer.locator('.info')).toBeVisible();
 const rects=await footer.locator(':scope > *').evaluateAll(items=>items.map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON(),sh:e.scrollHeight,ch:e.clientHeight})));
 for(let i=0;i<rects.length;i++){expect(rects[i].rect.x).toBeGreaterThanOrEqual(0);expect(rects[i].rect.right).toBeLessThanOrEqual(page.viewportSize().width);if(i)expect(rects[i].rect.x).toBeGreaterThanOrEqual(rects[i-1].rect.right);}
 const positions=rects[2].rect,tactics=rects[3].rect;expect(Math.abs(positions.width-tactics.width)).toBeLessThan(1);expect(tactics.width/page.viewportSize().width).toBeLessThan(.14);
 await page.locator('#tacticsBtn').click();await expect(page.getByRole('button',{name:'Habitual 3+3',exact:true})).toHaveAttribute('aria-pressed','true');
});
