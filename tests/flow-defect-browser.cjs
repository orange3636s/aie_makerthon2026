'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],base=process.env.QA_BASE||'http://127.0.0.1:3029';p.on('pageerror',e=>errors.push(e.message));
try{
 await p.goto(base+'/#mosfet');await p.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:120000});
 await p.locator('#reverse-mode').click();await p.locator('#r-answer').waitFor();await p.waitForFunction(()=>!document.getElementById('r-answer').disabled);
 assert.equal(await p.locator('#r-answer').innerText(),'후보 보기');assert.equal(await p.locator('#r-grade').innerText(),'공정설계 평가');
 await p.locator('#r-answer').click();await p.getByRole('button',{name:'예제 flow 불러오기',exact:true}).first().click();await p.waitForFunction(()=>reverseLab.context().result&&!reverseLab.context().pending);
 const card=p.locator('#r-flow [data-step="3"]');await card.click();assert.equal(await card.locator('..').locator('.flow-disclosure').getAttribute('aria-expanded'),'false');await card.locator('..').locator('.flow-disclosure').click();assert(await p.locator('#rp-thickness').isVisible());
 for(const width of [1440,768,390]){await p.setViewportSize({width,height:900});await p.waitForTimeout(100);const box=await p.locator('#rp-thickness').evaluate(e=>{const c=getComputedStyle(e),x=document.createElement('canvas').getContext('2d');x.font=c.font;return {available:e.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight),needed:x.measureText(e.value).width}});assert(box.available>=box.needed+2,'number clipping '+width);assert(await p.locator('#rp-thickness').evaluate(e=>e.closest('.recipe-gauge').getBoundingClientRect().right<=e.closest('.field').getBoundingClientRect().right+1),'gauge must not cover adjacent field');assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await p.locator('.reverse-controls').screenshot({path:'.runtime/recipe-fix-'+width+'.png'});}
 await p.setViewportSize({width:1440,height:900});await card.locator('..').locator('.flow-disclosure').click();assert.equal(await card.locator('..').locator('.flow-disclosure').getAttribute('aria-expanded'),'false');
 const saved=await p.evaluate(()=>localStorage.getItem('simulation.recipe.mosfet'));
 for(const id of ['activation','oxide','cost']){
  await p.locator('#defect-mode').click();await p.locator(`[data-case="${id}"]`).click();await p.waitForFunction(id=>window.DefectLab?.active===id&&reverseLab.context().result&&!reverseLab.context().pending,id,{timeout:60000});assert(await p.locator('.defect-brief').isVisible());assert(!await p.locator('.design-brief').isVisible());
  await p.locator('#r-grade').click();assert(await p.getByText('추가 개선 필요',{exact:true}).isVisible());await p.locator('#defect-return').click();
  assert.equal(await p.evaluate(()=>localStorage.getItem('simulation.recipe.mosfet')),saved,'normal reverse draft preserved');
  if(id==='oxide'){
   const first=p.locator('#r-flow [data-step="1"]');await first.locator('..').locator('.flow-disclosure').click();await p.locator('#rp-cycles').fill('25');await p.locator('#rp-cycles').dispatchEvent('input');
   await p.locator('#r-grade').click();assert(await p.getByText('수정한 전체 공정을 계산한 뒤 평가하세요.',{exact:true}).isVisible());await p.locator('.defect-dialog [data-close]').click();
   await p.locator('#r-run').click();await p.waitForFunction(()=>!reverseLab.busy&&!reverseLab.context().pending,{},{timeout:120000});await p.locator('#r-grade').click();assert(await p.getByText('개선 목표 달성',{exact:true}).isVisible());await p.locator('#defect-return').click();
  }
 }
 await p.locator('#r-answer').click();await p.locator('[data-load="0"]').click();await p.waitForFunction(()=>reverseLab.context().result&&!reverseLab.context().pending);await p.locator('#r-grade').click();assert(await p.getByText('개선 목표 달성',{exact:true}).isVisible());await p.locator('#defect-return').click();
 await p.locator('#r25d').click();const controls=p.locator('.reverse-view .explode-controls');await controls.locator('.explode-toggle').click();
 for(const mode of ['layer','material']){await controls.locator('select').selectOption(mode);await p.waitForTimeout(700);await p.locator('.reverse-view').screenshot({path:'.runtime/explode-'+mode+'.png'});}
 await controls.locator('.explode-reset').click();assert.equal(await controls.locator('.explode-toggle').getAttribute('aria-pressed'),'false');
 await p.locator('#reverse-mode').click();assert.equal(await p.evaluate(()=>DefectLab.active),null);assert(await p.locator('.design-brief').isVisible());
 assert.deepEqual(errors,[]);console.log('Ungated candidate loading, aligned collapsible flow, unclipped numeric inputs at 3 widths, three defect cases, repair pass, draft isolation and 3D modes passed.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
