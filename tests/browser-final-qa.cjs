/* Local real-browser regression. AI outage is intentionally injected; native
   process replay is covered separately by tests/native_flows.py. */
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='.runtime/browser-final-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(20000);
 const report={examples:[],errors:[],screens:[],checks:[]};
 page.on('pageerror',e=>report.errors.push(e.message));
 await page.route('**/api/analyze',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'QA simulated AI outage'})}));
 try{
  await page.goto('http://127.0.0.1:3024/#mosfet');
  await page.waitForFunction(()=>window.reverseLab&&window.RecipeStudio&&typeof busy!=='undefined'&&!busy,{},{timeout:150000});
  await page.evaluate(()=>{const f=RecipeStudio.diagnose;RecipeStudio.diagnose=function(...args){window.__qaQuestion=RecipeStudio.designQuestion(args[1],args[5]?.report);return f.apply(this,args)}});
  const ids=await page.evaluate(()=>catalog.map(x=>x.id));assert.equal(ids.length,24);
  for(const id of ids){
   await page.evaluate(id=>reverseLab.select(id,true),id);
   await page.locator('#r-grade').click();await page.locator('#rs-quiz').waitFor();
   await page.locator('#rs-quiz button[type=submit]').click();assert.match(await page.locator('#rs-error').innerText(),/선택/);
   const question=await page.evaluate(()=>__qaQuestion);
   const wrong=question.choices.find(x=>x.id!==question.correct).id;
   await page.locator(`#rs-quiz input[value="${wrong}"]`).check();
   await page.locator('#rs-reason').fill('관측한 형상과 농도 차이를 비교하고 해당 공정 조건을 하나씩 바꿔 확인하겠습니다.');
   await page.locator('#rs-quiz button[type=submit]').click();assert.match(await page.locator('#rs-error').innerText(),/다시/);
   assert.equal(await page.locator('.rs-dialog[open]').count(),0);
   await page.locator(`#rs-quiz input[value="${question.correct}"]`).check();await page.locator('#rs-quiz button[type=submit]').click();
   await page.locator('.rs-candidate').first().waitFor();assert.equal(await page.locator('.rs-candidate').count(),3);
   const entry=await page.evaluate(async id=>(await fetch('/api/flow-candidates/'+id)).json(),id);
   for(let i=0;i<3;i++){
    if(i){await page.locator('#r-answer').click();await page.locator('.rs-candidate').first().waitFor()}
    await page.locator(`[data-load="${i}"]`).click();await page.waitForFunction(()=>!document.querySelector('.rs-dialog').open);
    assert.equal(await page.locator('#r-flow [data-step]').count(),entry.candidates[i].steps.length+1,id+' flow length');
    if(i){await page.locator('#r-compare').click();assert.equal(await page.locator('#r-flow [data-step]').count(),entry.candidates[i-1].steps.length+1);await page.locator('#r-compare').click()}
   }
   await page.locator('#r25d').click();await page.waitForTimeout(120);
   const area=page.locator('.reverse-view');await area.locator('.explode-toggle').click();await area.locator('.explode-reset').click();
   await page.locator('#r2d').click();
   for(const axis of ['X','Z','Y']){await area.locator(`[data-axis="${axis}"]`).click();await area.locator('.slice-position').fill('650');await area.locator('.slice-position').dispatchEvent('input')}
   await page.locator('#r-flow [data-step="0"]').click();
   await page.locator('#r-wafer-depth').fill('600');await page.locator('#r-wafer-depth').dispatchEvent('input');
   assert.equal(await page.locator('#r-wafer-depth').inputValue(),'600');
   report.examples.push({id,candidates:3,quiz:true,wrongAnswerLocked:true,comparison:true,slices:true,explode:true,waferEdit:true});
   console.log(id,'quiz, 3 candidates, comparison, 3D, slices, wafer PASS');
  }
  for(const [width,height] of [[1440,900],[1366,768],[768,1024],[390,844]]){
   await page.setViewportSize({width,height});await page.waitForTimeout(200);
   const overflow=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));
   report.screens.push({width,height,overflow:overflow.body>width+2});
   await page.screenshot({path:`${out}/workspace-${width}.png`,fullPage:true});
   await page.locator('#r-answer').click();await page.locator('.rs-candidate').first().waitFor();
   await page.screenshot({path:`${out}/candidates-${width}.png`,fullPage:true});
   await page.locator('.rs-close').click();
  }
  assert.deepEqual(report.errors,[]);
 }catch(e){report.failure=e.stack;await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
