'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto((process.env.QA_BASE||'http://127.0.0.1:3034')+'/#mosfet');
  await page.waitForFunction(()=>typeof current!=='undefined'&&current?.frames?.length&&!busy,null,{timeout:180000});
  await page.evaluate(()=>{frame=current.frames.length-1;updateFrame();});
  async function plot(){
   await page.locator('#learning-lab-open').click();await page.locator('[data-tab=device]').click();
   await page.locator('#ll-iv-plot .ll-chart').waitFor();
   const result=await page.locator('#ll-iv-plot .ll-chart path').first().getAttribute('d');
   await page.keyboard.press('Escape');return result;
  }
  const initial=await plot(),index=await page.evaluate(()=>current.steps.findIndex(s=>s.op==='diffusion'&&s.params.method==='Ion implantation')+1);
  await page.locator(`#timeline [data-frame="${index}"]`).locator('..').locator('.flow-disclosure').click();
  const input=page.locator('#obs-p-dose'),dose=Number(await input.inputValue());await input.fill(String(dose*2));
  await page.locator('#obs-step-run').click();
  await page.waitForFunction(()=>!busy&&current.customFlow&&!simulationEditor.pending,null,{timeout:240000});
  assert.equal(await page.evaluate(()=>current.steps.find(s=>s.op==='diffusion'&&s.params.method==='Ion implantation').params.dose),dose*2);
  await page.evaluate(()=>{frame=current.frames.length-1;updateFrame();});
  assert.notEqual(await plot(),initial,'actual recipe form → native result → reopened curve');
  assert.deepEqual(errors,[]);console.log('PASS: actual MOSFET dose input, native calculation and refreshed I–V.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
