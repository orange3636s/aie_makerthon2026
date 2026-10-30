'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.QA_BASE||'http://127.0.0.1:3034',errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/tutorial');await page.locator('#parameter-detail .primary').waitFor();
  assert.equal(await page.locator('#detail-title').textContent(),'Trench');
  assert.equal(await page.locator('.process-card').count(),7);
  assert(await page.locator('#lesson-prev').isDisabled());
  const headings=new Set();
  for(let i=0;i<5;i++){
   assert.equal(await page.locator('#lesson-progress').textContent(),`${i+1} / 5`);
   assert.equal(await page.locator('[data-lesson][aria-current=step]').count(),1);
   headings.add(await page.locator('#lesson-copy h3').textContent());
   assert(await page.locator('#lesson-preview svg').isVisible());
   if(i<4)await page.locator('#lesson-next').click();
  }
  assert.equal(headings.size,5);assert(await page.locator('#lesson-next').isDisabled());
  await page.locator('#lesson-prev').click();assert.equal(await page.locator('#lesson-progress').textContent(),'4 / 5');
  await page.locator('[data-lesson="0"]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#lesson-progress').textContent(),'1 / 5');
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:900});
   for(let i=0;i<5;i++){
    await page.locator(`[data-lesson="${i}"]`).click();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`lesson ${i} overflow at ${width}`);
   }
   for(const id of ['wafer','photo','etch','deposition','implant','diffusion','cmp']){
    const guide=page.locator('#guide-'+id);await guide.locator(':scope>summary').click();
    assert(await guide.locator('svg').isVisible());assert(await guide.locator('code').isVisible());
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),`${id} overflow at ${width}`);
    await guide.locator(':scope>summary').click();
   }
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`.runtime/tutorial-new-${width}.png`});
   console.log(width,'px: five lessons and seven process guides passed');
  }
  await page.setViewportSize({width:1440,height:1000});await page.locator('[data-lesson="2"]').click();await page.locator('#start').scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/tutorial-new-walkthrough.png'});
  await page.locator('#guide-photo>summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#guide-photo').evaluate(e=>e.open));
  await page.locator('#reverse-guide').scrollIntoViewIfNeeded();await page.screenshot({path:'.runtime/tutorial-new-principles.png'});
  await page.route('**/api/catalog',route=>route.fulfill({status:503,body:'Unavailable'}));await page.reload();
  await page.waitForFunction(()=>document.getElementById('parameter-detail').textContent.includes('불러오지 못했습니다'));
  await page.locator('#lesson-next').click();assert.equal(await page.locator('#lesson-progress').textContent(),'2 / 5');
  assert.deepEqual(errors,[]);console.log('Keyboard, disabled navigation bounds, independent guide on API failure, and no runtime errors passed.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
