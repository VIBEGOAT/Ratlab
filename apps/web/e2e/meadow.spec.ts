import { test, expect } from '@playwright/test';
test('atmosphere shaders compile and meadow, internal views and Auto remain usable', async ({page}) => {
 const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.setViewportSize({width:800,height:900});
 await page.addInitScript(()=>localStorage.setItem('force3d','1'));
 await page.goto('/#story');
 await page.getByRole('button',{name:'Begin',exact:true}).focus();
 await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
 const hero=page.getByTestId('cinematic-hero');
 await expect(hero).toBeVisible();
 await expect(page.getByText('Growing a little world…')).not.toBeVisible();
 for(const [index,label] of ['Meadow','Organs','Nerves'].entries()){
  await hero.getByRole('button',{name:label,exact:true}).click();
  await expect(hero).toHaveAttribute('data-stage',String(index));
  await page.waitForTimeout(1200);
 }
 await hero.getByRole('button',{name:'Auto',exact:true}).click();
 await expect(hero.getByRole('button',{name:'Auto',exact:true})).toHaveCount(0);
 await hero.getByRole('button',{name:'Pause cinematic scene'}).click();
 await expect(hero.getByRole('button',{name:'Play cinematic scene'})).toBeVisible();
 expect(errors).toEqual([]);
});
