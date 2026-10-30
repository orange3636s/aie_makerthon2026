'use strict';
// Render the saved native reference results; this is not a new native solver run.
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.goto(process.env.QA_URL||'http://127.0.0.1:3027/#mosfet');await p.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:180000});
 const ids=await p.evaluate(async()=>(await(await fetch('/api/reverse-catalog')).json()).targets.map(t=>t.id));
 for(const id of ids){await p.evaluate(async id=>{const ref=await(await fetch('/api/reference/'+id)).json();lastResults.clear();lastResults.set(id,ref);await select(id);frame=current.frames.length-1;updateFrame();},id);await p.locator('#learning-lab-open').click();await p.locator('#ll-content h3').first().waitFor();await p.locator('[data-tab=profile]').click();await p.locator('#ll-kind').selectOption('film');assert(await p.locator('#ll-profile-plot svg').count()>0,id);await p.locator('[data-tab=device]').click();if(id!=='mosfet')assert.match(await p.locator('#ll-content').innerText(),/평면 NMOS/);await p.locator('[data-tab=mission]').click();await p.locator('#ll-check').click();assert.match(await p.locator('#ll-mission-result').innerText(),/목표 충족/,id);await p.keyboard.press('Escape');console.log(id+' saved-result profile / IV scope / mission passed');}
 assert.deepEqual(errors,[]);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
