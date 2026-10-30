'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}}),base=process.env.QA_BASE||'http://127.0.0.1:3027',errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 const start=Date.now();await page.goto(base+'/#mosfet');await page.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:180000});assert(await page.evaluate(()=>current.cached));console.log('MOSFET page ready',Date.now()-start,'ms');
 for(let i=0;i<3;i++){
  if(i)await page.evaluate(()=>document.getElementById('observe-mode').click());
  await page.locator('#lab-candidates').click();await page.locator(`[data-load="${i}"]`).waitFor();const at=Date.now();await page.locator(`[data-load="${i}"]`).click();await page.waitForFunction(()=>window.reverseLab?.active&&reverseLab.context().result&&!reverseLab.context().pending,null,{timeout:30000});
  const c=await page.evaluate(()=>{const c=reverseLab.context();return {frames:c.result.frames.length,steps:c.steps.length,cached:c.result.cached,index:c.index}});assert.equal(c.frames,c.steps+1);assert.equal(c.index,c.steps);console.log('Candidate',i+1,c.frames,'frames ready',Date.now()-at,'ms');
 }
 await page.goto(base+'/tutorial');await page.locator('#parameter-detail .primary').waitFor();assert.equal(await page.locator('.process-card').count(),7);
 for(const width of [1440,768,390]){
  await page.setViewportSize({width,height:900});for(const id of ['photo','etch','deposition','implant','diffusion','cmp']){await page.locator('#guide-'+id+'>summary').click();assert(await page.locator('#guide-'+id+' svg').isVisible());assert(await page.locator('#guide-'+id+' code').isVisible());await page.locator('#guide-'+id+'>summary').click();}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'page overflow '+width);await page.screenshot({path:'.runtime/tutorial-'+width+'.png',fullPage:true});
 }
 await page.locator('#guide-photo>summary').focus();await page.keyboard.press('Enter');assert(await page.locator('#guide-photo').evaluate(e=>e.open));await page.screenshot({path:'.runtime/tutorial-photo-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('Three saved candidate flows, seven visual process guides, keyboard and three responsive widths passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
