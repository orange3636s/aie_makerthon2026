'use strict';
const {chromium}=require('../.runtime/browser-qa/node_modules/playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const base=process.env.QA_BASE||'http://127.0.0.1:3031',out='.runtime/final-stage-live';fs.mkdirSync(out,{recursive:true});
(async()=>{const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}),p=await b.newPage({viewport:{width:1440,height:900}}),report={examples:[],errors:[]};p.on('pageerror',e=>report.errors.push(e.message));p.setDefaultTimeout(20000);
try{
 await p.goto(base+'/#mosfet');await p.waitForFunction(()=>current?.frames?.length&&!busy&&window.reverseLab,null,{timeout:180000});await p.evaluate(()=>document.fonts.ready);
 assert(await p.evaluate(()=>document.fonts.check('14px ProcessSans')));
 const ids=await p.evaluate(()=>catalog.map(t=>t.id));
 for(const id of ids){
  await p.evaluate(async id=>{await reverseLab.select(id,true);await reverseLab.loadCandidate({targetId:id,name:'QA baseline',steps:reverseLab.context().reference.steps})},id);
  const n=await p.evaluate(()=>reverseLab.context().steps.length),row={id,stages:n+1,inputs:0,live:[],edits:0};
  for(let i=0;i<=n;i++){
   const stage=p.locator(`#r-flow [data-step="${i}"]`);await stage.click();await stage.locator('..').locator('.flow-disclosure').click();
   const state=await p.evaluate(()=>{const ctx=reverseLab.context(),inputs=[...document.querySelectorAll('#reverse-fields input[type=number]')].filter(e=>e.getClientRects().length&&e.offsetWidth);return {index:ctx.selectedIndex,sync:SolidView.get('r-current').data===ctx.frame,inputs:inputs.length,invalid:inputs.filter(e=>!e.validity.valid).map(e=>({id:e.id,value:e.value,min:e.min,max:e.max})),clip:inputs.filter(e=>{const c=getComputedStyle(e),x=document.createElement('canvas').getContext('2d');x.font=c.font;return e.clientWidth-parseFloat(c.paddingLeft)-parseFloat(c.paddingRight)<x.measureText(e.value).width+1}).map(e=>e.id)}});
   assert.equal(state.index,i,id);assert(state.sync,id+' stage geometry');assert.deepEqual(state.invalid,[],id+' invalid defaults');assert.deepEqual(state.clip,[],id+' input clipping');row.inputs+=state.inputs;
   await stage.locator('..').locator('.flow-disclosure').click();
  }
  const liveIndex=await p.evaluate(()=>reverseLab.context().steps.findIndex(s=>['deposition','etch'].includes(s.op)||s.op==='diffusion'&&s.params.method==='Ion implantation')+1);
  if(liveIndex){await p.locator(`#r-flow [data-step="${liveIndex}"]`).click();for(const mode of ['2d','25d']){
   await p.locator('#r'+mode).click();const live=p.locator('.reverse-view .live-toggle');await live.click();assert.equal(await live.getAttribute('aria-pressed'),'true');
   const before=await p.locator('#r-current').screenshot();await p.waitForTimeout(220);const after=await p.locator('#r-current').screenshot();assert(!before.equals(after),id+' '+mode+' animation must move');
   await live.click();assert.equal(await p.evaluate(()=>SolidView.get('r-current').live),false);row.live.push(mode);
  }}
  await p.locator('#r2d').click();const stage=p.locator(`#r-flow [data-step="${liveIndex||1}"]`);await stage.click();await stage.locator('..').locator('.flow-disclosure').click();
  const numeric=p.locator('#reverse-fields input[type=number]:visible').first();if(await numeric.count()){
   const original=await numeric.inputValue(),meta=await numeric.evaluate(e=>({min:+e.min,max:+e.max}));const value=Math.min(meta.max,Math.max(meta.min,Number(original)*1.05+.01));
   await numeric.fill(String(value));assert(await p.evaluate(()=>reverseLab.context().pending),id+' modified recipe must be pending');await numeric.fill(original);row.edits++;
  }
  report.examples.push(row);console.log(id,JSON.stringify(row));
 }
 for(const width of [1920,1366,1024,768,390]){await p.setViewportSize({width,height:width===390?844:768});await p.waitForTimeout(100);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),'overflow '+width);const last=p.locator('#r-flow [data-step]').last();await last.scrollIntoViewIfNeeded();assert(await last.isVisible());await p.screenshot({path:out+'/workspace-'+width+'.png'});}
 assert.deepEqual(report.errors,[]);
}catch(e){report.failure=e.stack;await p.screenshot({path:out+'/failure.png'});throw e}finally{fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
