const {chromium}=require('../.runtime/browser-qa/node_modules/playwright');
const fs=require('node:fs'),assert=require('node:assert/strict');
const out='.runtime/browser-edge-qa';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const p=await b.newPage({viewport:{width:1366,height:768}});p.setDefaultTimeout(20000);
 const report={checks:[],errors:[]};p.on('pageerror',e=>report.errors.push(e.message));
 await p.route('**/api/analyze',async r=>{await new Promise(r=>setTimeout(r,1500));await r.fulfill({status:503,contentType:'application/json',body:'{"error":"QA outage"}'}).catch(()=>{})});
 try{
  await p.goto('http://127.0.0.1:3024/#mosfet');await p.waitForFunction(()=>window.reverseLab&&typeof busy!=='undefined'&&!busy,{},{timeout:150000});
  await p.evaluate(async()=>{await reverseLab.select('mosfet',true);const e=await(await fetch('/api/flow-candidates/mosfet')).json();reverseLab.loadCandidate({...e.candidates[0],targetId:'mosfet'})});
  const count=await p.locator('#r-flow [data-step]').count();
  await p.locator('#r-flow [data-remove="2"]').click();assert.equal(await p.locator('#r-flow [data-step]').count(),count-1);
  await p.locator('#r-undo').click();assert.equal(await p.locator('#r-flow [data-step]').count(),count);report.checks.push('step deletion/undo');
  await p.locator('#r-flow [data-step="1"]').click();
  const cycles=p.locator('#rp-cycles');const previous=await cycles.inputValue();await cycles.fill('150');
  assert.equal(await p.evaluate(()=>reverseLab.recipe().params.cycles),150);
  assert.equal(await p.locator('#r-flow .flow-step.pending').count(),count-1);report.checks.push('parameter edit invalidates dependent frames');
  await p.locator('#r-grade').click();await p.locator('#review-offline').click();await p.locator('#rs-quiz').waitFor();
  assert.match(await p.locator('#review-content').innerText(),/중간 평가/);await p.locator('#review-close').click();report.checks.push('AI skip and pending-recipe evaluation');
  await p.locator('#r-grade').click();await p.locator('#review-close').click();await p.evaluate(()=>reverseLab.select('sti',true));await p.waitForTimeout(1800);
  assert.equal(await p.locator('#review-dialog[open]').count(),0);assert.equal(await p.locator('#title').innerText(),'STI');report.checks.push('late AI response cannot reopen old target');
  await p.evaluate(()=>reverseLab.select('mosfet'));await p.locator('#r-flow [data-step="1"]').click();assert.equal(await cycles.inputValue(),'150');report.checks.push('edited draft survives target switch');
  await p.locator('#r-reset').click();await p.locator('#r-wafer-depth').fill('-1');await p.locator('#r-run').click();
  assert.equal(await p.evaluate(()=>reverseLab.busy),false);assert.equal(await p.locator('#r-wafer-depth').evaluate(e=>e.validity.valid),false);report.checks.push('invalid wafer blocks calculation');
  await p.locator('#r-wafer-depth').fill('600');await p.locator('#r-wafer-roughness').fill('12');await p.locator('#r-run').click();
  await p.waitForFunction(()=>!reverseLab.busy&&document.querySelector('#r-status').textContent.includes('계산 완료'),{},{timeout:90000});report.checks.push('rough wafer actual native calculation');
  await p.locator('.reverse-controls .metrology-add button').click();await p.locator('.reverse-controls .metrology-add select').selectOption('surface');
  assert(await p.locator('.reverse-view').evaluate(e=>e.classList.contains('measurement-selected')));
  await p.locator('#r-flow [data-step="0"]').click();assert(!await p.locator('.reverse-view').evaluate(e=>e.classList.contains('measurement-selected')));report.checks.push('measurement enter/exit');
  for(const mode of ['2d','25d']){
   await p.locator('#r'+mode).click();const download=p.waitForEvent('download');await p.locator('#rpng').click();const d=await download;await d.saveAs(out+'/'+mode+'.png');assert(fs.statSync(out+'/'+mode+'.png').size>1000);
  }report.checks.push('2D/3D PNG exports');
  await p.locator('#r-current').hover();await p.mouse.wheel(0,-200);await p.locator('#r-current').dblclick();report.checks.push('wheel zoom and reset');
  await p.reload();await p.waitForFunction(()=>window.reverseLab&&typeof busy!=='undefined'&&!busy,{},{timeout:150000});await p.evaluate(()=>reverseLab.select('mosfet'));
  assert.equal(await p.locator('#r-wafer-depth').inputValue(),'600');assert.equal(await p.locator('#r-wafer-roughness').inputValue(),'12');report.checks.push('wafer values survive reload');
  assert.deepEqual(report.errors,[]);console.log(report.checks.join('\n'));
 }catch(e){report.failure=e.stack;await p.screenshot({path:out+'/failure.png',fullPage:true});throw e}
 finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
