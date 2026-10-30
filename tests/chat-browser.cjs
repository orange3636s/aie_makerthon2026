'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const p=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],requests=[];
 p.on('pageerror',e=>errors.push(e.message));let mode='ok';
 await p.route('**/api/chat',async route=>{
  requests.push(route.request().postDataJSON());
  if(mode==='slow')await new Promise(r=>setTimeout(r,1200));
  try{await route.fulfill({status:mode==='error'?429:200,contentType:'application/json',body:JSON.stringify(mode==='error'?{error:'요청 제한입니다. 잠시 후 다시 시도하세요.'}:{answer:'현재 레시피를 비교해 보세요.\n<img src=x onerror=alert(1)>',evidence:'recipe-only'})})}catch{}
 });
 try{
  await p.goto((process.env.QA_BASE||'http://127.0.0.1:3030')+'/#mosfet');
  await p.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:120000});
  const original=await p.evaluate(()=>JSON.stringify(current));
  await p.locator('.chat-launch').click();await p.locator('#chat-question').fill('ALD와 PVD 차이는?');await p.locator('.chat-send').click();
  await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===1);
  assert.equal(requests[0].target,'mosfet');assert(requests[0].steps.length>0);assert.equal(requests[0].history.length,0);
  assert.equal(await p.locator('.chat-text img').count(),0);
  await p.locator('#chat-question').fill('그럼 이번 단계에서는?');await p.locator('#chat-question').press('Enter');
  await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===2);
  assert.equal(requests[1].history.length,2);
  // Korean composition Enter must not prematurely submit.
  await p.locator('#chat-question').fill('한글 조합');
  await p.locator('#chat-question').evaluate(el=>{el.dispatchEvent(new CompositionEvent('compositionstart'));el.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,isComposing:true}));el.dispatchEvent(new CompositionEvent('compositionend'))});
  assert.equal(requests.length,2);
  mode='error';await p.locator('.chat-send').click();await p.locator('.chat-status button').waitFor();
  assert.equal(await p.locator('#chat-question').inputValue(),'한글 조합');
  mode='ok';await p.locator('.chat-status button').click();await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===3);
  assert.equal(await p.locator('.chat-message.user').count(),3,'retry must not duplicate message');
  await p.locator('#chat-attach').uncheck();await p.locator('#chat-question').fill('산화란?');await p.locator('.chat-send').click();
  await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===4);
  assert.equal(requests.at(-1).target,undefined);assert.equal(requests.at(-1).history.length,0);
  mode='slow';await p.locator('#chat-question').fill('긴 질문');await p.locator('.chat-send').click();await p.locator('.chat-send.is-stop').waitFor();
  const before=requests.length;await p.locator('.chat-send').click();await p.waitForTimeout(1500);assert.equal(requests.length,before,'stop must not resubmit');assert.equal(await p.locator('.chat-loading').count(),0);
  await p.locator('#chat-question').press('Escape');assert(await p.locator('#chat-panel').isHidden());assert(await p.locator('.chat-launch').evaluate(el=>el===document.activeElement));
  assert.equal(await p.evaluate(()=>JSON.stringify(current)),original,'chat cannot mutate simulation');
  await p.locator('.chat-launch').click();await p.locator('#chat-attach').check();await p.locator('.chat-close').click();
  await p.locator('#timeline .frame-card.selected').locator('..').locator('.flow-disclosure').click();
  const numeric=p.locator('#obs-step-fields input[type=number]').first();
  await numeric.fill(String(Number(await numeric.inputValue())+1));
  mode='ok';await p.locator('.chat-launch').click();await p.locator('#chat-question').fill('수정한 조건은?');await p.locator('.chat-send').click();
  await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===5);
  assert.equal(requests.at(-1).pending,true);assert.notDeepEqual(requests.at(-1).steps,requests[0].steps,'send edited draft, not stale computed recipe');
  await p.locator('.chat-close').click();
  mode='ok';await p.locator('.chat-launch').click();await p.locator('#chat-attach').check();
  await p.locator('.chat-close').click();await p.locator('#reverse-mode').click();
  await p.waitForFunction(()=>reverseLab.active&&reverseLab.context().reference);
  await p.locator('.chat-launch').click();await p.locator('#chat-question').fill('Wafer 단계는?');await p.locator('.chat-send').click();
  await p.waitForFunction(()=>document.querySelectorAll('.chat-message.assistant:not(.chat-loading)').length===6);
  assert.equal(requests.at(-1).selectedStep,0);
  await p.screenshot({path:'.runtime/chat-desktop.png'});
  for(const width of [768,390]){
   await p.setViewportSize({width,height:844});await p.waitForTimeout(300);
   const b=await p.locator('#chat-panel').boundingBox();assert(b.x>=0&&b.x+b.width<=width&&b.y>=0&&b.y+b.height<=844);
   assert(await p.locator('.chat-send').isVisible());await p.screenshot({path:'.runtime/chat-'+width+'.png'});
  }
  assert.deepEqual(errors,[]);console.log('Chat UI: context, history, escaping, retry, Korean IME, cancellation, reverse design, keyboard and 1440/768/390 layouts passed.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
