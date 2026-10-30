import { test, expect } from '@playwright/test';
test('separate hero, staged reveal and chapter controls preserve the anatomy canvas',async({page})=>{
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>localStorage.setItem('force3d','1'));
 await page.goto('/#story');
 await page.locator('[data-chapter="1"]').waitFor();
 expect(await page.evaluate(()=>document.querySelector('.story-hero-grid')!.getBoundingClientRect().bottom<=document.querySelector('.story-grid')!.getBoundingClientRect().top+1)).toBe(true);
 const jump=async(c:number)=>{await page.evaluate(n=>{const e=document.querySelector(`[data-chapter="${n}"]`)!;window.scrollTo({top:e.getBoundingClientRect().top+scrollY,behavior:'instant'});},c);};
 await jump(1);
 await expect(page.locator('.story-initialize')).toBeVisible();
 await expect(page.locator('.story-initialize')).toHaveCount(0,{timeout:10000});
 await expect(page.locator('.meet-frame')).toBeVisible();
 const canvas=page.locator('.story-stage canvas').first();
 await expect(canvas).toBeVisible();
 await canvas.evaluate(e=>e.setAttribute('data-identity','stable'));
 await jump(2);
 for(const b of await page.locator('.story-cards button').all()) {await b.click(); await expect(canvas).toHaveAttribute('data-identity','stable');}
 await jump(3);await expect(page.locator('.pk-story-card')).toContainText('Cmax');
 await jump(7);await expect(page.locator('.cohort-telemetry')).toBeVisible();
 await jump(9);await expect(page.locator('.translation-telemetry')).toContainText('Not validated');
 await page.setViewportSize({width:390,height:844});await jump(1);
 await expect(page.locator('.story-stage')).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(canvas).toHaveAttribute('data-identity','stable');
 expect(errors).toEqual([]);
});
