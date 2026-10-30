'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],base=process.env.QA_BASE||'http://127.0.0.1:3034';
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto(base+'/#mosfet');await page.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:180000});
  const ids=await page.evaluate(()=>LearningLabModels.electricalDevices);
  for(const id of ids){
   await page.evaluate(async id=>{await select(id);frame=current.frames.length-1;updateFrame();},id);
   await page.locator('#learning-lab-open').click();await page.locator('#ll-content').getByText('학습 데이터 준비 중…').waitFor({state:'hidden'});
   await page.locator('[data-tab=device]').click();await page.locator('#ll-iv-plot .ll-chart').first().waitFor();
   if(id==='cfet'){
    assert.equal(await page.locator('#ll-iv-plot .ll-chart').count(),2,'CFET branches use separate readable scales');
    for(const chart of await page.locator('#ll-iv-plot .ll-chart').all())assert(await chart.locator('path').first().evaluate(e=>e.getBBox().height)>100,'each CFET branch visible');
   }
   const paths=page.locator('#ll-iv-plot .ll-chart path');assert.equal(await paths.count(),id==='cfet'?4:2,id+' curves incl reference');
   const before=await paths.first().getAttribute('d');
   const key=id==='pn-junction'?'ideality':'vfb',value=id==='pn-junction'?'1.5':'0.5';
   await page.locator(`[data-number=${key}]`).fill(value);assert.notEqual(await paths.first().getAttribute('d'),before,id+' input response');
   await page.locator(`[data-number=${key}]`).fill('999');assert.match(await page.locator('#ll-iv-plot').innerText(),/입력 범위/);
   await page.locator('#ll-iv-reset').click();assert.equal(await paths.first().getAttribute('d'),before,id+' reset');
   if(id==='pn-junction'){
    await page.locator('[data-number=ideality]').fill('2');await page.locator('[data-number=lifetimeUs]').fill('100');await page.locator('[data-number=areaUm2]').fill('0.01');
    assert(await paths.first().evaluate(e=>e.getBBox().height)>100,'tiny PN currents stay readable');await page.locator('#ll-iv-reset').click();
   }
   await page.screenshot({path:'.runtime/iv-'+id+'.png'});
   console.log(id+' curve + input + invalid + reset passed');await page.keyboard.press('Escape');
  }
  await page.evaluate(()=>{frame=0;updateFrame();});await page.locator('#learning-lab-open').click();await page.locator('[data-tab=device]').click();await page.locator('#ll-iv-plot .ll-empty').waitFor();assert.equal(await page.locator('#ll-iv-plot path').count(),0,'empty wafer never shows stale curve');await page.keyboard.press('Escape');
  await page.evaluate(()=>{frame=current.frames.length-1;updateFrame();});await page.locator('#learning-lab-open').click();await page.locator('[data-tab=device]').click();
  for(const width of [1440,768,390,320]){
   await page.setViewportSize({width,height:850});await page.waitForTimeout(150);
   assert(!(await page.locator('.ll-dialog').evaluate(e=>e.scrollWidth>e.clientWidth+2)),'overflow '+width);
   await page.screenshot({path:'.runtime/iv-responsive-'+width+'.png'});
  }
  await page.keyboard.press('Escape');assert.deepEqual(errors,[]);console.log('11-device UI, wafer state, 1440/768/390/320 layouts and console passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
